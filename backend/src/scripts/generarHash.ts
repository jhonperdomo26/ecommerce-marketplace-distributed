// src/scripts/generarHash.ts
// Utilidad para generar el password_hash (bcrypt) que se guarda en la tabla
// usuarios. Uso:
//   npm run seed:hash -- "MiContraseña"
// Si no se pasa argumento, usa la contraseña de ejemplo de la documentación.
import bcrypt from 'bcrypt';

const password = process.argv[2] || 'Password123';
const SALT_ROUNDS = 10;

bcrypt.hash(password, SALT_ROUNDS).then((hash) => {
  console.log(`password : ${password}`);
  console.log(`hash     : ${hash}`);
});
