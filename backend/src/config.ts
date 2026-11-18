// src/config.ts
// Configuración sensible validada al arrancar (Fase 4, hallazgo A02/A05).
// Antes el secreto JWT tenía un valor por defecto público en el código y en
// .env.example: cualquiera que leyera el repositorio podía firmar un token de
// administrador si la variable faltaba. Ahora, en producción, la aplicación se
// niega a arrancar sin un secreto propio y suficientemente largo.
import 'dotenv/config';

const SECRETO_DESARROLLO = 'FirmaSecretaPlataforma'; // solo para trabajar en local
const LONGITUD_MINIMA = 32;

export const JWT_ALGORITMO = 'HS256' as const;

function leerJwtSecret(): string {
  const valor = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production') {
    const inseguro =
      !valor ||
      valor === SECRETO_DESARROLLO ||
      valor.startsWith('CAMBIAR') ||
      valor.length < LONGITUD_MINIMA;
    if (inseguro) {
      throw new Error(
        `JWT_SECRET debe definirse en producción con un valor aleatorio de al menos ${LONGITUD_MINIMA} caracteres. ` +
          'Genérelo con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"'
      );
    }
    return valor;
  }

  if (!valor) {
    console.warn(
      '[config] JWT_SECRET no está definido: se usa un secreto de desarrollo. No lo use fuera de su equipo.'
    );
    return SECRETO_DESARROLLO;
  }
  return valor;
}

export const JWT_SECRET: string = leerJwtSecret();
