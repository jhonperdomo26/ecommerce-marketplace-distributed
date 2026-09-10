// test/env.ts  (jest setupFiles)
// Se ejecuta antes de que cada archivo de prueba importe la app, de modo que el
// Pool de src/db.ts se conecte a la BD de pruebas y no a la de desarrollo.
// dotenv no sobrescribe variables ya definidas, así que estos valores ganan.
const cfg = require('./testDbConfig');

process.env.DB_HOST = cfg.host;
process.env.DB_PORT = String(cfg.port);
process.env.DB_USER = cfg.user;
process.env.DB_PASSWORD = cfg.password;
process.env.DB_DATABASE = cfg.database;
process.env.JWT_SECRET = 'FirmaSecretaPruebas';
process.env.NODE_ENV = 'test';
