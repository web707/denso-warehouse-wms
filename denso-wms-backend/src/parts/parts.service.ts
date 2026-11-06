import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Not, Repository } from 'typeorm';
import { HistoryEvent, HistoryEventType } from '../history/entities/history-event.entity';
import { Container } from '../containers/entities/container.entity';
import { HistoryService } from '../history/history.service';
import { nextPartColor } from './constants/part-colors';
import { AssignPartDto } from './dto/assign-part.dto';
import { AssignRackDto } from './dto/assign-rack.dto';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { QueryPartsDto } from './dto/query-parts.dto';
import { Part } from './entities/part.entity';
import { DataSource } from 'typeorm';
import { WarehouseZone } from '../warehouse-zones/entities/warehouse-zone.entity';
import { assertExpiryDeclared, assertStoragePlacement, preferredSlotsByExpiry, suggestStorageClass } from '../inventory/storage-placement.rules';
import { assertRackProductFamily } from '../inventory/rack-product-family.rules';
import { assertCapacity, rackLimits } from '../inventory/inventory.rules';

function computeCbm(lengthMm: number, widthMm: number, heightMm: number, cartons: number): string {
  const cbm = (lengthMm * widthMm * heightMm * cartons) / 1_000_000_000;
  return cbm.toFixed(6);
}

@Injectable()
export class PartsService {
  constructor(
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(Container) private readonly racks: Repository<Container>,
    private readonly history: HistoryService,
    private readonly dataSource: DataSource,
  ) {}

