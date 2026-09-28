import { useFrame } from '@react-three/fiber';
import { tickRuntime } from '../experience/runtime';
import { useSceneStore } from './store';

/** Interpolation factor between the last two simulation steps, shared by everything drawn this frame. */
export const simFrame = { alpha: 0 };

/** Largest real-time step fed to the simulation; longer frames (a background tab) are dropped. */
const MAX_FRAME_S = 0.25;

/** Advances the active simulation (story player or sandbox) once per frame, before anything reads it. */
export function SimClock() {
  useFrame((_, delta) => {
    const speed = useSceneStore.getState().speed;
    simFrame.alpha = tickRuntime(Math.min(delta, MAX_FRAME_S), speed);
  }, -50);
  return null;
}
