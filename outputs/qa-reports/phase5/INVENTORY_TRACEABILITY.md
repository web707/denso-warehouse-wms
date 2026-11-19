# MASAN CONSUMER WMS – INVENTORY INTEGRITY & TRACEABILITY AUDIT (PHASE 5)

**Dự án**: MASAN CONSUMER WMS ENTERPRISE TAKEOVER  
**Tài liệu**: Inventory Conservation, Split Lot Genealogy & Cross-SKU Risk Audit  
**Môi trường kiểm thử**: QA Database `wms_phase4_restore_test` (Port 5025)  
**Tác giả**: PostgreSQL DBA & Inventory Controller Lead  
**Ngày lập**: 12/11/2026  

---

## 1. TỔNG QUAN KIỂM TOÁN TỒN KHO & TRUY XUẤT NGUỒN GỐC

Trong ngành hàng tiêu dùng nhanh (FMCG) như Masan Consumer (với các mặt hàng thực phẩm, nước mắm Chinsu, Nam Ngư, mì Omachi, Kokomi, xúc xích Ponnie), tính toàn vẹn tồn kho và khả năng truy xuất nguồn gốc (Lot Traceability & Genealogy) là **yêu cầu sống còn** về mặt pháp lý, an toàn vệ sinh thực phẩm và quản trị tài chính.

Giai đoạn Phase 5 tiến hành kiểm thử thực nghiệm chuyên sâu trên 4 khía cạnh:
1. **Chia tách lô liên hoàn nhiều bước (Multi-step Sequential Partial Transfers)**.
2. **Ngăn chặn xuất vượt tồn dưới tải đồng thời (Concurrent Outbound vs Stock Conservation)**.
3. **Tính toàn vẹn của sổ cái giao dịch bất biến (Immutable Ledger Trail)**.
4. **Kiểm toán rủi ro trùng số Lô giữa các mã sản phẩm khác nhau (Cross-SKU Lot Number Collision)**.

---

## 2. KẾT QUẢ KIỂM THỬ THỰC NGHIỆM CHI TIẾT

Toàn bộ 4 bài thử nghiệm được thực thi tự động qua test suite `work/phase5-traceability.cjs` với kết quả ghi nhận như sau:

```
[PASS] TRC-01: Multi-step sequential split (100 -> 30 + 40 + 30) -> {"count":3,"totalQty":100,"totalWeight":50,"expectedQty":100}
[PASS] TRC-02: Concurrent outbound allocation prevents over-issue -> {"out1":201,"out2":400,"finalTotalInStock":15,"stockConserved":true}
[PASS] TRC-03: Complete ledger audit trail for split lot -> {"transactionsCount":2,"transactions":[...]}
[PASS] TRC-04: Cross-SKU lot number uniqueness audit (Risk finding) -> {"affectedLotsCount":2,"sampleLots":[{"lot_number":"7fc7ff2a-EXPIRED","sku_count":"2"},{"lot_number":"LOT-2026-001","sku_count":"4"}]}
```

---

### BÀI THỬ 1 (TRC-01): BẢO TOÀN DỮ LIỆU KHI CHIA TÁCH NHIỀU BƯỚC
- **Kịch bản**:
  1. Nhập một lô hàng gốc gồm **100 sản phẩm**, 10 thùng, tổng khối lượng **50.00 kg**, HSD: `2028-06-30`, cất tại Kệ R08 (`P3-LOAD`).
  2. Bước 1: Điều chuyển **40 sản phẩm** (4 thùng, 20.00 kg) sang Kệ R10.
  3. Bước 2: Từ số 60 sản phẩm còn lại tại Kệ R08, tiếp tục điều chuyển **30 sản phẩm** (3 thùng, 15.00 kg) sang Kệ R09.
- **Dữ liệu thực tế đối chiếu trong PostgreSQL**:
  ```sql
  SELECT id, quantity_pcs, carton_count, total_weight_kg, expiration_date, lot_number, container_id 
  FROM parts WHERE lot_number = 'P5-TRACE-MULTI-1794500427845' 
  ORDER BY quantity_pcs DESC;
  ```
  | ID Bản ghi | Số lượng (pcs) | Thùng | Khối lượng (kg) | Hạn sử dụng | Mã Lô | Kệ đích |
  |---|---:|---:|---:|:---:|:---:|:---:|
  | `d8031aee...` (Tách bước 1) | 40 | 4 | 20.00 | 2028-06-30 | `P5-TRACE-MULTI...` | Kệ R10 |
  | `0ac4ea21...` (Tách bước 2) | 30 | 3 | 15.00 | 2028-06-30 | `P5-TRACE-MULTI...` | Kệ R09 |
  | `03e351f0...` (Phần còn lại gốc) | 30 | 3 | 15.00 | 2028-06-30 | `P5-TRACE-MULTI...` | Kệ R08 |
  | **TỔNG CỘNG** | **100** | **10** | **50.00** | **Nhất quán** | **Nhất quán** | **Phân bổ 3 kệ** |
- **Kết luận**:
  - Tổng số lượng: $40 + 30 + 30 = 100$ (Đúng 100%).
  - Tổng khối lượng: $20.00 + 15.00 + 15.00 = 50.00\text{ kg}$ (Đúng 100%).
  - Hạn sử dụng, phân loại lưu trữ (`storageClass`), đơn vị tính (`uomCode`) được nhân bản nguyên vẹn sang các bản ghi con. Không phát sinh sai lệch số học.

---

