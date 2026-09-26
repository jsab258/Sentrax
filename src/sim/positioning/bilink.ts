import type { SimConfig } from '../config';
import type { EventBus } from '../events';
import { dist3 } from '../geometry';
import type { Rng } from '../rng';
import type { InfraDeviceDef } from '../world';
import type { Estimate } from './types';

interface AnchorTagState {
  /** Exponential moving average of RSSI (dBm). */
  filtered: number;
  lastHeard: number;
  present: boolean;
  lastRelay: number;
  /** Since when the filtered value has been above the enter threshold, if it is. */
  aboveSince: number | null;
}

export interface RelayMessage {
  anchorId: string;
  gatewayId: string;
  roomId: string;
  tagId: string;
  reason: 'enter' | 'exit' | 'heartbeat';
  rssi: number;
  sentAt: number;
  arrivesAt: number;
}

interface TagPresence {
  rssi: number;
  lastT: number;
}

interface Assignment {
  roomId: string | null;
  since: number;
  lastHeard: number;
}

/**
 * BiLink, modelled in two parts.
 *
 * Anchor side (NODIX CEN-1, one per room): keeps a filtered RSSI per tag, validates presence (the value
 * must stay above the enter threshold for a short validation time) with hysteresis (leave only below a
 * lower threshold) and relays only presence events and
 * periodic keep-alives to the nearest gateway, with a short latency.
 *
 * SOLIX side: receives the relays and assigns each tag to the room of the strongest anchor reporting
 * presence. A different room must win by a margin, and no assignment changes faster than the minimum
 * dwell, so there is no flicker and no hallway bleed. The reported value is a room id, not coordinates.
 */
export class Bilink {
  private readonly anchors = new Map<string, InfraDeviceDef>();
  private readonly relayTarget = new Map<string, string>();
  private readonly anchorState = new Map<string, Map<string, AnchorTagState>>();
  private queue: RelayMessage[] = [];
  private readonly presence = new Map<string, Map<string, TagPresence>>();
  private readonly assignments = new Map<string, Assignment>();

  constructor(
    private readonly cfg: SimConfig,
    anchors: InfraDeviceDef[],
    gateways: InfraDeviceDef[],
    private readonly rng: Rng,
    private readonly bus: EventBus,
  ) {
    for (const a of anchors) {
      if (!a.roomId) throw new Error(`BiLink anchor ${a.id} has no room`);
      this.anchors.set(a.id, a);
      this.anchorState.set(a.id, new Map());
      let best: InfraDeviceDef | undefined;
      for (const g of gateways) {
        if (!best || dist3(a.position, g.position) < dist3(a.position, best.position)) best = g;
      }
      if (best) this.relayTarget.set(a.id, best.id);
    }
  }

  /** Gateway each anchor relays to. */
  gatewayFor(anchorId: string): string | undefined {
    return this.relayTarget.get(anchorId);
  }

  private settings(anchorId: string): { enter: number; exit: number; validateS: number; alpha: number } {
    const a = this.anchors.get(anchorId)?.bilink;
    const c = this.cfg.bilink;
    return {
      enter: a?.enterDbm ?? c.enterDbm,
      exit: a?.exitDbm ?? c.exitDbm,
      validateS: a?.validateS ?? c.validateS,
      alpha: a?.filterAlpha ?? c.filterAlpha,
    };
  }

  /** An advertising packet heard by an anchor. */
  ingest(anchorId: string, tagId: string, rssi: number, t: number): void {
    const states = this.anchorState.get(anchorId);
    if (!states) return;
    const { enter, exit, validateS, alpha } = this.settings(anchorId);
    let s = states.get(tagId);
    if (!s) {
      s = { filtered: rssi, lastHeard: t, present: false, lastRelay: -Infinity, aboveSince: null };
      states.set(tagId, s);
    } else {
      s.filtered += alpha * (rssi - s.filtered);
      s.lastHeard = t;
    }
    s.aboveSince = s.filtered >= enter ? (s.aboveSince ?? t) : null;
    if (!s.present && s.aboveSince !== null && t - s.aboveSince >= validateS) {
      s.present = true;
      this.bus.emit({ type: 'bilink.presence', t, anchorId, tagId, present: true, rssi: s.filtered });
      this.relay(anchorId, tagId, 'enter', s, t);
    } else if (s.present && s.filtered < exit) {
      s.present = false;
      this.bus.emit({ type: 'bilink.presence', t, anchorId, tagId, present: false, rssi: s.filtered });
      this.relay(anchorId, tagId, 'exit', s, t);
    }
  }

