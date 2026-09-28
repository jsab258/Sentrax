import { vec3 } from '../../sim/geometry';
import type { Simulation } from '../../sim/engine';
import type { WorldDef } from '../../sim/world';
import type { StoryDef } from '../types';
import { is, stillAgents } from './helpers';

/**
 * Warehouse and manufacturing guided stories (SPEC section 8). Content lives in src/content/stories.ts
 * under the same keys. Each story has a fixed seed and a test asserting the exact events it produces
 * (src/experience/__tests__/warehouseStories.test.ts).
 */

/** Everyone parked or standing at a post; only the story moves people and vehicles. */
const calmHall = {
  // Parked away from the dock doors, so no dock anchor hears a standing forklift.
  'forklift-1': 'ls-33',
  'forklift-2': 'staging-2',
  'forklift-3': 'ls-55',
  'driver-1': 'ls-33',
  'driver-2': 'staging-2',
  'driver-3': 'ls-55',
  'picker-1': 'staging-1',
  'picker-2': 'staging-2',
  'picker-3': 'ln-46',
  'picker-4': 'ln-61',
  'assembly-1': 'station-1',
  'assembly-2': 'station-3',
  'yard-tractor': 'yard-2',
};

/** Moves an asset in the starting state (story set-up only). */
function placeAsset(w: WorldDef, id: string, x: number, y: number, z = 0): WorldDef {
  const a = w.assets.find((x2) => x2.id === id);
  if (a) {
    a.position = vec3(x, y, z);
    delete a.slot;
  }
  return w;
}

export const w1: StoryDef = {
  id: 'w1',
  scene: 'warehouse',
  seed: 201,
  world: (base) => stillAgents(base, calmHall),
  steps: [
    {
      key: 'search',
      camera: { zones: ['aisle-A', 'aisle-B', 'aisle-C'] },
      focus: ['tag-picker-1'],
      speed: 4,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'picker-1',
          steps: [
            { to: 'aisle-A-6', dwellS: 4 },
            { to: 'aisle-A-w' },
            { to: 'aisle-B-6', dwellS: 4 },
            { to: 'aisle-B-w' },
            { to: 'aisle-C-3', dwellS: 4 },
          ],
        }),
      until: { event: is.arrived('picker-1', 'aisle-C-3'), plusS: 3, maxS: 240 },
      ui: { stopwatch: true },
    },
    {
      key: 'located',
      camera: { zone: 'aisle-C' },
      layers: { radio: true, insight: true },
      lens: 'aoa',
      focus: ['tag-pallet-2291'],
      highlight: ['pallet-2291'],
      until: { minS: 10, maxS: 12 },
      ui: { search: 'PL-2291', panel: 'assets', slot: 'pallet-2291' },
    },
    {
      key: 'dispatch',
      camera: { zones: ['aisle-C', 'staging'] },
      layers: { radio: true, insight: true },
      lens: 'aoa',
      focus: ['tag-pallet-2291'],
      highlight: ['forklift-2'],
      speed: 1.5,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'forklift-2',
          steps: [
            { to: 'aisle-C-7', pickup: 'pallet-2291', dwellS: 12 },
            { to: 'staging-2', drop: 'pallet-2291', dwellS: 600 },
          ],
        }),
      until: { event: is.arrived('forklift-2', 'staging-2'), plusS: 3, maxS: 180 },
      ui: { search: 'PL-2291', panel: 'assets' },
    },
  ],
};

