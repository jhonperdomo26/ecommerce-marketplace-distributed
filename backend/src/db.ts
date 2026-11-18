// src/db.ts
// Persistencia con TypeORM (Fase 2). El esquema lo definen los scripts de database/
// (01_schema.sql, 03_constraints.sql): TypeORM solo mapea las tablas a entidades y nunca
// las modifica (synchronize: false), así la base de Docker, la de pruebas y la de desarrollo
// se crean igual.
//
// DB_POOL_MAX: sin configurar, pg usa por defecto max=10. La prueba de estrés de la práctica
// de validación y pruebas mostró que con 10 conexiones el pool se agota mucho antes que la
// base de datos; por eso el valor por defecto es 30.
import 'reflect-metadata';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { Pedido, Producto, Resena, Tienda, Usuario } from './entidades';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [Tienda, Usuario, Producto, Pedido, Resena],
  synchronize: false,
  logging: false,
  extra: { max: Number(process.env.DB_POOL_MAX) || 30 },
});

// Conexión perezosa: se abre con la primera consulta. Si falla (la base aún no arranca),
// la siguiente petición lo vuelve a intentar en vez de dejar la API inutilizable.
let inicializando: Promise<DataSource> | null = null;

export function bd(): Promise<DataSource> {
  if (AppDataSource.isInitialized) return Promise.resolve(AppDataSource);
  if (!inicializando) {
    inicializando = AppDataSource.initialize().catch((error) => {
      inicializando = null;
      throw error;
    });
  }
  return inicializando;
}

// Repositorio de una entidad (patrón Repository de TypeORM).
export async function repo<T extends ObjectLiteral>(entidad: EntityTarget<T>): Promise<Repository<T>> {
  return (await bd()).getRepository(entidad);
}

export async function cerrarBd(): Promise<void> {
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  inicializando = null;
}
