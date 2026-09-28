import type { AlertInfo } from '../sim/events';
import type { Simulation } from '../sim/engine';

/** Active alerts plus the most recently cleared ones (with their audit trail), per simulation. */
const feeds = new WeakMap<Simulation, Map<string, AlertInfo>>();

export function alertFeed(sim: Simulation): AlertInfo[] {
  let m = feeds.get(sim);
  if (!m) {
    const map = new Map<string, AlertInfo>();
    m = map;
    feeds.set(sim, map);
    for (const a of sim.rules.activeAlerts()) map.set(a.id, a);
    const keep = (a: AlertInfo) => {
      map.set(a.id, a);
      if (map.size > 12) {
        const oldest = [...map.values()]
          .filter((x) => x.clearedAt !== undefined)
          .sort((x, y) => (x.clearedAt ?? 0) - (y.clearedAt ?? 0))[0];
        if (oldest) map.delete(oldest.id);
      }
    };
    sim.bus.on('alert.raised', (e) => keep(e.alert));
    sim.bus.on('alert.updated', (e) => keep(e.alert));
    sim.bus.on('alert.acknowledged', (e) => keep(e.alert));
    sim.bus.on('alert.cleared', (e) => keep(e.alert));
  }
  return [...m.values()].sort(
    (a, b) =>
      (a.clearedAt !== undefined ? 1 : 0) - (b.clearedAt !== undefined ? 1 : 0) || b.startedAt - a.startedAt,
  );
}
