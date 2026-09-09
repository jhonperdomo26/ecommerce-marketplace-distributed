-- =====================================================================
-- Restricciones adicionales (no forman parte del script del Manual Técnico).
-- Ejecutar DESPUÉS de 01_schema.sql.
-- =====================================================================

-- Una reseña por pedido (necesario para POST /api/resenas).
ALTER TABLE resenas ADD CONSTRAINT resenas_pedido_id_unique UNIQUE (pedido_id);

-- Índices para las consultas más frecuentes del backend.
CREATE INDEX IF NOT EXISTS idx_productos_tienda   ON productos (tienda_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente    ON pedidos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_producto   ON pedidos (producto_id);
