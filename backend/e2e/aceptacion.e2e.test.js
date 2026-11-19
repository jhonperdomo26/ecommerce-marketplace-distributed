// Suite de aceptación End-to-End (Fase 5).
//
// Recorre los flujos de negocio completos por HTTP contra un despliegue real, tal como los usaría
// una persona: cliente, vendedor y administrador. No toca el código ni la base directamente.
//
//   BASE_URL=http://localhost:8080 E2E_WEB=1 npm run test:e2e     # despliegue con nginx (docker compose)
//   BASE_URL=http://localhost:3000 npm run test:e2e               # API directa
//
// Requisitos del entorno bajo prueba:
//  - Base con la semilla del repositorio (usuarios *@tutienda.com y cliente@correo.com, clave Password123).
//  - LOGIN_RATE_LIMIT >= 30 si se repite la suite varias veces en menos de 15 min (cada ejecución hace
//    7 inicios de sesión y el límite por defecto es 10 por IP cada 15 min).
//  - Es un entorno de PRUEBAS: la suite deja datos creados (productos, pedidos y usuarios "E2E").
//
// E2E_WEB=1 añade las comprobaciones de la página web servida por nginx (SPA y reenvío de /api).
// MAILPIT_URL=http://mailpit:8025 añade la comprobación de los correos de notificación.

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const WEB = process.env.E2E_WEB === '1';
// Bandeja de Mailpit (solo dentro de docker compose): comprueba que los correos llegaron.
const MAILPIT = (process.env.MAILPIT_URL || '').replace(/\/$/, '');
// Contraseña de los usuarios de la semilla (cámbiela con E2E_CLAVE si se cambió en el despliegue).
const CLAVE = process.env.E2E_CLAVE || 'Password123';
const SUFIJO = Date.now().toString(36);

async function http(metodo, ruta, { token, cuerpo } = {}) {
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: {
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* la respuesta no era JSON (p. ej. la página HTML de la web) */
  }
  return { status: res.status, json, texto, headers: res.headers };
}

async function login(email, password = CLAVE) {
  const r = await http('POST', '/api/auth/login', { cuerpo: { email, password } });
  if (r.status === 429) {
    throw new Error(
      'El límite de intentos de login (429) bloqueó la suite: reinicia la API o sube LOGIN_RATE_LIMIT.'
    );
  }
  return r;
}

// Estado compartido entre los pasos (cada flujo depende del anterior, como en un recorrido real).
const ctx = {};

