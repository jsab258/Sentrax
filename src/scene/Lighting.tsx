import { Environment } from '@react-three/drei';
import { useLayoutEffect, useRef } from 'react';
import type { DirectionalLight } from 'three';
import type { SceneFrameBounds } from './framing';
import { hdriPath } from './materials/textures';
import type { TierSettings } from './quality';

/**
 * HDRI environment for ambient light and reflections (not shown as background), plus one sun-like key
 * light casting soft shadows into the open-top building.
 */
export function Lighting({ bounds, settings }: { bounds: SceneFrameBounds; settings: TierSettings }) {
  const sun = useRef<DirectionalLight>(null);
  const cx = (bounds.x0 + bounds.x1) / 2;
  const cz = -(bounds.y0 + bounds.y1) / 2;
  const half = Math.max(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0) / 2 + 4;

  useLayoutEffect(() => {
    const l = sun.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half * 0.75;
    cam.bottom = -half * 0.75;
    cam.near = 1;
    cam.far = 160;
    cam.updateProjectionMatrix();
    l.shadow.needsUpdate = true;
  }, [cx, cz, half, settings.shadows, settings.shadowMapSize]);

  return (
    <>
      <Environment files={hdriPath('hospital_room')} environmentIntensity={0.6} />
      <directionalLight
        ref={sun}
        position={[cx - 26, 52, cz + 34]}
        intensity={2.8}
        color="#fff4e6"
        castShadow={settings.shadows}
        shadow-mapSize={[settings.shadowMapSize, settings.shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={3}
      />
      <hemisphereLight args={['#f4f6fa', '#b9b4aa', 0.2]} />
    </>
  );
}
