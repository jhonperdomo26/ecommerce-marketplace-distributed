// test/seguridad.test.ts
// Fase 4 · Módulo de seguridad. Ejecuta de forma automática los casos
// PT-SEG-04 a PT-SEG-18 del Plan de Pruebas y los mapea a OWASP Top 10 (2021).
// Cada bloque lleva el ID del caso y la categoría. Los casos de escaneo con
// OWASP ZAP (PT-SEG-01 a 03) no son automatizables en Jest y se ejecutan aparte.
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import {
  pool,
  resetDb,
  crearTienda,
  crearUsuario,
  crearProducto,
  crearPedido,
  tokenDe,
} from './helpers/fixtures';

// El límite de login (10 intentos / 15 min) se prueba en seguridad.limites.test.ts;
// aquí se sube para poder lanzar muchos payloads de inyección contra el login.
process.env.LOGIN_RATE_LIMIT = '1000';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require('../src/app');

const SECRET = process.env.JWT_SECRET as string;

beforeEach(resetDb);
afterAll(() => pool.end());

type Rol = 'cliente' | 'vendedor' | 'administrador';
type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const llamar = (m: Metodo, ruta: string, token?: string | null, body?: any): any => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r = (request(app) as any)[m](ruta);
  if (token) r = r.set('Authorization', `Bearer ${token}`);
  return body !== undefined ? r.send(body) : r;
};

async function escenario() {
  const t1 = await crearTienda('Tienda Uno');
  const t2 = await crearTienda('Tienda Dos');
  const adm = await crearUsuario({ email: 'a@t.com', rol: 'administrador', tienda_id: t1 });
  const v1 = await crearUsuario({ email: 'v1@t.com', rol: 'vendedor', tienda_id: t1 });
  const v2 = await crearUsuario({ email: 'v2@t.com', rol: 'vendedor', tienda_id: t2 });
  const c1 = await crearUsuario({ email: 'c1@t.com', rol: 'cliente' });
  const c2 = await crearUsuario({ email: 'c2@t.com', rol: 'cliente' });
  const p1 = await crearProducto({ tienda_id: t1, vendedor_id: v1, stock: 10 });
  const p2 = await crearProducto({ tienda_id: t2, vendedor_id: v2, stock: 10 });
  const pedPend = await crearPedido({ cliente_id: c1, producto_id: p1, estado: 'pendiente' });
  const pedEntr = await crearPedido({ cliente_id: c1, producto_id: p1, estado: 'entregado' });
  return {
    t1, t2, adm, v1, v2, c1, c2, p1, p2, pedPend, pedEntr,
    tok: {
      adm: tokenDe({ id: adm, rol: 'administrador', tienda_id: t1 }),
      v1: tokenDe({ id: v1, rol: 'vendedor', tienda_id: t1 }),
      v2: tokenDe({ id: v2, rol: 'vendedor', tienda_id: t2 }),
      c1: tokenDe({ id: c1, rol: 'cliente', tienda_id: null }),
      c2: tokenDe({ id: c2, rol: 'cliente', tienda_id: null }),
    },
  };
}
type Ctx = Awaited<ReturnType<typeof escenario>>;

const conteos = async () =>
  (
    await pool.query(
      `SELECT (SELECT count(*) FROM usuarios)::int AS usuarios,
              (SELECT count(*) FROM productos)::int AS productos,
              (SELECT count(*) FROM pedidos)::int AS pedidos`
    )
  ).rows[0];

// ---------------------------------------------------------------------------
// Matriz de permisos esperados (fuente: routes/*.ts)
// ---------------------------------------------------------------------------
const TODOS: Rol[] = ['cliente', 'vendedor', 'administrador'];
const MATRIZ: [Metodo, string, Rol[]][] = [
  ['get', '/api/productos', TODOS],
  ['get', '/api/productos/mios', ['vendedor']],
  ['post', '/api/productos', ['vendedor']],
  ['put', '/api/productos/1', ['vendedor']],
  ['delete', '/api/productos/1', ['vendedor']],
  ['get', '/api/pedidos/por-tienda', ['vendedor']],
  ['get', '/api/pedidos/mios', ['cliente']],
  ['post', '/api/pedidos', ['cliente']],
  ['patch', '/api/pedidos/estado', ['vendedor']],
  ['post', '/api/resenas', ['cliente']],
  ['get', '/api/resenas/producto/1', TODOS],
  ['get', '/api/resenas/mis-productos', ['vendedor']],
  ['get', '/api/admin/resumen', ['administrador']],
  ['get', '/api/admin/tiendas', ['administrador']],
  ['post', '/api/admin/tiendas', ['administrador']],
  ['get', '/api/admin/usuarios', ['administrador']],
  ['post', '/api/admin/usuarios', ['administrador']],
  ['patch', '/api/admin/usuarios/1/activo', ['administrador']],
  ['post', '/api/chat', TODOS],
];

