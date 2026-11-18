// src/chat/datos.ts
// Implementación de ChatDatos sobre PostgreSQL con TypeORM (repositorios y QueryBuilder). Todas las consultas reciben el
// identificador de quien pregunta (cliente o tienda) que el controlador toma del
// token: por construcción, el asistente no puede devolver datos de otro cliente
// ni de otra tienda.
import { LessThanOrEqual } from 'typeorm';
import { bd, repo } from '../db';
import { Pedido, Producto, Resena, Tienda, Usuario } from '../entidades';
import { columnas } from '../utils/consultas';
import {
  ChatDatos,
  ConteosGlobales,
  PedidoCliente,
  ProductoBusqueda,
  ProductoStock,
  ResumenResenas,
} from './tipos';

// Pedidos del cliente con el nombre del producto y si ya tienen reseña.
async function consultaPedidos() {
  const qb = (await repo(Pedido))
    .createQueryBuilder('ped')
    .innerJoin('ped.producto', 'prod')
    .leftJoin(Resena, 'r', 'r.pedido_id = ped.id');
  return columnas(qb, {
    id: 'ped.id',
    cantidad: 'ped.cantidad',
    estado: 'ped.estado',
    fecha_pedido: 'ped.fecha_pedido',
    producto_nombre: 'prod.nombre',
    tiene_resena: '(r.id IS NOT NULL)',
  });
}

// Reseñas de los productos de una tienda.
async function consultaResenasTienda(tiendaId: number) {
  return (await repo(Resena))
    .createQueryBuilder('r')
    .innerJoin('r.pedido', 'ped')
    .innerJoin('ped.producto', 'prod')
    .where('prod.tienda_id = :tiendaId', { tiendaId });
}

// Escapa los comodines de LIKE para que «%» o «_» escritos por la persona se
// busquen literalmente.
const escaparLike = (t: string): string => t.replace(/[\\%_]/g, '\\$&');

// Quita tildes en SQL sin depender de la extensión unaccent.
const SIN_TILDES = (col: string): string =>
  `translate(lower(${col}), 'áéíóúüñ', 'aeiouun')`;

export const chatDatosPg: ChatDatos = {
  async nombreUsuario(usuarioId): Promise<string | null> {
    const u = await (await repo(Usuario)).findOne({ where: { id: usuarioId }, select: { nombre: true } });
    return u?.nombre ?? null;
  },

  async pedidosDelCliente(clienteId, limite): Promise<PedidoCliente[]> {
    return (await consultaPedidos())
      .where('ped.cliente_id = :clienteId', { clienteId })
      .orderBy('ped.fecha_pedido', 'DESC')
      .addOrderBy('ped.id', 'DESC')
      .limit(limite)
      .getRawMany();
  },

  async pedidoDelCliente(clienteId, pedidoId): Promise<PedidoCliente | null> {
    const fila = await (await consultaPedidos())
      .where('ped.id = :pedidoId AND ped.cliente_id = :clienteId', { pedidoId, clienteId })
      .getRawOne<PedidoCliente>();
    return fila ?? null;
  },

  async buscarProductos(terminos, limite): Promise<ProductoBusqueda[]> {
    const qb = (await repo(Producto)).createQueryBuilder('prod').innerJoin('prod.tienda', 't');
    columnas(qb, {
      id: 'prod.id',
      nombre: 'prod.nombre',
      sku: 'prod.sku',
      precio: 'prod.precio',
      stock: 'prod.stock',
      tienda_nombre: 't.nombre',
    });
    // Cada término debe aparecer en el nombre (sin tildes) o en el SKU; valores parametrizados.
    terminos.forEach((t, i) => {
      qb.andWhere(`(${SIN_TILDES('prod.nombre')} LIKE :t${i} OR lower(prod.sku) LIKE :t${i})`, {
        [`t${i}`]: `%${escaparLike(t)}%`,
      });
    });
    return qb
      .orderBy('(prod.stock > 0)', 'DESC')
      .addOrderBy('prod.nombre', 'ASC')
      .limit(limite)
      .getRawMany();
  },

  async conteoPedidosPorEstadoTienda(tiendaId): Promise<Record<string, number>> {
    const filas = await (await repo(Pedido))
      .createQueryBuilder('ped')
      .innerJoin('ped.producto', 'prod')
      .select('ped.estado', 'estado')
      .addSelect('COUNT(*)', 'total')
      .where('prod.tienda_id = :tiendaId', { tiendaId })
      .groupBy('ped.estado')
      .getRawMany<{ estado: string; total: string }>();
    const conteo: Record<string, number> = {};
    for (const fila of filas) conteo[fila.estado] = Number(fila.total);
    return conteo;
  },

  async productosStockBajo(tiendaId, umbral, limite): Promise<ProductoStock[]> {
    return (await repo(Producto)).find({
      where: { tienda_id: tiendaId, stock: LessThanOrEqual(umbral) },
      select: { nombre: true, sku: true, stock: true },
      order: { stock: 'ASC', nombre: 'ASC' },
      take: limite,
    });
  },

  async resumenResenasTienda(tiendaId): Promise<ResumenResenas> {
    const [fila, recientes] = await Promise.all([
      (await consultaResenasTienda(tiendaId))
        .select('COUNT(*)', 'total')
        .addSelect('AVG(r.calificacion)', 'promedio')
        .getRawOne<{ total: string; promedio: string | null }>(),
      columnas(await consultaResenasTienda(tiendaId), {
        calificacion: 'r.calificacion',
        comentario: 'r.comentario',
        producto_nombre: 'prod.nombre',
      })
        .orderBy('r.fecha_registro', 'DESC')
        .addOrderBy('r.id', 'DESC')
        .limit(3)
        .getRawMany(),
    ]);
    return {
      total: Number(fila?.total ?? 0),
      promedio: fila?.promedio == null ? null : Number(fila.promedio),
      recientes,
    };
  },

  async conteosGlobales(): Promise<ConteosGlobales> {
    const ds = await bd();
    const [tiendas, usuarios, productos, pedidos] = await Promise.all([
      ds.getRepository(Tienda).count(),
      ds.getRepository(Usuario).count(),
      ds.getRepository(Producto).count(),
      ds.getRepository(Pedido).count(),
    ]);
    return { tiendas, usuarios, productos, pedidos };
  },
};
