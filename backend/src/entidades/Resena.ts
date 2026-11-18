// src/entidades/Resena.ts — tabla "resenas".
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Pedido } from './Pedido';

@Entity({ name: 'resenas' })
export class Resena {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', nullable: true })
  pedido_id!: number | null;

  // NUMERIC(2,1): llega como texto ("4.5").
  @Column({ type: 'numeric', precision: 2, scale: 1, nullable: true })
  calificacion!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  comentario!: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_registro!: Date;

  @ManyToOne(() => Pedido, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pedido_id' })
  pedido?: Relation<Pedido>;
}
