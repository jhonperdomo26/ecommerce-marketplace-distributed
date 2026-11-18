-- load/datos-volumen.sql
-- Volumen de datos del Plan de Pruebas (REN-02: 60 productos; REN-03: 300 pedidos).
-- Ejecutar DESPUÉS de la semilla (02_seed.sql): parte de 5 productos y los pedidos de la semilla.
INSERT INTO productos (nombre, sku, precio, stock, vendedor_id, tienda_id)
SELECT 'Producto de volumen ' || g,
       'VOL-' || lpad(g::text, 4, '0'),
       (10000 + (g * 1237) % 900000)::numeric(10,2),
       100 + g,
       CASE WHEN g % 2 = 0 THEN 2 ELSE 3 END,
       CASE WHEN g % 2 = 0 THEN 1 ELSE 2 END
FROM generate_series(1, 55) g;

INSERT INTO pedidos (cliente_id, producto_id, cantidad, estado)
SELECT 4,
       1 + (g % 60),
       1 + (g % 3),
       (ARRAY['pendiente','pagado','enviado','entregado','cancelado'])[1 + (g % 5)]
FROM generate_series(1, 300 - (SELECT count(*) FROM pedidos)::int) g;
