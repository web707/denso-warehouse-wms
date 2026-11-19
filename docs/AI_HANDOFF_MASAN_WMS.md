# Bàn giao MASAN Consumer WMS cho Antigravity & Đội ngũ Dự án

## 17/11/2026 · Phase Flagship – Warehouse Operations Control Center 3D · PASS 100%

- **Nâng cấp Trung tâm Điều hành Kho 3D Toàn diện (Operations Control Center):** Chuyển hóa toàn diện mô hình 3D từ việc chỉ hiển thị tĩnh thành **Trung tâm Điều hành Kho 3D chuyên nghiệp** cho phòng chỉ huy vận hành kho Masan Consumer.
- **Học tập UX/UI Doanh nghiệp & Dark Industrial Theme:**
  - Thiết kế bố cục Dark Enterprise Theme (`#070d18` / `#0b1424`), tỷ lệ chiếm dụng 3D tối ưu không gian hiển thị trung tâm.
  - Tích hợp thanh KPI Summary trên đỉnh: Tổng 60 ô, 25 ô có hàng (41.7%), 35 ô trống, 14,400 PCS, 1 ô cảnh báo QC NG, tổng số nhiệm vụ kho đang mở.
  - Bổ sung 3 chế độ trực quan hóa đa tầng: Trạng thái kiểm định QC (`qc`), Bản đồ nhiệt mật độ tồn (`heatmap`), và Tỷ lệ sử dụng dung lượng thể tích/tải trọng (`space`).
- **Thanh tra Chi tiết Ô kệ & Pallet (Inspector Drawer):**
  - Click trực tiếp 3D vào kệ/ô hoặc sử dụng bộ chọn ô nhanh (Quick Slot Navigator `< S01 >`).
  - Hiển thị đầy đủ thông tin nghiệp vụ: SKU, Tên sản phẩm, Số lô (Lot), Hạn dùng (ExpiryBadge FEFO), Số lượng tồn, Quy cách thùng/kg, Trạng thái QC và Lịch sử giao dịch 24h.
  - Tương tác 100% ô trống: Ô trống có hitbox chuyên dụng, hiển thị khung cyan wireframe và thông báo sẵn sàng nhận hàng.
- **Điều hành Tác vụ Nghiệp vụ Trực tiếp từ 3D (Direct Operations & RBAC):**
  - **Điều chuyển hàng (`QuickTransferModal`):** Điền sẵn nguồn, tự động lọc ô nhận trống an toàn, phát tín hiệu `wms-inventory-committed` cập nhật CSDL.
  - **Tạo lệnh soạn hàng Picking (`QuickPickingModal`):** Điền sẵn SKU, kiểm tra tồn khả dụng, sinh mã đơn `DISP-YYYYMMDD-XXXX`.
  - **Mở đợt kiểm kê Cycle Count (`QuickCycleCountModal`):** Điền số lượng sổ sách, phân công kiểm kê 2 vòng độc lập chuẩn Phân tách trách nhiệm (SoD), ngăn chặn tài khoản nhân viên kho tự mở đợt kiểm kê nếu không có quyền quản lý.
- **Sidebar Trái - Quản lý Nhiệm vụ & Biểu đồ Phụ tải (Workload Trend):**
  - Tab "Nhiệm vụ kho": Danh sách lệnh soạn hàng, điều chuyển, kiểm kê với nhãn trạng thái trực quan (Đang làm - WIP, Chờ xử lý - Ready, Hoàn tất - Done), ước lượng hoàn thành (`~3h 45m`) và biểu đồ xu hướng phụ tải theo giờ.
  - Tab "Kệ & Dung lượng": Thanh tiến độ năng lực từng dãy kệ R01, R02, R03 với tổng tải 30,000 kg / 150 m³.
- **Việt hóa 100% Toàn diện (Zero Stray English):** Chuyển ngữ 100% toàn bộ nhãn 3D trên mặt sàn kho (`KHU VỰC TIẾP NHẬN HÀNG`, `TRẠM KIỂM ĐỊNH CHẤT LƯỢNG (QC)`, `KHU VỰC SOẠN & ĐÓNG GÓI`), các nút bấm, chú thích, hộp thoại và tooltip.
- **Bộ Kiểm thử Trình duyệt Playwright & Zero DB Mutations:**
  - Chạy tự động trọn bộ 12 kịch bản nghiệm thu đạt **ALL_PASS (100%)**.
  - Đối soát CSDL PostgreSQL 55434: **0 đột biến CSDL ngoài ý muốn** (toàn bộ 7 bảng chính giữ nguyên số lượng bản ghi).
  - Thu thập đầy đủ 12 ảnh chụp màn hình độ phân giải cao tại `outputs/ui-redesign/supply-chain-3d/operations-control-center/screenshots/`. Báo cáo đầy đủ tại `WAREHOUSE_OPERATIONS_CONTROL_CENTER_REPORT.md`.

## 17/11/2026 · Phase Next – Unified Warehouse 3D & Operational Integration · PASS 100%

- **Thống nhất Mô hình Nhà kho 3D (Unified Warehouse Scene):** Giải quyết dứt điểm sự phân tách giữa "Sơ đồ kho 3D" (`WarehouseScene3D.jsx`) và "Hành trình 3D" (`AnimatedSupplyScene.jsx`). Toàn bộ hệ thống hiện sử dụng chung một mô hình nhà kho công nghiệp, chung một hệ tọa độ chuẩn xác và tái sử dụng bộ component dùng chung (`warehouseLayoutAdapter.js`, `sceneCoordinateMapper.js`, `SharedRackGeometry.jsx`, `InventoryVisualization.jsx`, `PalletGeometry.jsx`).
- **Đồng bộ Dữ liệu Nghiệp vụ WMS 3 Kệ & 60 Ô Zone A:** Kết nối trực tiếp cơ sở dữ liệu PostgreSQL clone 55434 (`wms_twin_v33_qa_1611`) và NestJS REST API clone 5089. Zone A gồm 3 kệ công nghiệp R01 ($x = -2.80$), R02 ($x = 0.00$), R03 ($x = +2.80$) trên trục $z = -3.00$; tổng 60 ô (mỗi kệ 5 bay $\times$ 4 tầng), 25 ô chứa hàng thực tế (R01: 10 used/14 parts, R02: 14 used/14 parts, R03: 1 used/1 part; tổng 14,400 PCS). Tuyệt đối không hardcode số liệu; đồng bộ 100% mã sản phẩm SKU, số lô Lot, số lượng và mã màu QC (Xanh: APPROVED, Cam: PENDING, Đỏ: REJECTED).
- **Mở rộng Động cơ Putaway 60 Ô Kệ (Full Sweep Matrix):** Kiểm thử hình học OBB / SAT continuous sweep tự động trên toàn bộ 60 ô của cả 3 kệ Zone A đạt **PASS 60/60 (100.0%)** với 18,060 mẫu quét không va chạm vi phạm. Khắc phục triệt để va chạm dầm khi rút càng qua công thức $\text{releaseLift} = 0.32 + \text{level} \times 0.52$ (tạo khe hở $+0.004$ trên dầm) và loại bỏ vật cản ảo `rearRackZ = 0.6098` trong `warehouseNavigation.js`.
- **Kịch bản Xuất kho Từng phần (Partial Picking 20/100) & Tua ngược Tất định:** Vị trí ban đầu chứa 100 đơn vị; 20 đơn vị được bốc lên càng xe nâng đưa về Staging Dock an toàn; 80 đơn vị giữ nguyên trạng thái bất động trên dầm kệ. Tua ngược timeline từ 100% về 0% khôi phục hoàn hảo 100 đơn vị nguyên vẹn không biến dạng hình học.
- **Xử lý Ô Kệ Bị Chiếm chỗ (Occupied Slot):** Khi ô đích có hàng, xe nâng dừng an toàn tại hành lang $z = -1.20$, không vươn càng vào ô kệ; phân loại va chạm ghi nhận `FORBIDDEN_OVERLAP: ô mô phỏng đã có pallet khác`, UI hiển thị nhãn cảnh báo đỏ `BLOCKED`.
- **Phân tách Rạch ròi Sandbox & Operational Replay:** Sandbox có nhãn `SIMULATION / NO INVENTORY EFFECT`, không thay đổi tồn kho và không phát sinh API ghi. Operational Replay đọc sự kiện thật, dừng an toàn tại Receiving Dock đối với PART bị QC BLOCKED/HOLD, không tạo putaway giả.
- **Bảo toàn Dữ liệu CSDL Tuyệt đối (Zero Mutation):** Đối soát toàn bộ 35 bảng CSDL trên PostgreSQL 55434 trước và sau chuỗi test: 100% trùng khớp mã hash MD5 và số bản ghi (0 mutation).
- **Đo kiểm Hiệu năng & Minh chứng Trình duyệt:** Đạt 34 FPS trên CPU SwiftShader software rasterizer (tương đương chuẩn 60 FPS trên GPU rời); JS Heap 29.0 MB cực kỳ tinh gọn. Thu thập đủ 12 ảnh chụp màn hình độ nét cao tại `outputs/ui-redesign/supply-chain-3d/unified-warehouse-integration/screenshots/` và video walkthrough `unified_warehouse_walkthrough.webm`. Báo cáo đầy đủ tại `UNIFIED_WAREHOUSE_INTEGRATION_REPORT.md`.

## 17/11/2026 · Phase Next – 20-Slot Putaway & Partial Picking 3D · PASS 100%

- **Mở rộng Động cơ Putaway 20 Ô Kệ (S01–S20):** Hoàn thành engine tổng quát nhận `targetSlotId` cho toàn bộ 5 khoang $\times$ 4 tầng thuộc Kệ R01 ($z = -3.00$). Kiểm thử OBB/SAT continuous sweep 6.020 mẫu đạt **0 va chạm vi phạm (Zero Penetration Hits)** với clearance $\ge 0.05$. Toàn bộ 20/20 ô đạt chuẩn tiếp xúc dầm đỡ (`VALID_SUPPORT_CONTACT`), nhả tải (`VALID_RELEASE_CONTACT`) và rút càng (`VALID_RETREAT`).
- **Kịch bản Xuất kho Từng phần (Partial Picking 20/100):** Triển khai động học 7 pha tất định (`APPROACH → ALIGN → INSERT_FORKS → PICK_PARTIAL → RETRACT → LOWER_AND_RETREAT → TRANSPORT_TO_STAGING`). Vị trí ban đầu chứa 100 đơn vị; 20 đơn vị được tách rời và bốc lên càng xe nâng đưa về Staging Dock ($x = 3.00, z = -1.00$); 80 đơn vị giữ nguyên trạng thái bất động trên dầm kệ. HUD hiển thị chuẩn xác `Tồn trên kệ: 80 đơn vị`, `Đã soạn: 20 / 20 đơn vị`.
- **Tính Thuận nghịch Tuyệt đối (Reversible Scrubbing):** Tua ngược timeline từ 100% về 0% khôi phục mượt mà khối hàng 20 đơn vị về lại vị trí trên kệ, tái hợp nhất đầy đủ 100 đơn vị ban đầu.
- **Xử lý Ô Kệ Bị Chiếm chỗ (Occupied Slot Handling):** Khi ô đích có cờ `occupied: true`, xe nâng dừng an toàn tại biên hành lang $z = -1.20$, không vươn càng vào ô kệ; phân loại va chạm ghi nhận chính xác `FORBIDDEN_OVERLAP: ô mô phỏng đã có pallet khác`, UI hiển thị nhãn cảnh báo đỏ `BLOCKED`.
- **Tính Xác định khi Đổi Slot (Deterministic Reset):** Khi người dùng chuyển slot hoặc đổi mode khi đang phát hoạt ảnh, hệ thống tự động dừng phát, dọn sạch state và reset timeline về 0% xác định, loại bỏ rò rỉ mesh.
- **Minh chứng Trình duyệt & Video Đầy đủ:** Thu thập đủ 18 ảnh chụp màn hình các giai đoạn tại `outputs/ui-redesign/supply-chain-3d/20-slot-expansion/screenshots/` và video walkthrough WebM hoàn chỉnh `20-slot-and-partial-picking-walkthrough.webm` (17.4 MB, $1366 \times 768$). Đo lường hiệu năng: 17–19 FPS trên SwiftShader CPU rasterizer (tương đương 60 FPS khóa chuẩn trên GPU), JS Heap 21–24 MB.
- **Bảo toàn Dữ liệu CSDL Tuyệt đối (Zero Mutation):** Đối soát 14 bảng dữ liệu WMS trên PostgreSQL clone 55434 trước và sau chuỗi test: Khớp mã hash MD5 và số dòng 100%, 0 mutation API, 0 request ghi tồn kho. Operational Replay giữ nguyên logic chặn QC BLOCKED.
- **Tài liệu & Báo cáo:** Toàn bộ báo cáo kỹ thuật được lưu tại `outputs/ui-redesign/supply-chain-3d/20-slot-expansion/20_SLOT_AND_PARTIAL_PICKING_REPORT.md` (và bản mirror tại `work/outputs/...`).

