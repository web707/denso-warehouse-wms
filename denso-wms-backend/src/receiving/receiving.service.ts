import { createHash, randomUUID } from 'node:crypto';
import { lockReceivingReceipts } from '../inspections/lot-quality';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { WarehouseZone } from '../warehouse-zones/entities/warehouse-zone.entity';
import { assertRackProductFamily, resolveProductFamily } from '../inventory/rack-product-family.rules';
import { assertRackSlotFits, assertCapacity, rackLimits } from '../inventory/inventory.rules';
import { assertStoragePlacement, preferredSlotsByExpiry } from '../inventory/storage-placement.rules';
import { Container } from '../containers/entities/container.entity';
import { InventoryTransaction, InventoryTransactionType } from '../inventory/entities/inventory-transaction.entity';
import { Order } from '../orders/entities/order.entity';
import { Part } from '../parts/entities/part.entity';
import { Division } from '../divisions/entities/division.entity';
import { DcPrefix } from '../divisions/entities/dc-prefix.entity';
import { Inspection } from '../inspections/entities/inspection.entity';
import {
  ApproveDiscrepancyDto,
  CreateReceivingReceiptDto,
  QueryReceivingReceiptsDto,
} from './dto/create-receiving-receipt.dto';
import { DiscrepancyType, ReceivingReceipt, ReceivingStatus } from './entities/receiving-receipt.entity';

@Injectable()
export class ReceivingService {
  constructor(
    @InjectRepository(ReceivingReceipt)
    private readonly receiptRepo: Repository<ReceivingReceipt>,
    private readonly dataSource: DataSource,
  ) {}

  private async findQuarantineSlot(em: EntityManager, rackId: string): Promise<number> {
    await em.query('SELECT id FROM containers WHERE id=$1 FOR UPDATE', [rackId]);
    const parts = await em.findBy(Part, { containerId: rackId });
    const occupied = new Set(parts.map(part => part.preferredRackSlot));
    const slot = Array.from({ length: 20 }, (_, index) => index).find(index => !occupied.has(index));
    if (slot === undefined) throw new BadRequestException({ code: 'QUARANTINE_RACK_FULL', message: 'Kệ cách ly hết ô trống' });
    return slot;
  }

