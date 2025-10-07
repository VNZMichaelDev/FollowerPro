const Order = require('../models/Order');
const { authenticateToken } = require('../utils/jwt');
const { success, error, validationError, notFound } = require('../utils/apiResponse');

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Manejar preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Parsear body si es necesario
    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            body = {};
        }
    }

    // Obtener el path desde la query o URL
    let path = '';
    if (req.query && req.query.path) {
        path = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    } else if (req.url) {
        const urlParts = req.url.split('?')[0].split('/');
        path = urlParts[urlParts.length - 1] || '';
    }

    // Routing basado en el path
    if (path === 'create' || (path === '' && req.method === 'POST')) {
        return authenticateToken(req, res, () => handleCreate(req, res, body));
    } else if (path && path !== '' && path !== 'create') {
        // Es un ID específico
        return authenticateToken(req, res, () => handleGetById(req, res, path));
    } else {
        // Lista de órdenes
        return authenticateToken(req, res, () => handleList(req, res));
    }
};

// ============================================
// HANDLERS
// ============================================

async function handleList(req, res) {
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

async function handleCreate(req, res, body) {
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const { service_id, link, quantity } = body;
        const userId = req.user.userId;

        if (!service_id || !link || !quantity) {
            return validationError(res, 'Servicio, link y cantidad son requeridos');
        }

        if (quantity <= 0) {
            return validationError(res, 'La cantidad debe ser mayor a 0');
        }

        const orderId = await Order.create(userId, {
            service_id,
            link,
            quantity
        });

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

async function handleGetById(req, res, orderId) {
    if (req.method !== 'GET') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const userId = req.user.userId;

        if (!orderId) {
            return error(res, 'ID de orden requerido', 400);
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return notFound(res, 'Orden no encontrada');
        }

        if (order.usuario_id !== userId && req.user.rol !== 'admin') {
            return error(res, 'No tienes permiso para ver esta orden', 403);
        }

        return success(res, { order });

    } catch (err) {
        console.error('Error obteniendo orden:', err);
        return error(res, 'Error al obtener orden', 500);
    }
}
