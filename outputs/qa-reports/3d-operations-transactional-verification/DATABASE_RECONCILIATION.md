# BÁO CÁO ĐỐI SOÁT CƠ SỞ DỮ LIỆU (DATABASE RECONCILIATION)
**Hệ thống:** MASAN CONSUMER WMS · TRUNG TÂM ĐIỀU HÀNH KHO 3D  
**Database:** PostgreSQL 18 (Port: 55434, Database: `wms_twin_v33_qa_1611`)  
**Ngày đối soát:** 17/11/2026  
**Kết quả đối soát:** **8/8 BẢNG TRÙNG KHỚP TUYỆT ĐỐI (MATCH PASS)**

---

## 1. BẢNG ĐỐI SOÁT DELTA THỰC TẾ VS KỲ VỌNG

| STT | Tên bảng CSDL | Số bản ghi ban đầu | Số bản ghi sau kiểm định | Delta thực tế | Delta kỳ vọng | Trạng thái đối soát | Giải thích nghiệp vụ |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| 1 | `parts` | 537 | 539 | **+2** | $\ge 1$ | **MATCH (PASS)** | Tách lô điều chuyển tạo mới PART tại ô đích |
| 2 | `containers` | 44 | 44 | **0** | $0$ | **MATCH (PASS)** | Dãy kệ và cấu trúc kho giữ nguyên, không biến đổi |
| 3 | `warehouse_zones` | 22 | 22 | **0** | $0$ | **MATCH (PASS)** | Phân khu kho giữ nguyên |
| 4 | `inventory_transactions` | 763 | 765 | **+2** | $\ge 1$ | **MATCH (PASS)** | Ghi nhận 2 giao dịch chuyển kho thực tế |
| 5 | `cycle_counts` | 19 | 20 | **+1** | $+1$ | **MATCH (PASS)** | Tạo thành công 1 đợt kiểm kê định kỳ E2E |
| 6 | `dispatch_orders` | 326 | 327 | **+1** | $+1$ | **MATCH (PASS)** | Tạo thành công 1 lệnh xuất kho E2E (`DISP-QA-E2E-55876`) |
| 7 | `dispatch_allocations` | 327 | 328 | **+1** | $+1$ | **MATCH (PASS)** | Cấp phát mềm 1 vị trí lô hàng cho lệnh xuất |
| 8 | `dispatch_events` | 932 | 934 | **+2** | $+2$ | **MATCH (PASS)** | Ghi nhận 2 sự kiện kiểm toán: `RESERVED` và `PICKED` |

## 2. KẾT LUẬN ĐỐI SOÁT
Toàn bộ thay đổi trong database đều có nguồn gốc rõ ràng từ các giao dịch nghiệp vụ hợp lệ. Không có bản ghi rác, không có hiện tượng mất mát dữ liệu hoặc trôi lệch khóa ngoại.
