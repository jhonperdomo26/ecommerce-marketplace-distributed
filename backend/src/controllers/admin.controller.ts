// src/controllers/admin.controller.ts
// Panel de administrador: gestión de tiendas y usuarios + conteos globales.
// Todas las rutas exigen rol 'administrador' (ver routes/admin.routes.ts).
import { Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../middleware/auth';
import { bd, repo } from '../db';
import { Pedido, Producto, Tienda, Usuario } from '../entidades';
import { enviarErrorInterno } from '../utils/errores';
import { columnas } from '../utils/consultas';
import { emailValido, enteroPositivo, errorDePassword, textoValido } from '../utils/validar';

const SALT_ROUNDS = 10;

// GET /api/admin/resumen
export const resumen = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ds = await bd();
    const [tiendas, usuarios, productos, pedidos] = await Promise.all([
      ds.getRepository(Tienda).count(),
      ds.getRepository(Usuario).count(),
      ds.getRepository(Producto).count(),
      ds.getRepository(Pedido).count(),
    ]);
    res.status(200).json({ tiendas, usuarios, productos, pedidos });
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};

// GET /api/admin/tiendas
export const listarTiendas = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const tiendas = await (await repo(Tienda)).find({ order: { id: 'ASC' } });
    res.status(200).json(tiendas);
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};

// POST /api/admin/tiendas   { nombre, direccion }
export const crearTienda = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const cuerpo = req.body ?? {};
  if (!cuerpo.nombre) {
    res.status(400).json({ mensaje: 'El nombre de la tienda es obligatorio.' });
    return;
  }
  const nombre = textoValido(cuerpo.nombre, 100);
  const direccion = cuerpo.direccion === undefined || cuerpo.direccion === null ? null : textoValido(cuerpo.direccion, 255);
  if (nombre === null || (cuerpo.direccion != null && direccion === null)) {
    res.status(400).json({ mensaje: 'nombre (máx. 100) y dirección (máx. 255) deben ser texto.' });
    return;
  }
  try {
    const tiendas = await repo(Tienda);
    const nueva = await tiendas.save(tiendas.create({ nombre, direccion }));
    res.status(201).json(await tiendas.findOneBy({ id: nueva.id }));
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};

// GET /api/admin/usuarios
export const listarUsuarios = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const qb = (await repo(Usuario)).createQueryBuilder('u').leftJoin('u.tienda', 't');
    const usuarios = await columnas(qb, {
      id: 'u.id',
      nombre: 'u.nombre',
      email: 'u.email',
      rol: 'u.rol',
      tienda_id: 'u.tienda_id',
      activo: 'u.activo',
      tienda_nombre: 't.nombre',
    })
      .orderBy('u.id', 'ASC')
      .getRawMany();
    res.status(200).json(usuarios);
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};

// POST /api/admin/usuarios   { nombre, email, password, rol, tienda_id }
// Solo crea 'vendedor' o 'administrador' (los 'cliente' se auto-registran).
export const crearUsuario = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { nombre: nombreCrudo, email: emailCrudo, password, rol, tienda_id: tiendaCruda } = req.body ?? {};

  if (!nombreCrudo || !emailCrudo || !password || !rol) {
    res
      .status(400)
      .json({ mensaje: 'nombre, email, password y rol son obligatorios.' });
    return;
  }
  const nombre = textoValido(nombreCrudo, 100);
  const email = emailValido(emailCrudo);
  if (nombre === null || email === null) {
    res.status(400).json({
      mensaje: 'nombre (máx. 100) y correo (formato válido, máx. 150) no son válidos.',
    });
    return;
  }
  const errorPassword = errorDePassword(password, email);
  if (errorPassword) {
    res.status(400).json({ mensaje: errorPassword });
    return;
  }
  if (!['vendedor', 'administrador'].includes(rol)) {
    res
      .status(400)
      .json({ mensaje: "El rol debe ser 'vendedor' o 'administrador'." });
    return;
  }
  if (!tiendaCruda) {
    res
      .status(400)
      .json({ mensaje: 'tienda_id es obligatorio para vendedor/administrador.' });
    return;
  }
  const tienda_id = enteroPositivo(tiendaCruda);
  if (tienda_id === null) {
    res.status(400).json({ mensaje: 'tienda_id debe ser un entero positivo.' });
    return;
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const usuarios = await repo(Usuario);
    const nuevo = await usuarios.save(
      usuarios.create({ nombre, email, password_hash: hash, rol, tienda_id })
    );
    // findOneBy no trae password_hash (select:false en la entidad).
    res.status(201).json(await usuarios.findOneBy({ id: nuevo.id }));
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(409).json({ mensaje: 'Ya existe un usuario con ese email.' });
      return;
    }
    if (error?.code === '23503') {
      res.status(400).json({ mensaje: 'La tienda indicada no existe.' });
      return;
    }
    enviarErrorInterno(res, error);
  }
};

// PATCH /api/admin/usuarios/:id/activo   { activo: boolean }
export const cambiarActivoUsuario = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const id = enteroPositivo(req.params.id);
  if (id === null) {
    res.status(400).json({ mensaje: 'El id del usuario debe ser un entero positivo.' });
    return;
  }
  const { activo } = req.body ?? {};
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
    const usuarios = await repo(Usuario);
    const resultado = await usuarios.update({ id }, { activo });
    if (!resultado.affected) {
      res.status(404).json({ mensaje: 'Usuario no encontrado.' });
      return;
    }
    res.status(200).json(await usuarios.findOneBy({ id }));
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};
