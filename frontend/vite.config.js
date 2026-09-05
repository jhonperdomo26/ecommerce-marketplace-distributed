import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Manual Técnico, Paso 3, punto 4 (opción proxy):
// las llamadas a /api se redirigen al backend de Node en el puerto 3000,
// evitando tener que escribir la URL absoluta en el código del componente.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