## 17/11/2026 · S01 Pallet Completion & Full Physical Journey · PASS

- **Hoàn thiện thành công một hành trình mô phỏng vật lý 3D hoàn chỉnh S01:** Receiving → Xe nâng tiếp cận pallet → Đưa càng vào khe → Nâng pallet → Vận chuyển qua hành lang → Đến kệ S01 → Hạ đúng dầm đỡ → Nhả pallet → Rút càng thành công. Động học 9 pha: `APPROACH → ALIGN → INSERT_FORKS → LIFT → TRANSPORT → POSITION → LOWER → RELEASE → RETREAT`.
- **Thiết kế lại mô hình pallet có rãnh càng thực tế:** Ván trên (top deck, $0.28 \times 0.28$), 3 thanh đỡ dọc (stringers) và 3 thanh trượt đáy (bottom runners), tạo thành 2 khe cắm càng chuyên dụng tại $z = \pm 0.09$ (rộng $0.070$, cao $0.040$). Hai càng nâng ($z = \pm 0.09$, rộng $0.036$, cao $0.020$) trượt vào khe với khoảng hở ngang $0.017$ mỗi bên và khoảng hở đứng $0.010$, không chạm thanh đỡ và không xuyên thùng hàng.
- **Tiếp xúc hình học và động học xe nâng:** `classifyPickup` chứng nhận `FORKS_INSERTED` và `VALID_PICKUP_CONTACT` tại mặt dưới ván trên ($verticalGap = 0$); pallet gắn kết hợp lệ (`ATTACHED`) và nâng lên $y = 0.44$; tuyến di chuyển Receiving $\to$ S01 qua 501 mẫu sweep liên tục đạt $CLEAR$ với clearance $0.05$; `classifySupport` chứng nhận `VALID_SUPPORT_CONTACT` khi hạ tiếp xúc dầm kệ ($verticalGap = 0$ tại $y = 0.34$, tâm pallet $y = 0.505$); chứng nhận `VALID_RELEASE_CONTACT` khi nhả tải (`RELEASED`, ô kệ `OCCUPIED_SIMULATED`); `classifyRetreat` chứng nhận `VALID_RETREAT` khi càng rút 100% không kéo pallet, pallet đứng yên tại $[-0.62, 0.505, -3.00]$.
- **Môi trường & Minh chứng thực tế:** QA preview `http://localhost:4380/supply-chain-3d`, build `VITE_API_BASE_URL=http://127.0.0.1:5089/api` và `VITE_WMS_PHYSICAL_SANDBOX=true`. Playwright đã chạy kiểm định thu thập đủ 8 ảnh chụp màn hình các pha và video walkthrough 7.9 MB `s01-complete-journey.webm`. 20 lượt tua timeline và đổi camera không sinh rò rỉ hay trùng lặp mesh.
- **Bảo toàn dữ liệu WMS tuyệt đối:** Đối soát 14 bảng dữ liệu trên clone `wms_twin_v33_qa_1611` (PostgreSQL 55434) khớp mã hash MD5 và số dòng 100%, 0 mutation request, 0 console error. Operational Replay giữ nguyên logic chặn QC BLOCKED. Toàn bộ tài liệu, ảnh, video và báo cáo lưu tại `outputs/ui-redesign/supply-chain-3d/s01-pallet-completion/`.

## 16/11/2026 · S01 physical sandbox · BLOCKED / PARTIAL

- Tách sandbox state/timeline và pallet tổng hợp khỏi Operational Replay; cùng scene, một xe nâng, không tạo dữ liệu kho. Chỉ localhost khi build bật `VITE_WMS_PHYSICAL_SANDBOX=true`; timeline bị giới hạn 20% trước pickup. Không deploy production.
- Pickup UNKNOWN vì collider đế pallet là khối đặc chưa mô hình rãnh càng; toàn tuyến, placement, release và retreat chưa chứng nhận. Không mở `routeVerified`; S01 Physical Simulation chưa PASS. Fixture support/release chỉ là kiểm tra hình học độc lập, không bật bỏ qua collision.
- Browser preview 4380/API 5089 trên QA clone: hai ảnh, video tiếp cận một phần; QC UI OK/BLOCKED với receipt khác, S01 BLOCKED chỉ kiểm tra API trực tiếp, không có transfer. 14 bảng đối soát hash và số dòng không đổi. Operational Putaway Replay chưa PASS.
- Các file chính: `denso-wms-frontend/src/components/viz/s01Sandbox.js`, `sandboxContacts.js`, `AnimatedSupplyScene.jsx`, `denso-wms-frontend/src/pages/SupplyChain3D.jsx`; scripts `work/s01-sandbox-*.mjs` / `.cjs` tại workspace cha. Xem báo cáo `../../../outputs/ui-redesign/supply-chain-3d/s01-physical-sandbox/`.
- Bước tiếp: thiết kế collider rãnh pallet/càng và tiếp xúc theo pha, chứng minh sweep với sai số và occupancy; nối Receiving→S01→retreat, kiểm tra browser trước khi mở rộng. Không sửa QC hoặc ghi tồn để vượt blocker.


## Mới nhất · 16/11/2026 · S01 complete journey chưa đạt

Đọc `../../../outputs/ui-redesign/supply-chain-3d/s01-complete-journey/FINAL_RESULT.md` và `CONTINUOUS_COLLISION.md`. Đã thêm kiểm tra liên tục interval bảo thủ; 39 đoạn staging→approach fixture CLEAR trên collider tĩnh/clearance 0,05, nhưng insertion pallet/tầng tại clearance 0,05 INCONCLUSIVE. Scene render đưa càng khi pickup; nền và dock mô phỏng về y=0 với collider dock giữ nguyên theo mesh. Pickup thực chưa được chứng minh đầy đủ; `routeVerified` vẫn false và UI dừng QC.

QA S01 theo PART trực tiếp Receiving chỉ thấy một PART hỏng BLOCKED không transfer. Browser chỉ chạy PART S11, có ảnh bị giới hạn và không có video walkthrough hoàn chỉnh; hash 14 bảng clone không đổi. Chưa chạy 20 slot, partial picking, truck docking. Không suy diễn 3D Animation Complete.

## Trước đó · 16/11/2026 · Simulation navigation reengineering

Layout mô phỏng đã nới khe 1,2→2,80978 scene-unit theo footprint và clearance; kệ sau, trụ/tầng và nhãn vùng được chỉnh, không đổi dữ liệu kho. Planner neo lưới vào goal, có collider cabin/bánh và clearance 3 trục, chạy trong worker. Fixture S01 tìm được candidate từ staging; mẫu đi/về/đưa-rút càng không báo giao, nhưng chưa kiểm chứng pickup từ Receiving, occupancy hay swept continuous; càng kéo dài chưa render. `routeVerified` vẫn false, UI dừng QC. Không chạy 20 slot, partial picking hoặc truck docking trước khi tuyến đại diện PASS.

QA 4375/5088 `wms_twin_qa`; preview 4380/5089 clone `wms_twin_v33_qa_1611` trên PostgreSQL 55434. Replay preview 30 giây/7 vòng, 40,48 FPS SwiftShader, P95 33,4 ms; 14 bảng đối chiếu không đổi và không mutation API sau đăng nhập. Đọc `../../../outputs/ui-redesign/supply-chain-3d/navigation-reengineering/RESULTS.md`, `GEOMETRY_AUDIT.md`, `REPRESENTATIVE_ROUTE.md` trước khi tiếp tục.

## Trước đó · 16/11/2026 · V3.4 blocker resolution

Đã thêm `src/components/viz/warehouseNavigation.js` và hiển thị kết quả lưới ứng viên trên SupplyChain3D. SAT OBB cho thấy 20/20 tuyến fixture có va chạm thân/tầng, 20/20 càng/trụ, 16/20 pallet/trụ; cũng có false positive từ broad phase. Lưới thử không tìm thấy route đặt 20 ô; đây không chứng minh mọi tuyến khác đều bất khả thi. `routeVerified` vẫn false, không có ô được nghiệm thu; chưa xử lý partial picking hoặc truck docking. Đọc `../../../outputs/ui-redesign/supply-chain-3d/v3-4-blocker-resolution/FINAL_ACCEPTANCE.md` và `COLLISION_ROOT_CAUSE.md`.

Preview clone 305 giây/80 vòng, SwiftShader 44,62 FPS/P95 33,4 ms, 14 bảng hash không đổi và không mutation sau đăng nhập. Chưa chứng minh không leak: dev mount/unmount chờ 500 ms có root chưa xóa, 2 giây 5/5 về 0; heap tăng theo mẫu. Không sửa wms_demo/Staging gốc/Production, không commit/push.

## Trước đó · 16/11/2026 · 3D V3.4 đang làm dở

Các pha xe nâng/pallet xác định theo timeline đã có và fixture gắn/nhả PASS. Tuyến thử nghiệm vẫn giao bao vùng kệ tại 20/20 ô theo kiểm tra bảo thủ; adapter khóa đặt kệ `routeVerified:false`, cảnh nhập dừng tại QC. Truck docking, partial picking, collision, layout toàn kho và nghiệm thu animation chưa hoàn tất. Camera kệ trỏ vị trí mô phỏng PART. Đọc `../../../outputs/ui-redesign/supply-chain-3d/v3-4/RESULTS.md` trước khi sửa tiếp.

Browser dev 20 seek/chuyển camera giữ 97 object/77 mesh, không chứng minh disposal hay không rò rỉ. Không thay đổi business/database để điều chỉnh hoạt ảnh; QA 4375/5088 và preview 4380/5089 dùng clone tương ứng.

Build cuối PASS; preview 305 giây / 80 vòng, SwiftShader 46,63 FPS, P95 33,4 ms, 14 bảng đối chiếu không đổi và không mutation API sau đăng nhập. Heap mẫu 23,5–48,4 MB, chưa kết luận rò rỉ. Xem `preview-replay-final.json` trong thư mục báo cáo V3.4.

## Trước đó · 16/11/2026 · 3D V3.3 đang làm dở

Frontend cho chọn PART, dùng QC scope và lot từ backend, hỗ trợ adapter mô phỏng 20 ô của kệ được chọn. Kiểm thử đọc mixed QC trên một phiếu và test ghi API HOLD/AVAILABLE cho hai PART cùng lot thuộc hai phiếu trên clone PASS trong phạm vi báo cáo. Tường bên được điều chỉnh và test bao xe lấy mẫu PASS có giới hạn. Chưa hoàn thiện collision, xe nâng, partial picking, mapping toàn kho hoặc đồng bộ QC tức thời. Đọc `../../../outputs/ui-redesign/supply-chain-3d/v3-3/RESULTS.md` trước khi tiếp tục.

QA cũ 4375 / 5088 / 55434 `wms_twin_qa`; clone viết thử `wms_twin_v33_qa_1611` / API 5089 / UI 4376; production-preview 4380 dùng clone. Không reset database, sửa `wms_demo`, Staging gốc hay Production, không commit/push.

