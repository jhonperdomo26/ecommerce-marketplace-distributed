// src/controllers/admin.controller.ts
// Panel de administrador: gestión de tiendas y usuarios + conteos globales.
// Todas las rutas exigen rol 'administrador' (ver routes/admin.routes.ts).
import { Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../db';

const SALT_ROUNDS = 10;

// GET /api/admin/resumen
export const resumen = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM tiendas)   AS tiendas,
        (SELECT COUNT(*) FROM usuarios)  AS usuarios,
        (SELECT COUNT(*) FROM productos) AS productos,
        (SELECT COUNT(*) FROM pedidos)   AS pedidos
    `);
    res.status(200).json(q.rows[0]);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// GET /api/admin/tiendas
export const listarTiendas = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const q = await pool.query(
      `SELECT id, nombre, direccion, creado_en FROM tiendas ORDER BY id`
    );
    res.status(200).json(q.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// POST /api/admin/tiendas   { nombre, direccion }
export const crearTienda = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { nombre, direccion } = req.body;
  if (!nombre) {
    res.status(400).json({ mensaje: 'El nombre de la tienda es obligatorio.' });
    return;
  }
  try {
    const q = await pool.query(
      `INSERT INTO tiendas (nombre, direccion) VALUES ($1, $2)
       RETURNING id, nombre, direccion, creado_en`,
      [nombre, direccion ?? null]
    );
    res.status(201).json(q.rows[0]);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// GET /api/admin/usuarios
export const listarUsuarios = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const q = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.rol, u.tienda_id, u.activo,
              t.nombre AS tienda_nombre
       FROM usuarios u
       LEFT JOIN tiendas t ON u.tienda_id = t.id
       ORDER BY u.id`
    );
    res.status(200).json(q.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// POST /api/admin/usuarios   { nombre, email, password, rol, tienda_id }
// Solo crea 'vendedor' o 'administrador' (los 'cliente' se auto-registran).
export const crearUsuario = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { nombre, email, password, rol, tienda_id } = req.body;

  if (!nombre || !email || !password || !rol) {
    res
      .status(400)
      .json({ mensaje: 'nombre, email, password y rol son obligatorios.' });
    return;
  }
  if (!['vendedor', 'administrador'].includes(rol)) {
    res
      .status(400)
      .json({ mensaje: "El rol debe ser 'vendedor' o 'administrador'." });
    return;
  }
  if (!tienda_id) {
    res
      .status(400)
      .json({ mensaje: 'tienda_id es obligatorio para vendedor/administrador.' });
    return;
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const q = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, tienda_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, email, rol, tienda_id, activo`,
      [nombre, email, hash, rol, tienda_id]
    );
    res.status(201).json(q.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(409).json({ mensaje: 'Ya existe un usuario con ese email.' });
      return;
    }
    if (error?.code === '23503') {
      res.status(400).json({ mensaje: 'La tienda indicada no existe.' });
      return;
    }
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};

// PATCH /api/admin/usuarios/:id/activo   { activo: boolean }
export const cambiarActivoUsuario = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const id = Number(req.params.id);
  const { activo } = req.body;
  if (typeof activo !== 'boolean') {
    res.status(400).json({ mensaje: 'El campo "activo" debe ser booleano.' });
    return;
  }
  if (id === req.usuario_id) {
    res
      .status(409)
      .json({ mensaje: 'No puede desactivar su propio usuario.' });
    return;
  }
  try {
    const q = await pool.query(
      `UPDATE usuarios SET activo = $1 WHERE id = $2
       RETURNING id, nombre, email, rol, tienda_id, activo`,
      [activo, id]
    );
    if (q.rows.length === 0) {
      res.status(404).json({ mensaje: 'Usuario no encontrado.' });
      return;
    }
    res.status(200).json(q.rows[0]);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};
