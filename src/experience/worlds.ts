import { hospitalWorld } from '../sim/scenes/hospital';
import type { WorldDef } from '../sim/world';
import type { SceneKey } from './types';

/** One base world per scene, built once: static geometry and story worlds derive from it. */
const cache = new Map<SceneKey, WorldDef>();
const factories: Partial<Record<SceneKey, () => WorldDef>> = { hospital: hospitalWorld };

export function baseWorld(scene: SceneKey): WorldDef {
  let w = cache.get(scene);
  if (!w) {
    const f = factories[scene];
    if (!f) throw new Error(`scene ${scene} is not available yet`);
    w = f();
    cache.set(scene, w);
  }
  return w;
}

export function sceneAvailable(scene: SceneKey): boolean {
  return factories[scene] !== undefined;
}
