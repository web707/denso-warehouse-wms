// PalletGeometry.jsx
// Certified Industrial Pallet with Real Fork Channels & Handling Unit Cargo
import React from 'react';
import { Text } from '@react-three/drei';

function Block({ position, size, color, onClick }) {
  return (
    <mesh position={position} onClick={onClick}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

export default function PalletGeometry({
  position = [0, 0, 0],
  yaw = 0,
  details,
  onSelect,
  isPartialPicking = false,
  partialProgress = 0,
  cargoColor = '#d9b980',
  cargoLabel
}) {
  return (
    <group position={position} rotation={[0, yaw, 0]} onClick={e => { e.stopPropagation(); onSelect?.(details); }}>
      {/* Top deck boards */}
      <Block position={[0, 0.062, 0]} size={[0.28, 0.016, 0.28]} color="#c8a575" />
      
      {/* 3 Stringers with 2 fork pocket channels (left at z=-0.09, right at z=+0.09, width 0.070, height 0.040) */}
      <Block position={[0, 0.034, -0.1325]} size={[0.28, 0.040, 0.015]} color="#b59062" />
      <Block position={[0, 0.034, 0]} size={[0.28, 0.040, 0.110]} color="#b59062" />
      <Block position={[0, 0.034, 0.1325]} size={[0.28, 0.040, 0.015]} color="#b59062" />
      
      {/* 3 Bottom runner boards */}
      <Block position={[0, 0.007, -0.1325]} size={[0.28, 0.014, 0.015]} color="#a07a4a" />
      <Block position={[0, 0.007, 0]} size={[0.28, 0.014, 0.055]} color="#a07a4a" />
      <Block position={[0, 0.007, 0.1325]} size={[0.28, 0.014, 0.015]} color="#a07a4a" />

      {/* Cargo on top of pallet */}
      {isPartialPicking ? (
        <>
          {/* Base 80 units (stationary on shelf) */}
          <Block position={[0, 0.15, 0]} size={[0.24, 0.16, 0.24]} color="#d9b980" />
          <Block position={[0, 0.15, 0]} size={[0.242, 0.015, 0.242]} color="#967240" />
          <Text position={[0, 0.15, 0.125]} fontSize={0.04} color="#1e293b">80 PCS</Text>
          
          {/* Before pick (p < 0.35): show top 20 units stacked forming 100 units */}
          {partialProgress < 0.35 && (
            <group position={[0, 0.27, 0]}>
              <Block position={[0, 0, 0]} size={[0.24, 0.08, 0.24]} color="#38bdf8" />
              <Block position={[0, 0, 0]} size={[0.242, 0.01, 0.242]} color="#0284c7" />
              <Text position={[0, 0, 0.125]} fontSize={0.035} color="#0f172a">20 PCS</Text>
              <Text position={[0, 0.08, 0]} fontSize={0.05} color="#22c55e">100 PCS</Text>
            </group>
          )}
          {partialProgress >= 0.35 && (
            <Text position={[0, 0.26, 0]} fontSize={0.045} color="#fbbf24">80 PCS (TỒN KHO)</Text>
          )}
        </>
      ) : (
        <>
          <Block position={[0, 0.20, 0]} size={[0.24, 0.26, 0.24]} color={cargoColor} />
          <Block position={[0, 0.20, 0]} size={[0.242, 0.02, 0.242]} color="#967240" />
          <Block position={[0, 0.331, 0]} size={[0.12, 0.002, 0.08]} color="#ffffff" />
          {cargoLabel && (
            <Text position={[0, 0.20, 0.125]} fontSize={0.035} color="#1e293b">{cargoLabel}</Text>
          )}
        </>
      )}
    </group>
  );
}
