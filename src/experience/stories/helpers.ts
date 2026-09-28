import type { Simulation } from '../../sim/engine';
import type { SimEvent } from '../../sim/events';
import type { WorldDef } from '../../sim/world';

/**
 * Story starting states: every agent stands still at a chosen nav node (no routine), so nothing moves
 * except what the story scripts. Applied before the pre-roll.
 */
export function stillAgents(base: WorldDef, starts: Record<string, string>): WorldDef {
  const w = structuredClone(base);
  for (const a of w.agents) {
    a.start = starts[a.id] ?? a.start;
    a.routine = [];
    a.loop = false;
  }
  return w;
}

/** Runs `then` once the agent arrives at the node; returns the unsubscribe function. */
export function onArrive(sim: Simulation, agentId: string, nodeId: string, then: () => void): () => void {
  const off = sim.bus.on('agent.arrived', (e) => {
    if (e.agentId === agentId && e.nodeId === nodeId) {
      off();
      then();
    }
  });
  return off;
}

export const is = {
  arrived: (agentId: string, nodeId: string) => (e: SimEvent) =>
    e.type === 'agent.arrived' && e.agentId === agentId && e.nodeId === nodeId,
  alertRaised: (ruleId: string) => (e: SimEvent) => e.type === 'alert.raised' && e.alert.ruleId === ruleId,
  alertCleared: (ruleId: string) => (e: SimEvent) => e.type === 'alert.cleared' && e.alert.ruleId === ruleId,
  alertAcknowledged: (ruleId: string) => (e: SimEvent) =>
    e.type === 'alert.acknowledged' && e.alert.ruleId === ruleId,
  relay: (tagId: string) => (e: SimEvent) => e.type === 'bilink.relay' && e.tagId === tagId,
  room: (tagId: string, roomId: string | null) => (e: SimEvent) =>
    e.type === 'position.room' && e.tagId === tagId && e.roomId === roomId,
};

/** State check: the system currently assigns the tag to the room. */
export const inRoom = (tagId: string, roomId: string | null) => (sim: Simulation) =>
  (sim.bilink.assignment(tagId)?.roomId ?? null) === roomId;
