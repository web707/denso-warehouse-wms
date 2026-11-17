import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, ILike, Repository } from 'typeorm';
import { CreateInspectionDto, QueryInspectionsDto, UpdateInspectionDto } from './dto/create-inspection.dto';
import { Part } from '../parts/entities/part.entity';
import { Inspection } from './entities/inspection.entity';

import { UserRole } from '../auth/entities/user.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { HistoryEvent, HistoryEventType } from '../history/entities/history-event.entity';
import { findLotIdentity, isLotAvailable, latestLotQuality, lockLotQuality, lockQualityScopes, QC_ORDER } from './lot-quality';

export interface LotQualityStatus {
  lotId: string;
  productCode: string;
  requiresReinspection: boolean;
  lotNumber: string;
  judgment: string;
  inspectionId: string | null;
  inspectionType: string | null;
  inspectionDate: Date | null;
}

/** Kết luận mặc định khi người dùng không chọn: có lỗi hoặc đo ngoài dung sai thì NG. */
export function deriveJudgment(i: Pick<Inspection, 'failQuantity' | 'measuredValue1' | 'upperTolerance' | 'lowerTolerance'>): 'OK' | 'NG' {
  return i.failQuantity > 0 || isOutOfTolerance(i) ? 'NG' : 'OK';
}

export function isOutOfTolerance(i: Pick<Inspection, 'measuredValue1' | 'upperTolerance' | 'lowerTolerance'>): boolean {
  if (i.measuredValue1 === null || i.measuredValue1 === undefined) return false;
  if (i.upperTolerance !== null && i.upperTolerance !== undefined && i.measuredValue1 > i.upperTolerance) return true;
  if (i.lowerTolerance !== null && i.lowerTolerance !== undefined && i.measuredValue1 < i.lowerTolerance) return true;
  return false;
}

@Injectable()
export class InspectionsService {
  constructor(@InjectRepository(Inspection) private readonly repo: Repository<Inspection>) {}

  async findAll(q: QueryInspectionsDto): Promise<Array<Inspection & { productCode: string | null; requiresReinspection: boolean }>> {
    const base: Record<string, unknown> = {};
    if (q.judgment) base.judgment = q.judgment;
    if (q.lotNumber) base.lotNumber = q.lotNumber;
    if (q.workOrderNumber) base.workOrderNumber = q.workOrderNumber;
    const where = q.search
      ? ['inspectionId', 'lotNumber', 'workOrderNumber', 'defectCode', 'inspectorId'].map((f) => ({ ...base, [f]: ILike(`%${q.search}%`) }))
      : base;
    const rows = await this.repo.find({ where, order: QC_ORDER, take: 1000 });
    const ids = [...new Set(rows.flatMap(row => row.lotId ? [row.lotId] : []))];
    const lots: Array<{ id: string; product_code: string }> = ids.length
      ? await this.repo.manager.query('SELECT id, product_code FROM inventory_lots WHERE id = ANY($1::uuid[])', [ids])
      : [];
    const sku = new Map(lots.map(lot => [lot.id, lot.product_code]));
    return rows.map(row => Object.assign(row, {
      productCode: sku.get(row.lotId ?? '') ?? null,
      requiresReinspection: !row.lotId,
    }));
  }

