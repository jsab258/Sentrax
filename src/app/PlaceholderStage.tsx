import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { AgXToneMapping, SRGBColorSpace } from 'three';

/**
 * M0 placeholder for the 3D stage. Verifies the lazy-loaded three.js chunk, renderer color management and
 * constrained orbit controls. Replaced by the hospital scene in M2.
 */
export default function PlaceholderStage() {
  return (
    <Canvas
      className="stage-canvas"
      dpr={[1, 2]}
      shadows={false}
      camera={{ position: [24, 26, 32], fov: 40, near: 0.1, far: 500 }}
      gl={{ antialias: true, toneMapping: AgXToneMapping, outputColorSpace: SRGBColorSpace }}
      data-testid="stage-canvas"
    >
      <color attach="background" args={['#e9ebee']} />
      <hemisphereLight args={['#ffffff', '#b9bec6', 1.2]} />
      <directionalLight position={[10, 20, 8]} intensity={1.5} />
      <Floorplan />
      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        minDistance={10}
        maxDistance={60}
        minPolarAngle={0.2}
        maxPolarAngle={1.2}
        enableDamping
      />
    </Canvas>
  );
}

/** Neutral grey massing of a ward floor, roughly 40 x 25 m, to give the placeholder a sense of scale. */
function Floorplan() {
  const rooms: Array<[number, number, number, number]> = [
    [-15, -8, 8, 7],
    [-5, -8, 8, 7],
    [5, -8, 8, 7],
    [15, -8, 8, 7],
    [-15, 8, 8, 7],
    [-5, 8, 8, 7],
    [5, 8, 8, 7],
    [15, 8, 8, 7],
  ];
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 25]} />
        <meshStandardMaterial color="#cfd3d8" roughness={0.9} />
      </mesh>
      {rooms.map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.6, z]}>
          <boxGeometry args={[w, 1.2, d]} />
          <meshStandardMaterial color="#f2f3f5" roughness={0.8} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}
