// src/controllers/resenas.controller.ts
// Reseñas de productos. El cliente califica un pedido suyo que esté 'entregado';
// el vendedor consulta las reseñas de los productos de su tienda.
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../db';

// POST /api/resenas  (cliente)
// Cuerpo: { pedido_id, calificacion (1.0-5.0), comentario }
export const crearResena = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { pedido_id, calificacion, comentario } = req.body;

  if (!pedido_id || calificacion === undefined) {
    res
      .status(400)
      .json({ mensaje: 'pedido_id y calificacion son obligatorios.' });
    return;
  }
  if (Number(calificacion) < 1 || Number(calificacion) > 5) {
    res
      .status(400)
      .json({ mensaje: 'La calificación debe estar entre 1.0 y 5.0.' });
    return;
  }

  try {
    // El pedido debe ser del cliente autenticado y estar entregado.
    const pedido = await pool.query(
      `SELECT id, estado FROM pedidos WHERE id = $1 AND cliente_id = $2`,
      [pedido_id, req.usuario_id]
    );
    if (pedido.rows.length === 0) {
      res.status(404).json({ mensaje: 'El pedido no existe o no es suyo.' });
      return;
    }
    if (pedido.rows[0].estado !== 'entregado') {
      res.status(409).json({
        mensaje: 'Solo se pueden calificar pedidos en estado "entregado".',
      });
      return;
    }

    const resultado = await pool.query(
      `INSERT INTO resenas (pedido_id, calificacion, comentario)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [pedido_id, calificacion, comentario ?? null]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(409).json({ mensaje: 'Este pedido ya tiene una reseña.' });
      return;
    }
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// GET /api/resenas/producto/:producto_id  (cualquier usuario autenticado)
export const listarPorProducto = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const resultado = await pool.query(
      `SELECT r.id,
              r.calificacion,
              r.comentario,
              r.fecha_registro,
              cli.nombre AS cliente_nombre
       FROM resenas r
       JOIN pedidos ped ON r.pedido_id = ped.id
       JOIN usuarios cli ON ped.cliente_id = cli.id
       WHERE ped.producto_id = $1
       ORDER BY r.fecha_registro DESC`,
      [Number(req.params.producto_id)]
    );
    res.status(200).json(resultado.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// GET /api/resenas/mis-productos  (vendedor)
// Reseñas de todos los productos de la tienda del vendedor autenticado.
export const listarDeMisProductos = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const resultado = await pool.query(
      `SELECT r.id,
              r.calificacion,
              r.comentario,
              r.fecha_registro,
              prod.nombre AS producto_nombre,
              cli.nombre  AS cliente_nombre
       FROM resenas r
       JOIN pedidos  ped  ON r.pedido_id = ped.id
       JOIN productos prod ON ped.producto_id = prod.id
       JOIN usuarios  cli  ON ped.cliente_id = cli.id
       WHERE prod.tienda_id = $1
       ORDER BY r.fecha_registro DESC`,
      [req.tienda_id]
    );
    res.status(200).json(resultado.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};
