// ============================================
// API UNIFICADA PARA VERCEL
// Maneja TODAS las rutas en 1 sola función
// ============================================

const bcrypt = require('bcryptjs');
const axios = require('axios');
const User = require('../models/User');
const Order = require('../models/Order');
const { query } = require('../config/database');
const { generateToken, authenticateToken, requireAdmin } = require('../utils/jwt');
const { success, error, validationError, notFound } = require('../utils/apiResponse');

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Manejar preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Obtener la ruta desde la URL
        const url = req.url || '';
        let path = url.split('?')[0];
        
        // Limpiar el path
        path = path.replace('/api/', '').replace('/api', '').replace(/^\/+/, '');
        
        console.log('📍 Ruta solicitada:', path, 'Método:', req.method, 'URL completa:', req.url);

        // Parsear body si es necesario
        let body = req.body || {};
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                body = {};
            }
        }

        // ============================================
        // ROUTING
        // ============================================

        // TEST ROUTE
        if (path === '' || path === 'test' || path === 'index') {
            return res.status(200).json({
                success: true,
                message: 'API funcionando correctamente',
                path: path,
                url: req.url,
                method: req.method,
                timestamp: new Date().toISOString()
            });
        }

        // AUTH ROUTES
        if (path.startsWith('auth/login') || path === 'auth-login') {
            return handleLogin(req, res, body);
        }
        if (path.startsWith('auth/register') || path === 'auth-register') {
            return handleRegister(req, res, body);
        }
        if (path.startsWith('auth/profile') || path === 'auth-profile') {
            return authenticateToken(req, res, () => handleProfile(req, res));
        }
        if (path.startsWith('auth/change-password') || path === 'auth-change-password') {
            return authenticateToken(req, res, () => handleChangePassword(req, res, body));
        }

        // SERVICES ROUTES
        if (path.startsWith('services') || path === 'services') {
            return handleServices(req, res);
        }

        // ORDERS ROUTES
        if (path.startsWith('orders/create') || path === 'orders-create') {
            return authenticateToken(req, res, () => handleCreateOrder(req, res, body));
        }
        if (path.match(/orders\/\d+/) || path.match(/orders-\d+/)) {
            const orderId = path.match(/\d+/)[0];
            return authenticateToken(req, res, () => handleGetOrder(req, res, orderId));
        }
        if (path.startsWith('orders') || path === 'orders') {
            return authenticateToken(req, res, () => handleListOrders(req, res));
        }

        // ADMIN ROUTES
        if (path.startsWith('admin/users') || path === 'admin-users') {
            return authenticateToken(req, res, () => requireAdmin(req, res, () => handleAdminUsers(req, res)));
        }
        if (path.startsWith('admin/orders') || path === 'admin-orders') {
            return authenticateToken(req, res, () => requireAdmin(req, res, () => handleAdminOrders(req, res)));
        }
        if (path.startsWith('admin/stats') || path === 'admin-stats') {
            return authenticateToken(req, res, () => requireAdmin(req, res, () => handleAdminStats(req, res)));
        }
        if (path.startsWith('admin/process-pending') || path === 'admin-process-pending') {
            return authenticateToken(req, res, () => requireAdmin(req, res, () => handleProcessPending(req, res)));
        }

        // Ruta no encontrada
        console.log('❌ Ruta no encontrada:', path);
        return error(res, 'Ruta no encontrada: ' + path, 404);

    } catch (err) {
        console.error('❌ Error en API:', err);
        console.error('Stack:', err.stack);
        return error(res, 'Error interno del servidor: ' + err.message, 500);
    }
};

// ============================================
// AUTH HANDLERS
// ============================================

async function handleLogin(req, res, body) {
    console.log('🔐 Intentando login...');
    console.log('Method:', req.method);
    console.log('Body:', body);
    
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const { email, password } = body;

        if (!email || !password) {
            console.log('❌ Email o password faltante');
            return validationError(res, 'Email y contraseña son requeridos');
        }

        console.log('📧 Buscando usuario:', email);
        const user = await User.findByEmail(email);
        console.log('👤 Usuario encontrado:', user ? 'Sí' : 'No');
        if (!user) {
            return error(res, 'Credenciales inválidas', 401);
        }

        if (user.estado !== 'activo') {
            return error(res, 'Cuenta inactiva', 403);
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return error(res, 'Credenciales inválidas', 401);
        }

        const token = generateToken({
            userId: user.id,
            email: user.email,
            rol: user.rol
        });

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
        await query('UPDATE usuarios SET password = ? WHERE id = ?', [hashedPassword, userId]);

        return success(res, {}, 'Contraseña actualizada exitosamente');

    } catch (err) {
        console.error('Error cambiando contraseña:', err);
        return error(res, 'Error al cambiar contraseña', 500);
    }
}

