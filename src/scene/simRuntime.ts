import { useFrame } from '@react-three/fiber';
import { createPrerolledSimulation } from '../sim/prewarm';
import type { Simulation } from '../sim/engine';
import { hospitalWorld } from '../sim/scenes/hospital';
import { useSceneStore } from './store';

/**
 * One simulation per scene, created on first use and kept across canvas remounts (for example a quality
 * tier change). Creation runs the 30 s pre-roll synchronously, so the first rendered frame already shows
 * a settled scene: every tag located, no warm-up alerts, an empty event log.
 */

export type SceneId = 'hospital';

/** Fixed seeds, so every visitor sees the same ambient scene. */
export const SCENE_SEEDS: Record<SceneId, number> = { hospital: 1101 };

const factories: Record<SceneId, () => Simulation> = {
  hospital: () => createPrerolledSimulation(hospitalWorld(), { seed: SCENE_SEEDS.hospital }),
};

const cache = new Map<SceneId, Simulation>();

export function getSimulation(id: SceneId): Simulation {
  let sim = cache.get(id);
  if (!sim) {
    sim = factories[id]();
    cache.set(id, sim);
  }
  return sim;
}

/** Interpolation factor between the last two simulation steps, shared by everything drawn this frame. */
export const simFrame = { alpha: 0 };

/** Largest real-time step fed to the simulation; longer frames (a background tab) are dropped. */
const MAX_FRAME_S = 0.25;

/** Advances the simulation once per frame, before anything reads positions. */
export function SimClock({ sim }: { sim: Simulation }) {
  useFrame((_, delta) => {
    const speed = useSceneStore.getState().speed;
    simFrame.alpha = sim.advance(Math.min(delta, MAX_FRAME_S) * speed);
  }, -50);
  return null;
}
