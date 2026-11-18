// test/seguridad.limites.test.ts
// Fase 4 · Seguridad. Límites de tasa (A04 / A07): fuerza bruta en el login
// (PT-SEG-15), alta masiva de cuentas y abuso del chat. Archivo aparte porque
// el estado del limitador vive en la instancia de la app.
import request from 'supertest';
import { pool, resetDb, crearUsuario, tokenDe } from './helpers/fixtures';

process.env.REGISTRO_RATE_LIMIT = '5';
process.env.CHAT_RATE_LIMIT = '5';
delete process.env.LOGIN_RATE_LIMIT; // valor por defecto: 10 intentos / 15 min
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require('../src/app');

beforeEach(resetDb);
afterAll(() => pool.end());

describe('PT-SEG-15 · Fuerza bruta en el login (A07)', () => {
  it('50 intentos fallidos: los 10 primeros responden 401 y el resto 429; el servicio sigue vivo', async () => {
    await crearUsuario({ email: 'victima@t.com', rol: 'cliente' });
    const estados: number[] = [];
    for (let i = 0; i < 50; i++) {
      const r = await request(app).post('/api/auth/login').send({ email: 'victima@t.com', password: `mala${i}` });
      estados.push(r.status);
    }
    expect(estados.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(estados.slice(10).every((s) => s === 429)).toBe(true);
    expect((await request(app).get('/')).status).toBe(200);
  });

  it('cambiar la cabecera X-Forwarded-For no evade el límite', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', `10.0.0.${i}`)
        .send({ email: 'victima@t.com', password: 'x' });
      expect(r.status).toBe(429); // ya agotado por la prueba anterior (misma instancia)
    }
  });

  it('incluso la contraseña correcta queda bloqueada durante la ventana (429)', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'victima@t.com', password: 'Password123' });
    expect(r.status).toBe(429);
  });
});

describe('A04 · Alta masiva de cuentas', () => {
  it('el registro público limita las altas por IP (6.º intento → 429)', async () => {
    const estados: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await request(app)
        .post('/api/auth/registro')
        .send({ nombre: 'Bot', email: `bot${i}@t.com`, password: 'ClaveSegura1' });
      estados.push(r.status);
    }
    expect(estados.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(estados[5]).toBe(429);
  });
});

describe('A04 · Abuso del asistente virtual', () => {
  it('el chat limita los mensajes por IP (6.º mensaje → 429)', async () => {
    const id = await crearUsuario({ email: 'c@t.com', rol: 'cliente' });
    const token = tokenDe({ id, rol: 'cliente', tienda_id: null });
    const estados: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await request(app).post('/api/chat').set('Authorization', `Bearer ${token}`).send({ mensaje: 'hola' });
      estados.push(r.status);
    }
    expect(estados.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(estados[5]).toBe(429);
  });
});