  findAll(query: QueryPartsDto): Promise<Part[]> {
    const where: FindOptionsWhere<Part> = {};
    if (query.orderId) where.orderId = query.orderId;
    if (query.containerId) where.containerId = query.containerId;
    return this.parts.find({ where, order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Part> {
    const part = await this.parts.findOne({ where: { id } });
    if (!part)
      throw new NotFoundException({ code: 'PART_NOT_FOUND', message: 'Không tìm thấy PART' });
    return part;
  }

  async create(dto: CreatePartDto): Promise<Part> {
    if ((dto.uomCode || 'EA') === 'EA' && dto.quantityPcs < dto.cartonCount) {
      throw new BadRequestException({code:'QTY_CARTONS_MISMATCH',message:'Số cái (PCS) không được ít hơn số thùng. Vui lòng kiểm tra số lượng trước khi lưu.'});
    }
    // Atomic: do not create an orphan PART if the requested rack is invalid or full.
    const part = await this.dataSource.transaction(async (em) => {
      let rack: Container | null = null;
      let chosenSlot: number | null = null;
      if (dto.rackId) {
        await em.query('SELECT id FROM containers WHERE id = $1 FOR UPDATE', [dto.rackId]);
        rack = await em.findOne(Container, { where: { id: dto.rackId } });
        if (!rack) throw new NotFoundException({ code: 'RACK_NOT_FOUND', message: 'Không tìm thấy kệ nhận hàng' });
        const peers = await em.find(Part, { where: { containerId: rack.id } });
        const zone = await em.findOne(WarehouseZone, { where: { warehouseCode: rack.warehouseCode, code: rack.zoneCode } });
        const storageClass = dto.storageClass || suggestStorageClass(dto.partName);
        assertExpiryDeclared(storageClass, dto.expirationDate);
        assertStoragePlacement({ productClass: storageClass, zoneMode: zone?.storageMode, rackClasses: peers.map((p) => p.storageClass), productName: dto.partName, rackName: rack.name });
        assertRackProductFamily({ rackFamily: rack.productFamily, peers, productName: dto.partName, productClass: storageClass, rackName: rack.name });
        const occupied = new Set(peers.filter((p) => p.preferredRackSlot !== null).map((p) => p.preferredRackSlot));
        chosenSlot = dto.slotIndex ?? preferredSlotsByExpiry(dto.expirationDate).find((i) => !occupied.has(i)) ?? null;
        if (chosenSlot === null || occupied.has(chosenSlot)) throw new BadRequestException({ code: 'RACK_FULL', message: `Kệ ${rack.name} không có ô trống phù hợp` });
        const cbm = computeCbm(dto.cartonLengthMm, dto.cartonWidthMm, dto.cartonHeightMm, dto.cartonCount);
        assertCapacity({ rackName: rack.name, partName: dto.partName, limits: rackLimits(rack), others: peers.map((p) => ({ weightKg: Number(p.totalWeightKg), cbm: Number(p.cbm), slot: p.preferredRackSlot })), before: null, after: { weightKg: dto.totalWeightKg, cbm: Number(cbm), slot: chosenSlot } });
      }
      const count = await em.count(Part);
      const cbm = computeCbm(dto.cartonLengthMm, dto.cartonWidthMm, dto.cartonHeightMm, dto.cartonCount);
      const saved = await em.save(Part, em.create(Part, {
        orderId: dto.orderId, partName: dto.partName, productCode: dto.productCode ?? null,
        divisionId: dto.divisionId, dcPrefixId: dto.dcPrefixId, masterPo: dto.masterPo,
        quantityPcs: dto.quantityPcs, totalWeightKg: dto.totalWeightKg.toString(), cartonCount: dto.cartonCount,
        cartonLengthMm: dto.cartonLengthMm, cartonWidthMm: dto.cartonWidthMm, cartonHeightMm: dto.cartonHeightMm,
        cbm, containerId: rack?.id || null, preferredRackSlot: chosenSlot,
        colorHex: dto.colorHex ?? nextPartColor(count), lotNumber: dto.lotNumber || null,
        storageClass: dto.storageClass || suggestStorageClass(dto.partName), uomCode: dto.uomCode || 'EA',
        unitCost: dto.unitCost === undefined || dto.unitCost === null ? null : dto.unitCost.toString(),
        expirationDate: dto.expirationDate || null, supplierName: dto.supplierName || null,
        supplierId: dto.supplierId ?? null, supplierSiteCode: dto.supplierSiteCode || null,
      }));
      await em.save(HistoryEvent, em.create(HistoryEvent, {
        type: HistoryEventType.PART_ADDED,
        description: `Thêm PART ${saved.partName}`,
        details: { partId: saved.id, rackId: saved.containerId, slotIndex: saved.preferredRackSlot },
        orderId: saved.orderId,
        timestamp: new Date(),
      }));
      return saved;
    });
    return this.findOne(part.id);
  }

  async update(id: string, dto: UpdatePartDto): Promise<Part> {
    const part = await this.findOne(id);
    const previousLoad = { weightKg: Number(part.totalWeightKg), cbm: Number(part.cbm), slot: part.preferredRackSlot };
    const previousStorageClass = part.storageClass;
    const previousName = part.partName;
    const { rackId: _rackId, slotIndex: _slotIndex, ...editable } = dto;
    Object.assign(part, {
      ...editable,
      storageClass: dto.storageClass || part.storageClass,
      totalWeightKg:
        dto.totalWeightKg !== undefined ? dto.totalWeightKg.toString() : part.totalWeightKg,
      unitCost:
        dto.unitCost !== undefined ? (dto.unitCost === null ? null : dto.unitCost.toString()) : part.unitCost,
    });
    const lengthMm = dto.cartonLengthMm ?? part.cartonLengthMm;
    const widthMm = dto.cartonWidthMm ?? part.cartonWidthMm;
    const heightMm = dto.cartonHeightMm ?? part.cartonHeightMm;
    const cartonCount = dto.cartonCount ?? part.cartonCount;
    part.cbm = computeCbm(lengthMm, widthMm, heightMm, cartonCount);
    const placementAffecting = part.storageClass !== previousStorageClass || part.partName !== previousName
      || Math.abs(Number(part.totalWeightKg) - previousLoad.weightKg) > 0.001
      || Math.abs(Number(part.cbm) - previousLoad.cbm) > 0.000001;
    if (part.containerId && placementAffecting) {
      const rack = await this.racks.findOne({ where: { id: part.containerId } });
      if (rack) {
        const zone = await this.dataSource.getRepository(WarehouseZone).findOne({ where: { warehouseCode: rack.warehouseCode, code: rack.zoneCode } });
        const peers = await this.parts.find({ where: { containerId: rack.id, id: Not(part.id) } });
        assertExpiryDeclared(part.storageClass, part.expirationDate);
        assertStoragePlacement({ productClass: part.storageClass, zoneMode: zone?.storageMode, rackClasses: peers.map((p) => p.storageClass), productName: part.partName, rackName: rack.name });
        assertRackProductFamily({ rackFamily: rack.productFamily, peers, productName: part.partName, productClass: part.storageClass, rackName: rack.name });
        assertCapacity({ rackName: rack.name, partName: part.partName, limits: rackLimits(rack), others: peers.map((p) => ({ weightKg: Number(p.totalWeightKg), cbm: Number(p.cbm), slot: p.preferredRackSlot })), before: previousLoad, after: { weightKg: Number(part.totalWeightKg), cbm: Number(part.cbm), slot: part.preferredRackSlot } });
      }
    }
    await this.parts.save(part);
    await this.history.log(HistoryEventType.PART_UPDATED, `Cập nhật PART ${part.partName}`, {
      partId: part.id,
    });
    return this.findOne(id);
  }

  async assign(id: string, dto: AssignPartDto): Promise<Part> {
    // Legacy entry point must not bypass placement, segregation or capacity rules.
    return this.assignRack(id, { rackId: dto.containerId ?? null, slotIndex: null });
  }

  async assignRack(id: string, dto: AssignRackDto): Promise<Part> {
    const result = await this.dataSource.transaction(async (em) => {
      // Lock first PART, then destination rack. InventoryService uses the same ordering.
      await em.query('SELECT id FROM parts WHERE id = $1 FOR UPDATE', [id]);
      const part = await em.findOne(Part, { where: { id } });
      if (!part) throw new NotFoundException({ code: 'PART_NOT_FOUND', message: 'Không tìm thấy PART' });
      const previousRackId = part.containerId;
      const previousSlotIndex = part.preferredRackSlot;
      let destinationSlot: number | null = null;
      let toRack: Container | null = null;
      if (dto.rackId) {
        await em.query('SELECT id FROM containers WHERE id = $1 FOR UPDATE', [dto.rackId]);
        toRack = await em.findOne(Container, { where: { id: dto.rackId } });
        if (!toRack) throw new NotFoundException({ code: 'RACK_NOT_FOUND', message: 'Không tìm thấy kệ nhận hàng' });
        // Kệ là vị trí vật lý của Zone, có thể lưu các lô/đơn khác nhau.
        // Vẫn kiểm tra nhóm bảo quản, ô trống và sức chứa bên dưới.
        const peers = await em.find(Part, { where: { containerId: toRack.id, id: Not(id) } });
        const zone = await em.findOne(WarehouseZone, { where: { warehouseCode: toRack.warehouseCode, code: toRack.zoneCode } });
        assertExpiryDeclared(part.storageClass, part.expirationDate);
        assertStoragePlacement({ productClass: part.storageClass, zoneMode: zone?.storageMode, rackClasses: peers.map((p) => p.storageClass), productName: part.partName, rackName: toRack.name });
        assertRackProductFamily({ rackFamily: toRack.productFamily, peers, productName: part.partName, productClass: part.storageClass, rackName: toRack.name });
        const occupied = new Set(peers.filter((p) => p.preferredRackSlot !== null).map((p) => p.preferredRackSlot));
        if (dto.slotIndex !== null && dto.slotIndex !== undefined) {
          if (occupied.has(dto.slotIndex)) throw new BadRequestException({ code: 'RACK_SLOT_OCCUPIED', message: 'Ô kệ này đang có PART khác' });
          destinationSlot = dto.slotIndex;
        } else if (dto.rackId === previousRackId && previousSlotIndex !== null && !occupied.has(previousSlotIndex)) {
          destinationSlot = previousSlotIndex;
        } else {
          destinationSlot = preferredSlotsByExpiry(part.expirationDate).find((i) => !occupied.has(i)) ?? null;
        }
        if (destinationSlot === null) throw new BadRequestException({ code: 'RACK_FULL', message: `Kệ ${toRack.name} không còn ô trống. Hãy chọn kệ khác.` });
        assertCapacity({
          rackName: toRack.name, partName: part.partName, limits: rackLimits(toRack),
          others: peers.map((p) => ({ weightKg: Number(p.totalWeightKg), cbm: Number(p.cbm), slot: p.preferredRackSlot })),
          before: previousRackId === dto.rackId ? { weightKg: Number(part.totalWeightKg), cbm: Number(part.cbm), slot: previousSlotIndex } : null,
          after: { weightKg: Number(part.totalWeightKg), cbm: Number(part.cbm), slot: destinationSlot },
        });
      }
      part.containerId = dto.rackId || null;
      part.preferredRackSlot = dto.rackId ? destinationSlot : null;
      await em.save(part);
      return { part, previousRackId, previousSlotIndex, toRack };
    });
    const { part, previousRackId, previousSlotIndex, toRack } = result;
    const fromSlot = previousSlotIndex === null ? null : `S${String(previousSlotIndex + 1).padStart(2, '0')}`;
    const toSlot = part.preferredRackSlot === null ? null : `S${String(part.preferredRackSlot + 1).padStart(2, '0')}`;
    const fromRack = previousRackId ? await this.racks.findOne({ where: { id: previousRackId } }) : null;
    await this.history.log(HistoryEventType.PART_ASSIGNED,
      `PART ${part.partName}: ${fromRack?.name || 'Chưa xếp'}${fromSlot || ''} → ${toRack?.name || 'Chưa xếp'}${toSlot || ''}`,
      { action: 'rack_move', partId: part.id, partName: part.partName, fromRackId: previousRackId,
        fromSlotIndex: previousSlotIndex, toRackId: part.containerId, toSlotIndex: part.preferredRackSlot }, part.orderId);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const part = await this.findOne(id);
    await this.parts.remove(part);
    await this.history.log(HistoryEventType.PART_DELETED, `Xoá PART ${part.partName}`, {
      partId: id,
    });
  }
}
