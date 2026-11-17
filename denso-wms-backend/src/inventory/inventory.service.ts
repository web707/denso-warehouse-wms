import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../auth/entities/user.entity';
import { OpenCycleDto, RecordCycleDto } from './dto/cycle-count.dto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { PUBLIC_USER_ID } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Container } from '../containers/entities/container.entity';
import { isLotAvailable, latestLotQuality, lockLotQuality, lockQualityScopes } from '../inspections/lot-quality';
import { Part } from '../parts/entities/part.entity';
import { WarehouseZone } from '../warehouse-zones/entities/warehouse-zone.entity';
import { assertExpiryDeclared, assertStoragePlacement, preferredSlotsByExpiry, requiresExpiry } from './storage-placement.rules';
import { assertRackProductFamily } from './rack-product-family.rules';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { QueryHeatmapDto } from './dto/query-heatmap.dto';
import { InventoryTransaction, InventoryTransactionType } from './entities/inventory-transaction.entity';
import {
  Amounts, LoadItem, Stock, assertCapacity, assertInboundLocation, assertRackSlotFits, planOutbound, planTransfer, rackLimits,
} from './inventory.rules';

interface StockSnapshot {
  id: string;
  quantityPcs: number;
  cartonCount: number;
  totalWeightKg: number;
  rackId: string | null;
  preferredRackSlot: number | null;
}

type InventoryWrite = InventoryTransaction & { partSnapshot: StockSnapshot };
type InventoryResult = InventoryWrite & { allocations?: InventoryWrite[] };

function cbmFor(part: Part, cartons: number): string {
  return ((part.cartonLengthMm * part.cartonWidthMm * part.cartonHeightMm * cartons) / 1_000_000_000).toFixed(6);
}

function getHeatmapColor(score: number): {
  level: 'HOT' | 'WARM' | 'MODERATE' | 'COLD';
  color: string;
  velocityClass: 'A' | 'B' | 'C';
} {
  if (score > 80) return { level: 'HOT', color: '#ef4444', velocityClass: 'A' };
  if (score >= 60) return { level: 'WARM', color: '#f97316', velocityClass: 'A' };
  if (score >= 30) return { level: 'MODERATE', color: '#eab308', velocityClass: 'B' };
  return { level: 'COLD', color: '#3b82f6', velocityClass: 'C' };
}

function getSlotHeatColor(score: number): string {
  if (score > 80) return '#ef4444';
  if (score >= 60) return '#f97316';
  if (score >= 30) return '#eab308';
  return '#3b82f6';
}

export interface HeatmapRackItem {
  id: string;
  name: string;
  warehouseCode: string;
  zoneCode: string;
  orderId: string | null;
  operations: {
    total: number;
    inbound: number;
    outbound: number;
    transfer: number;
  };
  metrics: {
    totalPcs: number;
    totalCartons: number;
    totalWeightKg: number;
  };
  score: number;
  level: 'HOT' | 'WARM' | 'MODERATE' | 'COLD';
  color: string;
  velocityClass: 'A' | 'B' | 'C';
  slots: Record<number, { slotIndex: number; operations: number; score: number; color: string }>;
}

export interface HeatmapZoneItem {
  zoneCode: string;
  warehouseCode: string;
  rackCount: number;
  totalOperations: number;
  averageScore: number;
  hotRacksCount: number;
}