  private relay(
    anchorId: string,
    tagId: string,
    reason: RelayMessage['reason'],
    s: AnchorTagState,
    t: number,
  ) {
    const gatewayId = this.relayTarget.get(anchorId);
    const anchor = this.anchors.get(anchorId);
    if (!gatewayId || !anchor?.roomId) return;
    const c = this.cfg.bilink;
    const arrivesAt = t + this.rng.range(c.relayLatencyMinS, c.relayLatencyMaxS) + c.backhaulLatencyS;
    s.lastRelay = t;
    this.queue.push({
      anchorId,
      gatewayId,
      roomId: anchor.roomId,
      tagId,
      reason,
      rssi: s.filtered,
      sentAt: t,
      arrivesAt,
    });
    this.bus.emit({ type: 'bilink.relay', t, anchorId, gatewayId, tagId, reason, arrivesAt });
  }

  /** Anchor timeouts and keep-alives, relay delivery and SOLIX room assignment. Call once per step. */
  update(t: number): void {
    const c = this.cfg.bilink;
    for (const [anchorId, states] of this.anchorState) {
      for (const [tagId, s] of states) {
        if (t - s.lastHeard > c.presenceTimeoutS) {
          if (s.present) {
            s.present = false;
            this.bus.emit({ type: 'bilink.presence', t, anchorId, tagId, present: false, rssi: s.filtered });
            this.relay(anchorId, tagId, 'exit', s, t);
          }
          states.delete(tagId);
        } else if (s.present && t - s.lastRelay >= c.heartbeatS) {
          this.relay(anchorId, tagId, 'heartbeat', s, t);
        }
      }
    }

    // Deliver relays that have arrived at SOLIX.
    if (this.queue.length) {
      const due = this.queue.filter((m) => m.arrivesAt <= t).sort((a, b) => a.arrivesAt - b.arrivesAt);
      this.queue = this.queue.filter((m) => m.arrivesAt > t);
      for (const m of due) {
        let p = this.presence.get(m.tagId);
        if (!p) {
          p = new Map();
          this.presence.set(m.tagId, p);
        }
        if (m.reason === 'exit') p.delete(m.anchorId);
        else p.set(m.anchorId, { rssi: m.rssi, lastT: m.arrivesAt });
        const a = this.assignments.get(m.tagId);
        if (a) a.lastHeard = m.arrivesAt;
        else this.assignments.set(m.tagId, { roomId: null, since: -Infinity, lastHeard: m.arrivesAt });
      }
    }

    // Room assignment.
    for (const [tagId, a] of this.assignments) {
      const p = this.presence.get(tagId) ?? new Map<string, TagPresence>();
      for (const [anchorId, pr] of p) if (t - pr.lastT > c.lostAfterS) p.delete(anchorId);
      let bestAnchor: string | null = null;
      let bestRssi = -Infinity;
      for (const [anchorId, pr] of p) {
        if (pr.rssi > bestRssi) {
          bestRssi = pr.rssi;
          bestAnchor = anchorId;
        }
      }
      const desired = bestAnchor ? (this.anchors.get(bestAnchor)?.roomId ?? null) : null;
      if (desired === a.roomId) continue;
      if (t - a.since < c.minDwellS) continue;
      if (a.roomId && desired) {
        // Both rooms still report presence: the new one must be clearly stronger.
        const currentAnchor = [...p.keys()].find((id) => this.anchors.get(id)?.roomId === a.roomId);
        const currentRssi = currentAnchor ? (p.get(currentAnchor)?.rssi ?? -Infinity) : -Infinity;
        if (currentAnchor && bestRssi < currentRssi + c.switchMarginDb) continue;
      }
      const previousRoomId = a.roomId;
      a.roomId = desired;
      a.since = t;
      this.bus.emit({ type: 'position.room', t, tagId, roomId: desired, previousRoomId });
    }
  }

  /** Current room assignment (null means not in any BiLink room). Undefined if the tag was never heard. */
  get(tagId: string, t: number): Estimate | undefined {
    const a = this.assignments.get(tagId);
    if (!a) return undefined;
    const sources = [...(this.presence.get(tagId)?.keys() ?? [])];
    return { tagId, tech: 'bilink', t: Math.min(t, a.lastHeard), roomId: a.roomId, sources };
  }

  /** Current assignment and when it last changed (SOLIX side). */
  assignment(tagId: string): { roomId: string | null; since: number } | undefined {
    const a = this.assignments.get(tagId);
    return a ? { roomId: a.roomId, since: a.since } : undefined;
  }

  /** Whether an anchor currently validates a tag as present (anchor side, before relay). */
  anchorPresence(anchorId: string, tagId: string): { present: boolean; filtered: number } | undefined {
    const s = this.anchorState.get(anchorId)?.get(tagId);
    return s ? { present: s.present, filtered: s.filtered } : undefined;
  }

  /** Relays in flight, for the Radio and Data layer visuals. */
  inFlight(): readonly RelayMessage[] {
    return this.queue;
  }

  lastHeard(tagId: string): number | undefined {
    return this.assignments.get(tagId)?.lastHeard;
  }
}
