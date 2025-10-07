const { query } = require('../../config/database');
const { success, error } = require('../../utils/apiResponse');
const axios = require('axios');

// Función para sincronizar servicios en segundo plano
async function syncServicesToDatabase(services) {
    try {
        console.log(`🔄 Sincronizando ${services.length} servicios...`);
        
        for (const service of services) {
            const markup = 20; // 20% markup por defecto
            const precioFinal = parseFloat(service.rate) * (1 + markup / 100);
            
            await query(`
                INSERT INTO servicios_cache 
                (service_id, name, type, category, rate, min, \`max\`, dripfeed, refill, \`cancel\`, markup, precio_final, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    type = VALUES(type),
                    category = VALUES(category),
                    rate = VALUES(rate),
                    min = VALUES(min),
                    \`max\` = VALUES(\`max\`),
                    dripfeed = VALUES(dripfeed),
                    refill = VALUES(refill),
                    \`cancel\` = VALUES(\`cancel\`),
                    precio_final = VALUES(precio_final),
                    fecha_actualizacion = NOW()
            `, [
                service.service,
                service.name,
                service.type || 'Default',
                service.category || 'General',
                service.rate,
                service.min,
                service.max,
                service.dripfeed ? 1 : 0,
                service.refill ? 1 : 0,
                service.cancel ? 1 : 0,
                markup,
                precioFinal
            ]);
        }
        
        console.log(`✅ ${services.length} servicios sincronizados exitosamente`);
    } catch (err) {
        console.error('❌ Error sincronizando servicios:', err);
    }
}

// Función para obtener servicios de la API
async function smmCoderRequest(action, params = {}) {
    const apiUrl = process.env.SMMCODER_API_URL || 'https://smmcoder.com/api/v2';
    const apiKey = process.env.SMMCODER_API_KEY;

    if (!apiKey) {
        throw new Error('API Key de SMMCoder no configurada');
    }

    try {
        const response = await axios.post(apiUrl, {
            key: apiKey,
            action,
            ...params
        }, {
            timeout: 15000
        });

        return response.data;
    } catch (err) {
        console.error('Error en petición a SMMCoder:', err.message);
        throw err;
    }
}

module.exports = async (req, res) => {
    // Solo permitir GET
    if (req.method !== 'GET') {
        return error(res, 'Método no permitido', 405);
    }

    try {
        console.log('📡 Solicitando servicios de SMMCoder API...');

        // Intentar obtener de la API
        try {
            const result = await smmCoderRequest('services');

            if (result && Array.isArray(result)) {
                // Sincronizar en segundo plano (no esperar)
                syncServicesToDatabase(result).catch(err => {
                    console.error('Error en sincronización:', err);
                });

                return success(res, {
                    services: result,
                    source: 'api'
                });
            }
        } catch (apiError) {
            console.warn('⚠️ API externa falló, usando caché local...');
        }

        // Si la API falla, usar caché local
        const localServices = await query(
            'SELECT service_id as service, name, category, rate, min, max, type, refill, `cancel` FROM servicios_cache WHERE activo = 1 ORDER BY category, name'
        );

        if (localServices.length > 0) {
            console.log(`✅ ${localServices.length} servicios cargados desde BD local`);
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
};
