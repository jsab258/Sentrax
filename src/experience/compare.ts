import type { WorldDef } from '../sim/world';

/**
 * Infrastructure counts for the H2 comparison (SPEC sections 3 and 7), computed from the scene's devices:
 * never percentages. Conventional: a powered gateway in every BiLink room, each with its own cable run.
 * BiLink: a battery anchor per room plus the gateways that receive relays; only those need power and cable.
 */
export interface InfrastructureCounts {
  gateways: number;
  powered: number;
  cables: number;
  anchors: number;
}

export function infrastructureCounts(world: WorldDef): {
  conventional: InfrastructureCounts;
  bilink: InfrastructureCounts;
} {
  const anchors = world.devices.filter((d) => d.kind === 'anchor');
  const rooms = new Set(anchors.map((a) => a.roomId)).size;
  const relayGateways = world.devices.filter((d) => d.kind === 'gateway' && d.relayTarget !== false);
  const powered = relayGateways.filter((g) => g.power === 'poe').length;
  return {
    conventional: { gateways: rooms, powered: rooms, cables: rooms, anchors: 0 },
    bilink: { gateways: relayGateways.length, powered, cables: powered, anchors: anchors.length },
  };
}