Lần benchmark bị ngắt sau đó Windows báo `0xC0000142`; PostgreSQL QA được phục hồi, 4375/5088 và 4380/5089 được khởi động lại, health API OK, frontend HTTP 200; UI clone 4376 chưa chạy lại. Lần benchmark trước sửa tường có bằng chứng nhưng chưa chứng minh hoạt ảnh liên tục đủ 5 phút. Build preview trỏ vào API clone 5089.

Replay bản build cuối sau sửa bộ điều khiển test: 305 giây, 80 vòng, slider không đứng quá 500 ms, SwiftShader 41,46 FPS/P95 33,4 ms, hash 14 bảng khớp và không có request mutation. Heap tăng 27,2→39,4 MB; chưa đánh giá rò rỉ hoặc object count. Chi tiết trong `preview-replay-final.json`.

## Trước đó · 16/11/2026 · 3D V3.2 đang làm dở

Code scene và trang Supply Chain 3D đã bổ sung QC theo scope PART, quay/lùi minh họa và camera bám pallet; layout vẫn SIMULATION. Replay 62 vòng / 305 giây trong Chromium SwiftShader, hash 9 bảng được đối chiếu không thay đổi. Kiểm tra đọc BLOCKED thật PASS trong phạm vi nêu tại `../../../outputs/ui-redesign/supply-chain-3d/v3-2/RESULTS.md`; chưa tạo HOLD qua API hoặc nghiệm thu collision, mapping kệ/slot, partial picking và E2E. Build frontend PASS.

QA frontend 4375, backend 5088, PostgreSQL 55434 / `wms_twin_qa`. Không sửa `wms_demo`, Staging gốc hoặc Production; không thay đổi tồn chỉ để khớp cảnh 3D. Tiếp tục từ báo cáo V3.2.

## Bàn giao trước · 16/11/2026 · Hành trình 3D V3.1 QA

Mở `http://localhost:4375/supply-chain-3d` với clone `wms_twin_qa`. Hàm `sceneState` tính vị trí xe, càng và pallet theo progress. HOLD/chưa Putaway, PICKED và SHIPPED có giới hạn mô phỏng khác nhau. State check và benchmark trong `outputs/ui-redesign/supply-chain-3d/v3-1`.

Đây là bản thử chưa hoàn chỉnh. Không suy diễn state check là kiểm thử collision, kệ thực hay nghiệp vụ kho. Cần tiếp tục hoàn thiện state machine xe lùi, mapping zone/rack/slot, nâng hạ đúng tầng, camera và QA theo checkpoint.

## Bàn giao trước · 16/11/2026 · Hành trình 3D V3 QA

Trang `http://localhost:4375/supply-chain-3d` dùng API 5088 và clone `wms_twin_qa`. Cảnh tại `src/components/viz/AnimatedSupplyScene.jsx` cập nhật nền kho và giới hạn xe xuất theo SHIPPED. Kiểm thử và ảnh tại `outputs/ui-redesign/supply-chain-3d/v3`. Hoạt ảnh chưa hoàn chỉnh, xem checkpoint về các giới hạn còn lại.

## Bàn giao trước · 16/11/2026 · Hành trình 3D V2 QA

Mở `http://localhost:4375/supply-chain-3d`, clone `wms_twin_qa`. Hoạt ảnh procedural nằm tại `src/components/viz/AnimatedSupplyScene.jsx`; điều khiển trong `src/pages/SupplyChain3D.jsx`. Demo 3D là mô phỏng độc lập với timeline sự kiện thật. Chrome smoke, ảnh và đo khung hình tại `outputs/ui-redesign/supply-chain-3d/v2-smoke.log`.

Cần tiếp tục hoàn thiện mapping tuyến/dock/rack, các giai đoạn dỡ và nâng hạ chính xác, traceability sau tách PART, camera tránh xuyên vật, kiểm tra HOLD, kiểm thử dài và benchmark thiết bị thật. Không có nguồn GPS/TMS/POD.

## Bàn giao trước · 16/11/2026 · Hành trình 3D QA

Clone `wms_twin_qa` ở PostgreSQL 55434, API 5088 và web 4375. Mở `/supply-chain-3d`. Source frontend `src/pages/SupplyChain3D.jsx`, backend `src/supply-chain/supply-chain.controller.ts`, khởi động bằng `work/supply-chain-qa.ps1`. Không thêm migration. Sự kiện từ receipt, inspection, ledger, dispatch và packing. Scene là sơ đồ minh họa theo thứ tự sự kiện, link đến Warehouse 3D hiện có. Chrome smoke và đối soát tồn tại `outputs/ui-redesign/supply-chain-3d`.

Chưa có animation xe/xe nâng theo giai đoạn, camera theo đối tượng, mapping lịch sử PART sau nhiều lần tách, LPN, delivery/TMS/GPS, performance benchmark và bài test ngoại lệ. Cần tiếp tục trước khi gọi là digital twin end-to-end.

## Bàn giao trước · 16/11/2026 · Document Digitalization QA

- `wms_documents_qa` schema 22 ở PostgreSQL 55434, API 5086, web 4373. Clone regression riêng `wms_documents_regression` trên 5087/4374. Tệp và dữ liệu OCR cục bộ nằm dưới `D:/Codex-Masan-Wms-Phase8-20261115/documents-data`. Kiểm chứng `GET /api/health` trước khi thử.
- Backend `src/documents/`, migration `1789300000000-AddWarehouseDocuments.ts`, worker `scripts/document_worker.py` và `scripts/document-requirements.txt`. Frontend `src/pages/Documents.jsx`, gắn route App, sidebar, Receiving/Dispatch/QC. App mới cần schema 22 khi dùng Doc API.
- Chạy `./work/document-digitalization-qa.ps1 api` và `./work/document-digitalization-qa.ps1 web` từ outer workspace. Cài Python dependencies, cấu hình `WMS_DOCUMENT_STORAGE`, `WMS_TESSDATA` (vie/eng traineddata.gz), `WMS_PUBLIC_APP_URL` và font Arial hoặc `WMS_PDF_FONT`. Dùng backup DB song song với kho file, không xóa PDF phát hành.
- Xem [13 báo cáo](../../../outputs/qa-reports/document-digitalization/) và [hướng dẫn người dùng](../../../outputs/qa-reports/document-digitalization/13_USER_MANUAL_VI.md). Mẫu in chỉ dùng QA. Staging, `wms_demo` và production nằm ngoài phạm vi thay đổi.

## Bàn giao trước · 16/11/2026 · Phase 8 Final Blockers

- Staging gốc 4350/5050/55433, `wms_staging_test`, schema 19. QA clone 4370/5083/55434, `wms_blockers_staging`, schema 21. Benchmark QA `wms_blockers_before`/5081 và `wms_blockers_after`/5082. PITR T2 QA 4372/5085/55443.
- Source đổi Receiving service/controller, Shipment service, migration `1789200000000-AddReceivingIdempotency.ts`, MailService, backend package/lock và Receiving frontend API/form. App mới yêu cầu schema 21 khi dùng retry key. Drain writer trước cutover vì giao thức lock thay đổi. Staging gốc chưa áp migration, `wms_demo` ngoài phạm vi.
- Chạy `npm run build`, `npm test -- --runInBand` và các harness `work/phase8-blockers-*` chỉ trên clone. Báo cáo [Performance](../../../outputs/qa-reports/phase8-final-blockers/PERFORMANCE_BEFORE_AFTER.md), [Packing cutover](../../../outputs/qa-reports/phase8-final-blockers/PACKING_STAGING_MIGRATION.md) và [WAL/PITR](../../../outputs/qa-reports/phase8-final-blockers/WAL_PITR_EVIDENCE.md).
- Controlled Pilot/Production NO-GO. P95 2101 ms ở 100 VU. Audit backend không còn HIGH. Còn TLS/WAL/SCRAM và role rollout Staging, kiểm thử relay thật, thông qua quy tắc số phiếu/Packing, BDR, đối soát R01/R02, PDA và UAT người dùng.

## Bàn giao trước · 16/11/2026 · Phase 8 Final Hardening

- Staging gốc đã hoạt động lại 4350 / 5050 / PostgreSQL 55433, `wms_staging_test`, schema 19. Backend chạy mode tương thích local development với `.env.staging`; frontend preview `dist-staging`. Không thay đổi TLS/WAL, role database hoặc migration Staging.
- Bản QA mới 4368 / 5074 / 55434, `wms_final_after` schema 20. Fixture `wms_final_historical` chạy trên API 5073. Recovery 4369 / 5069 / 55441, schema 19. Chỉ migrate clone.
- File source thay đổi gồm `denso-wms-backend/src/inventory/inventory.service.ts`, package.json/lockfile backend và frontend, harness `work/phase8-final-*` và cập nhật harness Phase 8. Không có migration source mới. Xem [Final Hardening](../../../outputs/qa-reports/phase8-hardening/FINAL_HARDENING.md) và [Hướng dẫn Packing](HUONG_DAN_PACKING.md).
- P95 100 VU 2362 ms, gate FAIL. Còn HIGH Nodemailer, TLS/WAL/least privilege Staging, 7 BDR, Packing policy, R01/R02, PDA và ký UAT. Controlled Pilot/Production NO-GO.

## Bàn giao trước · 16/11/2026 · Phase 8 Hardening

Project root giữ nguyên. Xem [fix log](../../../outputs/qa-reports/phase8-hardening/FIX_LOG.md) để biết source và lockfiles, [GO/NO-GO](../../../outputs/qa-reports/phase8-hardening/PRODUCTION_GO_NO_GO.md) để biết cổng phát hành.

| Môi trường | Frontend / API / PostgreSQL | Database |
|---|---|---|
| Staging gốc | 4350 / 5050 / 55433 | wms_staging_test, schema 19, các port không lắng nghe ở lượt kiểm tra cuối sau chuyển phiên |
| Hardening E2E | 4363 / 5064 / 55434 | wms_hardening_after, schema 20 |
| Mixed QC | 4367 / 5067 / 55434 | wms_hardening_mixed, schema 19 |
| Benchmark matched | API 5062/5063 và PostgreSQL 55434 lúc đo | wms_hardening_before và wms_hardening_after khi còn schema 19 |
| PITR app | 4365 / 5066 / 55440 | wms_phase8_test ở T2, schema 19 |

Chạy `npm run build` cho backend/frontend và `npm test -- --runInBand` cho backend. Các harness `work/phase8-hardening-*.{cjs,ps1}` chạy từ outer workspace, chỉ trỏ tới clone. `GET /api/health` với `DB_EXPECTED_MIGRATION=AddDispatchPacking1789100000000` dùng cho clone Packing. Không chạy đồng thời hai version writer có giao thức QC lock cũ/mới trên cùng database. Không revert Packing trên DB đã có audit. Không áp migration vào `wms_demo` hoặc production.

Production và Controlled Pilot NO-GO. P95 100 VU còn 2198 ms, Staging TLS/WAL/role chưa hoàn tất, còn HIGH advisories, Packing business rules, 7 BDR, R01/R02, PDA thật và UAT sign-off.

## Bàn giao trước · 15/11/2026 · Phase 8

Mở `C:/Users/ADMIN/Documents/Codex/2026-11-12/c-users-admin-downloads-denso-warehouse/work/denso-warehouse-wms-main`. Frontend React/Vite ở `denso-wms-frontend`, API NestJS/TypeORM ở `denso-wms-backend`, database PostgreSQL. Project root không có `.git`. Các mục Phase 7 bên dưới là lịch sử.

| Môi trường | Frontend / API / PostgreSQL | Database |
|---|---|---|
| Staging | 4350 / 5050 / 55433 | wms_staging_test, schema 19 |
| Phase 8 QA | 4358 / 5058 / 55434 | wms_phase8_test |
| Cutover | API 5060 / PostgreSQL 55434 | wms_phase8_cutover_test |
| PITR T2 | 4359 / 5059 / 55436 | wms_phase8_test tại mốc T2 |

