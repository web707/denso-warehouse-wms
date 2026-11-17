import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryLotIdentity1788600000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      LOCK TABLE parts, inspections, inventory_transactions IN ACCESS EXCLUSIVE MODE;
      CREATE TABLE inventory_lots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_code text NOT NULL CHECK (product_code <> '' AND product_code = btrim(product_code)),
        lot_number text NOT NULL CHECK (lot_number <> '' AND lot_number = btrim(lot_number)),
        UNIQUE (product_code, lot_number)
      );
      INSERT INTO inventory_lots (product_code, lot_number)
      SELECT DISTINCT btrim(product_code), btrim(lot_number) FROM parts
      WHERE btrim(product_code) <> '' AND btrim(lot_number) <> '';
      ALTER TABLE parts ADD lot_id uuid REFERENCES inventory_lots(id);
      UPDATE parts p SET lot_id = l.id FROM inventory_lots l
        WHERE btrim(p.product_code) = l.product_code AND btrim(p.lot_number) = l.lot_number;
      CREATE INDEX parts_lot_identity_idx ON parts(lot_id);
      ALTER TABLE inspections ADD lot_id uuid REFERENCES inventory_lots(id);
      CREATE INDEX inspections_lot_identity_idx ON inspections(lot_id, inspection_date DESC, created_at DESC, id DESC)
        WHERE lot_id IS NOT NULL;
      CREATE INDEX inspections_unresolved_lot_idx ON inspections(btrim(lot_number)) WHERE lot_id IS NULL;
      ALTER TABLE inventory_transactions ADD lot_id uuid REFERENCES inventory_lots(id), ADD destination_part_id uuid;
      CREATE INDEX inventory_transactions_lot_identity_idx ON inventory_transactions(lot_id) WHERE lot_id IS NOT NULL;

      CREATE FUNCTION assign_part_lot_identity() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE sku text := btrim(NEW.product_code); batch text := btrim(NEW.lot_number);
      BEGIN
        IF TG_OP = 'UPDATE' AND OLD.lot_id IS NOT NULL
          AND (sku IS DISTINCT FROM btrim(OLD.product_code) OR batch IS DISTINCT FROM btrim(OLD.lot_number)) THEN
          RAISE EXCEPTION 'Existing PART lot identity is immutable' USING ERRCODE = '23514';
        END IF;
        IF NULLIF(sku, '') IS NULL OR NULLIF(batch, '') IS NULL THEN
          NEW.lot_id := NULL;
        ELSE
          SELECT id INTO NEW.lot_id FROM inventory_lots WHERE product_code = sku AND lot_number = batch;
          IF NEW.lot_id IS NULL THEN
            INSERT INTO inventory_lots(product_code, lot_number) VALUES (sku, batch) ON CONFLICT DO NOTHING;
            SELECT id INTO STRICT NEW.lot_id FROM inventory_lots WHERE product_code = sku AND lot_number = batch;
          END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER parts_assign_lot_identity BEFORE INSERT OR UPDATE OF product_code, lot_number, lot_id
        ON parts FOR EACH ROW EXECUTE FUNCTION assign_part_lot_identity();
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      LOCK TABLE parts, inspections, inventory_transactions IN ACCESS EXCLUSIVE MODE;
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM inspections WHERE lot_id IS NOT NULL)
          OR EXISTS (SELECT 1 FROM inventory_transactions WHERE lot_id IS NOT NULL OR destination_part_id IS NOT NULL) THEN
          RAISE EXCEPTION 'Linked QC or inventory history exists; use a forward fix';
        END IF;
      END $$;
      DROP TRIGGER parts_assign_lot_identity ON parts;
      DROP FUNCTION assign_part_lot_identity();
      DROP INDEX inspections_unresolved_lot_idx;
      ALTER TABLE inventory_transactions DROP COLUMN destination_part_id, DROP COLUMN lot_id;
      ALTER TABLE inspections DROP COLUMN lot_id;
      ALTER TABLE parts DROP COLUMN lot_id;
      DROP TABLE inventory_lots;
    `);
  }
}
