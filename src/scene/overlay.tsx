import { createPortal, useFrame } from '@react-three/fiber';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Scene } from 'three';

/**
 * Overlay pass for markers and (from M3) the Radio, Data and Insight layers. It renders after the
 * composer and its tone mapping, straight to the screen, so overlay colours stay exactly the brand-derived
 * values from brand.ts. Overlays draw on top of the scene (no depth test against it), which also keeps
 * ceiling devices and data visible in the dollhouse view.
 */
const OverlayContext = createContext<Scene | null>(null);

export function OverlayRoot({ afterComposer, children }: { afterComposer: boolean; children: ReactNode }) {
  const overlay = useMemo(() => new Scene(), []);
  useFrame(
    ({ gl, scene, camera }) => {
      // Without a composer this pass owns rendering (a positive priority disables R3F's own render).
      if (!afterComposer) gl.render(scene, camera);
      const autoClear = gl.autoClear;
      gl.autoClear = false;
      gl.clearDepth();
      gl.render(overlay, camera);
      gl.autoClear = autoClear;
    },
    afterComposer ? 2 : 1,
  );
  return <OverlayContext.Provider value={overlay}>{children}</OverlayContext.Provider>;
}

/** Puts its children into the overlay scene. */
export function Overlay({ children }: { children: ReactNode }) {
  const overlay = useContext(OverlayContext);
  if (!overlay) return null;
  return <>{createPortal(children, overlay)}</>;
}
