import type { Simulation } from '../sim/engine';
import { vec3 } from '../sim/geometry';

/**
 * Debug scenarios: one-click commands that exercise the rule engine in the 2D debug view. These are
 * engineering checks, not the guided stories (those arrive in M3 and M4). Labels are dev-only.
 */
export interface Scenario {
  id: string;
  label: string;
  run: (sim: Simulation) => void;
}

/** Runs `then` once the agent arrives at `nodeId`. */
function onArrive(sim: Simulation, agentId: string, nodeId: string, then: () => void) {
  const off = sim.bus.on('agent.arrived', (e) => {
    if (e.agentId === agentId && e.nodeId === nodeId) {
      off();
      then();
    }
  });
}

export const scenarios: Record<string, Scenario[]> = {
  hospital: [
    {
      id: 'h3-out',
      label: 'H3: porter takes ventilator V-02 to room 102',
      run: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'porter',
          steps: [
            { to: 'icu-bay-b-head', pickup: 'vent-02' },
            { to: 'r102-bed', drop: 'vent-02', dwellS: 5 },
          ],
        }),
    },
    {
      id: 'h3-back',
      label: 'H3: BioMed technician returns V-02 to the ICU',
      run: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'biomed',
          steps: [
            { to: 'r102-bed', pickup: 'vent-02' },
            { to: 'icu-bay-b-head', drop: 'vent-02', dropAt: vec3(9.6, 1.2, 0), dwellS: 10 },
          ],
        }),
    },
    {
      id: 'h4-open',
      label: 'H4: fridge door left open',
      run: (sim) => sim.command({ type: 'setDoor', doorId: 'fridge-01-door', open: true }),
    },
    {
      id: 'h4-close',
      label: 'H4: fridge door closed',
      run: (sim) => sim.command({ type: 'setDoor', doorId: 'fridge-01-door', open: false }),
    },
    {
      id: 'h5-sos',
      label: 'H5: nurse presses SOS in room 105',
      run: (sim) => {
        sim.command({ type: 'route', agentId: 'nurse-3', steps: [{ to: 'r105-bed', dwellS: 120 }] });
        onArrive(sim, 'nurse-3', 'r105-bed', () =>
          sim.schedule(sim.time + 8, { type: 'pressButton', tagId: 'tag-sos-nurse-3' }),
        );
      },
    },
    {
      id: 'exit',
      label: 'Geofence: pump P-07 taken to the elevator lobby',
      run: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'porter',
          steps: [
            { to: 'r104-bed', pickup: 'pump-07' },
            { to: 'lobby', drop: 'pump-07', dwellS: 20 },
          ],
        }),
    },
  ],
  warehouse: [
    {
      id: 'w1-w2',
      label: 'W1 and W2: forklift 2 takes PL-2291 to the trailer at dock 2',
      run: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'forklift-2',
          steps: [
            { to: 'aisle-C-7', pickup: 'pallet-2291', dwellS: 4 },
            { to: 'dock-2', dwellS: 2 },
            { to: 'trailer-2', drop: 'pallet-2291', dwellS: 5 },
            { to: 'staging-2' },
          ],
        }),
    },
    {
      id: 'w4-cage',
      label: 'W4: picker 1 enters the battery charging cage',
      run: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'picker-1',
          steps: [{ to: 'cage', dwellS: 45 }, { to: 'staging-1' }],
        }),
    },
    {
      id: 'w4-evac',
      label: 'W4: evacuation drill, everyone to the muster point',
      run: (sim) => {
        for (const a of sim.agents.agents.values()) {
          if (a.kind !== 'person') continue;
          sim.command({ type: 'dismount', agentId: a.id });
          sim.command({ type: 'route', agentId: a.id, steps: [{ to: 'muster', dwellS: 1e6 }] });
        }
      },
    },
    {
      id: 'w5',
      label: 'W5: forklift 3 unloads cold pallet CP-04 into staging',
      run: (sim) =>
        sim.command({
          type: 'route',
          agentId: 'forklift-3',
          steps: [
            { to: 'trailer-3', pickup: 'cold-pallet-04' },
            { to: 'dock-3', dwellS: 2 },
            { to: 'staging-1', drop: 'cold-pallet-04', dwellS: 10 },
          ],
        }),
    },
  ],
};
