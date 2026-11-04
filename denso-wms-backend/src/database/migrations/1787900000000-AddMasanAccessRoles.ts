import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds roles without rewriting users or changing stock-related tables. */
export class AddMasanAccessRoles1787900000000 implements MigrationInterface {
  name = 'AddMasanAccessRoles1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'warehouse_manager'`);
    await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'director'`);
    await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'warehouse_staff'`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL enum labels cannot be removed safely while accounts use them.
  }
}
