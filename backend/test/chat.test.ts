// test/chat.test.ts
// Endpoint POST /api/chat con base de datos real (Supertest): autenticación,
// validación de la entrada y, sobre todo, el aislamiento entre clientes y entre
// tiendas que el asistente debe respetar igual que el resto de la API.
import request from 'supertest';
import { app } from '../src/app';
import {
  pool,
  resetDb,
  crearTienda,
  crearUsuario,
  crearProducto,
  crearPedido,
  tokenDe,
  tokenInvalido,
} from './helpers/fixtures';

beforeEach(resetDb);
afterAll(() => pool.end());

const preguntar = (token: string | null, mensaje: unknown) => {
  const req = request(app).post('/api/chat');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send({ mensaje });
};

async function escenario() {
  const t1 = await crearTienda('Tienda Uno');
  const t2 = await crearTienda('Tienda Dos');
  const v1 = await crearUsuario({ nombre: 'Vera Uno', email: 'v1@t.com', rol: 'vendedor', tienda_id: t1 });
  const v2 = await crearUsuario({ nombre: 'Víctor Dos', email: 'v2@t.com', rol: 'vendedor', tienda_id: t2 });
  const c1 = await crearUsuario({ nombre: 'Carla Cliente', email: 'c1@t.com', rol: 'cliente' });
  const c2 = await crearUsuario({ nombre: 'Camilo Cliente', email: 'c2@t.com', rol: 'cliente' });
  const adm = await crearUsuario({ nombre: 'Admin', email: 'a@t.com', rol: 'administrador', tienda_id: t1 });
  return {
    t1, t2, c1, c2,
    tokV1: tokenDe({ id: v1, rol: 'vendedor', tienda_id: t1 }),
    tokV2: tokenDe({ id: v2, rol: 'vendedor', tienda_id: t2 }),
    tokC1: tokenDe({ id: c1, rol: 'cliente', tienda_id: null }),
    tokC2: tokenDe({ id: c2, rol: 'cliente', tienda_id: null }),
    tokAdm: tokenDe({ id: adm, rol: 'administrador', tienda_id: t1 }),
  };
}

describe('POST /api/chat: autenticación y validación', () => {
  it('sin token responde 403', async () => {
    const res = await preguntar(null, 'hola');
    expect(res.status).toBe(403);
  });

  it('con token inválido responde 400', async () => {
    const res = await preguntar(tokenInvalido(), 'hola');
    expect(res.status).toBe(400);
  });

  it('mensaje vacío, ausente o que no es texto responde 400', async () => {
    const { tokC1 } = await escenario();
    expect((await preguntar(tokC1, '   ')).status).toBe(400);
    expect((await preguntar(tokC1, undefined)).status).toBe(400);
    expect((await preguntar(tokC1, { a: 1 })).status).toBe(400);
  });

  it('mensaje de más de 300 caracteres responde 400', async () => {
    const { tokC1 } = await escenario();
    const res = await preguntar(tokC1, 'a'.repeat(301));
    expect(res.status).toBe(400);
    expect(res.body.mensaje).toContain('300');
  });
});

