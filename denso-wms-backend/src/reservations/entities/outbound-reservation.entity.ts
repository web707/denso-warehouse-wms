import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ReservationStatus = 'RESERVED' | 'PICKED' | 'CANCELLED' | 'EXPIRED';

@Entity('outbound_reservations')
export class OutboundReservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'order_reference', type: 'varchar', length: 100 })
  orderReference: string;

  @Column({ name: 'part_id', type: 'uuid' })
  partId: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId: string | null;

  @Column({ name: 'quantity_pcs', type: 'integer' })
  quantityPcs: number;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 50,
    default: 'RESERVED',
  })
  status: ReservationStatus;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255, nullable: true, unique: true })
  idempotencyKey: string | null;

  @Column({ name: 'reserved_by', type: 'varchar', length: 255, nullable: true })
  reservedBy: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;
}
