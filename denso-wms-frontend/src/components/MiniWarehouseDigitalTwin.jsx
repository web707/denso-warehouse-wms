import React, { Suspense, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, useGLTF } from '@react-three/drei';
import { Loader2, Rotate3d } from 'lucide-react';

class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.warn('MiniWarehouseDigitalTwin WebGL Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-xs text-[#94A3B8] font-mono p-4 text-center">
          <Rotate3d className="w-6 h-6 text-[#10B981] mb-2 opacity-60" />
          <span>Mô hình 3D sẵn sàng</span>
        </div>
      );
    }
    return this.props.children;
  }
}

// Model Loader from public/models/masan_wms_warehouse.glb
function WarehouseModel() {
  const { scene } = useGLTF('/models/masan_wms_warehouse.glb');
  // GLB uses Z-up coordinates; Three.js uses Y-up.
  return <primitive object={scene} rotation={[-Math.PI / 2, 0, 0]} />;
}

export default function MiniWarehouseDigitalTwin() {
  return (
    <div
      role="img"
      aria-label="Mô hình kho 3D minh họa gồm ba dãy kệ R01, R02, R03 và xe tự hành AGV"
      className="w-full h-full relative overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{ minHeight: 180 }}
    >
      <CanvasErrorBoundary>
        <Canvas
          orthographic
          camera={{ position: [13, 10, 15], zoom: 32, near: 0.1, far: 120 }}
          dpr={[1, 1.6]}
          gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <ambientLight intensity={2.2} />
          <directionalLight position={[3, 12, 7]} intensity={2.4} />
          <directionalLight position={[-5, 6, -3]} intensity={0.8} color="#4bd9ca" />
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.15}>
              <Center>
                <WarehouseModel />
              </Center>
            </Bounds>
          </Suspense>
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.3}
            target={[0, 1.2, 0]}
          />
        </Canvas>
      </CanvasErrorBoundary>

      {/* Interactive Helper Badge */}
      <div className="absolute bottom-2 right-2.5 pointer-events-none flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#080F1C]/80 border border-[#26374C]/60 text-[10px] font-mono text-[#94A3B8] backdrop-blur-sm">
        <Rotate3d className="w-3 h-3 text-[#10B981]" />
        <span>Kéo để xoay 3D</span>
      </div>
    </div>
  );
}

useGLTF.preload('/models/masan_wms_warehouse.glb');
