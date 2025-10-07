# 🚀 Guía Completa: Deploy en Vercel + MySQL Hostinger

## 📋 Resumen

Tu proyecto ha sido **completamente adaptado** para funcionar en Vercel con las siguientes mejoras:

✅ **Sesiones reemplazadas por JWT** (JSON Web Tokens)  
✅ **Rutas Express convertidas a funciones serverless**  
✅ **Frontend actualizado para usar JWT**  
✅ **Compatible con MySQL remoto de Hostinger**  

---

## 🎯 PASO 1: Preparar Base de Datos en Hostinger

### 1.1 Crear Base de Datos
1. Entra a **hPanel de Hostinger**
2. Ve a **Bases de datos** → **MySQL Databases**
3. Crea una nueva base de datos:
   - Nombre: `panelsmm` (o el que prefieras)
   - Usuario: Se crea automáticamente (ej: `u123456789_panelsmm`)
   - Contraseña: Genera una segura
4. **Guarda estos datos**:
   ```
   Host: localhost (o la IP del servidor)
   Database: u123456789_panelsmm
   Username: u123456789_panelsmm
   Password: [tu contraseña]
   Port: 3306
   ```

### 1.2 Habilitar Acceso Remoto
1. En hPanel, ve a **Bases de datos** → Tu base de datos
2. Haz clic en **"Administrar acceso remoto"**
3. Agrega estas IPs (servidores de Vercel):
   ```
   76.76.21.21
   64.252.128.0/18
   76.76.21.0/24
   ```
   O simplemente agrega: `%` (permite desde cualquier IP - menos seguro pero funciona)

### 1.3 Inicializar Base de Datos
1. Accede a **phpMyAdmin**
2. Selecciona tu base de datos
3. Ejecuta el script SQL de inicialización (lo crearemos después)

---

## 🎯 PASO 2: Configurar Proyecto para Vercel

### 2.1 Instalar Vercel CLI
```bash
npm install -g vercel
```

### 2.2 Iniciar sesión en Vercel
```bash
vercel login
```

### 2.3 Verificar archivos necesarios

Asegúrate de tener estos archivos (ya están creados):
- ✅ `vercel.json` - Configuración de Vercel
- ✅ `api/` - Carpeta con funciones serverless
- ✅ `utils/jwt.js` - Utilidades JWT
- ✅ `utils/apiResponse.js` - Respuestas estándar

---

## 🎯 PASO 3: Configurar Variables de Entorno

### 3.1 Crear archivo `.env.production`

Crea este archivo con tus credenciales:

```env
# API de SMMCoder
SMMCODER_API_URL=https://smmcoder.com/api/v2
SMMCODER_API_KEY=73436bf7bb00c1a621fcb715c89aa407

# Base de Datos Hostinger (IMPORTANTE: Usar IP pública)
DB_HOST=tu-servidor-hostinger.com
DB_PORT=3306
DB_NAME=u123456789_panelsmm
DB_USER=u123456789_panelsmm
DB_PASSWORD=tu_password_aqui

# JWT (GENERA UNO NUEVO Y SEGURO)
JWT_SECRET=tu_jwt_secret_super_largo_y_aleatorio_123456789

# Entorno
NODE_ENV=production
```

**⚠️ IMPORTANTE**: El `DB_HOST` debe ser la **IP pública** o **dominio** de tu servidor Hostinger, NO `localhost`.

Para obtener la IP:
```bash
ping tu-dominio-hostinger.com
```

### 3.2 Configurar en Vercel Dashboard

1. Ve a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Crea un nuevo proyecto
3. Ve a **Settings** → **Environment Variables**
4. Agrega TODAS las variables del `.env.production`:
   - `SMMCODER_API_URL`
   - `SMMCODER_API_KEY`
   - `DB_HOST`
   - `DB_PORT`
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASSWORD`
   - `JWT_SECRET`
   - `NODE_ENV`

---

## 🎯 PASO 4: Inicializar Base de Datos

### 4.1 Crear script SQL

Crea un archivo `init-database.sql`:

```sql
-- Crear tabla usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    pais VARCHAR(100),
    balance DECIMAL(10, 4) DEFAULT 0.0000,
    rol ENUM('usuario', 'admin') DEFAULT 'usuario',
    estado ENUM('activo', 'inactivo', 'suspendido') DEFAULT 'activo',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_rol (rol),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear tabla servicios_cache
