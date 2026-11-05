import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive only: legacy lots remain unknown until manually confirmed. */
export class AddMasanStorageClassification1788000000000 implements MigrationInterface {
  name = 'AddMasanStorageClassification1788000000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "parts" ADD COLUMN IF NOT EXISTS "storage_class" varchar(32) NOT NULL DEFAULT 'unknown'`);
    await queryRunner.query(`ALTER TABLE "warehouse_zones" ADD COLUMN IF NOT EXISTS "storage_mode" varchar(32) NOT NULL DEFAULT 'ambient'`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_parts_storage_class" ON "parts" ("storage_class")`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_parts_storage_class"`);
    await queryRunner.query(`ALTER TABLE "warehouse_zones" DROP COLUMN IF EXISTS "storage_mode"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP COLUMN IF EXISTS "storage_class"`);
  }
}
