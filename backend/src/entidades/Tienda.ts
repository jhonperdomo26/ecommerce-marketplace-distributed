// src/entidades/Tienda.ts — tabla "tiendas" (database/01_schema.sql).
// El esquema lo crean los scripts SQL; TypeORM solo lo mapea (synchronize: false).
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'tiendas' })
export class Tienda {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  direccion!: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  creado_en!: Date;
}
