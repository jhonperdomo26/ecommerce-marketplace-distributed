// src/entidades/Producto.ts — tabla "productos".
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Tienda } from './Tienda';
import { Usuario } from './Usuario';

@Entity({ name: 'productos' })
export class Producto {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  sku!: string;

  // NUMERIC(10,2): el driver lo entrega como texto ("149900.00") para no perder precisión.
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  precio!: string;

  @Column({ type: 'int', default: 0 })
  stock!: number;

  @Column({ type: 'int', nullable: true })
  vendedor_id!: number | null;

  @Column({ type: 'int', nullable: true })
  tienda_id!: number | null;

  @ManyToOne(() => Tienda)
  @JoinColumn({ name: 'tienda_id' })
  tienda?: Relation<Tienda>;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'vendedor_id' })
  vendedor?: Relation<Usuario>;
}
