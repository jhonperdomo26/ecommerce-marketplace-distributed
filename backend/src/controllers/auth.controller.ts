// src/controllers/auth.controller.ts
// Pegamento mínimo: el Manual Técnico asume un endpoint de login que devuelve un
// JWT (Paso 5.1, punto 1) pero no incluye su código. Aquí se implementa firmando
// el token con la misma estructura que espera el middleware verificarToken:
//   { id, rol, tienda_id }
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { enviarErrorInterno } from '../utils/errores';

const SALT_ROUNDS = 10;

// Firma un JWT con la estructura que espera verificarToken: { id, rol, tienda_id }
function firmarToken(usuario: {
  id: number;
  rol: string;
  tienda_id: number | null;
}): string {
  return jwt.sign(
    { id: usuario.id, rol: usuario.rol, tienda_id: usuario.tienda_id },
    process.env.JWT_SECRET || 'FirmaSecretaPlataforma',
    { expiresIn: '8h' }
  );
}

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ mensaje: 'Email y password son obligatorios.' });
    return;
  }

  try {
    const resultado = await pool.query(
      `SELECT id, nombre, email, password_hash, rol, tienda_id, activo
       FROM usuarios
       WHERE email = $1`,
      [email]
    );

    const usuario = resultado.rows[0];
    if (!usuario || !usuario.activo) {
      res.status(401).json({ mensaje: 'Credenciales inválidas.' });
      return;
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      res.status(401).json({ mensaje: 'Credenciales inválidas.' });
      return;
    }

    const token = firmarToken(usuario);

    res.status(200).json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        tienda_id: usuario.tienda_id,
      },
    });
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};

// POST /api/auth/registro  (público)
// Alta de usuarios con rol 'cliente'. Los vendedores/administradores los crea el
// administrador desde su panel. Devuelve { token, usuario } igual que el login.
export const registro = async (req: Request, res: Response): Promise<void> => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    res
      .status(400)
      .json({ mensaje: 'nombre, email y password son obligatorios.' });
    return;
  }
  if (String(password).length < 6) {
    res
      .status(400)
      .json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
    return;
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, 'cliente')
       RETURNING id, nombre, email, rol, tienda_id`,
      [nombre, email, hash]
    );

    const usuario = resultado.rows[0];
    res.status(201).json({ token: firmarToken(usuario), usuario });
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(409).json({ mensaje: 'Ya existe un usuario con ese email.' });
      return;
    }
    enviarErrorInterno(res, error);
  }
};
