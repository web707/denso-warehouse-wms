import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryQualityAudit1788300000000 implements MigrationInterface {
  name = 'AddInventoryQualityAudit1788300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TYPE history_events_type_enum ADD VALUE IF NOT EXISTS 'inspection_changed'");
  }

  async down(): Promise<void> {
    // PostgreSQL enum values are retained to preserve existing audit records.
  }
}
