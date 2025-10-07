const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'panel_smm_jwt_secret_2024_muy_seguro_cambiar';
const JWT_EXPIRES_IN = '7d'; // Token válido por 7 días

/**
 * Generar token JWT
 */
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verificar token JWT
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Extraer token del header Authorization
 */
function extractToken(req) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return null;
    }
    
    // Formato: "Bearer TOKEN"
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }
    
    return parts[1];
}

/**
 * Middleware para verificar autenticación
 */
function authenticateToken(req, res, next) {
    const token = extractToken(req);
    
    if (!token) {
        return res.status(401).json({ 
            success: false,
            message: 'Token de acceso requerido' 
        });
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded) {
        return res.status(403).json({ 
            success: false,
            message: 'Token inválido o expirado' 
        });
    }
    
    // Agregar datos del usuario al request
    req.user = decoded;
    next();
}

/**
 * Middleware para verificar que sea admin
 */
function requireAdmin(req, res, next) {
    if (!req.user || req.user.rol !== 'admin') {
        return res.status(403).json({ 
            success: false,
            message: 'Acceso denegado. Se requieren permisos de administrador.' 
        });
    }
    next();
}

module.exports = {
    generateToken,
    verifyToken,
    extractToken,
    authenticateToken,
    requireAdmin
};
