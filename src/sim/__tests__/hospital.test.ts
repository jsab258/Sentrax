import { describe, expect, it } from 'vitest';
import { Simulation } from '../engine';
import { Navigator } from '../nav';
import { pointInPolygon } from '../geometry';
import { hospitalWorld } from '../scenes/hospital';

describe('hospital scene data (SPEC section 7)', () => {
  const world = hospitalWorld();
  const count = (pred: (x: (typeof world.assets)[number]) => boolean) => world.assets.filter(pred).length;

  it('has the rooms, devices and tags the spec lists', () => {
    for (const n of ['101', '102', '103', '104', '105', '106'])
      expect(world.zones.some((z) => z.id === `r${n}`)).toBe(true);
    for (const id of [
      'icu',
      'icu-bay-a',
      'icu-bay-b',
      'storage',
      'dirty',
      'med',
      'station',
      'corridor',
      'lobby',
    ]) {
      expect(
        world.zones.some((z) => z.id === id),
        id,
      ).toBe(true);
    }
    const anchors = world.devices.filter((d) => d.model === 'NODIX CEN-1');
    for (const room of ['r101', 'r102', 'r103', 'r104', 'r105', 'r106', 'icu', 'storage', 'dirty', 'med']) {
      expect(
        anchors.some((a) => a.roomId === room),
        room,
      ).toBe(true);
    }
    expect(world.devices.filter((d) => d.model === 'ZENIX LEN-1')).toHaveLength(2);
    expect(world.devices.filter((d) => d.model === 'ZENIX LEN-2')).toHaveLength(1);
    expect(world.devices.filter((d) => d.model === 'ZENIX LON-2').length).toBeGreaterThanOrEqual(2);
    expect(count((a) => a.cls === 'infusion_pump')).toBe(8);
    expect(count((a) => a.cls === 'ventilator')).toBe(3);
    expect(count((a) => a.cls === 'wheelchair')).toBe(3);
    expect(count((a) => a.cls === 'crash_cart')).toBe(1);
    expect(count((a) => a.cls === 'mobile_monitor')).toBeGreaterThanOrEqual(1);
    expect(world.tags.filter((t) => t.model === 'PINIX TOB-1' && t.sosButton)).toHaveLength(1);
    expect(world.tags.filter((t) => t.model === 'PINIX TOW-5')).toHaveLength(1);
    const roles = world.agents.map((a) => a.role).sort();
    expect(roles).toEqual(['biomed', 'nurse', 'nurse', 'nurse', 'porter']);
  });

  it('has a connected nav graph and every anchor inside its room', () => {
    const nav = new Navigator(world.nav);
    const reach = nav.reachable('station');
    expect(reach.size).toBe(world.nav.nodes.length);
    for (const a of world.devices.filter((d) => d.roomId)) {
      const room = world.zones.find((z) => z.id === a.roomId);
      expect(room && pointInPolygon(a.position, room.polygon), a.id).toBe(true);
    }
    for (const a of world.assets) {
      const inside = world.zones.some((z) => pointInPolygon(a.position, z.polygon));
      expect(inside, a.id).toBe(true);
    }
  });

  it('runs: BiLink places parked equipment in the right room and AoA covers the ICU', () => {
    const sim = new Simulation(world, { seed: 1 });
    sim.runUntil(60);
    const parked = world.assets.filter(
      (a) => a.cls !== 'fridge' && a.id !== 'crashcart-01' && a.id !== 'wheelchair-03',
    );
    let correct = 0;
    for (const a of parked) {
      const tagId = `tag-${a.id}`;
      const truthRoom = sim.truthRoom(tagId);
      const r = sim.report(tagId);
      const reportedRoom = r?.roomId ?? r?.zoneIds.find((z) => z === truthRoom) ?? null;
      if (reportedRoom === truthRoom) correct++;
    }
    expect(correct / parked.length).toBeGreaterThanOrEqual(0.95);
    // ICU equipment is reported by AoA with coordinates, room equipment by BiLink.
    expect(sim.report('tag-vent-01')?.tech).toBe('aoa');
    expect(sim.report('tag-pump-07')?.tech).toBe('bilink');
    expect(sim.report('tag-pump-07')?.roomId).toBe('r104');
    // Free running for a while raises no alerts.
    sim.runUntil(600);
    expect(sim.rules.activeAlerts()).toEqual([]);
  });
});
