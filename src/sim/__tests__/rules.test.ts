import { describe, expect, it } from 'vitest';
import { Simulation } from '../engine';
import type { SimEvent } from '../events';
import { vec3 } from '../geometry';
import { dockLayout, parLayout } from '../scenes/testLayouts';

function record(sim: Simulation, types: SimEvent['type'][]): SimEvent[] {
  const out: SimEvent[] = [];
  sim.bus.onAny((e) => {
    if (types.includes(e.type)) out.push(e);
  });
  return out;
}

describe('PAR levels (SPEC section 6)', () => {
  it('fires when the ICU drops below PAR and clears when the ventilator returns', () => {
    const sim = new Simulation(parLayout(), { seed: 3 });
    const events = record(sim, ['alert.raised', 'alert.updated', 'alert.cleared']);
    sim.runUntil(30);
    expect(sim.rules.count('n3', 'ventilator')).toBe(3);
    expect(events.filter((e) => e.type === 'alert.raised')).toHaveLength(0);

    // The porter takes one ventilator from the ICU to room s2.
    sim.command({
      type: 'route',
      agentId: 'porter',
      steps: [
        { to: 'n3-in', pickup: 'vent2' },
        { to: 's2-in', drop: 'vent2' },
      ],
    });
    sim.runUntil(90);
    const raised = events.filter((e) => e.type === 'alert.raised');
    expect(raised).toHaveLength(1);
    const alert = (raised[0] as Extract<SimEvent, { type: 'alert.raised' }>).alert;
    expect(alert.kind).toBe('par');
    expect(alert.data).toMatchObject({ count: 2, min: 3, cls: 'ventilator' });
    expect(sim.rules.activeAlerts()).toHaveLength(1);

    // It is brought back.
    sim.command({
      type: 'route',
      agentId: 'porter',
      steps: [
        { to: 's2-in', pickup: 'vent2' },
        { to: 'n3-in', drop: 'vent2' },
      ],
    });
    sim.runUntil(180);
    expect(events.filter((e) => e.type === 'alert.raised')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'alert.cleared')).toHaveLength(1);
    expect(sim.rules.activeAlerts()).toHaveLength(0);
    expect(sim.rules.count('n3', 'ventilator')).toBe(3);
    // Audit trail keeps the cleared alert with both timestamps.
    const history = sim.rules.alertHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.clearedAt).toBeGreaterThan(history[0]?.startedAt ?? Infinity);
  });
});

describe('Dock door check-out (SPEC section 6)', () => {
  it('fires exactly once per crossing, and check-in once on the way back', () => {
    const sim = new Simulation(dockLayout(), { seed: 4 });
    const events = record(sim, ['gate.checkout', 'gate.checkin']);
    sim.runUntil(20);
    sim.command({
      type: 'route',
      agentId: 'forklift',
      steps: [
        { to: 'hall', pickup: 'pallet' },
        { to: 'dock', dwellS: 6 },
        { to: 'trailer', drop: 'pallet', dwellS: 2 },
      ],
    });
    sim.runUntil(120);
    expect(events.filter((e) => e.type === 'gate.checkout')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'gate.checkin')).toHaveLength(0);

    // Lingering in the trailer for a long time does not produce more events.
    sim.runUntil(300);
    expect(events.filter((e) => e.type === 'gate.checkout')).toHaveLength(1);

    // Bring it back in: one check-in.
    sim.command({
      type: 'route',
      agentId: 'forklift',
      steps: [
        { to: 'trailer', pickup: 'pallet' },
        { to: 'dock', dwellS: 3 },
        { to: 'hall', drop: 'pallet' },
      ],
    });
    sim.runUntil(420);
    expect(events.filter((e) => e.type === 'gate.checkout')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'gate.checkin')).toHaveLength(1);
  });

  it('does not fire when the pallet enters the dock zone and returns to the hall', () => {
    const sim = new Simulation(dockLayout(), { seed: 8 });
    const events = record(sim, ['gate.checkout', 'gate.checkin']);
    sim.runUntil(20);
    sim.command({
      type: 'route',
      agentId: 'forklift',
      steps: [
        { to: 'hall', pickup: 'pallet' },
        { to: 'dock', dwellS: 8 },
        { to: 'hall', drop: 'pallet' },
      ],
    });
    sim.runUntil(200);
    expect(events).toHaveLength(0);
  });

  it.each([1, 2, 3, 4, 5, 6])('is exactly once across seeds (seed %i)', (seed) => {
    const sim = new Simulation(dockLayout(), { seed });
    const events = record(sim, ['gate.checkout']);
    sim.runUntil(15);
    sim.command({
      type: 'route',
      agentId: 'forklift',
      steps: [
        { to: 'hall', pickup: 'pallet' },
        { to: 'trailer', drop: 'pallet' },
      ],
    });
    sim.runUntil(240);
    expect(events).toHaveLength(1);
  });
});

