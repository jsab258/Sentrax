import { CameraControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Box3, Vector3 } from 'three';
import { devToolsEnabled } from '../app/devtools';
import { framing, MAX_DISTANCE, type SceneFrameBounds } from './framing';
import { cutawayUniforms } from './materials/cutaway';

/** Development only: ?cam=px,py,pz,tx,ty,tz (three.js coordinates) for reproducible screenshots. */
function devCamera(): [number, number, number, number, number, number] | null {
  if (!devToolsEnabled) return null;
  const v = new URLSearchParams(window.location.search).get('cam')?.split(',').map(Number);
  return v && v.length === 6 && v.every(Number.isFinite)
    ? (v as [number, number, number, number, number, number])
    : null;
}

/**
 * Constrained orbit, pan and zoom (SPEC section 4): the camera stays above the floor, the target stays
 * over the building. Also feeds the cutaway shader with the camera position.
 */
export function CameraRig({ bounds }: { bounds: SceneFrameBounds }) {
  const ref = useRef<CameraControls>(null);
  const camera = useThree((s) => s.camera);
  const get = useThree((s) => s.get);
  const portrait = useThree((s) => s.size.width / Math.max(1, s.size.height) < 0.9);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const target = new Vector3((bounds.x0 + bounds.x1) / 2, 0.8, -(bounds.y0 + bounds.y1) / 2);
    const { size } = get();
    const aspect = size.width / Math.max(1, size.height);
    const fov = 'fov' in camera ? (camera.fov as number) : 35;
    const f = framing(bounds, aspect, fov);
    const pos = new Vector3().setFromSphericalCoords(f.distance, f.polar, f.azimuth).add(target);
    const dev = devCamera();
    if (dev) void c.setLookAt(...dev, false);
    else void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, false);
    c.setBoundary(
      new Box3(new Vector3(bounds.x0 - 2, 0, -bounds.y1 - 2), new Vector3(bounds.x1 + 2, 3, -bounds.y0 + 2)),
    );
    // Frame once, and again only when the canvas flips between portrait and landscape.
  }, [bounds, camera, get, portrait]);

  useFrame(() => {
    cutawayUniforms.uCamPos.value.set(camera.position.x, camera.position.z);
  }, -40);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={3}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={0.2}
      maxPolarAngle={1.25}
      dollyToCursor
      smoothTime={0.3}
      draggingSmoothTime={0.12}
    />
  );
}
