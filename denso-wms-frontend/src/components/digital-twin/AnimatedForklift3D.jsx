// AnimatedForklift3D.jsx
// Detailed 3D Industrial Forklift with Working Vertical Mast, Carriage Elevation & Fork Extension.
import React from 'react';
import PalletUnit3D from './PalletUnit3D';

export default function AnimatedForklift3D({
  position = [0, 0, 0],
  yaw = 0,
  lift = 0.1,
  extension = 0,
  carriedPallet = null,
  activeLayer = 'qc',
  onClick
}) {
  const [x, y, z] = position;
  const clampedLift = Math.max(0.05, Math.min(2.2, lift));
  const clampedExt = Math.max(0, Math.min(0.5, extension));

  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]} onClick={onClick}>
      {/* 1. Main Forklift Body / Chassis (Length: 0.95, Width: 0.60, Height: 0.35) */}
      <mesh position={[0, 0.22, -0.15]}>
        <boxGeometry args={[0.55, 0.30, 0.75]} />
        <meshStandardMaterial color="#F59E0B" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Rear Counterweight (Charcoal Steel) */}
      <mesh position={[0, 0.25, -0.52]}>
        <boxGeometry args={[0.52, 0.32, 0.22]} />
        <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* 4 Rubber Tires */}
      {[
        [-0.28, 0.12, 0.18],  // Front Left
        [0.28, 0.12, 0.18],   // Front Right
        [-0.26, 0.10, -0.42], // Rear Left
        [0.26, 0.10, -0.42]   // Rear Right
      ].map(([wx, wy, wz], i) => (
        <group key={`wheel-${i}`} position={[wx, wy, wz]} rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.11, 0.11, 0.08, 16]} />
            <meshStandardMaterial color="#0A111B" roughness={0.9} />
          </mesh>
          {/* Rim */}
          <mesh>
            <cylinderGeometry args={[0.06, 0.06, 0.082, 12]} />
            <meshStandardMaterial color="#64748B" metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Driver Overhead Guard Frame */}
      {[-0.22, 0.22].map((gx, gi) =>
        [-0.42, 0.10].map((gz, gzi) => (
          <mesh key={`guard-post-${gi}-${gzi}`} position={[gx, 0.65, gz]}>
            <boxGeometry args={[0.03, 0.60, 0.03]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
        ))
      )}
      {/* Roof canopy */}
      <mesh position={[0, 0.95, -0.16]}>
        <boxGeometry args={[0.48, 0.03, 0.56]} />
        <meshStandardMaterial color="#0F172A" roughness={0.7} />
      </mesh>

      {/* Driver Seat & Steering */}
      <mesh position={[0, 0.45, -0.20]}>
        <boxGeometry args={[0.30, 0.20, 0.28]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* 2. Fixed Vertical Mast (Front Uprights, Height: 2.30) */}
      {[-0.18, 0.18].map((mx, mi) => (
        <mesh key={`mast-${mi}`} position={[mx, 1.15, 0.32]}>
          <boxGeometry args={[0.04, 2.10, 0.04]} />
          <meshStandardMaterial color="#50677B" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* Mast crossbars */}
      {[0.4, 1.2, 2.0].map((my, mi) => (
        <mesh key={`mast-cross-${mi}`} position={[0, my, 0.32]}>
          <boxGeometry args={[0.36, 0.03, 0.03]} />
          <meshStandardMaterial color="#50677B" />
        </mesh>
      ))}

      {/* 3. Moving Fork Carriage (Translates vertically with liftHeight) */}
      <group position={[0, clampedLift, 0.34]}>
        {/* Carriage Backplate */}
        <mesh position={[0, 0.15, 0.02]}>
          <boxGeometry args={[0.42, 0.28, 0.03]} />
          <meshStandardMaterial color="#334155" metalness={0.6} />
        </mesh>

        {/* 2 Fork Tines (Extend horizontally with extension) */}
        {[-0.12, 0.12].map((tx, ti) => (
          <group key={`fork-tine-${ti}`} position={[tx, 0.02, 0.04 + clampedExt]}>
            {/* Horizontal blade */}
            <mesh position={[0, 0, 0.25]}>
              <boxGeometry args={[0.05, 0.018, 0.50]} />
              <meshStandardMaterial color="#0F172A" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Vertical shank */}
            <mesh position={[0, 0.12, 0.01]}>
              <boxGeometry args={[0.05, 0.24, 0.02]} />
              <meshStandardMaterial color="#0F172A" metalness={0.9} />
            </mesh>
          </group>
        ))}

        {/* 4. Carried Pallet (Directly mounted onto moving fork tines) */}
        {carriedPallet && (
          <group position={[0, 0.04, 0.28 + clampedExt]}>
            <PalletUnit3D
              part={carriedPallet}
              activeLayer={activeLayer}
              isHighlighted={true}
            />
          </group>
        )}
      </group>

      {/* Headlights */}
      {[-0.20, 0.20].map((lx, li) => (
        <mesh key={`headlight-${li}`} position={[lx, 0.50, 0.28]}>
          <boxGeometry args={[0.05, 0.05, 0.03]} />
          <meshBasicMaterial color="#FEF08A" />
        </mesh>
      ))}
    </group>
  );
}
