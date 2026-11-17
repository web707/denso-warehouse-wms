import { EntityManager } from 'typeorm';
import { Inspection } from './entities/inspection.entity';

export async function findLotIdentity(manager: EntityManager, productCode?: string | null, lotNumber?: string | null): Promise<string | undefined> {
  if (!productCode?.trim() || !lotNumber?.trim()) return undefined;
  const [lot] = await manager.query(
    'SELECT id FROM inventory_lots WHERE product_code = $1 AND lot_number = $2',
    [productCode.trim(), lotNumber.trim()],
  );
  return lot?.id;
}

export const QC_ORDER = { inspectionDate: 'DESC', createdAt: 'DESC', id: 'DESC' } as const;

export function isLotAvailable(judgment?: string): boolean {
  return judgment === 'OK' || judgment === 'AVAILABLE';
}

export async function lockLotQuality(manager: EntityManager, write: boolean): Promise<void> {
  await manager.query(write
    ? "SELECT pg_advisory_xact_lock(hashtext('MASAN_WMS_LOT_QUALITY'), 0)"
    : "SELECT pg_advisory_xact_lock_shared(hashtext('MASAN_WMS_LOT_QUALITY'), 0)");
}

export async function lockQualityScopes(manager: EntityManager, scopes: string[], write = false): Promise<void> {
  if (scopes.length === 0) return;
  const lock = write ? 'pg_advisory_xact_lock' : 'pg_advisory_xact_lock_shared';
  // Sort the actual lock keys so advisory hash collisions obey the same lock order.
  await manager.query(`
    SELECT ${lock}(hashtext('MASAN_WMS_RECEIVING_QC_SCOPE'), key)
    FROM (SELECT DISTINCT hashtext(scope) AS key FROM unnest($1::text[]) AS s(scope) ORDER BY key) sorted
  `, [scopes]);
}

export async function lockReceivingReceipts(manager: EntityManager, write: boolean): Promise<void> {
  await manager.query(write
    ? "SELECT pg_advisory_xact_lock(hashtext('MASAN_WMS_RECEIVING_RECEIPTS'), 0)"
    : "SELECT pg_advisory_xact_lock_shared(hashtext('MASAN_WMS_RECEIVING_RECEIPTS'), 0)");
}

export async function latestLotQuality(manager: EntityManager, lots?: string[]): Promise<Map<string, Inspection>> {
  if (lots?.length === 0) return new Map();
  const query = manager.createQueryBuilder(Inspection, 'inspection')
    .distinctOn(['COALESCE(inspection.qualityScopeId, inspection.lotId)'])
    .orderBy('COALESCE(inspection.qualityScopeId, inspection.lotId)', 'ASC')
    .addOrderBy('inspection.inspectionDate', 'DESC')
    .addOrderBy('inspection.createdAt', 'DESC')
    .addOrderBy('inspection.id', 'DESC');
  query.where('inspection.lotId IS NOT NULL');
  if (lots) query.andWhere('COALESCE(inspection.qualityScopeId, inspection.lotId) IN (:...lots)', { lots });
  const rows = await query.getMany();
  return new Map(rows.flatMap(row => row.lotId ? [[row.qualityScopeId ?? row.lotId, row]] : []));
}
