// src/app.ts
// Construcción de la aplicación Express (rutas + middlewares), SIN abrir el
// puerto. index.ts la importa y llama a listen(); las pruebas (Supertest) la
// importan directamente.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes';
import pedidosRoutes from './routes/pedidos.routes';
import productosRoutes from './routes/productos.routes';
import resenasRoutes from './routes/resenas.routes';
import adminRoutes from './routes/admin.routes';

export const app = express();

// Cabeceras de seguridad (CSP, X-Content-Type-Options, oculta X-Powered-By,
// etc.) y origen CORS restringido al frontend conocido: hallazgos del
// escaneo OWASP ZAP de la práctica de validación y pruebas.
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  })
);
app.use(express.json());

// Límite de intentos en el login (mitiga fuerza bruta de credenciales):
// 10 intentos cada 15 min por IP, hallazgo de la práctica de validación y
// pruebas (10 intentos fallidos consecutivos no eran bloqueados).
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos. Intenta de nuevo más tarde.' },
});
app.use('/api/auth/login', limitadorLogin);

// Sonda de salud
app.get('/', (_req, res) => {
  res.json({ servicio: 'API Comercio Electrónico', estado: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/resenas', resenasRoutes);
app.use('/api/admin', adminRoutes);

export default app;
