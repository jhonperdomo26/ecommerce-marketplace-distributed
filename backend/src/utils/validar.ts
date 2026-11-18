// src/utils/validar.ts
// Validadores de entrada compartidos por los controladores (Fase 4, A03/A04).
// Antes un dato con tipo o rango incorrecto llegaba hasta PostgreSQL y terminaba
// en un error 500 (o, peor, en un estado NULL guardado): ahora se rechaza en el
// borde con un 400 y un mensaje claro. Cada función devuelve el valor ya
// normalizado, o null si el dato no es válido.

export const ESTADOS_PEDIDO = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'] as const;

const MAX_INT = 2147483647; // INT de PostgreSQL

/** Entero > 0 (acepta número o texto de dígitos, que es como llegan los parámetros de URL). */
export function enteroPositivo(v: unknown): number | null {
  if (typeof v === 'number') {
    return Number.isSafeInteger(v) && v > 0 && v <= MAX_INT ? v : null;
  }
  if (typeof v === 'string' && /^\d{1,10}$/.test(v)) {
    const n = Number(v);
    return n > 0 && n <= MAX_INT ? n : null;
  }
  return null;
}

/** Entero >= 0 (stock). */
export function enteroNoNegativo(v: unknown): number | null {
  if (v === 0 || v === '0') return 0;
  return enteroPositivo(v);
}

/** Precio: número entre 0 y 99 999 999,99 (columna NUMERIC(10,2)). */
export function precioValido(v: unknown): number | null {
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d{1,8}(\.\d+)?$/.test(v)) n = Number(v);
  else return null;
  return Number.isFinite(n) && n >= 0 && n <= 99999999.99 ? n : null;
}

/** Calificación de reseña: 1.0 a 5.0 (columna NUMERIC(2,1)). */
export function notaValida(v: unknown): number | null {
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d(\.\d+)?$/.test(v)) n = Number(v);
  else return null;
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

/** Texto de 1..max caracteres, sin espacios en los extremos ni bytes nulos (PostgreSQL los rechaza). */
export function textoValido(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length < 1 || t.length > max || t.includes('\u0000')) return null;
  return t;
}

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Correo con formato válido y como máximo 150 caracteres (VARCHAR(150)). */
export function emailValido(v: unknown): string | null {
  const t = textoValido(v, 150);
  return t !== null && FORMATO_EMAIL.test(t) ? t : null;
}

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD_BYTES = 72; // bcrypt ignora lo que exceda de 72 bytes

/** Devuelve el motivo del rechazo, o null si la contraseña cumple la política. */
export function errorDePassword(password: unknown, email?: string): string | null {
  if (typeof password !== 'string') return 'La contraseña debe ser texto.';
  if (password.length < MIN_PASSWORD) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return `La contraseña no puede superar ${MAX_PASSWORD_BYTES} bytes.`;
  }
  if (password.includes('\u0000')) return 'La contraseña contiene caracteres no válidos.';
  if (email && password.toLowerCase() === email.toLowerCase()) {
    return 'La contraseña no puede ser igual al correo.';
  }
  return null;
}
