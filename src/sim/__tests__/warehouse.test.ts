import { describe, expect, it } from 'vitest';
import { Simulation } from '../engine';
import { dist2 } from '../geometry';
import { Navigator } from '../nav';
import { slotPosition, warehouseWorld } from '../scenes/warehouse';

describe('warehouse scene data (SPEC section 8)', () => {
  const world = warehouseWorld();

  it('has the areas, devices and agents the spec lists', () => {
    for (const id of [
      'receiving',
      'dock-1',
      'dock-2',
      'dock-3',
      'racking',
      'aisle-A',
      'aisle-D',
      'staging',
      'production',
      'buffer',
      'station-1',
      'station-2',
      'station-3',
      'cold',
      'cage',
      'office',
      'yard',
      'muster',
    ]) {
      expect(
        world.zones.some((z) => z.id === id),
        id,
      ).toBe(true);
    }
    expect(world.devices.filter((d) => d.model === 'ZENIX LEF-3')).toHaveLength(1);
    expect(
      world.devices
        .filter((d) => d.model === 'NODIX CEN-1')
        .map((d) => d.roomId)
        .sort(),
    ).toEqual(['cold-entry', 'dock-1', 'dock-2', 'dock-3', 'muster']);
    expect(world.devices.filter((d) => d.model === 'ZENIX LON-2').length).toBeGreaterThanOrEqual(12);
    const roles = world.agents.map((a) => a.role);
    expect(roles.filter((r) => r === 'forklift')).toHaveLength(3);
    expect(roles.filter((r) => r === 'forklift_driver')).toHaveLength(3);
    expect(roles.filter((r) => r === 'picker')).toHaveLength(4);
    expect(roles.filter((r) => r === 'assembly')).toHaveLength(2);
    expect(roles.filter((r) => r === 'yard_tractor')).toHaveLength(1);
    expect(world.assets.find((a) => a.id === 'pallet-2291')?.slot).toEqual({ aisle: 'C', bay: 14, level: 4 });
  });

  it('gives RSSI a typical error in the 3 to 5 m band across the hall', () => {
    const sim = new Simulation(world, { seed: 3 });
    sim.runUntil(30);
    const errors: number[] = [];
    while (sim.time < 150) {
      sim.step();
      if (sim.steps % 5) continue;
      for (const id of sim.tagIds()) {
        const truth = sim.truth(id);
        const e = sim.estimate(id, 'rssi');
        if (e?.position && truth.y > 0 && truth.z < 3) errors.push(dist2(e.position, truth));
      }
    }
    errors.sort((a, b) => a - b);
    const med = errors[Math.floor(errors.length / 2)] ?? NaN;
    console.info(
      `Warehouse RSSI (tags below 3 m, inside the hall): median ${med.toFixed(2)} m, n=${errors.length}`,
    );
    expect(med).toBeGreaterThanOrEqual(2.5);
    expect(med).toBeLessThanOrEqual(5.5);
  });

  it('covers every rack level, including level 5, with AoA', () => {
    const sim = new Simulation(world, { seed: 5 });
    sim.runUntil(30);
    const racked = world.assets.filter((a) => a.slot);
    const byLevel = new Map<number, { aoa: number; n: number }>();
    while (sim.time < 120) {
      sim.step();
      if (sim.steps % 5) continue;
      for (const a of racked) {
        const level = a.slot?.level ?? 0;
        const s = byLevel.get(level) ?? { aoa: 0, n: 0 };
        s.n++;
        if (sim.report(`tag-${a.id}`)?.tech === 'aoa') s.aoa++;
        byLevel.set(level, s);
      }
    }
    for (const level of [1, 2, 3, 4, 5]) {
      const s = byLevel.get(level);
      if (!s) continue;
      expect(s.aoa / s.n, `level ${level}`).toBe(1);
    }
    expect(byLevel.has(5)).toBe(true);
  });

  it('has a connected nav graph', () => {
    const nav = new Navigator(world.nav);
    expect(nav.reachable('staging-1').size).toBe(world.nav.nodes.length);
  });

  it('runs: AoA finds PL-2291 at its rack slot (level included) and nothing alarms at rest', () => {
    const sim = new Simulation(world, { seed: 2 });
    sim.runUntil(60);
    const r = sim.report('tag-pallet-2291');
    expect(r?.tech).toBe('aoa');
    const truth = slotPosition({ aisle: 'C', bay: 14, level: 4 });
    expect(r?.position && dist2(r.position, truth)).toBeLessThan(1);
    expect(r?.position && Math.abs(r.position.z - (truth.z + 0.9))).toBeLessThan(0.9);
    sim.runUntil(300);
    const unexpected = sim.rules
      .activeAlerts()
      .filter((a) => a.kind !== 'dwell' || !String(a.tagId).startsWith('tag-wip'));
    expect(unexpected).toEqual([]);
  });
  it('marks single-gateway RSSI fixes as proximity: docked trailers are only near the yard gateway', () => {
    const sim = new Simulation(world, { seed: 2 });
    sim.runUntil(60);
    const lef3 = world.devices.find((d) => d.id === 'lef3-yard');
    const r = sim.report('tag-trailer-02');
    expect(r?.tech).toBe('rssi');
    expect(r?.proximity).toBe(true);
    // The fix is the gateway itself, not where the trailer stands (the label goes on the trailer).
    expect(r?.position && lef3 && dist2(r.position, lef3.position)).toBeLessThan(0.01);
    // Pallets in the racks have real AoA fixes, never proximity.
    expect(sim.report('tag-pallet-2291')?.proximity).toBeUndefined();
  });
});