describe('POST /api/chat: respuestas por rol', () => {
  it('saluda al cliente por su nombre y devuelve opciones', async () => {
    const { tokC1 } = await escenario();
    const res = await preguntar(tokC1, 'hola');
    expect(res.status).toBe(200);
    expect(res.body.intencion).toBe('saludo');
    expect(res.body.respuesta).toContain('Hola, Carla');
    expect(res.body.opciones.length).toBeGreaterThan(0);
  });

  it('el cliente consulta el estado de su pedido', async () => {
    const { t1, c1, tokC1 } = await escenario();
    const prod = await crearProducto({ tienda_id: t1 });
    const ped = await crearPedido({ cliente_id: c1, producto_id: prod, estado: 'enviado' });
    const res = await preguntar(tokC1, `¿cuál es el estado del pedido #${ped}?`);
    expect(res.status).toBe(200);
    expect(res.body.intencion).toBe('estado_pedido');
    expect(res.body.respuesta).toContain(`Pedido #${ped}`);
    expect(res.body.respuesta).toContain('Estado: enviado');
  });

  it('un cliente NO puede ver el pedido de otro cliente', async () => {
    const { t1, c2, tokC1 } = await escenario();
    const prod = await crearProducto({ tienda_id: t1 });
    const pedidoAjeno = await crearPedido({ cliente_id: c2, producto_id: prod, estado: 'pagado' });
    const res = await preguntar(tokC1, `estado del pedido #${pedidoAjeno}`);
    expect(res.status).toBe(200);
    expect(res.body.respuesta).toContain(`No encontré el pedido #${pedidoAjeno}`);
    expect(res.body.respuesta).not.toContain('pagado');
  });

  it('«mis pedidos» solo lista los del cliente autenticado', async () => {
    const { t1, c1, c2, tokC1 } = await escenario();
    const prod = await crearProducto({ tienda_id: t1 });
    const mio = await crearPedido({ cliente_id: c1, producto_id: prod });
    const ajeno = await crearPedido({ cliente_id: c2, producto_id: prod });
    const res = await preguntar(tokC1, 'mis pedidos');
    expect(res.body.respuesta).toContain(`#${mio}`);
    expect(res.body.respuesta).not.toContain(`#${ajeno} `);
  });

  it('busca productos sin importar tildes ni mayúsculas y con plural', async () => {
    const { t1, tokC1 } = await escenario();
    await pool.query(
      `INSERT INTO productos (nombre, sku, precio, stock, tienda_id)
       VALUES ('Teléfono Móvil', 'TEL-1', 699900, 4, $1)`,
      [t1]
    );
    const res = await preguntar(tokC1, '¿Cuánto cuestan los TELEFONOS?');
    expect(res.status).toBe(200);
    expect(res.body.intencion).toBe('buscar_producto');
    expect(res.body.respuesta).toContain('Teléfono Móvil (TEL-1): $699.900, 4 disponibles, Tienda Uno');
  });

  it('el vendedor ve el stock bajo SOLO de su tienda', async () => {
    const { t1, t2, tokV1 } = await escenario();
    await pool.query(
      `INSERT INTO productos (nombre, sku, precio, stock, tienda_id) VALUES
       ('Mío Escaso', 'M-1', 10, 2, $1),
       ('Mío Abundante', 'M-2', 10, 50, $1),
       ('Ajeno Escaso', 'A-1', 10, 1, $2)`,
      [t1, t2]
    );
    const res = await preguntar(tokV1, 'stock bajo');
    expect(res.body.intencion).toBe('stock_bajo');
    expect(res.body.respuesta).toContain('Mío Escaso');
    expect(res.body.respuesta).not.toContain('Mío Abundante');
    expect(res.body.respuesta).not.toContain('Ajeno Escaso');
  });

  it('el vendedor cuenta los pedidos por estado SOLO de su tienda', async () => {
    const { t1, t2, c1, tokV1 } = await escenario();
    const pMio = await crearProducto({ tienda_id: t1 });
    const pAjeno = await crearProducto({ tienda_id: t2 });
    await crearPedido({ cliente_id: c1, producto_id: pMio, estado: 'pendiente' });
    await crearPedido({ cliente_id: c1, producto_id: pMio, estado: 'pendiente' });
    await crearPedido({ cliente_id: c1, producto_id: pAjeno, estado: 'pendiente' });
    const res = await preguntar(tokV1, 'pedidos pendientes');
    expect(res.body.intencion).toBe('pedidos_pendientes');
    expect(res.body.respuesta).toContain('2 en total');
    expect(res.body.respuesta).toContain('• pendiente: 2');
  });

  it('el vendedor resume las reseñas de su tienda', async () => {
    const { t1, c1, tokV1 } = await escenario();
    const prod = await crearProducto({ tienda_id: t1 });
    const ped = await crearPedido({ cliente_id: c1, producto_id: prod, estado: 'entregado' });
    await pool.query(
      `INSERT INTO resenas (pedido_id, calificacion, comentario) VALUES ($1, 4.5, 'Muy bueno')`,
      [ped]
    );
    const res = await preguntar(tokV1, 'resumen de reseñas');
    expect(res.body.intencion).toBe('resumen_resenas');
    expect(res.body.respuesta).toContain('1 reseña con un promedio de 4,5 de 5');
    expect(res.body.respuesta).toContain('«Muy bueno»');
  });

  it('el administrador obtiene los conteos globales', async () => {
    const { t1, tokAdm } = await escenario();
    await crearProducto({ tienda_id: t1 });
    const res = await preguntar(tokAdm, 'resumen');
    expect(res.body.intencion).toBe('resumen_admin');
    expect(res.body.respuesta).toContain('• Tiendas: 2');
    expect(res.body.respuesta).toContain('• Usuarios: 5');
    expect(res.body.respuesta).toContain('• Productos: 1');
  });

  it('un cliente no obtiene datos de vendedor ni de administrador', async () => {
    const { t1, tokC1 } = await escenario();
    await pool.query(
      `INSERT INTO productos (nombre, sku, precio, stock, tienda_id) VALUES ('Secreto Escaso', 'S-1', 10, 1, $1)`,
      [t1]
    );
    const stock = await preguntar(tokC1, 'stock bajo');
    expect(stock.body.intencion).not.toBe('stock_bajo');
    expect(stock.body.respuesta).not.toContain('unidades o menos');
    const resumen = await preguntar(tokC1, 'resumen');
    expect(resumen.body.intencion).not.toBe('resumen_admin');
    expect(resumen.body.respuesta).not.toContain('Usuarios:');
  });
});

describe('POST /api/chat: entradas maliciosas', () => {
  it('una inyección SQL no rompe nada y las tablas siguen intactas', async () => {
    const { t1, tokC1 } = await escenario();
    await crearProducto({ tienda_id: t1 });
    const res = await preguntar(tokC1, "precio de x'; DROP TABLE productos; --");
    expect(res.status).toBe(200);
    const q = await pool.query('SELECT COUNT(*) FROM productos');
    expect(Number(q.rows[0].count)).toBe(1);
  });

  it('los comodines «%» y «_» no listan todo el catálogo', async () => {
    const { t1, tokC1 } = await escenario();
    await pool.query(
      `INSERT INTO productos (nombre, sku, precio, stock, tienda_id) VALUES ('Camisa', 'CAM-1', 10, 5, $1)`,
      [t1]
    );
    // Los signos se eliminan al normalizar; un término sin letras no filtra y
    // pide aclarar en vez de volcar datos.
    const res = await preguntar(tokC1, 'precio de %%%');
    expect(res.status).toBe(200);
    expect(res.body.respuesta).toContain('¿Qué producto buscas?');
  });

  it('el HTML del mensaje no se refleja en la respuesta', async () => {
    const { tokC1 } = await escenario();
    const res = await preguntar(tokC1, 'precio de <script>alert(1)</script>');
    expect(res.status).toBe(200);
    expect(res.body.respuesta).not.toContain('<script>');
  });
});
