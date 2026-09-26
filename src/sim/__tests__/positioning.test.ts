import { describe, expect, it } from 'vitest';
import { Simulation } from '../engine';
import { dist2, median, percentile } from '../geometry';
import { aoaArea, bilinkRooms, rssiHall, withBilinkProbeTags } from '../scenes/testLayouts';

/** Collects per-sample horizontal errors of one technology against ground truth. */
function collectErrors(
  sim: Simulation,
  tech: 'rssi' | 'aoa',
  fromS: number,
  toS: number,
  filter?: (tagId: string) => boolean,
) {
  const errors: number[] = [];
  sim.runUntil(fromS);
  while (sim.time < toS) {
    sim.step();
    if (sim.steps % 5) continue;
    for (const tagId of sim.tagIds()) {
      if (filter && !filter(tagId)) continue;
      const e = sim.estimate(tagId, tech);
      if (!e?.position) continue;
      errors.push(dist2(e.position, sim.truth(tagId)));
    }
  }
  return errors;
}

describe('RSSI positioning (SPEC section 6)', () => {
  it.each([1, 2, 3])('typical error falls in the 3 to 5 m band (seed %i)', (seed) => {
    const sim = new Simulation(rssiHall(seed), { seed });
    const errors = collectErrors(sim, 'rssi', 20, 200);
    const med = median(errors);
    const p90 = percentile(errors, 90);
    console.info(
      `RSSI seed ${seed}: median ${med.toFixed(2)} m, p90 ${p90.toFixed(2)} m, n=${errors.length}`,
    );
    expect(errors.length).toBeGreaterThan(1000);
    expect(med).toBeGreaterThanOrEqual(3);
    expect(med).toBeLessThanOrEqual(5);
    expect(p90).toBeLessThan(10);
  });
});

describe('AoA positioning (SPEC section 6)', () => {
  it.each([
    [1, 4],
    [2, 4],
    [3, 11],
  ])('median error is below 1 m inside coverage (seed %i, ceiling %i m)', (seed, ceiling) => {
    const sim = new Simulation(aoaArea(seed, ceiling), { seed });
    const inside = (tagId: string) => {
      const p = sim.truth(tagId);
      return p.x >= 9 && p.x <= 21 && p.y >= 9 && p.y <= 21;
    };
    const errors = collectErrors(sim, 'aoa', 10, 150, inside);
    const med = median(errors);
    console.info(
      `AoA seed ${seed} ceiling ${ceiling} m: median ${med.toFixed(2)} m, p90 ${percentile(errors, 90).toFixed(2)} m, n=${errors.length}`,
    );
    expect(errors.length).toBeGreaterThan(1000);
    expect(med).toBeLessThan(1);
  });
});

describe('BiLink room assignment (SPEC section 6)', () => {
  it.each([1, 2, 3])(
    'assigns the correct room in at least 95 percent of steady-state samples (seed %i)',
    (seed) => {
      const sim = new Simulation(withBilinkProbeTags(bilinkRooms()), { seed });
      sim.runUntil(15);
      let correct = 0;
      let total = 0;
      while (sim.time < 300) {
        sim.step();
        for (const tagId of sim.tagIds()) {
          const truth = sim.truthRoom(tagId);
          const expected = truth === 'corridor' ? null : truth;
          const got = sim.estimate(tagId, 'bilink')?.roomId ?? null;
          total++;
          if (got === expected) correct++;
        }
      }
      const share = correct / total;
      console.info(`BiLink seed ${seed}: ${(share * 100).toFixed(2)} percent correct of ${total} samples`);
      expect(share).toBeGreaterThanOrEqual(0.95);
    },
  );

  it('never changes a room assignment faster than the minimum dwell, and handles room-to-room walks', () => {
    const world = bilinkRooms();
    world.agents.push({
      id: 'nurse',
      role: 'nurse',
      kind: 'person',
      start: 'c-n1',
      loop: true,
      routine: [
        { to: 'n1-in', dwellS: 20 },
        { to: 'n2-in', dwellS: 15 },
        { to: 's3-in', dwellS: 25 },
        { to: 'n4-in', dwellS: 10 },
        { to: 's5-in', dwellS: 20 },
        { to: 'c-n3', dwellS: 5 },
      ],
    });
    world.tags.push({
      id: 'tag-nurse',
      model: 'PINIX TOK-1',
      carrier: { type: 'agent', id: 'nurse' },
      mountHeightM: 1.3,
    });
    const sim = new Simulation(world, { seed: 5 });
    const changes: Array<{ t: number; room: string | null }> = [];
    sim.bus.on('position.room', (e) => {
      if (e.tagId === 'tag-nurse') changes.push({ t: e.t, room: e.roomId });
    });
    sim.runUntil(600);
    const minDwell = sim.cfg.bilink.minDwellS;
    for (let i = 1; i < changes.length; i++) {
      expect((changes[i] as { t: number }).t - (changes[i - 1] as { t: number }).t).toBeGreaterThanOrEqual(
        minDwell - 1e-9,
      );
    }
    const visited = new Set(changes.map((c) => c.room));
    console.info(`BiLink walk: ${changes.length} room changes, rooms ${[...visited].join(', ')}`);
    for (const room of ['n1', 'n2', 's3', 'n4', 's5']) expect(visited.has(room)).toBe(true);
    // No hallway bleed: walking past (and pausing in front of) other rooms' open doors never assigns them.
    for (const room of visited) expect([null, 'n1', 'n2', 's3', 'n4', 's5']).toContain(room);
  });
});
