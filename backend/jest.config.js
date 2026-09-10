/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Fija las variables de entorno hacia la BD de pruebas ANTES de importar la app.
  setupFiles: ['<rootDir>/test/env.ts'],
  // Crea/borra la base de datos comercio_electronico_test una sola vez.
  globalSetup: '<rootDir>/test/globalSetup.js',
  globalTeardown: '<rootDir>/test/globalTeardown.js',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  clearMocks: true,
};
