import type { Simulation } from '../sim/engine';
import { vec3 } from '../sim/geometry';
import type { CameraShot, SceneKey } from './types';

/**
 * Explore mode (SPEC section 4): event triggers and camera presets per scene. Triggers issue the same
 * simulation commands the stories use, on the running explore simulation; the rule engine does the rest.
 * Labels live in src/content/ui.ts under the same ids.
 */
export interface Trigger {
  id: string;
  run: (sim: Simulation) => void;
}

function onArrive(sim: Simulation, agentId: string, nodeId: string, then: () => void): void {
  const off = sim.bus.on('agent.arrived', (e) => {
    if (e.agentId === agentId && e.nodeId === nodeId) {
      off();
      then();
    }
  });
}

export const triggers: Record<SceneKey, Trigger[]> = {
  hospital: [
    {
      id: 'ventilatorOut',
      run: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'porter',
          steps: [
            { to: 'icu-bay-b-head', pickup: 'vent-02' },
            { to: 'r102-bed', drop: 'vent-02', dwellS: 30 },
          ],
        }),
    },
    {
      id: 'ventilatorBack',
      run: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'biomed',
          steps: [
            { to: 'r102-bed', pickup: 'vent-02' },
            { to: 'icu-bay-b-head', drop: 'vent-02', dropAt: vec3(9.6, 1.2, 0), dwellS: 20 },
          ],
        }),
    },
    {
      id: 'fridgeOpen',
      run: (sim) => sim.command({ type: 'setDoor', doorId: 'fridge-01-door', open: true }),
    },
    {
      id: 'fridgeClose',
      run: (sim) => sim.command({ type: 'setDoor', doorId: 'fridge-01-door', open: false }),
    },
    {
      id: 'sos',
      run: (sim) => {
        sim.command({ type: 'route', agentId: 'nurse-3', steps: [{ to: 'r105-bed', dwellS: 120 }] });
        onArrive(sim, 'nurse-3', 'r105-bed', () =>
          sim.schedule(sim.time + 3, { type: 'pressButton', tagId: 'tag-sos-nurse-3' }),
        );
      },
    },
  ],
  warehouse: [
    {
      id: 'loadPallet',
      run: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'forklift-2',
          steps: [
            { to: 'aisle-C-7', pickup: 'pallet-2291', dwellS: 12 },
            { to: 'dock-2', dwellS: 2 },
            { to: 'trailer-2', drop: 'pallet-2291', dropAt: vec3(15, -9.5, 0), dwellS: 4 },
            { to: 'dock-2', reverse: true },
            { to: 'staging-2' },
          ],
        }),
    },
    {
      id: 'cage',
      run: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'picker-1',
          steps: [{ to: 'cage', dwellS: 45 }, { to: 'staging-1' }],
        }),
    },
    {
      id: 'evacuation',
      run: (sim) => {
        for (const a of sim.agents.agents.values()) {
          if (a.kind !== 'person') continue;
          sim.command({ type: 'dismount', agentId: a.id });
          sim.command({ type: 'route', agentId: a.id, steps: [{ to: 'muster', dwellS: 1e6 }] });
        }
      },
    },
    {
      id: 'coldPallet',
      run: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'forklift-3',
          steps: [
            { to: 'cold-rack', pickup: 'cold-pallet-04', dwellS: 3 },
            { to: 'staging-1', drop: 'cold-pallet-04', dropAt: vec3(41.5, 10.5, 0), dwellS: 5 },
          ],
        }),
    },
  ],
};

/** Camera presets per zone (ids are labels in src/content/ui.ts). */
export const cameraPresets: Record<SceneKey, Array<{ id: string; shot: CameraShot }>> = {
  hospital: [
    { id: 'overview', shot: { zones: ['icu', 'r101', 'r106', 'lobby', 'med'] } },
    { id: 'icu', shot: { zone: 'icu' } },
    { id: 'rooms', shot: { zones: ['r101', 'r102', 'r103'] } },
    { id: 'station', shot: { zones: ['station', 'med'] } },
    { id: 'storage', shot: { zones: ['storage', 'dirty'] } },
  ],
  warehouse: [
    { id: 'overview', shot: { zones: ['hall', 'trailer-dock-1', 'trailer-dock-3'] } },
    { id: 'racking', shot: { zone: 'racking' } },
    { id: 'docks', shot: { zones: ['receiving', 'trailer-dock-1', 'trailer-dock-3'] } },
    { id: 'production', shot: { zone: 'production' } },
    { id: 'cold', shot: { zones: ['cold', 'staging'] } },
    { id: 'yard', shot: { zones: ['yard'] } },
  ],
};
