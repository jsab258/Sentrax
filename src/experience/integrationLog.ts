import { routeEvent, type CardId } from '../content/alerts';
import type { Simulation } from '../sim/engine';
import type { WorldDef } from '../sim/world';

/** Messages the integration cards show: the latest few per card, newest first. */
export interface IntegrationLog {
  readonly messages: Map<CardId, string[]>;
  /** Called for every new message (the Data layer animates a packet to the card). */
  readonly listeners: Set<(card: CardId) => void>;
}

const MAX_MESSAGES = 3;
const logs = new WeakMap<Simulation, IntegrationLog>();

/**
 * Records what SOLIX forwards to the integration targets for a simulation. Attached when the simulation
 * is created, before a story replays its earlier steps, so Back and deep links show the same cards as a
 * full playthrough. `focus` gives the tags whose room changes are forwarded at the time of each event.
 */
export function attachIntegrationLog(
  sim: Simulation,
  world: WorldDef,
  focus: () => readonly string[],
): IntegrationLog {
  const existing = logs.get(sim);
  if (existing) return existing;
  const log: IntegrationLog = { messages: new Map(), listeners: new Set() };
  logs.set(sim, log);
  sim.bus.onAny((e) => {
    const r = routeEvent(world, e, focus());
    if (!r) return;
    const list = log.messages.get(r.card) ?? [];
    list.unshift(r.message);
    list.length = Math.min(list.length, MAX_MESSAGES);
    log.messages.set(r.card, list);
    for (const l of log.listeners) l(r.card);
  });
  return log;
}

export function integrationLog(sim: Simulation): IntegrationLog | undefined {
  return logs.get(sim);
}
