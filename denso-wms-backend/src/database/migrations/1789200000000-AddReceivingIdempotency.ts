import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReceivingIdempotency1789200000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE receiving_idempotency (
        actor_id uuid NOT NULL,
        request_key varchar(128) NOT NULL,
        payload_hash text NOT NULL,
        receipt_id uuid REFERENCES receiving_receipts(id),
        PRIMARY KEY (actor_id,request_key)
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      LOCK TABLE receiving_idempotency IN ACCESS EXCLUSIVE MODE;
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM receiving_idempotency) THEN RAISE EXCEPTION 'Receiving retry history exists'; END IF;
      END $$;
      DROP TABLE receiving_idempotency;
    `);
  }
}
