// test/pedidos.test.ts
// - actualizarEstadoPedido: incluye el caso 5.2 del manual (aislamiento entre
//   tiendas) como prueba automática permanente.
// - crearPedido: descuenta stock y rechaza cuando no alcanza.
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
} from './helpers/fixtures';

beforeEach(resetDb);
afterAll(() => pool.end());

async function escenarioDosTiendas() {
  const tienda1 = await crearTienda('Tienda 1');
  const tienda2 = await crearTienda('Tienda 2');
  const vendedor1 = await crearUsuario({
    email: 'v1@test.com',
    rol: 'vendedor',
    tienda_id: tienda1,
  });
  const vendedor2 = await crearUsuario({
    email: 'v2@test.com',
    rol: 'vendedor',
    tienda_id: tienda2,
  });
  const cliente = await crearUsuario({ email: 'cli@test.com', rol: 'cliente' });
  const producto1 = await crearProducto({
    tienda_id: tienda1,
    vendedor_id: vendedor1,
    stock: 10,
  });
  const pedido1 = await crearPedido({
    cliente_id: cliente,
    producto_id: producto1,
    cantidad: 1,
  });
  return {
    tienda1,
    tienda2,
    vendedor1,
    vendedor2,
    cliente,
    producto1,
    pedido1,
  };
}

describe('PATCH /api/pedidos/estado — actualizarEstadoPedido', () => {
  it('5.2: un vendedor de otra tienda NO puede cambiar el estado (403)', async () => {
    const e = await escenarioDosTiendas();
    const tokenV2 = tokenDe({
      id: e.vendedor2,
      rol: 'vendedor',
      tienda_id: e.tienda2,
    });

    const res = await request(app)
      .patch('/api/pedidos/estado')
      .set('Authorization', `Bearer ${tokenV2}`)
      .send({ pedido_id: e.pedido1, estado: 'enviado' });

    expect(res.status).toBe(403);

    const { rows } = await pool.query(
      'SELECT estado FROM pedidos WHERE id = $1',
      [e.pedido1]
    );
    expect(rows[0].estado).toBe('pendiente'); // no cambió
  });

  it('el vendedor de la tienda del pedido sí puede (200)', async () => {
    const e = await escenarioDosTiendas();
    const tokenV1 = tokenDe({
      id: e.vendedor1,
      rol: 'vendedor',
      tienda_id: e.tienda1,
    });

    const res = await request(app)
      .patch('/api/pedidos/estado')
      .set('Authorization', `Bearer ${tokenV1}`)
      .send({ pedido_id: e.pedido1, estado: 'enviado' });

    expect(res.status).toBe(200);
    expect(res.body.datos.estado).toBe('enviado');
  });
});

describe('POST /api/pedidos — crearPedido', () => {
  it('crea el pedido y descuenta el stock', async () => {
    const tienda = await crearTienda();
    const cliente = await crearUsuario({ email: 'cli@test.com', rol: 'cliente' });
    const producto = await crearProducto({ tienda_id: tienda, stock: 10 });
    const token = tokenDe({ id: cliente, rol: 'cliente', tienda_id: null });

    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${token}`)
      .send({ producto_id: producto, cantidad: 3 });

    expect(res.status).toBe(201);
    const { rows } = await pool.query(
      'SELECT stock FROM productos WHERE id = $1',
      [producto]
    );
    expect(rows[0].stock).toBe(7);
  });

  it('rechaza con 409 si no hay stock suficiente y no descuenta nada', async () => {
    const tienda = await crearTienda();
    const cliente = await crearUsuario({ email: 'cli@test.com', rol: 'cliente' });
    const producto = await crearProducto({ tienda_id: tienda, stock: 2 });
    const token = tokenDe({ id: cliente, rol: 'cliente', tienda_id: null });

    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${token}`)
      .send({ producto_id: producto, cantidad: 5 });

    expect(res.status).toBe(409);
    const { rows } = await pool.query(
      'SELECT stock FROM productos WHERE id = $1',
      [producto]
    );
    expect(rows[0].stock).toBe(2); // intacto (rollback)
    const pedidos = await pool.query('SELECT COUNT(*) FROM pedidos');
    expect(Number(pedidos.rows[0].count)).toBe(0);
  });
});

describe('GET /api/pedidos/por-tienda · filtros (usabilidad U-10)', () => {
  async function escenarioFiltros() {
    const tienda = await crearTienda('Tienda F');
    const vendedor = await crearUsuario({ email: 'vf@test.com', rol: 'vendedor', tienda_id: tienda });
    const ana = await crearUsuario({ nombre: 'Ana Ruiz', email: 'ana@test.com', rol: 'cliente' });
    const beto = await crearUsuario({ nombre: 'Beto Gil', email: 'beto@test.com', rol: 'cliente' });
    const producto = await crearProducto({ tienda_id: tienda, vendedor_id: vendedor, stock: 50 });
    await crearPedido({ cliente_id: ana, producto_id: producto, estado: 'pendiente' });
    await crearPedido({ cliente_id: ana, producto_id: producto, estado: 'entregado' });
    await crearPedido({ cliente_id: beto, producto_id: producto, estado: 'pendiente' });
    return tokenDe({ id: vendedor, rol: 'vendedor', tienda_id: tienda });
  }

  const pedir = (token: string, query: string) =>
    request(app).get(`/api/pedidos/por-tienda?${query}`).set('Authorization', `Bearer ${token}`);

  it('filtra por estado y el total cuenta solo los filtrados', async () => {
    const token = await escenarioFiltros();
    const res = await pedir(token, 'estado=pendiente');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.datos.every((p: any) => p.estado === 'pendiente')).toBe(true);
  });

  it('busca por nombre del cliente sin distinguir mayúsculas', async () => {
    const token = await escenarioFiltros();
    const res = await pedir(token, 'q=beto');
    expect(res.body.total).toBe(1);
    expect(res.body.datos[0].cliente_nombre).toBe('Beto Gil');
  });

  it('combina estado y texto; los comodines se buscan literalmente', async () => {
    const token = await escenarioFiltros();
    expect((await pedir(token, 'estado=entregado&q=ana')).body.total).toBe(1);
    expect((await pedir(token, 'q=%25')).body.total).toBe(0);
  });

  it('un estado fuera del catálogo responde 400', async () => {
    const token = await escenarioFiltros();
    expect((await pedir(token, 'estado=volando')).status).toBe(400);
  });
});