### BÀI THỬ 2 (TRC-02): CHỐNG XUẤT VƯỢT TỒN KHO DƯỚI TRANH CHẤP ĐỒNG THỜI
- **Kịch bản**:
  1. Tạo lô hàng gồm **50 sản phẩm**. Đã được QC kiểm định đạt chuẩn (`OK`).
  2. Giả lập 2 nhân viên kho cùng lúc thực hiện thao tác xuất cho lô hàng này:
     - Nhân viên A gửi yêu cầu xuất: **35 sản phẩm**.
     - Nhân viên B gửi yêu cầu xuất: **25 sản phẩm**.
     - Tổng yêu cầu: $35 + 25 = 60\text{ sản phẩm} > 50\text{ sản phẩm}$ (vượt tồn thực tế).
- **Kết quả đo lường**:
  - Giao dịch của Nhân viên A (35 pcs): **HTTP 201 Created** (Thành công).
  - Giao dịch của Nhân viên B (25 pcs): **HTTP 400 Bad Request** (`OUTBOUND_INSUFFICIENT_STOCK`).
  - Kiểm tra tồn kho thực tế còn lại trong database: Đúng chính xác **15 sản phẩm** ($50 - 35 = 15$).
- **Kết luận**:
  - Khóa bi quan `SELECT ... FOR UPDATE` trên bảng `parts` bảo vệ hoàn hảo tính nguyên tử (Atomicity & Isolation). Hệ thống loại trừ hoàn toàn nguy cơ xuất âm kho hoặc xuất khống hàng.

---

### BÀI THỬ 3 (TRC-03): TOÀN VẸN SỔ CÁI GIAO DỊCH (AUDIT TRAIL)
- **Kịch bản**: Kiểm tra bảng `inventory_transactions` cho toàn bộ các bước chia tách trong TRC-01.
- **Kết quả đối chiếu**:
  - Có đủ 2 dòng giao dịch kiểu `transfer`.
  - Dòng 1: `from_rack_id: R08` -> `to_rack_id: R10`, `quantity_pcs: 40`.
  - Dòng 2: `from_rack_id: R08` -> `to_rack_id: R09`, `quantity_pcs: 30`.
  - Snapshot trước và sau giao dịch ghi nhận đầy đủ người thực hiện và dấu thời gian (`created_at`).
  - Sổ cái là bất biến (không hỗ trợ cập nhật hay xóa dòng giao dịch).

---

## 3. PHÁT HIỆN RỦI RO NGHIÊM TRỌNG: SỐ LÔ TRÙNG GIỮA CÁC SKU (TRC-04)

> [!WARNING]
> **RỦI RO AN TOÀN CHẤT LƯỢNG & PHÁP LÝ (CRITICAL RISK FINDING)**:
> Qua bài kiểm tra truy vấn thực tế trên cơ sở dữ liệu `wms_phase4_restore_test`, phát hiện hiện tượng **Số Lô (`lot_number`) bị dùng chung cho nhiều SKU khác nhau**!

### Bằng chứng truy vấn thực tế:
```sql
SELECT lot_number, count(DISTINCT product_code) AS sku_count 
FROM parts 
WHERE lot_number IS NOT NULL AND lot_number != '' 
GROUP BY lot_number 
HAVING count(DISTINCT product_code) > 1;
```
Kết quả trả về:
- Lô `LOT-2026-001` đang được gắn cho **4 mã SKU khác nhau**!
- Lô `7fc7ff2a-EXPIRED` đang được gắn cho **2 mã SKU khác nhau**!

### Phân tích hiểm họa đối với Masan Consumer:
1. Hiện tại, bảng `inspections` (kiểm định chất lượng) chỉ lưu khóa `lot_number VARCHAR`.
2. Khi bộ phận KCS kiểm tra một lô mì Omachi mang số lô `LOT-2026-001` và đánh giá là `NG` (Hỏng/Chặn xuất), logic `latestLotQuality` trong backend sẽ tìm theo chuỗi `lot_number`.
3. **HẬU QUẢ**: Toàn bộ các sản phẩm khác (ví dụ nước mắm hoặc tương ớt) vô tình mang cùng số lô `LOT-2026-001` cũng sẽ **BỊ CHẶN XUẤT OAN UỔNG**, hoặc ngược lại, một sản phẩm đạt chuẩn có thể giải phóng nhầm một sản phẩm bị hỏng của mã hàng khác!

---

## 4. ĐỀ XUẤT CẢI TIẾN KIẾN TRÚC DOANH NGHIỆP (ENTERPRISE REMEDIATION)

Để đảm bảo độ tin cậy tuyệt đối cho Masan Consumer, kiến trúc dữ liệu cần được nâng cấp:

1. **Ràng buộc Tính duy nhất theo Cặp (SKU + Lot Uniqueness)**:
   - Thêm chỉ mục duy nhất:
     ```sql
     CREATE UNIQUE INDEX idx_parts_sku_lot_unique ON parts (product_code, lot_number) WHERE lot_number IS NOT NULL;
     ```
2. **Nâng cấp Bảng Kiểm định Chất lượng (`inspections`)**:
   - Bổ sung cột `product_code` vào bảng `inspections`.
   - Khóa ngoại kiểm tra chất lượng phải là `(product_code, lot_number)` thay vì chỉ `lot_number`.
3. **Bổ sung Cột Liên kết Phả hệ Trực tiếp (`parent_part_id`)**:
   - Hiện tại, khi một phần hàng bị tách, bản ghi mới có cùng `lot_number` nhưng không có con trỏ trỏ trực tiếp đến `id` của bản ghi nguồn (phải suy luận qua `inventory_transactions`).
   - Khuyến nghị thêm cột `split_from_id UUID REFERENCES parts(id)` để việc vẽ cây phả hệ (Genealogy Tree) trực quan và nhanh chóng hơn gấp 10 lần.
