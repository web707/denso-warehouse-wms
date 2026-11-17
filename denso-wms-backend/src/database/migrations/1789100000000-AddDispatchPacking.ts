import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDispatchPacking1789100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE dispatch_packing_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        dispatch_id uuid NOT NULL,
        part_id uuid NOT NULL,
        quantity integer NOT NULL CHECK (quantity > 0),
        actor_id uuid NOT NULL,
        request_key varchar(128) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY(dispatch_id, part_id) REFERENCES dispatch_allocations(dispatch_id, part_id),
        UNIQUE(dispatch_id, request_key)
      );
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      LOCK TABLE dispatch_packing_entries IN ACCESS EXCLUSIVE MODE;
      DO $$ BEGIN
        IF EXISTS(SELECT 1 FROM dispatch_packing_entries) THEN RAISE EXCEPTION 'Packing history exists'; END IF;
      END $$;
      DROP TABLE dispatch_packing_entries;
    `);
  }
}
