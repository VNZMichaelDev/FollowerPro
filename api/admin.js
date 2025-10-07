const { query } = require('../config/database');
const Order = require('../models/Order');
const { authenticateToken, requireAdmin } = require('../utils/jwt');
const { success, error } = require('../utils/apiResponse');

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Manejar preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Obtener el path desde la query
    const path = req.query.path || req.url.split('?')[0].replace('/api/admin/', '');

    // Routing basado en el path
    return authenticateToken(req, res, () => {
        requireAdmin(req, res, () => {
            switch (path) {
                case 'users':
                    return handleUsers(req, res);
                case 'orders':
                    return handleOrders(req, res);
                case 'stats':
                    return handleStats(req, res);
                case 'process-pending':
                    return handleProcessPending(req, res);
                default:
                    return error(res, 'Ruta no encontrada', 404);
            }
        });
    });
};

// ============================================
// HANDLERS
// ============================================

async function handleUsers(req, res) {
    if (req.method !== 'GET') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const { page = 1, limit = 50, search } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let sql = 'SELECT id, nombre, apellido, email, balance, rol, estado, fecha_registro FROM usuarios';
        const params = [];

        if (search) {
            sql += ' WHERE nombre LIKE ? OR email LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY fecha_registro DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const users = await query(sql, params);
        const totalResult = await query('SELECT COUNT(*) as total FROM usuarios');

        return success(res, {
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalResult[0].total
            }
        });

    } catch (err) {
        console.error('Error obteniendo usuarios:', err);
        return error(res, 'Error al obtener usuarios', 500);
    }
}

async function handleOrders(req, res) {
    if (req.method !== 'GET') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const { page = 1, limit = 50, status } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let sql = `
            SELECT o.*, u.nombre, u.email, s.name as service_name
            FROM ordenes o
            LEFT JOIN usuarios u ON o.usuario_id = u.id
            LEFT JOIN servicios_cache s ON o.service_id = s.service_id
        `;

        const params = [];

        if (status) {
            sql += ` WHERE o.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY o.fecha_creacion DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const orders = await query(sql, params);
        const totalResult = await query('SELECT COUNT(*) as total FROM ordenes');

        return success(res, {
            orders,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalResult[0].total
            }
        });

    } catch (err) {
        console.error('Error obteniendo órdenes:', err);
        return error(res, 'Error al obtener órdenes', 500);
    }
}

async function handleStats(req, res) {
    if (req.method !== 'GET') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const totalUsers = await query('SELECT COUNT(*) as count FROM usuarios');
        const activeUsers = await query('SELECT COUNT(*) as count FROM usuarios WHERE estado = "activo"');
        const totalBalance = await query('SELECT SUM(balance) as total FROM usuarios');
        const totalOrders = await query('SELECT COUNT(*) as count FROM ordenes');
        const ordersByStatus = await query(`
            SELECT status, COUNT(*) as count 
            FROM ordenes 
            GROUP BY status
        `);

        return success(res, {
            stats: {
                totalUsers: totalUsers[0].count,
                activeUsers: activeUsers[0].count,
                totalBalance: parseFloat(totalBalance[0].total || 0).toFixed(2),
                totalOrders: totalOrders[0].count,
                ordersByStatus: ordersByStatus.reduce((acc, item) => {
                    acc[item.status] = item.count;
                    return acc;
                }, {})
            }
        });

    } catch (err) {
        console.error('Error obteniendo estadísticas:', err);
        return error(res, 'Error al obtener estadísticas', 500);
    }
}

async function handleProcessPending(req, res) {
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        console.log('🔄 Procesando órdenes pendientes...');

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
