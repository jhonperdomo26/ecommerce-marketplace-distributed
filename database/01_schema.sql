-- =====================================================================
-- Esquema relacional de la plataforma de comercio electrónico
-- Manual Técnico, Sección 2 (Diseño de la Base de Datos - PostgreSQL)
--
-- Ejecutar sobre la base de datos comercio_electronico ya creada:
--   CREATE DATABASE comercio_electronico;
-- =====================================================================

-- Creación de la base de datos de comercio electrónico

CREATE TABLE tiendas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  direccion VARCHAR(255),
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) CHECK (rol IN ('administrador', 'vendedor', 'cliente')),
  tienda_id INT REFERENCES tiendas(id), -- NULL para clientes; obligatorio para administrador/vendedor
  activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE productos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  sku VARCHAR(20) UNIQUE NOT NULL,
  precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  vendedor_id INT REFERENCES usuarios(id),
  tienda_id INT REFERENCES tiendas(id)
);

CREATE TABLE pedidos (
  id SERIAL PRIMARY KEY,
  cliente_id INT REFERENCES usuarios(id),
  producto_id INT REFERENCES productos(id),
  cantidad INT NOT NULL CHECK (cantidad > 0),
  estado VARCHAR(20) DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado')),
  fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resenas (
  id SERIAL PRIMARY KEY,
  pedido_id INT REFERENCES pedidos(id) ON DELETE CASCADE,
  calificacion NUMERIC(2, 1) CHECK (calificacion >= 1.0 AND calificacion <= 5.0),
  comentario VARCHAR(300), -- Ej: "Excelente producto, llegó a tiempo"
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
