// src/app.ts
// Construcción de la aplicación Express (rutas + middlewares), SIN abrir el
// puerto. index.ts la importa y llama a listen(); las pruebas (Supertest) la
// importan directamente.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes';
import pedidosRoutes from './routes/pedidos.routes';
import productosRoutes from './routes/productos.routes';
import resenasRoutes from './routes/resenas.routes';
import adminRoutes from './routes/admin.routes';

export const app = express();

app.use(cors());
app.use(express.json());

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
