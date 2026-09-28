import type { Simulation } from '../sim/engine';

/**
 * Recent sensor readings per tag and metric, for the live temperature chart. One history per simulation,
 * filled from the event bus.
 */
const histories = new WeakMap<Simulation, Map<string, Array<{ t: number; v: number }>>>();

export function sensorHistory(
  sim: Simulation,
  tagId: string,
  metric = 'temperature',
): Array<{ t: number; v: number }> {
  let map = histories.get(sim);
  if (!map) {
    const m = new Map<string, Array<{ t: number; v: number }>>();
    map = m;
    histories.set(sim, m);
    sim.bus.on('sensor.reading', (e) => {
      const key = `${e.tagId}|${e.metric}`;
      const list = m.get(key) ?? [];
      list.push({ t: e.t, v: e.value });
      if (list.length > 400) list.splice(0, list.length - 400);
      m.set(key, list);
    });
    // Seed with the current reading so the chart starts at once.
    const r = sim.reading(tagId, 'temperature');
    if (r) m.set(`${tagId}|temperature`, [{ t: sim.time, v: r.value }]);
  }
  return map.get(`${tagId}|${metric}`) ?? [];
}
