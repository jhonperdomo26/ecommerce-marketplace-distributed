// src/index.ts
// Punto de entrada de la API RESTful central (Manual Técnico, Paso 2, punto 7):
// vincula las rutas con Express, habilita CORS para permitir conexiones externas
// (frontend web y app móvil) y levanta el servidor.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes';
import pedidosRoutes from './routes/pedidos.routes';

const app = express();

app.use(cors());
app.use(express.json());

// Sonda de salud
app.get('/', (_req, res) => {
  res.json({ servicio: 'API Comercio Electrónico', estado: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/pedidos', pedidosRoutes);

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
