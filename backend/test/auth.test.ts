// test/auth.test.ts
// Cubre el middleware RBAC verificarToken (Manual Técnico, Sección 3) de forma
// aislada, usando una ruta protegida real, y el endpoint de login.
import request from 'supertest';
import { app } from '../src/app';
import {
  pool,
  resetDb,
  crearTienda,
  crearUsuario,
  tokenDe,
  tokenInvalido,
} from './helpers/fixtures';

// GET /api/pedidos/por-tienda está protegido con verificarToken(['vendedor']).
const RUTA_PROTEGIDA = '/api/pedidos/por-tienda';

beforeEach(resetDb);
afterAll(() => pool.end());

describe('verificarToken (RBAC)', () => {
  it('sin token responde 403', async () => {
    const res = await request(app).get(RUTA_PROTEGIDA);
    expect(res.status).toBe(403);
  });

  it('con token inválido (otra firma) responde 400', async () => {
    const res = await request(app)
      .get(RUTA_PROTEGIDA)
      .set('Authorization', `Bearer ${tokenInvalido()}`);
    expect(res.status).toBe(400);
  });

  it('con rol no autorizado responde 401', async () => {
    const idCliente = await crearUsuario({
      email: 'c@test.com',
      rol: 'cliente',
    });
    const token = tokenDe({ id: idCliente, rol: 'cliente', tienda_id: null });
    const res = await request(app)
      .get(RUTA_PROTEGIDA)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('con rol permitido deja pasar (200)', async () => {
    const tiendaId = await crearTienda();
    const idVendedor = await crearUsuario({
      email: 'v@test.com',
      rol: 'vendedor',
      tienda_id: tiendaId,
    });
    const token = tokenDe({
      id: idVendedor,
      rol: 'vendedor',
      tienda_id: tiendaId,
    });
    const res = await request(app)
      .get(RUTA_PROTEGIDA)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // Paginado (práctica de validación y pruebas, Módulo 2 - usabilidad):
    // ya no devuelve un arreglo plano, sino { datos, total, pagina, totalPaginas }.
    expect(Array.isArray(res.body.datos)).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await crearUsuario({
      email: 'login@test.com',
      password: 'Secreta123',
      rol: 'cliente',
    });
  });

  it('credenciales correctas devuelven token y usuario', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'Secreta123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.usuario.email).toBe('login@test.com');
  });

  it('contraseña incorrecta responde 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'malas' });
    expect(res.status).toBe(401);
  });

  it('usuario inactivo responde 401', async () => {
    await crearUsuario({
      email: 'off@test.com',
      password: 'Secreta123',
      rol: 'cliente',
      activo: false,
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'off@test.com', password: 'Secreta123' });
    expect(res.status).toBe(401);
  });
});
