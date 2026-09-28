import { create } from 'zustand';
import { detectTier, parseTier, readGpuHints, type QualityTier } from './quality';

const STORAGE_KEY = 'sentrax-demo-quality';

function storedOverride(): QualityTier | null {
  try {
    return parseTier(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function urlOverride(): QualityTier | null {
  try {
    return parseTier(new URLSearchParams(window.location.search).get('quality'));
  } catch {
    return null;
  }
}

interface SceneState {
  /** Auto-detected tier. */
  detected: QualityTier;
  /** Manual override (URL ?quality= or the quality menu), or null for auto. */
  override: QualityTier | null;
  tier: QualityTier;
  setOverride: (t: QualityTier | null) => void;
  /** Simulation playback speed (0 = paused). */
  speed: number;
  setSpeed: (s: number) => void;
  /** True once the current scene has rendered its first complete frame. */
  ready: boolean;
  setReady: (r: boolean) => void;
  /** Stage area covered by UI panels (CSS px): the camera centres shots in the rest. */
  insets: ViewInsets;
  setInsets: (i: ViewInsets) => void;
}

export interface ViewInsets {
  right: number;
  bottom: number;
}

export const useSceneStore = create<SceneState>((set) => {
  const detected = detectTier(readGpuHints());
  const override = urlOverride() ?? storedOverride();
  return {
    detected,
    override,
    tier: override ?? detected,
    setOverride: (t) => {
      try {
        if (t) window.localStorage.setItem(STORAGE_KEY, t);
        else window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Per-viewer convenience only.
      }
      set((s) => ({ override: t, tier: t ?? s.detected }));
    },
    speed: 1,
    setSpeed: (speed) => set({ speed }),
    ready: false,
    setReady: (ready) => set({ ready }),
    insets: { right: 0, bottom: 0 },
    setInsets: (insets) =>
      set((s) => (s.insets.right === insets.right && s.insets.bottom === insets.bottom ? s : { insets })),
  };
});
