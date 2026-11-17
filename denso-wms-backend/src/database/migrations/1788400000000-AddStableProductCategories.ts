import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStableProductCategories1788400000000 implements MigrationInterface {
  name = 'AddStableProductCategories1788400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE parts ADD COLUMN product_family varchar(40)');
    await queryRunner.query('ALTER TABLE warehouse_zones ADD COLUMN product_family varchar(40)');
    await queryRunner.query('CREATE INDEX idx_parts_product_code ON parts (product_code)');
    // Retain confirmed rack assignments and unambiguous storage classes. Leave conflicts for review.
    await queryRunner.query(`
      WITH candidates AS (
        SELECT p.id, nullif(btrim(p.product_code), '') AS sku,
               COALESCE(c.product_family, CASE WHEN p.storage_class IN
                 ('condiments','beverages','chilled_food','produce','household') THEN p.storage_class END) AS family
        FROM parts p LEFT JOIN containers c ON c.id = p.container_id
      ), sku_families AS (
        SELECT sku, min(family) AS family FROM candidates WHERE sku IS NOT NULL
        GROUP BY sku HAVING count(DISTINCT family) = 1
      )
      UPDATE parts p SET product_family = CASE WHEN c.sku IS NULL THEN c.family ELSE s.family END
      FROM candidates c LEFT JOIN sku_families s ON s.sku = c.sku
      WHERE p.id = c.id AND (c.sku IS NULL AND c.family IS NOT NULL OR s.family IS NOT NULL)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_parts_product_code');
    await queryRunner.query('ALTER TABLE warehouse_zones DROP COLUMN product_family');
    await queryRunner.query('ALTER TABLE parts DROP COLUMN product_family');
  }
}
