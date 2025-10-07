const { query } = require('../../config/database');
const Order = require('../../models/Order');
const { authenticateToken, requireAdmin } = require('../../utils/jwt');
const { success, error } = require('../../utils/apiResponse');

async function handler(req, res) {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        console.log('🔄 Procesando órdenes pendientes...');

        // Obtener órdenes pendientes
        const pendingOrders = await query(`
            SELECT o.*, s.name as service_name
            FROM ordenes o
            LEFT JOIN servicios_cache s ON o.service_id = s.service_id
            WHERE o.status = 'Pending' 
            AND (o.order_id LIKE 'ORD-%' OR o.order_id IS NULL)
            ORDER BY o.fecha_creacion ASC
            LIMIT 50
        `);

        if (pendingOrders.length === 0) {
            return success(res, {
                processed: 0,
                failed: 0,
                total: 0
            }, 'No hay órdenes pendientes para procesar');
        }

        console.log(`📊 Encontradas ${pendingOrders.length} órdenes pendientes`);

        let processed = 0;
        let failed = 0;
        const results = [];

        // Procesar cada orden
        for (const order of pendingOrders) {
            try {
                console.log(`📤 Procesando orden #${order.id}...`);

                const externalOrderId = await Order.sendToSMMCoder(
                    order.id,
                    order.service_id,
                    order.link,
                    order.quantity
                );

                if (externalOrderId) {
                    await query(
                        'UPDATE ordenes SET order_id = ?, status = ?, notas = NULL WHERE id = ?',
                        [externalOrderId, 'In progress', order.id]
                    );

                    processed++;
                    results.push({
                        id: order.id,
                        status: 'success',
                        external_id: externalOrderId
                    });

                    console.log(`✅ Orden #${order.id} procesada`);
                } else {
                    failed++;
                    results.push({
                        id: order.id,
                        status: 'failed',
                        error: 'No se obtuvo ID externo'
                    });
                }

                // Pausa para no sobrecargar la API
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (err) {
                failed++;
                results.push({
                    id: order.id,
                    status: 'failed',
                    error: err.message
                });

                console.error(`❌ Error procesando orden #${order.id}:`, err.message);

                await query(
                    'UPDATE ordenes SET notas = ? WHERE id = ?',
                    [`Error al reenviar: ${err.message}`, order.id]
                );
            }
        }

        console.log(`✅ Proceso completado: ${processed} exitosas, ${failed} fallidas`);

        return success(res, {
            processed,
            failed,
            total: pendingOrders.length,
            results
        }, `Proceso completado: ${processed} órdenes procesadas, ${failed} fallidas`);

    } catch (err) {
        console.error('Error procesando órdenes pendientes:', err);
        return error(res, 'Error al procesar órdenes pendientes', 500);
    }
}

// Aplicar middlewares de autenticación y admin
module.exports = (req, res) => {
    authenticateToken(req, res, () => {
        requireAdmin(req, res, () => handler(req, res));
    });
};
