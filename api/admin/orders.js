const { query } = require('../../config/database');
const { authenticateToken, requireAdmin } = require('../../utils/jwt');
const { success, error } = require('../../utils/apiResponse');

async function handler(req, res) {
    // Solo permitir GET
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

// Aplicar middlewares de autenticación y admin
module.exports = (req, res) => {
    authenticateToken(req, res, () => {
        requireAdmin(req, res, () => handler(req, res));
    });
};