  async findOne(id: string): Promise<Inspection & { requiresReinspection: boolean }> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'INSPECTION_NOT_FOUND', message: 'Không tìm thấy phiếu kiểm tra' });
    return Object.assign(row, { requiresReinspection: !row.lotId });
  }

  async lotStatus(): Promise<LotQualityStatus[]> {
    return this.repo.manager.query(`
      WITH latest AS (
        SELECT DISTINCT ON (COALESCE(quality_scope_id, lot_id)) * FROM inspections WHERE lot_id IS NOT NULL
        ORDER BY COALESCE(quality_scope_id, lot_id), inspection_date DESC, created_at DESC, id DESC
      )
      SELECT l.id AS "lotId", l.product_code AS "productCode", l.lot_number AS "lotNumber",
        COALESCE(i.judgment, 'REINSPECTION_REQUIRED') AS judgment,
        i.inspection_id AS "inspectionId", i.inspection_type AS "inspectionType",
        i.inspection_date AS "inspectionDate", (i.id IS NULL) AS "requiresReinspection", NULL::uuid AS "qualityScopeId"
      FROM inventory_lots l LEFT JOIN latest i ON i.lot_id = l.id AND i.quality_scope_id IS NULL
      UNION ALL
      SELECT p.lot_id, l.product_code, l.lot_number,
        CASE WHEN p.receiving_damaged THEN 'BLOCKED' ELSE COALESCE(i.judgment, 'REINSPECTION_REQUIRED') END,
        i.inspection_id, i.inspection_type, i.inspection_date, i.id IS NULL,
        p.quality_scope_id
      FROM (SELECT DISTINCT lot_id, quality_scope_id, receiving_damaged FROM parts WHERE quality_scope_id IS NOT NULL) p
      JOIN inventory_lots l ON l.id=p.lot_id LEFT JOIN latest i ON i.quality_scope_id=p.quality_scope_id
    `);
  }

  async create(dto: CreateInspectionDto, user: AuthenticatedUser): Promise<Inspection> {
    const inspectionId = dto.inspectionId || (await this.generateId());
    return this.repo.manager.transaction(async manager => {
      await lockLotQuality(manager, !dto.partId);
      if (await manager.findOne(Inspection, { where: { inspectionId } })) {
        throw new ConflictException({ code: 'INSPECTION_DUPLICATE', message: 'Mã phiếu kiểm định đã tồn tại' });
      }
      const { productCode, partId, ...values } = dto;
      const lotNumber = dto.lotNumber.trim();
      const lotId = await findLotIdentity(manager, productCode, lotNumber);
      if (!lotId) throw new BadRequestException({ code: 'QC_LOT_IDENTITY_REQUIRED', message: 'Cần chọn đúng SKU và số lô trong kho' });
      const part = partId ? await manager.findOneBy(Part, { id: partId }) : null;
      if (partId && (!part || part.lotId !== lotId || !part.qualityScopeId || part.receivingDamaged)) {
        throw new BadRequestException({ code: 'QC_INVALID_RECEIVING_PART', message: 'Chọn PART nhận hàng không hỏng thuộc đúng SKU và lô' });
      }
      const qualityKey = part?.qualityScopeId ?? lotId;
      if (part?.qualityScopeId) await lockQualityScopes(manager, [qualityKey], true);
      const entity = manager.create(Inspection, {
        ...values, inspectionId, lotNumber, lotId, qualityScopeId: part?.qualityScopeId ?? null,
        inspectionDate: dto.inspectionDate ? new Date(dto.inspectionDate) : new Date(),
      });
      if (!dto.judgment) entity.judgment = deriveJudgment(entity);
      this.validate(entity);
      const before = (await latestLotQuality(manager, [qualityKey])).get(qualityKey)?.judgment;
      if (isLotAvailable(entity.judgment) && !isLotAvailable(before)) {
        const [legacy] = await manager.query(
          'SELECT 1 FROM inspections WHERE lot_id IS NULL AND btrim(lot_number) = $1 LIMIT 1', [lotNumber],
        );
        if (before !== undefined || legacy) this.assertCanRelease(user);
      }
      const saved = await manager.save(entity);
      await this.audit(manager, saved, user, 'create', before);
      return saved;
    });
  }

  async update(id: string, dto: UpdateInspectionDto, user: AuthenticatedUser): Promise<Inspection> {
    return this.repo.manager.transaction(async manager => {
      await lockLotQuality(manager, true);
      this.assertCanRelease(user);
      const row = await this.findForWrite(manager, id);
      if (!row.lotId) throw new BadRequestException({ code: 'QC_HISTORY_REQUIRED', message: 'Giữ phiếu lịch sử và tạo phiếu kiểm định mới theo SKU' });
      const { productCode, partId, ...values } = dto;
      if (partId) throw new BadRequestException({ code: 'INSPECTION_SCOPE_IMMUTABLE', message: 'Không thể đổi phạm vi của phiếu kiểm định' });
      if ((dto.lotNumber !== undefined && dto.lotNumber?.trim() !== row.lotNumber)
        || (productCode !== undefined && await findLotIdentity(manager, productCode, row.lotNumber) !== row.lotId)) {
        throw new BadRequestException({ code: 'INSPECTION_LOT_IMMUTABLE', message: 'Không thể đổi lô của phiếu kiểm định đã ghi' });
      }
      if (dto.inspectionId && dto.inspectionId !== row.inspectionId
        && await manager.findOne(Inspection, { where: { inspectionId: dto.inspectionId } })) {
        throw new ConflictException({ code: 'INSPECTION_DUPLICATE', message: 'Mã phiếu kiểm định đã tồn tại' });
      }
      const before = row.lotId ? (await latestLotQuality(manager, [row.qualityScopeId ?? row.lotId])).get(row.qualityScopeId ?? row.lotId)?.judgment : undefined;
      const previousJudgment = row.judgment;
      Object.assign(row, values, { lotNumber: row.lotNumber }, dto.inspectionDate ? { inspectionDate: new Date(dto.inspectionDate) } : {});
      this.validate(row);
      const saved = await manager.save(row);
      await this.audit(manager, saved, user, 'update', before, previousJudgment);
      return saved;
    });
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    return this.repo.manager.transaction(async manager => {
      await lockLotQuality(manager, true);
      this.assertCanRelease(user);
      const row = await this.findForWrite(manager, id);
      if (!row.lotId || !isLotAvailable(row.judgment)) {
        throw new BadRequestException({ code: 'QC_HISTORY_REQUIRED', message: 'Giữ phiếu kiểm định chặn xuất để truy vết' });
      }
      const before = row.lotId ? (await latestLotQuality(manager, [row.qualityScopeId ?? row.lotId])).get(row.qualityScopeId ?? row.lotId)?.judgment : undefined;
      await manager.delete(Inspection, id);
      await this.audit(manager, row, user, 'delete', before, row.judgment);
    });
  }

  private async findForWrite(manager: EntityManager, id: string): Promise<Inspection> {
    const row = await manager.findOne(Inspection, { where: { id } });
    if (!row) throw new NotFoundException({ code: 'INSPECTION_NOT_FOUND', message: 'Không tìm thấy phiếu kiểm tra' });
    return row;
  }

  private assertCanRelease(user: AuthenticatedUser): void {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.WAREHOUSE_MANAGER) {
      throw new ForbiddenException({ code: 'QC_RELEASE_FORBIDDEN', message: 'Chỉ quản trị viên hoặc quản lý kho được giải phóng lô' });
    }
  }

  private async audit(manager: EntityManager, row: Inspection, user: AuthenticatedUser, action: string, before?: string, previousJudgment?: string): Promise<void> {
    const after = row.lotId ? (await latestLotQuality(manager, [row.qualityScopeId ?? row.lotId])).get(row.qualityScopeId ?? row.lotId)?.judgment : undefined;
    await manager.save(HistoryEvent, manager.create(HistoryEvent, {
      type: HistoryEventType.INSPECTION_CHANGED,
      description: `Kiểm định ${row.inspectionId} · ${row.lotNumber}`,
      timestamp: new Date(),
      details: { action, actorId: user.id, inspectionId: row.inspectionId, lotNumber: row.lotNumber, lotId: row.lotId, qualityScopeId: row.qualityScopeId,
        before: before ?? null, after: after ?? null, previousJudgment: previousJudgment ?? null, judgment: row.judgment },
    }));
  }

  private validate(i: Inspection): void {
    if (!i.lotNumber.trim()) throw new BadRequestException({ code: 'QC_LOT_REQUIRED', message: 'Cần nhập số lô kiểm định' });
    if (i.passQuantity + i.failQuantity > i.sampleSize) {
      throw new BadRequestException({
        code: 'INSPECTION_QUANTITY_EXCEEDED',
        message: 'Số đạt + số lỗi không được vượt quá cỡ mẫu',
      });
    }
    if (
      i.upperTolerance !== null && i.upperTolerance !== undefined &&
      i.lowerTolerance !== null && i.lowerTolerance !== undefined &&
      i.upperTolerance < i.lowerTolerance
    ) {
      throw new BadRequestException({ code: 'INSPECTION_TOLERANCE', message: 'Dung sai trên phải lớn hơn hoặc bằng dung sai dưới' });
    }
    if (isLotAvailable(i.judgment) && (i.failQuantity > 0 || isOutOfTolerance(i))) {
      throw new BadRequestException({
        code: 'INSPECTION_JUDGMENT_CONFLICT',
        message: 'Không thể kết luận OK khi có sản phẩm lỗi hoặc giá trị đo nằm ngoài dung sai. Hãy chọn NG hoặc HOLD',
      });
    }
  }

  private async generateId(): Promise<string> {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const id = `INS-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      if (!(await this.repo.findOne({ where: { inspectionId: id } }))) return id;
    }
    return `INS-${stamp}-${Date.now().toString(36).toUpperCase()}`;
  }
}
