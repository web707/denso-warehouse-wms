import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Not, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Container } from '../containers/entities/container.entity';
import { Part } from '../parts/entities/part.entity';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { InventoryTransaction, InventoryTransactionType } from './entities/inventory-transaction.entity';

function cbmFor(part: Part, cartons: number): string {
  return ((part.cartonLengthMm * part.cartonWidthMm * part.cartonHeightMm * cartons) / 1_000_000_000).toFixed(6);
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryTransaction) private readonly transactions: Repository<InventoryTransaction>,
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(Container) private readonly racks: Repository<Container>,
  ) {}

  async list(params: { type?: InventoryTransactionType; orderId?: string; partId?: string; limit?: number }) {
    const where: FindOptionsWhere<InventoryTransaction> = {};
    if (params.type) where.type = params.type;
    if (params.orderId) where.orderId = params.orderId;
    if (params.partId) where.partId = params.partId;
    return this.transactions.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(500, params.limit || 200)),
    });
  }

  private async ensureSlotAvailable(partId: string, rackId: string, slot: number | null | undefined) {
    const rack = await this.racks.findOne({ where: { id: rackId } });
    if (!rack) throw new NotFoundException({ code: 'RACK_NOT_FOUND', message: 'Không tìm thấy kệ đích' });
    if (slot === null || slot === undefined) return rack;
    const conflict = await this.parts.findOne({
      where: { containerId: rackId, preferredRackSlot: slot, id: Not(partId) },
    });
    if (conflict) {
      throw new BadRequestException({
        code: 'RACK_SLOT_OCCUPIED',
        message: `Ô S${String(slot + 1).padStart(2, '0')} đang được dùng bởi ${conflict.partName}`,
      });
    }
    return rack;
  }

  async create(dto: CreateInventoryTransactionDto, user: AuthenticatedUser): Promise<InventoryTransaction> {
    const part = await this.parts.findOne({ where: { id: dto.partId } });
    if (!part) throw new NotFoundException({ code: 'PART_NOT_FOUND', message: 'Không tìm thấy PART' });

    const fromRackId = part.containerId;
    const fromSlot = part.preferredRackSlot;
    const qty = Math.max(0, dto.quantityPcs || 0);
    const cartons = Math.max(0, dto.cartonCount || 0);
    const weight = Math.max(0, dto.weightKg || 0);

    if (dto.type === InventoryTransactionType.INBOUND) {
      if (qty === 0 && cartons === 0 && weight === 0) {
        throw new BadRequestException({ code: 'INBOUND_ZERO', message: 'Nhập kho phải có số lượng, số thùng hoặc khối lượng lớn hơn 0' });
      }
      if (dto.toRackId) {
        await this.ensureSlotAvailable(part.id, dto.toRackId, dto.toSlot);
        part.containerId = dto.toRackId;
        part.preferredRackSlot = dto.toSlot ?? null;
      }
      part.quantityPcs += qty;
      part.cartonCount += cartons;
      part.totalWeightKg = (Number(part.totalWeightKg) + weight).toFixed(2);
      part.cbm = cbmFor(part, part.cartonCount);
    } else if (dto.type === InventoryTransactionType.OUTBOUND) {
      if (qty === 0 && cartons === 0 && weight === 0) {
        throw new BadRequestException({ code: 'OUTBOUND_ZERO', message: 'Xuất kho phải có số lượng, số thùng hoặc khối lượng lớn hơn 0' });
      }
      if (qty > part.quantityPcs || cartons > part.cartonCount || weight > Number(part.totalWeightKg) + 0.001) {
        throw new BadRequestException({ code: 'OUTBOUND_EXCEEDS_STOCK', message: 'Số lượng xuất vượt tồn kho hiện tại' });
      }
      part.quantityPcs -= qty;
      part.cartonCount -= cartons;
      part.totalWeightKg = Math.max(0, Number(part.totalWeightKg) - weight).toFixed(2);
      part.cbm = cbmFor(part, part.cartonCount);
      if (part.cartonCount === 0 || part.quantityPcs === 0) {
        part.containerId = null;
        part.preferredRackSlot = null;
      }
    } else if (dto.type === InventoryTransactionType.TRANSFER) {
      if (!dto.toRackId) {
        throw new BadRequestException({ code: 'TRANSFER_RACK_REQUIRED', message: 'Điều chuyển cần chọn kệ đích' });
      }
      await this.ensureSlotAvailable(part.id, dto.toRackId, dto.toSlot);
      part.containerId = dto.toRackId;
      part.preferredRackSlot = dto.toSlot ?? null;
    }

    await this.parts.save(part);
    const tx = await this.transactions.save(this.transactions.create({
      type: dto.type,
      partId: part.id,
      partName: part.partName,
      productCode: part.productCode,
      orderId: part.orderId,
      fromRackId,
      fromSlot,
      toRackId: part.containerId,
      toSlot: part.preferredRackSlot,
      quantityPcs: qty,
      cartonCount: cartons,
      weightKg: weight.toFixed(2),
      note: dto.note?.trim() || null,
      performedBy: user?.id || null,
      performedByEmail: user?.email || null,
    }));
    return tx;
  }
}
