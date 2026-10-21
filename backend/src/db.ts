// src/db.ts
// Pool de conexiones a PostgreSQL, configurado con las variables de entorno
// definidas en .env (Manual Técnico, Paso 2, punto 6).
import { Pool } from 'pg';

// DB_POOL_MAX: sin configurar, pg usa por defecto max=10. La prueba de
// estrés de la práctica de validación y pruebas (k6, Módulo 1) mostró que
// con 10 conexiones el pool se agota mucho antes que la base de datos o el
// `FOR UPDATE` de crearPedido: a 300 VUs 0% de errores (p95=775ms), pero
// entre 300 y 900 VUs empiezan los timeouts (hasta 4% de fallas, p95=5.6s)
// simplemente por la cola de espera de conexión, no por carga real del motor.
export const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_DATABASE,
  max: Number(process.env.DB_POOL_MAX) || 30,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});
