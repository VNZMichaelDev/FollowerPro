const User = require('../../models/User');
const { authenticateToken } = require('../../utils/jwt');
const { success, error } = require('../../utils/apiResponse');

async function handler(req, res) {
    // Solo permitir GET
    if (req.method !== 'GET') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const userId = req.user.userId;
        
        const user = await User.findById(userId);
        
        if (!user) {
            return error(res, 'Usuario no encontrado', 404);
        }

        // Devolver información del usuario (sin contraseña)
        return success(res, {
            user: {
                id: user.id,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                balance: user.balance,
                rol: user.rol,
                estado: user.estado,
                fecha_registro: user.fecha_registro,
                telefono: user.telefono,
                pais: user.pais
            }
        });

    } catch (err) {
        console.error('Error obteniendo perfil:', err);
        return error(res, 'Error al obtener perfil', 500);
    }
}

// Aplicar middleware de autenticación
module.exports = (req, res) => {
    authenticateToken(req, res, () => handler(req, res));
};
