// AnimatedAGV3D.jsx
// Automated Guided Vehicle (AGV) with optical path-following sensors and pallet cargo transport.
import React from 'react';
import PalletUnit3D from './PalletUnit3D';

export default function AnimatedAGV3D({
  position = [0, 0, 0],
  yaw = 0,
  cargoVisible = true,
  onClick
}) {
  const [x, y, z] = position;

  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]} onClick={onClick}>
      {/* AGV Chassis Body (Length: 0.85, Width: 0.55, Height: 0.16) */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.55, 0.14, 0.85]} />
        <meshStandardMaterial color="#0F766E" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Front Safety Bumper (Cyan #06B6D4) */}
      <mesh position={[0, 0.08, 0.44]}>
        <boxGeometry args={[0.52, 0.10, 0.04]} />
        <meshStandardMaterial color="#06B6D4" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* Optical / Laser Safety Scanner Dome */}
      <mesh position={[0, 0.18, 0.35]}>
        <cylinderGeometry args={[0.06, 0.06, 0.05, 16]} />
        <meshBasicMaterial color="#22D3EE" />
      </mesh>

      {/* 4 Omni Wheels */}
      {[
        [-0.26, 0.05, 0.28],
        [0.26, 0.05, 0.28],
        [-0.26, 0.05, -0.28],
        [0.26, 0.05, -0.28]
      ].map(([wx, wy, wz], i) => (
        <mesh key={`agv-wheel-${i}`} position={[wx, wy, wz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.04, 12]} />
          <meshStandardMaterial color="#0A111B" />
        </mesh>
      ))}

      {/* Top Pallet Cargo Deck */}
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.50, 0.02, 0.70]} />
        <meshStandardMaterial color="#1E293B" metalness={0.7} />
      </mesh>

      {/* Carried Cargo Pallet */}
      {cargoVisible && (
        <group position={[0, 0.17, 0]}>
          <PalletUnit3D
            part={{ productCode: 'MSN-NAMNGU-FISHSAUCE-500', lotNumber: 'AGV-LOT-01', quantityPcs: 80, qcStatus: 'AVAILABLE' }}
            activeLayer="sku"
          />
        </group>
      )}
    </group>
  );
}
