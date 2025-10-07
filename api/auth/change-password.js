const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { authenticateToken } = require('../../utils/jwt');
const { success, error, validationError } = require('../../utils/apiResponse');
const { query } = require('../../config/database');

async function handler(req, res) {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.userId;

        if (!currentPassword || !newPassword) {
            return validationError(res, 'Contraseña actual y nueva son requeridas');
        }

        if (newPassword.length < 6) {
            return validationError(res, 'La nueva contraseña debe tener al menos 6 caracteres');
        }

        // Obtener usuario
        const user = await User.findById(userId);

        if (!user) {
            return error(res, 'Usuario no encontrado', 404);
        }

        // Verificar contraseña actual
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);

        if (!isValidPassword) {
            return error(res, 'Contraseña actual incorrecta', 401);
        }

        // Hashear nueva contraseña
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Actualizar contraseña
        const sql = 'UPDATE usuarios SET password = ? WHERE id = ?';
        await query(sql, [hashedPassword, userId]);

        // Log de cambio de contraseña
        await User.logAction(userId, 'password_change', 'Contraseña cambiada', 'info');

        return success(res, {}, 'Contraseña actualizada exitosamente');

    } catch (err) {
        console.error('Error cambiando contraseña:', err);
        return error(res, 'Error al cambiar contraseña', 500);
    }
}

// Aplicar middleware de autenticación
module.exports = (req, res) => {
    authenticateToken(req, res, () => handler(req, res));
};
