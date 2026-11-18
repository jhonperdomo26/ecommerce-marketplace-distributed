-- load/consistencia-stock.sql  (PT-REN-07)
-- Tras REN-04/05/06: stock inicial (10 000 000) − stock final debe ser igual a la suma de las
-- cantidades pedidas, y el stock nunca puede ser negativo. Una fila por producto de carga.
SELECT p.id,
       p.sku,
       10000000 - p.stock                                   AS stock_descontado,
       COALESCE(SUM(ped.cantidad), 0)                       AS suma_pedidos,
       COUNT(ped.id)                                        AS pedidos,
       (10000000 - p.stock) = COALESCE(SUM(ped.cantidad), 0) AS consistente,
       p.stock >= 0                                         AS stock_no_negativo
FROM productos p
LEFT JOIN pedidos ped ON ped.producto_id = p.id
WHERE p.sku LIKE 'SKU-LOAD-%'
GROUP BY p.id, p.sku, p.stock
ORDER BY p.id;