describe('Sensor thresholds, SOS and geofence', () => {
  it('raises a sensor alert after the confirm time and clears it with hysteresis', () => {
    const world = parLayout();
    world.assets.push({ id: 'fridge', cls: 'fridge', position: vec3(3, 5, 0) });
    world.tags.push({
      id: 'tag-fridge',
      model: 'PINIX TOW-5',
      carrier: { type: 'asset', id: 'fridge' },
      mountHeightM: 1.6,
      sensors: ['temperature', 'humidity'],
    });
    world.sensors.push({ id: 'fridge-1', kind: 'fridge', assetId: 'fridge', doorId: 'fridge-door' });
    world.rules.push({
      id: 'fridge-temp',
      type: 'sensor',
      tagId: 'tag-fridge',
      metric: 'temperature',
      max: 8,
    });
    const sim = new Simulation(world, { seed: 2 });
    const events = record(sim, ['alert.raised', 'alert.cleared']);
    sim.runUntil(60);
    expect(events).toHaveLength(0);
    sim.command({ type: 'setDoor', doorId: 'fridge-door', open: true });
    sim.runUntil(300);
    const raised = events.filter((e) => e.type === 'alert.raised' && e.alert.kind === 'sensor');
    expect(raised).toHaveLength(1);
    sim.command({ type: 'setDoor', doorId: 'fridge-door', open: false });
    sim.runUntil(1500);
    expect(events.filter((e) => e.type === 'alert.cleared' && e.alert.kind === 'sensor')).toHaveLength(1);
    expect(sim.reading('tag-fridge', 'temperature')?.value).toBeLessThan(7.5);
  });

  it('raises an SOS alert with the reported room and clears it on acknowledge', () => {
    const world = parLayout();
    world.agents.push({
      id: 'nurse',
      role: 'nurse',
      kind: 'person',
      start: 'c-s4',
      routine: [{ to: 's4-in', dwellS: 1e6 }],
    });
    world.tags.push({
      id: 'tag-sos',
      model: 'PINIX TOB-1',
      carrier: { type: 'agent', id: 'nurse' },
      mountHeightM: 1.0,
      sosButton: true,
    });
    world.rules.push({ id: 'sos', type: 'sos' });
    const sim = new Simulation(world, { seed: 6 });
    const events = record(sim, ['alert.raised', 'alert.cleared', 'button.pressed']);
    sim.runUntil(40);
    sim.command({ type: 'pressButton', tagId: 'tag-sos' });
    sim.step();
    const raised = events.find((e) => e.type === 'alert.raised');
    expect(raised?.type === 'alert.raised' && raised.alert.locationZoneId).toBe('s4');
    const id = raised?.type === 'alert.raised' ? raised.alert.id : '';
    sim.command({ type: 'acknowledge', alertId: id });
    sim.step();
    expect(events.filter((e) => e.type === 'alert.cleared')).toHaveLength(1);
  });

  it('flags an unauthorised entry into a restricted zone and clears it on exit', () => {
    const world = parLayout();
    world.rules.push({ id: 'cage', type: 'geofence', zoneId: 's1', appliesTo: ['porter'] });
    const sim = new Simulation(world, { seed: 9 });
    const events = record(sim, ['alert.raised', 'alert.cleared']);
    sim.runUntil(10);
    sim.command({ type: 'route', agentId: 'porter', steps: [{ to: 's1-in', dwellS: 30 }, { to: 'c-n3' }] });
    sim.runUntil(120);
    const geo = events.filter(
      (e) => (e.type === 'alert.raised' || e.type === 'alert.cleared') && e.alert.kind === 'geofence',
    );
    expect(geo.map((e) => e.type)).toEqual(['alert.raised', 'alert.cleared']);
  });
});

describe('Determinism (SPEC section 6)', () => {
  it('produces identical event streams for the same seed', () => {
    const run = (seed: number) => {
      const sim = new Simulation(parLayout(), { seed });
      const log: string[] = [];
      sim.bus.onAny((e) => log.push(JSON.stringify(e)));
      sim.command({
        type: 'route',
        agentId: 'porter',
        steps: [
          { to: 'n3-in', pickup: 'vent1' },
          { to: 's5-in', drop: 'vent1' },
        ],
      });
      sim.runUntil(120);
      return log;
    };
    const a = run(42);
    expect(a.length).toBeGreaterThan(20);
    expect(run(42)).toEqual(a);
    expect(run(43)).not.toEqual(a);
  });

  it('advance() runs whole fixed steps and returns an interpolation factor', () => {
    const sim = new Simulation(parLayout(), { seed: 1 });
    const alpha = sim.advance(0.25);
    expect(sim.steps).toBe(2);
    expect(alpha).toBeCloseTo(0.5, 5);
    expect(sim.time).toBeCloseTo(0.2, 9);
  });
});
