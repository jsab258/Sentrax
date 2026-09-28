import { BASE_FOV } from './viewInset';
import { Canvas } from '@react-three/fiber';
import { Suspense, type ReactNode } from 'react';
import { AgXToneMapping, Color } from 'three';
import { CameraRig } from './CameraRig';
import { BACKGROUND, BACKGROUND_HDR } from './backdrop';
import { OverlayRoot } from './overlay';
import type { SceneFrameBounds } from './framing';
import { Lighting } from './Lighting';
import type { HdriName } from './materials/textures';
import { PostEffects } from './PostEffects';
import { tierSettings } from './quality';
import { StatsProbe } from './stats';
import { useSceneStore } from './store';

/**
 * The shared 3D canvas: tone mapping, colour space, lighting, camera and post-processing per quality
 * tier. Scene content comes in as children and may suspend while its textures load.
 */
export function SceneCanvas({
  bounds,
  reach,
  hdri = 'hospital_room',
  fog = [110, 220],
  children,
}: {
  bounds: SceneFrameBounds;
  reach?: SceneFrameBounds;
  /** Environment light for the scene (Poly Haven HDRI, ambient and reflections only). */
  hdri?: HdriName;
  /** Fog start and end distance (m): larger scenes push it out. */
  fog?: [number, number];
  children: ReactNode;
}) {
  const tier = useSceneStore((s) => s.tier);
  const settings = tierSettings[tier];
  const usePost = tier !== 'low';
  return (
    <Canvas
      // Native antialiasing only without the composer; the composer multisamples itself. Switching
      // between the two needs a new context, hence the key.
      key={usePost ? 'post' : 'direct'}
      className="scene-canvas"
      shadows={settings.shadows ? 'percentage' : false}
      dpr={settings.dpr}
      gl={{
        antialias: !usePost,
        powerPreference: 'high-performance',
        toneMapping: AgXToneMapping,
        // Lifts AgX's mid-grey rendering of white walls.
        toneMappingExposure: 1.15,
      }}
      camera={{ fov: BASE_FOV, near: 0.3, far: 600, position: [20, 40, 30] }}
      data-testid="scene-canvas"
      data-tier={tier}
    >
      <color attach="background" args={[usePost ? BACKGROUND_HDR : new Color(BACKGROUND)]} />
      <fog attach="fog" args={[usePost ? BACKGROUND_HDR : new Color(BACKGROUND), fog[0], fog[1]]} />
      <Suspense fallback={null}>
        <Lighting bounds={bounds} settings={settings} hdri={hdri} />
      </Suspense>
      <CameraRig bounds={bounds} reach={reach} />
      <OverlayRoot afterComposer={usePost}>
        <Suspense fallback={null}>{children}</Suspense>
      </OverlayRoot>
      {usePost && <PostEffects settings={settings} />}
      <StatsProbe />
    </Canvas>
  );
}
