-- =====================================================================
-- Datos de prueba (semilla)
-- Manual Técnico, Paso 1 ("Insertar datos de prueba"), ampliado con lo que
-- el propio manual necesita más adelante (Paso 5.2): dos vendedores en tiendas
-- distintas, un cliente, un producto y un pedido.
--
-- Ejecutar DESPUÉS de 01_schema.sql, sobre comercio_electronico.
--
-- Todos los usuarios comparten la contraseña de demostración:  Password123
-- El hash es bcrypt (10 rounds). Para regenerarlo:
--   cd backend && npm run seed:hash -- "Password123"
-- =====================================================================

-- Tiendas -------------------------------------------------------------
INSERT INTO tiendas (nombre, direccion) VALUES
  ('Tienda Central', 'Av. Principal 123'),   -- id = 1
  ('Tienda Norte',   'Calle 45 # 10-20');    -- id = 2

-- Usuarios ----------------------------------------------------------------------
-- password_hash corresponde a "Password123"
INSERT INTO usuarios (nombre, email, password_hash, rol, tienda_id) VALUES
  ('Admin General', 'admin@tutienda.com',     '$2b$10$6C6KhArT5ArZ9r429RjP6OxTQnDvinFq.MYc5QcsDKT.m3ObKDh8q', 'administrador', 1),
  ('Vendedor Uno',  'vendedor1@tutienda.com', '$2b$10$6C6KhArT5ArZ9r429RjP6OxTQnDvinFq.MYc5QcsDKT.m3ObKDh8q', 'vendedor',      1),
  ('Vendedor Dos',  'vendedor2@tutienda.com', '$2b$10$6C6KhArT5ArZ9r429RjP6OxTQnDvinFq.MYc5QcsDKT.m3ObKDh8q', 'vendedor',      2);

-- Cliente: tienda_id NULL (Manual Técnico, Sección 2)
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
  ('Cliente Prueba', 'cliente@correo.com', '$2b$10$6C6KhArT5ArZ9r429RjP6OxTQnDvinFq.MYc5QcsDKT.m3ObKDh8q', 'cliente');

-- Productos ---------------------------------------------------------------------
-- Producto de la Tienda 1, a nombre del Vendedor Uno (usuario id = 2).
INSERT INTO productos (nombre, sku, precio, stock, vendedor_id, tienda_id) VALUES
  ('Teclado mecánico', 'SKU-TEC-001', 149900.00, 25, 2, 1);

-- Pedidos ---------------------------------------------------------------------
-- Pedido del Cliente Prueba (usuario id = 4) sobre el producto id = 1 (Tienda 1).
INSERT INTO pedidos (cliente_id, producto_id, cantidad, estado) VALUES
  (4, 1, 2, 'pendiente');
