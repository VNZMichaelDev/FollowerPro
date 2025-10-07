const Order = require('../../models/Order');
const { authenticateToken } = require('../../utils/jwt');
const { success, error, notFound } = require('../../utils/apiResponse');

async function handler(req, res) {
    // Solo permitir GET
    if (req.method !== 'GET') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const userId = req.user.userId;
        const orderId = req.query.id;

        if (!orderId) {
            return error(res, 'ID de orden requerido', 400);
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return notFound(res, 'Orden no encontrada');
        }

        // Verificar que la orden pertenezca al usuario (o sea admin)
        if (order.usuario_id !== userId && req.user.rol !== 'admin') {
            return error(res, 'No tienes permiso para ver esta orden', 403);
        }

        return success(res, { order });

    } catch (err) {
        console.error('Error obteniendo orden:', err);
        return error(res, 'Error al obtener orden', 500);
    }
}

// Aplicar middleware de autenticación
module.exports = (req, res) => {
    authenticateToken(req, res, () => handler(req, res));
};
