import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReceivingReceiptsAndQuarantine1788700000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS receiving_receipts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now(),
        receipt_number character varying NOT NULL UNIQUE,
        po_number character varying NOT NULL,
        product_code character varying NOT NULL,
        part_name character varying NOT NULL,
        lot_number character varying NOT NULL,
        lot_id uuid REFERENCES inventory_lots(id),
        expected_quantity_pcs integer NOT NULL,
        received_quantity_pcs integer NOT NULL,
        discrepancy_quantity_pcs integer NOT NULL DEFAULT 0,
        discrepancy_type character varying NOT NULL DEFAULT 'MATCH',
        damaged_quantity_pcs integer NOT NULL DEFAULT 0,
        good_quantity_pcs integer NOT NULL DEFAULT 0,
        carton_count integer NOT NULL DEFAULT 0,
        total_weight_kg numeric(10,2) NOT NULL DEFAULT 0,
        target_rack_id uuid REFERENCES containers(id),
        target_slot integer,
        quarantine_rack_id uuid REFERENCES containers(id),
        discrepancy_reason text,
        status character varying NOT NULL DEFAULT 'COMPLETED',
        approved_by character varying,
        received_by character varying,
        part_id uuid REFERENCES parts(id),
        damaged_part_id uuid REFERENCES parts(id),
        note text
      );

      CREATE INDEX IF NOT EXISTS "IDX_receiving_receipts_receipt_number" ON receiving_receipts(receipt_number);
      CREATE INDEX IF NOT EXISTS "IDX_receiving_receipts_po_number" ON receiving_receipts(po_number);
      CREATE INDEX IF NOT EXISTS "IDX_receiving_receipts_status" ON receiving_receipts(status);

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM warehouse_zones WHERE code = 'ZONE-Q') THEN
          INSERT INTO warehouse_zones (code, name, description, active, storage_mode, warehouse_code)
          VALUES ('ZONE-Q', 'Khu vực Cách ly & Xử lý Sự cố', 'Khu vực cách ly kiểm định và xử lý hàng lỗi/hỏng', true, 'ambient', 'DENSO-WH');
        END IF;
      END $$;

      DO $$ 
      DECLARE type_id uuid;
      BEGIN
        SELECT id INTO type_id FROM container_types LIMIT 1;
        IF NOT EXISTS (SELECT 1 FROM containers WHERE name = 'R-QUARANTINE') THEN
          INSERT INTO containers (name, warehouse_code, zone_code, container_type_id, product_family)
          VALUES ('R-QUARANTINE', 'DENSO-WH', 'ZONE-Q', type_id, 'quarantine');
        END IF;
      END $$;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TABLE IF EXISTS receiving_receipts;
      DELETE FROM containers WHERE name = 'R-QUARANTINE';
      DELETE FROM warehouse_zones WHERE code = 'ZONE-Q';
    `);
  }
}
