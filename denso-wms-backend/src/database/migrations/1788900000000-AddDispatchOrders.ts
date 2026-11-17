import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDispatchOrders1788900000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE dispatch_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reference varchar(100) NOT NULL UNIQUE,
        sku varchar(120) NOT NULL,
        quantity integer NOT NULL CHECK (quantity > 0),
        actor_id uuid NOT NULL,
        request_key varchar(128) NOT NULL,
        status text NOT NULL CHECK (status IN ('RESERVED','PICKED','SHIPPED','CANCELLED')),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(actor_id, request_key)
      );
      CREATE TABLE dispatch_allocations (
        dispatch_id uuid NOT NULL REFERENCES dispatch_orders(id),
        part_id uuid NOT NULL REFERENCES parts(id),
        lot_id uuid NOT NULL REFERENCES inventory_lots(id),
        quantity integer NOT NULL CHECK(quantity > 0),
        PRIMARY KEY(dispatch_id, part_id)
      );
      CREATE INDEX dispatch_allocations_part_idx ON dispatch_allocations(part_id);
      CREATE TABLE dispatch_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        dispatch_id uuid NOT NULL REFERENCES dispatch_orders(id),
        actor_id uuid NOT NULL,
        status text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE FUNCTION preserve_dispatch_stock() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE held integer;
      BEGIN
        SELECT COALESCE(SUM(a.quantity),0) INTO held FROM dispatch_allocations a
          JOIN dispatch_orders d ON d.id=a.dispatch_id
          WHERE a.part_id=OLD.id AND d.status IN ('RESERVED','PICKED');
        IF held > 0 THEN
          IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Active outbound hold prevents deletion' USING ERRCODE='23514'; END IF;
          IF NEW.quantity_pcs < held OR NEW.container_id IS DISTINCT FROM OLD.container_id
            OR NEW.preferred_rack_slot IS DISTINCT FROM OLD.preferred_rack_slot THEN
            RAISE EXCEPTION 'Active outbound hold prevents stock or location change' USING ERRCODE='23514';
          END IF;
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER parts_preserve_dispatch_stock BEFORE UPDATE OF quantity_pcs,container_id,preferred_rack_slot OR DELETE
        ON parts FOR EACH ROW EXECUTE FUNCTION preserve_dispatch_stock();
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      LOCK TABLE dispatch_orders IN ACCESS EXCLUSIVE MODE;
      DO $$ BEGIN
        IF EXISTS(SELECT 1 FROM dispatch_orders) THEN RAISE EXCEPTION 'Dispatch history exists'; END IF;
      END $$;
      DROP TRIGGER parts_preserve_dispatch_stock ON parts;
      DROP FUNCTION preserve_dispatch_stock();
      DROP TABLE dispatch_events, dispatch_allocations, dispatch_orders;
    `);
  }
}
