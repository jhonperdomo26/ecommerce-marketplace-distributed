// src/app.ts
// Construcción de la aplicación Express (rutas + middlewares), SIN abrir el
// puerto. index.ts la importa y llama a listen(); las pruebas (Supertest) la
// importan directamente.
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import authRoutes from './routes/auth.routes';
import pedidosRoutes from './routes/pedidos.routes';
import productosRoutes from './routes/productos.routes';
import resenasRoutes from './routes/resenas.routes';
import adminRoutes from './routes/admin.routes';
import chatRoutes from './routes/chat.routes';
import { openapi } from './docs/openapi';

export const app = express();

// Cabeceras de seguridad (CSP, X-Content-Type-Options, oculta X-Powered-By,
// etc.) y origen CORS restringido al frontend conocido: hallazgos del
// escaneo OWASP ZAP de la práctica de validación y pruebas.
app.disable('x-powered-by');
// Detrás de un proxy inverso (nginx, balanceador) hay que declararlo para que el límite
// de tasa use la IP real del cliente y no la del proxy. TRUST_PROXY=1 (nº de saltos).
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  })
);
app.use(express.json({ limit: '100kb' }));

// Las respuestas del API llevan datos de sesión y de negocio: no deben guardarse en cachés
// compartidas ni del navegador (A04/A05).
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Límite de intentos en el login (mitiga fuerza bruta de credenciales):
// 10 intentos cada 15 min por IP, hallazgo de la práctica de validación y
// pruebas (10 intentos fallidos consecutivos no eran bloqueados).
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos. Intenta de nuevo más tarde.' },
});
app.use('/api/auth/login', limitadorLogin);

// Alta de cuentas: sin límite, un script crea miles de usuarios y llena la tabla (y
// consume CPU con bcrypt). 20 altas por hora y por IP salvo que se configure otro valor.
const limitadorRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.REGISTRO_RATE_LIMIT) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiados registros desde esta dirección. Intenta más tarde.' },
});
app.use('/api/auth/registro', limitadorRegistro);

// Sonda de salud
app.get('/', (_req, res) => {
  res.json({ servicio: 'API Comercio Electrónico', estado: 'ok' });
});

// Documentación de la API (OpenAPI 3): página interactiva y especificación en JSON.
// API_DOCS=0 la desactiva (por ejemplo, si no se quiere publicar en producción).
if (process.env.API_DOCS !== '0') {
  app.get('/api/openapi.json', (_req, res) => {
    res.json(openapi);
  });
  // Misma CSP de helmet pero sin upgrade-insecure-requests: con ella el navegador pediría los
  // scripts de la página por https y la documentación no cargaría en un despliegue por http.
  app.use('/api/docs', (_req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';" +
        "frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';" +
        "script-src-attr 'none';style-src 'self' https: 'unsafe-inline'"
    );
    next();
  });
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openapi, {
      customSiteTitle: 'API Comercio Electrónico',
      swaggerOptions: { persistAuthorization: true },
    })
  );
}

app.use('/api/auth', authRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/resenas', resenasRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);

// Rutas inexistentes y errores de middleware (JSON malformado, cuerpo demasiado grande...):
// respuesta JSON genérica en vez de la página HTML de Express con la traza de la pila (A05).
app.use((_req: Request, res: Response) => {
  res.status(404).json({ mensaje: 'Recurso no encontrado.' });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ mensaje: 'El cuerpo de la petición no es JSON válido.' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ mensaje: 'El cuerpo de la petición es demasiado grande.' });
    return;
  }
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    res.status(err.status).json({ mensaje: 'Petición no válida.' });
    return;
  }
  console.error('Error no controlado:', err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
});

export default app;
