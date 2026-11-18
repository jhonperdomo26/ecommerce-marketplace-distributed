// src/entidades/Pedido.ts — tabla "pedidos".
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Producto } from './Producto';
import { Usuario } from './Usuario';

export const ESTADOS = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'] as const;
export type EstadoPedido = (typeof ESTADOS)[number];

@Entity({ name: 'pedidos' })
export class Pedido {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', nullable: true })
  cliente_id!: number | null;

  @Column({ type: 'int', nullable: true })
  producto_id!: number | null;

  @Column({ type: 'int' })
  cantidad!: number;

  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado!: EstadoPedido;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_pedido!: Date;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'cliente_id' })
  cliente?: Relation<Usuario>;

  @ManyToOne(() => Producto)
  @JoinColumn({ name: 'producto_id' })
  producto?: Relation<Producto>;
}
