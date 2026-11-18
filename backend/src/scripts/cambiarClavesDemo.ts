// src/scripts/cambiarClavesDemo.ts
// Despliegue público: la semilla (database/02_seed.sql) crea usuarios con la contraseña conocida
// "Password123". Este script cambia la contraseña de TODOS los usuarios que todavía la tienen.
//
//   docker compose -f docker-compose.prod.yml -f docker-compose.nube.yml exec \
//     -e NUEVA_CLAVE='UnaClaveLarga2026' api node dist/scripts/cambiarClavesDemo.js
//
// Cuentas creadas después con otra contraseña no se tocan.
import bcrypt from 'bcrypt';
import { bd, cerrarBd, repo } from '../db';
import { Usuario } from '../entidades';
import { errorDePassword } from '../utils/validar';

const CLAVE_SEMILLA = 'Password123';

async function main(): Promise<void> {
  const nueva = process.env.NUEVA_CLAVE ?? '';
  const problema = errorDePassword(nueva, '');
  if (problema || nueva === CLAVE_SEMILLA) {
    console.error(`NUEVA_CLAVE no es válida: ${problema ?? 'no puede ser la de la semilla'}`);
    process.exitCode = 1;
    return;
  }
  await bd();
  const usuarios = await repo(Usuario);
  const todos = await usuarios.find({ select: { id: true, email: true, password_hash: true } });
  const hash = await bcrypt.hash(nueva, 10);
  let cambiados = 0;
  for (const u of todos) {
    if (await bcrypt.compare(CLAVE_SEMILLA, u.password_hash)) {
      await usuarios.update({ id: u.id }, { password_hash: hash });
      console.log(`Contraseña cambiada: ${u.email}`);
      cambiados++;
    }
  }
  console.log(`${cambiados} usuario(s) actualizados; ningún usuario conserva "${CLAVE_SEMILLA}".`);
}

main()
  .catch((error) => {
    console.error('No se pudieron cambiar las contraseñas:', error.message);
    process.exitCode = 1;
  })
  .finally(() => cerrarBd());
