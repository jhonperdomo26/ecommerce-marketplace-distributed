// src/controllers/resenas.controller.ts
// Reseñas de productos. El cliente califica un pedido suyo que esté 'entregado';
// el vendedor consulta las reseñas de los productos de su tienda.
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { repo } from '../db';
import { Pedido, Resena } from '../entidades';
import { columnas } from '../utils/consultas';
import { enviarErrorInterno } from '../utils/errores';
import { enteroPositivo, notaValida } from '../utils/validar';

// POST /api/resenas  (cliente)
// Cuerpo: { pedido_id, calificacion (1.0-5.0), comentario }
export const crearResena = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const cuerpo = req.body ?? {};

  if (!cuerpo.pedido_id || cuerpo.calificacion === undefined) {
    res
      .status(400)
      .json({ mensaje: 'pedido_id y calificacion son obligatorios.' });
    return;
  }
  const pedido_id = enteroPositivo(cuerpo.pedido_id);
  const calificacion = notaValida(cuerpo.calificacion);
  const comentario = cuerpo.comentario;
  if (pedido_id === null) {
    res.status(400).json({ mensaje: 'pedido_id debe ser un entero positivo.' });
    return;
  }
  if (calificacion === null) {
    res
      .status(400)
      .json({ mensaje: 'La calificación debe ser un número entre 1.0 y 5.0.' });
    return;
  }
  if (
    comentario !== undefined &&
    comentario !== null &&
    (typeof comentario !== 'string' || comentario.length > 300 || comentario.includes('\u0000'))
  ) {
    res.status(400).json({ mensaje: 'El comentario debe ser texto de hasta 300 caracteres.' });
    return;
  }

  try {
    // El pedido debe ser del cliente autenticado y estar entregado.
    const pedido = await (await repo(Pedido)).findOne({
      where: { id: pedido_id, cliente_id: req.usuario_id },
      select: { id: true, estado: true },
    });
    if (!pedido) {
      res.status(404).json({ mensaje: 'El pedido no existe o no es suyo.' });
      return;
    }
    if (pedido.estado !== 'entregado') {
      res.status(409).json({
        mensaje: 'Solo se pueden calificar pedidos en estado "entregado".',
      });
      return;
    }

    const resenas = await repo(Resena);
    const nueva = await resenas.save(
      resenas.create({ pedido_id, calificacion: String(calificacion), comentario: comentario ?? null })
    );
    // Se relee para devolver los valores tal como quedaron en la base (calificación NUMERIC, fecha).
    res.status(201).json(await resenas.findOneBy({ id: nueva.id }));
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(409).json({ mensaje: 'Este pedido ya tiene una reseña.' });
      return;
    }
    enviarErrorInterno(res, error);
  }
};

// GET /api/resenas/producto/:producto_id  (cualquier usuario autenticado)
export const listarPorProducto = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const productoId = enteroPositivo(req.params.producto_id);
  if (productoId === null) {
    res.status(400).json({ mensaje: 'El id del producto debe ser un entero positivo.' });
    return;
  }
  try {
    const qb = (await repo(Resena))
      .createQueryBuilder('r')
      .innerJoin('r.pedido', 'ped')
      .innerJoin('ped.cliente', 'cli');
    const resenas = await columnas(qb, {
      id: 'r.id',
      calificacion: 'r.calificacion',
      comentario: 'r.comentario',
      fecha_registro: 'r.fecha_registro',
      cliente_nombre: 'cli.nombre',
    })
      .where('ped.producto_id = :productoId', { productoId })
      .orderBy('r.fecha_registro', 'DESC')
      .getRawMany();
    res.status(200).json(resenas);
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};

// GET /api/resenas/mis-productos  (vendedor)
// Reseñas de todos los productos de la tienda del vendedor autenticado.
export const listarDeMisProductos = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const qb = (await repo(Resena))
      .createQueryBuilder('r')
      .innerJoin('r.pedido', 'ped')
      .innerJoin('ped.producto', 'prod')
      .innerJoin('ped.cliente', 'cli');
    const resenas = await columnas(qb, {
      id: 'r.id',
      calificacion: 'r.calificacion',
      comentario: 'r.comentario',
      fecha_registro: 'r.fecha_registro',
      producto_nombre: 'prod.nombre',
      cliente_nombre: 'cli.nombre',
    })
      .where('prod.tienda_id = :tiendaId', { tiendaId: req.tienda_id })
      .orderBy('r.fecha_registro', 'DESC')
      .getRawMany();
    res.status(200).json(resenas);
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};
