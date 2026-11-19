// WarehouseScene3D.jsx
// MASAN CONSUMER WMS · Precision Industrial Warehouse Command Center 3D Digital Twin
import { useLayoutEffect, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  RotateCcw,
  Eye,
  ArrowRight,
  Layers,
  Activity,
  Box,
  Compass,
  Crosshair,
  Maximize2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SharedRackGeometry from '@/components/viz/SharedRackGeometry';
import InventoryVisualization from '@/components/viz/InventoryVisualization';
import {
  SHARED_WAREHOUSE_COORDINATES,
  SHARED_RACK_SPEC,
  buildUnifiedWarehouseModel
} from '@/lib/viz/warehouseLayoutAdapter';

// Standardized Camera Poses (Isometric / Three-quarter overview of entire warehouse)
const OVERVIEW_TARGET = new THREE.Vector3(0, 1.1, -0.8);
const OVERVIEW_POSITION = new THREE.Vector3(0, 9.6, 11.0);

const FRONT_TARGET = new THREE.Vector3(0, 1.2, -3.0);
const FRONT_POSITION = new THREE.Vector3(0, 1.2, 5.8);

const DOCK_TARGET = new THREE.Vector3(0, 0.4, 1.6);
const DOCK_POSITION = new THREE.Vector3(0, 4.8, 7.4);

/**
 * Camera State Machine & Motion Controller
 * State: 'OVERVIEW' | 'USER_CONTROLLED' | 'FOCUS_RACK' | 'FOCUS_SLOT' | 'RESETTING'
 * Guaranteed zero auto-resets on data polling, slot inspection, or inventory updates.
 */
function WarehouseCameraController({
  cameraCommand,
  onCommandFinished,
  controlsRef
}) {
  const { camera } = useThree();
  const isInitialized = useRef(false);

  // Animation controller ref
  const animRef = useRef({
    active: false,
    startTime: 0,
    duration: 0.52,
    startCam: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endCam: new THREE.Vector3(),
    endTarget: new THREE.Vector3()
  });

  // 1. Initial Overview Fit: Runs strictly ONCE on mount
  useLayoutEffect(() => {
    if (!controlsRef.current) return;
    if (!isInitialized.current) {
      isInitialized.current = true;
      camera.position.copy(OVERVIEW_POSITION);
      controlsRef.current.target.copy(OVERVIEW_TARGET);
      controlsRef.current.update();
    }
  }, [camera, controlsRef]);

  // 2. Explicit User Camera Commands (Triggered strictly by deliberate UI actions)
  useEffect(() => {
    if (!cameraCommand || !controlsRef.current) return;

    let targetCamPos = OVERVIEW_POSITION;
    let targetLookAt = OVERVIEW_TARGET;

    if (cameraCommand.type === 'FRONT') {
      targetCamPos = FRONT_POSITION;
      targetLookAt = FRONT_TARGET;
    } else if (cameraCommand.type === 'DOCK') {
      targetCamPos = DOCK_POSITION;
      targetLookAt = DOCK_TARGET;
    } else if (cameraCommand.type === 'FOCUS_RACK' && cameraCommand.targetPos) {
      const [rx, ry, rz] = cameraCommand.targetPos;
      targetLookAt = new THREE.Vector3(rx, 1.2, rz);
      targetCamPos = new THREE.Vector3(rx, 4.2, rz + 4.8);
    } else if (cameraCommand.type === 'FOCUS_SLOT' && cameraCommand.targetPos) {
      const [sx, sy, sz] = cameraCommand.targetPos;
      targetLookAt = new THREE.Vector3(sx, sy, sz);
      targetCamPos = new THREE.Vector3(sx, sy + 0.8, sz + 2.2);
    } else if (cameraCommand.type === 'OVERVIEW' || cameraCommand.type === 'RESET') {
      targetCamPos = OVERVIEW_POSITION;
      targetLookAt = OVERVIEW_TARGET;
    }

    // Initialize smooth cubic ease-out motion
    animRef.current = {
      active: true,
      startTime: performance.now(),
      duration: 0.52,
      startCam: camera.position.clone(),
      startTarget: controlsRef.current.target.clone(),
      endCam: targetCamPos.clone(),
      endTarget: targetLookAt.clone()
    };
  }, [cameraCommand, camera, controlsRef]);

  // 3. Frame loop: Executes interpolation ONLY when an animation is explicitly running!
  useFrame(() => {
    if (!animRef.current.active || !controlsRef.current) return;

    const now = performance.now();
    const elapsed = (now - animRef.current.startTime) / 1000;
    const progress = Math.min(1.0, elapsed / animRef.current.duration);

    // Cubic ease-out: 1 - (1 - progress)^3
    const t = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(animRef.current.startCam, animRef.current.endCam, t);
    controlsRef.current.target.lerpVectors(animRef.current.startTarget, animRef.current.endTarget, t);
    controlsRef.current.update();

    if (progress >= 1.0) {
      animRef.current.active = false;
      onCommandFinished?.();
    }
  });

  return null;
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
  tasksBySlot = null,
  isTransferMode = false,
  sourceTransferSlot = null,
  onSelectTransferTarget = null,
  onCancelTransferMode = null
}) {
  const navigate = useNavigate();
  const controlsRef = useRef(null);

  // Display toggles
  const [showWalls, setShowWalls] = useState(true);
  const [cameraPreset, setCameraPreset] = useState('overview');

  // Camera Command State Machine
  const [cameraCommand, setCameraCommand] = useState(null);

  // Build unified warehouse model
  const qualityMap = quality instanceof Map ? quality : new Map();
  const model = useMemo(
    () => buildUnifiedWarehouseModel(racks, parts, qualityMap, zoneCode),
    [racks, parts, qualityMap, zoneCode]
  );

  const selectedRackModel = useMemo(
    () => model.racks.find(r => r.rackId === selectedRackId),
    [model.racks, selectedRackId]
  );

  // Slot coordinates
  const selectedSlotCoords = useMemo(() => {
    if (!selectedRackModel || selectedSlotIndex === null || selectedSlotIndex === undefined) return null;
    const slotModel = selectedRackModel.slots.find(s => s.index === selectedSlotIndex);
    return slotModel ? slotModel.restPosition : null;
  }, [selectedRackModel, selectedSlotIndex]);

  // Action: Trigger Camera Command
  const triggerCameraCommand = useCallback((type, targetPos = null) => {
    setCameraCommand({
      id: Date.now(),
      type,
      targetPos
    });
  }, []);

  const handleResetCamera = useCallback(() => {
    setCameraPreset('overview');
    triggerCameraCommand('RESET');
  }, [triggerCameraCommand]);

  const handleFocusRack = useCallback(() => {
    if (selectedRackModel) {
      triggerCameraCommand('FOCUS_RACK', selectedRackModel.position);
    }
  }, [selectedRackModel, triggerCameraCommand]);

  const handleFocusSlot = useCallback(() => {
    if (selectedSlotCoords) {
      triggerCameraCommand('FOCUS_SLOT', selectedSlotCoords);
    }
  }, [selectedSlotCoords, triggerCameraCommand]);

  return (
    <div className="flex flex-col h-full min-w-0 rounded-xl border border-[#243449] bg-[#0b1320] overflow-hidden shadow-xl">
      {/* 1. DEDICATED TOP COMMAND TOOLBAR (Sits neatly above 3D canvas, zero overlap with racks) */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2b40] bg-[#0e1829] px-3.5 py-2 z-10">
        {/* Left: Zone & Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-[#243449] bg-[#131f33] px-2.5 py-1 text-xs font-semibold text-[#f8fafc]">
            {zoneCode} · {model.totalRacks} Kệ · {model.totalUsedSlots}/{model.totalSlots} Ô đang dùng
          </span>

          {/* View Mode Segmented Controls */}
          <div className="inline-flex rounded-lg border border-[#243449] bg-[#111c2e] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onChangeViewMode?.('qc')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 font-medium transition ${
                viewMode === 'qc' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-[#94a3b8] hover:text-white'
              }`}
              title="Chế độ hiển thị: Trạng thái kiểm định chất lượng (QC)"
            >
              <Activity className="size-3" /> QC
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode?.('heatmap')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 font-medium transition ${
                viewMode === 'heatmap' ? 'bg-purple-600 text-white shadow-sm' : 'text-[#94a3b8] hover:text-white'
              }`}
              title="Chế độ hiển thị: Bản đồ nhiệt mật độ tồn kho (Heatmap)"
            >
              <Layers className="size-3" /> Mật độ tồn
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode?.('space')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 font-medium transition ${
                viewMode === 'space' ? 'bg-amber-600 text-white shadow-sm' : 'text-[#94a3b8] hover:text-white'
              }`}
              title="Chế độ hiển thị: Tỷ lệ sử dụng dung lượng & tải trọng"
            >
              <Box className="size-3" /> Dung lượng
            </button>
          </div>
        </div>

        {/* Center / Camera Presets & Focus Actions */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Camera Angles */}
          <div className="inline-flex rounded-lg border border-[#243449] bg-[#111c2e] p-0.5 text-[#94a3b8]">
            <button
              type="button"
              onClick={() => { setCameraPreset('overview'); triggerCameraCommand('OVERVIEW'); }}
              className={`rounded px-2 py-1 font-medium transition ${cameraPreset === 'overview' ? 'bg-[#1e2f47] text-white' : 'hover:text-white'}`}
            >
              Toàn cảnh
            </button>
            <button
              type="button"
              onClick={() => { setCameraPreset('front'); triggerCameraCommand('FRONT'); }}
              className={`rounded px-2 py-1 font-medium transition ${cameraPreset === 'front' ? 'bg-[#1e2f47] text-white' : 'hover:text-white'}`}
            >
              Mặt đứng 2D
            </button>
            <button
              type="button"
              onClick={() => { setCameraPreset('dock'); triggerCameraCommand('DOCK'); }}
              className={`rounded px-2 py-1 font-medium transition ${cameraPreset === 'dock' ? 'bg-[#1e2f47] text-white' : 'hover:text-white'}`}
            >
              Khu tiếp nhận
            </button>
          </div>

          {/* Explicit Focus Buttons (User-initiated only) */}
          {selectedRackModel && (
            <button
              type="button"
              onClick={handleFocusRack}
              className="flex items-center gap-1 rounded-md border border-teal-500/40 bg-teal-950/30 px-2 py-1 text-teal-300 hover:bg-teal-900/40 transition"
              title={`Focus góc nhìn vào Kệ ${selectedRackModel.name}`}
            >
              <Eye className="size-3" /> Kệ {selectedRackModel.name}
            </button>
          )}

          {selectedSlotCoords && (
            <button
              type="button"
              onClick={handleFocusSlot}
              className="flex items-center gap-1 rounded-md border border-sky-500/40 bg-sky-950/30 px-2 py-1 text-sky-300 hover:bg-sky-900/40 transition"
              title="Focus góc nhìn cận cảnh vào ô đang chọn"
            >
              <Crosshair className="size-3" /> Ô S{String((selectedSlotIndex ?? 0) + 1).padStart(2, '0')}
            </button>
          )}

          {/* Toggle Walls */}
          <button
            type="button"
            onClick={() => setShowWalls(v => !v)}
            className="rounded-md border border-[#243449] bg-[#111c2e] px-2 py-1 text-[#94a3b8] hover:text-white transition"
          >
            {showWalls ? 'Ẩn tường' : 'Hiện tường'}
          </button>

          {/* Reset Camera to Overview */}
          <button
            type="button"
            onClick={handleResetCamera}
            className="flex items-center gap-1 rounded-md border border-[#243449] bg-[#111c2e] px-2 py-1 text-[#f3f6fc] hover:bg-[#1e2d42] transition"
            title="Đặt lại camera về góc nhìn toàn cảnh ban đầu"
          >
            <RotateCcw className="size-3" /> Đặt lại góc
          </button>
        </div>
      </div>

      {/* 2. 3D CANVAS VIEWPORT (Unobstructed full height workspace) */}
      <div className="relative flex-1 min-h-[460px] md:min-h-[580px] bg-[#070d18]" aria-label="Mô hình không gian kho số hóa 3D">
        {/* Interactive 3D Transfer Banner Overlay */}
        {isTransferMode && (
          <div className="absolute inset-x-4 top-3 z-20 flex items-center justify-between rounded-lg border border-teal-500/60 bg-[#0c1e2e]/95 p-2 px-4 shadow-xl backdrop-blur animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-2 rounded-full bg-teal-400 animate-ping" />
              <span className="text-xs font-bold text-teal-300">
                CHẾ ĐỘ ĐIỀU CHUYỂN 3D:
              </span>
              <span className="text-xs text-[#f8fafc]">
                Nhấp trực tiếp vào ô trống phát sáng trên mô hình để chọn làm đích điều chuyển
              </span>
            </div>
            <button
              type="button"
              onClick={onCancelTransferMode}
              className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/30 transition border border-rose-500/30"
            >
              Hủy điều chuyển
            </button>
          </div>
        )}

        {/* WebGL Canvas */}
        <Canvas
          key={zoneCode}
          dpr={[1, 1.5]}
          camera={{ position: [0, 9.6, 11.0], fov: 38 }}
          fallback={<p className="p-12 text-sm text-white">WebGL không khả dụng trên trình duyệt này.</p>}
        >
          <color attach="background" args={['#080f1c']} />
          <ambientLight intensity={1.25} />
          <directionalLight position={[10, 14, 12]} intensity={1.8} />
          <directionalLight position={[-10, 8, -6]} intensity={0.7} />

          {/* Industrial Warehouse Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -0.6]}>
            <planeGeometry args={[18, 14]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
          <gridHelper position={[0, -0.015, -0.6]} args={[18, 18, '#1e293b', '#0f172a']} />

          {/* Yellow Safety Aisle Guide Line */}
          <mesh position={[0, -0.005, SHARED_WAREHOUSE_COORDINATES.mainAisleZ]}>
            <boxGeometry args={[12.0, 0.005, 0.08]} />
            <meshBasicMaterial color="#eab308" />
          </mesh>

          {/* Warehouse Enclosure Walls (Optional Toggle) */}
          {showWalls && (
            <group>
              {/* Back wall */}
              <mesh position={[0, 2.0, SHARED_WAREHOUSE_COORDINATES.backWallZ]}>
                <boxGeometry args={[18, 4.0, 0.15]} />
                <meshStandardMaterial color="#162235" roughness={0.9} />
              </mesh>
              {/* Left wall */}
              <mesh position={[SHARED_WAREHOUSE_COORDINATES.leftWallX, 2.0, -0.6]}>
                <boxGeometry args={[0.15, 4.0, 14]} />
                <meshStandardMaterial color="#162235" roughness={0.9} />
              </mesh>
              {/* Right wall */}
              <mesh position={[SHARED_WAREHOUSE_COORDINATES.rightWallX, 2.0, -0.6]}>
                <boxGeometry args={[0.15, 4.0, 14]} />
                <meshStandardMaterial color="#162235" roughness={0.9} />
              </mesh>
            </group>
          )}

          {/* Functional Staging Zones (Receiving, QC, Packing) */}
          {[-3.6, 0.0, 3.6].map((x, i) => (
            <group key={`dock:${x}`} position={[x, -0.008, 1.8]}>
              <mesh>
                <boxGeometry args={[3.0, 0.01, 1.4]} />
                <meshStandardMaterial color={['#132438', '#162e3d', '#132438'][i]} roughness={0.8} />
              </mesh>
              <Text position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.13} color="#94a3b8">
                {['KHU VỰC TIẾP NHẬN HÀNG', 'TRẠM KIỂM ĐỊNH CHẤT LƯỢNG (QC)', 'KHU VỰC SOẠN & ĐÓNG GÓI'][i]}
              </Text>
            </group>
          ))}

          {/* Render All Racks and Their Inventory Slots */}
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
                isTransferMode={isTransferMode}
                sourceTransferSlot={sourceTransferSlot}
                onSelectTransferTarget={onSelectTransferTarget}
              />
            </group>
          ))}

          {/* Precision Camera Controller */}
          <WarehouseCameraController
            cameraCommand={cameraCommand}
            onCommandFinished={() => setCameraCommand(null)}
            controlsRef={controlsRef}
          />

          {/* Smooth OrbitControls with Damping */}
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={3.0}
            maxDistance={32.0}
            minPolarAngle={0.08}
            maxPolarAngle={Math.PI / 2.05}
            onStart={() => {
              // Free user manual control instantly stops any auto transition
              setCameraCommand(null);
            }}
          />
        </Canvas>
      </div>

      {/* 3. BOTTOM FOOTER HUD & MOUSE GUIDE */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-[#1c2b40] bg-[#0c1626] px-3.5 py-2 text-[11px] text-[#94a3b8]">
        {/* Context-Aware Color Legend */}
        {viewMode === 'heatmap' ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2 rounded-sm bg-[#06b6d4]" />Mật độ thấp (&lt; 200 đv)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2 rounded-sm bg-[#10b981]" />Mật độ vừa (200 - 500 đv)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2 rounded-sm bg-[#a855f7]" />Mật độ cao (&gt; 500 đv)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2 rounded-sm border border-[#475569] bg-transparent" />Ô trống khả dụng</span>
          </div>
        ) : viewMode === 'space' ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2 rounded-sm bg-[#3b82f6]" />Tải nhẹ (&lt; 40%)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2 rounded-sm bg-[#f59e0b]" />Tải trung bình (40 - 75%)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2 rounded-sm bg-[#ef4444]" />Tải nặng (&gt; 75%)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2 rounded-sm border border-[#475569] bg-transparent" />Ô chưa sử dụng</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2 rounded-sm bg-[#22c55e]" />Đạt chuẩn QC</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2 rounded-sm bg-[#f59e0b]" />Chờ kiểm định (HOLD)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2 rounded-sm bg-[#ef4444]" />Lỗi kiểm định (BLOCKED)</span>
            <span className="flex items-center"><i className="mr-1.5 inline-block size-2 rounded-sm bg-[#c49a62]" />Pallet gỗ công nghiệp</span>
          </div>
        )}

        {/* Mouse Navigation Instructions */}
        <div className="flex items-center gap-2 text-[#64748b] font-medium text-[10px]">
          <span>🖱️ Chuột trái: Xoay</span>
          <span>·</span>
          <span>Chuột phải: Di chuyển (Pan)</span>
          <span>·</span>
          <span>Cuộn chuột: Phóng to/Thu nhỏ</span>
        </div>
      </div>
    </div>
  );
}
