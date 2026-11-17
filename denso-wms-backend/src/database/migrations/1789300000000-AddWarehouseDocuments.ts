import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWarehouseDocuments1789300000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE warehouse_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        kind text NOT NULL, status text NOT NULL CHECK (status IN ('UPLOADED','NEEDS_REVIEW','DRAFT','ISSUED','VOIDED')),
        reference_id uuid, original_key uuid UNIQUE, filename text, mime text, checksum text UNIQUE,
        fields jsonb NOT NULL DEFAULT '{}', extraction jsonb, identity text UNIQUE,
        created_by uuid NOT NULL REFERENCES users(id), revision integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (kind, reference_id)
      );
      CREATE INDEX warehouse_documents_created_idx ON warehouse_documents(created_at DESC);
      CREATE TABLE warehouse_document_events (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, document_id uuid NOT NULL REFERENCES warehouse_documents(id),
        actor_id uuid NOT NULL REFERENCES users(id), action text NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE warehouse_document_versions (
        document_id uuid NOT NULL REFERENCES warehouse_documents(id), version integer NOT NULL,
        storage_key uuid NOT NULL UNIQUE, checksum text NOT NULL, snapshot jsonb NOT NULL,
        actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(document_id, version)
      );
      CREATE TABLE warehouse_document_receipts (
        document_id uuid NOT NULL REFERENCES warehouse_documents(id),
        line_number integer NOT NULL CHECK(line_number>0), receipt_id uuid NOT NULL UNIQUE REFERENCES receiving_receipts(id),
        PRIMARY KEY(document_id,line_number)
      );
    `);
  }

  async down(q: QueryRunner) {
    await q.query(`
      LOCK TABLE warehouse_documents IN ACCESS EXCLUSIVE MODE;
      DO $$ BEGIN IF EXISTS(SELECT 1 FROM warehouse_documents) THEN
        RAISE EXCEPTION 'Warehouse documents exist'; END IF; END $$;
      DROP TABLE warehouse_document_receipts, warehouse_document_versions, warehouse_document_events, warehouse_documents;
    `);
  }
}
