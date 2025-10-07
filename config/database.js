const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de la base de datos
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    timezone: '+00:00',
    connectTimeout: 60000,
    connectionLimit: 10,
    queueLimit: 0,
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

// Pool de conexiones (singleton para Vercel)
let pool;

const getPool = () => {
    if (!pool) {
        pool = mysql.createPool(dbConfig);
    }
    return pool;
};

// Inicializar (compatible con Vercel serverless)
const initDatabase = async () => {
    try {
        const p = getPool();
        const connection = await p.getConnection();
        console.log('✅ Conectado a la base de datos');
        connection.release();
        return p;
    } catch (error) {
        console.error('❌ Error conectando a la base de datos:', error.message);
        throw error;
    }
};

// Obtener conexión del pool
const getConnection = () => {
    return getPool();
};

// Función para ejecutar queries
const query = async (sql, params = []) => {
    try {
        const connection = getConnection();
        const [rows] = await connection.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('Error en query:', error.message);
        throw error;
    }
};

// Función para transacciones
const transaction = async (callback) => {
    const connection = await getConnection().getConnection();
    
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

// Cerrar conexiones
const closeDatabase = async () => {
    if (pool) {
        await pool.end();
        console.log('🔌 Conexiones de base de datos cerradas');
    }
};

module.exports = {
    initDatabase,
    getConnection,
    query,
    transaction,
    closeDatabase
};
