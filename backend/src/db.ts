// src/db.ts
// Pool de conexiones a PostgreSQL, configurado con las variables de entorno
// definidas en .env (Manual Técnico, Paso 2, punto 6).
import { Pool } from 'pg';

export const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_DATABASE,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});
