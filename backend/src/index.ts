// src/index.ts
// Punto de entrada: importa la app y abre el puerto (Manual Técnico, Paso 2,
// punto 7). La construcción de la app vive en app.ts para poder probarla con
// Supertest sin levantar el servidor.
import { app } from './app';

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
