-- Dung tren PostgreSQL TEST sau khi nap data. CHI DOC, KHONG THAY DOI.
-- Cac ngay/HSD la du lieu gia lap, khong phai thong so chinh thuc cua Masan.
SELECT
  COUNT(*) FILTER (WHERE product_code LIKE 'MASAN-TEST-%') AS lo_demo_moi,
  COUNT(DISTINCT product_code) FILTER (WHERE product_code LIKE 'MASAN-TEST-%') AS sku_demo_moi,
  COUNT(*) FILTER (WHERE product_code LIKE 'MASAN-DEMO-%') AS lo_demo_cu,
  COUNT(*) FILTER (WHERE product_code LIKE 'MASAN-TEST-%' AND expiration_date IS NULL) AS lo_moi_thieu_hsd,
  COUNT(*) FILTER (WHERE product_code LIKE 'MASAN-TEST-%' AND storage_class = 'unknown') AS lo_moi_chua_phan_loai
FROM parts;

SELECT p.product_code, COUNT(*) AS so_lo, MIN(p.expiration_date) AS hsd_som_nhat, MAX(p.expiration_date) AS hsd_muon_nhat
FROM parts p WHERE p.product_code LIKE 'MASAN-TEST-%'
GROUP BY p.product_code HAVING COUNT(*) > 1 ORDER BY p.product_code;

SELECT c.zone_code, c.name AS ke, COUNT(p.id) AS so_lo, COALESCE(SUM(p.total_weight_kg), 0) AS tong_kg
FROM containers c LEFT JOIN parts p ON p.container_id = c.id
WHERE c.zone_code LIKE 'ZONE-TEST-%'
GROUP BY c.zone_code, c.name ORDER BY c.zone_code, c.name;

SELECT p.product_code, p.part_name, p.lot_number, p.expiration_date, p.storage_class,
       c.zone_code, c.name AS ke, p.preferred_rack_slot
FROM parts p LEFT JOIN containers c ON c.id = p.container_id
WHERE p.product_code LIKE 'MASAN-TEST-%'
ORDER BY p.product_code, p.expiration_date;
