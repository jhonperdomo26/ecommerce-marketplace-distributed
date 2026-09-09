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
-- Tienda 1 -> Vendedor Uno (usuario id = 2). Tienda 2 -> Vendedor Dos (id = 3).
INSERT INTO productos (nombre, sku, precio, stock, vendedor_id, tienda_id) VALUES
  ('Teclado mecánico',  'SKU-TEC-001',  149900.00, 25, 2, 1),  -- id = 1
  ('Mouse inalámbrico', 'SKU-MOU-002',   89900.00, 40, 2, 1),  -- id = 2
  ('Monitor 24"',       'SKU-MON-003',  699900.00, 10, 2, 1),  -- id = 3
  ('Silla ergonómica',  'SKU-SIL-004',  459900.00,  8, 3, 2),  -- id = 4
  ('Escritorio',        'SKU-ESC-005',  399900.00,  5, 3, 2);  -- id = 5

-- Pedidos ---------------------------------------------------------------------
-- Cliente Prueba (usuario id = 4).
--   Pedido 1: Teclado mecánico (Tienda 1), pendiente.
--   Pedido 2: Mouse inalámbrico (Tienda 1), entregado -> permite probar reseñas.
INSERT INTO pedidos (cliente_id, producto_id, cantidad, estado) VALUES
  (4, 1, 2, 'pendiente'),
  (4, 2, 1, 'entregado');
