// test/openapi.test.ts
// La documentación OpenAPI (Fase 2) debe coincidir con las rutas reales: cada ruta registrada
// en Express está documentada y cada ruta documentada existe. Así el Swagger no se desactualiza.
import request from 'supertest';
import { Router } from 'express';
import { app } from '../src/app';
import { openapi } from '../src/docs/openapi';
import { pool } from './helpers/fixtures';
import authRoutes from '../src/routes/auth.routes';
import pedidosRoutes from '../src/routes/pedidos.routes';
import productosRoutes from '../src/routes/productos.routes';
import resenasRoutes from '../src/routes/resenas.routes';
import adminRoutes from '../src/routes/admin.routes';
import chatRoutes from '../src/routes/chat.routes';

afterAll(() => pool.end());

// Prefijos con los que app.ts monta cada router.
const montajes: [string, Router][] = [
  ['/api/auth', authRoutes],
  ['/api/pedidos', pedidosRoutes],
  ['/api/productos', productosRoutes],
  ['/api/resenas', resenasRoutes],
  ['/api/admin', adminRoutes],
  ['/api/chat', chatRoutes],
];

function rutasExpress(): string[] {
  const rutas = ['GET /'];
  for (const [prefijo, router] of montajes) {
    for (const capa of (router as any).stack) {
      if (!capa.route) continue; // middlewares (router.use)
      const ruta = (prefijo + (capa.route.path === '/' ? '' : capa.route.path)).replace(
        /:(\w+)/g,
        '{$1}'
      );
      for (const metodo of Object.keys(capa.route.methods)) {
        rutas.push(`${metodo.toUpperCase()} ${ruta}`);
      }
    }
  }
  return rutas.sort();
}

function rutasDocumentadas(): string[] {
  const rutas: string[] = [];
  for (const [ruta, metodos] of Object.entries(openapi.paths)) {
    for (const metodo of Object.keys(metodos)) rutas.push(`${metodo.toUpperCase()} ${ruta}`);
  }
  return rutas.sort();
}

describe('Documentación OpenAPI', () => {
  test('documenta exactamente las rutas que existen', () => {
    expect(rutasDocumentadas()).toEqual(rutasExpress());
  });

  test('toda referencia a un esquema apunta a uno definido', () => {
    const texto = JSON.stringify(openapi);
    const refs = [...texto.matchAll(/#\/components\/schemas\/(\w+)/g)].map((m) => m[1]);
    for (const r of new Set(refs)) {
      expect(Object.keys(openapi.components.schemas)).toContain(r);
    }
  });

  test('se publica en /api/openapi.json y en /api/docs sin token', async () => {
    const spec = await request(app).get('/api/openapi.json');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe('3.0.3');

    const pagina = await request(app).get('/api/docs/');
    expect(pagina.status).toBe(200);
    expect(pagina.text).toMatch(/swagger-ui/i);
  });
});
