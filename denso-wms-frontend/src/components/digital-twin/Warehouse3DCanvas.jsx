// Warehouse3DCanvas.jsx
// Three.js Canvas mounting the Operational 3D Digital Twin World with R3F.
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import WarehouseEnvironment3D from './WarehouseEnvironment3D';
import OperationalRack3D from './OperationalRack3D';
import AnimatedForklift3D from './AnimatedForklift3D';
import AnimatedAGV3D from './AnimatedAGV3D';
import DigitalTwinCameraRig from './DigitalTwinCameraRig';

export default function Warehouse3DCanvas({
  racks = [],
  activeLayer = 'qc',
  showRoutes = true,
  cameraMode = 'overview',
  forkliftState = null,
  agvState = null,
  carriedPallet = null,
  selectedSlotKey = null,
  highlightSlotKey = null,
  targetSlotCoords = null,
  resetKey = 0,
  onSelectSlot,
  onSelectRack,
  onSelectForklift,
  onSelectAGV
}) {
  return (
    <Canvas
      camera={{ position: [0, 10.5, 12.0], fov: 45, near: 0.1, far: 100 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%', background: '#080F1C' }}
    >
      {/* Scene Lighting (Industrial High-Contrast Dark Navy / Emerald / Cyan) */}
      <ambientLight intensity={1.8} />
      <hemisphereLight args={['#c6f4f0', '#0f172a', 2.0]} />
      <directionalLight position={[10, 18, 12]} intensity={2.6} castShadow />
      <directionalLight position={[-12, 12, -8]} intensity={1.2} color="#38bdf8" />
      <pointLight position={[0, 4, 1.8]} intensity={1.5} color="#10b981" distance={15} />

      <Suspense fallback={null}>
        {/* 1. Industrial Infrastructure & Aisle Boundaries */}
        <WarehouseEnvironment3D showRoutes={showRoutes} />

        {/* 2. Multi-tier Industrial Storage Racks */}
        {racks.map((rack) => (
          <OperationalRack3D
            key={rack.id || rack.name}
            rack={rack}
            position={rack.position}
            activeLayer={activeLayer}
            selectedSlotKey={selectedSlotKey}
            highlightSlotKey={highlightSlotKey}
            onSelectSlot={onSelectSlot}
            onSelectRack={onSelectRack}
          />
        ))}

        {/* 3. Operational Vehicles: Forklift & AGV */}
        {forkliftState && (
          <AnimatedForklift3D
            position={forkliftState.position}
            yaw={forkliftState.yaw}
            lift={forkliftState.lift}
            extension={forkliftState.extension}
            carriedPallet={carriedPallet}
            activeLayer={activeLayer}
            onClick={(e) => {
              e.stopPropagation();
              onSelectForklift?.();
            }}
          />
        )}

        {agvState && (
          <AnimatedAGV3D
            position={agvState.position}
            yaw={agvState.yaw}
            cargoVisible={agvState.cargoVisible}
            onClick={(e) => {
              e.stopPropagation();
              onSelectAGV?.();
            }}
          />
        )}

        {/* 4. Dynamic Camera Motion Rig */}
        <DigitalTwinCameraRig
          cameraMode={cameraMode}
          forkliftPos={forkliftState?.position || [0, 0, 0]}
          palletPos={carriedPallet ? forkliftState?.position : [0, 0, 0]}
          targetSlotPos={targetSlotCoords?.position || null}
          resetKey={resetKey}
        />
      </Suspense>
    </Canvas>
  );
}
