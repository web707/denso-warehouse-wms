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
import { assertExpiryDeclared, assertStoragePlacement, preferredSlotsByExpiry } from '../inventory/storage-placement.rules';
import { assertRackProductFamily, resolveProductFamily } from '../inventory/rack-product-family.rules';
import { assertCapacity, assertRackSlotFits, rackLimits } from '../inventory/inventory.rules';

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
    const qb = this.parts.createQueryBuilder('p')
      .leftJoinAndSelect('p.division', 'division')
      .leftJoinAndSelect('p.dcPrefix', 'dcPrefix');
    if (query.orderId) qb.andWhere('p.orderId = :orderId', { orderId: query.orderId });
    if (query.containerId) qb.andWhere('p.containerId = :containerId', { containerId: query.containerId });
    if (query.search) {
      qb.andWhere('(p.partName ILIKE :s OR p.productCode ILIKE :s OR p.lotNumber ILIKE :s)', { s: `%${query.search}%` });
    }
    qb.orderBy('p.createdAt', 'ASC');
    if (query.limit) qb.take(query.limit);
    if (query.offset) qb.skip(query.offset);
    return qb.getMany();
  }

  async dashboardSummary() {
    const raw = await this.parts.query(`
      WITH latest_qc AS (
        SELECT DISTINCT ON (COALESCE(quality_scope_id, lot_id)) COALESCE(quality_scope_id, lot_id) AS quality_key, judgment
        FROM inspections WHERE lot_id IS NOT NULL
        ORDER BY COALESCE(quality_scope_id, lot_id) ASC, inspection_date DESC, created_at DESC, id DESC
      )
      SELECT
        COUNT(*)::int AS "totalParts",
        COUNT(DISTINCT NULLIF(btrim(p.product_code), '')) FILTER (
          WHERE p.quantity_pcs > 0 OR p.carton_count > 0 OR p.total_weight_kg > 0
        )::int AS "stockedSkuCount",
        (SELECT COUNT(*)::int FROM shipments WHERE shipment_status = 'RELEASED' AND actual_ship_date IS NULL) AS "pendingShipmentCount",
        COALESCE(SUM(p.quantity_pcs) FILTER (WHERE q.judgment = 'HOLD'), 0)::bigint AS "holdQuantityPcs",
        COUNT(*) FILTER (WHERE p.quantity_pcs > 0 OR p.carton_count > 0 OR p.total_weight_kg > 0)::int AS "stockedPartsCount",
        COALESCE(SUM(p.quantity_pcs), 0)::bigint AS "totalQuantityPcs",
        COALESCE(SUM(p.quantity_pcs) FILTER (WHERE NOT p.receiving_damaged AND q.judgment IN ('OK', 'AVAILABLE')), 0)::bigint AS "availableQuantityPcs",
        COALESCE(SUM(p.quantity_pcs) FILTER (WHERE NOT p.receiving_damaged AND q.judgment IS NULL), 0)::bigint AS "pendingQcQuantityPcs",
        COALESCE(SUM(p.quantity_pcs) FILTER (WHERE p.receiving_damaged OR (q.judgment IS NOT NULL AND q.judgment NOT IN ('OK', 'AVAILABLE'))), 0)::bigint AS "blockedQcQuantityPcs",
        COALESCE(SUM(p.carton_count), 0)::int AS "totalCartons",
        COALESCE(SUM(p.total_weight_kg), 0)::numeric(12,2) AS "totalWeightKg",
        COALESCE(SUM(p.cbm), 0)::numeric(14,6) AS "totalCbm",
        COUNT(*) FILTER (WHERE p.container_id IS NULL AND (p.quantity_pcs > 0 OR p.carton_count > 0 OR p.total_weight_kg > 0))::int AS "unallocatedCount",
        COALESCE(SUM(p.cbm) FILTER (WHERE p.container_id IS NULL AND (p.quantity_pcs > 0 OR p.carton_count > 0 OR p.total_weight_kg > 0)), 0)::numeric(14,6) AS "unallocatedCbm",
        COUNT(*) FILTER (WHERE p.expiration_date IS NOT NULL AND p.expiration_date < (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND (p.quantity_pcs > 0 OR p.carton_count > 0 OR p.total_weight_kg > 0))::int AS "expiredPartsCount",
        COUNT(*) FILTER (WHERE p.expiration_date IS NOT NULL AND p.expiration_date >= (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND p.expiration_date <= (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + INTERVAL '30 days' AND (p.quantity_pcs > 0 OR p.carton_count > 0 OR p.total_weight_kg > 0))::int AS "soonExpiringPartsCount"
      FROM parts p
      LEFT JOIN latest_qc q ON q.quality_key = COALESCE(p.quality_scope_id, p.lot_id)
    `);
    const r = raw[0] || {};
    return {
      totalParts: Number(r.totalParts || 0),
      stockedSkuCount: Number(r.stockedSkuCount || 0),
      pendingShipmentCount: Number(r.pendingShipmentCount || 0),
      pendingReceiptCount: null,
      holdQuantityPcs: Number(r.holdQuantityPcs || 0),
      stockedPartsCount: Number(r.stockedPartsCount || 0),
      totalQuantityPcs: Number(r.totalQuantityPcs || 0),
      physicalQuantityPcs: Number(r.totalQuantityPcs || 0),
      availableQuantityPcs: Number(r.availableQuantityPcs || 0),
      pendingQcQuantityPcs: Number(r.pendingQcQuantityPcs || 0),
      blockedQcQuantityPcs: Number(r.blockedQcQuantityPcs || 0),
      totalCartons: Number(r.totalCartons || 0),
      totalWeightKg: Number(r.totalWeightKg || 0),
      totalCbm: Number(r.totalCbm || 0),
      unallocatedCount: Number(r.unallocatedCount || 0),
      unallocatedCbm: Number(r.unallocatedCbm || 0),
      expiredPartsCount: Number(r.expiredPartsCount || 0),
      soonExpiringPartsCount: Number(r.soonExpiringPartsCount || 0),
    };
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
      const storageClass = dto.storageClass || 'unknown';
      const productCode = dto.productCode?.trim() || null;
      const productFamily = await resolveProductFamily(em, productCode, dto.productFamily, storageClass);
      let rack: Container | null = null;
      let chosenSlot: number | null = null;
      if (dto.rackId) {
        await em.query('SELECT id FROM containers WHERE id = $1 FOR UPDATE', [dto.rackId]);
        rack = await em.findOne(Container, { where: { id: dto.rackId } });
        if (!rack) throw new NotFoundException({ code: 'RACK_NOT_FOUND', message: 'Không tìm thấy kệ nhận hàng' });
        const peers = await em.find(Part, { where: { containerId: rack.id } });
        const zone = await em.findOne(WarehouseZone, { where: { warehouseCode: rack.warehouseCode, code: rack.zoneCode } });
        assertExpiryDeclared(storageClass, dto.expirationDate);
        assertStoragePlacement({ productClass: storageClass, zoneMode: zone?.storageMode, rackClasses: peers.map((p) => p.storageClass), productName: dto.partName, rackName: rack.name });
        assertRackProductFamily({ rackFamily: rack.productFamily, peers, productName: dto.partName, productCode: productCode, productFamily, zoneFamily: zone?.productFamily, rackName: rack.name });
        const occupied = new Set(peers.filter((p) => p.preferredRackSlot !== null).map((p) => p.preferredRackSlot));
        chosenSlot = dto.slotIndex ?? preferredSlotsByExpiry(dto.expirationDate).find((i) => !occupied.has(i)) ?? null;
        if (chosenSlot === null || occupied.has(chosenSlot)) throw new BadRequestException({ code: 'RACK_FULL', message: `Kệ ${rack.name} không có ô trống phù hợp` });
        assertRackSlotFits(dto, dto.cartonCount, chosenSlot, rack);
        const cbm = computeCbm(dto.cartonLengthMm, dto.cartonWidthMm, dto.cartonHeightMm, dto.cartonCount);
        assertCapacity({ rackName: rack.name, partName: dto.partName, limits: rackLimits(rack), others: peers.map((p) => ({ weightKg: Number(p.totalWeightKg), cbm: Number(p.cbm), slot: p.preferredRackSlot })), before: null, after: { weightKg: dto.totalWeightKg, cbm: Number(cbm), slot: chosenSlot } });
      }
      const count = await em.count(Part);
      const cbm = computeCbm(dto.cartonLengthMm, dto.cartonWidthMm, dto.cartonHeightMm, dto.cartonCount);
      const saved = await em.save(Part, em.create(Part, {
        orderId: dto.orderId, partName: dto.partName, productCode, productFamily,
        divisionId: dto.divisionId, dcPrefixId: dto.dcPrefixId, masterPo: dto.masterPo,
        quantityPcs: dto.quantityPcs, totalWeightKg: dto.totalWeightKg.toString(), cartonCount: dto.cartonCount,
        cartonLengthMm: dto.cartonLengthMm, cartonWidthMm: dto.cartonWidthMm, cartonHeightMm: dto.cartonHeightMm,
        cbm, containerId: rack?.id || null, preferredRackSlot: chosenSlot,
        colorHex: dto.colorHex ?? nextPartColor(count), lotNumber: dto.lotNumber?.trim() || null,
        storageClass, uomCode: dto.uomCode || 'EA',
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
    const result = await this.dataSource.transaction(async manager => {
      await manager.query('SELECT id FROM parts WHERE id = $1 FOR UPDATE', [id]);
      const part = await manager.findOneBy(Part, { id });
      if (!part) throw new NotFoundException({ code: 'PART_NOT_FOUND', message: 'Không tìm thấy PART' });
      const previousLoad = { weightKg: Number(part.totalWeightKg), cbm: Number(part.cbm), slot: part.preferredRackSlot };
      const previousStorageClass = part.storageClass;
      const previousFamily = part.productFamily;
      const previousProductCode = part.productCode;
      const productCode = dto.productCode === undefined ? part.productCode : dto.productCode?.trim() || null;
      if (part.lotId && (productCode?.trim() !== part.productCode?.trim()
        || (dto.lotNumber !== undefined && dto.lotNumber?.trim() !== part.lotNumber?.trim()))) {
        throw new BadRequestException({ code: 'PART_LOT_IMMUTABLE', message: 'Không thể đổi SKU hoặc số lô của PART đã định danh' });
      }
      const productFamily = dto.productFamily !== undefined || productCode !== part.productCode || dto.storageClass !== undefined
        ? await resolveProductFamily(manager, productCode, dto.productFamily ?? part.productFamily, dto.storageClass || part.storageClass, part.id)
        : part.productFamily;
      const { rackId: _rackId, slotIndex: _slotIndex, ...editable } = dto;
      Object.assign(part, {
        ...editable, productCode, productFamily,
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
      const placementAffecting = (dto.quantityPcs !== undefined && process.env.WMS_ONE_SKU_PER_RACK === 'true')
        || productCode !== previousProductCode || part.storageClass !== previousStorageClass || part.productFamily !== previousFamily
        || dto.cartonLengthMm !== undefined || dto.cartonWidthMm !== undefined || dto.cartonHeightMm !== undefined
        || Math.abs(Number(part.totalWeightKg) - previousLoad.weightKg) > 0.001
        || Math.abs(Number(part.cbm) - previousLoad.cbm) > 0.000001;
      if (part.containerId && placementAffecting) {
        await manager.query('SELECT id FROM containers WHERE id = $1 FOR UPDATE', [part.containerId]);
        const rack = await manager.findOneBy(Container, { id: part.containerId });
        if (rack) {
          const zone = await manager.getRepository(WarehouseZone).findOne({ where: { warehouseCode: rack.warehouseCode, code: rack.zoneCode } });
          const peers = await manager.getRepository(Part).find({ where: { containerId: rack.id, id: Not(part.id) } });
          assertExpiryDeclared(part.storageClass, part.expirationDate);
          assertStoragePlacement({ productClass: part.storageClass, zoneMode: zone?.storageMode, rackClasses: peers.map((p) => p.storageClass), productName: part.partName, rackName: rack.name });
          assertRackProductFamily({ rackFamily: rack.productFamily, peers, productName: part.partName, productCode: part.productCode, productFamily: part.productFamily, zoneFamily: zone?.productFamily, rackName: rack.name });
          assertRackSlotFits(part, part.cartonCount, part.preferredRackSlot, rack);
          assertCapacity({ rackName: rack.name, partName: part.partName, limits: rackLimits(rack), others: peers.map((p) => ({ weightKg: Number(p.totalWeightKg), cbm: Number(p.cbm), slot: p.preferredRackSlot })), before: previousLoad, after: { weightKg: Number(part.totalWeightKg), cbm: Number(part.cbm), slot: part.preferredRackSlot } });
        }
      }
      await manager.save(part);
      await manager.save(HistoryEvent, manager.create(HistoryEvent, {
        type: HistoryEventType.PART_UPDATED, description: `Cập nhật PART ${part.partName}`,
        details: { partId: part.id }, timestamp: new Date(),
      }));
      return part.id;
    });
    return this.findOne(result);
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
      if (part.receivingDamaged) {
        throw new BadRequestException({ code: 'RECEIVING_DAMAGE_QUARANTINED', message: 'Hàng hỏng phải ở khu cách ly' });
      }
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
        assertRackProductFamily({ rackFamily: toRack.productFamily, peers, productName: part.partName, productCode: part.productCode, productFamily: part.productFamily, zoneFamily: zone?.productFamily, rackName: toRack.name });
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
        assertRackSlotFits(part, part.cartonCount, destinationSlot, toRack);
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