  async create(dto: CreateReceivingReceiptDto, user: AuthenticatedUser, key?: string): Promise<ReceivingReceipt> {
    if (key !== undefined && !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_INVALID', message: 'Idempotency-Key không hợp lệ' });
    }
    const hash = key ? createHash('sha256').update(JSON.stringify(dto, Object.keys(dto).sort())).digest('hex') : null;
    return this.dataSource.transaction(async (em: EntityManager) => {
      if (key) {
        const [claim] = await em.query(`
          INSERT INTO receiving_idempotency(actor_id,request_key,payload_hash)
          VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING actor_id
        `, [user.id,key,hash]);
        if (!claim) {
          const [existing] = await em.query(`
            SELECT payload_hash,receipt_id FROM receiving_idempotency WHERE actor_id=$1 AND request_key=$2
          `, [user.id,key]);
          if (existing?.payload_hash !== hash || !existing.receipt_id) {
            throw new ConflictException({ code: 'RECEIVING_KEY_CONFLICT', message: 'Mã yêu cầu nhận hàng đã được sử dụng' });
          }
          return em.findOneByOrFail(ReceivingReceipt, { id: existing.receipt_id });
        }
      }
      if (dto.sourceDocumentId || dto.sourceLineNumber) {
        if (!dto.sourceDocumentId || !dto.sourceLineNumber) throw new BadRequestException('Cần mã chứng từ và dòng đã duyệt');
        const [source] = await em.query(`
          SELECT fields FROM warehouse_documents WHERE id=$1 AND reference_id IS NULL AND status IN ('DRAFT','ISSUED')
            AND kind IN ('01-VT','DELIVERY','PURCHASE_ORDER') AND (created_by=$2 OR $3)
          FOR UPDATE
        `,[dto.sourceDocumentId,user.id,['admin','warehouse_manager'].includes(user.role)]);
        const line = source?.fields?.lines?.[dto.sourceLineNumber-1];
        if (!line || line.sku!==dto.productCode.trim() || line.lot!==dto.lotNumber.trim() ||
            source.fields.po!==dto.poNumber.trim() || line.expected!==dto.expectedQuantityPcs) {
          throw new BadRequestException('Thông tin nhận phải khớp SKU, lô, PO và lượng dự kiến của dòng đã duyệt');
        }
        const [posted] = await em.query('SELECT 1 FROM warehouse_document_receipts WHERE document_id=$1 AND line_number=$2',
          [dto.sourceDocumentId,dto.sourceLineNumber]);
        if (posted) throw new ConflictException('Dòng chứng từ đã được nhận trước đó');
      }
      // New scoped PARTs must remain atomic with the legacy Shipment eligibility check.
      await lockReceivingReceipts(em, false);
      const discrepancyQty = dto.receivedQuantityPcs - dto.expectedQuantityPcs;
      const discrepancyType = discrepancyQty === 0
        ? DiscrepancyType.MATCH
        : (discrepancyQty < 0 ? DiscrepancyType.SHORTAGE : DiscrepancyType.OVERAGE);

      const damagedQty = Math.max(0, dto.damagedQuantityPcs || 0);
      if (damagedQty > dto.receivedQuantityPcs) {
        throw new BadRequestException({
          code: 'DAMAGED_EXCEEDS_RECEIVED',
          message: 'Số lượng hàng hỏng không thể lớn hơn số lượng thực nhận',
        });
      }

      const goodQty = dto.receivedQuantityPcs - damagedQty;
      const hasDiscrepancy = discrepancyQty !== 0 || damagedQty > 0;
      const status = hasDiscrepancy
        ? ReceivingStatus.DISCREPANCY_PENDING
        : ReceivingStatus.COMPLETED;

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      // Find or default order, division, prefix
      let orderId = dto.orderId;
      if (!orderId) {
        const order = await em.findOne(Order, { where: {} });
        orderId = order?.id;
      }
      if (!orderId) {
        throw new BadRequestException({ code: 'ORDER_NOT_FOUND', message: 'Hệ thống cần ít nhất một Đơn hàng cơ sở' });
      }

      const div = await em.findOne(Division, { where: {} });
      const pfx = div ? await em.findOne(DcPrefix, { where: { divisionId: div.id } }) : null;
      if (!div || !pfx) {
        throw new BadRequestException({ code: 'DIVISION_NOT_FOUND', message: 'Hệ thống cần ít nhất một Ngành hàng và Tiền tố DC' });
      }

      // Find Quarantine rack if damaged items present
      let quarantineRack: Container | null = null;
      if (damagedQty > 0) {
        quarantineRack = await em.findOne(Container, { where: { name: 'R-QUARANTINE' } });
        if (!quarantineRack) {
          quarantineRack = await em.findOne(Container, { where: { zoneCode: 'ZONE-Q' } });
        }
      }

      if (damagedQty > 0 && !quarantineRack) {
        throw new BadRequestException({ code: 'QUARANTINE_RACK_REQUIRED', message: 'Cần kệ cách ly để nhận hàng hỏng' });
      }
      const quarantineSlot = quarantineRack ? await this.findQuarantineSlot(em, quarantineRack.id) : null;
      const storageClass = dto.storageClass || 'dry_food';
      const productFamily = await resolveProductFamily(em, dto.productCode, null, storageClass);
      const expirationDate = dto.expirationDate || null;
      const goodShare = dto.receivedQuantityPcs ? goodQty / dto.receivedQuantityPcs : 0;
      const goodCartons = Math.round((dto.cartonCount ?? 0) * goodShare);
      const goodWeight = Number(((dto.totalWeightKg ?? 0) * goodShare).toFixed(2));
      let goodPartId: string | null = null;
      let damagedPartId: string | null = null;
      const ledger: { entry: InventoryTransaction; note: (receiptNumber: string) => string }[] = [];

      // 1. Create PART for good stock (if goodQty > 0)
      if (goodQty > 0) {
        const part = em.create(Part, {
          orderId,
          partName: dto.partName.trim(),
          productCode: dto.productCode.trim(),
          lotNumber: dto.lotNumber.trim(),
          qualityScopeId: randomUUID(),
          quantityPcs: goodQty,
          cartonCount: goodCartons,
          totalWeightKg: goodWeight.toFixed(2),
          cartonLengthMm: 300,
          cartonWidthMm: 200,
          cartonHeightMm: 200,
          cbm: ((300 * 200 * 200 * goodCartons) / 1e9).toFixed(6),
          divisionId: div.id,
          dcPrefixId: pfx.id,
          masterPo: dto.poNumber.trim(),
          colorHex: '#3b82f6',
          containerId: dto.targetRackId || null,
          preferredRackSlot: null,
          productFamily,
          storageClass,
          expirationDate,
        });
        if (dto.targetRackId) {
          await em.query('SELECT id FROM containers WHERE id=$1 FOR UPDATE', [dto.targetRackId]);
          const rack = await em.findOneByOrFail(Container, { id: dto.targetRackId });
          const peers = await em.findBy(Part, { containerId: rack.id });
          const zone = await em.findOneBy(WarehouseZone, { warehouseCode: rack.warehouseCode, code: rack.zoneCode });
          assertStoragePlacement({ productClass: storageClass, zoneMode: zone?.storageMode, rackClasses: peers.map(peer => peer.storageClass),
            productName: part.partName, rackName: rack.name });
          assertRackProductFamily({ rackFamily: rack.productFamily, peers, productName: part.partName, productCode: part.productCode,
            productFamily, zoneFamily: zone?.productFamily, rackName: rack.name });
          const occupied = new Set(peers.map(peer => peer.preferredRackSlot));
          const slot = dto.targetSlot ?? preferredSlotsByExpiry(expirationDate).find(index => !occupied.has(index));
          if (slot === undefined || slot < 0 || slot >= 20 || occupied.has(slot)) {
            throw new BadRequestException({ code: 'RACK_FULL', message: 'Ô đích không khả dụng' });
          }
          assertRackSlotFits(part, goodCartons, slot, rack);
          assertCapacity({ rackName: rack.name, partName: part.partName, limits: rackLimits(rack), before: null,
            others: peers.map(peer => ({ weightKg: Number(peer.totalWeightKg), cbm: Number(peer.cbm), slot: peer.preferredRackSlot })),
            after: { weightKg: goodWeight, cbm: Number(part.cbm), slot } });
          part.preferredRackSlot = slot;
        }
        const savedPart = await em.save(Part, part);
        goodPartId = savedPart.id;

        // Log inbound transaction
        ledger.push({
          entry: em.create(InventoryTransaction, {
            type: InventoryTransactionType.INBOUND,
            partId: savedPart.id,
            lotId: (await em.findOneByOrFail(Part, { id: savedPart.id })).lotId,
            partName: savedPart.partName,
            productCode: savedPart.productCode,
            orderId: savedPart.orderId,
            toRackId: savedPart.containerId,
            toSlot: savedPart.preferredRackSlot,
            quantityPcs: goodQty,
            cartonCount: goodCartons,
            weightKg: goodWeight.toFixed(2),
            performedBy: user?.id,
            performedByEmail: user?.email,
          }),
          note: number => `Nhập kho theo phiếu ${number} (PO: ${dto.poNumber})`,
        });
      }

      // 2. Create quarantined PART and inspection for damaged stock (if damagedQty > 0)
      if (damagedQty > 0 && quarantineRack) {
        const damagedCartons = (dto.cartonCount ?? 0) - goodCartons;
        const damagedWeight = Number(((dto.totalWeightKg ?? 0) - goodWeight).toFixed(2));

        const damagedPart = em.create(Part, {
          orderId,
          partName: `[HÀNG HỎNG] ${dto.partName.trim()}`,
          productCode: dto.productCode.trim(),
          lotNumber: dto.lotNumber.trim(),
          qualityScopeId: randomUUID(),
          receivingDamaged: true,
          quantityPcs: damagedQty,
          cartonCount: damagedCartons,
          totalWeightKg: damagedWeight.toFixed(2),
          cartonLengthMm: 300,
          cartonWidthMm: 200,
          cartonHeightMm: 200,
          cbm: ((300 * 200 * 200 * damagedCartons) / 1e9).toFixed(6),
          divisionId: div.id,
          dcPrefixId: pfx.id,
          masterPo: dto.poNumber.trim(),
          colorHex: '#ef4444',
          containerId: quarantineRack.id,
          preferredRackSlot: quarantineSlot,
          storageClass,
          expirationDate,
        });
        const peers = await em.findBy(Part, { containerId: quarantineRack.id });
        assertRackSlotFits(damagedPart, damagedCartons, quarantineSlot, quarantineRack);
        assertCapacity({ rackName: quarantineRack.name, partName: damagedPart.partName, limits: rackLimits(quarantineRack), before: null,
          others: peers.map(peer => ({ weightKg: Number(peer.totalWeightKg), cbm: Number(peer.cbm), slot: peer.preferredRackSlot })),
          after: { weightKg: damagedWeight, cbm: Number(damagedPart.cbm), slot: quarantineSlot } });
        const savedDamagedPart = await em.save(Part, damagedPart);
        damagedPartId = savedDamagedPart.id;

        // Query the refreshed lot_id assigned by database trigger parts_assign_lot_identity
        const [refreshedDamaged] = await em.query('SELECT lot_id, lot_number FROM parts WHERE id = $1', [savedDamagedPart.id]);
        const finalLotId = refreshedDamaged?.lot_id || savedDamagedPart.lotId;

        // Auto-assign QC = BLOCKED for damaged lot so FEFO can NEVER pick it
        const insp = new Inspection();
        insp.inspectionId = `INSP-DMG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        insp.lotNumber = refreshedDamaged?.lot_number || savedDamagedPart.lotNumber || `LOT-DMG-${Date.now()}`;
        insp.lotId = finalLotId;
        insp.qualityScopeId = savedDamagedPart.qualityScopeId;
        insp.sampleSize = damagedQty;
        insp.passQuantity = 0;
        insp.failQuantity = damagedQty;
        insp.judgment = 'BLOCKED';
        insp.defectCode = 'DAMAGED_ON_ARRIVAL';
        insp.inspectorId = user?.email || 'SYSTEM_RECEIVING';
        await em.save(Inspection, insp);

        // Log quarantine transaction
        ledger.push({
          entry: em.create(InventoryTransaction, {
            type: InventoryTransactionType.INBOUND,
            partId: savedDamagedPart.id,
            lotId: finalLotId,
            partName: savedDamagedPart.partName,
            productCode: savedDamagedPart.productCode,
            orderId: savedDamagedPart.orderId,
            toRackId: quarantineRack.id,
            toSlot: quarantineSlot,
            quantityPcs: damagedQty,
            cartonCount: damagedCartons,
            weightKg: damagedWeight.toFixed(2),
            performedBy: user?.id,
            performedByEmail: user?.email,
          }),
          note: number => `Cách ly hàng hỏng tại cửa nhận theo phiếu ${number}: ${dto.discrepancyReason || 'Móp méo/vỡ thùng'}`,
        });
      }

      // 3. Save ReceivingReceipt record
      const lotId = ledger[0]?.entry.lotId ?? null;
      await em.query("SELECT pg_advisory_xact_lock(hashtext('MASAN_WMS_RECEIPT_NUMBER'), 0)");
      const count = await em.count(ReceivingReceipt);
      const receiptNumber = `REC-${dateStr}-${String(count + 1).padStart(4, '0')}`;
      const receipt = em.create(ReceivingReceipt, {
        receiptNumber,
        poNumber: dto.poNumber.trim(),
        productCode: dto.productCode.trim(),
        partName: dto.partName.trim(),
        lotNumber: dto.lotNumber.trim(),
        lotId,
        expectedQuantityPcs: dto.expectedQuantityPcs,
        receivedQuantityPcs: dto.receivedQuantityPcs,
        discrepancyQuantityPcs: discrepancyQty,
        discrepancyType,
        damagedQuantityPcs: damagedQty,
        goodQuantityPcs: goodQty,
        cartonCount: dto.cartonCount || 0,
        totalWeightKg: dto.totalWeightKg || 0,
        targetRackId: dto.targetRackId || null,
        targetSlot: dto.targetSlot ?? null,
        quarantineRackId: quarantineRack?.id || null,
        discrepancyReason: dto.discrepancyReason?.trim() || null,
        status,
        receivedBy: user?.email || 'staff@masan.local',
        partId: goodPartId,
        damagedPartId,
        note: dto.note?.trim() || null,
      });

      const saved = await em.save(ReceivingReceipt, receipt);
      if (ledger.length) await em.save(InventoryTransaction, ledger.map(({entry,note}) => {
        entry.note = note(receiptNumber);
        return entry;
      }));
      if (key) await em.query('UPDATE receiving_idempotency SET receipt_id=$3 WHERE actor_id=$1 AND request_key=$2', [user.id,key,saved.id]);
      if (dto.sourceDocumentId) await em.query('INSERT INTO warehouse_document_receipts(document_id,line_number,receipt_id) VALUES ($1,$2,$3)',
        [dto.sourceDocumentId,dto.sourceLineNumber,saved.id]);
      return saved;
    });
  }

  async findAll(query: QueryReceivingReceiptsDto = {}): Promise<ReceivingReceipt[]> {
    const qb = this.receiptRepo.createQueryBuilder('r')
      .orderBy('r.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }
    if (query.discrepancyType) {
      qb.andWhere('r.discrepancyType = :discrepancyType', { discrepancyType: query.discrepancyType });
    }
    if (query.search) {
      qb.andWhere(
        '(r.receiptNumber ILIKE :search OR r.poNumber ILIKE :search OR r.productCode ILIKE :search OR r.lotNumber ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }
    return qb.getMany();
  }

  async findOne(id: string): Promise<ReceivingReceipt> {
    const receipt = await this.receiptRepo.findOne({ where: { id } });
    if (!receipt) {
      throw new NotFoundException({ code: 'RECEIPT_NOT_FOUND', message: 'Không tìm thấy phiếu nhận hàng' });
    }
    return receipt;
  }

  async approveDiscrepancy(id: string, user: AuthenticatedUser, dto: ApproveDiscrepancyDto = {}): Promise<ReceivingReceipt> {
    const receipt = await this.findOne(id);
    if (user.role !== 'admin' && user.role !== 'warehouse_manager') {
      throw new ForbiddenException({
        code: 'FORBIDDEN_APPROVAL',
        message: 'Chỉ Quản lý kho hoặc Quản trị viên mới có quyền duyệt biên bản sai lệch nhận hàng',
      });
    }

    if (receipt.status === ReceivingStatus.DISCREPANCY_APPROVED) {
      throw new BadRequestException({
        code: 'ALREADY_APPROVED',
        message: 'Biên bản này đã được phê duyệt trước đó, không thể duyệt lại',
      });
    }

    if (receipt.status !== ReceivingStatus.DISCREPANCY_PENDING) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_FOR_APPROVAL',
        message: 'Chỉ có thể phê duyệt biên bản đang ở trạng thái chờ duyệt (DISCREPANCY_PENDING)',
      });
    }

    // Enterprise SoD: Segregation of Duties - Ngăn người lập tự duyệt biên bản
    if (receipt.receivedBy && user.email && receipt.receivedBy.toLowerCase() === user.email.toLowerCase()) {
      throw new ForbiddenException({
        code: 'SELF_APPROVAL_FORBIDDEN',
        message: 'Nguyên tắc kiểm soát nội bộ (Segregation of Duties): Người lập phiếu nhận hàng không được tự phê duyệt biên bản của chính mình',
      });
    }

    receipt.status = ReceivingStatus.DISCREPANCY_APPROVED;
    receipt.approvedBy = user.email;
    const nowStr = new Date().toISOString();
    const noteContent = dto.approvalNote || dto.approvalNotes || 'Đã kiểm tra và phê duyệt';
    const approvalLog = `[Duyệt bởi ${user.email} lúc ${nowStr}]: ${noteContent}`;
    receipt.note = receipt.note ? `${receipt.note} | ${approvalLog}` : approvalLog;

    return this.receiptRepo.save(receipt);
  }

  async getDiscrepancySummary(): Promise<{ pendingCount: number; approvedCount: number; totalShortagePcs: number; totalDamagedPcs: number }> {
    const receipts = await this.receiptRepo.find();
    let pendingCount = 0;
    let approvedCount = 0;
    let totalShortagePcs = 0;
    let totalDamagedPcs = 0;

    for (const r of receipts) {
      if (r.status === ReceivingStatus.DISCREPANCY_PENDING) pendingCount++;
      if (r.status === ReceivingStatus.DISCREPANCY_APPROVED) approvedCount++;
      if (r.discrepancyQuantityPcs < 0) totalShortagePcs += Math.abs(r.discrepancyQuantityPcs);
      totalDamagedPcs += r.damagedQuantityPcs || 0;
    }

    return { pendingCount, approvedCount, totalShortagePcs, totalDamagedPcs };
  }
}
