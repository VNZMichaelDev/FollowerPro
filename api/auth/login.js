const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { generateToken } = require('../../utils/jwt');
const { success, error, validationError } = require('../../utils/apiResponse');

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Manejar preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Solo permitir POST
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        // Parsear body si es necesario
        let body = req.body;
        if (typeof body === 'string') {
            body = JSON.parse(body);
        }
        
        const { email, password } = body;

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