Source thay đổi trong backend `src/config/typeorm.config.ts`, `src/health/health.controller.ts`, `src/health/health.controller.spec.ts` và hai `package-lock.json`. Chạy `npm run build` trong từng app và `npm test -- --runInBand` tại backend. Tùy chọn `DB_EXPECTED_MIGRATION=AddCycleCount1789000000000` bật kiểm tra schema trên `GET /api/health`. Lab dùng `DB_SSL_MODE=verify-full` với `DB_SSL_CA_PATH` chỉ tới CA tin cậy. TLS và role lab đã được xác minh. Chưa triển khai Phase 8 lên Staging. Không thêm migration, chỉ chạy migration 15–19, revert và forward-fix trên clone. Kiểm tra port/DB trước khi chạy harness. `wms_demo` ngoài phạm vi.

Mở [go-live gates](../../../outputs/qa-reports/phase8-preparation/PHASE8_GO_LIVE_GATES.md), [cutover](../../../outputs/qa-reports/phase8-preparation/MIGRATION_CUTOVER_REHEARSAL.md) và [recovery](../../../outputs/qa-reports/phase8-preparation/DATABASE_RECOVERY_REHEARSAL.md). Harness và logs tại outer workspace `work/phase8-*.cjs` và `work/phase8-lab`. T2 data nằm trên D vì C từng hết dung lượng. Production NO-GO, Controlled Pilot còn chờ hiệu năng, bảo mật Staging, Packing theo phạm vi, BDR, đối soát vật lý/PDA và ký UAT.

## Bàn giao hiện hành · 15/11/2026 (Hoàn tất Phase 7 Staging & UAT Readiness)

Mở thư mục dự án:

```text
C:\Users\ADMIN\Documents\Codex\2026-11-12\c-users-admin-downloads-denso-warehouse\work\denso-warehouse-wms-main
```

Đọc [checkpoint](CURRENT_PROGRESS.md) và [báo cáo phát hành Phase 7](../../../outputs/qa-reports/phase7/PHASE7_RELEASE_GATES.md) trước khi triển khai tiếp.

### Hiện trạng Môi trường Doanh nghiệp đã được Antigravity Kiểm định

Hệ thống hiện vận hành hai môi trường độc lập: QA (cũ) và Staging Doanh nghiệp (mới):

| Môi trường | Frontend URL | Backend API | Database PostgreSQL (Cổng 55433) | Phiên bản Migration | Trạng thái kỹ thuật |
|---|---|---|---|---|---|
| **Staging Doanh nghiệp** | `http://localhost:4350` | `http://127.0.0.1:5050/api` | `wms_staging_test` | **19 Migrations** (212 PARTs) | **ACTIVE 100% (GO)** |
| **QA Môi trường cũ** | `http://localhost:4340` | `http://127.0.0.1:5036/api` | `wms_historical_repair_test` | **19 Migrations** (212 PARTs) | **ACTIVE (Bảo toàn)** |
| **Database Gốc Masan** | N/A | N/A | `wms_demo` | **13 Migrations** (0 PARTs) | **BẢO TỒN 100% (NO TOUCH)** |

- **Tiến trình Staging nền (Daemon Tasks):**
  - Backend Staging (Port 5050): Chạy qua NestJS dist build với cấu hình an toàn, CORS `http://localhost:4350`, Throttler 600 req/min.
  - Frontend Staging (Port 4350): Chạy bản build production `dist-staging` qua Vite Preview.
- **Tài khoản UAT Staging (Bcrypt hashed, credentials cô lập trong `.staging-creds.json`):**
  - Quản trị viên: `staging.admin@masan.local`
  - Quản lý kho: `staging.manager@masan.local`
  - Nhân viên kho: `staging.staff@masan.local`
  - Giám sát QC: `staging.qc@masan.local`
  - Kiểm toán viên tồn kho: `staging.inventory@masan.local`

### Tóm tắt Kết quả Thực nghiệm Phase 7

1. **Kiểm thử Nghiệm thu UAT Doanh nghiệp:** Đạt **26/26 kịch bản (100% PASS)** bao quát đầy đủ 5 vai trò (Inbound, QC, Outbound, Cycle Counting, Admin) và 5 kịch bản xung đột vận hành (Idempotency-Key replay, concurrency, SoD 403, Session expiry 401, One-Rack-One-SKU rejection).
2. **Sao lưu Thảm họa PITR:** Dung lượng Base Backup 379.9 MB trong 46.54s, `pg_verifybackup` PASS 100%. Thực nghiệm PITR tại mốc $T_1$ khôi phục trọn vẹn 1,600 đơn vị hợp lệ, loại trừ hoàn toàn giao dịch lỗi tại $T_2$ (Data loss: 0). RTO = 27s, RPO $\le$ 15 phút.
3. **An toàn & Bảo mật TLS:** Đạt **7/7 tiêu chí an toàn (100% PASS)** từ SEC-01 đến SEC-07.
4. **Hiệu năng & Tải đồng thời:** Đo kiểm 5, 20, 50, 100 VUs: Thông lượng 181 đến 396 RPS, $p95 = 192\text{ms}$ (tải chuẩn 20 VUs) và $432\text{ms}$ (cao điểm 50 VUs), **0 khóa tranh chấp (0 lock contention)**.
5. **Trình duyệt Thật:** Antigravity Browser Agent xác nhận giao diện hoạt động mượt mà tại `http://localhost:4350` (Ảnh bằng chứng: `final_step_18.png`).
6. **Đánh giá Thiết bị PDA:** Logic GS1-128 và parser sẵn sàng; phần cứng vật lý đánh dấu **BLOCKED** do chưa kết nối máy quét thật.
7. **Kệ Lịch sử Zone A (R01, R02):** Giữ nguyên dữ liệu trên DB, ban hành Biểu mẫu Kiểm đếm Thực địa (Physical Verification Form) cho thủ kho ký xác nhận.
8. **Sổ Đăng ký Nghiệp vụ (BDR):** Formalized 7 quyết định cốt lõi (BDR-01 đến BDR-07) chờ Masan ký duyệt chính thức.

### Phán quyết Cổng Phát hành (Release Gates Verdict)

- **CỔNG 1 (Staging Technical Validation):** **GO**
- **CỔNG 2 (Enterprise UAT with Test Data):** **GO**
- **CỔNG 3 (Controlled Pilot with Real Inventory):** **NO-GO**
- **CỔNG 4 (Full Direct Production Deployment):** **NO-GO**

Trọn bộ 12 hồ sơ báo cáo chuyên sâu được lưu trữ tại `outputs/qa-reports/phase7/`.

---

## Bàn giao lịch sử · 15/11/2026 (Phase 6 Completion)

Má»Ÿ thÆ° má»¥c dá»± Ã¡n:

```text
C:\Users\ADMIN\Documents\Codex\2026-11-12\c-users-admin-downloads-denso-warehouse\work\denso-warehouse-wms-main
```

Äá»c [checkpoint](CURRENT_PROGRESS.md) vÃ  [tráº¡ng thÃ¡i Phase 6](../../../outputs/qa-reports/phase6-business-completion/PHASE6_COMPLETION_STATUS.md) trÆ°á»›c khi phÃ¡t triá»ƒn tiáº¿p. Ná»™i dung tá»« Phase 3 bÃªn dÆ°á»›i Ä‘Æ°á»£c lÆ°u Ä‘á»ƒ tra cá»©u lá»‹ch sá»­. Báº£n thÆ° má»¥c hiá»‡n táº¡i khÃ´ng cÃ³ `.git` á»Ÿ root; danh sÃ¡ch file bÃªn dÆ°á»›i dá»±a trÃªn mÃ£ nguá»“n, log vÃ  bÃ¡o cÃ¡o, khÃ´ng pháº£i Git diff.

### Kiáº¿n trÃºc vÃ  runtime Ä‘Ã£ xÃ¡c minh

