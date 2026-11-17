import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReceivingQualityScope1788800000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE parts ADD COLUMN quality_scope_id uuid, ADD COLUMN receiving_damaged boolean NOT NULL DEFAULT false;
      ALTER TABLE inspections ADD COLUMN quality_scope_id uuid;
      CREATE INDEX inspections_quality_scope_latest ON inspections(quality_scope_id, inspection_date DESC, created_at DESC, id DESC)
        WHERE quality_scope_id IS NOT NULL;
      UPDATE parts p SET quality_scope_id=p.id FROM receiving_receipts r WHERE r.part_id=p.id;
      UPDATE parts p SET receiving_damaged=true FROM receiving_receipts r WHERE r.damaged_part_id=p.id;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM inspections WHERE quality_scope_id IS NOT NULL)
          OR EXISTS (SELECT 1 FROM parts p WHERE quality_scope_id IS NOT NULL AND (
            receiving_damaged OR NOT EXISTS (SELECT 1 FROM receiving_receipts r WHERE r.part_id=p.id)
          )) THEN
          RAISE EXCEPTION 'Scoped receiving QC exists; use a forward migration';
        END IF;
      END $$;
      DROP INDEX inspections_quality_scope_latest;
      ALTER TABLE inspections DROP COLUMN quality_scope_id;
      ALTER TABLE parts DROP COLUMN quality_scope_id, DROP COLUMN receiving_damaged;
    `);
  }
}
