// DigitalTwinCameraRig.jsx
// Smooth Camera Motion Controller: Overview, Follow Forklift, Follow Pallet, Rack/Slot Focus & Free Orbit.
import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

export default function DigitalTwinCameraRig({
  cameraMode = 'overview', // 'overview', 'forklift', 'pallet', 'slot', 'free'
  forkliftPos = [0, 0, 0],
  palletPos = [0, 0, 0],
  targetSlotPos = null,
  resetKey = 0
}) {
  const { camera } = useThree();
  const controlsRef = useRef();

  useLayoutEffect(() => {
    if (!controlsRef.current) return;
    if (cameraMode === 'overview' || resetKey > 0) {
      camera.position.set(0, 10.5, 12.0);
      controlsRef.current.target.set(0, 1.0, -1.0);
      controlsRef.current.update();
    }
  }, [cameraMode, resetKey, camera]);

  useFrame(() => {
    if (cameraMode === 'free' || !controlsRef.current) return;

    if (cameraMode === 'forklift') {
      const [fx, fy, fz] = forkliftPos;
      const targetCamPos = new THREE.Vector3(fx, fy + 3.5, fz + 5.2);
      const targetLook = new THREE.Vector3(fx, fy + 0.8, fz);
      camera.position.lerp(targetCamPos, 0.05);
      controlsRef.current.target.lerp(targetLook, 0.08);
      controlsRef.current.update();
    } else if (cameraMode === 'pallet') {
      const [px, py, pz] = palletPos;
      const targetCamPos = new THREE.Vector3(px + 1.8, py + 2.2, pz + 3.0);
      const targetLook = new THREE.Vector3(px, py + 0.2, pz);
      camera.position.lerp(targetCamPos, 0.06);
      controlsRef.current.target.lerp(targetLook, 0.08);
      controlsRef.current.update();
    } else if (cameraMode === 'slot' && targetSlotPos) {
      const [sx, sy, sz] = targetSlotPos;
      const targetCamPos = new THREE.Vector3(sx, sy + 0.8, sz + 2.8);
      const targetLook = new THREE.Vector3(sx, sy, sz);
      camera.position.lerp(targetCamPos, 0.05);
      controlsRef.current.target.lerp(targetLook, 0.08);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      minDistance={2}
      maxDistance={35}
      minPolarAngle={Math.PI / 8}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}