CREATE TABLE IF NOT EXISTS servicios_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_id INT UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    category VARCHAR(100),
    rate DECIMAL(10, 4) NOT NULL,
    min INT NOT NULL,
    `max` INT NOT NULL,
    dripfeed BOOLEAN DEFAULT FALSE,
    refill BOOLEAN DEFAULT FALSE,
    `cancel` BOOLEAN DEFAULT FALSE,
    markup DECIMAL(5, 2) DEFAULT 20.00,
    precio_final DECIMAL(10, 4) GENERATED ALWAYS AS (rate * (1 + markup / 100)) STORED,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_service_id (service_id),
    INDEX idx_category (category),
    INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear tabla ordenes
CREATE TABLE IF NOT EXISTS ordenes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    service_id INT NOT NULL,
    link TEXT NOT NULL,
    quantity INT NOT NULL,
    charge DECIMAL(10, 4) NOT NULL,
    start_count INT DEFAULT 0,
    remains INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Pending',
    order_id VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'USD',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    notas TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario_id (usuario_id),
    INDEX idx_status (status),
    INDEX idx_fecha_creacion (fecha_creacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear tabla transacciones
CREATE TABLE IF NOT EXISTS transacciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo ENUM('recarga', 'gasto', 'refund', 'bonus', 'ajuste') NOT NULL,
    monto DECIMAL(10, 4) NOT NULL,
    balance_anterior DECIMAL(10, 4) NOT NULL,
    balance_nuevo DECIMAL(10, 4) NOT NULL,
    descripcion TEXT,
    orden_id INT,
    metodo_pago VARCHAR(50),
    referencia_pago VARCHAR(255),
    estado ENUM('pendiente', 'completada', 'rechazada', 'cancelada') DEFAULT 'completada',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario_id (usuario_id),
    INDEX idx_tipo (tipo),
    INDEX idx_estado (estado),
    INDEX idx_fecha_creacion (fecha_creacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear tabla logs_sistema
CREATE TABLE IF NOT EXISTS logs_sistema (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    accion VARCHAR(100) NOT NULL,
    descripcion TEXT,
    nivel ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
    ip_address VARCHAR(45),
    user_agent TEXT,
    datos_adicionales JSON,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_usuario_id (usuario_id),
    INDEX idx_accion (accion),
    INDEX idx_nivel (nivel),
    INDEX idx_fecha_creacion (fecha_creacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear tabla configuracion
CREATE TABLE IF NOT EXISTS configuracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT,
    tipo ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar usuario administrador por defecto
INSERT INTO usuarios (nombre, email, password, rol, balance, estado)
VALUES (
    'Administrador',
    'admin@panelsmm.com',
    '$2a$10$YourHashedPasswordHere',  -- Cambiar por password hasheado
    'admin',
    1000.0000,
    'activo'
) ON DUPLICATE KEY UPDATE email = email;

-- Configuraciones por defecto
INSERT INTO configuracion (clave, valor, descripcion, tipo) VALUES
('site_name', 'FollowerPro', 'Nombre del sitio', 'string'),
('default_markup', '20', 'Markup por defecto (%)', 'number'),
('min_recharge', '5', 'Recarga mínima (USD)', 'number'),
('max_recharge', '1000', 'Recarga máxima (USD)', 'number'),
('whatsapp_support', '1234567890', 'WhatsApp de soporte', 'string')
ON DUPLICATE KEY UPDATE clave = clave;
```

### 4.2 Ejecutar en phpMyAdmin

1. Abre phpMyAdmin de Hostinger
2. Selecciona tu base de datos
3. Ve a la pestaña **SQL**
4. Pega todo el script
5. Haz clic en **Ejecutar**

### 4.3 Crear usuario admin

Para crear el password hasheado del admin, ejecuta esto en Node.js local:

```javascript
const bcrypt = require('bcryptjs');
const password = 'Admin123!';  // Cambia esto
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
```

Luego actualiza en phpMyAdmin:
```sql
UPDATE usuarios 
SET password = '$2a$10$TuHashAqui' 
WHERE email = 'admin@panelsmm.com';
```

---

## 🎯 PASO 5: Deploy a Vercel

### 5.1 Deploy desde la terminal

```bash
# Navega a la carpeta del proyecto
cd PanelSud

# Deploy
vercel
```

Sigue las instrucciones:
1. **Set up and deploy?** → Yes
2. **Which scope?** → Tu cuenta
3. **Link to existing project?** → No
4. **Project name?** → panelsmm (o el que quieras)
5. **Directory?** → ./ (enter)
6. **Override settings?** → No

### 5.2 Deploy desde GitHub (Recomendado)

1. **Sube el proyecto a GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Proyecto adaptado para Vercel"
   git branch -M main
   git remote add origin https://github.com/tu-usuario/panelsmm.git
   git push -u origin main
   ```

2. **Conecta con Vercel**:
   - Ve a [vercel.com/new](https://vercel.com/new)
   - Importa tu repositorio de GitHub
   - Vercel detectará automáticamente la configuración
   - Agrega las variables de entorno
   - Haz clic en **Deploy**

---

## 🎯 PASO 6: Verificar que Todo Funcione

### 6.1 Probar endpoints

Una vez deployado, prueba:

```bash
# Obtener servicios
curl https://tu-proyecto.vercel.app/api/services

# Login
curl -X POST https://tu-proyecto.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@panelsmm.com","password":"Admin123!"}'
```

### 6.2 Probar en el navegador

1. Abre `https://tu-proyecto.vercel.app/login.html`
2. Inicia sesión con:
   - Email: `admin@panelsmm.com`
   - Password: `Admin123!` (o el que configuraste)
3. Verifica que:
   - ✅ Login funciona
   - ✅ Dashboard carga
   - ✅ Servicios se sincronizan
   - ✅ Puedes crear órdenes

---

## 🔧 Solución de Problemas

### Problema 1: "Cannot connect to database"

**Causa**: Hostinger no permite conexiones remotas o IP incorrecta

**Solución**:
1. Verifica que habilitaste acceso remoto en Hostinger
2. Usa la IP pública del servidor, no `localhost`
3. Verifica que las credenciales sean correctas
4. Prueba la conexión con MySQL Workbench primero

### Problema 2: "JWT must be provided"

**Causa**: Frontend no está enviando el token

**Solución**:
1. Verifica que el login guarde el token: `localStorage.getItem('authToken')`
2. Abre DevTools → Application → Local Storage
3. Debe haber un item `authToken`

### Problema 3: "Function timeout"

**Causa**: La función serverless tarda más de 10 segundos

**Solución**:
1. Optimiza las consultas a la BD
2. Usa índices en las tablas
3. Considera upgrade a Vercel Pro (60s timeout)

### Problema 4: "Too many connections"

**Causa**: No se cierran las conexiones a MySQL

**Solución**:
Ya está manejado en `config/database.js`, pero verifica que uses `pool` correctamente.

---

## 📊 Diferencias vs Versión Original

| Característica | Antes (Express) | Ahora (Vercel) |
|----------------|-----------------|----------------|
| **Autenticación** | express-session | JWT |
| **Rutas** | app.get/post | Funciones serverless |
| **Estado** | En memoria | Stateless |
| **Deploy** | VPS/Hostinger | Vercel |
| **Escalabilidad** | Manual | Automática |
| **SSL** | Manual | Automático |
| **CDN** | No | Sí (global) |

---

## 🎯 Endpoints Disponibles

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrarse
- `GET /api/auth/profile` - Obtener perfil (requiere JWT)
- `POST /api/auth/change-password` - Cambiar contraseña (requiere JWT)

### Servicios
- `GET /api/services` - Listar servicios

### Órdenes
- `POST /api/orders/create` - Crear orden (requiere JWT)
- `GET /api/orders` - Listar órdenes del usuario (requiere JWT)
- `GET /api/orders/[id]` - Obtener orden específica (requiere JWT)

### Admin
- `GET /api/admin/users` - Listar usuarios (requiere admin)
- `GET /api/admin/orders` - Listar todas las órdenes (requiere admin)
- `GET /api/admin/stats` - Estadísticas (requiere admin)
- `POST /api/admin/process-pending` - Procesar órdenes pendientes (requiere admin)

---

## 🚀 Próximos Pasos

1. ✅ Configura un dominio personalizado en Vercel
2. ✅ Configura backups automáticos de la BD
3. ✅ Monitorea errores con Vercel Analytics
4. ✅ Agrega más funcionalidades

---

## 📞 Soporte

- **Vercel Docs**: https://vercel.com/docs
- **Hostinger Support**: https://support.hostinger.com
- **JWT.io**: https://jwt.io (para debuggear tokens)

---

**¡Felicidades!** Tu panel SMM ahora está en Vercel con MySQL de Hostinger. 🎉

**Última actualización**: 2025-10-07  
**Versión**: 2.0 (Serverless)
