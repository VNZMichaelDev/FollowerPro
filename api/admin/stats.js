const { query } = require('../../config/database');
const { authenticateToken, requireAdmin } = require('../../utils/jwt');
const { success, error } = require('../../utils/apiResponse');

async function handler(req, res) {
    // Solo permitir GET
    if (req.method !== 'GET') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        // Total de usuarios
        const totalUsers = await query('SELECT COUNT(*) as count FROM usuarios');
        
        // Usuarios activos
        const activeUsers = await query('SELECT COUNT(*) as count FROM usuarios WHERE estado = "activo"');
        
        // Balance total
        const totalBalance = await query('SELECT SUM(balance) as total FROM usuarios');
        
        // Total de órdenes
        const totalOrders = await query('SELECT COUNT(*) as count FROM ordenes');
        
        // Órdenes por estado
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

// Aplicar middlewares de autenticación y admin
module.exports = (req, res) => {
    authenticateToken(req, res, () => {
        requireAdmin(req, res, () => handler(req, res));
    });
};