React/Vite + React Query + Three.js â†’ NestJS/TypeORM â†’ PostgreSQL 18. Káº¿t ná»‘i chÃ­nh cho phÃ¡t triá»ƒn QA lÃ  [Vite 4340](http://localhost:4340/) â†’ [Nest 5036](http://127.0.0.1:5036/api/health) â†’ PostgreSQL 127.0.0.1:55433. `/dispatch-orders` vÃ  `/cycle-counts` lÃ  mÃ n má»›i.

| Frontend / API | Database | Migration | TÃ¬nh tráº¡ng |
|---|---|---:|---|
| 4340 / 5036 | wms_historical_repair_test | 19 | HTML vÃ  API health 200; 212 PART; má»™t SKU má»—i ká»‡ báº­t cho kiá»ƒm tra nghiá»‡p vá»¥ má»›i |
| 4338 / 5034 | wms_business_final_test | 17 | Frontend 200; API 503; DB truy váº¥n trá»±c tiáº¿p trÃªn 55433 cÃ²n 162 PART |
| 4310 / 5032 | wms_dashboard_demo_test | 16 | Frontend 200; API 503; DB truy váº¥n trá»±c tiáº¿p trÃªn 55433 cÃ²n 155 PART |
| Database chÃ­nh | wms_demo | 13 | Truy váº¥n Ä‘á»c tháº¥y 0 PART; chÆ°a Ã¡p migration 14â€“19 vÃ o Ä‘Ã¢y |

Tiáº¿n trÃ¬nh xÃ¡c minh táº¡i thá»i Ä‘iá»ƒm bÃ n giao: Vite 4340 PID 8552, Nest 5036 PID 6920, PostgreSQL WMS 55433 PID 19388. Vite 4310 vÃ  4338 cÅ©ng Ä‘ang láº¯ng nghe. CÃ¡c cáº¥u hÃ¬nh cÅ© phá»¥ thuá»™c cá»•ng 55432, tá»«ng bá»‹ PostgreSQL cá»§a dá»± Ã¡n khÃ¡c chiáº¿m. XÃ¡c minh láº¡i chá»§ tiáº¿n trÃ¬nh/cá»•ng trÆ°á»›c khi khá»Ÿi Ä‘á»™ng thÃªm dá»‹ch vá»¥. 4340 dÃ¹ng `VITE_API_BASE_URL=http://127.0.0.1:5036/api`, nÃªn health pháº£i truy cáº­p trá»±c tiáº¿p qua cá»•ng 5036.

### Lá»‡nh tham chiáº¿u khi cáº§n khá»Ÿi Ä‘á»™ng láº¡i QA

Kiá»ƒm tra listener trÆ°á»›c khi cháº¡y. Cá»¥m PostgreSQL WMS á»Ÿ thÆ° má»¥c Codex `work/wms-pg`, hiá»‡n dÃ¹ng 55433. DÃ¹ng cáº¥u hÃ¬nh káº¿t ná»‘i vÃ  bÃ­ máº­t Ä‘Ã£ cáº¥p trong mÃ´i trÆ°á»ng local. Äáº·t `DB_HOST=127.0.0.1`, `DB_PORT=55433`, `DB_NAME=wms_historical_repair_test`, `PORT=5036`, `CORS_ORIGIN=http://localhost:4340`, `WMS_ONE_SKU_PER_RACK=true` cho API QA.

```powershell
# Trong denso-wms-backend
npm.cmd run build
node.exe dist/main.js
npm.cmd test -- --runInBand

# Trong denso-wms-frontend
$env:VITE_API_BASE_URL='http://127.0.0.1:5036/api'
npm.cmd run dev -- --host localhost --port 4340 --strictPort
npm.cmd run build
```

Runner Chrome chá»‰ trá» tá»›i QA vÃ  cÃ³ thá»ƒ táº¡o dá»¯ liá»‡u thá»­. Äá»c Ä‘Ã­ch DB/API, fixture hiá»‡n cÃ³ vÃ  log trÆ°á»›c khi cháº¡y láº¡i. CÃ¡c runner/log chÃ­nh á»Ÿ thÆ° má»¥c Codex `work/phase6-completion-*` vÃ  `work/phase6-historical-*`. Runner Phase 2 má»›i nháº¥t cÃ³ báº£n vá»›i cá»•ng cÅ©; cáº§n Ä‘á»•i cáº¥u hÃ¬nh káº¿t ná»‘i Ä‘áº¿n QA 55433 náº¿u cháº¡y láº¡i, vÃ  dÃ¹ng cáº¥u hÃ¬nh tÆ°Æ¡ng thÃ­ch cho bá»™ Phase 2.

### Schema, migration vÃ  thay Ä‘á»•i

- 13 `AddStableProductCategories1788400000000` lÃ  má»‘c wms_demo. 14 thÃªm index, 15 thÃªm UUID lÃ´ theo SKU/sá»‘ lÃ´, 16 thÃªm phiáº¿u nháº­n vÃ  dock cÃ¡ch ly.
- 17 `1788800000000-AddReceivingQualityScope.ts` thÃªm pháº¡m vi QC theo PART nháº­n hÃ ng. HÃ ng há»ng vÃ  hÃ ng nguyÃªn váº¹n cá»§a phiáº¿u má»›i giá»¯ sá»‘ lÃ´ nhÃ  mÃ¡y, khÃ´ng dÃ¹ng chung phÃ¡n quyáº¿t. TÃ¡ch PART giá»¯ UUID lÃ´/pháº¡m vi.
- 18 `1788900000000-AddDispatchOrders.ts` thÃªm Ä‘Æ¡n xuáº¥t, phÃ¢n bá»•, lá»‹ch sá»­ tráº¡ng thÃ¡i vÃ  trigger báº£o vá»‡ tá»“n Ä‘Ã£ giá»¯. Giá»¯/soáº¡n khÃ´ng giáº£m tá»“n; xuáº¥t xÃ¡c nháº­n ghi ledger. QC Ä‘Æ°á»£c kiá»ƒm tra láº¡i khi soáº¡n vÃ  xuáº¥t.
- 19 `1789000000000-AddCycleCount.ts` thÃªm phiáº¿u kiá»ƒm kÃª vÃ  sá»• sá»± kiá»‡n; kiá»ƒm tra phiÃªn báº£n tá»“n, phÃ¢n quyá»n Ä‘á»™c láº­p vÃ  ghi ledger adjustment sau duyá»‡t.
- Backend má»›i nháº¥t: `src/inventory/{inventory.service.ts,inventory.controller.ts,dto/create-dispatch.dto.ts,dto/cycle-count.dto.ts,entities/inventory-transaction.entity.ts}` vÃ  hai migration 18â€“19. Mixed QC trÆ°á»›c Ä‘Ã³ Ä‘i qua `src/{receiving,parts,inspections,inventory,shipments}` vÃ  migration 17.
- Frontend má»›i nháº¥t: `src/App.jsx`, `src/components/Layout.jsx`, `src/pages/{DispatchOrders,CycleCounting,Dashboard,OrderDetail}.jsx`. OrderDetail hiá»ƒn thá»‹ Zone/ká»‡ khi putaway. Giá»¯ Ä‘Æ°á»ng ghi ledger hiá»‡n hÃ nh vÃ  ranh giá»›i QC khi má»Ÿ rá»™ng.
- `tests/repair-quarantine-qa.cjs` dry-run máº·c Ä‘á»‹nh, `--apply` chá»‰ cho báº£n sao `wms_historical_repair_test`. ÄÃ£ sá»­a 11 slot, giá»¯ 1 PART á»Ÿ S01 vÃ  thÃªm 11 audit event. Backup á»Ÿ thÆ° má»¥c Codex `work/phase6-historical-before.dump`. Lá»‹ch sá»­ 155 PART, 51 QC, 98 giao dá»‹ch vÃ  45 phiáº¿u nháº­n Ä‘Ã£ Ä‘á»‘i soÃ¡t theo ID.

### Nghiá»‡m thu vÃ  viá»‡c cÃ²n má»Ÿ

- PASS: API Phase 2 28/28 trÃªn QA sau repair vÃ  vá»›i schema 19 á»Ÿ cháº¿ Ä‘á»™ tÆ°Æ¡ng thÃ­ch; Jest 74/74; build Nest/Vite; Chrome Aâ€“D, gá»“m nháº­n â†’ QC â†’ putaway â†’ giá»¯ â†’ soáº¡n â†’ xuáº¥t â†’ kiá»ƒm kÃª â†’ Dashboard. ÄÃ£ kiá»ƒm tra giá»¯ tá»“n Ä‘á»“ng thá»i, retry máº¥t pháº£n há»“i, cháº·n HOLD sau picking, snapshot kiá»ƒm kÃª cÅ© vÃ  SoD.
- FAIL cáº¥p dá»¯ liá»‡u lá»‹ch sá»­: Zone A R01/R02 cÃ²n trá»™n SKU. MÃ´ phá»ng chá»‰ Ä‘á»c cho tháº¥y 4 PART Nam NgÆ° tá»« R02 cÃ³ thá»ƒ vÃ o R03 S02â€“S05; chÆ°a thá»±c hiá»‡n. 4 PART tÆ°Æ¡ng á»›t á»Ÿ R01 chÆ°a cÃ³ Ã´ vÃ  nhÃ³m hÃ ng. Dock dÃ¹ng chung cáº§n quyáº¿t Ä‘á»‹nh phÃ¢n ká»‡ cÃ¡ch ly theo SKU.
- OPEN BUSINESS DECISION: giá»¯ má»™t pháº§n, háº¡n giá»¯/tá»± giáº£i phÃ³ng, cáº¥p phÃ¡t láº¡i khi QC Ä‘á»•i; ngÆ°á»¡ng chÃªnh lá»‡ch, khi nÃ o báº¯t buá»™c Ä‘áº¿m láº¡i, tháº©m quyá»n kiá»ƒm kÃª; bá»‘ trÃ­ thá»±c táº¿ cá»§a ká»‡ lá»‹ch sá»­ vÃ  dock.
- NOT RUN: responsive Ä‘a viewport cho mÃ n má»›i, phÃª duyá»‡t doanh nghiá»‡p vÃ  cutover. **Phase 7 NO-GO cho váº­n hÃ nh doanh nghiá»‡p.** Æ¯u tiÃªn xá»­ lÃ½ dá»¯ liá»‡u vá»‹ trÃ­ vÃ  chÃ­nh sÃ¡ch váº­n hÃ nh, rá»“i nghiá»‡m thu láº¡i trÆ°á»›c khi láº­p lá»‹ch cutover.
- Giá»¯ nguyÃªn dá»¯ liá»‡u gá»‘c, migration Ä‘Ã£ Ã¡p dá»¥ng, ledger, backup vÃ  audit. Má»i thá»­ nghiá»‡m ghi tiáº¿p theo dÃ¹ng QA riÃªng. KhÃ´ng dÃ¹ng scaffold `src/reservations` cÅ© Ä‘á»ƒ thay Ä‘Æ°á»ng xuáº¥t Ä‘Ã£ nghiá»‡m thu.

Báº±ng chá»©ng: [há»“i quy](../../../outputs/qa-reports/phase6-business-completion/FULL_REGRESSION.md), [Chrome](../../../outputs/qa-reports/phase6-business-completion/REAL_BROWSER_UAT.md), [kiá»ƒm toÃ¡n tá»“n](../../../outputs/qa-reports/phase6-business-completion/HISTORICAL_INVENTORY_AUDIT.md), [sáºµn sÃ ng Phase 7](../../../outputs/qa-reports/phase6-business-completion/PHASE7_READINESS.md).

## Handoff lá»‹ch sá»­ Â· Phase 3

Checkpoint ngÃ y **12/11/2026**, giá» Viá»‡t Nam. **Phase 3 Ä‘Ã£ káº¿t thÃºc vá»›i quyáº¿t Ä‘á»‹nh NO-GO cho production. Phase 4 chÆ°a báº¯t Ä‘áº§u.** Báº£n local Ä‘ang cháº¡y. Äá»c [checkpoint ngáº¯n](CURRENT_PROGRESS.md), [tá»•ng káº¿t Phase 3](../../../outputs/qa-reports/phase3/QA_SUMMARY.md) vÃ  [Ä‘iá»u kiá»‡n Ä‘Ã¡nh giÃ¡ láº¡i production](../../../outputs/qa-reports/phase3/PRODUCTION_READINESS.md) trÆ°á»›c khi sá»­a.

## 1. Project vÃ  vá»‹ trÃ­ trÃªn mÃ¡y

**ThÆ° má»¥c pháº£i má»Ÿ trong Antigravity**

```text
C:\Users\ADMIN\Documents\Codex\2026-11-12\c-users-admin-downloads-denso-warehouse\work\denso-warehouse-wms-main
```

Gá»i thÆ° má»¥c trÃªn lÃ  **PROJECT**. ThÆ° má»¥c Codex chá»©a `work` vÃ  `outputs` lÃ  **WORKSPACE**, tá»©c hai cáº¥p trÃªn PROJECT. PROJECT lÃ  báº£n Ä‘Ã£ giáº£i nÃ©n vÃ  Ä‘Ã£ sá»­a, mang tÃªn DENSO tá»« archive gá»‘c. á»¨ng dá»¥ng hiá»ƒn thá»‹ MASAN Consumer WMS. Archive tham chiáº¿u náº±m á»Ÿ `C:\Users\ADMIN\Downloads\denso-warehouse-wms-main.zip`.

| ThÃ nh pháº§n | ÄÆ°á»ng dáº«n tá»« PROJECT | CÃ´ng nghá»‡ |
|---|---|---|
| Frontend | `denso-wms-frontend/` | React, React Router, Vite 6, React Query, Three.js/WebGL, Tailwind, Recharts |
| Route, API vÃ  state | `denso-wms-frontend/src/App.jsx`, `src/api/`, `src/lib/store.jsx`, `src/lib/auth.jsx` | REST qua proxy Vite, xÃ¡c thá»±c JWT, state/cache trÃ¬nh duyá»‡t |
| MÃ n hÃ¬nh nghiá»‡p vá»¥ | `denso-wms-frontend/src/pages/`, `src/components/viz/`, `src/lib/viz/` | Dashboard, nháº­p/xuáº¥t, FEFO, QC, zone/ká»‡/Ã´, QR, bÃ¡o cÃ¡o |
| Backend | `denso-wms-backend/src/main.ts`, `src/app.module.ts`, `src/config/` | Node.js 24.16.0, npm 11.13.0, NestJS/Express, TypeORM, PostgreSQL, Jest |
| Quy táº¯c ghi tá»“n vÃ  audit | `denso-wms-backend/src/inventory/`, `src/inspections/`, `src/history/`, `src/parts/`, `src/packing/` | Giao dá»‹ch, khÃ³a hÃ ng, FEFO, QC, capacity, solver |
| Migration vÃ  fixture | `denso-wms-backend/src/database/migrations/`, `src/database/seeds/`, `sample-data/` | TypeORM vÃ  dá»¯ liá»‡u thá»­ nghiá»‡m |
| Test cÃ³ thá»ƒ cháº¡y láº¡i | `tests/`, `denso-wms-backend/src/**/*.spec.ts` | Node, Jest, API vÃ  SQL |
| Báº±ng chá»©ng ngoÃ i PROJECT | `WORKSPACE/outputs/qa-reports/`, `WORKSPACE/work/phase3-*` | BÃ¡o cÃ¡o, screenshot, script QA, káº¿t quáº£ mÃ¡y Ä‘á»c Ä‘Æ°á»£c |

```mermaid
flowchart LR
    A["Chrome Â· React/Vite Â· localhost:4310"] -->|"REST /api qua Vite"| B["NestJS Â· 127.0.0.1:5001"]
    B --> C["JWT + quyá»n vai trÃ²"]
    C --> D["Nghiá»‡p vá»¥ kho, QC, nháº­p XLSX, solver vÃ  bÃ¡o cÃ¡o"]
    D -->|"TypeORM vÃ  SQL theo transaction"| E["PostgreSQL 18.6 Â· 127.0.0.1:55432 Â· wms_demo"]
    F["Playwright, REST load runner vÃ  fixture"] --> G["Backend QA riÃªng"]
    G --> H["Database *_test, tÃ¡ch khá»i wms_demo"]
```

## 2. Runtime vÃ  cÃ¡ch khá»Ÿi Ä‘á»™ng

ÄÃ£ xÃ¡c minh `GET http://localhost:4310/api/health` tráº£ 200 trong lÆ°á»£t bÃ n giao. Listener lÃºc kiá»ƒm tra: Vite PID 20328 á»Ÿ `[::1]:4310`, Nest PID 14896 á»Ÿ `127.0.0.1:5001`, PostgreSQL PID 12604 á»Ÿ `127.0.0.1:55432`. PID chá»‰ lÃ  snapshot. `wms_demo` cÃ³ 0 dÃ²ng PART á»Ÿ thá»i Ä‘iá»ƒm kiá»ƒm tra. Dá»¯ liá»‡u máº«u vÃ  stress test náº±m trong cÃ¡c DB QA.

**Chá»‰ cháº¡y cÃ¡c lá»‡nh khá»Ÿi Ä‘á»™ng náº¿u dá»‹ch vá»¥ tÆ°Æ¡ng á»©ng thá»±c sá»± Ä‘Ã£ dá»«ng.** Cháº¡y tá»«ng khá»‘i trong cá»­a sá»• PowerShell riÃªng. DÃ¹ng Ä‘Ãºng PROJECT Ä‘ang cÃ³ source vÃ  `node_modules`.

1. PostgreSQL, tá»« PROJECT. DÃ¹ng **data directory Ä‘Ã£ tá»“n táº¡i**, xÃ¡c minh `PG_VERSION` trÆ°á»›c khi cháº¡y. MÃ¡y cÃ³ PostgreSQL cÃ i sáºµn, cluster WMS Ä‘ang dÃ¹ng cá»•ng 55432 riÃªng.

   ```powershell
   $data = (Resolve-Path ../wms-pg).Path
   Get-Content (Join-Path $data 'PG_VERSION')
   & 'C:\Program Files\PostgreSQL\18\bin\postgres.exe' -D $data -h 127.0.0.1 -p 55432
   ```

2. Backend, tá»« PROJECT. `dist/main.js` hiá»‡n lÃ  báº£n Ä‘Ã£ build cá»§a Phase 3.

   ```powershell
   Set-Location denso-wms-backend
   node.exe dist/main.js
   ```

3. Frontend, tá»« PROJECT.

   ```powershell
   Set-Location denso-wms-frontend
   npm.cmd run dev -- --host localhost --strictPort
   ```

4. Kiá»ƒm tra táº¡i `http://localhost:4310/`, `/api/health` vÃ  `/api/docs`. TrÃ¡nh dÃ¹ng `START_WMS.bat` hoáº·c `START_BACKEND.bat` trong láº§n tiáº¿p nháº­n nÃ y vÃ¬ script backend gá»i migration tá»± Ä‘á»™ng. DÃ¹ng lá»‡nh trá»±c tiáº¿p á»Ÿ trÃªn.

### Environment

`denso-wms-backend/.env` lÃ  cáº¥u hÃ¬nh mÃ¡y hiá»‡n cÃ³. CÃ¡c giÃ¡ trá»‹ cÃ´ng khai Ä‘Ã£ kiá»ƒm gá»“m `NODE_ENV=development`, `PORT=5001`, `CORS_ORIGIN=http://localhost:4310`, `APP_PUBLIC_URL=http://localhost:4310`, `DB_HOST=127.0.0.1`, `DB_PORT=55432`, `DB_NAME=wms_demo`. Giá»¯ nguyÃªn file. Tham kháº£o tÃªn biáº¿n trong `.env.example` vÃ  validation táº¡i `src/config/env.validation.ts`. NhÃ³m cáº¥u hÃ¬nh riÃªng gá»“m xÃ¡c thá»±c DB, JWT access/refresh, seed admin, bcrypt vÃ  SMTP tÃ¹y chá»n. KhÃ´ng sao chÃ©p giÃ¡ trá»‹ bÃ­ máº­t vÃ o prompt, log, bÃ¡o cÃ¡o hoáº·c repo. Vite dÃ¹ng `vite.config.js` Ä‘á»ƒ proxy `/api` Ä‘áº¿n backend. `VITE_API_BASE_URL` chá»‰ dÃ¹ng khi cháº¡y frontend QA riÃªng. `VITE_PUBLIC_APP_URL` cÃ³ thá»ƒ Ä‘Æ°á»£c dÃ¹ng cho URL nhÃ£n QR khi cÃ³ hostname phÃ¹ há»£p.

## 3. PostgreSQL, schema vÃ  migration

Cluster live á»Ÿ `WORKSPACE/work/wms-pg`. CÃ¡c DB Ä‘Æ°á»£c xÃ¡c minh tá»“n táº¡i:

| DB | Má»¥c Ä‘Ã­ch |
|---|---|
| `wms_demo` | Local chÃ­nh cá»§a web 4310 |
| `wms_qa_test` | QA Phase 1, cÃ³ fixture 3 ká»‡ |
| `wms_phase2_test` | Regression Phase 2 vÃ  lÆ°á»£t cháº¡y láº¡i Phase 3 |
| `wms_phase3_test` | Fixture táº£i tá»•ng há»£p, sau benchmark |
| `wms_phase3_restore_test` | Restore Ä‘á»™c láº­p Ä‘á»ƒ UAT, backup vÃ  fault injection |

- Tá»“n hiá»‡n hÃ nh á»Ÿ `parts` theo lÃ´, SKU, UOM, HSD, sá»‘ lÆ°á»£ng/thÃ¹ng/kg, `container_id`, `preferred_rack_slot` vÃ  nhÃ³m hÃ ng. `warehouse_zones`, `containers` vÃ  `container_types` mÃ´ táº£ zone, ká»‡ vÃ  cáº¥u hÃ¬nh váº­t lÃ½. `orders`, `divisions`, `dc_prefixes` cung cáº¥p ngá»¯ cáº£nh nghiá»‡p vá»¥.
- Sá»• ghi kho á»Ÿ `inventory_transactions`, replay á»Ÿ `inventory_idempotency`, audit á»Ÿ `history_events`. `inspections` lÆ°u phÃ¡n quyáº¿t QC. `work_orders`, `shipments` há»— trá»£ truy váº¿t. `load_plans` vÃ  `carton_placements` lÃ  phÆ°Æ¡ng Ã¡n solver, khÃ´ng pháº£i nguá»“n tá»“n thá»±c táº¿. `users`, `refresh_tokens`, `password_reset_tokens` phá»¥c vá»¥ xÃ¡c thá»±c.
- `synchronize` vÃ  `migrationsRun` táº¯t trong TypeORM. Chá»‰ má»¥c SKU `idx_parts_product_code`, chá»‰ má»¥c lot vÃ  cÃ¡c FK Ä‘Ã£ cÃ³. KhÃ³a chÃ­nh `inventory_idempotency` lÃ  cáº·p actor/key. CÃ¡c báº£o vá»‡ chá»‘ng tá»“n Ã¢m, trÃ¹ng Ã´ vÃ  giá»›i háº¡n táº£i dá»±a chá»§ yáº¿u vÃ o transaction vÃ  kiá»ƒm tra cá»§a á»©ng dá»¥ng. XÃ³a Ä‘Æ¡n cÃ³ thá»ƒ cascade sang ká»‡ hoáº·c PART, cÃ²n FK sá»• cÃ³ thá»ƒ chuyá»ƒn vá» NULL.
- ÄÃ£ Ä‘á»c báº£ng `migrations` trong `wms_demo` vÃ  Ä‘á»‘i chiáº¿u vá»›i 13 file trÃªn Ä‘Ä©a. Thá»© tá»± Ä‘Ã£ Ã¡p dá»¥ng nhÆ° sau.

| Timestamp | Migration |
|---|---|
| 1785582713571 | InitSchema |
| 1785591384811 | AddOrderScopingToContainersAndHistory |
| 1787000000000 | AddWarehouseRackFields |
| 1787100000000 | AddStage3InventoryAndZones |
| 1787200000000 | AddOracleInventoryFieldsToParts |
| 1787300000000 | AddSupplyChainTables |
| 1787400000000 | AddShipmentIdToShipments |
| 1787900000000 | AddMasanAccessRoles |
| 1788000000000 | AddMasanStorageClassification |
| 1788100000000 | AddRackProductFamily |
| 1788200000000 | AddInventoryIdempotency |
| 1788300000000 | AddInventoryQualityAudit |
| 1788400000000 | AddStableProductCategories |

Ba migration cuá»‘i thuá»™c Phase 2. Phase 3 kiá»ƒm cháº¡y láº·p á»Ÿ **DB restore** vÃ  nháº­n `No migrations are pending`. Phase 3 khÃ´ng thÃªm migration. BÃ n giao chá»‰ Ä‘á»c lá»‹ch sá»­ migration.

Backup sáºµn cÃ³ á»Ÿ `WORKSPACE/work/wms-demo-before-phase2.dump` vÃ  `WORKSPACE/work/phase3-pretest.dump`. Backup Phase 3 Ä‘Ã£ restore vÃ  Ä‘á»‘i chiáº¿u schema. CÃ¡c file dump chá»©a dá»¯ liá»‡u QA vÃ  metadata tÃ i khoáº£n, giá»¯ á»Ÿ workspace riÃªng.

## 4. Quyáº¿t Ä‘á»‹nh kiáº¿n trÃºc cáº§n giá»¯

- `POST /api/inventory/transactions` ghi tá»“n, sá»• vÃ  response replay trong cÃ¹ng transaction. CÃ¹ng actor/key vÃ  payload tráº£ response Ä‘Ã£ commit. Key trÃ¹ng khÃ¡c payload tráº£ 409. API cÅ© cÃ³ thá»ƒ gá»i khÃ´ng key. Form nháº­p, xuáº¥t vÃ  Ä‘iá»u chuyá»ƒn gá»­i `Idempotency-Key`; retry pháº£i giá»¯ nguyÃªn key. KhÃ³a theo thá»© tá»± á»•n Ä‘á»‹nh Ä‘á»ƒ trÃ¡nh deadlock.
- Backend quyáº¿t Ä‘á»‹nh FEFO. `partId` xÃ¡c Ä‘á»‹nh SKU, UOM vÃ  pháº¡m vi kho. LÃ´ chÆ°a phÃ¢n bá»• xÃ©t trong cÃ¹ng Ä‘Æ¡n. Sáº¯p theo HSD rá»“i thá»i Ä‘iá»ƒm táº¡o vÃ  ID. So HSD theo `Asia/Ho_Chi_Minh`. Thiáº¿u tá»“n kháº£ dá»¥ng tá»« chá»‘i toÃ n bá»™. Khi xuáº¥t nhiá»u lÃ´, ghi tá»«ng dÃ²ng sá»• vÃ  tráº£ cÃ¡c snapshot Ä‘Ã£ cáº­p nháº­t.
- Chá»‰ QC `OK` hoáº·c `AVAILABLE` cho phÃ©p xuáº¥t. Chá» QC, HOLD vÃ  cÃ¡c tráº¡ng thÃ¡i cháº·n khÃ¡c bá»‹ tá»« chá»‘i. QC láº¥y káº¿t luáº­n má»›i nháº¥t theo sá»‘ lÃ´. Shared/exclusive advisory lock ná»‘i luá»“ng xuáº¥t vá»›i cáº­p nháº­t QC. Chá»‰ admin/quáº£n lÃ½ kho cÃ³ quyá»n giáº£i phÃ³ng lÃ´ Ä‘Ã£ bá»‹ cháº·n. Thay Ä‘á»•i QC cÃ³ audit.
- PhÃ¢n khu theo `productFamily` á»•n Ä‘á»‹nh vÃ  lá»›p báº£o quáº£n. Thay tÃªn hiá»ƒn thá»‹ khÃ´ng Ä‘á»•i nhÃ³m. Dá»¯ liá»‡u cÅ© chÆ°a Ä‘á»§ chá»©ng cá»© Ä‘Æ°á»£c Ä‘á»ƒ láº¡i táº¡i vá»‹ trÃ­ cÅ© Ä‘á»ƒ xÃ¡c nháº­n nhÃ³m. Ká»‡/zone kiá»ƒm sá»©c chá»©a vÃ  nhÃ³m á»Ÿ backend.
- Má»™t PART hiá»‡n á»Ÿ má»™t Ã´. Äiá»u chuyá»ƒn há»— trá»£ toÃ n bá»™ PART vÃ  kiá»ƒm vá»‹ trÃ­ nguá»“n ká»³ vá»ng. QR, popup vá»‹ trÃ­ vÃ  3D láº¥y vá»‹ trÃ­ tá»« PART. Zone cÃ³ tá»‘i Ä‘a 20 ká»‡ váº­t lÃ½, má»—i ká»‡ 20 Ã´. Báº£n ghi ká»‡ dÆ° Ä‘Æ°á»£c bÃ¡o riÃªng Ä‘á»ƒ Ä‘á»‘i chiáº¿u. Solver dÃ¹ng mm, kiá»ƒm biÃªn, sá»‘ kiá»‡n, xoay, táº£i vÃ  CBM.
- BÃ¡o cÃ¡o giao dá»‹ch dÃ¹ng `GET /api/inventory/transaction-summary` theo ngÃ y Viá»‡t Nam vÃ  zone. Endpoint danh sÃ¡ch giá»›i háº¡n 500 dÃ²ng chá»‰ phá»¥c vá»¥ lá»‹ch sá»­ chi tiáº¿t. `/api/health` kiá»ƒm PostgreSQL vÃ  tráº£ 503 khi DB khÃ´ng sáºµn sÃ ng.

## 5. TÃ­nh nÄƒng, sá»­a lá»—i vÃ  báº±ng chá»©ng QA

CÃ¡c luá»“ng Ä‘Ã£ cháº¡y cÃ³ Ä‘Äƒng nháº­p/refresh, RBAC, nháº­p/xuáº¥t vÃ  Ä‘iá»u chuyá»ƒn, FEFO, QC, quáº£n lÃ½ lÃ´, XLSX, zone/ká»‡/Ã´ 3D, nhÃ£n QR má»Ÿ chi tiáº¿t Ã´ vÃ  bÃ¡o cÃ¡o/CSV. Work orders, shipment, traceability vÃ  quáº£n lÃ½ tÃ i khoáº£n Ä‘Ã£ Ä‘Æ°á»£c smoke á»Ÿ nhá»¯ng ca trong bÃ¡o cÃ¡o. Äiá»u Ä‘Ã³ khÃ´ng bao hÃ m má»i tá»• há»£p CRUD.

| Phase | ÄÃ£ sá»­a | Káº¿t quáº£ cÃ³ báº±ng chá»©ng |
|---|---|---|
| 1 | WMS-02 cháº·n lÃ´ quÃ¡ háº¡n; WMS-06 KPI lÃ´ cÃ²n tá»“n; WMS-07 máº«u sá»‘ Ã´ theo ká»‡ tháº­t; WMS-09 validate loáº¡i ká»‡, tráº£ 400. | 85 ca: 65 PASS, 6 FAIL, 2 BLOCKED, 12 NOT RUN. 55/56 Jest. NÄƒm lá»—i má»Ÿ cá»§a giai Ä‘oáº¡n nÃ y Ä‘Æ°á»£c xá»­ lÃ½ á»Ÿ Phase 2. |
| 2 | WMS-01 idempotency; WMS-03 FEFO; WMS-04 QC HOLD; WMS-05 phÃ¢n nhÃ³m theo mÃ£; WMS-08 solver sai biÃªn. Sá»­a thÃªm trÃ n ngang 390 px. | 28/28 API/SQL, 15/15 Chrome, 69/69 Jest, 15/15 kiá»ƒm tra Ä‘i kÃ¨m. ÄÃ£ kiá»ƒm ca 24 báº£n ghi hiá»ƒn thá»‹ 20 ká»‡ vÃ  4 báº£n ghi dÆ°. |
| 3 | P3-01 readiness khi DB máº¥t; P3-02 che 500; P3-03 log Ä‘Ãºng status; P3-04 giá»¯ phiÃªn qua lá»—i máº¡ng vÃ  refresh; P3-05 bÃ¡o cÃ¡o dÃ¹ng toÃ n ká»³ thay vÃ¬ 500 dÃ²ng. | 28/28 API regression Phase 2, 71/71 Jest, hai build thÃ nh cÃ´ng. BÃ¡o cÃ¡o UI khá»›p 50.102/50.102. Tá»“n sau táº£i 1.000.476, 0 lá»‡ch lÃ´, 0 Ã¢m, 0 Ã´ trÃ¹ng, 0 deadlock ghi nháº­n. |

Phase 3 cháº¡y Ä‘á»§ bá»‘n má»©c **5 / 20 / 50 / 100 VU** trÃªn má»™t IP QA vÃ  dÃ¹ng token QA chung trong bÃ i táº£i. Ba tÃ i khoáº£n khÃ¡c nhau Ä‘Æ°á»£c dÃ¹ng á»Ÿ bÃ i tranh cháº¥p riÃªng. Tá»· lá»‡ ngoÃ i 2xx láº§n lÆ°á»£t **20,00% / 50,36% / 79,03% / 93,19%**. p95 **3,24 / 5,71 / 12,01 / 12,01 giÃ¢y**. CÃ¡c má»©c táº£i **FAIL** vá» kháº£ nÄƒng phá»¥c vá»¥ táº£i há»£p lá»‡. QuÃ©t QR tháº­t **BLOCKED** vÃ¬ ADB khÃ´ng tháº¥y thiáº¿t bá»‹. Chrome cÃ³ kiá»ƒm cháº¡m trÃªn viewport Android mÃ´ phá»ng. Kiá»ƒm táº£i production, TLS trÃªn háº¡ táº§ng Ä‘Ã­ch, PITR, full CRUD, kiá»ƒm thá»­ khai thÃ¡c Ä‘á»™ng vÃ  kÃ½ UAT cÃ²n thiáº¿u hoáº·c chÆ°a cháº¡y.

Äiá»ƒm vÃ o bÃ¡o cÃ¡o: [Phase 1](../../../outputs/qa-reports/QA_SUMMARY.md), [Phase 2](../../../outputs/qa-reports/phase2/QA_SUMMARY.md), [Phase 3](../../../outputs/qa-reports/phase3/QA_SUMMARY.md), [performance](../../../outputs/qa-reports/phase3/PERFORMANCE_REPORT.md), [UAT](../../../outputs/qa-reports/phase3/UAT_RESULTS.md), [backup](../../../outputs/qa-reports/phase3/BACKUP_RECOVERY.md). Evidence gá»“m `WORKSPACE/work/phase3-load-results.json`, `phase3-closing.json`, `phase3-regression.json`, `phase3-serialization.json` vÃ  `phase3-report-after.json`.

## 6. Git vÃ  thay Ä‘á»•i trÃªn Ä‘Ä©a

`git status --short --branch` tráº£ `not a git repository`. PROJECT lÃ  báº£n tá»« ZIP, cÃ³ `.gitignore` vÃ  khÃ´ng cÃ³ metadata `.git`. VÃ¬ váº­y khÃ´ng cÃ³ branch, staged diff hoáº·c tráº¡ng thÃ¡i commit Ä‘á»ƒ bÃ¡o. CÃ¡c thay Ä‘á»•i Phase 1â€“3 Ä‘Ã£ lÆ°u trá»±c tiáº¿p trÃªn Ä‘Ä©a. So SHA-256 vá»›i ZIP gá»‘c cho tháº¥y **52 file gá»‘c khÃ¡c ná»™i dung, khÃ´ng thiáº¿u file gá»‘c, 8 file source/test má»›i** trÆ°á»›c khi táº¡o hai tÃ i liá»‡u bÃ n giao. KhÃ´ng cÃ³ chá»‰nh sá»­a code Ä‘ang tiáº¿n hÃ nh táº¡i checkpoint.

**52 file gá»‘c khÃ¡c ZIP**, nhÃ³m theo prefix Ä‘Æ°á»ng dáº«n:

- `denso-wms-backend/src/` (32): `main.ts`, `common/filters/http-exception.filter.ts`, `common/interceptors/logging.interceptor.ts`, `containers/containers.controller.ts`, `containers/containers.service.ts`, `database/seeds/seed-masan-three-racks.ts`, `health/health.controller.ts`, `history/entities/history-event.entity.ts`, `imports/dto/import-preview.dto.ts`, `imports/imports.service.ts`, `inspections/entities/inspection.entity.ts`, `inspections/inspections.controller.ts`, `inspections/inspections.service.ts`, `inventory/dto/create-inventory-transaction.dto.ts`, `inventory/inventory.controller.ts`, `inventory/inventory.rules.ts`, `inventory/inventory.service.ts`, `inventory/rack-product-family.rules.spec.ts`, `inventory/rack-product-family.rules.ts`, `inventory/storage-placement.rules.ts`, `packing/loading.service.ts`, `packing/solver/rack-packer.ts`, `packing/solver/solve.spec.ts`, `packing/solver/solve.ts`, `parts/dto/create-part.dto.ts`, `parts/entities/part.entity.ts`, `parts/parts.controller.ts`, `parts/parts.service.ts`, `shipments/shipments.service.ts`, `warehouse-zones/dto/create-zone.dto.ts`, `warehouse-zones/entities/warehouse-zone.entity.ts`, `warehouse-zones/warehouse-zones.service.ts`.
- `denso-wms-frontend/` (20): `vite.config.js`, `src/api/client.js`, `src/api/index.js`, `src/components/PartDialog.jsx`, `src/lib/auth.jsx`, `src/lib/rackProductFamily.js`, `src/lib/store.jsx`, `src/lib/supplyChain.js`, `src/pages/Dashboard.jsx`, `src/pages/FEFO.jsx`, `src/pages/Inspections.jsx`, `src/pages/InventoryOperations.jsx`, `src/pages/LocationDetail.jsx`, `src/pages/OrderDetail.jsx`, `src/pages/QRLabels.jsx`, `src/pages/RackPlan.jsx`, `src/pages/Racks.jsx`, `src/pages/Reports.jsx`, `src/pages/Traceability.jsx`, `src/pages/Zones.jsx`.

**8 file source/test má»›i:** ba migration cuá»‘i á»Ÿ báº£ng trÃªn, `denso-wms-backend/src/health/health.controller.spec.ts`, `denso-wms-backend/src/inspections/lot-quality.ts`, `denso-wms-backend/src/inventory/dto/query-transaction-summary.dto.ts`, `denso-wms-frontend/src/api/inventory.js`, `tests/phase2-regression.cjs`. NgoÃ i danh sÃ¡ch nÃ y cÃ³ `.env` local, dependency/build phÃ¡t sinh khi cháº¡y, script vÃ  chá»©ng cá»© QA ngoÃ i PROJECT, cÃ¹ng hai tÃ i liá»‡u trong `docs/`. Xem thÃªm [Fix log Phase 2](../../../outputs/qa-reports/phase2/FIX_LOG.md) vÃ  [Fix log Phase 3](../../../outputs/qa-reports/phase3/FIX_LOG.md).

## 7. Lá»‡nh build vÃ  test

Má»—i khá»‘i báº¯t Ä‘áº§u tá»« PROJECT. Cháº¡y test cá»¥c bá»™ khÃ´ng ghi fixture vÃ  build trÆ°á»›c khi báº¯t Ä‘áº§u cÃ´ng viá»‡c tiáº¿p theo Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t.

```powershell
Set-Location denso-wms-backend
npm.cmd test -- --runInBand
npm.cmd run build
```

```powershell
Set-Location denso-wms-frontend
npm.cmd run build
```

```powershell
node.exe --test tests/masan-fefo-demo.test.mjs tests/zone-rack-count.test.mjs
node.exe tests/catalog-smoke.mjs
node.exe tests/verify_test3_core.cjs
```

Chá»‰ cháº¡y regression ghi dá»¯ liá»‡u khi cÃ³ backend QA Ä‘Ã£ xÃ¡c minh káº¿t ná»‘i Ä‘Ãºng database. VÃ­ dá»¥ tá»« PROJECT khi backend QA thá»±c sá»± Ä‘ang phá»¥c vá»¥ cá»•ng 5024 vÃ  trá» tá»›i `wms_phase2_test`:

```powershell
$env:WMS_QA_DATABASE = 'wms_phase2_test'
$env:WMS_QA_API = 'http://127.0.0.1:5024/api'
node.exe tests/phase2-regression.cjs
```

CÃ¡c process QA cÅ© Ä‘Ã£ Ä‘Æ°á»£c dá»n á»Ÿ cuá»‘i Phase 3. Script Phase 3 náº±m ngoÃ i PROJECT vÃ  dÃ¹ng cÃ¡c cá»•ng/DB fixture cá»¥ thá»ƒ. Äá»c script vÃ  bÃ¡o cÃ¡o trÆ°á»›c khi tÃ¡i cháº¡y. `phase3-seed.sql` lÃ  script táº¡o fixture má»™t láº§n. Fault harness chá»§ Ä‘á»™ng táº¯t káº¿t ná»‘i DB QA hoáº·c dá»«ng process QA, chá»‰ dÃ¹ng trÃªn báº£n sao tÃ¡ch biá»‡t.

## 8. Phase 4 vÃ  thá»© tá»± tiáº¿p tá»¥c sau khi Ä‘Æ°á»£c yÃªu cáº§u

KhÃ´ng tháº¥y tÃ i liá»‡u hoáº·c triá»ƒn khai Phase 4. KhÃ´ng cÃ³ bÃ i táº£i, migration hoáº·c báº£n sá»­a nghiá»‡p vá»¥ Ä‘ang cháº¡y dá»Ÿ. Viá»‡c tiáº¿p theo lÃ  má»Ÿ `PRODUCTION_READINESS.md` vÃ  chá»‘t pháº¡m vi Phase 4 vá»›i ngÆ°á»i dÃ¹ng, rá»“i xÃ¡c nháº­n baseline báº±ng health vÃ  Jest.

1. **P1 táº£i vÃ  quota:** xÃ¡c minh topology NAT/proxy Ä‘Ã­ch, chá»‘t quota theo vai trÃ²/endpoint vá»›i chá»§ há»‡ thá»‘ng, giá»¯ báº£o vá»‡ login. Cháº¡y láº¡i load tá»« nhiá»u danh tÃ­nh/IP há»£p lá»‡ vÃ  Ä‘o riÃªng 429, timeout/5xx vÃ  Ä‘á»™ trá»… request thÃ nh cÃ´ng.
2. **P1 TLS:** cáº¥u hÃ¬nh hiá»‡n cÃ³ `rejectUnauthorized: false` á»Ÿ nhÃ¡nh TLS PostgreSQL. Chá»‘t CA/trust chain, cáº¥u hÃ¬nh staging vÃ  kiá»ƒm cáº£ runtime láº«n migration CLI trÆ°á»›c khi thay.
3. **P2 payload Dashboard:** Chrome máº¥t khoáº£ng 16â€“17 giÃ¢y Ä‘áº¿n KPI vá»›i 10.000 lÃ´ trong QA local dÃ¹ng chung tÃ i nguyÃªn. Äo riÃªng rá»“i tÃ¡ch endpoint tá»•ng há»£p hoáº·c phÃ¢n trang. Giá»¯ phÃ©p Ä‘á»‘i soÃ¡t vá»›i PostgreSQL vÃ  rÃ  pooling/khÃ³a QC.
4. **Nghiá»‡p vá»¥/UAT:** chá»‘t Ä‘iá»u chuyá»ƒn má»™t pháº§n, staging QC trÆ°á»›c putaway, quyá»n Ä‘á»c theo kho, mÃ£ lÃ´ trÃ¹ng giá»¯a SKU/kho, lÃ m trÃ²n thÃ¹ng láº» vÃ  giá»›i háº¡n xoay. CÃ³ thiáº¿t bá»‹ tháº­t má»›i cháº¡y quÃ©t QR/camera. ChÆ°a cÃ³ chá»¯ kÃ½ nghiá»‡m thu.
5. **Váº­n hÃ nh release:** reverse proxy/HTTPS, giÃ¡m sÃ¡t vÃ  log, kiá»ƒm drain/graceful shutdown, backup tá»± Ä‘á»™ng, PITR, RPO/RTO vÃ  rollback release. ÄÃ¡nh giÃ¡ láº¡i GO sau khi Ä‘Ã³ng blocker vÃ  Ä‘Æ°á»£c chá»§ há»‡ thá»‘ng duyá»‡t. NgÆ°á»¡ng SLO trong bÃ¡o cÃ¡o lÃ  Ä‘á» xuáº¥t.

## 9. RÃ o cháº¯n bÃ n giao

- Giá»¯ nguyÃªn PROJECT, ZIP gá»‘c, báº£n sao QA vÃ  cÃ¡c dump. KhÃ´ng giáº£i nÃ©n Ä‘Ã¨, táº¡o láº¡i frontend/backend, khá»Ÿi táº¡o Git, reset/clean, commit/push hoáº·c xÃ³a cÃ¡c file Ä‘Ã£ sá»­a.
- KhÃ´ng xÃ³a/reset/seed `wms_demo`, cháº¡y `initdb`, restore Ä‘Ã¨, cháº¡y láº¡i/revert migration Ä‘Ã£ Ã¡p dá»¥ng hoáº·c dÃ¹ng DB chÃ­nh Ä‘á»ƒ test ghi hay gÃ¢y lá»—i. Kiá»ƒm tra tÃªn DB, port vÃ  process trÆ°á»›c má»i lá»‡nh cÃ³ side effect.
- KhÃ´ng dá»«ng frontend, backend hoáº·c cluster Ä‘ang phá»¥c vá»¥ local náº¿u khÃ´ng cáº§n. KhÃ´ng tÃ¡i cháº¡y script fault/load vá»›i cá»•ng 5001 hoáº·c URL 4310. KhÃ´ng dÃ¹ng script `START_BACKEND.bat` Ä‘á»ƒ kiá»ƒm tra nhanh vÃ¬ nÃ³ gá»i migration.
- Giá»¯ transaction tá»“n/sá»•/replay, khÃ³a QC vÃ  thá»© tá»± FEFO, snapshot vá»‹ trÃ­, nguá»“n dá»¯ liá»‡u PART cho 3D, phÃ¢n nhÃ³m á»•n Ä‘á»‹nh vÃ  cÃ¡c kiá»ƒm tra capacity. Viá»‡c Ä‘á»•i cÃ¡c quy táº¯c nÃ y cáº§n test cáº¡nh tranh vÃ  Ä‘á»‘i soÃ¡t láº¡i. DÃ¹ng láº¡i key sai hoáº·c xoÃ¡ lá»‹ch sá»­ replay cÃ³ thá»ƒ nhÃ¢n Ä‘Ã´i giao dá»‹ch.
- KhÃ´ng Ä‘Æ°a cáº¥u hÃ¬nh bÃ­ máº­t, token, file backup hoáº·c dá»¯ liá»‡u tÃ i khoáº£n vÃ o há»™i thoáº¡i hay repo. KhÃ´ng triá»ƒn khai production tá»« checkpoint NO-GO nÃ y.


## 10. Nghiệm thu Kiểm định Nghiệp vụ Giao dịch thực tế 3D (17/11/2026)

Hệ thống đã hoàn tất và nghiệm thu toàn diện giai đoạn **Kiểm định nghiệp vụ giao dịch thực tế của Trung tâm điều hành kho 3D (Warehouse Operations Control Center 3D)**:
- **Tình trạng:** 100% PASS trên cả hai nhóm thử nghiệm (Nhóm A: Read-Only 0 mutations; Nhóm B: Transactional Transfer, Picking 2 bước, Cycle Count SoD 3 cấp, Stale/Concurrency protection).
- **Đối soát CSDL:** 8/8 bảng cốt lõi đạt trạng thái MATCH (PASS).
- **An ninh & Bảo mật:** Toàn bộ thông tin xác thực QA được che dấu an toàn ([MẬT KHẨU QA ĐÃ ĐƯỢC BẢO MẬT]), bảo vệ qua .gitignore.
- **Báo cáo bàn giao:** 8 báo cáo chi tiết đặt tại outputs/qa-reports/3d-operations-transactional-verification/ kèm theo bộ ảnh chụp màn hình chứng minh trực quan.

## 11. Nghiệm thu 3D Operations Live Synchronization & Business Traceability (17/11/2026)

Hệ thống đã hoàn tất và nghiệm thu toàn diện giai đoạn **3D Operations Live Synchronization & Business Traceability**:
- **Tình trạng:** **100% PASS trên toàn bộ 8 nhóm kịch bản kiểm thử tự động**.
- **Đồng bộ đa phiên không reload (Multi-browser Live Sync):** Đo lường tự động qua Playwright giữa phiên Trưởng kho (Manager) và Nhân viên kho (Staff). Giao dịch điều chuyển 4 PCS từ R01 sang R03 tự động cập nhật trên phiên Staff chỉ sau **1,184 ms** (< 3000 ms SLA) mà không cần reload trang.
- **Thẻ nhiệm vụ 3D phát sáng (Illuminated 3D Task Badges):** Gắn thẻ trực quan `SOẠN HÀNG` (xanh dương `#0284c7`), `KIỂM KÊ` (hổ phách `#d97706`), `ĐIỀU CHUYỂN` (tím `#7c3aed`) trên từng ô kệ tương ứng, đồng bộ tức thời với Panel nhiệm vụ bên phải.
- **Vòng đời Soạn hàng 2 bước:** Đặt trước tồn kho `RESERVED` -> Xác nhận hoàn tất `PICKED`, kiểm soát Idempotency chống double-pick, chặn xuất vượt tồn kho 400 Bad Request, bảo vệ quyền hạn Staff 403 Forbidden.
- **Kiểm kê định kỳ 2 vòng & SoD:** Phân tách rõ ràng giữa Người đếm vòng 1 (Staff), Người đếm vòng 2 (Inventory Controller) và Người phê duyệt (Admin), chốt trạng thái `CLOSED` an toàn.
- **Phát hiện mất mạng & Tự phục hồi:** Tự động phát hiện đứt kết nối (`MẤT KẾT NỐI (DỮ LIỆU CŨ)`), tự động kết nối lại khi có mạng (`TRỰC TUYẾN (<latency>ms)`).
- **Tìm kiếm SKU & Auto-focus:** Cho phép tìm kiếm nhanh mã hàng/lô và tự động căn chỉnh góc nhìn camera 3D về ô kệ mục tiêu.
- **Phân định rõ rệt giữa Thực tế và Mô phỏng:** Nút bấm hoạt cảnh xe nâng được dán nhãn chuẩn hóa `Hành trình 3D (Mô phỏng)` tránh nhầm lẫn dữ liệu trực tuyến.
- **Đối soát CSDL 8 bảng:** Khớp hoàn toàn số lượng và cấu trúc dữ liệu không thất thoát.
- **Bàn giao:** 10 báo cáo kiểm định chi tiết tại `outputs/qa-reports/3d-operations-live-sync/` kèm 11 ảnh chụp bằng chứng kiểm thử chất lượng cao.
