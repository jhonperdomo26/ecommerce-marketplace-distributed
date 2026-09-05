// src/controllers/auth.controller.ts
// Pegamento mínimo: el Manual Técnico asume un endpoint de login que devuelve un
// JWT (Paso 5.1, punto 1) pero no incluye su código. Aquí se implementa firmando
// el token con la misma estructura que espera el middleware verificarToken:
//   { id, rol, tienda_id }
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db';

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

    const token = jwt.sign(
      {
        id: usuario.id,
        rol: usuario.rol,
        tienda_id: usuario.tienda_id,
      },
      process.env.JWT_SECRET || 'FirmaSecretaPlataforma',
      { expiresIn: '8h' }
    );

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
    res.status(500).json({ mensaje: 'Error interno del servidor', error });
  }
};