export const w2: StoryDef = {
  id: 'w2',
  scene: 'warehouse',
  seed: 202,
  world: (base) =>
    placeAsset(
      stillAgents(base, { ...calmHall, 'forklift-1': 'ls-15', 'driver-1': 'ls-15' }),
      'pallet-2401',
      15,
      9.4,
    ),
  steps: [
    {
      key: 'checkout',
      camera: { zones: ['dock-2', 'trailer-dock-2'] },
      layers: { data: true, insight: true },
      focus: ['tag-pallet-2401'],
      highlight: ['pallet-2401', 'cen-dock-2'],
      speed: 1.5,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'forklift-1',
          steps: [
            { to: 'ls-15', pickup: 'pallet-2401', dwellS: 3 },
            { to: 'dock-2', dwellS: 2 },
            { to: 'trailer-2', drop: 'pallet-2401', dropAt: vec3(15, -9.5, 0), dwellS: 4 },
            { to: 'dock-2', reverse: true },
            { to: 'ls-15', dwellS: 600 },
          ],
        }),
      until: {
        event: (e) => e.type === 'gate.checkout' && e.tagId === 'tag-pallet-2401',
        plusS: 6,
        maxS: 180,
      },
    },
    {
      key: 'yard',
      camera: { zones: ['trailer-dock-2', 'yard'] },
      layers: { radio: true, data: true, insight: true },
      lens: 'rssi',
      focus: ['tag-trailer-02'],
      highlight: ['trailer-02', 'lef3-yard'],
      speed: 2,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'yard-tractor',
          steps: [
            { to: 'yard-1' },
            { to: 'approach-2' },
            { to: 'couple-2', reverse: true, pickup: 'trailer-02', dwellS: 4 },
            { to: 'approach-2' },
            { to: 'yard-lane-w' },
            { to: 'park-a', drop: 'trailer-02', dwellS: 600 },
          ],
        }),
      until: { event: is.arrived('yard-tractor', 'park-a'), plusS: 5, maxS: 240 },
    },
  ],
};

export const w3: StoryDef = {
  id: 'w3',
  scene: 'warehouse',
  seed: 203,
  world: (base) => stillAgents(base, { ...calmHall, 'assembly-1': 'buffer-w' }),
  steps: [
    {
      key: 'flow',
      camera: { zones: ['station-1', 'station-2', 'station-3', 'buffer'] },
      layers: { insight: true },
      focus: ['tag-wip-01'],
      highlight: ['wip-01'],
      speed: 6,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'assembly-1',
          steps: [
            { to: 'buffer-w', pickup: 'wip-01', dwellS: 4 },
            { to: 'station-1', dwellS: 60 },
            { to: 'station-2', dwellS: 1e6 },
          ],
        }),
      until: { event: is.arrived('assembly-1', 'station-2'), plusS: 10, maxS: 300 },
      ui: { panel: 'assets', stations: true },
    },
    {
      key: 'bottleneck',
      camera: { zones: ['station-1', 'station-2', 'station-3'], network: true },
      layers: { data: true, insight: true },
      focus: ['tag-wip-01'],
      highlight: ['wip-01'],
      speed: 8,
      until: { event: is.alertRaised('dwell-station-2'), plusS: 8, maxS: 400 },
      ui: { panel: 'alerts', stations: true, heatmap: true },
    },
    {
      key: 'released',
      camera: { zones: ['station-2', 'station-3'] },
      layers: { data: true, insight: true },
      focus: ['tag-wip-01'],
      speed: 3,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'assembly-1',
          steps: [{ to: 'station-3', dwellS: 1e6 }],
          replace: true,
        }),
      until: { event: is.alertCleared('dwell-station-2'), plusS: 5, maxS: 120 },
      ui: { panel: 'alerts', stations: true },
    },
  ],
};

export const w4: StoryDef = {
  id: 'w4',
  scene: 'warehouse',
  seed: 204,
  world: (base) => stillAgents(base, calmHall),
  steps: [
    {
      key: 'cage',
      camera: { zones: ['cage', 'receiving'] },
      layers: { insight: true, data: true },
      focus: ['tag-picker-1'],
      highlight: ['cage'],
      speed: 2,
      enter: (sim) =>
        sim.command({ type: 'route', agentId: 'picker-1', steps: [{ to: 'cage', dwellS: 1e6 }] }),
      until: { event: is.alertRaised('cage'), plusS: 12, maxS: 120 },
      ui: { panel: 'alerts' },
    },
    {
      key: 'leaves',
      camera: { zones: ['cage', 'receiving'] },
      layers: { insight: true, data: true },
      focus: ['tag-picker-1'],
      speed: 2,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'picker-1',
          steps: [{ to: 'ls-24', dwellS: 1e6 }],
          replace: true,
        }),
      until: { event: is.alertCleared('cage'), plusS: 3, maxS: 90 },
      ui: { panel: 'alerts' },
    },
    {
      key: 'drill',
      camera: { zones: ['hall', 'muster'] },
      layers: { insight: true },
      speed: 4,
      enter: (sim) => startDrill(sim, 'assembly-2'),
      until: { check: musterBut('assembly-2'), plusS: 4, maxS: 300 },
      ui: { panel: 'alerts', muster: true },
    },
    {
      key: 'located',
      camera: { zones: ['production', 'muster'] },
      layers: { insight: true },
      focus: ['tag-assembly-2'],
      highlight: ['assembly-2'],
      speed: 4,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'assembly-2',
          steps: [{ to: 'muster', dwellS: 1e6 }],
          replace: true,
        }),
      until: { check: musterComplete, plusS: 4, maxS: 300 },
      ui: { panel: 'alerts', muster: true },
    },
  ],
};

