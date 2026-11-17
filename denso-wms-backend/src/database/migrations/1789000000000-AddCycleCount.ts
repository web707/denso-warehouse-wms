import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCycleCount1789000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE cycle_counts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        part_id uuid NOT NULL REFERENCES parts(id),
        creator_id uuid NOT NULL,
        first_counter uuid NOT NULL REFERENCES users(id),
        second_counter uuid REFERENCES users(id),
        assessor_id uuid,
        snapshot jsonb NOT NULL,
        first_result jsonb,
        second_result jsonb,
        reason text,
        adjustment_id uuid REFERENCES inventory_transactions(id),
        status text NOT NULL CHECK(status IN ('FIRST','SECOND','REVIEW','CLOSED')),
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK(second_counter IS NULL OR second_counter <> first_counter)
      );
      CREATE UNIQUE INDEX cycle_open_part ON cycle_counts(part_id) WHERE status<>'CLOSED';
      CREATE TABLE cycle_count_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        count_id uuid NOT NULL REFERENCES cycle_counts(id),
        actor_id uuid NOT NULL,
        action text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      LOCK TABLE cycle_counts IN ACCESS EXCLUSIVE MODE;
      DO $$ BEGIN
        IF EXISTS(SELECT 1 FROM cycle_counts) THEN RAISE EXCEPTION 'Cycle count history exists'; END IF;
      END $$;
      DROP TABLE cycle_count_events, cycle_counts;
    `);
  }
}
