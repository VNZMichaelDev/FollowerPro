const { query } = require('../../config/database');
const { authenticateToken, requireAdmin } = require('../../utils/jwt');
const { success, error } = require('../../utils/apiResponse');

async function handler(req, res) {
    // Solo permitir GET
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

// Aplicar middlewares de autenticación y admin
module.exports = (req, res) => {
    authenticateToken(req, res, () => {
        requireAdmin(req, res, () => handler(req, res));
    });
};
