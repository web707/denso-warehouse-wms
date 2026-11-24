import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDispatchData1789300000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // 1. Check if DISP-QA-667979 already exists
    const existing = await q.query("SELECT id FROM dispatch_orders WHERE reference = 'DISP-QA-667979' LIMIT 1;");
    if (existing && existing.length > 0) return;

    // 2. Ensure container/rack exists for placing the part
    let containers = await q.query("SELECT id FROM containers WHERE warehouse_code = 'DENSO-WH' LIMIT 1;");
    let containerId = containers?.[0]?.id;
    if (!containerId) {
      let types = await q.query("SELECT id FROM container_types LIMIT 1;");
      let typeId = types?.[0]?.id;
      if (!typeId) {
        const newTypes = await q.query(`
          INSERT INTO container_types (code, label, internal_length_mm, internal_width_mm, internal_height_mm, max_cbm, max_payload_kg)
          VALUES ('RACK20-A', 'Kệ công nghiệp 20 ô - Khu A', 6500, 900, 3000, 17.550, 10000.00)
          RETURNING id;
        `);
        typeId = newTypes[0].id;
      }
      containerId = 'b530a998-a483-46ef-9988-e52db3d46eaa';
      await q.query(`
        INSERT INTO containers (id, name, warehouse_code, zone_code, container_type_id, created_at, updated_at)
        VALUES ('${containerId}', 'R01', 'DENSO-WH', 'ZONE-A', '${typeId}', now(), now())
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    // 3. Ensure inventory lot exists
    await q.query(`
      INSERT INTO inventory_lots (id, product_code, lot_number)
      VALUES ('96b45964-04da-4e1d-bbf4-7427d92c8208', 'DQA-NAMNGU-VANG', 'DQA-NAMNGU-VANG-L2')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 4. Ensure part exists
    const parts = await q.query("SELECT id FROM parts WHERE product_code = 'DQA-NAMNGU-VANG' LIMIT 1;");
    let partId = parts?.[0]?.id;
    if (!partId) {
      let orders = await q.query("SELECT id FROM orders LIMIT 1;");
      let orderId = orders?.[0]?.id;
      if (!orderId) {
        orderId = 'a1111111-1111-1111-1111-111111111111';
        await q.query(`
          INSERT INTO orders (id, name, order_number, division, destination)
          VALUES ('${orderId}', 'ORD-SEED-01', 'ORD-SEED-01', 'FMCG', 'DOMESTIC')
          ON CONFLICT (id) DO NOTHING;
        `);
      }

      let divisions = await q.query("SELECT id FROM divisions LIMIT 1;");
      let divisionId = divisions?.[0]?.id;
      if (!divisionId) {
        divisionId = 'b2222222-2222-2222-2222-222222222222';
        await q.query(`
          INSERT INTO divisions (id, code, name, sort_order)
          VALUES ('${divisionId}', 'DIV-A', 'Division A', 1)
          ON CONFLICT (id) DO NOTHING;
        `);
      }

      let dcPrefixes = await q.query("SELECT id FROM dc_prefixes LIMIT 1;");
      let dcPrefixId = dcPrefixes?.[0]?.id;
      if (!dcPrefixId) {
        dcPrefixId = 'c3333333-3333-3333-3333-333333333333';
        await q.query(`
          INSERT INTO dc_prefixes (id, division_id, code, sort_order)
          VALUES ('${dcPrefixId}', '${divisionId}', 'AA', 1)
          ON CONFLICT (id) DO NOTHING;
        `);
      }

      partId = '77d10455-188b-4fcc-a43a-5027ace54885';
      await q.query(`
        INSERT INTO parts (
          id, order_id, division_id, dc_prefix_id, part_name, product_code, master_po, quantity_pcs, total_weight_kg,
          carton_count, carton_length_mm, carton_width_mm, carton_height_mm, cbm,
          container_id, color_hex, preferred_rack_slot, lot_number, uom_code,
          expiration_date, storage_class, product_family, lot_id, receiving_damaged, created_at, updated_at
        ) VALUES (
          '${partId}', '${orderId}', '${divisionId}', '${dcPrefixId}', 'Nước mắm Nam Ngư Đệ Nhị Nhãn Vàng', 'DQA-NAMNGU-VANG', 'PO-MASAN-2026-01', 100, 20.00,
          10, 230, 160, 140, 0.051520,
          '${containerId}', '#ec4899', 6, 'DQA-NAMNGU-VANG-L2', 'EA',
          '2027-11-20', 'condiments', 'condiments', '96b45964-04da-4e1d-bbf4-7427d92c8208', false, now(), now()
        ) ON CONFLICT (id) DO NOTHING;
      `);
    }

    // 5. Ensure admin user exists for actor_id
    const actors = await q.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1;");
    const actorId = actors?.[0]?.id || '203aeca8-ac0c-42dc-99e7-d612150baab5';

    // 6. Insert dispatch orders
    await q.query(`
      INSERT INTO dispatch_orders (id, reference, sku, quantity, actor_id, request_key, status, created_at)
      VALUES
        ('dd664c1f-cf00-4bd5-8441-8836d14eb864', 'DISP-QA-667979', 'DQA-NAMNGU-VANG', 2, '${actorId}', 'disp-key-667979', 'PICKED', now() - interval '2 hours'),
        ('59a756c2-bfcc-4333-824e-8ae323594f07', 'DISP-QA-552547', 'DQA-NAMNGU-VANG', 2, '${actorId}', 'disp-key-552547', 'PICKED', now() - interval '4 hours'),
        ('e074b510-8085-4020-b4e8-de2e880bd505', 'DISP-QA-886642', 'DQA-NAMNGU-VANG', 2, '${actorId}', 'disp-key-886642', 'PICKED', now() - interval '6 hours'),
        ('ddcf373d-02b7-46a5-8856-b9721f5697e3', 'DO-CONC-CYC-0d88ec', 'DQA-NAMNGU-VANG', 5, '${actorId}', 'disp-key-0d88ec', 'RESERVED', now() - interval '10 hours'),
        ('84524411-bec9-4911-856c-4a470e9bb0c7', 'DO-IDEMP-a08c33', 'DQA-NAMNGU-VANG', 5, '${actorId}', 'disp-key-a08c33', 'RESERVED', now() - interval '12 hours')
      ON CONFLICT (reference) DO NOTHING;
    `);

    // 7. Insert allocations
    await q.query(`
      INSERT INTO dispatch_allocations (dispatch_id, part_id, lot_id, quantity)
      VALUES
        ('dd664c1f-cf00-4bd5-8441-8836d14eb864', '${partId}', '96b45964-04da-4e1d-bbf4-7427d92c8208', 2),
        ('59a756c2-bfcc-4333-824e-8ae323594f07', '${partId}', '96b45964-04da-4e1d-bbf4-7427d92c8208', 2),
        ('e074b510-8085-4020-b4e8-de2e880bd505', '${partId}', '96b45964-04da-4e1d-bbf4-7427d92c8208', 2),
        ('ddcf373d-02b7-46a5-8856-b9721f5697e3', '${partId}', '96b45964-04da-4e1d-bbf4-7427d92c8208', 5),
        ('84524411-bec9-4911-856c-4a470e9bb0c7', '${partId}', '96b45964-04da-4e1d-bbf4-7427d92c8208', 5)
      ON CONFLICT (dispatch_id, part_id) DO NOTHING;
    `);

    // 8. Insert dispatch events
    await q.query(`
      INSERT INTO dispatch_events (dispatch_id, actor_id, status, created_at)
      VALUES
        ('dd664c1f-cf00-4bd5-8441-8836d14eb864', '${actorId}', 'RESERVED', now() - interval '2 hours'),
        ('dd664c1f-cf00-4bd5-8441-8836d14eb864', '${actorId}', 'PICKED', now() - interval '90 minutes'),
        ('59a756c2-bfcc-4333-824e-8ae323594f07', '${actorId}', 'RESERVED', now() - interval '4 hours'),
        ('59a756c2-bfcc-4333-824e-8ae323594f07', '${actorId}', 'PICKED', now() - interval '3 hours');
    `);

    // 9. Insert packing entries
    await q.query(`
      INSERT INTO dispatch_packing_entries (dispatch_id, part_id, quantity, actor_id, request_key, created_at)
      VALUES
        ('dd664c1f-cf00-4bd5-8441-8836d14eb864', '${partId}', 2, '${actorId}', 'pack-key-667979', now() - interval '80 minutes'),
        ('59a756c2-bfcc-4333-824e-8ae323594f07', '${partId}', 2, '${actorId}', 'pack-key-552547', now() - interval '170 minutes')
      ON CONFLICT (dispatch_id, request_key) DO NOTHING;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DELETE FROM dispatch_packing_entries WHERE dispatch_id IN ('dd664c1f-cf00-4bd5-8441-8836d14eb864', '59a756c2-bfcc-4333-824e-8ae323594f07');
      DELETE FROM dispatch_events WHERE dispatch_id IN ('dd664c1f-cf00-4bd5-8441-8836d14eb864', '59a756c2-bfcc-4333-824e-8ae323594f07');
      DELETE FROM dispatch_allocations WHERE dispatch_id IN ('dd664c1f-cf00-4bd5-8441-8836d14eb864', '59a756c2-bfcc-4333-824e-8ae323594f07');
      DELETE FROM dispatch_orders WHERE reference IN ('DISP-QA-667979', 'DISP-QA-552547');
    `);
  }
}
