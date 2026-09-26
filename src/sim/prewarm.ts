import { Simulation, type SimOptions } from './engine';
import type { WorldDef } from './world';

/**
 * The only way the UI creates a simulation: runs `preRollS` (default: config.preRollS, 30 s) of simulation
 * time off-screen, so the first rendered frame already shows every tag located and no startup artifacts.
 * The event log is cleared afterwards; consumers subscribe after this returns.
 */
export function createPrerolledSimulation(
  world: WorldDef,
  options: SimOptions & { preRollS?: number } = {},
): Simulation {
  const sim = new Simulation(world, options);
  const preRoll = options.preRollS ?? sim.cfg.preRollS;
  if (preRoll < sim.cfg.rules.warmupS) throw new Error('pre-roll must cover the rules warm-up');
  sim.runUntil(preRoll);
  sim.bus.clear();
  return sim;
}
