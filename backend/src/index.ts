// src/index.ts
// Punto de entrada de la API RESTful central (Manual Técnico, Paso 2, punto 7):
// vincula las rutas con Express, habilita CORS para permitir conexiones externas
// (frontend web y app móvil) y levanta el servidor.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes';
import pedidosRoutes from './routes/pedidos.routes';
import productosRoutes from './routes/productos.routes';
import resenasRoutes from './routes/resenas.routes';
import adminRoutes from './routes/admin.routes';

const app = express();

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

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
