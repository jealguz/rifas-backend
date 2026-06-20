-- ============================================================================
-- SISTEMA DE RIFAS DINÁMICAS - SCRIPT OFICIAL DE BASE DE DATOS
-- Base de Datos: PostgreSQL 18
-- Instrucciones: Ejecutar este script completo en el Query Tool de pgAdmin 
--                para inicializar o limpiar las tablas del sistema.
-- ============================================================================

-- ============================================================================
-- SCRIPT DE CREACIÓN COMPLETA DESDE CERO - SISTEMA DE RIFAS DINÁMICAS
-- DISEÑO OPTIMIZADO PARA POSTGRESQL 18
-- ============================================================================

-- 1. LIMPIEZA TOTAL: Borramos tablas y tipos existentes en orden inverso por llaves foráneas
DROP TABLE IF EXISTS boletos CASCADE;
DROP TABLE IF EXISTS encargados CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS rifas CASCADE;

DROP TYPE IF EXISTS estado_pago_boleto CASCADE;
DROP TYPE IF EXISTS estado_rifa CASCADE;

-- ----------------------------------------------------------------------------
-- 2. CREACIÓN DE TIPOS ENUM (Restricciones nativas de negocio)
-- ----------------------------------------------------------------------------
CREATE TYPE estado_rifa AS ENUM ('activa', 'finalizada');
CREATE TYPE estado_pago_boleto AS ENUM ('disponible', 'debe', 'abono', 'pagado');

-- ----------------------------------------------------------------------------
-- 3. TABLA: RIFAS
-- Estructura principal con el control de lotería, fechas y ganador final.
-- ----------------------------------------------------------------------------
CREATE TABLE rifas (
    id SERIAL PRIMARY KEY,
    nombre_rifa VARCHAR(100) NOT NULL,
    cifras INT NOT NULL CHECK (cifras IN (2, 3, 4)),
    precio_boleto DECIMAL(10, 2) NOT NULL,
    loteria VARCHAR(100) NOT NULL,                  -- Ej: 'Lotería de Santander', 'Chontico Noche'
    fecha_sorteo DATE NOT NULL,                     -- El día programado para el juego
    estado estado_rifa DEFAULT 'activa',            -- Controla histórico o ventas activas
    numero_ganador VARCHAR(4) DEFAULT NULL,         -- Almacena el número premiado cuando finalice
    fecha_finalizacion TIMESTAMP DEFAULT NULL,      -- Cuándo se ejecutó el cierre de la rifa
    encargado_ganador_id INT DEFAULT NULL,          -- Vendedor que entregó el boleto ganador
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 4. TABLA: ENCARGADOS / VENDEDORES
-- Personal que vende los boletos, amarrado a cada rifa con su color y token.
-- ----------------------------------------------------------------------------
CREATE TABLE encargados (
    id SERIAL PRIMARY KEY,
    rifa_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    token_link VARCHAR(64) NOT NULL,                -- Removido UNIQUE global para que no rompa en producción local con links repetidos
    codigo_color_hex VARCHAR(7) NOT NULL,           -- Color asignado secuencialmente en el backend
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    CONSTRAINT uq_vendedor_por_rifa UNIQUE (rifa_id, nombre) -- Un vendedor no se duplica en la misma rifa
);

-- ----------------------------------------------------------------------------
-- 5. TABLA: CLIENTES / COMPRADORES
-- Registro único de compradores de números con referencias del pueblo o trabajo.
-- ----------------------------------------------------------------------------
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    celular VARCHAR(20) UNIQUE,                     -- Evita duplicar a don José Amaya en el sistema
    direccion_referencia TEXT,                     -- Ej: 'Trabaja en el taller', 'Frente al parque'
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 6. TABLA: BOLETOS / NÚMEROS
-- Matriz de números distribuida equitativamente y amarrada a carteras y clientes.
-- ----------------------------------------------------------------------------
CREATE TABLE boletos (
    id SERIAL PRIMARY KEY,
    rifa_id INT NOT NULL,
    encargado_id INT NOT NULL,
    cliente_id INT DEFAULT NULL,                    -- NULL significa que no se ha vendido
    numero VARCHAR(4) NOT NULL,                     -- Almacena '01', '002', etc.
    estado_pago estado_pago_boleto DEFAULT 'disponible', -- disponible, debe, abono, pagado
    valor_abonado DECIMAL(10, 2) DEFAULT 0.00,       -- Cuánta plata ha dejado de avance el cliente
    fecha_venta TIMESTAMP DEFAULT NULL,
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    FOREIGN KEY (encargado_id) REFERENCES encargados(id) ON DELETE CASCADE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
    CONSTRAINT uq_numero_por_rifa UNIQUE (rifa_id, numero) -- Un número solo existe una vez por sorteo
);

-- ----------------------------------------------------------------------------
-- 7. LLAVE FORÁNEA DIFERIDA PARA EL GANADOR DE LA RIFA
-- Se añade al final para evitar problemas de dependencias cíclicas al borrar tablas
-- ----------------------------------------------------------------------------
ALTER TABLE rifas
ADD CONSTRAINT fk_encargado_ganador
FOREIGN KEY (encargado_ganador_id) REFERENCES encargados(id) ON DELETE SET NULL;

ALTER TABLE rifas ADD COLUMN IF NOT EXISTS url_imagen TEXT;

-- Cambia la columna celular de la tabla clientes para que acepte números grandes
ALTER TABLE clientes ALTER COLUMN celular TYPE VARCHAR(20);