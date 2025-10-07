const Order = require('../../models/Order');
const { authenticateToken } = require('../../utils/jwt');
const { success, error, validationError } = require('../../utils/apiResponse');

async function handler(req, res) {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const { service_id, link, quantity } = req.body;
        const userId = req.user.userId;

        // Validaciones
        if (!service_id || !link || !quantity) {
            return validationError(res, 'Servicio, link y cantidad son requeridos');
        }

        if (quantity <= 0) {
            return validationError(res, 'La cantidad debe ser mayor a 0');
        }

        // Crear orden
        const orderId = await Order.create(userId, {
            service_id,
            link,
            quantity
        });

        // Obtener orden creada
        const order = await Order.findById(orderId);

        return success(res, {
            order: {
                id: order.id,
                service_id: order.service_id,
                link: order.link,
                quantity: order.quantity,
                charge: order.charge,
                status: order.status,
                order_id: order.order_id
            }
        }, 'Orden creada exitosamente', 201);

    } catch (err) {
        console.error('Error creando orden:', err);
        return error(res, err.message || 'Error al crear orden', 500);
    }
}

// Aplicar middleware de autenticación
module.exports = (req, res) => {
    authenticateToken(req, res, () => handler(req, res));
};
