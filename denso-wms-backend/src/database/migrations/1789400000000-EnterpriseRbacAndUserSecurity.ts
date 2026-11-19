import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnterpriseRbacAndUserSecurity1789400000000 implements MigrationInterface {
  name = 'EnterpriseRbacAndUserSecurity1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add enterprise roles to PostgreSQL enum
    await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'super_admin'`);
    await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'inbound_staff'`);
    await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'outbound_staff'`);
    await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'inventory_auditor'`);
    await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'qc_inspector'`);
    await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'warehouse_coordinator'`);
    await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'viewer'`);

    // 2. Add columns to users table
    await queryRunner.query(`
      ALTER TABLE "public"."users"
        ADD COLUMN IF NOT EXISTS "department" character varying(120),
        ADD COLUMN IF NOT EXISTS "permissions" text[],
        ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone,
        ADD COLUMN IF NOT EXISTS "login_attempts" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone,
        ADD COLUMN IF NOT EXISTS "phone" character varying(30);
    `);

    // 3. Create user security audit events table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "public"."user_security_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "actor_id" uuid,
        "actor_email" character varying(255),
        "target_user_id" uuid,
        "target_user_email" character varying(255),
        "event_type" character varying(64) NOT NULL,
        "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "ip_address" character varying(64),
        "user_agent" text,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_user_security_events_created_at" ON "public"."user_security_events" ("created_at" DESC);
      CREATE INDEX IF NOT EXISTS "idx_user_security_events_target" ON "public"."user_security_events" ("target_user_id");
      CREATE INDEX IF NOT EXISTS "idx_user_security_events_type" ON "public"."user_security_events" ("event_type");
    `);

    // 4. Update initial departments for existing baseline accounts
    await queryRunner.query(`
      UPDATE "public"."users" SET "department" = 'Ban Quản trị & Điều hành Hệ thống' WHERE "role" = 'admin' AND "department" IS NULL;
      UPDATE "public"."users" SET "department" = 'Bộ phận Quản lý Kho Vận' WHERE "role" = 'warehouse_manager' AND "department" IS NULL;
      UPDATE "public"."users" SET "department" = 'Vận hành Kho Hàng' WHERE "role" = 'warehouse_staff' AND "department" IS NULL;
      UPDATE "public"."users" SET "department" = 'Kiểm toán & Đánh giá Tồn kho' WHERE "email" ILIKE '%inventory%' AND "department" IS NULL;
      UPDATE "public"."users" SET "department" = 'Phòng Kiểm soát Chất lượng (QC)' WHERE "email" ILIKE '%qc%' AND "department" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."user_security_events"`);
    await queryRunner.query(`
      ALTER TABLE "public"."users"
        DROP COLUMN IF EXISTS "department",
        DROP COLUMN IF EXISTS "permissions",
        DROP COLUMN IF EXISTS "must_change_password",
        DROP COLUMN IF EXISTS "last_login_at",
        DROP COLUMN IF EXISTS "login_attempts",
        DROP COLUMN IF EXISTS "locked_until",
        DROP COLUMN IF EXISTS "phone";
    `);
  }
}
