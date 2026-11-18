// src/controllers/auth.controller.ts
// Pegamento mínimo: el Manual Técnico asume un endpoint de login que devuelve un
// JWT (Paso 5.1, punto 1) pero no incluye su código. Aquí se implementa firmando
// el token con la misma estructura que espera el middleware verificarToken:
//   { id, rol, tienda_id }
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { repo } from '../db';
import { Usuario } from '../entidades';
import { enviarErrorInterno } from '../utils/errores';
import { JWT_SECRET, JWT_ALGORITMO } from '../config';
import { emailValido, errorDePassword, textoValido } from '../utils/validar';

const SALT_ROUNDS = 10;

// Hash de relleno: cuando el correo no existe se compara igualmente contra este hash, de
// modo que responder "no existe" cueste lo mismo que responder "contraseña errónea" y no se
// pueda descubrir qué correos están registrados midiendo el tiempo (A07).
const HASH_RELLENO = bcrypt.hashSync('relleno-sin-uso', SALT_ROUNDS);

// Firma un JWT con la estructura que espera verificarToken: { id, rol, tienda_id }
function firmarToken(usuario: {
  id: number;
  rol: string;
  tienda_id: number | null;
}): string {
  return jwt.sign(
    { id: usuario.id, rol: usuario.rol, tienda_id: usuario.tienda_id },
    JWT_SECRET,
    { expiresIn: '8h', algorithm: JWT_ALGORITMO }
  );
}

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    res.status(400).json({ mensaje: 'Email y password son obligatorios.' });
    return;
  }
  // Más largo que cualquier valor legítimo: se rechaza sin gastar bcrypt ni consultar la base.
  if (email.length > 150 || Buffer.byteLength(password, 'utf8') > 72 || email.includes('\u0000') || password.includes('\u0000')) {
    res.status(401).json({ mensaje: 'Credenciales inválidas.' });
    return;
  }

  try {
    // password_hash está marcado select:false en la entidad: solo el login lo pide.
    const usuario = await (await repo(Usuario)).findOne({
      where: { email },
      select: { id: true, nombre: true, email: true, password_hash: true, rol: true, tienda_id: true, activo: true },
    });
    const passwordValida = await bcrypt.compare(
      password,
      usuario ? usuario.password_hash : HASH_RELLENO
    );
    if (!usuario || !usuario.activo || !passwordValida) {
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
  // Solo se leen estos tres campos: rol, tienda_id o activo enviados por el cliente se ignoran.
  const { nombre: nombreCrudo, email: emailCrudo, password } = req.body;

  if (!nombreCrudo || !emailCrudo || !password) {
    res
      .status(400)
      .json({ mensaje: 'nombre, email y password son obligatorios.' });
    return;
  }
  const nombre = textoValido(nombreCrudo, 100);
  const email = emailValido(emailCrudo);
  if (nombre === null) {
    res.status(400).json({ mensaje: 'El nombre debe ser texto de hasta 100 caracteres.' });
    return;
  }
  if (email === null) {
    res.status(400).json({ mensaje: 'El correo no tiene un formato válido (máx. 150 caracteres).' });
    return;
  }
  const errorPassword = errorDePassword(password, email);
  if (errorPassword) {
    res.status(400).json({ mensaje: errorPassword });
    return;
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const usuarios = await repo(Usuario);
    const nuevo = await usuarios.save(
      usuarios.create({ nombre, email, password_hash: hash, rol: 'cliente', tienda_id: null })
    );
    const usuario = {
      id: nuevo.id,
      nombre: nuevo.nombre,
      email: nuevo.email,
      rol: nuevo.rol,
      tienda_id: nuevo.tienda_id,
    };
    res.status(201).json({ token: firmarToken(usuario), usuario });
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(409).json({ mensaje: 'Ya existe un usuario con ese email.' });
      return;
    }
    enviarErrorInterno(res, error);
  }
};
