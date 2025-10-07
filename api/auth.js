const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken, authenticateToken } = require('../utils/jwt');
const { success, error, validationError } = require('../utils/apiResponse');
const { query } = require('../config/database');

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
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
    switch (path) {
        case 'login':
            return handleLogin(req, res, body);
        
        case 'register':
            return handleRegister(req, res, body);
        
        case 'profile':
            return authenticateToken(req, res, () => handleProfile(req, res));
        
        case 'change-password':
            return authenticateToken(req, res, () => handleChangePassword(req, res, body));
        
        default:
            return error(res, 'Ruta no encontrada', 404);
    }
};

// ============================================
// HANDLERS
// ============================================

async function handleLogin(req, res, body) {
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const { email, password } = body;

        if (!email || !password) {
            return validationError(res, 'Email y contraseña son requeridos');
        }

        const user = await User.findByEmail(email);

        if (!user) {
            return error(res, 'Credenciales inválidas', 401);
        }

        if (user.estado !== 'activo') {
            return error(res, 'Cuenta inactiva. Contacta al administrador.', 403);
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            await User.logAction(user.id, 'login_failed', 'Intento de login fallido', 'warning', {
                reason: 'Contraseña incorrecta'
            });
            return error(res, 'Credenciales inválidas', 401);
        }

        const token = generateToken({
            userId: user.id,
            email: user.email,
            rol: user.rol
        });

        await User.logAction(user.id, 'login', 'Login exitoso', 'info');

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
}

async function handleRegister(req, res, body) {
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const { nombre, apellido, email, password, telefono, pais } = body;

        if (!nombre || !email || !password) {
            return validationError(res, 'Nombre, email y contraseña son requeridos');
        }

        if (password.length < 6) {
            return validationError(res, 'La contraseña debe tener al menos 6 caracteres');
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return error(res, 'Este email ya está registrado', 400);
        }

        const userId = await User.create({
            nombre,
            apellido: apellido || '',
            email,
            password,
            telefono: telefono || '',
            pais: pais || '',
            rol: 'usuario',
            balance: 0,
            estado: 'activo'
        });

        const user = await User.findById(userId);

        const token = generateToken({
            userId: user.id,
            email: user.email,
            rol: user.rol
        });

        await User.logAction(userId, 'register', 'Usuario registrado', 'info');

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
        }, 'Usuario registrado exitosamente', 201);

    } catch (err) {
        console.error('Error en registro:', err);
        return error(res, 'Error al registrar usuario', 500);
    }
}

async function handleProfile(req, res) {
    if (req.method !== 'GET') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            return error(res, 'Usuario no encontrado', 404);
        }

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

async function handleChangePassword(req, res, body) {
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const { currentPassword, newPassword } = body;
        const userId = req.user.userId;

        if (!currentPassword || !newPassword) {
            return validationError(res, 'Contraseña actual y nueva son requeridas');
        }

        if (newPassword.length < 6) {
            return validationError(res, 'La nueva contraseña debe tener al menos 6 caracteres');
        }

        const user = await User.findById(userId);

        if (!user) {
            return error(res, 'Usuario no encontrado', 404);
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user.password);

        if (!isValidPassword) {
            return error(res, 'Contraseña actual incorrecta', 401);
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const sql = 'UPDATE usuarios SET password = ? WHERE id = ?';
        await query(sql, [hashedPassword, userId]);

        await User.logAction(userId, 'password_change', 'Contraseña cambiada', 'info');

        return success(res, {}, 'Contraseña actualizada exitosamente');

    } catch (err) {
        console.error('Error cambiando contraseña:', err);
        return error(res, 'Error al cambiar contraseña', 500);
    }
}
