import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../sim/events';
import { createPrerolledSimulation } from '../../sim/prewarm';
import { cameraPresets, triggers } from '../triggers';
import { baseWorld } from '../worlds';
import type { SceneKey } from '../types';

/** Explore mode triggers do what their labels say, on the explore simulation's own seed. */
const SEEDS: Record<SceneKey, number> = { hospital: 1101, warehouse: 2201 };

function fire(scene: SceneKey, id: string, seconds: number) {
  const sim = createPrerolledSimulation(baseWorld(scene), { seed: SEEDS[scene] });
  const events: SimEvent[] = [];
  sim.bus.onAny((e) => events.push(e));
  const t = triggers[scene].find((x) => x.id === id);
  if (!t) throw new Error(`no trigger ${id}`);
  t.run(sim);
  const end = sim.time + seconds;
  while (sim.time < end) sim.step();
  return { sim, events };
}

const raised = (events: SimEvent[], ruleId: string) =>
  events.some((e) => e.type === 'alert.raised' && e.alert.ruleId === ruleId);

describe('explore mode triggers', () => {
  it('hospital: a ventilator taken out of the ICU drops it below PAR', () => {
    expect(raised(fire('hospital', 'ventilatorOut', 120).events, 'par-icu-ventilators')).toBe(true);
  });
  it('hospital: a fridge door left open raises the temperature alert', () => {
    expect(raised(fire('hospital', 'fridgeOpen', 150).events, 'fridge-temperature')).toBe(true);
  });
  it('hospital: SOS in room 105', () => {
    const { sim, events } = fire('hospital', 'sos', 60);
    expect(raised(events, 'sos')).toBe(true);
    expect(sim.rules.activeAlerts().find((a) => a.ruleId === 'sos')?.locationZoneId).toBe('r105');
  });
  it('warehouse: loading PL-2291 at dock door 2 checks it out', () => {
    const { events } = fire('warehouse', 'loadPallet', 200);
    expect(events.some((e) => e.type === 'gate.checkout' && e.tagId === 'tag-pallet-2291')).toBe(true);
  });
  it('warehouse: a picker in the battery cage raises the zone alert', () => {
    expect(raised(fire('warehouse', 'cage', 120).events, 'cage')).toBe(true);
  });
  it('warehouse: an evacuation drill brings everyone to the muster point', () => {
    const { sim } = fire('warehouse', 'evacuation', 240);
    const s = sim.rules.musterStatus('muster');
    expect(s.present).toBe(s.total);
  });
  it('warehouse: a cold pallet left in staging raises the cold chain alert', () => {
    expect(raised(fire('warehouse', 'coldPallet', 420).events, 'cold-chain')).toBe(true);
  });
  it('every scene has camera presets and every preset names known zones', () => {
    for (const scene of ['hospital', 'warehouse'] as const) {
      const zones = new Set(baseWorld(scene).zones.map((z) => z.id));
      for (const p of cameraPresets[scene])
        for (const z of p.shot.zones ?? [p.shot.zone])
          expect(zones.has(z ?? ''), `${scene} ${p.id} ${z}`).toBe(true);
    }
  });
});
