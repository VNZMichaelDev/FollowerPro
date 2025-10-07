const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { generateToken } = require('../../utils/jwt');
const { success, error, validationError } = require('../../utils/apiResponse');

module.exports = async (req, res) => {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const { email, password } = req.body;

        // Validaciones
        if (!email || !password) {
            return validationError(res, 'Email y contraseña son requeridos');
        }

        // Buscar usuario
        const user = await User.findByEmail(email);

        if (!user) {
            return error(res, 'Credenciales inválidas', 401);
        }

        // Verificar estado
        if (user.estado !== 'activo') {
            return error(res, 'Cuenta inactiva. Contacta al administrador.', 403);
        }

        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            // Log de intento fallido
            await User.logAction(user.id, 'login_failed', 'Intento de login fallido', 'warning', {
                reason: 'Contraseña incorrecta'
            });
            
            return error(res, 'Credenciales inválidas', 401);
        }

        // Generar token JWT
        const token = generateToken({
            userId: user.id,
            email: user.email,
            rol: user.rol
        });

        // Log de login exitoso
        await User.logAction(user.id, 'login', 'Login exitoso', 'info');

        // Respuesta exitosa
        return success(res, {
            token,
            user: {
                id: user.id,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                rol: user.rol,
                balance: user.balance
            }
        }, 'Login exitoso');

    } catch (err) {
        console.error('Error en login:', err);
        return error(res, 'Error al iniciar sesión', 500);
    }
};
