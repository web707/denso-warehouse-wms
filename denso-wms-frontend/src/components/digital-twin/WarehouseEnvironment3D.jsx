// WarehouseEnvironment3D.jsx
// High-Fidelity Industrial Warehouse Infrastructure: Polished Floor, Safety Aisles, Inbound/Outbound Docks, Staging Zones & Signage.
import React from 'react';
import { Text } from '@react-three/drei';

export default function WarehouseEnvironment3D({ showRoutes = false }) {
  return (
    <group>
      {/* 1. Main Polished Concrete Warehouse Floor (Dark Navy #0B1320) */}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[18.0, 0.04, 12.0]} />
        <meshStandardMaterial color="#0C1625" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Grid Helper on Floor */}
      <gridHelper args={[18, 36, '#26374C', '#142132']} position={[0, 0.001, 0]} />

      {/* 2. Safety Yellow Aisle Boundaries & Pedestrian Walkways */}
      {/* Main East-West Center Aisle Lines (z = -1.20) */}
      <mesh position={[0, 0.002, -0.50]}>
        <boxGeometry args={[16.0, 0.002, 0.06]} />
        <meshBasicMaterial color="#EAB308" />
      </mesh>
      <mesh position={[0, 0.002, -1.90]}>
        <boxGeometry args={[16.0, 0.002, 0.06]} />
        <meshBasicMaterial color="#EAB308" />
      </mesh>

      {/* Cross-Aisle Dashed Centerlines (Cyan #06B6D4) */}
      {[-4.0, 0.0, 4.0].map((cx, i) => (
        <group key={`cross-aisle-${i}`} position={[cx, 0.002, 0.3]}>
          <mesh>
            <boxGeometry args={[0.06, 0.002, 1.4]} />
            <meshBasicMaterial color="#06B6D4" />
          </mesh>
        </group>
      ))}

      {/* 3. Operational Staging Bays (Receiving, QC, Pack/Dispatch) */}
      {/* A. Receiving Dock Bay (West / Left: x = -4.0, z = 1.8) */}
      <group position={[-4.0, 0.002, 1.8]}>
        <mesh>
          <boxGeometry args={[2.2, 0.004, 1.6]} />
          <meshStandardMaterial color="#1E293B" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.001, 0]}>
          <boxGeometry args={[2.25, 0.002, 1.65]} />
          <meshBasicMaterial color="#38BDF8" wireframe />
        </mesh>
        <Text
          position={[0, 0.006, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.13}
          color="#38BDF8"
          anchorX="center"
          anchorY="middle"
        >
          TIẾP NHẬN HÀNG · DOCK-IN
        </Text>
      </group>

      {/* B. QC Inspection Staging (Center: x = 0.0, z = 1.8) */}
      <group position={[0.0, 0.002, 1.8]}>
        <mesh>
          <boxGeometry args={[2.2, 0.004, 1.6]} />
          <meshStandardMaterial color="#1E293B" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.001, 0]}>
          <boxGeometry args={[2.25, 0.002, 1.65]} />
          <meshBasicMaterial color="#F59E0B" wireframe />
        </mesh>
        <Text
          position={[0, 0.006, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.13}
          color="#F59E0B"
          anchorX="center"
          anchorY="middle"
        >
          KIỂM ĐỊNH CHẤT LƯỢNG · QC
        </Text>
      </group>

      {/* C. Packing & Dispatch Staging (East / Right: x = 3.5, z = 1.8) */}
      <group position={[3.5, 0.002, 1.8]}>
        <mesh>
          <boxGeometry args={[2.2, 0.004, 1.6]} />
          <meshStandardMaterial color="#1E293B" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.001, 0]}>
          <boxGeometry args={[2.25, 0.002, 1.65]} />
          <meshBasicMaterial color="#10B981" wireframe />
        </mesh>
        <Text
          position={[0, 0.006, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.13}
          color="#10B981"
          anchorX="center"
          anchorY="middle"
        >
          SOẠN & ĐÓNG GÓI · STAGING
        </Text>
      </group>

      {/* 4. External Truck Loading Dock Bumpers */}
      {/* Inbound Truck Dock Platform */}
      <group position={[-4.0, 0.15, 3.8]}>
        <mesh>
          <boxGeometry args={[2.8, 0.30, 1.6]} />
          <meshStandardMaterial color="#334155" metalness={0.4} />
        </mesh>
        <Text
          position={[0, 0.16, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.15}
          color="#F8FAFC"
          anchorX="center"
          anchorY="middle"
        >
          CỬA NHẬP DOCK 01 (INBOUND)
        </Text>
      </group>

      {/* Outbound Truck Dock Platform */}
      <group position={[4.0, 0.15, 3.8]}>
        <mesh>
          <boxGeometry args={[2.8, 0.30, 1.6]} />
          <meshStandardMaterial color="#334155" metalness={0.4} />
        </mesh>
        <Text
          position={[0, 0.16, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.15}
          color="#F8FAFC"
          anchorX="center"
          anchorY="middle"
        >
          CỬA XUẤT DOCK 02 (OUTBOUND)
        </Text>
      </group>

      {/* 5. Zone Overhead Markers */}
      <group position={[0, 3.4, -3.0]}>
        <Text fontSize={0.22} color="#10B981" anchorX="center" anchorY="middle">
          ZONE-A · KHU VỰC LƯU TRỮ CHÍNH (R01 - R03)
        </Text>
      </group>
    </group>
  );
}
