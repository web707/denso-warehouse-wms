import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryIdempotency1788200000000 implements MigrationInterface {
  name = 'AddInventoryIdempotency1788200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE inventory_idempotency (
        actor_id uuid NOT NULL,
        request_key varchar(128) NOT NULL,
        request_hash char(64) NOT NULL,
        response jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (actor_id, request_key)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE inventory_idempotency');
  }
}
