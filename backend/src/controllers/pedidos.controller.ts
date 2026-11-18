// src/controllers/pedidos.controller.ts (Lógica de Negocio)
// Manual Técnico, Sección 3.
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { bd, repo } from '../db';
import { Pedido, Producto, Resena } from '../entidades';
import { columnas } from '../utils/consultas';
import { notificarCambioEstado, notificarPedidoCreado } from '../servicios/notificaciones';
import { enviarErrorInterno } from '../utils/errores';
import { ESTADOS_PEDIDO, enteroPositivo } from '../utils/validar';

// --- actualizarEstadoPedido: código literal del Manual Técnico (Sección 3) ---
export const actualizarEstadoPedido = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const pedido_id = enteroPositivo(req.body?.pedido_id);
  const estado = req.body?.estado;
  if (pedido_id === null) {
    res.status(400).json({ mensaje: 'pedido_id debe ser un entero positivo.' });
    return;
  }
  if (typeof estado !== 'string' || !(ESTADOS_PEDIDO as readonly string[]).includes(estado)) {
    res.status(400).json({
      mensaje: `estado debe ser uno de: ${ESTADOS_PEDIDO.join(', ')}.`,
    });
    return;
  }
  try {
    // Validar que el pedido corresponda a un producto de la misma tienda del vendedor,
    // para garantizar seguridad entre tiendas del marketplace
    const pedidos = await repo(Pedido);
    const validarTienda = await pedidos
      .createQueryBuilder('ped')
      .innerJoin('ped.producto', 'p')
      .select('p.tienda_id', 'tienda_id')
      .where('ped.id = :pedido_id', { pedido_id })
      .getRawOne<{ tienda_id: number | null }>();

    if (!validarTienda || validarTienda.tienda_id !== req.tienda_id) {
      res
        .status(403)
        .json({ mensaje: 'Operación no permitida para la tienda actual.' });
      return;
    }

    // Actualizar estado del pedido
    await pedidos.update({ id: pedido_id }, { estado: estado as Pedido['estado'] });

    res.status(200).json({
      mensaje: 'Estado del pedido actualizado con éxito',
      datos: await pedidos.findOneBy({ id: pedido_id }),
    });
    // Aviso al cliente por correo (servicio externo), sin hacer esperar la respuesta.
    notificarCambioEstado(pedido_id);
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};

// --- Pegamento mínimo: endpoints que consumen el frontend web y la app móvil ---

// GET /api/pedidos/por-tienda  (panel de vendedor, Manual Técnico Sección 4)
// Devuelve los pedidos cuyos productos pertenecen a la tienda del vendedor
// autenticado. El tienda_id se toma del token, nunca del cliente.
// Paginado (?page=&limit=, por defecto 1 y 20) y filtros ?estado= y ?q=: con miles de pedidos la tabla
// sin límite tardaba varios segundos en renderizar en el panel (hallazgo de
// usabilidad de la práctica de validación y pruebas, Módulo 2).
export const listarPorTienda = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const pagina = Math.max(1, Number(req.query.page) || 1);
    const limite = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (pagina - 1) * limite;

    // Filtros opcionales (hallazgo de usabilidad U-10): ?estado= y ?q= (cliente o producto).
    const estado = typeof req.query.estado === 'string' && req.query.estado !== '' ? req.query.estado : null;
    if (estado !== null && !(ESTADOS_PEDIDO as readonly string[]).includes(estado)) {
      res.status(400).json({ mensaje: `estado debe ser uno de: ${ESTADOS_PEDIDO.join(', ')}.` });
      return;
    }
    const texto = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';

    const pedidos = await repo(Pedido);
    const deLaTienda = () => {
      const qb = pedidos
        .createQueryBuilder('ped')
        .innerJoin('ped.producto', 'prod')
        .innerJoin('ped.cliente', 'cli')
        .where('prod.tienda_id = :tiendaId', { tiendaId: req.tienda_id });
      if (estado) qb.andWhere('ped.estado = :estado', { estado });
      if (texto) {
        qb.andWhere('(cli.nombre ILIKE :texto OR prod.nombre ILIKE :texto)', {
          texto: `%${texto.replace(/[\\%_]/g, '\\$&')}%`,
        });
      }
      return qb;
    };

    const [datos, total] = await Promise.all([
      columnas(deLaTienda(), {
        id: 'ped.id',
        cantidad: 'ped.cantidad',
        estado: 'ped.estado',
        fecha_pedido: 'ped.fecha_pedido',
        cliente_nombre: 'cli.nombre',
        producto_nombre: 'prod.nombre',
      })
        .orderBy('ped.fecha_pedido', 'DESC')
        .addOrderBy('ped.id', 'DESC')
        .limit(limite)
        .offset(offset)
        .getRawMany(),
      deLaTienda().getCount(),
    ]);

    res.status(200).json({
      datos,
      total,
      pagina,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    });
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};

