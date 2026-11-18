// Configuración de Jest solo para la suite de aceptación End-to-End (carpeta e2e/).
// No usa base de datos propia: habla por HTTP con un despliegue ya levantado.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/e2e/**/*.e2e.test.js'],
  testTimeout: 20000,
};
