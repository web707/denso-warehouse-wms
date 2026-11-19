import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, useGLTF } from '@react-three/drei';

const MODEL_URL = '/models/masan_wms_warehouse_v2.glb';

function WarehouseModel() {
  const gltf = useGLTF(MODEL_URL);
  // Model is authored Z-up. Three.js uses Y-up.
  // Rotate only once here; do not rotate parent containers.
  return <primitive object={gltf.scene} rotation={[-Math.PI / 2, 0, 0]} />;
}

function WarehouseCanvas({ mode = 'login' }) {
  const isViewer = mode === 'viewer';
  return (
    <Canvas
      orthographic
      camera={{ position: [18, 15, 19], near: 0.01, far: 150, zoom: isViewer ? 42 : 36 }}
      dpr={[1, 1.75]}
      frameloop="demand"
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      style={{ display: 'block', width: '100%', height: '100%', touchAction: 'pan-y' }}
    >
      <ambientLight intensity={2.0} />
      <hemisphereLight args={['#c6f4f0', '#192d41', 2.3]} />
      <directionalLight position={[9, 18, 12]} intensity={2.8} />
      <directionalLight position={[-10, 10, -7]} intensity={1.0} color="#57d8cf" />
      <Suspense fallback={null}>
        {/* Auto-fit the entire model across card & viewer sizes; never hardcode a scale */}
        <Bounds fit clip observe margin={isViewer ? 1.15 : 1.2}>
          <Center>
            <WarehouseModel />
          </Center>
        </Bounds>
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan={isViewer}
        enableZoom={isViewer}
        minZoom={15}
        maxZoom={120}
        enableDamping
        dampingFactor={0.075}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        minAzimuthAngle={isViewer ? undefined : -Math.PI / 2.5}
        maxAzimuthAngle={isViewer ? undefined : Math.PI / 2.5}
      />
    </Canvas>
  );
}

class CanvasFallback extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          role="status"
          style={{
            display: 'grid',
            placeItems: 'center',
            height: '100%',
            color: '#94A3B8',
            padding: 20,
            textAlign: 'center',
          }}
        >
          Không thể hiển thị mô hình 3D trên thiết bị này.
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * mode="login"  -> inline illustration inside the Login page (height adjusts to container).
 * mode="viewer" -> full simulation viewer; enables zoom, rotate, pan and full-viewport scaling.
 * Design System: Dark Navy (#080F1C), Industrial Emerald (#10B981), Cyan (#2DD4BF).
 */
export default function MiniWarehouseDigitalTwinV2({ mode = 'login', className = '' }) {
  const login = mode === 'login';
  const style = useMemo(
    () => ({
      width: '100%',
      height: '100%',
      minHeight: login ? 190 : 0,
      minWidth: 0,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 12,
      background: 'radial-gradient(ellipse at 50% 40%, #152738 0%, #0c1824 75%)',
    }),
    [login]
  );

  return (
    <div
      className={`cursor-grab active:cursor-grabbing select-none ${className}`}
      style={style}
      role="group"
      aria-label="Minh họa 3D nhà kho Masan WMS với sáu dãy kệ, pallet, xe nâng và xe tự hành"
    >
      <CanvasFallback>
        <WarehouseCanvas mode={mode} />
      </CanvasFallback>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 12,
          bottom: 10,
          fontSize: 10,
          letterSpacing: '.08em',
          color: '#91abb7',
          pointerEvents: 'none',
          backgroundColor: 'rgba(10, 19, 31, 0.75)',
          padding: '2px 8px',
          borderRadius: 4,
          border: '1px solid rgba(41, 67, 85, 0.4)',
          backdropFilter: 'blur(4px)',
        }}
      >
        WAREHOUSE DIGITAL TWIN · 3D V2
      </div>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
