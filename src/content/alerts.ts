import type { AlertInfo, SimEvent } from '../sim/events';
import type { WorldDef } from '../sim/world';
import { assetLabel, roleLabels, zoneLabels } from './scenes';

/** Human-readable names and alert texts built from simulation ids (all wording lives here). */

const classPlural: Record<string, string> = {
  infusion_pump: 'pumps',
  ventilator: 'ventilators',
  wheelchair: 'wheelchairs',
  crash_cart: 'crash carts',
  mobile_monitor: 'mobile monitors',
  pallet: 'pallets',
  cold_pallet: 'cold pallets',
  wip_carrier: 'WIP carriers',
};

export function zoneName(zoneId: string | null | undefined): string {
  if (!zoneId) return 'Unknown location';
  return zoneLabels[zoneId] ?? zoneId;
}

/** Display name of whatever carries a tag: an asset label, or an anonymous role and badge number. */
export function tagName(world: WorldDef, tagId: string): string {
  const tag = world.tags.find((t) => t.id === tagId);
  if (!tag) return tagId;
  if (tag.carrier.type === 'asset') return assetLabel(tag.carrier.id);
  const agent = world.agents.find((a) => a.id === tag.carrier.id);
  const role = agent ? (roleLabels[agent.role] ?? agent.role) : 'Staff';
  const index = world.agents.filter((a) => a.role === agent?.role).findIndex((a) => a.id === agent?.id) + 1;
  const kind = tag.model === 'PINIX TOB-1' ? 'wearable' : 'badge';
  return `${role}, ${kind} ${index}`;
}

export function alertTitle(world: WorldDef, a: AlertInfo): string {
  const where = zoneName(a.locationZoneId ?? a.zoneId);
  switch (a.kind) {
    case 'par':
      return `${zoneName(a.zoneId)} below PAR: ${classPlural[String(a.data.cls)] ?? a.data.cls} ${a.data.count} of ${a.data.min}`;
    case 'sensor':
      return `Temperature out of range: ${a.tagId ? tagName(world, a.tagId) : where}`;
    case 'sos':
      return `SOS: ${where}`;
    case 'geofence':
      return `${a.tagId ? tagName(world, a.tagId) : 'Asset'} in ${zoneName(a.zoneId)}`;
    case 'dwell':
      return `${a.tagId ? tagName(world, a.tagId) : 'Asset'}: dwell limit exceeded`;
    default:
      return where;
  }
}

export function alertLocation(a: AlertInfo): string {
  return zoneName(a.locationZoneId ?? a.zoneId);
}

export type CardId = 'alarm' | 'his' | 'wms' | 'mes';

/**
 * Which integration target receives an event, and the message it shows (Data layer). Integration targets
 * are generic (SPEC section 3).
 */
export function routeEvent(
  world: WorldDef,
  e: SimEvent,
  focus: readonly string[],
): { card: CardId; message: string } | null {
  const hospital = world.id === 'hospital';
  if (e.type === 'alert.raised' || e.type === 'alert.cleared') {
    const a = e.alert;
    const suffix = e.type === 'alert.cleared' ? ' (cleared)' : '';
    if (a.kind === 'sos') return { card: 'alarm', message: `${alertTitle(world, a)}${suffix}` };
    if (hospital) return { card: 'his', message: `${alertTitle(world, a)}${suffix}` };
    return {
      card: a.kind === 'dwell' && a.zoneId?.startsWith('station') ? 'mes' : 'wms',
      message: `${alertTitle(world, a)}${suffix}`,
    };
  }
  if (e.type === 'position.room' && focus.includes(e.tagId) && e.roomId) {
    // Staff presence goes to the nurse-call platform, equipment locations to the CMMS.
    const person = world.tags.find((t) => t.id === e.tagId)?.carrier.type === 'agent';
    const card: CardId = hospital ? (person ? 'alarm' : 'his') : 'wms';
    return { card, message: `${tagName(world, e.tagId)}: ${zoneName(e.roomId)}` };
  }
  if (e.type === 'gate.checkout' || e.type === 'gate.checkin') {
    const verb = e.type === 'gate.checkout' ? 'checked out at' : 'checked in at';
    return { card: 'wms', message: `${tagName(world, e.tagId)} ${verb} ${zoneName(e.gateZoneId)}` };
  }
  return null;
}