/** Evacuation drill: everyone dismounts and walks to the muster point, except one who stays behind. */
function startDrill(sim: Simulation, straggler: string): void {
  for (const a of sim.agents.agents.values()) {
    if (a.kind !== 'person') continue;
    sim.command({ type: 'dismount', agentId: a.id });
    if (a.id === straggler) continue;
    sim.command({ type: 'route', agentId: a.id, steps: [{ to: 'muster', dwellS: 1e6 }], replace: true });
  }
}

/** Everyone is at the muster point except the straggler. */
function musterBut(straggler: string) {
  return (sim: Simulation) => {
    const s = sim.rules.musterStatus('muster');
    return s.missing.length === 1 && s.missing[0] === `tag-${straggler}`;
  };
}

function musterComplete(sim: Simulation): boolean {
  const s = sim.rules.musterStatus('muster');
  return s.total > 0 && s.present === s.total;
}

export const w5: StoryDef = {
  id: 'w5',
  scene: 'warehouse',
  seed: 205,
  world: (base) =>
    placeAsset(
      stillAgents(base, { ...calmHall, 'forklift-3': 'dock-3', 'driver-3': 'dock-3' }),
      'cold-pallet-04',
      24,
      -10,
    ),
  steps: [
    {
      key: 'unload',
      camera: { zones: ['dock-3', 'staging'] },
      layers: { insight: true },
      focus: ['tag-cold-pallet-04'],
      highlight: ['cold-pallet-04'],
      speed: 2,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'forklift-3',
          steps: [
            { to: 'trailer-3', pickup: 'cold-pallet-04', dwellS: 3 },
            { to: 'dock-3', reverse: true, dwellS: 2 },
            { to: 'staging-1', drop: 'cold-pallet-04', dropAt: vec3(41.5, 10.5, 0), dwellS: 1e6 },
          ],
        }),
      until: { event: is.arrived('forklift-3', 'staging-1'), plusS: 6, maxS: 200 },
      ui: { chart: { tagId: 'tag-cold-pallet-04' }, panel: 'assets' },
    },
    {
      key: 'excursion',
      camera: { zones: ['staging', 'cold'] },
      layers: { insight: true, data: true },
      focus: ['tag-cold-pallet-04'],
      highlight: ['cold-pallet-04'],
      speed: 12,
      until: { event: is.alertRaised('cold-chain'), plusS: 10, maxS: 600 },
      ui: { chart: { tagId: 'tag-cold-pallet-04' }, panel: 'alerts' },
    },
    {
      key: 'stored',
      camera: { zones: ['staging', 'cold'] },
      layers: { insight: true, data: true },
      focus: ['tag-cold-pallet-04'],
      speed: 2,
      enter: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'forklift-3',
          steps: [
            { to: 'staging-1', pickup: 'cold-pallet-04', dwellS: 3 },
            { to: 'cold-store', drop: 'cold-pallet-04', dropAt: vec3(74, 8, 0), dwellS: 1e6 },
          ],
        }),
      until: {
        event: (e) => e.type === 'gate.checkin' && e.tagId === 'tag-cold-pallet-04',
        plusS: 4,
        maxS: 240,
      },
      ui: { chart: { tagId: 'tag-cold-pallet-04' }, panel: 'alerts' },
    },
  ],
};

export const warehouseStories: StoryDef[] = [w1, w2, w3, w4, w5];
