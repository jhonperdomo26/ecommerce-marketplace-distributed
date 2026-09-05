// src/controllers/pedidos.controller.ts (Lógica de Negocio)
// Manual Técnico, Sección 3.
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../db';

// --- actualizarEstadoPedido: código literal del Manual Técnico (Sección 3) ---
export const actualizarEstadoPedido = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { pedido_id, estado } = req.body;
  try {
    // Validar que el pedido corresponda a un producto de la misma tienda del vendedor,
    // para garantizar seguridad entre tiendas del marketplace
    const validarTienda = await pool.query(
      `SELECT p.tienda_id FROM pedidos ped
       JOIN productos p ON ped.producto_id = p.id
       WHERE ped.id = $1`,
      [pedido_id]
    );

    if (
      validarTienda.rows.length === 0 ||
      validarTienda.rows[0].tienda_id !== req.tienda_id
    ) {
      res
        .status(403)
        .json({ mensaje: 'Operación no permitida para la tienda actual.' });
      return;
    }

    // Actualizar estado del pedido
    const pedidoActualizado = await pool.query(
      `UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *`,
      [estado, pedido_id]
    );

    res.status(200).json({
      mensaje: 'Estado del pedido actualizado con éxito',
      datos: pedidoActualizado.rows[0],
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// --- Pegamento mínimo: endpoints que consumen el frontend web y la app móvil ---

// GET /api/pedidos/por-tienda  (panel de vendedor, Manual Técnico Sección 4)
// Devuelve los pedidos cuyos productos pertenecen a la tienda del vendedor
// autenticado. El tienda_id se toma del token, nunca del cliente.
export const listarPorTienda = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const resultado = await pool.query(
      `SELECT ped.id,
              ped.cantidad,
              ped.estado,
              ped.fecha_pedido,
              cli.nombre  AS cliente_nombre,
              prod.nombre AS producto_nombre
       FROM pedidos ped
       JOIN productos prod ON ped.producto_id = prod.id
       JOIN usuarios  cli  ON ped.cliente_id  = cli.id
       WHERE prod.tienda_id = $1
       ORDER BY ped.fecha_pedido DESC`,
      [req.tienda_id]
    );
    res.status(200).json(resultado.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// GET /api/pedidos/mios  (app móvil del cliente, Manual Técnico Sección 5)
// Devuelve los pedidos del cliente autenticado.
export const listarMios = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const resultado = await pool.query(
      `SELECT ped.id,
              ped.cantidad,
              ped.estado,
              ped.fecha_pedido,
              prod.nombre AS producto_nombre
       FROM pedidos ped
       JOIN productos prod ON ped.producto_id = prod.id
       WHERE ped.cliente_id = $1
       ORDER BY ped.fecha_pedido DESC`,
      [req.usuario_id]
    );
    res.status(200).json(resultado.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};
