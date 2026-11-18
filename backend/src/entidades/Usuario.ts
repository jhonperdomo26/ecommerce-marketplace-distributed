// src/entidades/Usuario.ts — tabla "usuarios".
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Tienda } from './Tienda';

export type Rol = 'administrador' | 'vendedor' | 'cliente';

@Entity({ name: 'usuarios' })
export class Usuario {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email!: string;

  // select: false → nunca se lee salvo que una consulta lo pida explícitamente (solo el login).
  @Column({ type: 'varchar', length: 255, select: false })
  password_hash!: string;

  @Column({ type: 'varchar', length: 20 })
  rol!: Rol;

  // NULL para clientes; obligatorio para vendedor y administrador.
  @Column({ type: 'int', nullable: true })
  tienda_id!: number | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @ManyToOne(() => Tienda)
  @JoinColumn({ name: 'tienda_id' })
  tienda?: Relation<Tienda>;
}
