import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum DiscrepancyType {
  MATCH = 'MATCH',
  SHORTAGE = 'SHORTAGE',
  OVERAGE = 'OVERAGE',
}

export enum ReceivingStatus {
  COMPLETED = 'COMPLETED',
  DISCREPANCY_PENDING = 'DISCREPANCY_PENDING',
  DISCREPANCY_APPROVED = 'DISCREPANCY_APPROVED',
}

@Entity('receiving_receipts')
export class ReceivingReceipt extends BaseEntity {
  @Column({ name: 'receipt_number', unique: true })
  @Index()
  receiptNumber: string;

  @Column({ name: 'po_number' })
  @Index()
  poNumber: string;

  @Column({ name: 'product_code' })
  @Index()
  productCode: string;

  @Column({ name: 'part_name' })
  partName: string;

  @Column({ name: 'lot_number' })
  @Index()
  lotNumber: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  @Index()
  lotId: string | null;

  @Column({ name: 'expected_quantity_pcs', type: 'int' })
  expectedQuantityPcs: number;

  @Column({ name: 'received_quantity_pcs', type: 'int' })
  receivedQuantityPcs: number;

  @Column({ name: 'discrepancy_quantity_pcs', type: 'int', default: 0 })
  discrepancyQuantityPcs: number;

  @Column({ name: 'discrepancy_type', type: 'varchar', default: DiscrepancyType.MATCH })
  discrepancyType: DiscrepancyType;

  @Column({ name: 'damaged_quantity_pcs', type: 'int', default: 0 })
  damagedQuantityPcs: number;

  @Column({ name: 'good_quantity_pcs', type: 'int', default: 0 })
  goodQuantityPcs: number;

  @Column({ name: 'carton_count', type: 'int', default: 0 })
  cartonCount: number;

  @Column({ name: 'total_weight_kg', type: 'numeric', precision: 10, scale: 2, default: 0 })
  totalWeightKg: number;

  @Column({ name: 'target_rack_id', type: 'uuid', nullable: true })
  targetRackId: string | null;

  @Column({ name: 'target_slot', type: 'int', nullable: true })
  targetSlot: number | null;

  @Column({ name: 'quarantine_rack_id', type: 'uuid', nullable: true })
  quarantineRackId: string | null;

  @Column({ name: 'discrepancy_reason', type: 'text', nullable: true })
  discrepancyReason: string | null;

  @Column({ name: 'status', type: 'varchar', default: ReceivingStatus.COMPLETED })
  @Index()
  status: ReceivingStatus;

  @Column({ name: 'approved_by', type: 'varchar', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'received_by', type: 'varchar', nullable: true })
  receivedBy: string | null;

  @Column({ name: 'part_id', type: 'uuid', nullable: true })
  partId: string | null;

  @Column({ name: 'damaged_part_id', type: 'uuid', nullable: true })
  damagedPartId: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;
}
