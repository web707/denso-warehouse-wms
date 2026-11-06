import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRackProductFamily1788100000000 implements MigrationInterface {
  name = 'AddRackProductFamily1788100000000';
  public async up(q: QueryRunner): Promise<void> {
    // Additive migration: do not rewrite or relocate old inventory.
    await q.query(`ALTER TABLE "containers" ADD COLUMN IF NOT EXISTS "product_family" varchar(40)`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "containers" DROP COLUMN IF EXISTS "product_family"`);
  }
}
