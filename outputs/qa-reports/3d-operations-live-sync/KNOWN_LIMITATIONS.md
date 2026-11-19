# BÁO CÁO CÁC GIỚI HẠN ĐÃ BIẾT & LỘ TRÌNH NÂNG CẤP (KNOWN LIMITATIONS)
**Dự án:** MASAN CONSUMER WMS · Control Center 3D Live Sync  
**Ngày thực hiện:** 17/11/2026  

---

## 1. Các giới hạn hiện tại

1. **Cơ chế truyền thông (Polling vs WebSocket/SSE):**
   - *Hiện trạng:* Đang sử dụng cơ chế Controlled Polling 2500ms kết hợp `storage` broadcast event nội bộ trình duyệt. Cơ chế này hoạt động hoàn hảo cho môi trường QA và cụm kho vừa và nhỏ (< 50 client đồng thời).
   - *Giới hạn:* Khi mở rộng lên quy mô tập đoàn với hàng nghìn màn hình điều hành truy cập đồng thời, việc polling có thể làm tăng tải HTTP request lên API Gateway.

2. **Quy mô đối tượng 3D (Level of Detail - LOD):**
   - *Hiện trạng:* Toàn bộ pallet và kết cấu kệ trong Zone A (60 ô) được render với độ chi tiết cao (high-poly nan gỗ và ray sắt).
   - *Giới hạn:* Nếu mở rộng đồng thời toàn bộ 10 Zone với hơn 5,000 pallet, các thiết bị tablet hoặc máy trạm cấu hình thấp có thể bị sụt giảm FPS nếu không áp dụng kỹ thuật InstancedMesh và LOD giảm đa giác ở khoảng cách xa.

3. **Tọa độ xe nâng vật lý (Simulation vs Real-world Telemetry):**
   - *Hiện trạng:* Hành trình xe nâng hiện là Physical Sandbox mô phỏng chuyển động có tính toán va chạm và tiếp xúc càng pallet.
   - *Giới hạn:* Chưa nhận tọa độ RTLS (Real-Time Location System) thời gian thực từ cảm biến Ultra-Wideband (UWB) gắn trên xe nâng thực tế tại kho Masan.

---

## 2. Lộ trình nâng cấp đề xuất (Future Roadmap)

1. **Triển khai WebSockets / Server-Sent Events (SSE):**
   - Tích hợp NestJS WebSocket Gateway (`@nestjs/websockets`) để backend chủ động đẩy (push) sự kiện `INVENTORY_MUTATED`, `TASK_ASSIGNED` về frontend ngay trong vòng < 100ms.

2. **Áp dụng InstancedMesh & Three.js LOD:**
   - Tối ưu hóa bộ nhớ GPU cho phép hiển thị hàng chục nghìn pallet trên toàn cụm kho Masan mà vẫn duy trì 60 FPS.

3. **Tích hợp cảm biến UWB / RFID RTLS:**
   - Đấu nối API nhận tọa độ GPS/UWB của xe nâng và công nhân để biểu diễn xe nâng di chuyển theo vị trí vật lý thực tế trong kho.
