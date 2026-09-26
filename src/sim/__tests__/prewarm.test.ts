import { describe, expect, it } from 'vitest';
import { createPrerolledSimulation } from '../prewarm';
import { hospitalWorld } from '../scenes/hospital';
import { warehouseWorld } from '../scenes/warehouse';

describe('pre-roll (M1 review item 6)', () => {
  it.each([
    ['hospital', hospitalWorld],
    ['warehouse', warehouseWorld],
  ] as const)('%s starts with every tag located, no alerts and an empty event log', (_, world) => {
    const sim = createPrerolledSimulation(world(), { seed: 1 });
    expect(sim.time).toBeGreaterThanOrEqual(sim.cfg.preRollS - 1e-9);
    expect(sim.cfg.preRollS).toBeGreaterThanOrEqual(sim.cfg.rules.warmupS);
    for (const id of sim.tagIds()) expect(sim.report(id), id).toBeDefined();
    expect(sim.rules.activeAlerts()).toEqual([]);
    expect(sim.bus.recent()).toEqual([]);
  });
});
