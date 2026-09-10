// test/testDbConfig.js
// Parámetros de conexión a PostgreSQL para las pruebas. Coinciden con el
// contenedor de docker-compose (usuario/clave "postgres"). Se pueden
// sobrescribir por variables de entorno si tu PostgreSQL local es distinto.
const host = process.env.TEST_DB_HOST || 'localhost';
const port = Number(process.env.TEST_DB_PORT || 5432);
const user = process.env.TEST_DB_USER || 'postgres';
const password = process.env.TEST_DB_PASSWORD || 'postgres';
const database = process.env.TEST_DB_NAME || 'comercio_electronico_test';

module.exports = { host, port, user, password, database };