export interface HeatmapResponse {
  timeWindowDays: number;
  cutoffDate: string;
  summary: {
    totalTransactions: number;
    totalRackOperations: number;
    activeRacksCount: number;
    hotRacksCount: number;
    coldRacksCount: number;
    maxOperations: number;
    minOperations: number;
    hottestRack: { id: string; name: string; score: number; operations: number } | null;
    coldestRack: { id: string; name: string; score: number; operations: number } | null;
    paretoRatio: {
      top20PercentRacksTraffic: number;
      description: string;
    };
  };
  zones: Record<string, HeatmapZoneItem>;
  racks: Record<string, HeatmapRackItem>;
  rackList: HeatmapRackItem[];
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryTransaction) private readonly transactions: Repository<InventoryTransaction>,
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(Container) private readonly racks: Repository<Container>,
    private readonly dataSource: DataSource,
  ) {}

  async list(params: { type?: InventoryTransactionType; orderId?: string; partId?: string; lotId?: string; rackId?: string; limit?: number }) {
    const where: FindOptionsWhere<InventoryTransaction> = {};
    if (params.type) where.type = params.type;
    if (params.orderId) where.orderId = params.orderId;
    if (params.partId) where.partId = params.partId;
    if (params.lotId) where.lotId = params.lotId;
    return this.transactions.find({
      where: params.rackId ? [{ ...where, fromRackId: params.rackId }, { ...where, toRackId: params.rackId }] : where,
      order: { createdAt: 'DESC', id: 'DESC' },
      take: Math.max(1, Math.min(500, params.limit || 200)),
    });
  }

  /**
   * Khóa dòng trong transaction. Luôn khóa PART trước rồi mới tới kệ để hai giao dịch không chờ nhau vòng tròn.
   * Nhờ vậy hai lệnh xuất cùng một PART chạy lần lượt, và hai PART cùng vào một kệ không lọt cùng một ô.
   */
  private async lockRow(em: EntityManager, table: 'parts' | 'containers', id: string): Promise<void> {
    await em.query(`SELECT id FROM ${table} WHERE id = $1 FOR UPDATE`, [id]);
  }

  private async ensureSlotAvailable(em: EntityManager, partId: string | null, rackId: string, slot: number | null | undefined) {
    const rack = await em.findOne(Container, { where: { id: rackId } });
    if (!rack) throw new NotFoundException({ code: 'RACK_NOT_FOUND', message: 'Không tìm thấy kệ đích' });
    if (slot === null || slot === undefined) return rack;
    const conflict = await em.findOne(Part, {
      where: { containerId: rackId, preferredRackSlot: slot, ...(partId ? { id: Not(partId) } : {}) },
    });
    if (conflict) {
      throw new BadRequestException({
        code: 'RACK_SLOT_OCCUPIED',
        message: `Ô S${String(slot + 1).padStart(2, '0')} đang được dùng bởi ${conflict.partName}`,
      });
    }
    return rack;
  }

  private async checkCapacity(em: EntityManager, rack: Container, part: Part, after: LoadItem, cartonCount = part.cartonCount): Promise<void> {
    // Không khóa kệ theo đơn hàng tạo ra nó: Zone có 20 kệ vật lý dùng chung.
    // Các kiểm tra bảo quản, sức chứa và ô chứa vẫn áp dụng cho toàn bộ PART.
    const inRack = await em.find(Part, { where: { containerId: rack.id } });
    const zone = await em.findOne(WarehouseZone, { where: { warehouseCode: rack.warehouseCode, code: rack.zoneCode } });
    assertExpiryDeclared(part.storageClass, part.expirationDate);
    assertStoragePlacement({
      productClass: part.storageClass, zoneMode: zone?.storageMode,
      rackClasses: inRack.filter((p) => p.id !== part.id).map((p) => p.storageClass),
      productName: part.partName, rackName: `${rack.zoneCode}/${rack.name}`,
    });
    assertRackProductFamily({ rackFamily: rack.productFamily, peers: inRack.filter((p) => p.id !== part.id), productName: part.partName, productCode: part.productCode, productFamily: part.productFamily, zoneFamily: zone?.productFamily, rackName: `${rack.zoneCode}/${rack.name}` });
    assertRackSlotFits(part, cartonCount, after.slot, rack);
    const toLoad = (p: Part): LoadItem => ({ weightKg: Number(p.totalWeightKg), cbm: Number(p.cbm), slot: p.preferredRackSlot });
    const mine = inRack.find((p) => p.id === part.id);
    assertCapacity({
      rackName: rack.name,
      partName: part.partName,
      limits: rackLimits(rack),
      others: inRack.filter((p) => p.id !== part.id).map(toLoad),
      before: mine ? toLoad(mine) : null,
      after,
    });
  }

  cycleCounters() {
    return this.dataSource.query("SELECT id,email FROM users WHERE role IN ('admin','warehouse_manager','warehouse_staff') ORDER BY email");
  }

  async listCycles(user: AuthenticatedUser) {
    const manager = user.role === UserRole.ADMIN || user.role === UserRole.WAREHOUSE_MANAGER;
    return this.dataSource.query(`
      SELECT c.id,c.part_id,c.status,c.created_at,c.reason,c.adjustment_id,c.first_counter,c.second_counter,
        p.product_code,p.lot_number,r.zone_code,r.name AS rack_name,p.preferred_rack_slot,
        CASE WHEN c.status='CLOSED' OR ($2 AND c.status='REVIEW' AND c.first_counter<>$1
          AND (c.second_counter IS NULL OR c.second_counter<>$1)) THEN c.snapshot - 'revision' END AS expected,
        CASE WHEN c.status='CLOSED' OR ($2 AND c.status='REVIEW' AND c.first_counter<>$1
          AND (c.second_counter IS NULL OR c.second_counter<>$1)) THEN c.first_result END AS first_result,
        CASE WHEN c.status='CLOSED' OR ($2 AND c.status='REVIEW' AND c.first_counter<>$1
          AND (c.second_counter IS NULL OR c.second_counter<>$1)) THEN c.second_result END AS second_result
      FROM cycle_counts c JOIN parts p ON p.id=c.part_id LEFT JOIN containers r ON r.id=p.container_id
      WHERE $2 OR c.first_counter=$1 OR c.second_counter=$1 ORDER BY c.created_at DESC LIMIT 200
    `, [user.id, manager]);
  }

  async openCycle(dto: OpenCycleDto, user: AuthenticatedUser) {
    if (dto.firstCounter === dto.secondCounter) throw new BadRequestException('Người đếm lần hai phải độc lập');
    return this.dataSource.transaction(async em => {
      const [p] = await em.query(`
        SELECT xmin::text AS revision,quantity_pcs AS quantity,carton_count AS cartons,total_weight_kg::float AS weight
        FROM parts WHERE id=$1 AND container_id IS NOT NULL AND preferred_rack_slot IS NOT NULL FOR UPDATE
      `, [dto.partId]);
      if (!p) throw new BadRequestException('Cần PART có vị trí kiểm kê');
      const counters = [dto.firstCounter, ...(dto.secondCounter ? [dto.secondCounter] : [])];
      const found = await em.query("SELECT id FROM users WHERE id=ANY($1::uuid[]) AND role IN ('admin','warehouse_manager','warehouse_staff')",[counters]);
      if (found.length !== counters.length) throw new BadRequestException('Người kiểm kê không hợp lệ');
      const [row] = await em.query(`
        INSERT INTO cycle_counts(part_id,creator_id,first_counter,second_counter,snapshot,status)
        VALUES($1,$2,$3,$4,$5,'FIRST') ON CONFLICT DO NOTHING RETURNING id,status
      `, [dto.partId,user.id,dto.firstCounter,dto.secondCounter ?? null,JSON.stringify(p)]);
      if (!row) throw new ConflictException('PART đã có đợt kiểm kê mở');
      await this.logCycle(em,row.id,user.id,'OPEN');
      return row;
    });
  }

  private logCycle(em: EntityManager, id: string, actor: string, action: string) {
    return em.query('INSERT INTO cycle_count_events(count_id,actor_id,action) VALUES($1,$2,$3)', [id,actor,action]);
  }

  private async lockCycle(em: EntityManager, id: string) {
    const [row] = await em.query('SELECT * FROM cycle_counts WHERE id=$1 FOR UPDATE', [id]);
    if (!row) throw new NotFoundException('Không tìm thấy đợt kiểm kê');
    return row;
  }

  async recordCycle(id: string, metrics: RecordCycleDto, user: AuthenticatedUser) {
    return this.dataSource.transaction(async em => {
      const row = await this.lockCycle(em,id);
      const second = row.status === 'SECOND';
      if (!['FIRST','SECOND'].includes(row.status) || user.id !== (second ? row.second_counter : row.first_counter)) {
        throw new ForbiddenException('Chỉ người được phân công có thể ghi lần đếm hiện tại');
      }
      const next = !second && row.second_counter ? 'SECOND' : 'REVIEW';
      await em.query(`UPDATE cycle_counts SET ${second ? 'second_result' : 'first_result'}=$2,status=$3 WHERE id=$1`,
        [id,JSON.stringify(metrics),next]);
      await this.logCycle(em,id,user.id,second ? 'SECOND' : 'FIRST');
      return { id,status:next };
    });
  }

  async voidCycle(id: string, reason: string, user: AuthenticatedUser) {
    if (!reason.trim()) throw new BadRequestException('Cần lý do đóng phiếu');
    return this.dataSource.transaction(async em => {
      const row = await this.lockCycle(em,id);
      if (row.status === 'CLOSED') throw new ConflictException('Đợt kiểm kê đã đóng');
      await em.query("UPDATE cycle_counts SET status='CLOSED',assessor_id=$2,reason=$3 WHERE id=$1",[id,user.id,reason.trim()]);
      await this.logCycle(em,id,user.id,'VOID');
      return { id,status:'CLOSED' };
    });
  }

  async approveCycle(id: string, reason: string, user: AuthenticatedUser) {
    if (!reason.trim()) throw new BadRequestException('Cần lý do phê duyệt');
    return this.dataSource.transaction(async em => {
      const row = await this.lockCycle(em,id);
      if (row.status !== 'REVIEW') throw new ConflictException('Phiếu chưa sẵn sàng đối chiếu');
      if ([row.creator_id,row.first_counter,row.second_counter].includes(user.id)) {
        throw new ForbiddenException('Người tạo hoặc người đếm không được tự duyệt');
      }
      const [version] = await em.query('SELECT xmin::text AS revision FROM parts WHERE id=$1 FOR UPDATE',[row.part_id]);
      if (version?.revision !== row.snapshot.revision) throw new ConflictException({
        code:'CYCLE_STALE_SNAPSHOT',message:'Tồn đã thay đổi kể từ khi mở đợt. Đóng phiếu và kiểm kê lại.',
      });
      const target: RecordCycleDto = row.second_result ?? row.first_result;
      if (row.second_result && (['quantity','cartons','weight'] as const).some(key => row.first_result[key] !== target[key])) {
        throw new ConflictException({ code:'CYCLE_COUNT_DISAGREEMENT',message:'Hai lượt đếm khác nhau. Đóng phiếu và lập đợt đối chiếu mới.' });
      }
      const part = await em.findOneByOrFail(Part,{id:row.part_id});
      const delta = { qty:target.quantity-part.quantityPcs,cartons:target.cartons-part.cartonCount,
        weight:Number((target.weight-Number(part.totalWeightKg)).toFixed(2)) };
      let adjustment: InventoryWrite | undefined;
      if (delta.qty || delta.cartons || delta.weight) {
        if ((await this.heldQuantities(em,[part.id])).get(part.id)) {
          throw new ConflictException({ code:'CYCLE_STOCK_RESERVED',message:'Cần giải phóng giữ tồn trước khi điều chỉnh' });
        }
        if (!part.containerId || part.preferredRackSlot === null) throw new ConflictException('Vị trí kiểm kê đã thay đổi');
        await this.lockRow(em,'containers',part.containerId);
        const rack = await em.findOneByOrFail(Container,{id:part.containerId});
        assertRackSlotFits(part,target.cartons,part.preferredRackSlot,rack);
        const peers = await em.findBy(Part,{containerId:rack.id,id:Not(part.id)});
        const cbm = cbmFor(part,target.cartons);
        assertCapacity({ rackName:rack.name,partName:part.partName,limits:rackLimits(rack),
          others:peers.map(peer => ({slot:peer.preferredRackSlot,weightKg:Number(peer.totalWeightKg),cbm:Number(peer.cbm)})),
          before:{slot:part.preferredRackSlot,weightKg:Number(part.totalWeightKg),cbm:Number(part.cbm)},
          after:{slot:part.preferredRackSlot,weightKg:target.weight,cbm:Number(cbm)} });
        const rackId = part.containerId;
        const slot = part.preferredRackSlot;
        part.quantityPcs=target.quantity;
        part.cartonCount=target.cartons;
        part.totalWeightKg=target.weight.toFixed(2);
        part.cbm=cbm;
        if (target.quantity===0 && target.cartons===0 && target.weight===0) {
          part.containerId=null;
          part.preferredRackSlot=null;
        }
        adjustment = await this.saveTransaction(em,part,
          { type:InventoryTransactionType.ADJUSTMENT,partId:part.id,note:`Kiểm kê ${id} · ${reason.trim()}` },
          user,delta,rackId,slot);
      }
      await em.query("UPDATE cycle_counts SET status='CLOSED',assessor_id=$2,reason=$3,adjustment_id=$4 WHERE id=$1",
        [id,user.id,reason.trim(),adjustment?.id ?? null]);
      await this.logCycle(em,id,user.id,'APPROVED');
      return { id,status:'CLOSED',adjustmentId:adjustment?.id ?? null };
    });
  }

  async listDispatches() {
    return this.dataSource.query(`
      SELECT d.id,d.reference,d.sku,d.quantity,d.status,d.created_at,
        COALESCE(jsonb_agg(jsonb_build_object('partId',a.part_id,'lotId',a.lot_id,'lotNumber',l.lot_number,
          'quantity',a.quantity) ORDER BY l.lot_number,a.part_id) FILTER (WHERE a.part_id IS NOT NULL),'[]') AS allocations
      FROM dispatch_orders d LEFT JOIN dispatch_allocations a ON a.dispatch_id=d.id
      LEFT JOIN inventory_lots l ON l.id=a.lot_id GROUP BY d.id ORDER BY d.created_at DESC,d.id DESC LIMIT 200
    `);
  }

  async dispatchAvailability(sku: string) {
    if (!sku) throw new BadRequestException('Cần mã SKU');
    return this.dataSource.transaction('REPEATABLE READ', async em => {
      const ids: { id: string }[] = await em.query(`
        SELECT p.id FROM parts p JOIN containers c ON c.id=p.container_id
        WHERE btrim(p.product_code)=$1 AND c.warehouse_code='DENSO-WH' AND c.zone_code<>'ZONE-Q'
        AND p.quantity_pcs>0 AND p.preferred_rack_slot IS NOT NULL
      `, [sku]);
      const parts = await em.findBy(Part, { id: In(ids.map(row => row.id)) });
      const active = await this.heldQuantities(em, ids.map(row => row.id));
      const allowed = await this.dispatchQuality(em, parts);
      return {
        sku,
        physicalPlaced: parts.reduce((n, part) => n+part.quantityPcs, 0),
        held: [...active.values()].reduce((n, quantity) => n+quantity, 0),
        available: parts.filter(allowed).reduce((n, part) => n+Math.max(0,part.quantityPcs-(active.get(part.id) ?? 0)), 0),
      };
    });
  }

  private async heldQuantities(em: EntityManager, ids: string[]): Promise<Map<string, number>> {
    const rows: { part_id: string; held: number }[] = await em.query(`
      SELECT a.part_id,SUM(a.quantity)::int AS held FROM dispatch_allocations a JOIN dispatch_orders d ON d.id=a.dispatch_id
      WHERE a.part_id=ANY($1::uuid[]) AND d.status IN ('RESERVED','PICKED') GROUP BY a.part_id
    `, [ids]);
    return new Map(rows.map(row => [row.part_id, row.held]));
  }

  private async dispatchQuality(em: EntityManager, parts: Part[], lockScopes = false) {
    if (lockScopes) await lockQualityScopes(em, parts.flatMap(part => part.qualityScopeId ?? []));
    const keys = parts.flatMap(part => part.qualityScopeId ?? part.lotId ?? []);
    const quality = await latestLotQuality(em, keys);
    const [{ today }] = await em.query("SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today");
    return (part: Part) => !!part.lotId && !part.receivingDamaged &&
      isLotAvailable(quality.get(part.qualityScopeId ?? part.lotId)?.judgment) &&
      (part.expirationDate ? part.expirationDate >= today : !requiresExpiry(part.storageClass));
  }

  async reserveDispatch(input: { reference: string; sku: string; quantity: number }, user: AuthenticatedUser, key?: string) {
    const reference = input.reference.trim();
    const sku = input.sku.trim();
    if (!reference || !sku || !key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) {
      throw new BadRequestException({ code: 'DISPATCH_INPUT_REQUIRED', message: 'Cần mã đơn, SKU và Idempotency-Key hợp lệ' });
    }
    return this.dataSource.transaction(async em => {
      const [created] = await em.query(`
        INSERT INTO dispatch_orders(reference,sku,quantity,actor_id,request_key,status)
        VALUES($1,$2,$3,$4,$5,'RESERVED') ON CONFLICT DO NOTHING RETURNING id,status
      `, [reference, sku, input.quantity, user.id, key]);
      if (!created) {
        const [existing] = await em.query('SELECT id,status,reference,sku,quantity FROM dispatch_orders WHERE actor_id=$1 AND request_key=$2', [user.id, key]);
        if (existing?.reference === reference && existing.sku === sku && existing.quantity === input.quantity) {
          return { id: existing.id, status: existing.status };
        }
        throw new ConflictException({ code: 'DISPATCH_CONFLICT', message: 'Mã đơn hoặc mã yêu cầu đã được sử dụng' });
      }
      await lockLotQuality(em, false);
      const parts = await em.createQueryBuilder(Part, 'p')
        .innerJoin(Container, 'c', 'c.id = p.container_id')
        .where('btrim(p.product_code) = :sku AND c.warehouse_code = :warehouse AND c.zone_code <> :quarantine',
          { sku, warehouse: 'DENSO-WH', quarantine: 'ZONE-Q' })
        .andWhere('p.quantity_pcs > 0 AND p.preferred_rack_slot IS NOT NULL')
        .orderBy('p.id', 'ASC')
        .setLock('pessimistic_write', undefined, ['p'])
        .getMany();
      const ids = parts.map(part => part.id);
      const allowed = await this.dispatchQuality(em, parts, true);
      const held = await this.heldQuantities(em, ids);
      const eligible = parts.filter(allowed).sort((a,b) =>
        (a.expirationDate || '9999-12-31').localeCompare(b.expirationDate || '9999-12-31')
        || a.createdAt.getTime()-b.createdAt.getTime() || a.id.localeCompare(b.id));
      const available = eligible.reduce((total, part) => total + Math.max(0, part.quantityPcs-(held.get(part.id) ?? 0)), 0);
      if (available < input.quantity) {
        throw new BadRequestException({ code: 'DISPATCH_INSUFFICIENT', message: `Chỉ còn ${available} đơn vị có thể cấp phát` });
      }
      let remaining = input.quantity;
      const allocations: { part_id: string; lot_id: string; quantity: number }[] = [];
      for (const part of eligible) {
        const quantity = Math.min(remaining, Math.max(0, part.quantityPcs-(held.get(part.id) ?? 0)));
        if (!quantity) continue;
        allocations.push({ part_id: part.id, lot_id: part.lotId!, quantity });
        remaining -= quantity;
        if (!remaining) break;
      }
      await em.query(`
        INSERT INTO dispatch_allocations(dispatch_id,part_id,lot_id,quantity)
        SELECT $1, part_id, lot_id, quantity
        FROM jsonb_to_recordset($2::jsonb) AS allocation(part_id uuid,lot_id uuid,quantity integer)
      `, [created.id, JSON.stringify(allocations)]);
      await this.recordDispatch(em, created.id, user.id, 'RESERVED');
      return created;
    });
  }

  private recordDispatch(em: EntityManager, id: string, actor: string, status: string) {
    return em.query('INSERT INTO dispatch_events(dispatch_id,actor_id,status) VALUES($1,$2,$3)', [id,actor,status]);
  }

  async listPacking(id: string) {
    const [list] = await this.dataSource.query(`
      SELECT d.status, d.sku, COALESCE((
        SELECT jsonb_agg(jsonb_build_object('partId', a.part_id, 'lotId', a.lot_id,
          'lotNumber', l.lot_number, 'picked', CASE WHEN d.status IN ('PICKED','SHIPPED')
            OR (d.status='CANCELLED' AND EXISTS (
              SELECT 1 FROM dispatch_events WHERE dispatch_id=d.id AND status='PICKED'
            )) THEN a.quantity ELSE 0 END,
          'packed', COALESCE((SELECT SUM(e.quantity) FROM dispatch_packing_entries e
            WHERE e.dispatch_id=a.dispatch_id AND e.part_id=a.part_id),0)) ORDER BY a.part_id)
        FROM dispatch_allocations a JOIN inventory_lots l ON l.id=a.lot_id WHERE a.dispatch_id=d.id
      ), '[]'::jsonb) AS lines
      FROM dispatch_orders d WHERE d.id=$1
    `, [id]);
    if (!list) throw new NotFoundException('Không tìm thấy đơn xuất');
    const summary = list.lines.reduce((sum: {picked: number; packed: number}, row: {picked: number; packed: number}) =>
      ({ picked: sum.picked + row.picked, packed: sum.packed + row.packed }), { picked: 0, packed: 0 });
    return { ...list, packingStatus: list.status === 'CANCELLED' ? 'CANCELLED' :
      !summary.packed ? 'NOT_STARTED' : summary.packed === summary.picked ? 'COMPLETE' : 'PARTIAL' };
  }

  async recordPacking(id: string, input: { partId: string; quantity: number }, user: AuthenticatedUser, key?: string) {
    if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) {
      throw new BadRequestException({ code: 'PACKING_KEY_REQUIRED', message: 'Cần Idempotency-Key hợp lệ' });
    }
    return this.dataSource.transaction(async em => {
      const [order] = await em.query('SELECT id,status FROM dispatch_orders WHERE id=$1 FOR UPDATE', [id]);
      if (!order) throw new NotFoundException('Không tìm thấy đơn xuất');
      const [existing] = await em.query(`
        SELECT id,part_id AS "partId",quantity,actor_id AS "actorId"
        FROM dispatch_packing_entries WHERE dispatch_id=$1 AND request_key=$2
      `, [id,key]);
      if (existing) {
        if (existing.partId === input.partId && existing.quantity === input.quantity && existing.actorId === user.id) return existing;
        throw new ConflictException({ code: 'PACKING_KEY_CONFLICT', message: 'Mã yêu cầu đã được sử dụng' });
      }
      if (order.status !== 'PICKED') {
        throw new ConflictException({ code: 'PACKING_REQUIRES_PICKED', message: 'Chỉ ghi đóng gói cho đơn đã soạn' });
      }
      const [allocation] = await em.query(`
        SELECT a.lot_id,a.quantity,
          COALESCE((SELECT SUM(e.quantity) FROM dispatch_packing_entries e
            WHERE e.dispatch_id=a.dispatch_id AND e.part_id=a.part_id),0)::int AS packed
        FROM dispatch_allocations a WHERE a.dispatch_id=$1 AND a.part_id=$2
      `, [id,input.partId]);
      if (!allocation || input.quantity > allocation.quantity - allocation.packed) {
        throw new BadRequestException({ code: 'PACKING_EXCEEDS_PICKED', message: 'Số lượng đóng gói vượt số đã soạn còn lại' });
      }
      await lockLotQuality(em, false);
      await this.lockRow(em, 'parts', input.partId);
      const part = await em.findOneBy(Part, { id: input.partId });
      if (!part || part.lotId !== allocation.lot_id || part.quantityPcs < allocation.quantity
          || !(await this.dispatchQuality(em, [part], true))(part)) {
        throw new ConflictException({ code: 'PACKING_STOCK_INELIGIBLE', message: 'Lô đã soạn không còn đủ điều kiện QC hoặc tồn' });
      }
      const [entry] = await em.query(`
        INSERT INTO dispatch_packing_entries(dispatch_id,part_id,quantity,actor_id,request_key)
        VALUES($1,$2,$3,$4,$5) RETURNING id,part_id AS "partId",quantity,actor_id AS "actorId"
      `, [id,input.partId,input.quantity,user.id,key]);
      return entry;
    });
  }

  async transitionDispatch(id: string, next: 'PICKED' | 'SHIPPED' | 'CANCELLED', user: AuthenticatedUser) {
    return this.dataSource.transaction(async em => {
      const [order] = await em.query('SELECT id,status FROM dispatch_orders WHERE id=$1 FOR UPDATE', [id]);
      if (!order) throw new NotFoundException('Không tìm thấy đơn xuất');
      if (order.status === next) return order;
      const valid = (order.status === 'RESERVED' && next === 'PICKED') ||
        (order.status === 'PICKED' && next === 'SHIPPED') ||
        (['RESERVED','PICKED'].includes(order.status) && next === 'CANCELLED');
      if (!valid) throw new ConflictException('Trạng thái đơn xuất không cho phép thao tác này');
      if (next !== 'CANCELLED') {
        await lockLotQuality(em, false);
        const allocations: { part_id: string; lot_id: string; quantity: number }[] = await em.query(
          'SELECT part_id,lot_id,quantity FROM dispatch_allocations WHERE dispatch_id=$1 ORDER BY part_id', [id],
        );
        const ids = allocations.map(row => row.part_id);
        const parts = await em.createQueryBuilder(Part, 'p')
          .where('p.id = ANY(:ids)', { ids })
          .orderBy('p.id', 'ASC')
          .setLock('pessimistic_write')
          .getMany();
        const allowed = await this.dispatchQuality(em, parts, true);
        const byId = new Map(parts.map(part => [part.id, part]));
        const picked = allocations.map(row => {
          const part = byId.get(row.part_id);
          if (!part || part.lotId !== row.lot_id || row.quantity > part.quantityPcs || !allowed(part)) {
            throw new ConflictException({ code: 'DISPATCH_STOCK_INELIGIBLE', message: 'Tồn đã giữ thay đổi hoặc không còn đủ điều kiện QC. Hãy hủy đơn và cấp phát lại.' });
          }
          return { part, quantity: row.quantity };
        });
        if (next === 'SHIPPED') {
          await em.query('UPDATE dispatch_orders SET status=$2 WHERE id=$1', [id,next]);
          for (const { part, quantity } of picked) {
            const amounts = this.outboundAmounts(part, quantity);
            await this.commitOutboundPart(em, part, amounts,
              { type: InventoryTransactionType.OUTBOUND, partId: part.id, note: `Đơn xuất ${id}` }, user);
          }
        }
      }
      // Ship marks its own hold inactive before touching the stock preservation trigger.
      if (next !== 'SHIPPED') await em.query('UPDATE dispatch_orders SET status=$2 WHERE id=$1', [id,next]);
      await this.recordDispatch(em, id, user.id, next);
      return { id, status: next };
    });
  }

  private outboundAmounts(part: Part, qty: number): Amounts {
    const weight = Number(part.totalWeightKg);
    return qty === part.quantityPcs ? { qty, cartons: part.cartonCount, weight }
      : { qty, cartons: Math.floor(part.cartonCount * qty / part.quantityPcs),
        weight: Math.min(Number((weight * qty / part.quantityPcs).toFixed(2)), Math.max(0, weight - 0.01)) };
  }

  private async commitOutboundPart(em: EntityManager, part: Part, amounts: Amounts, dto: CreateInventoryTransactionDto, user: AuthenticatedUser) {
    const fromRackId = part.containerId;
    const fromSlot = part.preferredRackSlot;
    const plan = planOutbound({ quantityPcs: part.quantityPcs, cartonCount: part.cartonCount, weightKg: Number(part.totalWeightKg) }, amounts);
    part.quantityPcs = plan.after.quantityPcs;
    part.cartonCount = plan.after.cartonCount;
    part.totalWeightKg = plan.after.weightKg.toFixed(2);
    part.cbm = cbmFor(part, part.cartonCount);
    if (plan.depleted) {
      part.containerId = null;
      part.preferredRackSlot = null;
    }
    return this.saveTransaction(em, part, dto, user, { ...amounts, weight: plan.loggedWeight }, fromRackId, fromSlot);
  }

  async create(dto: CreateInventoryTransactionDto, user: AuthenticatedUser, key?: string): Promise<InventoryResult> {
    if (dto.type === InventoryTransactionType.ADJUSTMENT) throw new ForbiddenException('Điều chỉnh tồn phải qua phiếu kiểm kê đã duyệt');
    if (key !== undefined && !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_INVALID', message: 'Idempotency-Key không hợp lệ' });
    }
    const hash = key
      ? createHash('sha256').update(JSON.stringify(dto, Object.keys(dto).sort())).digest('hex')
      : null;

    return this.dataSource.transaction('READ COMMITTED', async (em) => {
      if (key) {
        // The unique key serializes retries. A failed writer rolls its claim back with the stock and ledger.
        const claimed = await em.query(
          `INSERT INTO inventory_idempotency (actor_id, request_key, request_hash)
           VALUES ($1, $2, $3) ON CONFLICT (actor_id, request_key) DO NOTHING RETURNING request_key`,
          [user.id, key, hash],
        );
        if (!claimed.length) {
          const [previous] = await em.query(
            'SELECT request_hash, response FROM inventory_idempotency WHERE actor_id = $1 AND request_key = $2',
            [user.id, key],
          );
          if (previous.request_hash !== hash) {
            throw new ConflictException({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH', message: 'Mã giao dịch đã được dùng với nội dung khác' });
          }
          return previous.response;
        }
      }
      const response = dto.type === InventoryTransactionType.OUTBOUND
        ? await this.allocateOutbound(em, dto, user)
        : await this.writePlacementTransaction(em, dto, user);
      if (key) {
        await em.query(
          'UPDATE inventory_idempotency SET response = $3::jsonb WHERE actor_id = $1 AND request_key = $2',
          [user.id, key, JSON.stringify(response)],
        );
      }
      return response;
    });
  }

  private async writePlacementTransaction(em: EntityManager, dto: CreateInventoryTransactionDto, user: AuthenticatedUser): Promise<InventoryWrite> {
    await this.lockRow(em, 'parts', dto.partId);
    const part = await em.findOne(Part, { where: { id: dto.partId } });
    if (!part) throw new NotFoundException({ code: 'PART_NOT_FOUND', message: 'Không tìm thấy PART' });

    if (part.receivingDamaged) {
      throw new BadRequestException({ code: 'RECEIVING_DAMAGE_QUARANTINED', message: 'Hàng hỏng phải ở khu cách ly' });
    }
    const fromRackId = part.containerId;
    const fromSlot = part.preferredRackSlot;
    const req: Amounts = {
      qty: Math.max(0, dto.quantityPcs || 0),
      cartons: Math.max(0, dto.cartonCount || 0),
      weight: Math.max(0, dto.weightKg || 0),
    };
    const stock: Stock = { quantityPcs: part.quantityPcs, cartonCount: part.cartonCount, weightKg: Number(part.totalWeightKg) };
    // Số lượng thực sự di chuyển, ghi vào sổ (điều chuyển và xuất hết có thể khác số người dùng nhập)
    let logged: Amounts = { ...req };

    if (dto.type === InventoryTransactionType.INBOUND) {
      if (req.qty === 0 && req.cartons === 0 && req.weight === 0) {
        throw new BadRequestException({ code: 'INBOUND_ZERO', message: 'Nhập kho phải có số lượng, số thùng hoặc khối lượng lớn hơn 0' });
      }
      assertInboundLocation({ rackId: fromRackId, slot: fromSlot }, { toRackId: dto.toRackId, toSlot: dto.toSlot }, part.partName);

      // When no rack was explicitly selected, try the present position first, then
      // available racks in the same warehouse. A PART is atomic: do not split one
      // stock record between two racks. Never save an over-capacity placement.
      const newCartons = part.cartonCount + req.cartons;
      // Racks are physical shared locations, not owned by the first order ever placed there.
      const allRacks = await em.find(Container, { where: { warehouseCode: 'DENSO-WH' }, order: { zoneCode: 'ASC', name: 'ASC' } });
      const candidateIds = dto.toRackId
        ? [dto.toRackId]
        : (fromRackId ? [fromRackId] : allRacks.map((rack) => rack.id));
      let rackId: string | null = null;
      let slot: number | null = null;
      let lastFailure: unknown;
      for (const candidateId of [...new Set(candidateIds)]) {
        await this.lockRow(em, 'containers', candidateId);
        const rack = await em.findOne(Container, { where: { id: candidateId } });
        if (!rack) { lastFailure = new NotFoundException('Không tìm thấy kệ nhận'); continue; }
        const occupants = await em.find(Part, { where: { containerId: candidateId } });
        const busy = new Set(occupants.filter((p) => p.id !== part.id && p.preferredRackSlot !== null).map((p) => p.preferredRackSlot));
        const manualSlot = dto.toSlot;
        const slots = manualSlot !== undefined && manualSlot !== null
          ? [manualSlot]
          : [candidateId === fromRackId ? fromSlot : null, ...preferredSlotsByExpiry(part.expirationDate)]
              .filter((v): v is number => v !== null && v !== undefined);
        for (const chosenSlot of [...new Set(slots)]) {
          if (busy.has(chosenSlot)) continue;
          try {
            await this.checkCapacity(em, rack, part, {
              weightKg: stock.weightKg + req.weight,
              cbm: Number(cbmFor(part, newCartons)), slot: chosenSlot,
            }, newCartons);
            rackId = candidateId;
            slot = chosenSlot;
            break;
          } catch (error) { lastFailure = error; }
        }
        if (rackId) break;
        if (dto.toRackId) break; // Never silently override a user's explicit rack.
      }
      if (!rackId || slot === null) {
        if (dto.toRackId && lastFailure) throw lastFailure;
        throw new BadRequestException({ code: 'NO_SAFE_STORAGE_LOCATION', message: 'Không còn vị trí đạt điều kiện bảo quản và tải trọng. Hãy tạo kệ/Zone phù hợp hoặc tách lô trước khi nhập.' });
      }
      part.containerId = rackId;
      part.preferredRackSlot = slot;
      part.quantityPcs += req.qty;
      part.cartonCount = newCartons;
      part.totalWeightKg = (stock.weightKg + req.weight).toFixed(2);
      part.cbm = cbmFor(part, part.cartonCount);
    } else if (dto.type === InventoryTransactionType.TRANSFER) {
      if ((await this.heldQuantities(em, [part.id])).get(part.id)) {
        throw new BadRequestException({ code: 'PART_STOCK_RESERVED', message: 'Hủy giữ hàng trước khi điều chuyển PART' });
      }
      if ((dto.expectedFromRackId != null && dto.expectedFromRackId !== fromRackId)
        || (dto.expectedFromSlot != null && dto.expectedFromSlot !== fromSlot)) {
        throw new ConflictException({ code: 'TRANSFER_SOURCE_CHANGED', message: 'Vị trí nguồn vừa thay đổi. Vui lòng tải lại sơ đồ kho.' });
      }
      if (!dto.toRackId) {
        throw new BadRequestException({ code: 'TRANSFER_RACK_REQUIRED', message: 'Điều chuyển cần chọn kệ đích' });
      }
      if (!fromRackId) {
        throw new BadRequestException({ code: 'TRANSFER_SOURCE_REQUIRED', message: 'PART chưa được xếp vào kệ, không thể điều chuyển từ sơ đồ kho' });
      }
      if (stock.quantityPcs === 0 && stock.cartonCount === 0 && stock.weightKg === 0) {
        throw new BadRequestException({ code: 'TRANSFER_EMPTY', message: 'PART không còn tồn kho để điều chuyển' });
      }
      logged = planTransfer(stock, req);

      const isPartial = logged.qty < stock.quantityPcs || logged.cartons < stock.cartonCount;

      await this.lockRow(em, 'containers', dto.toRackId);
      const rack = await this.ensureSlotAvailable(em, isPartial ? null : part.id, dto.toRackId, dto.toSlot);
      const occupants = await em.find(Part, { where: { containerId: dto.toRackId } });
      const occupied = new Set(occupants
        .filter((p) => p.id !== part.id && p.preferredRackSlot !== null)
        .map((p) => p.preferredRackSlot));
      let destinationSlot = dto.toSlot;
      const transferCbm = Number(cbmFor(part, logged.cartons));

      if (destinationSlot === undefined || destinationSlot === null) {
        const candidates = preferredSlotsByExpiry(part.expirationDate)
          .filter((i) => !occupied.has(i) && !(dto.toRackId === fromRackId && i === fromSlot));
        let lastCapacityError: unknown;
        for (const candidate of candidates) {
          try {
            await this.checkCapacity(em, rack, part, {
              weightKg: logged.weight,
              cbm: transferCbm,
              slot: candidate,
            }, logged.cartons);
            destinationSlot = candidate;
            break;
          } catch (error) {
            lastCapacityError = error;
          }
        }
        if (destinationSlot === undefined || destinationSlot === null) {
          if (candidates.length && lastCapacityError) throw lastCapacityError;
          throw new BadRequestException({ code: 'TRANSFER_NO_SLOT', message: 'Kệ đích không còn ô trống phù hợp' });
        }
      } else {
        if (dto.toRackId === fromRackId && destinationSlot === fromSlot) {
          throw new BadRequestException({ code: 'TRANSFER_SAME_LOCATION', message: 'Ô đích trùng ô nguồn. Hãy chọn ô khác.' });
        }
        await this.checkCapacity(em, rack, part, {
          weightKg: logged.weight,
          cbm: transferCbm,
          slot: destinationSlot,
        }, logged.cartons);
      }

      if (isPartial) {
        // Atomic partial stock split: deduct from source lot, create destination PART on target rack/slot
        part.quantityPcs -= logged.qty;
        part.cartonCount -= logged.cartons;
        part.totalWeightKg = Math.max(0, stock.weightKg - logged.weight).toFixed(2);
        part.cbm = cbmFor(part, part.cartonCount);

        const newPart = em.create(Part, {
          ...part,
          id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          containerId: dto.toRackId,
          preferredRackSlot: destinationSlot,
          quantityPcs: logged.qty,
          cartonCount: logged.cartons,
          totalWeightKg: logged.weight.toFixed(2),
          cbm: transferCbm.toFixed(6),
        });
        const savedNewPart = await em.save(Part, newPart);
        await em.save(part);

        const transaction = await em.save(
          em.create(InventoryTransaction, {
            type: dto.type,
            partId: part.id,
            lotId: part.lotId,
            destinationPartId: savedNewPart.id,
            partName: part.partName,
            productCode: part.productCode,
            orderId: part.orderId,
            fromRackId,
            fromSlot,
            toRackId: dto.toRackId,
            toSlot: destinationSlot,
            quantityPcs: logged.qty,
            cartonCount: logged.cartons,
            weightKg: logged.weight.toFixed(2),
            note: dto.note?.trim() || null,
            performedBy: user?.id && user.id !== PUBLIC_USER_ID ? user.id : null,
            performedByEmail: user?.email || null,
          }),
        );

        return Object.assign(transaction, {
          partSnapshot: {
            id: part.id,
            quantityPcs: part.quantityPcs,
            cartonCount: part.cartonCount,
            totalWeightKg: Number(part.totalWeightKg),
            rackId: part.containerId,
            preferredRackSlot: part.preferredRackSlot,
          },
          destinationPartSnapshot: {
            id: savedNewPart.id,
            quantityPcs: savedNewPart.quantityPcs,
            cartonCount: savedNewPart.cartonCount,
            totalWeightKg: Number(savedNewPart.totalWeightKg),
            rackId: savedNewPart.containerId,
            preferredRackSlot: savedNewPart.preferredRackSlot,
          },
        });
      }

      part.containerId = dto.toRackId;
      part.preferredRackSlot = destinationSlot;
    }

    return this.saveTransaction(em, part, dto, user, logged, fromRackId, fromSlot);
  }

  private async saveTransaction(
    em: EntityManager, part: Part, dto: CreateInventoryTransactionDto, user: AuthenticatedUser,
    logged: Amounts, fromRackId: string | null, fromSlot: number | null,
  ): Promise<InventoryWrite> {
    await em.save(part);
    const transaction = await em.save(
      em.create(InventoryTransaction, {
        type: dto.type,
        partId: part.id,
        lotId: part.lotId,
        partName: part.partName,
        productCode: part.productCode,
        orderId: part.orderId,
        fromRackId,
        fromSlot,
        toRackId: part.containerId,
        toSlot: part.preferredRackSlot,
        quantityPcs: logged.qty,
        cartonCount: logged.cartons,
        weightKg: logged.weight.toFixed(2),
        note: dto.note?.trim() || null,
        performedBy: user?.id && user.id !== PUBLIC_USER_ID ? user.id : null,
        performedByEmail: user?.email || null,
      }),
    );
    // The authoritative post-commit result drives the frontend scene immediately.
    return Object.assign(transaction, { partSnapshot: {
      id: part.id, quantityPcs: part.quantityPcs, cartonCount: part.cartonCount,
      totalWeightKg: Number(part.totalWeightKg), rackId: part.containerId,
      preferredRackSlot: part.preferredRackSlot,
    } });
  }

  private async allocateOutbound(em: EntityManager, dto: CreateInventoryTransactionDto, user: AuthenticatedUser): Promise<InventoryResult> {
    const request = { qty: dto.quantityPcs ?? 0, cartons: dto.cartonCount ?? 0, weight: dto.weightKg ?? 0 };
    if (!request.qty && !request.cartons && !request.weight) {
      throw new BadRequestException({ code: 'OUTBOUND_ZERO', message: 'Xuất kho phải có số lượng, số thùng hoặc khối lượng lớn hơn 0' });
    }

    await lockLotQuality(em, false);
    const selected = await em.findOneBy(Part, { id: dto.partId });
    if (!selected) throw new NotFoundException({ code: 'PART_NOT_FOUND', message: 'Không tìm thấy PART' });
    const sku = selected.productCode?.trim() || null;
    // Lock in UUID order before reading current availability, regardless of the requested anchor lot.
    const locked: { id: string }[] = await em.query(
      'SELECT id FROM parts WHERE id = $1 OR ($2::text IS NOT NULL AND product_code = $2) ORDER BY id FOR UPDATE',
      [selected.id, sku],
    );
    const parts = await em.findBy(Part, { id: In(locked.map(row => row.id)) });
    const anchor = parts.find(part => part.id === selected.id);
    if (!anchor || anchor.productCode !== selected.productCode) {
      throw new ConflictException({ code: 'OUTBOUND_SCOPE_CHANGED', message: 'SKU vừa thay đổi. Vui lòng tải lại tồn kho.' });
    }
    const priorOutbound = !anchor.containerId && !anchor.quantityPcs && !anchor.cartonCount && !Number(anchor.totalWeightKg)
      ? await em.findOne(InventoryTransaction, {
        where: { partId: anchor.id, type: InventoryTransactionType.OUTBOUND },
        order: { createdAt: 'DESC', id: 'DESC' },
      })
      : null;
    const anchorRackId = anchor.containerId || priorOutbound?.fromRackId;
    const rackIds = [...new Set([...parts.map(part => part.containerId), anchorRackId].filter((id): id is string => !!id))];
    const racks = new Map((rackIds.length ? await em.findBy(Container, { id: In(rackIds) }) : [])
      .map(rack => [rack.id, rack.warehouseCode]));
    const warehouse = anchorRackId ? racks.get(anchorRackId) : undefined;
    const candidates = parts.filter(part => part.id === anchor.id || (
      part.uomCode === anchor.uomCode && (
        warehouse ? !!part.containerId && racks.get(part.containerId) === warehouse
          : part.containerId === null && part.orderId === anchor.orderId
      )
    ));
    await lockQualityScopes(em, candidates.flatMap(part => part.qualityScopeId ?? []));
    const quality = await latestLotQuality(em, candidates.flatMap(part => part.qualityScopeId ?? part.lotId ?? []));
    const [{ today }] = await em.query(
      "SELECT to_char(statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS today",
    );
    const judgment = (part: Part) => part.receivingDamaged ? 'BLOCKED' : quality.get(part.qualityScopeId ?? part.lotId ?? '')?.judgment;
    const qcAllows = (part: Part) => isLotAvailable(judgment(part));
    if (anchor.expirationDate && anchor.expirationDate < today) {
      throw new BadRequestException({ code: 'OUTBOUND_LOT_EXPIRED', message: 'Lô hàng đã quá hạn sử dụng và không được xuất kho' });
    }
    if (!anchor.expirationDate && requiresExpiry(anchor.storageClass)) {
      throw new BadRequestException({ code: 'OUTBOUND_LOT_EXPIRY_REQUIRED', message: 'Lô thực phẩm cần khai báo HSD trước khi xuất' });
    }
    const anchorJudgment = judgment(anchor);
    if (!anchorJudgment) {
      throw new BadRequestException({ code: 'OUTBOUND_LOT_QC_PENDING', message: 'Lô được chọn chưa có kết luận kiểm định đủ điều kiện xuất' });
    }
    if (!qcAllows(anchor)) {
      throw new BadRequestException({ code: 'OUTBOUND_LOT_QC_BLOCKED', message: 'Lô được chọn đang bị chặn xuất bởi kiểm định' });
    }
    const eligible = candidates.filter(part => qcAllows(part) &&
        (part.expirationDate ? part.expirationDate >= today : !requiresExpiry(part.storageClass)))
      .sort((a, b) => (a.expirationDate || '9999-12-31').localeCompare(b.expirationDate || '9999-12-31')
        || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    const held = await this.heldQuantities(em, eligible.map(part => part.id));
    const picks: { part: Part; amounts: Amounts }[] = [];

    if (request.qty > 0) {
      let remaining = request.qty;
      for (const part of eligible) {
        const qty = Math.min(remaining, part.quantityPcs - (held.get(part.id) ?? 0));
        if (qty <= 0) continue;
        const amounts = this.outboundAmounts(part, qty);
        picks.push({ part, amounts });
        remaining -= qty;
        if (!remaining) break;
      }
      if (remaining) this.insufficientOutbound();
      // Existing single-lot callers can supply measured cartons/weight when FEFO selects that lot.
      if (picks.length === 1 && picks[0].part.id === anchor.id && (request.cartons || request.weight)) {
        picks[0].amounts = request;
      }
    } else {
      const first = eligible.find(part => part.quantityPcs > 0 || part.cartonCount > 0 || Number(part.totalWeightKg) > 0);
      if (!first) this.insufficientOutbound();
      if (first.id !== anchor.id) {
        throw new BadRequestException({ code: 'OUTBOUND_FEFO_QUANTITY_REQUIRED', message: 'Nhập số lượng để hệ thống phân bổ FEFO qua các lô' });
      }
      if (held.get(first.id)) throw new BadRequestException({ code: 'PART_STOCK_RESERVED', message: 'PART đang giữ cho đơn xuất' });
      picks.push({ part: first, amounts: request });
    }

    const allocations: InventoryWrite[] = [];
    for (const { part, amounts } of picks) {
      allocations.push(await this.commitOutboundPart(em, part, amounts, dto, user));
    }
    return { ...allocations[0], allocations };
  }

  private insufficientOutbound(): never {
    throw new BadRequestException({ code: 'OUTBOUND_EXCEEDS_STOCK', message: 'Tổng tồn khả dụng không đủ để xuất' });
  }

  async transactionSummary(days: number, zoneCode?: string): Promise<Array<{
    date: string; inbound: number; outbound: number; transfer: number;
  }>> {
    return this.dataSource.query(`
      WITH bounds AS (
        SELECT (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS today
      ), totals AS (
        SELECT (t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
               count(*) FILTER (WHERE t.type = 'inbound')::int AS inbound,
               count(*) FILTER (WHERE t.type = 'outbound')::int AS outbound,
               count(*) FILTER (WHERE t.type = 'transfer')::int AS transfer
        FROM inventory_transactions t
        CROSS JOIN bounds b
        LEFT JOIN containers destination ON destination.id = t.to_rack_id
        LEFT JOIN containers source ON source.id = t.from_rack_id
        WHERE t.created_at >= ((b.today - ($1::int - 1))::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
          AND t.created_at < ((b.today + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
          AND ($2::text IS NULL OR coalesce(destination.zone_code, source.zone_code) = $2)
        GROUP BY 1
      )
      SELECT to_char(b.today - i, 'YYYY-MM-DD') AS date,
             coalesce(t.inbound, 0) AS inbound, coalesce(t.outbound, 0) AS outbound,
             coalesce(t.transfer, 0) AS transfer
      FROM bounds b CROSS JOIN generate_series(0, $1::int - 1) AS i
      LEFT JOIN totals t ON t.day = b.today - i
      ORDER BY b.today - i
    `, [days, zoneCode?.trim() || null]);
  }

  async getHeatmap(dto: QueryHeatmapDto = {}): Promise<HeatmapResponse> {
    const days = Math.max(1, Math.min(365, dto.days || 90));
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const warehouseCode = (dto.warehouseCode || 'DENSO-WH').trim();
    const zoneCode = dto.zoneCode?.trim();
    const orderId = dto.orderId?.trim();

    // 1. Lấy danh sách kệ mục tiêu
    const rackWhere: FindOptionsWhere<Container> = { warehouseCode };
    if (zoneCode) rackWhere.zoneCode = zoneCode;
    if (orderId) rackWhere.orderId = orderId;

    let targetRacks = await this.racks.find({
      where: rackWhere,
      order: { name: 'ASC' },
    });

    if (targetRacks.length === 0) {
      const fallbackWhere: FindOptionsWhere<Container> = { warehouseCode };
      if (zoneCode) fallbackWhere.zoneCode = zoneCode;
      targetRacks = await this.racks.find({
        where: fallbackWhere,
        order: { name: 'ASC' },
      });
    }

    // 2. Query thống kê tổng hợp thao tác trên từng kệ
    const queryParams: any[] = [cutoffDate];
    let orderFilterSql = '';
    if (orderId) {
      queryParams.push(orderId);
      orderFilterSql = `AND order_id = $${queryParams.length}`;
    }

    const rackStatsRaw: Array<{
      rack_id: string;
      total_ops: string;
      inbound_ops: string;
      outbound_ops: string;
      transfer_ops: string;
      total_pcs: string;
      total_cartons: string;
      total_weight: string;
    }> = await this.transactions.query(
      `
      SELECT
        ops.rack_id,
        COUNT(*)::int AS total_ops,
        SUM(CASE WHEN ops.op_type = 'inbound' THEN 1 ELSE 0 END)::int AS inbound_ops,
        SUM(CASE WHEN ops.op_type = 'outbound' THEN 1 ELSE 0 END)::int AS outbound_ops,
        SUM(CASE WHEN ops.op_type = 'transfer' THEN 1 ELSE 0 END)::int AS transfer_ops,
        COALESCE(SUM(ops.quantity_pcs), 0)::int AS total_pcs,
        COALESCE(SUM(ops.carton_count), 0)::int AS total_cartons,
        COALESCE(SUM(ops.weight_kg), 0)::numeric AS total_weight
      FROM (
        SELECT
          to_rack_id AS rack_id,
          'inbound' AS op_type,
          quantity_pcs,
          carton_count,
          COALESCE(weight_kg, 0) AS weight_kg
        FROM inventory_transactions
        WHERE to_rack_id IS NOT NULL
          AND type = 'inbound'
          AND created_at >= $1
          ${orderFilterSql}

        UNION ALL

        SELECT
          from_rack_id AS rack_id,
          'outbound' AS op_type,
          quantity_pcs,
          carton_count,
          COALESCE(weight_kg, 0) AS weight_kg
        FROM inventory_transactions
        WHERE from_rack_id IS NOT NULL
          AND type = 'outbound'
          AND created_at >= $1
          ${orderFilterSql}

        UNION ALL

        SELECT
          from_rack_id AS rack_id,
          'transfer' AS op_type,
          quantity_pcs,
          carton_count,
          COALESCE(weight_kg, 0) AS weight_kg
        FROM inventory_transactions
        WHERE from_rack_id IS NOT NULL
          AND type = 'transfer'
          AND created_at >= $1
          ${orderFilterSql}

        UNION ALL

        SELECT
          to_rack_id AS rack_id,
          'transfer' AS op_type,
          quantity_pcs,
          carton_count,
          COALESCE(weight_kg, 0) AS weight_kg
        FROM inventory_transactions
        WHERE to_rack_id IS NOT NULL
          AND type = 'transfer'
          AND created_at >= $1
          ${orderFilterSql}
      ) ops
      GROUP BY ops.rack_id
      `,
      queryParams,
    );

    // 3. Query thống kê từng ô (slot) trong mỗi kệ
    const slotStatsRaw: Array<{
      rack_id: string;
      slot: number;
      op_count: string;
    }> = await this.transactions.query(
      `
      SELECT
        slot_ops.rack_id,
        slot_ops.slot,
        COUNT(*)::int AS op_count
      FROM (
        SELECT to_rack_id AS rack_id, to_slot AS slot
        FROM inventory_transactions
        WHERE to_rack_id IS NOT NULL AND to_slot IS NOT NULL AND created_at >= $1 ${orderFilterSql}
        UNION ALL
        SELECT from_rack_id AS rack_id, from_slot AS slot
        FROM inventory_transactions
        WHERE from_rack_id IS NOT NULL AND from_slot IS NOT NULL AND type IN ('outbound', 'transfer') AND created_at >= $1 ${orderFilterSql}
      ) slot_ops
      GROUP BY slot_ops.rack_id, slot_ops.slot
      `,
      queryParams,
    );

    const statsMap = new Map<string, (typeof rackStatsRaw)[0]>();
    for (const r of rackStatsRaw) {
      if (r.rack_id) statsMap.set(r.rack_id, r);
    }

    const slotMap = new Map<string, Map<number, number>>();
    for (const s of slotStatsRaw) {
      if (!s.rack_id || s.slot === null || s.slot === undefined) continue;
      if (!slotMap.has(s.rack_id)) slotMap.set(s.rack_id, new Map());
      slotMap.get(s.rack_id)!.set(Number(s.slot), Number(s.op_count));
    }

    // 4. Chuẩn hóa điểm số (Score normalization 0 - 100)
    let maxOps = 0;
    let minOps = Number.MAX_SAFE_INTEGER;
    let totalRackOps = 0;

    for (const rack of targetRacks) {
      const stat = statsMap.get(rack.id);
      const ops = stat ? Number(stat.total_ops) : 0;
      totalRackOps += ops;
      if (ops > maxOps) maxOps = ops;
      if (ops < minOps) minOps = ops;
    }
    if (minOps === Number.MAX_SAFE_INTEGER) minOps = 0;

    const rackItems: HeatmapRackItem[] = [];
    const rackDict: Record<string, HeatmapRackItem> = {};
    const zoneAggregates: Record<
      string,
      { totalOps: number; scores: number[]; rackCount: number; hotCount: number }
    > = {};

    for (const rack of targetRacks) {
      const stat = statsMap.get(rack.id);
      const total = stat ? Number(stat.total_ops) : 0;
      const inbound = stat ? Number(stat.inbound_ops) : 0;
      const outbound = stat ? Number(stat.outbound_ops) : 0;
      const transfer = stat ? Number(stat.transfer_ops) : 0;
      const totalPcs = stat ? Number(stat.total_pcs) : 0;
      const totalCartons = stat ? Number(stat.total_cartons) : 0;
      const totalWeightKg = stat ? Number(stat.total_weight) : 0;

      // Điểm số chuẩn hóa 0..100 theo maxOps (tần suất tương đối)
      const score = maxOps > 0 ? Math.round((total / maxOps) * 100) : 0;
      const meta = getHeatmapColor(score);

      // Thống kê 20 ô của kệ
      const rackSlotCounts = slotMap.get(rack.id) || new Map<number, number>();
      let maxSlotOps = 0;
      for (let s = 0; s < 20; s++) {
        const c = rackSlotCounts.get(s) || 0;
        if (c > maxSlotOps) maxSlotOps = c;
      }

      const slots: Record<number, { slotIndex: number; operations: number; score: number; color: string }> = {};
      for (let s = 0; s < 20; s++) {
        const c = rackSlotCounts.get(s) || 0;
        const slotScore = maxSlotOps > 0 ? Math.round((c / maxSlotOps) * 100) : 0;
        slots[s] = {
          slotIndex: s,
          operations: c,
          score: slotScore,
          color: getSlotHeatColor(slotScore),
        };
      }

      const item: HeatmapRackItem = {
        id: rack.id,
        name: rack.name,
        warehouseCode: rack.warehouseCode,
        zoneCode: rack.zoneCode,
        orderId: rack.orderId,
        operations: { total, inbound, outbound, transfer },
        metrics: { totalPcs, totalCartons, totalWeightKg },
        score,
        level: meta.level,
        color: meta.color,
        velocityClass: meta.velocityClass,
        slots,
      };

      rackItems.push(item);
      rackDict[rack.id] = item;
      rackDict[rack.name] = item; // Alias cho việc tra cứu nhanh qua name trong 3D Scene

      // Gom nhóm theo zone
      const zCode = rack.zoneCode || 'ZONE-A';
      if (!zoneAggregates[zCode]) {
        zoneAggregates[zCode] = { totalOps: 0, scores: [], rackCount: 0, hotCount: 0 };
      }
      zoneAggregates[zCode].totalOps += total;
      zoneAggregates[zCode].scores.push(score);
      zoneAggregates[zCode].rackCount += 1;
      if (score > 80) zoneAggregates[zCode].hotCount += 1;
    }

    // Sắp xếp danh sách kệ theo điểm số giảm dần
    rackItems.sort((a, b) => b.score - a.score);

    // Tính toán tỉ lệ Pareto (Top 20% kệ chiếm bao nhiêu % tổng hoạt động)
    const top20Count = Math.max(1, Math.round(rackItems.length * 0.2));
    const top20Ops = rackItems.slice(0, top20Count).reduce((acc, cur) => acc + cur.operations.total, 0);
    const paretoPercent = totalRackOps > 0 ? Number(((top20Ops / totalRackOps) * 100).toFixed(1)) : 0;

    // Tổng hợp thông tin zones
    const zones: Record<string, HeatmapZoneItem> = {};
    for (const [zCode, val] of Object.entries(zoneAggregates)) {
      const avgScore =
        val.scores.length > 0 ? Math.round(val.scores.reduce((a, b) => a + b, 0) / val.scores.length) : 0;
      zones[zCode] = {
        zoneCode: zCode,
        warehouseCode,
        rackCount: val.rackCount,
        totalOperations: val.totalOps,
        averageScore: avgScore,
        hotRacksCount: val.hotCount,
      };
    }

    const totalTx = await this.transactions.count({
      where: {
        createdAt: MoreThanOrEqual(cutoffDate),
        ...(orderId ? { orderId } : {}),
      },
    });

    const hottest = rackItems[0]
      ? {
          id: rackItems[0].id,
          name: rackItems[0].name,
          score: rackItems[0].score,
          operations: rackItems[0].operations.total,
        }
      : null;
    const coldest = rackItems[rackItems.length - 1]
      ? {
          id: rackItems[rackItems.length - 1].id,
          name: rackItems[rackItems.length - 1].name,
          score: rackItems[rackItems.length - 1].score,
          operations: rackItems[rackItems.length - 1].operations.total,
        }
      : null;

    return {
      timeWindowDays: days,
      cutoffDate: cutoffDate.toISOString(),
      summary: {
        totalTransactions: totalTx,
        totalRackOperations: totalRackOps,
        activeRacksCount: rackItems.length,
        hotRacksCount: rackItems.filter((r) => r.score > 80).length,
        coldRacksCount: rackItems.filter((r) => r.score < 30).length,
        maxOperations: maxOps,
        minOperations: minOps,
        hottestRack: hottest,
        coldestRack: coldest,
        paretoRatio: {
          top20PercentRacksTraffic: paretoPercent,
          description: `Top ${top20Count} kệ (${paretoPercent}%) nắm giữ đại đa số lượt luân chuyển`,
        },
      },
      zones,
      racks: rackDict,
      rackList: rackItems,
    };
  }
}
