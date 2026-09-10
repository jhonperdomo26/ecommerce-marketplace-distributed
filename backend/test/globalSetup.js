// test/globalSetup.js
// Crea la base de datos comercio_electronico_test desde cero y le aplica el
// esquema del manual (01_schema.sql) más las restricciones extra
// (03_constraints.sql). No carga datos: cada prueba inserta sus propias filas.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const cfg = require('./testDbConfig');

const DB_DIR = path.resolve(__dirname, '..', '..', 'database');

module.exports = async () => {
  // 1) Conectar a la BD de mantenimiento "postgres" para (re)crear la de pruebas.
  const admin = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: 'postgres',
  });
  try {
    await admin.connect();
  } catch (e) {
    throw new Error(
      `No se pudo conectar a PostgreSQL en ${cfg.host}:${cfg.port} como "${cfg.user}". ` +
        '¿Está corriendo el contenedor? (docker compose up -d). Detalle: ' +
        e.message
    );
  }

  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [cfg.database]
  );
  await admin.query(`DROP DATABASE IF EXISTS ${cfg.database}`);
  await admin.query(`CREATE DATABASE ${cfg.database}`);
  await admin.end();

  // 2) Aplicar esquema + restricciones sobre la BD de pruebas.
  const db = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
  });
  await db.connect();
  for (const archivo of ['01_schema.sql', '03_constraints.sql']) {
    const sql = fs.readFileSync(path.join(DB_DIR, archivo), 'utf8');
    await db.query(sql);
  }
  await db.end();

  console.log(`\n[tests] BD "${cfg.database}" lista.`);
};