describe('CA-01 · Despliegue disponible', () => {
  test('la API responde y exige autenticación', async () => {
    const r = await http('GET', '/api/productos');
    expect(r.status).toBe(403);
    expect(r.json).toHaveProperty('mensaje');
  });

  test('una ruta inexistente responde JSON 404, sin trazas del servidor', async () => {
    const r = await http('GET', '/api/no-existe');
    expect(r.status).toBe(404);
    expect(r.json).toHaveProperty('mensaje');
    expect(r.texto).not.toMatch(/at .*\.(ts|js):\d+/);
  });

  (WEB ? test : test.skip)('la web sirve la aplicación (SPA) y sus rutas internas', async () => {
    for (const ruta of ['/', '/login', '/productos']) {
      const r = await http('GET', ruta);
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toMatch(/text\/html/);
      expect(r.texto).toMatch(/id="root"/);
    }
  });

  (WEB ? test : test.skip)('la tienda del cliente (Flutter web) se sirve en /app/', async () => {
    const r = await http('GET', '/app/');
    expect(r.status).toBe(200);
    expect(r.texto).toMatch(/flutter_bootstrap\.js/);
    expect(r.texto).toMatch(/<base href="\/app\/">/);
    const js = await http('GET', '/app/main.dart.js');
    expect(js.status).toBe(200);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  });

  (WEB ? test : test.skip)('la web reenvía /api a la API y añade cabeceras de seguridad', async () => {
    const r = await http('GET', '/api/productos');
    expect(r.status).toBe(403);
    expect(r.json).toHaveProperty('mensaje');
    const home = await http('GET', '/');
    expect(home.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('CA-02 · Inicio de sesión por rol', () => {
  test.each([
    ['admin@tutienda.com', 'administrador'],
    ['vendedor1@tutienda.com', 'vendedor'],
    ['vendedor2@tutienda.com', 'vendedor'],
    ['cliente@correo.com', 'cliente'],
  ])('%s entra como %s', async (email, rol) => {
    const r = await login(email);
    expect(r.status).toBe(200);
    expect(r.json.token).toEqual(expect.any(String));
    expect(r.json.usuario.rol).toBe(rol);
    expect(JSON.stringify(r.json)).not.toMatch(/password/i);
    ctx[email] = r.json;
  });

  test('una contraseña incorrecta se rechaza', async () => {
    const r = await login('vendedor1@tutienda.com', 'ClaveIncorrecta1');
    expect(r.status).toBe(401);
  });

  test('las respuestas de la API no se guardan en caché y no revelan la tecnología', async () => {
    const r = await http('GET', '/api/productos', { token: ctx['cliente@correo.com'].token });
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
    expect(r.headers.get('x-powered-by')).toBeNull();
  });
});

describe('CA-03 · Vendedor gestiona su catálogo', () => {
  const tokenV1 = () => ctx['vendedor1@tutienda.com'].token;

  test('crea un producto y aparece en «mis productos»', async () => {
    const sku = `E2E-${SUFIJO}`.slice(0, 20);
    const r = await http('POST', '/api/productos', {
      token: tokenV1(),
      cuerpo: { nombre: `Producto E2E ${SUFIJO}`, sku, precio: 15000, stock: 5 },
    });
    expect(r.status).toBe(201);
    ctx.producto = r.json;
    const mios = await http('GET', '/api/productos/mios', { token: tokenV1() });
    expect(mios.status).toBe(200);
    expect(mios.json.map((p) => p.id)).toContain(r.json.id);
  });

  test('edita el producto', async () => {
    const r = await http('PUT', `/api/productos/${ctx.producto.id}`, {
      token: tokenV1(),
      cuerpo: { nombre: `Producto E2E ${SUFIJO}`, sku: ctx.producto.sku, precio: 16000, stock: 5 },
    });
    expect(r.status).toBe(200);
    expect(Number(r.json.precio)).toBe(16000);
  });

  test('rechaza datos inválidos con 400 (nunca un error 500)', async () => {
    const r = await http('POST', '/api/productos', {
      token: tokenV1(),
      cuerpo: { nombre: 'X', sku: 'Y', precio: 'gratis', stock: -3 },
    });
    expect(r.status).toBe(400);
  });
});

describe('CA-04 · Cliente se registra, compra y consulta sus pedidos', () => {
  test('registro de una cuenta nueva con inicio de sesión inmediato', async () => {
    const email = `e2e.${SUFIJO}@correo.com`;
    const r = await http('POST', '/api/auth/registro', {
      cuerpo: { nombre: 'Cliente E2E', email, password: 'ClaveSegura123' },
    });
    expect(r.status).toBe(201);
    expect(r.json.usuario.rol).toBe('cliente');
    ctx.cliente = { email, ...r.json };
  });

  test('el registro no permite elegirse un rol privilegiado', async () => {
    const r = await http('POST', '/api/auth/registro', {
      cuerpo: {
        nombre: 'Intruso',
        email: `intruso.${SUFIJO}@correo.com`,
        password: 'ClaveSegura123',
        rol: 'administrador',
        tienda_id: 1,
      },
    });
    expect(r.status).toBe(201);
    expect(r.json.usuario.rol).toBe('cliente');
  });

  test('ve el producto en el catálogo y lo compra', async () => {
    const cat = await http('GET', '/api/productos', { token: ctx.cliente.token });
    expect(cat.status).toBe(200);
    expect(cat.json.map((p) => p.id)).toContain(ctx.producto.id);

    const r = await http('POST', '/api/pedidos', {
      token: ctx.cliente.token,
      cuerpo: { producto_id: ctx.producto.id, cantidad: 2 },
    });
    expect(r.status).toBe(201);
    ctx.pedido = r.json.datos;
  });

  test('el stock baja con la compra y no se puede comprar más de lo que hay', async () => {
    const mios = await http('GET', '/api/productos/mios', {
      token: ctx['vendedor1@tutienda.com'].token,
    });
    const p = mios.json.find((x) => x.id === ctx.producto.id);
    expect(p.stock).toBe(3);

    const r = await http('POST', '/api/pedidos', {
      token: ctx.cliente.token,
      cuerpo: { producto_id: ctx.producto.id, cantidad: 4 },
    });
    expect([400, 409]).toContain(r.status);
    const despues = await http('GET', '/api/productos/mios', {
      token: ctx['vendedor1@tutienda.com'].token,
    });
    expect(despues.json.find((x) => x.id === ctx.producto.id).stock).toBe(3);
  });

  test('el pedido aparece en «mis pedidos»', async () => {
    const r = await http('GET', '/api/pedidos/mios', { token: ctx.cliente.token });
    expect(r.status).toBe(200);
    expect(r.json.map((p) => p.id)).toContain(ctx.pedido.id);
  });

  test('el asistente virtual responde sobre sus pedidos', async () => {
    const r = await http('POST', '/api/chat', {
      token: ctx.cliente.token,
      cuerpo: { mensaje: '¿Cómo va mi pedido?' },
    });
    expect(r.status).toBe(200);
    expect(r.json.respuesta).toEqual(expect.any(String));
    expect(r.json.respuesta.length).toBeGreaterThan(5);
  });
});

describe('CA-05 · Vendedor atiende el pedido y el cliente lo califica', () => {
  test('el pedido llega al vendedor de la tienda', async () => {
    const r = await http('GET', '/api/pedidos/por-tienda?limit=100', {
      token: ctx['vendedor1@tutienda.com'].token,
    });
    expect(r.status).toBe(200);
    expect(r.json.datos.map((p) => p.id)).toContain(ctx.pedido.id);
  });

  test('no se puede calificar un pedido que aún no fue entregado', async () => {
    const r = await http('POST', '/api/resenas', {
      token: ctx.cliente.token,
      cuerpo: { pedido_id: ctx.pedido.id, calificacion: 5, comentario: 'Muy bien' },
    });
    expect(r.status).toBe(409);
  });

  test('el vendedor marca el pedido como entregado', async () => {
    const r = await http('PATCH', '/api/pedidos/estado', {
      token: ctx['vendedor1@tutienda.com'].token,
      cuerpo: { pedido_id: ctx.pedido.id, estado: 'entregado' },
    });
    expect(r.status).toBe(200);
  });

  test('un estado fuera del catálogo se rechaza', async () => {
    const r = await http('PATCH', '/api/pedidos/estado', {
      token: ctx['vendedor1@tutienda.com'].token,
      cuerpo: { pedido_id: ctx.pedido.id, estado: 'volando' },
    });
    expect(r.status).toBe(400);
  });

  test('el cliente califica y el vendedor ve la reseña', async () => {
    const r = await http('POST', '/api/resenas', {
      token: ctx.cliente.token,
      cuerpo: { pedido_id: ctx.pedido.id, calificacion: 4.5, comentario: `Reseña E2E ${SUFIJO}` },
    });
    expect(r.status).toBe(201);
    const lista = await http('GET', '/api/resenas/mis-productos', {
      token: ctx['vendedor1@tutienda.com'].token,
    });
    expect(lista.status).toBe(200);
    expect(JSON.stringify(lista.json)).toContain(`Reseña E2E ${SUFIJO}`);
  });
});

describe('CA-09 · Notificaciones por correo (servicio externo)', () => {
  // Busca en Mailpit los correos enviados a una dirección, reintentando unos segundos porque
  // el envío ocurre después de responder.
  async function correosPara(email, minimo) {
    for (let intento = 0; intento < 20; intento++) {
      // En la nube Mailpit pide usuario y contraseña (MAILPIT_UI_AUTH=usuario:contraseña).
      const auth = process.env.MAILPIT_UI_AUTH
        ? { Authorization: 'Basic ' + Buffer.from(process.env.MAILPIT_UI_AUTH).toString('base64') }
        : {};
      const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + email)}`, {
        headers: auth,
      });
      const j = await r.json();
      if ((j.messages || []).length >= minimo) return j.messages;
      await new Promise((ok) => setTimeout(ok, 250));
    }
    return [];
  }

  (MAILPIT ? test : test.skip)('el cliente recibió el aviso de compra y el de entrega', async () => {
    const correos = await correosPara(ctx.cliente.email, 2);
    const asuntos = correos.map((m) => m.Subject);
    expect(asuntos).toContain(`Recibimos tu pedido #${ctx.pedido.id}`);
    expect(asuntos).toContain(`Tu pedido #${ctx.pedido.id} fue entregado`);
  });
});

describe('CA-10 · Documentación de la API', () => {
  test('la especificación OpenAPI y la página de Swagger están publicadas', async () => {
    const spec = await http('GET', '/api/openapi.json');
    expect(spec.status).toBe(200);
    expect(spec.json.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.json.paths)).toContain('/api/pedidos');
    const pagina = await http('GET', '/api/docs/');
    expect(pagina.status).toBe(200);
    expect(pagina.texto).toMatch(/swagger-ui/i);
  });
});

describe('CA-06 · Aislamiento entre tiendas y entre roles', () => {
  test('otro vendedor no puede cambiar pedidos de una tienda ajena', async () => {
    const r = await http('PATCH', '/api/pedidos/estado', {
      token: ctx['vendedor2@tutienda.com'].token,
      cuerpo: { pedido_id: ctx.pedido.id, estado: 'cancelado' },
    });
    expect([403, 404]).toContain(r.status);
    const lista = await http('GET', '/api/pedidos/por-tienda?limit=100', {
      token: ctx['vendedor2@tutienda.com'].token,
    });
    expect(lista.json.datos.map((p) => p.id)).not.toContain(ctx.pedido.id);
  });

  test('otro vendedor no puede editar ni borrar productos ajenos', async () => {
    const put = await http('PUT', `/api/productos/${ctx.producto.id}`, {
      token: ctx['vendedor2@tutienda.com'].token,
      cuerpo: { nombre: 'Robado', sku: 'ROBADO', precio: 1, stock: 1 },
    });
    expect([403, 404]).toContain(put.status);
    const del = await http('DELETE', `/api/productos/${ctx.producto.id}`, {
      token: ctx['vendedor2@tutienda.com'].token,
    });
    expect([403, 404]).toContain(del.status);
  });

  test('el cliente no accede a funciones de vendedor ni de administrador', async () => {
    for (const [metodo, ruta] of [
      ['GET', '/api/pedidos/por-tienda'],
      ['POST', '/api/productos'],
      ['GET', '/api/admin/resumen'],
      ['GET', '/api/admin/usuarios'],
    ]) {
      const r = await http(metodo, ruta, { token: ctx.cliente.token, cuerpo: metodo === 'POST' ? {} : undefined });
      expect([401, 403]).toContain(r.status);
    }
  });

  test('el vendedor no accede al panel de administración', async () => {
    const r = await http('GET', '/api/admin/resumen', { token: ctx['vendedor1@tutienda.com'].token });
    expect([401, 403]).toContain(r.status);
  });
});

describe('CA-07 · Administrador gestiona usuarios', () => {
  const tokenA = () => ctx['admin@tutienda.com'].token;

  test('consulta el resumen del sistema', async () => {
    const r = await http('GET', '/api/admin/resumen', { token: tokenA() });
    expect(r.status).toBe(200);
    expect(typeof r.json).toBe('object');
  });

  test('crea un vendedor, este inicia sesión y luego lo desactiva', async () => {
    const tiendas = await http('GET', '/api/admin/tiendas', { token: tokenA() });
    expect(tiendas.status).toBe(200);
    const tienda_id = tiendas.json[0].id;

    const email = `vendedor.e2e.${SUFIJO}@tutienda.com`;
    const crear = await http('POST', '/api/admin/usuarios', {
      token: tokenA(),
      cuerpo: { nombre: 'Vendedor E2E', email, password: 'ClaveSegura123', rol: 'vendedor', tienda_id },
    });
    expect(crear.status).toBe(201);

    const entrada = await login(email, 'ClaveSegura123');
    expect(entrada.status).toBe(200);
    const tokenNuevo = entrada.json.token;
    expect((await http('GET', '/api/productos/mios', { token: tokenNuevo })).status).toBe(200);

    const off = await http('PATCH', `/api/admin/usuarios/${crear.json.id}/activo`, {
      token: tokenA(),
      cuerpo: { activo: false },
    });
    expect(off.status).toBe(200);

    // Usuario desactivado: ni el token que ya tenía ni un nuevo inicio de sesión sirven.
    expect((await http('GET', '/api/productos/mios', { token: tokenNuevo })).status).toBe(401);
    expect((await login(email, 'ClaveSegura123')).status).toBe(401);
  });
});

describe('CA-08 · Limpieza del producto de prueba', () => {
  test('el vendedor puede eliminar un producto sin pedidos', async () => {
    const tokenV1 = ctx['vendedor1@tutienda.com'].token;
    const nuevo = await http('POST', '/api/productos', {
      token: tokenV1,
      cuerpo: { nombre: `Borrable E2E ${SUFIJO}`, sku: `DEL-${SUFIJO}`.slice(0, 20), precio: 1000, stock: 1 },
    });
    expect(nuevo.status).toBe(201);
    const del = await http('DELETE', `/api/productos/${nuevo.json.id}`, { token: tokenV1 });
    expect(del.status).toBe(200);
    const mios = await http('GET', '/api/productos/mios', { token: tokenV1 });
    expect(mios.json.map((p) => p.id)).not.toContain(nuevo.json.id);
  });
});
