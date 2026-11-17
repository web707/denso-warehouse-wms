import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1788500000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inspections_lot_latest" ON "inspections" ("lot_number" ASC, "inspection_date" DESC, "created_at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inventory_tx_created_at" ON "inventory_transactions" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_parts_created_at" ON "parts" ("created_at" ASC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_parts_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_tx_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inspections_lot_latest"`);
  }
}