// GET /api/pedidos/mios  (app móvil del cliente, Manual Técnico Sección 5)
// Devuelve los pedidos del cliente autenticado. Incluye si ya tiene reseña,
// para que la app sepa cuándo ofrecer el botón "Calificar".
export const listarMios = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const qb = (await repo(Pedido))
      .createQueryBuilder('ped')
      .innerJoin('ped.producto', 'prod')
      .leftJoin(Resena, 'r', 'r.pedido_id = ped.id');
    const pedidos = await columnas(qb, {
      id: 'ped.id',
      cantidad: 'ped.cantidad',
      estado: 'ped.estado',
      fecha_pedido: 'ped.fecha_pedido',
      producto_id: 'ped.producto_id',
      producto_nombre: 'prod.nombre',
      tiene_resena: '(r.id IS NOT NULL)',
    })
      .where('ped.cliente_id = :clienteId', { clienteId: req.usuario_id })
      .orderBy('ped.fecha_pedido', 'DESC')
      .getRawMany();
    res.status(200).json(pedidos);
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};

// POST /api/pedidos  (compra desde la app móvil del cliente)
// Cuerpo: { producto_id, cantidad }. Valida stock, lo descuenta y crea el pedido
// dentro de una transacción para evitar condiciones de carrera.
export const crearPedido = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const producto_id = enteroPositivo(req.body?.producto_id);
  const cantidad = enteroPositivo(req.body?.cantidad);

  if (producto_id === null || cantidad === null) {
    res.status(400).json({
      mensaje: 'producto_id y una cantidad entera mayor a 0 son obligatorios.',
    });
    return;
  }

  // Resultado de la transacción: o un error de negocio, o el pedido creado.
  type Resultado = { status: 404 | 409; mensaje: string } | { status: 201; pedido: Pedido };

  try {
    // transaction(): BEGIN/COMMIT automáticos y ROLLBACK si algo lanza una excepción.
    const resultado: Resultado = await (await bd()).transaction(async (m) => {
      // Descuento ATÓMICO del stock en una sola sentencia:
      //   UPDATE productos SET stock = stock - :cantidad WHERE id = :id AND stock >= :cantidad
      // La fila queda bloqueada desde este UPDATE hasta el COMMIT, y si otra compra la cambió
      // mientras tanto PostgreSQL vuelve a evaluar la condición: nunca se vende más de lo que
      // hay. Frente al SELECT … FOR UPDATE + UPDATE anterior, el bloqueo dura una consulta
      // menos (hallazgo de rendimiento P-08 de la Fase 4).
      const descuento = await m
        .createQueryBuilder()
        .update(Producto)
        .set({ stock: () => 'stock - :cantidad' })
        .where('id = :producto_id AND stock >= :cantidad', { producto_id, cantidad })
        .execute();

      if (!descuento.affected) {
        // No se descontó: o el producto no existe, o no alcanza el stock.
        const prod = await m.findOne(Producto, { where: { id: producto_id }, select: { id: true, stock: true } });
        if (!prod) return { status: 404, mensaje: 'El producto no existe.' };
        return { status: 409, mensaje: `Stock insuficiente. Disponible: ${prod.stock}.` };
      }

      const insertado = await m
        .createQueryBuilder()
        .insert()
        .into(Pedido)
        .values({ cliente_id: req.usuario_id, producto_id, cantidad, estado: 'pendiente' })
        .returning('*')
        .execute();
      return { status: 201, pedido: insertado.raw[0] as Pedido };
    });

    if (resultado.status !== 201) {
      res.status(resultado.status).json({ mensaje: resultado.mensaje });
      return;
    }
    res.status(201).json({
      mensaje: 'Pedido creado con éxito',
      datos: resultado.pedido,
    });
    // Tras el COMMIT: si el correo falla, el pedido ya existe y no se pierde.
    notificarPedidoCreado(resultado.pedido.id);
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};
