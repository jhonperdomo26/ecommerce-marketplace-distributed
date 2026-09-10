// test/resenas.test.ts
// Reglas de negocio de POST /api/resenas: solo pedidos propios y entregados,
// una reseña por pedido.
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

async function pedidoDe(estado: string) {
  const tienda = await crearTienda();
  const cliente = await crearUsuario({ email: 'cli@test.com', rol: 'cliente' });
  const producto = await crearProducto({ tienda_id: tienda });
  const pedido = await crearPedido({
    cliente_id: cliente,
    producto_id: producto,
    estado,
  });
  const token = tokenDe({ id: cliente, rol: 'cliente', tienda_id: null });
  return { cliente, pedido, token };
}

describe('POST /api/resenas — crearResena', () => {
  it('permite calificar un pedido propio entregado (201)', async () => {
    const { pedido, token } = await pedidoDe('entregado');
    const res = await request(app)
      .post('/api/resenas')
      .set('Authorization', `Bearer ${token}`)
      .send({ pedido_id: pedido, calificacion: 4.5, comentario: 'Bien' });
    expect(res.status).toBe(201);
  });

  it('rechaza si el pedido no está entregado (409)', async () => {
    const { pedido, token } = await pedidoDe('pendiente');
    const res = await request(app)
      .post('/api/resenas')
      .set('Authorization', `Bearer ${token}`)
      .send({ pedido_id: pedido, calificacion: 5 });
    expect(res.status).toBe(409);
  });

  it('rechaza una segunda reseña sobre el mismo pedido (409)', async () => {
    const { pedido, token } = await pedidoDe('entregado');
    await request(app)
      .post('/api/resenas')
      .set('Authorization', `Bearer ${token}`)
      .send({ pedido_id: pedido, calificacion: 5 });
    const res = await request(app)
      .post('/api/resenas')
      .set('Authorization', `Bearer ${token}`)
      .send({ pedido_id: pedido, calificacion: 3 });
    expect(res.status).toBe(409);
  });

  it('rechaza calificar el pedido de otro cliente (404)', async () => {
    const { pedido } = await pedidoDe('entregado');
    const otro = await crearUsuario({ email: 'otro@test.com', rol: 'cliente' });
    const tokenOtro = tokenDe({ id: otro, rol: 'cliente', tienda_id: null });
    const res = await request(app)
      .post('/api/resenas')
      .set('Authorization', `Bearer ${tokenOtro}`)
      .send({ pedido_id: pedido, calificacion: 5 });
    expect(res.status).toBe(404);
  });

  it('rechaza una calificación fuera de rango (400)', async () => {
    const { pedido, token } = await pedidoDe('entregado');
    const res = await request(app)
      .post('/api/resenas')
      .set('Authorization', `Bearer ${token}`)
      .send({ pedido_id: pedido, calificacion: 9 });
    expect(res.status).toBe(400);
  });
});
