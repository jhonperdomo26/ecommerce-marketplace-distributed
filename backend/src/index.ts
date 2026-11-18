// src/index.ts
// Punto de entrada: importa la app y abre el puerto (Manual Técnico, Paso 2,
// punto 7). La construcción de la app vive en app.ts para poder probarla con
// Supertest sin levantar el servidor.
import { app } from './app';
import { bd } from './db';

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});

// Abre la conexión de TypeORM al arrancar para detectar pronto una base inaccesible. Si falla,
// la API sigue en pie y cada petición vuelve a intentarlo (ver bd() en db.ts).
bd()
  .then(() => console.log('Conectado a PostgreSQL (TypeORM).'))
  .catch((error) => console.error('No se pudo conectar a PostgreSQL todavía:', error.message));
