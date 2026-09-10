// test/globalTeardown.js
// Elimina la base de datos de pruebas al terminar toda la suite.
const { Client } = require('pg');
const cfg = require('./testDbConfig');

module.exports = async () => {
  const admin = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: 'postgres',
  });
  await admin.connect();
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [cfg.database]
  );
  await admin.query(`DROP DATABASE IF EXISTS ${cfg.database}`);
  await admin.end();
};
