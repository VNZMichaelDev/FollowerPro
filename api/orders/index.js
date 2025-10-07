const Order = require('../../models/Order');
const { authenticateToken } = require('../../utils/jwt');
const { success, error } = require('../../utils/apiResponse');

async function handler(req, res) {
    // Solo permitir GET
    if (req.method !== 'GET') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const userId = req.user.userId;
        const { page = 1, limit = 50, status } = req.query;

        const orders = await Order.findByUser(userId, {
            page: parseInt(page),
            limit: parseInt(limit),
            status
        });

        return success(res, {
            orders,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: orders.length
            }
        });

    } catch (err) {
        console.error('Error obteniendo órdenes:', err);
        return error(res, 'Error al obtener órdenes', 500);
    }
}

// Aplicar middleware de autenticación
module.exports = (req, res) => {
    authenticateToken(req, res, () => handler(req, res));
};
