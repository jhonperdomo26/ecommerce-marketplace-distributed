// test/seguridad.autenticacion.test.ts
// Fase 4 · Seguridad. A07 Identification and Authentication Failures:
// política de contraseñas, enumeración de usuarios por tiempo de respuesta y
// vigencia del token de un usuario desactivado.
import request from 'supertest';
import bcrypt from 'bcrypt';
import { pool, resetDb, crearTienda, crearUsuario, tokenDe } from './helpers/fixtures';

process.env.LOGIN_RATE_LIMIT = '1000';
process.env.REGISTRO_RATE_LIMIT = '1000';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require('../src/app');

beforeEach(resetDb);
afterAll(() => pool.end());

const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

describe('A07 · Política de contraseñas', () => {
  const registrar = (password: string) =>
    request(app).post('/api/auth/registro').send({ nombre: 'Ana', email: `ana${Math.random()}@t.com`, password });

  it('registro: 7 caracteres → 400', async () => {
    expect((await registrar('Abc1234')).status).toBe(400);
  });
  it('registro: 8 caracteres → 201', async () => {
    expect((await registrar('Abcd1234')).status).toBe(201);
  });
  it('registro: más de 72 bytes (bcrypt solo usa los primeros 72) → 400', async () => {
    expect((await registrar('a1'.repeat(37))).status).toBe(400);
  });
  it('registro: contraseña igual al correo → 400', async () => {
    const email = 'misma.clave@t.com';
    const res = await request(app).post('/api/auth/registro').send({ nombre: 'Ana', email, password: email });
    expect(res.status).toBe(400);
  });
});

describe('A07 · Enumeración de usuarios', () => {
  it('login con correo inexistente y con contraseña errónea tardan lo mismo (±50 %)', async () => {
    await crearUsuario({ email: 'existe@t.com', rol: 'cliente', password: 'Password123' });
    // bcrypt real (coste 10) para el usuario existente: el fixture usa coste 4.
    await pool.query('UPDATE usuarios SET password_hash = $1', [await bcrypt.hash('Password123', 10)]);

    const medir = async (email: string) => {
      const t = process.hrtime.bigint();
      const r = await request(app).post('/api/auth/login').send({ email, password: 'incorrecta' });
      expect(r.status).toBe(401);
      return Number(process.hrtime.bigint() - t) / 1e6;
    };
    await medir('existe@t.com'); // calentamiento
    const existe: number[] = [];
    const noExiste: number[] = [];
    for (let i = 0; i < 5; i++) {
      existe.push(await medir('existe@t.com'));
      noExiste.push(await medir(`no-existe-${i}@t.com`));
    }
    const razon = mediana(noExiste) / mediana(existe);
    expect(razon).toBeGreaterThan(0.5);
    expect(razon).toBeLessThan(2);
  });

  it('el mensaje de error del login es idéntico para usuario inexistente, inactivo y contraseña errónea', async () => {
    await crearUsuario({ email: 'ok@t.com', rol: 'cliente' });
    await crearUsuario({ email: 'off@t.com', rol: 'cliente', activo: false });
    const cuerpos = await Promise.all(
      [
        { email: 'nadie@t.com', password: 'Password123' },
        { email: 'off@t.com', password: 'Password123' },
        { email: 'ok@t.com', password: 'mala' },
      ].map(async (b) => (await request(app).post('/api/auth/login').send(b)).body)
    );
    expect(new Set(cuerpos.map((b) => JSON.stringify(b))).size).toBe(1);
  });
});

describe('A01 / A07 · Vigencia de la sesión', () => {
  it('un usuario desactivado pierde el acceso aunque su token no haya expirado', async () => {
    const t = await crearTienda();
    const id = await crearUsuario({ email: 'v@t.com', rol: 'vendedor', tienda_id: t });
    const token = tokenDe({ id, rol: 'vendedor', tienda_id: t });

    expect((await request(app).get('/api/productos/mios').set('Authorization', `Bearer ${token}`)).status).toBe(200);
    await pool.query('UPDATE usuarios SET activo = false WHERE id = $1', [id]);
    expect((await request(app).get('/api/productos/mios').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('el rol y la tienda se toman de la base, no del token (un descenso de rol aplica de inmediato)', async () => {
    const t = await crearTienda();
    const id = await crearUsuario({ email: 'c@t.com', rol: 'cliente' });
    // Token antiguo que afirma ser administrador de un usuario que hoy es cliente.
    const token = tokenDe({ id, rol: 'administrador', tienda_id: t });
    const res = await request(app).get('/api/admin/resumen').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('A09 · Registro y monitoreo', () => {
  it.todo('registrar en el log cada login fallido y cada acceso denegado (pendiente: ver plan de mitigación)');
});
