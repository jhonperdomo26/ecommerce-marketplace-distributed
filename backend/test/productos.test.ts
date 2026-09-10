// test/productos.test.ts
// Catálogo y gestión de productos por el vendedor, con el aislamiento por tienda.
import request from 'supertest';
import { app } from '../src/app';
import {
  pool,
  resetDb,
  crearTienda,
  crearUsuario,
  crearProducto,
  tokenDe,
} from './helpers/fixtures';

beforeEach(resetDb);
afterAll(() => pool.end());

async function dosVendedores() {
  const t1 = await crearTienda('T1');
  const t2 = await crearTienda('T2');
  const v1 = await crearUsuario({ email: 'v1@t.com', rol: 'vendedor', tienda_id: t1 });
  const v2 = await crearUsuario({ email: 'v2@t.com', rol: 'vendedor', tienda_id: t2 });
  return {
    t1,
    t2,
    tokenV1: tokenDe({ id: v1, rol: 'vendedor', tienda_id: t1 }),
    tokenV2: tokenDe({ id: v2, rol: 'vendedor', tienda_id: t2 }),
  };
}

describe('GET /api/productos (catálogo)', () => {
  it('sin token responde 403', async () => {
    const res = await request(app).get('/api/productos');
    expect(res.status).toBe(403);
  });

  it('devuelve el catálogo con el nombre de la tienda', async () => {
    const t = await crearTienda('Mi Tienda');
    await crearProducto({ tienda_id: t });
    const cli = await crearUsuario({ email: 'c@t.com', rol: 'cliente' });
    const res = await request(app)
      .get('/api/productos')
      .set('Authorization', `Bearer ${tokenDe({ id: cli, rol: 'cliente', tienda_id: null })}`);
    expect(res.status).toBe(200);
    expect(res.body[0].tienda_nombre).toBe('Mi Tienda');
  });
});

describe('gestión de productos del vendedor', () => {
  it('crea un producto en su tienda (201)', async () => {
    const { t1, tokenV1 } = await dosVendedores();
    const res = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${tokenV1}`)
      .send({ nombre: 'Nuevo', sku: 'SKU-NUE-1', precio: 5000, stock: 3 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'Nuevo', sku: 'SKU-NUE-1', stock: 3 });
    expect(res.body.tienda_id).toBe(t1);
  });

  it('no puede editar un producto de otra tienda (403)', async () => {
    const { t1, tokenV1, tokenV2 } = await dosVendedores();
    const prodT1 = await crearProducto({ tienda_id: t1 });
    // El vendedor 2 intenta editarlo.
    const res = await request(app)
      .put(`/api/productos/${prodT1}`)
      .set('Authorization', `Bearer ${tokenV2}`)
      .send({ precio: 1 });
    expect(res.status).toBe(403);
    // control: el vendedor 1 sí puede.
    const ok = await request(app)
      .put(`/api/productos/${prodT1}`)
      .set('Authorization', `Bearer ${tokenV1}`)
      .send({ precio: 1 });
    expect(ok.status).toBe(200);
  });

  it('un SKU más largo que VARCHAR(20) responde 400, no 500', async () => {
    const { tokenV1 } = await dosVendedores();
    const res = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${tokenV1}`)
      .send({
        nombre: 'X',
        sku: 'SKU-DEMASIADO-LARGO-1234567890',
        precio: 100,
        stock: 1,
      });
    expect(res.status).toBe(400);
  });
});
