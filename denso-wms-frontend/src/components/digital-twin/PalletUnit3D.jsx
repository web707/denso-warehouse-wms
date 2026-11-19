// PalletUnit3D.jsx
// Visualizes industrial wood pallets loaded with cargo cartons, color-coded by QC, SKU, Expiry, or Heatmap.
import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';

const QC_COLORS = Object.freeze({
  AVAILABLE: '#22c55e', // Green
  OK: '#22c55e',
  HOLD: '#f59e0b', // Amber
  PENDING: '#f59e0b',
  BLOCKED: '#ef4444', // Red
  REJECTED: '#ef4444'
});

const SKU_COLORS = Object.freeze({
  CHINSU: '#ef4444',
  NAMNGU: '#f97316',
  OMACHI: '#eab308',
  KOKOMI: '#10b981',
  WAKEUP: '#8b5cf6',
  DEFAULT: '#c89b60'
});

function getSkuColor(productCode = '') {
  const code = String(productCode).toUpperCase();
  if (code.includes('CHINSU')) return SKU_COLORS.CHINSU;
  if (code.includes('NAMNGU')) return SKU_COLORS.NAMNGU;
  if (code.includes('OMACHI')) return SKU_COLORS.OMACHI;
  if (code.includes('KOKOMI')) return SKU_COLORS.KOKOMI;
  if (code.includes('WAKEUP') || code.includes('COFFEE')) return SKU_COLORS.WAKEUP;
  return SKU_COLORS.DEFAULT;
}

function getExpiryColor(expDate) {
  if (!expDate) return '#10b981';
  const diffDays = Math.ceil((new Date(expDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return '#ef4444'; // Expired
  if (diffDays <= 60) return '#f59e0b'; // Urgency alert < 60 days
  return '#10b981'; // Safe
}

export default function PalletUnit3D({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  part = null,
  activeLayer = 'qc', // 'qc', 'sku', 'expiry', 'normal'
  isSelected = false,
  isHighlighted = false,
  onClick
}) {
  const qcStatus = part?.qcStatus || (part?.receiving_damaged ? 'BLOCKED' : 'AVAILABLE');
  const expDate = part?.expirationDate || part?.expiration_date;
  const productCode = part?.productCode || part?.product_code || '';
  const lotNumber = part?.lotNumber || part?.lot_number || '';
  const quantity = part?.quantityPcs || part?.quantity || 100;

  const cartonColor = useMemo(() => {
    if (activeLayer === 'qc') return QC_COLORS[qcStatus] || QC_COLORS.AVAILABLE;
    if (activeLayer === 'sku') return getSkuColor(productCode);
    if (activeLayer === 'expiry') return getExpiryColor(expDate);
    return '#BA9463'; // Industrial kraft cardboard
  }, [activeLayer, qcStatus, productCode, expDate]);

  return (
    <group position={position} rotation={rotation} onClick={onClick}>
      {/* Wooden Pallet Base (Width: 0.28, Depth: 0.28, Height: 0.04) */}
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[0.26, 0.025, 0.26]} />
        <meshStandardMaterial color="#876B50" roughness={0.9} />
      </mesh>
      {/* Deckboard runners */}
      <mesh position={[0, 0.005, -0.11]}>
        <boxGeometry args={[0.26, 0.012, 0.03]} />
        <meshStandardMaterial color="#6B533E" />
      </mesh>
      <mesh position={[0, 0.005, 0]}>
        <boxGeometry args={[0.26, 0.012, 0.05]} />
        <meshStandardMaterial color="#6B533E" />
      </mesh>
      <mesh position={[0, 0.005, 0.11]}>
        <boxGeometry args={[0.26, 0.012, 0.03]} />
        <meshStandardMaterial color="#6B533E" />
      </mesh>

      {/* Cargo Carton Block (Width: 0.23, Height: 0.22, Depth: 0.23) */}
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.23, 0.22, 0.23]} />
        <meshStandardMaterial
          color={cartonColor}
          roughness={0.7}
          emissive={isSelected ? '#38bdf8' : isHighlighted ? '#10b981' : '#000000'}
          emissiveIntensity={isSelected ? 0.35 : isHighlighted ? 0.25 : 0}
        />
      </mesh>

      {/* Packaging tape stripe */}
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.232, 0.02, 0.232]} />
        <meshStandardMaterial color="#D4B27E" roughness={0.6} />
      </mesh>

      {/* Barcode / Shipping Label on front face */}
      <mesh position={[0, 0.14, 0.117]}>
        <planeGeometry args={[0.08, 0.04]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>

      {/* Front label text */}
      <Text
        position={[0, 0.14, 0.118]}
        fontSize={0.018}
        color="#0f172a"
        anchorX="center"
        anchorY="middle"
      >
        {`${quantity} ĐV`}
      </Text>

      {/* Top Lot Badge */}
      <Text
        position={[0, 0.252, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.022}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {lotNumber ? `LÔ ${lotNumber.slice(-6)}` : 'MASAN'}
      </Text>

      {/* Selection / Highlight Glowing Bounding Box */}
      {isSelected && (
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.28, 0.28, 0.28]} />
          <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
}
