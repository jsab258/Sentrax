import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Scene } from 'three';
import { overlayUniforms } from './overlays/primitives';

/**
 * Overlay pass for markers and the Radio, Data and Insight layers. It renders after the composer and its
 * tone mapping, straight to the screen, so overlay colours stay exactly the brand-derived values.
 *
 * Depth (DECISIONS.md 70): the pass first writes the depth of the occluders (walls, doors and large
 * furniture, registered with <Occluder>) without colour, then draws every overlay twice: at full opacity
 * where it is in front, at 35 percent where scene geometry hides it. Device markers skip the depth test and
 * stay fully visible.
 */
interface OverlayScenes {
  overlay: Scene;
  occluders: Scene;
}

const OverlayContext = createContext<OverlayScenes | null>(null);

export function OverlayRoot({ afterComposer, children }: { afterComposer: boolean; children: ReactNode }) {
  const scenes = useMemo<OverlayScenes>(() => ({ overlay: new Scene(), occluders: new Scene() }), []);
  const size = useThree((s) => s.size);
  useFrame(
    ({ gl, scene, camera }) => {
      overlayUniforms.uViewport.value.set(size.width, size.height);
      // Without a composer this pass owns rendering (a positive priority disables R3F's own render).
      if (!afterComposer) gl.render(scene, camera);
      const autoClear = gl.autoClear;
      gl.autoClear = false;
      gl.clearDepth();
      gl.render(scenes.occluders, camera);
      gl.render(scenes.overlay, camera);
      gl.autoClear = autoClear;
    },
    afterComposer ? 2 : 1,
  );
  return <OverlayContext.Provider value={scenes}>{children}</OverlayContext.Provider>;
}

/** Puts its children into the overlay scene. */
export function Overlay({ children }: { children: ReactNode }) {
  const scenes = useContext(OverlayContext);
  if (!scenes) return null;
  return <>{createPortal(children, scenes.overlay)}</>;
}

/** Puts its children into the occluder scene (depth only; give them a colorWrite: false material). */
export function Occluder({ children }: { children: ReactNode }) {
  const scenes = useContext(OverlayContext);
  if (!scenes) return null;
  return <>{createPortal(children, scenes.occluders)}</>;
}