describe('PT-SEG-04 · Acceso sin token (A01 Broken Access Control)', () => {
  it.each(MATRIZ)('%s %s sin token → 403 y sin datos', async (m, ruta) => {
    const res = await llamar(m, ruta);
    expect(res.status).toBe(403);
    expect(res.text).not.toMatch(/password|@|\$2[aby]\$/i);
  });
});

describe('PT-SEG-07 · Matriz rol × endpoint (A01 / API5 BFLA)', () => {
  const casos = MATRIZ.flatMap(([m, ruta, roles]) =>
    TODOS.map((rol) => [m, ruta, rol, roles.includes(rol)] as [Metodo, string, Rol, boolean])
  );
  it.each(casos)('%s %s como %s (permitido: %s)', async (m, ruta, rol, permitido) => {
    const { tok } = await escenario();
    const token = rol === 'cliente' ? tok.c1 : rol === 'vendedor' ? tok.v1 : tok.adm;
    const res = await llamar(m, ruta, token);
    if (permitido) {
      expect(res.status).not.toBe(401);
      expect(res.status).toBeLessThan(500);
    } else {
      expect(res.status).toBe(401);
    }
  });
});

// ---------------------------------------------------------------------------
describe('PT-SEG-05 / PT-SEG-06 · Tokens manipulados y expirados (A02 / A07)', () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const objetivo = '/api/admin/resumen';
  const admin = { id: 1, rol: 'administrador', tienda_id: 1 };

  it('firma de otro secreto → 400', async () => {
    const t = jwt.sign(admin, 'otro-secreto');
    expect((await llamar('get', objetivo, t)).status).toBe(400);
  });

  it('payload alterado (cliente → administrador) con la firma original → 400', async () => {
    const [h, , s] = jwt.sign({ id: 5, rol: 'cliente', tienda_id: null }, SECRET).split('.');
    const forjado = `${h}.${b64(admin)}.${s}`;
    expect((await llamar('get', objetivo, forjado)).status).toBe(400);
  });

  it.each(['none', 'None', 'NONE', 'nOnE'])('algoritmo "%s" sin firma → 400', async (alg) => {
    const t = `${b64({ alg, typ: 'JWT' })}.${b64(admin)}.`;
    expect((await llamar('get', objetivo, t)).status).toBe(400);
  });

  it('token expirado → 400', async () => {
    const t = jwt.sign({ ...admin, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
    expect((await llamar('get', objetivo, t)).status).toBe(400);
  });

  it('texto que no es un JWT → 400', async () => {
    expect((await llamar('get', objetivo, 'a.b.c')).status).toBe(400);
    expect((await llamar('get', objetivo, 'basura')).status).toBe(400);
  });

  it('token válido sin el campo rol → 401 (no concede ningún permiso)', async () => {
    const t = jwt.sign({ id: 1, tienda_id: 1 }, SECRET);
    expect((await llamar('get', objetivo, t)).status).toBe(401);
  });

  it('endurecimiento: token firmado con HS512 (algoritmo no previsto) → 400', async () => {
    const t = jwt.sign(admin, SECRET, { algorithm: 'HS512' });
    expect((await llamar('get', objetivo, t)).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('PT-SEG-08 / PT-SEG-09 · IDOR entre tiendas y clientes (A01 / API1 BOLA)', () => {
  it('vendedor de otra tienda no cambia el estado de un pedido ajeno (403) y el estado queda intacto', async () => {
    const c = await escenario();
    const res = await llamar('patch', '/api/pedidos/estado', c.tok.v2, {
      pedido_id: c.pedPend,
      estado: 'cancelado',
    });
    expect(res.status).toBe(403);
    const q = await pool.query('SELECT estado FROM pedidos WHERE id = $1', [c.pedPend]);
    expect(q.rows[0].estado).toBe('pendiente');
  });

  it('vendedor de otra tienda no edita (PUT) un producto ajeno (403) y queda intacto', async () => {
    const c = await escenario();
    const res = await llamar('put', `/api/productos/${c.p1}`, c.tok.v2, { precio: 1, stock: 0 });
    expect(res.status).toBe(403);
    const q = await pool.query('SELECT precio, stock FROM productos WHERE id = $1', [c.p1]);
    expect(Number(q.rows[0].precio)).toBe(1000);
    expect(q.rows[0].stock).toBe(10);
  });

  it('vendedor de otra tienda no elimina (DELETE) un producto ajeno (403) y sigue existiendo', async () => {
    const c = await escenario();
    expect((await llamar('delete', `/api/productos/${c.p1}`, c.tok.v2)).status).toBe(403);
    const q = await pool.query('SELECT 1 FROM productos WHERE id = $1', [c.p1]);
    expect(q.rowCount).toBe(1);
  });

  it('el panel de un vendedor solo lista pedidos de su tienda', async () => {
    const c = await escenario();
    await crearPedido({ cliente_id: c.c2, producto_id: c.p2 });
    const res = await llamar('get', '/api/pedidos/por-tienda', c.tok.v1);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2); // solo los 2 de la tienda 1
  });

  it('un cliente no puede reseñar el pedido de otro cliente (404) ni se crea la reseña', async () => {
    const c = await escenario();
    const res = await llamar('post', '/api/resenas', c.tok.c2, {
      pedido_id: c.pedEntr,
      calificacion: 5,
    });
    expect(res.status).toBe(404);
    expect((await pool.query('SELECT 1 FROM resenas')).rowCount).toBe(0);
  });

  it('un cliente solo ve sus propios pedidos', async () => {
    const c = await escenario();
    const res = await llamar('get', '/api/pedidos/mios', c.tok.c2);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
const PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE usuarios; --",
  '1; DELETE FROM productos',
  "' UNION SELECT password_hash FROM usuarios --",
  '1 OR 1=1',
  '%',
  '\\',
  'a\u0000b',
];

describe('PT-SEG-10 · Inyección SQL y caracteres especiales (A03 Injection)', () => {
  it('login: ningún payload autentica ni produce 500', async () => {
    await escenario();
    const malos: string[] = [];
    for (const p of PAYLOADS) {
      for (const cuerpo of [
        { email: p, password: 'x' },
        { email: 'v1@t.com', password: p },
      ]) {
        const r = await llamar('post', '/api/auth/login', null, cuerpo);
        if (![400, 401, 429].includes(r.status)) malos.push(`${JSON.stringify(cuerpo)} → ${r.status}`);
      }
    }
    expect(malos).toEqual([]);
  });

  it('parámetros de consulta y de ruta: respuesta 400 (no 500) con payloads', async () => {
    const c = await escenario();
    const malos: string[] = [];
    for (const p of PAYLOADS) {
      const e = encodeURIComponent(p);
      const intentos: [Metodo, string, string][] = [
        ['get', `/api/productos?tienda_id=${e}`, c.tok.c1],
        ['get', `/api/resenas/producto/${e}`, c.tok.c1],
        ['put', `/api/productos/${e}`, c.tok.v1],
        ['delete', `/api/productos/${e}`, c.tok.v1],
        ['patch', `/api/admin/usuarios/${e}/activo`, c.tok.adm],
      ];
      for (const [m, ruta, tok] of intentos) {
        const r = await llamar(m, ruta, tok, m === 'patch' ? { activo: false } : undefined);
        if (r.status !== 400) malos.push(`${m.toUpperCase()} ${ruta} → ${r.status}`);
      }
    }
    expect(malos).toEqual([]);
  });

  it('campos del cuerpo: se tratan como texto literal, sin 500 y sin alterar las tablas', async () => {
    const c = await escenario();
    const antes = await conteos();
    const malos: string[] = [];
    let creados = 0;
    for (const [i, p] of PAYLOADS.entries()) {
      const r = await llamar('post', '/api/productos', c.tok.v1, {
        nombre: p,
        sku: `S-${i}`,
        precio: 10,
        stock: 1,
      });
      if (r.status === 201) creados++;
      else if (r.status !== 400) malos.push(`POST /productos nombre=${JSON.stringify(p)} → ${r.status}`);

      const e = await llamar('patch', '/api/pedidos/estado', c.tok.v1, {
        pedido_id: c.pedPend,
        estado: p,
      });
      if (e.status !== 400) malos.push(`PATCH estado=${JSON.stringify(p)} → ${e.status}`);

      const pe = await llamar('post', '/api/pedidos', c.tok.c1, { producto_id: p, cantidad: 1 });
      if (pe.status !== 400) malos.push(`POST pedidos producto_id=${JSON.stringify(p)} → ${pe.status}`);

      const ch = await llamar('post', '/api/chat', c.tok.c1, { mensaje: `precio de ${p}` });
      if (ch.status !== 200) malos.push(`POST chat ${JSON.stringify(p)} → ${ch.status}`);
    }
    expect(malos).toEqual([]);
    const despues = await conteos();
    expect(despues.usuarios).toBe(antes.usuarios);
    expect(despues.pedidos).toBe(antes.pedidos);
    expect(despues.productos).toBe(antes.productos + creados);
  });
});

describe('PT-SEG-11 · XSS almacenado (A03 Injection)', () => {
  const XSS = '<script>alert(1)</script><img src=x onerror=alert(2)>';

  it('el API devuelve el texto como JSON inerte con nosniff', async () => {
    const c = await escenario();
    const crear = await llamar('post', '/api/productos', c.tok.v1, {
      nombre: XSS,
      sku: 'XSS-1',
      precio: 10,
      stock: 1,
    });
    expect(crear.status).toBe(201);
    const res = await llamar('get', '/api/productos', c.tok.c1);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.body.some((p: { nombre: string }) => p.nombre === XSS)).toBe(true);
  });

  it('el comentario de una reseña con HTML se guarda y se devuelve como JSON', async () => {
    const c = await escenario();
    const r = await llamar('post', '/api/resenas', c.tok.c1, {
      pedido_id: c.pedEntr,
      calificacion: 4,
      comentario: XSS,
    });
    expect(r.status).toBe(201);
    const lista = await llamar('get', `/api/resenas/producto/${c.p1}`, c.tok.c1);
    expect(lista.headers['content-type']).toMatch(/application\/json/);
    expect(lista.body[0].comentario).toBe(XSS);
  });

  it('el frontend no usa APIs que inyecten HTML sin escapar', () => {
    const raiz = path.resolve(__dirname, '..', '..', 'frontend', 'src');
    const archivos: string[] = [];
    const recorrer = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (/\.(jsx?|tsx?)$/.test(e.name)) archivos.push(p);
      }
    };
    recorrer(raiz);
    expect(archivos.length).toBeGreaterThan(0);
    const peligrosos = /dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write|\beval\(/;
    const hallados = archivos.filter((f) => peligrosos.test(fs.readFileSync(f, 'utf8')));
    expect(hallados).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('PT-SEG-12 · Errores sin fuga de información (A05 / A09)', () => {
  const FUGA =
    /node_modules|SyntaxError|\bat\s+\S+\s+\(|SQLSTATE|violates|relation "|column "|duplicate key|invalid input syntax|body-parser|express|<pre>|errno|stack/i;

  const casos: [string, (c: Ctx) => Promise<{ status: number; text: string }>][] = [
    ['JSON malformado', async () =>
      request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ')],
    ['cuerpo mayor a 100 kb', async () =>
      request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(200_000) })],
    ['ruta inexistente', async () => request(app).get('/api/no-existe')],
    ['método no soportado', async () => request(app).delete('/api/auth/login')],
    ['content-type de formulario', async () =>
      request(app).post('/api/auth/login').type('form').send('email=a&password=b')],
    ['SKU de 25 caracteres', async (c) =>
      llamar('post', '/api/productos', c.tok.v1, { nombre: 'x', sku: 'S'.repeat(25), precio: 1 })],
    ['estado fuera del catálogo', async (c) =>
      llamar('patch', '/api/pedidos/estado', c.tok.v1, { pedido_id: c.pedPend, estado: 'inventado' })],
    ['id no numérico', async (c) => llamar('get', '/api/resenas/producto/abc', c.tok.c1)],
    ['pedido de un producto inexistente', async (c) =>
      llamar('post', '/api/pedidos', c.tok.c1, { producto_id: 99999, cantidad: 1 })],
    ['SKU duplicado', async (c) =>
      llamar('post', '/api/productos', c.tok.v1, { nombre: 'x', sku: 'DUP', precio: 1 })
        .then(() => llamar('post', '/api/productos', c.tok.v1, { nombre: 'x', sku: 'DUP', precio: 1 }))],
  ];

  it.each(casos)('%s: 4xx genérico, sin trazas ni SQL', async (_n, fn) => {
    const c = await escenario();
    const res = await fn(c);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.text).not.toMatch(FUGA);
  });
});

describe('PT-SEG-13 · CORS (A05 / API8)', () => {
  const PERMITIDO = process.env.CORS_ORIGIN || 'http://localhost:5173';

  it('un origen no autorizado no recibe Access-Control-Allow-Origin a su favor', async () => {
    const res = await request(app).get('/').set('Origin', 'http://evil.example');
    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example');
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('la solicitud preflight de un origen no autorizado no se aprueba', async () => {
    const res = await request(app)
      .options('/api/pedidos')
      .set('Origin', 'http://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example');
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('el origen configurado sí es aceptado', async () => {
    const res = await request(app).get('/').set('Origin', PERMITIDO);
    expect(res.headers['access-control-allow-origin']).toBe(PERMITIDO);
  });
});

describe('PT-SEG-14 · Cabeceras de seguridad (A05 / API8)', () => {
  const respuestas: [string, () => Promise<request.Response>][] = [
    ['200 (sonda)', () => request(app).get('/')],
    ['404 (ruta inexistente)', () => request(app).get('/api/no-existe')],
    ['403 (sin token)', () => request(app).get('/api/productos')],
    ['400 (JSON malformado)', () =>
      request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{')],
  ];
  it.each(respuestas)('respuesta %s incluye las cabeceras de endurecimiento', async (_n, fn) => {
    const h = (await fn()).headers;
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBeDefined();
    expect(h['content-security-policy']).toBeDefined();
    expect(h['referrer-policy']).toBeDefined();
    expect(h['x-powered-by']).toBeUndefined();
  });

  it('las respuestas autenticadas del API no se almacenan en caché', async () => {
    const c = await escenario();
    const res = await llamar('get', '/api/productos', c.tok.c1);
    expect(res.headers['cache-control']).toMatch(/no-store/);
  });
});

// ---------------------------------------------------------------------------
describe('PT-SEG-16 / PT-SEG-18 · Contraseñas y datos sensibles (A02 / API3 BOPLA)', () => {
  it('las contraseñas se guardan con bcrypt (coste ≥ 10) y nunca en claro', async () => {
    const c = await escenario();
    await llamar('post', '/api/auth/registro', null, {
      nombre: 'Nueva Clienta',
      email: 'nueva@t.com',
      password: 'ClaveSegura123',
    });
    await llamar('post', '/api/admin/usuarios', c.tok.adm, {
      nombre: 'Nuevo Vendedor',
      email: 'nv@t.com',
      password: 'ClaveSegura456',
      rol: 'vendedor',
      tienda_id: c.t1,
    });
    const q = await pool.query(
      "SELECT email, password_hash FROM usuarios WHERE email IN ('nueva@t.com','nv@t.com')"
    );
    expect(q.rowCount).toBe(2);
    for (const f of q.rows) {
      expect(f.password_hash).toMatch(/^\$2[aby]\$(\d\d)\$/);
      expect(Number(f.password_hash.slice(4, 6))).toBeGreaterThanOrEqual(10);
      expect(f.password_hash).not.toContain('ClaveSegura');
    }
  });

  it('ninguna respuesta del API expone password_hash', async () => {
    const c = await escenario();
    const respuestas = [
      await llamar('post', '/api/auth/login', null, { email: 'v1@t.com', password: 'Password123' }),
      await llamar('post', '/api/auth/registro', null, { nombre: 'Z', email: 'z@t.com', password: 'ClaveSegura1' }),
      await llamar('get', '/api/admin/usuarios', c.tok.adm),
      await llamar('get', '/api/pedidos/por-tienda', c.tok.v1),
      await llamar('get', '/api/productos/mios', c.tok.v1),
    ];
    for (const r of respuestas) {
      expect(r.status).toBeLessThan(400);
      expect(r.text).not.toMatch(/password|\$2[aby]\$/i);
    }
  });

  it('las reseñas públicas no exponen el correo del cliente', async () => {
    const c = await escenario();
    await pool.query("INSERT INTO resenas (pedido_id, calificacion, comentario) VALUES ($1, 5, 'ok')", [c.pedEntr]);
    const res = await llamar('get', `/api/resenas/producto/${c.p1}`, c.tok.c2);
    expect(res.status).toBe(200);
    expect(res.text).not.toMatch(/@/);
  });
});

describe('PT-SEG-17 · Secreto JWT (A02 / A05)', () => {
  const cargarConfig = (env: Record<string, string | undefined>) => {
    const previo = { ...process.env };
    try {
      for (const [k, v] of Object.entries(env)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      let resultado: unknown;
      jest.isolateModules(() => {
        resultado = require('../src/config');
      });
      return resultado as { JWT_SECRET: string };
    } finally {
      process.env = previo;
    }
  };

  it('en producción, sin JWT_SECRET la aplicación no arranca', () => {
    expect(() => cargarConfig({ NODE_ENV: 'production', JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
  });

  it('en producción se rechaza el secreto por defecto del repositorio', () => {
    expect(() =>
      cargarConfig({ NODE_ENV: 'production', JWT_SECRET: 'FirmaSecretaPlataforma' })
    ).toThrow(/JWT_SECRET/);
  });

  it('en producción se rechazan secretos cortos (< 32 caracteres)', () => {
    expect(() => cargarConfig({ NODE_ENV: 'production', JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('en producción un secreto aleatorio largo se acepta', () => {
    const s = 'k'.repeat(48);
    expect(cargarConfig({ NODE_ENV: 'production', JWT_SECRET: s }).JWT_SECRET).toBe(s);
  });

  it('un token firmado con el secreto por defecto del repositorio no entra', async () => {
    const t = jwt.sign({ id: 1, rol: 'administrador', tienda_id: 1 }, 'FirmaSecretaPlataforma');
    expect((await llamar('get', '/api/admin/resumen', t)).status).toBe(400);
  });

  it('.env.example no publica el mismo secreto que usa el código como valor por defecto', () => {
    const env = fs.readFileSync(path.resolve(__dirname, '..', '.env.example'), 'utf8');
    const linea = env.split('\n').find((l) => l.startsWith('JWT_SECRET='));
    expect(linea).toBeDefined();
    expect(linea).not.toContain('FirmaSecretaPlataforma');
  });
});

// ---------------------------------------------------------------------------
describe('A04 · Diseño inseguro: lógica de negocio', () => {
  it('30 compras simultáneas sobre stock 10 → exactamente 10 pedidos, sin sobreventa', async () => {
    const c = await escenario();
    const p = await crearProducto({ tienda_id: c.t1, stock: 10, sku: 'RACE-1' });
    const rs = await Promise.all(
      Array.from({ length: 30 }, () =>
        llamar('post', '/api/pedidos', c.tok.c1, { producto_id: p, cantidad: 1 })
      )
    );
    expect(rs.filter((r) => r.status === 201)).toHaveLength(10);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(20);
    expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
    const stock = await pool.query('SELECT stock FROM productos WHERE id = $1', [p]);
    expect(stock.rows[0].stock).toBe(0);
    const suma = await pool.query('SELECT COALESCE(SUM(cantidad),0)::int AS s FROM pedidos WHERE producto_id = $1', [p]);
    expect(suma.rows[0].s).toBe(10);
  });

  it('PATCH de estado sin el campo estado no deja el pedido con estado NULL', async () => {
    const c = await escenario();
    const res = await llamar('patch', '/api/pedidos/estado', c.tok.v1, { pedido_id: c.pedPend });
    expect(res.status).toBe(400);
    const q = await pool.query('SELECT estado FROM pedidos WHERE id = $1', [c.pedPend]);
    expect(q.rows[0].estado).toBe('pendiente');
  });
});

describe('A08 · Asignación masiva (mass assignment)', () => {
  it('el registro público ignora rol, tienda_id y activo enviados por el cliente', async () => {
    const c = await escenario();
    const res = await llamar('post', '/api/auth/registro', null, {
      nombre: 'Intruso',
      email: 'intruso@t.com',
      password: 'ClaveSegura123',
      rol: 'administrador',
      tienda_id: c.t1,
      activo: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.usuario.rol).toBe('cliente');
    const q = await pool.query("SELECT rol, tienda_id, activo FROM usuarios WHERE email = 'intruso@t.com'");
    expect(q.rows[0]).toEqual({ rol: 'cliente', tienda_id: null, activo: true });
  });

  it('PUT de producto ignora tienda_id y vendedor_id del cuerpo', async () => {
    const c = await escenario();
    const res = await llamar('put', `/api/productos/${c.p1}`, c.tok.v1, {
      precio: 2000,
      tienda_id: c.t2,
      vendedor_id: c.v2,
    });
    expect(res.status).toBe(200);
    const q = await pool.query('SELECT tienda_id, vendedor_id FROM productos WHERE id = $1', [c.p1]);
    expect(q.rows[0]).toEqual({ tienda_id: c.t1, vendedor_id: c.v1 });
  });
});

// ---------------------------------------------------------------------------
describe('A03 / A04 · Validación de entradas: datos inválidos → 400 (nunca 500)', () => {
  const peticion = (m: Metodo, ruta: (c: Ctx) => string, rol: 'c1' | 'v1' | 'adm', cuerpo: (c: Ctx) => unknown) =>
    (c: Ctx) => llamar(m, ruta(c), c.tok[rol], cuerpo(c));

  const casos: [string, (c: Ctx) => Promise<{ status: number }>][] = [
    // Pedidos
    ['POST /pedidos · producto_id de texto', peticion('post', () => '/api/pedidos', 'c1', () => ({ producto_id: 'abc', cantidad: 1 }))],
    ['POST /pedidos · cantidad de texto', peticion('post', () => '/api/pedidos', 'c1', (c) => ({ producto_id: c.p1, cantidad: 'abc' }))],
    ['POST /pedidos · cantidad decimal', peticion('post', () => '/api/pedidos', 'c1', (c) => ({ producto_id: c.p1, cantidad: 1.5 }))],
    ['POST /pedidos · cantidad gigante', peticion('post', () => '/api/pedidos', 'c1', (c) => ({ producto_id: c.p1, cantidad: 1e12 }))],
    ['POST /pedidos · cantidad negativa', peticion('post', () => '/api/pedidos', 'c1', (c) => ({ producto_id: c.p1, cantidad: -3 }))],
    ['POST /pedidos · cantidad como arreglo', peticion('post', () => '/api/pedidos', 'c1', (c) => ({ producto_id: c.p1, cantidad: [1] }))],
    ['POST /pedidos · producto_id como objeto', peticion('post', () => '/api/pedidos', 'c1', () => ({ producto_id: {}, cantidad: 1 }))],
    // Cambio de estado
    ['PATCH /pedidos/estado · estado fuera del catálogo', peticion('patch', () => '/api/pedidos/estado', 'v1', (c) => ({ pedido_id: c.pedPend, estado: 'inventado' }))],
    ['PATCH /pedidos/estado · pedido_id de texto', peticion('patch', () => '/api/pedidos/estado', 'v1', () => ({ pedido_id: 'abc', estado: 'enviado' }))],
    ['PATCH /pedidos/estado · estado como número', peticion('patch', () => '/api/pedidos/estado', 'v1', (c) => ({ pedido_id: c.pedPend, estado: 5 }))],
    // Productos
    ['POST /productos · precio de texto', peticion('post', () => '/api/productos', 'v1', () => ({ nombre: 'x', sku: 'A1', precio: 'abc' }))],
    ['POST /productos · precio fuera de rango', peticion('post', () => '/api/productos', 'v1', () => ({ nombre: 'x', sku: 'A2', precio: 1e12 }))],
    ['POST /productos · stock decimal', peticion('post', () => '/api/productos', 'v1', () => ({ nombre: 'x', sku: 'A3', precio: 1, stock: 1.5 }))],
    ['POST /productos · stock de texto', peticion('post', () => '/api/productos', 'v1', () => ({ nombre: 'x', sku: 'A4', precio: 1, stock: 'x' }))],
    ['POST /productos · nombre numérico', peticion('post', () => '/api/productos', 'v1', () => ({ nombre: 123, sku: 'A5', precio: 1 }))],
    ['POST /productos · nombre de solo espacios', peticion('post', () => '/api/productos', 'v1', () => ({ nombre: '   ', sku: 'A6', precio: 1 }))],
    ['POST /productos · nombre con byte nulo', peticion('post', () => '/api/productos', 'v1', () => ({ nombre: 'a\u0000b', sku: 'A7', precio: 1 }))],
    ['PUT /productos/:id · precio negativo', peticion('put', (c) => `/api/productos/${c.p1}`, 'v1', () => ({ precio: -5 }))],
    ['PUT /productos/:id · stock de texto', peticion('put', (c) => `/api/productos/${c.p1}`, 'v1', () => ({ stock: 'x' }))],
    ['PUT /productos/:id · id de texto', peticion('put', () => '/api/productos/abc', 'v1', () => ({ precio: 5 }))],
    ['DELETE /productos/:id · id de texto', peticion('delete', () => '/api/productos/abc', 'v1', () => undefined)],
    ['GET /productos · tienda_id de texto', peticion('get', () => '/api/productos?tienda_id=abc', 'c1', () => undefined)],
    // Reseñas
    ['POST /resenas · calificación de texto', peticion('post', () => '/api/resenas', 'c1', (c) => ({ pedido_id: c.pedEntr, calificacion: 'abc' }))],
    ['POST /resenas · comentario de 301 caracteres', peticion('post', () => '/api/resenas', 'c1', (c) => ({ pedido_id: c.pedEntr, calificacion: 4, comentario: 'x'.repeat(301) }))],
    ['POST /resenas · pedido_id de texto', peticion('post', () => '/api/resenas', 'c1', () => ({ pedido_id: 'abc', calificacion: 4 }))],
    ['GET /resenas/producto/:id · id de texto', peticion('get', () => '/api/resenas/producto/abc', 'c1', () => undefined)],
    // Autenticación
    ['POST /auth/login · contraseña numérica', () => llamar('post', '/api/auth/login', null, { email: 'v1@t.com', password: 123456 })],
    ['POST /auth/login · email como objeto', () => llamar('post', '/api/auth/login', null, { email: { $ne: '' }, password: 'x' })],
    ['POST /auth/registro · nombre de 101 caracteres', () => llamar('post', '/api/auth/registro', null, { nombre: 'n'.repeat(101), email: 'r1@t.com', password: 'ClaveSegura1' })],
    ['POST /auth/registro · email sin formato válido', () => llamar('post', '/api/auth/registro', null, { nombre: 'R', email: 'no-es-un-correo', password: 'ClaveSegura1' })],
    ['POST /auth/registro · email de 151 caracteres', () => llamar('post', '/api/auth/registro', null, { nombre: 'R', email: `${'e'.repeat(145)}@t.com`, password: 'ClaveSegura1' })],
    // Administración
    ['POST /admin/tiendas · nombre de 101 caracteres', peticion('post', () => '/api/admin/tiendas', 'adm', () => ({ nombre: 'n'.repeat(101) }))],
    ['POST /admin/usuarios · tienda_id de texto', peticion('post', () => '/api/admin/usuarios', 'adm', () => ({ nombre: 'U', email: 'u@t.com', password: 'ClaveSegura1', rol: 'vendedor', tienda_id: 'abc' }))],
    ['POST /admin/usuarios · contraseña de 1 carácter', peticion('post', () => '/api/admin/usuarios', 'adm', (c) => ({ nombre: 'U', email: 'u@t.com', password: '1', rol: 'vendedor', tienda_id: c.t1 }))],
    ['POST /admin/usuarios · email sin formato válido', peticion('post', () => '/api/admin/usuarios', 'adm', (c) => ({ nombre: 'U', email: 'x', password: 'ClaveSegura1', rol: 'vendedor', tienda_id: c.t1 }))],
    ['PATCH /admin/usuarios/:id/activo · id de texto', peticion('patch', () => '/api/admin/usuarios/abc/activo', 'adm', () => ({ activo: false }))],
  ];

  it.each(casos)('%s → 400', async (_n, fn) => {
    const c = await escenario();
    const res = await fn(c);
    expect(res.status).toBe(400);
  });
});