// ============================================
// SERVICES HANDLERS
// ============================================

async function handleServices(req, res) {
    if (req.method !== 'GET') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const apiUrl = process.env.SMMCODER_API_URL || 'https://smmcoder.com/api/v2';
        const apiKey = process.env.SMMCODER_API_KEY;

        if (!apiKey) {
            return error(res, 'API Key no configurada', 500);
        }

        try {
            const response = await axios.post(apiUrl, {
                key: apiKey,
                action: 'services'
            }, { timeout: 15000 });

            if (response.data && Array.isArray(response.data)) {
                return success(res, {
                    services: response.data,
                    source: 'api'
                });
            }
        } catch (apiError) {
            console.warn('⚠️ API externa falló, usando caché...');
        }

        // Fallback a caché local
        const localServices = await query(
            'SELECT service_id as service, name, category, rate, min, max, type, refill, `cancel` FROM servicios_cache WHERE activo = 1 ORDER BY category, name'
        );

        if (localServices.length > 0) {
            return success(res, {
                services: localServices,
                source: 'cache'
            });
        }

        return error(res, 'No hay servicios disponibles', 503);

    } catch (err) {
        console.error('Error obteniendo servicios:', err);
        return error(res, 'Error al obtener servicios', 500);
    }
}

// ============================================
// ORDERS HANDLERS
// ============================================

async function handleListOrders(req, res) {
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

async function handleCreateOrder(req, res, body) {
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

async function handleGetOrder(req, res, orderId) {
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

// ============================================
// ADMIN HANDLERS
// ============================================

async function handleAdminUsers(req, res) {
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

async function handleAdminOrders(req, res) {
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

async function handleAdminStats(req, res) {
    if (req.method !== 'GET') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const totalUsers = await query('SELECT COUNT(*) as count FROM usuarios');
        const activeUsers = await query('SELECT COUNT(*) as count FROM usuarios WHERE estado = "activo"');
        const totalBalance = await query('SELECT SUM(balance) as total FROM usuarios');
        const totalOrders = await query('SELECT COUNT(*) as count FROM ordenes');
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

async function handleProcessPending(req, res) {
    if (req.method !== 'POST') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        const pendingOrders = await query(`
            SELECT o.*, s.name as service_name
            FROM ordenes o
            LEFT JOIN servicios_cache s ON o.service_id = s.service_id
            WHERE o.status = 'Pending' 
            AND (o.order_id LIKE 'ORD-%' OR o.order_id IS NULL)
            ORDER BY o.fecha_creacion ASC
            LIMIT 50
        `);

        if (pendingOrders.length === 0) {
            return success(res, {
                processed: 0,
                failed: 0,
                total: 0
            }, 'No hay órdenes pendientes para procesar');
        }

        let processed = 0;
        let failed = 0;
        const results = [];

        for (const order of pendingOrders) {
            try {
                const externalOrderId = await Order.sendToSMMCoder(
                    order.id,
                    order.service_id,
                    order.link,
                    order.quantity
                );

                if (externalOrderId) {
                    await query(
                        'UPDATE ordenes SET order_id = ?, status = ?, notas = NULL WHERE id = ?',
                        [externalOrderId, 'In progress', order.id]
                    );
                    processed++;
                    results.push({ id: order.id, status: 'success', external_id: externalOrderId });
                } else {
                    failed++;
                    results.push({ id: order.id, status: 'failed', error: 'No se obtuvo ID externo' });
                }

                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (err) {
                failed++;
                results.push({ id: order.id, status: 'failed', error: err.message });
                await query('UPDATE ordenes SET notas = ? WHERE id = ?', [`Error: ${err.message}`, order.id]);
            }
        }

        return success(res, {
            processed,
            failed,
            total: pendingOrders.length,
            results
        }, `Proceso completado: ${processed} órdenes procesadas, ${failed} fallidas`);

    } catch (err) {
        console.error('Error procesando órdenes pendientes:', err);
        return error(res, 'Error al procesar órdenes pendientes', 500);
    }
}
