-- MASAN WMS: KIEM TRA KHO - CHI DOC, KHONG SUA/XOA DU LIEU
-- Sử dụng trên bản backup/staging trước; đổi warehouse_code/zone_code theo môi trường.
-- 1. Kể cả khi giao diện chỉ vẽ 20 kệ, truy vấn này hiển thị toàn bộ bản ghi thực tế.
SELECT
  c.warehouse_code,
  c.zone_code,
  c.name AS rack_name,
  c.id AS rack_id,
  c.order_id AS original_order_id,
  COUNT(p.id) AS part_count,
  COALESCE(SUM(p.carton_count), 0) AS cartons,
  COALESCE(SUM(p.total_weight_kg), 0) AS weight_kg,
  c.created_at
FROM containers c
LEFT JOIN parts p ON p.container_id = c.id
WHERE c.warehouse_code = 'DENSO-WH' AND c.zone_code = 'ZONE-A'
GROUP BY c.warehouse_code, c.zone_code, c.name, c.id, c.order_id, c.created_at
ORDER BY c.name, c.created_at;

-- 2. Phát hiện kệ trùng tên trong cùng Zone (có thể do tạo 20 kệ cho mỗi đơn).
SELECT c.warehouse_code, c.zone_code, UPPER(TRIM(c.name)) AS rack_name,
       COUNT(*) AS record_count,
       ARRAY_AGG(c.id ORDER BY c.created_at) AS rack_ids
FROM containers c
GROUP BY c.warehouse_code, c.zone_code, UPPER(TRIM(c.name))
HAVING COUNT(*) > 1
ORDER BY record_count DESC;

-- 3. Phát hiện Zone có trên 20 bản ghi (bao gồm các tên R21...).
SELECT warehouse_code, zone_code, COUNT(*) AS stored_rack_records
FROM containers
GROUP BY warehouse_code, zone_code
HAVING COUNT(*) > 20
ORDER BY stored_rack_records DESC;

-- Không DELETE/UPDATE trực tiếp ở đây. Đối chiếu hàng trước khi điều chuyển
-- khỏi bản ghi thừa; chỉ xoá kệ sau khi đã hết PART liên kết và đã backup.
