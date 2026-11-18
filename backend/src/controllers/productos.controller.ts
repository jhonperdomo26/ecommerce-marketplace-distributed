// src/controllers/productos.controller.ts
// Catálogo de productos (consumido por la app móvil) y gestión de productos por
// parte del vendedor de cada tienda. El tienda_id y el vendedor_id se toman
// siempre del token, nunca del cuerpo de la petición.
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { repo } from '../db';
import { Producto } from '../entidades';
import { columnas } from '../utils/consultas';
import { enviarErrorInterno } from '../utils/errores';
import {
  enteroPositivo,
  enteroNoNegativo,
  precioValido,
  textoValido,
} from '../utils/validar';

// GET /api/productos            -> catálogo completo (cualquier usuario autenticado)
// GET /api/productos?tienda_id= -> catálogo filtrado por tienda
export const listarCatalogo = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    let tiendaId: number | null = null;
    if (req.query.tienda_id !== undefined && req.query.tienda_id !== '') {
      tiendaId = enteroPositivo(req.query.tienda_id);
      if (tiendaId === null) {
        res.status(400).json({ mensaje: 'tienda_id debe ser un entero positivo.' });
        return;
      }
    }
    const qb = (await repo(Producto)).createQueryBuilder('prod').innerJoin('prod.tienda', 't');
    columnas(qb, {
      id: 'prod.id',
      nombre: 'prod.nombre',
      sku: 'prod.sku',
      precio: 'prod.precio',
      stock: 'prod.stock',
      tienda_id: 'prod.tienda_id',
      tienda_nombre: 't.nombre',
    });
    if (tiendaId !== null) qb.where('prod.tienda_id = :tiendaId', { tiendaId });
    res.status(200).json(await qb.orderBy('prod.nombre', 'ASC').getRawMany());
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};

// GET /api/productos/mios  -> productos de la tienda del vendedor autenticado
export const listarMisProductos = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const productos = await (await repo(Producto)).find({
      where: { tienda_id: req.tienda_id },
      order: { nombre: 'ASC' },
    });
    res.status(200).json(productos);
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};

// POST /api/productos  -> crea un producto en la tienda del vendedor
export const crearProducto = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const cuerpo = req.body ?? {};

  if (!cuerpo.nombre || !cuerpo.sku || cuerpo.precio === undefined) {
    res
      .status(400)
      .json({ mensaje: 'nombre, sku y precio son obligatorios.' });
    return;
  }
  const nombre = textoValido(cuerpo.nombre, 100);
  const sku = textoValido(cuerpo.sku, 20);
  const precio = precioValido(cuerpo.precio);
  const stock = cuerpo.stock === undefined || cuerpo.stock === null ? 0 : enteroNoNegativo(cuerpo.stock);
  if (nombre === null || sku === null) {
    res.status(400).json({
      mensaje: 'nombre (máx. 100) y sku (máx. 20) deben ser texto no vacío.',
    });
    return;
  }
  if (precio === null || stock === null) {
    res.status(400).json({
      mensaje: 'precio debe ser un número entre 0 y 99999999.99 y stock un entero no negativo.',
    });
    return;
  }

  try {
    const productos = await repo(Producto);
    const nuevo = await productos.save(
      productos.create({
        nombre,
        sku,
        precio: String(precio),
        stock,
        vendedor_id: req.usuario_id,
        tienda_id: req.tienda_id,
      })
    );
    res.status(201).json(await productos.findOneBy({ id: nuevo.id }));
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
    enviarErrorInterno(res, error);
  }
};

// PUT /api/productos/:id  -> edita un producto de la propia tienda
export const actualizarProducto = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const productoId = enteroPositivo(req.params.id);
  if (productoId === null) {
    res.status(400).json({ mensaje: 'El id del producto debe ser un entero positivo.' });
    return;
  }
  // Campos opcionales: si vienen, se validan igual que al crear.
  const cuerpo = req.body ?? {};
  const nombre = cuerpo.nombre === undefined ? null : textoValido(cuerpo.nombre, 100);
  const sku = cuerpo.sku === undefined ? null : textoValido(cuerpo.sku, 20);
  const precio = cuerpo.precio === undefined ? null : precioValido(cuerpo.precio);
  const stock = cuerpo.stock === undefined ? null : enteroNoNegativo(cuerpo.stock);
  if (
    (cuerpo.nombre !== undefined && nombre === null) ||
    (cuerpo.sku !== undefined && sku === null) ||
    (cuerpo.precio !== undefined && precio === null) ||
    (cuerpo.stock !== undefined && stock === null)
  ) {
    res.status(400).json({
      mensaje: 'Algún campo no es válido (nombre ≤100, sku ≤20, precio 0–99999999.99, stock entero ≥0).',
    });
    return;
  }

  try {
    const productos = await repo(Producto);
    const propietario = await productos.findOne({
      where: { id: productoId },
      select: { id: true, tienda_id: true },
    });
    if (!propietario || propietario.tienda_id !== req.tienda_id) {
      res
        .status(403)
        .json({ mensaje: 'Operación no permitida para la tienda actual.' });
      return;
    }

    // Solo se actualizan los campos que llegaron (antes: COALESCE en SQL).
    const cambios: Partial<Producto> = {};
    if (nombre !== null) cambios.nombre = nombre;
    if (sku !== null) cambios.sku = sku;
    if (precio !== null) cambios.precio = String(precio);
    if (stock !== null) cambios.stock = stock;
    if (Object.keys(cambios).length > 0) await productos.update({ id: productoId }, cambios);
    res.status(200).json(await productos.findOneBy({ id: productoId }));
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
    enviarErrorInterno(res, error);
  }
};

// DELETE /api/productos/:id  -> elimina un producto de la propia tienda
export const eliminarProducto = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const productoId = enteroPositivo(req.params.id);
  if (productoId === null) {
    res.status(400).json({ mensaje: 'El id del producto debe ser un entero positivo.' });
    return;
  }
  try {
    const productos = await repo(Producto);
    const propietario = await productos.findOne({
      where: { id: productoId },
      select: { id: true, tienda_id: true },
    });
    if (!propietario || propietario.tienda_id !== req.tienda_id) {
      res
        .status(403)
        .json({ mensaje: 'Operación no permitida para la tienda actual.' });
      return;
    }

    await productos.delete({ id: productoId });
    res.status(200).json({ mensaje: 'Producto eliminado.' });
  } catch (error: any) {
    if (error?.code === '23503') {
      res.status(409).json({
        mensaje: 'No se puede eliminar: el producto tiene pedidos asociados.',
      });
      return;
    }
    enviarErrorInterno(res, error);
  }
};
