// WarehouseScene3D.jsx
// Sơ đồ kho 3D & Trung tâm Điều hành - Unified Industrial 3D Visualizer for Warehouse Zones, Racks & Slots
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { RotateCcw, Eye, ArrowRight, Layers, Activity, Box, Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SharedRackGeometry from '@/components/viz/SharedRackGeometry';
import InventoryVisualization from '@/components/viz/InventoryVisualization';
import {
  SHARED_WAREHOUSE_COORDINATES,
  SHARED_RACK_SPEC,
  buildUnifiedWarehouseModel
} from '@/lib/viz/warehouseLayoutAdapter';

const CAMERA_DEFAULT = [0, 8.5, 9.5];
const TARGET_DEFAULT = [0, 1.0, -2.5];

function WarehouseCamera({ selectedRackPos, selectedSlotPos, cameraPreset = 'overview', resetKey }) {
  const { camera } = useThree();
  const controlsRef = useRef();

  useLayoutEffect(() => {
    if (!controlsRef.current) return;

    if (cameraPreset === 'front') {
      // 2D elevation / Front elevation view
      controlsRef.current.target.set(0, 1.1, -3.0);
      camera.position.set(0, 1.2, 5.0);
      controlsRef.current.update();
    } else if (cameraPreset === 'dock') {
      // Dock / Receiving area
      controlsRef.current.target.set(0, 0.2, 1.8);
      camera.position.set(0, 4.0, 7.0);
      controlsRef.current.update();
    } else if (selectedSlotPos) {
      // Tight zoom on selected slot
      controlsRef.current.target.set(selectedSlotPos[0], selectedSlotPos[1], selectedSlotPos[2]);
      camera.position.set(selectedSlotPos[0], selectedSlotPos[1] + 1.2, selectedSlotPos[2] + 2.8);
      controlsRef.current.update();
    } else if (selectedRackPos) {
      // Smoothly look at the selected rack
      controlsRef.current.target.set(selectedRackPos[0], 1.1, selectedRackPos[2]);
      camera.position.set(selectedRackPos[0], 4.2, selectedRackPos[2] + 5.2);
      controlsRef.current.update();
    } else {
      // Default overview
      controlsRef.current.target.set(...TARGET_DEFAULT);
      camera.position.set(...CAMERA_DEFAULT);
      controlsRef.current.update();
    }
  }, [selectedRackPos, selectedSlotPos, cameraPreset, resetKey, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      minDistance={2}
      maxDistance={40}
      maxPolarAngle={Math.PI / 2.02}
    />
  );
}

export default function WarehouseScene3D({
  racks = [],
  parts = [],
  selectedRackId,
  selectedSlotIndex = null,
  onSelectRack,
  onSelectSlot,
  quality = 'normal',
  zoneCode = 'ZONE-A',
  totalRacks,
  viewMode = 'qc', // 'qc' | 'heatmap' | 'space'
  onChangeViewMode,
  tasksBySlot = null
}) {
  const navigate = useNavigate();
  const [reset, setReset] = useState(0);
  const [showWalls, setShowWalls] = useState(true);
  const [cameraPreset, setCameraPreset] = useState('overview');

  // Build unified warehouse model
  const qualityMap = quality instanceof Map ? quality : new Map();
  const model = useMemo(
    () => buildUnifiedWarehouseModel(racks, parts, qualityMap, zoneCode),
    [racks, parts, qualityMap, zoneCode]
  );

  const selectedRackModel = model.racks.find(r => r.rackId === selectedRackId);
  const selectedRackPos = selectedRackModel ? selectedRackModel.position : null;

  // Selected slot 3D position if available
  const selectedSlotPos = useMemo(() => {
    if (!selectedRackModel || selectedSlotIndex === null || selectedSlotIndex === undefined) return null;
    const slotModel = selectedRackModel.slots.find(s => s.index === selectedSlotIndex);
    return slotModel ? slotModel.restPosition : null;
  }, [selectedRackModel, selectedSlotIndex]);

  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-[#243449] bg-[#0b1320]">
      {/* Top Header Controls Bar */}
      <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left Badges & Mode Switch */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <span className="rounded-md border border-[#243449] bg-[#131f33]/90 px-3 py-1.5 text-xs font-semibold text-[#f8fafc] shadow-sm backdrop-blur">
            {zoneCode} · {model.totalRacks} Kệ · {model.totalUsedSlots}/{model.totalSlots} Ô đang dùng
          </span>

          {/* View Mode Switcher Pills */}
          <div className="inline-flex rounded-lg border border-[#243449] bg-[#131f33]/90 p-0.5 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => onChangeViewMode?.('qc')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'qc' ? 'bg-primary text-primary-foreground shadow' : 'text-[#94a3b8] hover:text-white'
              }`}
              title="Chế độ hiển thị: Trạng thái kiểm định chất lượng (QC)"
            >
              <Activity className="size-3" /> QC
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode?.('heatmap')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'heatmap' ? 'bg-purple-600 text-white shadow' : 'text-[#94a3b8] hover:text-white'
              }`}
              title="Chế độ hiển thị: Bản đồ nhiệt mật độ tồn kho (Heatmap)"
            >
              <Layers className="size-3" /> Mật độ tồn
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode?.('space')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'space' ? 'bg-amber-600 text-white shadow' : 'text-[#94a3b8] hover:text-white'
              }`}
              title="Chế độ hiển thị: Tỷ lệ sử dụng dung lượng & tải trọng"
            >
              <Box className="size-3" /> Dung lượng
            </button>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Camera Quick Angles */}
          <div className="hidden sm:inline-flex rounded-lg border border-[#243449] bg-[#131f33]/90 p-0.5 text-xs text-[#94a3b8] shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => { setCameraPreset('overview'); setReset(v => v + 1); }}
              className={`rounded px-2 py-1 transition ${cameraPreset === 'overview' ? 'bg-[#1e2f47] text-white' : 'hover:text-white'}`}
            >
              Toàn cảnh
            </button>
            <button
              type="button"
              onClick={() => { setCameraPreset('front'); setReset(v => v + 1); }}
              className={`rounded px-2 py-1 transition ${cameraPreset === 'front' ? 'bg-[#1e2f47] text-white' : 'hover:text-white'}`}
            >
              Mặt đứng 2D
            </button>
            <button
              type="button"
              onClick={() => { setCameraPreset('dock'); setReset(v => v + 1); }}
              className={`rounded px-2 py-1 transition ${cameraPreset === 'dock' ? 'bg-[#1e2f47] text-white' : 'hover:text-white'}`}
            >
              Khu tiếp nhận
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowWalls(v => !v)}
            className="rounded-md border border-[#243449] bg-[#131f33]/90 px-2.5 py-1.5 text-xs text-[#94a3b8] hover:text-white shadow-sm backdrop-blur"
          >
            {showWalls ? 'Ẩn tường' : 'Hiện tường'}
          </button>

          {selectedRackId && (
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/20 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 shadow-sm backdrop-blur"
              onClick={() => navigate(`/supply-chain-3d?rack=${encodeURIComponent(selectedRackModel?.name || '')}`)}
              title="Chuyển sang xem Hoạt cảnh 3D mô phỏng của kệ này"
            >
              Hành trình 3D (Mô phỏng) <ArrowRight size={13} />
            </button>
          )}

          <button
            type="button"
            className="flex min-h-8 items-center gap-1.5 rounded-md border border-[#243449] bg-[#131f33]/90 px-2.5 py-1.5 text-xs text-[#f3f6fc] hover:bg-[#1e2d42] shadow-sm backdrop-blur"
            onClick={() => { setCameraPreset('overview'); setReset(v => v + 1); }}
            title="Đặt lại camera về góc nhìn toàn cảnh"
          >
            <RotateCcw size={13} /> Đặt lại góc
          </button>
        </div>
      </div>

      {/* 3D Viewport */}
      <div className="h-[56dvh] min-h-[420px] md:h-[clamp(480px,65dvh,750px)]" aria-label="Mô hình 3D của Zone">
        <Canvas
          key={`${zoneCode}-${reset}-${cameraPreset}`}
          dpr={[1, 1.5]}
          camera={{ position: CAMERA_DEFAULT, fov: 42 }}
          fallback={<p className="p-12 text-sm text-white">WebGL không khả dụng. Chọn kệ trong danh sách bên dưới.</p>}
        >
          <color attach="background" args={['#0a101d']} />
          <ambientLight intensity={1.3} />
          <directionalLight position={[8, 12, 10]} intensity={2.0} />
          <directionalLight position={[-8, 6, -5]} intensity={0.9} />

          {/* Warehouse Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -1.0]}>
            <planeGeometry args={[18, 12]} />
            <meshStandardMaterial color="#111c2e" roughness={0.9} />
          </mesh>
          <gridHelper position={[0, -0.015, -1.0]} args={[18, 18, '#243449', '#162235']} />

          {/* Yellow Safety Aisle Guide Line */}
          <mesh position={[0, -0.005, SHARED_WAREHOUSE_COORDINATES.mainAisleZ]}>
            <boxGeometry args={[11.0, 0.005, 0.08]} />
            <meshBasicMaterial color="#eab308" />
          </mesh>

          {/* Warehouse Enclosure Walls (optional toggle) */}
          {showWalls && (
            <group>
              {/* Back wall */}
              <mesh position={[0, 2.0, SHARED_WAREHOUSE_COORDINATES.backWallZ]}>
                <boxGeometry args={[18, 4.0, 0.15]} />
                <meshStandardMaterial color="#162235" />
              </mesh>
              {/* Left wall */}
              <mesh position={[SHARED_WAREHOUSE_COORDINATES.leftWallX, 2.0, -1.0]}>
                <boxGeometry args={[0.15, 4.0, 12]} />
                <meshStandardMaterial color="#162235" />
              </mesh>
              {/* Right wall */}
              <mesh position={[SHARED_WAREHOUSE_COORDINATES.rightWallX, 2.0, -1.0]}>
                <boxGeometry args={[0.15, 4.0, 12]} />
                <meshStandardMaterial color="#162235" />
              </mesh>
            </group>
          )}

          {/* Staging & Dock Zones with 100% Vietnamese 3D Text */}
          {[-3.5, 0.0, 3.5].map((x, i) => (
            <group key={`dock:${x}`} position={[x, -0.008, 1.8]}>
              <mesh>
                <boxGeometry args={[2.8, 0.01, 1.4]} />
                <meshStandardMaterial color={['#172e3d', '#1e3847', '#172e3d'][i]} />
              </mesh>
              <Text position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.14} color="#94a3b8">
                {['KHU VỰC TIẾP NHẬN HÀNG', 'TRẠM KIỂM ĐỊNH CHẤT LƯỢNG (QC)', 'KHU VỰC SOẠN & ĐÓNG GÓI'][i]}
              </Text>
            </group>
          ))}

          {/* Render All Racks and Their Inventory */}
          {model.racks.map(rackModel => (
            <group key={rackModel.rackId}>
              <SharedRackGeometry
                rack={rackModel}
                position={rackModel.position}
                selected={rackModel.rackId === selectedRackId}
                muted={!!selectedRackId && rackModel.rackId !== selectedRackId}
                onSelect={onSelectRack}
                highlightSlotIndex={rackModel.rackId === selectedRackId ? selectedSlotIndex : null}
              />
              <InventoryVisualization
                rack={rackModel}
                rackPosition={rackModel.position}
                onSelectSlot={onSelectSlot || onSelectRack}
                selectedSlotIndex={rackModel.rackId === selectedRackId ? selectedSlotIndex : null}
                viewMode={viewMode}
                tasksBySlot={tasksBySlot}
              />
            </group>
          ))}

          {/* Camera Controller */}
          <WarehouseCamera
            selectedRackPos={selectedRackPos}
            selectedSlotPos={selectedSlotPos}
            cameraPreset={cameraPreset}
            resetKey={reset}
          />
        </Canvas>
      </div>

      {/* Bottom Footer Legend (Context-aware based on viewMode) */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-[#243449] bg-[#0f172a] px-3 py-2 text-[11px] text-[#94a3b8]">
        {viewMode === 'heatmap' ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-[#06b6d4]" />Mật độ thấp (&lt; 200 đv)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-[#10b981]" />Mật độ vừa (200 - 500 đv)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-[#a855f7]" />Mật độ cao (&gt; 500 đv)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2.5 rounded-sm border border-[#475569] bg-transparent" />Ô trống khả dụng</span>
          </div>
        ) : viewMode === 'space' ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-[#3b82f6]" />Tải nhẹ (&lt; 40%)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-[#f59e0b]" />Tải trung bình (40 - 75%)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-[#ef4444]" />Tải nặng (&gt; 75%)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2.5 rounded-sm border border-[#475569] bg-transparent" />Ô chưa sử dụng</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-[#22c55e]" />Đạt chuẩn QC (Sẵn sàng xuất)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-[#f59e0b]" />Chờ kiểm định (Tạm giữ / HOLD)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-[#ef4444]" />Lỗi kiểm định (Bị chặn / BLOCKED)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-[#c8a575]" />Pallet gỗ công nghiệp</span>
          </div>
        )}
        <span className="text-[#64748b]">Nhấp trực tiếp vào kệ hoặc ô chứa để mở bảng điều hành tác vụ</span>
      </div>
    </div>
  );
}
