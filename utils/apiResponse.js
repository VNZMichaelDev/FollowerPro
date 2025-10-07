/**
 * Respuesta exitosa estándar
 */
function success(res, data = {}, message = 'Operación exitosa', statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        message,
        ...data
    });
}

/**
 * Respuesta de error estándar
 */
function error(res, message = 'Error en el servidor', statusCode = 500, details = null) {
    const response = {
        success: false,
        message
    };
    
    if (details) {
        response.details = details;
    }
    
    return res.status(statusCode).json(response);
}

/**
 * Error de validación
 */
function validationError(res, message = 'Datos inválidos', errors = []) {
    return res.status(400).json({
        success: false,
        message,
        errors
    });
}

/**
 * Error de autenticación
 */
function unauthorized(res, message = 'No autorizado') {
    return res.status(401).json({
        success: false,
        message
    });
}

/**
 * Error de permisos
 */
function forbidden(res, message = 'Acceso denegado') {
    return res.status(403).json({
        success: false,
        message
    });
}

/**
 * Recurso no encontrado
 */
function notFound(res, message = 'Recurso no encontrado') {
    return res.status(404).json({
        success: false,
        message
    });
}

module.exports = {
    success,
    error,
    validationError,
    unauthorized,
    forbidden,
    notFound
};
