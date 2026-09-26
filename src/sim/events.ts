import type { Vec3 } from './geometry';
import type { SensorKind } from './world';

/**
 * Event bus (SPEC section 6). Consumed by the dashboard, narration, integration cards and analytics.
 * Every event carries the simulation time `t` in seconds. Events carry ids and numbers only; the UI turns
 * them into text through the content files.
 */

export type AlertKind = 'par' | 'geofence' | 'sensor' | 'sos' | 'dwell';

export interface AlertInfo {
  id: string;
  ruleId: string;
  kind: AlertKind;
  tagId?: string;
  zoneId?: string;
  /** Location as the system reports it (room or zone id), when known. */
  locationZoneId?: string | null;
  startedAt: number;
  /** Rule specific numbers, for example { count: 2, min: 3 } or { value: 8.4, limit: 8 }. */
  data: Record<string, number | string>;
  acknowledgedAt?: number;
  clearedAt?: number;
}

export type SimEvent =
  | { type: 'bilink.presence'; t: number; anchorId: string; tagId: string; present: boolean; rssi: number }
  | {
      type: 'bilink.relay';
      t: number;
      anchorId: string;
      gatewayId: string;
      tagId: string;
      reason: 'enter' | 'exit' | 'heartbeat';
      arrivesAt: number;
    }
  | { type: 'position.room'; t: number; tagId: string; roomId: string | null; previousRoomId: string | null }
  | { type: 'zone.enter'; t: number; tagId: string; zoneId: string }
  | { type: 'zone.exit'; t: number; tagId: string; zoneId: string; dwellS: number }
  | { type: 'gate.checkout'; t: number; tagId: string; ruleId: string; gateZoneId: string }
  | { type: 'gate.checkin'; t: number; tagId: string; ruleId: string; gateZoneId: string }
  | { type: 'alert.raised'; t: number; alert: AlertInfo }
  | { type: 'alert.updated'; t: number; alert: AlertInfo }
  | { type: 'alert.acknowledged'; t: number; alert: AlertInfo }
  | { type: 'alert.cleared'; t: number; alert: AlertInfo }
  | { type: 'sensor.reading'; t: number; tagId: string; metric: SensorKind; value: number }
  | { type: 'button.pressed'; t: number; tagId: string }
  | {
      type: 'muster.update';
      t: number;
      ruleId: string;
      present: number;
      total: number;
      missingTagIds: string[];
    }
  | { type: 'agent.arrived'; t: number; agentId: string; nodeId: string }
  | { type: 'asset.pickedUp'; t: number; agentId: string; assetId: string }
  | { type: 'asset.dropped'; t: number; agentId: string; assetId: string; at: Vec3 }
  | { type: 'door.changed'; t: number; doorId: string; open: boolean };

export type SimEventType = SimEvent['type'];
export type EventOf<T extends SimEventType> = Extract<SimEvent, { type: T }>;

type Handler<E> = (event: E) => void;

export class EventBus {
  private handlers = new Map<SimEventType, Set<Handler<SimEvent>>>();
  private anyHandlers = new Set<Handler<SimEvent>>();
  private log: SimEvent[] = [];

  constructor(private readonly logSize = 500) {}

  on<T extends SimEventType>(type: T, handler: Handler<EventOf<T>>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<SimEvent>);
    return () => set.delete(handler as Handler<SimEvent>);
  }

  onAny(handler: Handler<SimEvent>): () => void {
    this.anyHandlers.add(handler);
    return () => this.anyHandlers.delete(handler);
  }

  emit(event: SimEvent): void {
    this.log.push(event);
    if (this.log.length > this.logSize) this.log.splice(0, this.log.length - this.logSize);
    this.handlers.get(event.type)?.forEach((h) => h(event));
    this.anyHandlers.forEach((h) => h(event));
  }

  /** Most recent events, oldest first. */
  recent(): readonly SimEvent[] {
    return this.log;
  }

  clear(): void {
    this.log = [];
  }
}
