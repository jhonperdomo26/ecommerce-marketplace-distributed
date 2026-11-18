// src/utils/consultas.ts
// Ayuda para las consultas de lectura con QueryBuilder de TypeORM que unen varias tablas:
// fija las columnas del resultado con el nombre exacto que espera la API (los mismos campos
// que devolvía la versión con SQL directo, para no romper la web ni la app).
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export function columnas<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  cols: Record<string, string>
): SelectQueryBuilder<T> {
  const pares = Object.entries(cols);
  qb.select(pares[0][1], pares[0][0]);
  for (const [alias, expresion] of pares.slice(1)) qb.addSelect(expresion, alias);
  return qb;
}
