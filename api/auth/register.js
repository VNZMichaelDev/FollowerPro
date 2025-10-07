const User = require('../../models/User');
const { generateToken } = require('../../utils/jwt');
const { success, error, validationError } = require('../../utils/apiResponse');

module.exports = async (req, res) => {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const { nombre, apellido, email, password, telefono, pais } = req.body;

        // Validaciones básicas
        if (!nombre || !email || !password) {
            return validationError(res, 'Nombre, email y contraseña son requeridos');
        }

        if (password.length < 6) {
            return validationError(res, 'La contraseña debe tener al menos 6 caracteres');
        }

        // Verificar si el email ya existe
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return error(res, 'Este email ya está registrado', 400);
        }

        // Crear usuario
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

        // Obtener usuario creado
        const user = await User.findById(userId);

        // Generar token JWT
        const token = generateToken({
            userId: user.id,
            email: user.email,
            rol: user.rol
        });

        // Log de registro
        await User.logAction(userId, 'register', 'Usuario registrado', 'info');

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
        }, 'Usuario registrado exitosamente', 201);

    } catch (err) {
        console.error('Error en registro:', err);
        return error(res, 'Error al registrar usuario', 500);
    }
};
