// src/controllers/productos.controller.ts
// Catálogo de productos (consumido por la app móvil) y gestión de productos por
// parte del vendedor de cada tienda. El tienda_id y el vendedor_id se toman
// siempre del token, nunca del cuerpo de la petición.
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../db';

// GET /api/productos            -> catálogo completo (cualquier usuario autenticado)
// GET /api/productos?tienda_id= -> catálogo filtrado por tienda
export const listarCatalogo = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const tiendaId = req.query.tienda_id ? Number(req.query.tienda_id) : null;
    const resultado = await pool.query(
      `SELECT prod.id,
              prod.nombre,
              prod.sku,
              prod.precio,
              prod.stock,
              prod.tienda_id,
              t.nombre AS tienda_nombre
       FROM productos prod
       JOIN tiendas t ON prod.tienda_id = t.id
       WHERE ($1::int IS NULL OR prod.tienda_id = $1)
       ORDER BY prod.nombre`,
      [tiendaId]
    );
    res.status(200).json(resultado.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// GET /api/productos/mios  -> productos de la tienda del vendedor autenticado
export const listarMisProductos = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, sku, precio, stock, tienda_id, vendedor_id
       FROM productos
       WHERE tienda_id = $1
       ORDER BY nombre`,
      [req.tienda_id]
    );
    res.status(200).json(resultado.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// POST /api/productos  -> crea un producto en la tienda del vendedor
export const crearProducto = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { nombre, sku, precio, stock } = req.body;

  if (!nombre || !sku || precio === undefined) {
    res
      .status(400)
      .json({ mensaje: 'nombre, sku y precio son obligatorios.' });
    return;
  }
  if (Number(precio) < 0 || Number(stock ?? 0) < 0) {
    res
      .status(400)
      .json({ mensaje: 'precio y stock no pueden ser negativos.' });
    return;
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO productos (nombre, sku, precio, stock, vendedor_id, tienda_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, sku, precio, stock, tienda_id, vendedor_id`,
      [nombre, sku, precio, stock ?? 0, req.usuario_id, req.tienda_id]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(409).json({ mensaje: 'Ya existe un producto con ese SKU.' });
      return;
    }
    if (error?.code === '22001') {
      res
        .status(400)
        .json({ mensaje: 'Algún campo excede la longitud permitida (SKU máx. 20).' });
      return;
    }
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// PUT /api/productos/:id  -> edita un producto de la propia tienda
export const actualizarProducto = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const productoId = Number(req.params.id);
  const { nombre, sku, precio, stock } = req.body;

  try {
    const propietario = await pool.query(
      `SELECT tienda_id FROM productos WHERE id = $1`,
      [productoId]
    );
    if (
      propietario.rows.length === 0 ||
      propietario.rows[0].tienda_id !== req.tienda_id
    ) {
      res
        .status(403)
        .json({ mensaje: 'Operación no permitida para la tienda actual.' });
      return;
    }

    const resultado = await pool.query(
      `UPDATE productos
       SET nombre = COALESCE($1, nombre),
           sku    = COALESCE($2, sku),
           precio = COALESCE($3, precio),
           stock  = COALESCE($4, stock)
       WHERE id = $5
       RETURNING id, nombre, sku, precio, stock, tienda_id, vendedor_id`,
      [nombre ?? null, sku ?? null, precio ?? null, stock ?? null, productoId]
    );
    res.status(200).json(resultado.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(409).json({ mensaje: 'Ya existe un producto con ese SKU.' });
      return;
    }
    if (error?.code === '22001') {
      res
        .status(400)
        .json({ mensaje: 'Algún campo excede la longitud permitida (SKU máx. 20).' });
      return;
    }
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// DELETE /api/productos/:id  -> elimina un producto de la propia tienda
export const eliminarProducto = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const productoId = Number(req.params.id);
  try {
    const propietario = await pool.query(
      `SELECT tienda_id FROM productos WHERE id = $1`,
      [productoId]
    );
    if (
      propietario.rows.length === 0 ||
      propietario.rows[0].tienda_id !== req.tienda_id
    ) {
      res
        .status(403)
        .json({ mensaje: 'Operación no permitida para la tienda actual.' });
      return;
    }

    await pool.query(`DELETE FROM productos WHERE id = $1`, [productoId]);
    res.status(200).json({ mensaje: 'Producto eliminado.' });
  } catch (error: any) {
    if (error?.code === '23503') {
      res.status(409).json({
        mensaje: 'No se puede eliminar: el producto tiene pedidos asociados.',
      });
      return;
    }
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};
