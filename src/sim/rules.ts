import type { SimConfig } from './config';
import type { AlertInfo, EventBus } from './events';
import type { ReportedPosition } from './positionSource';
import type { AgentRole, AssetClass, RuleDef, SensorKind, WorldDef } from './world';

/** What carries a tag: an agent role or an asset class. Used by rule filters. */
export type CarrierKind = { type: 'agent'; role: AgentRole } | { type: 'asset'; cls: AssetClass };

interface ZoneMembership {
  confirmed: Map<string, number>;
  pendingEnter: Map<string, number>;
  pendingExit: Map<string, number>;
}

interface GateState {
  side: 'inside' | 'outside' | null;
  passedGate: boolean;
  pendingSide: 'inside' | 'outside' | null;
  pendingSince: number;
  /** `heldSince` of the silent episode already counted as a crossing. */
  lostAt: number | null;
}

export interface SensorReading {
  value: number;
  t: number;
}

/**
 * Rule engine (SPEC section 6). Works only on what the system reports (never on ground truth):
 * zone enter and exit with debounce, geofence violations, PAR levels per zone and asset class, sensor
 * thresholds, SOS, automatic check-in and check-out through gate zones, dwell limits and muster counts.
 */
export class RuleEngine {
  private readonly membership = new Map<string, ZoneMembership>();
  private readonly active = new Map<string, AlertInfo>();
  private readonly history: AlertInfo[] = [];
  private readonly belowSince = new Map<string, number>();
  private readonly gates = new Map<string, GateState>();
  private readonly outsideSince = new Map<string, number>();
  private readonly musterPresent = new Map<string, number>();
  private readonly lastUpdateEmit = new Map<string, number>();
  private sosSeq = 0;

  constructor(
    private readonly world: WorldDef,
    private readonly cfg: SimConfig,
    private readonly bus: EventBus,
    private readonly carrierOf: (tagId: string) => CarrierKind | undefined,
  ) {}

  /** Confirmed zones of a tag, with the time each was entered. */
  zonesOf(tagId: string): ReadonlyMap<string, number> {
    return this.membership.get(tagId)?.confirmed ?? new Map();
  }

  /** Number of tagged assets of a class confirmed in a zone. */
  count(zoneId: string, cls: AssetClass): number {
    let n = 0;
    for (const [tagId, m] of this.membership) {
      const c = this.carrierOf(tagId);
      if (c?.type === 'asset' && c.cls === cls && m.confirmed.has(zoneId)) n++;
    }
    return n;
  }

  activeAlerts(): AlertInfo[] {
    return [...this.active.values()];
  }

  /** Every alert raised so far, including cleared ones: the audit trail. */
  alertHistory(): readonly AlertInfo[] {
    return this.history;
  }

  musterStatus(ruleId: string): { present: number; total: number; missing: string[] } {
    const rule = this.world.rules.find((r) => r.id === ruleId);
    if (!rule || rule.type !== 'muster') return { present: 0, total: 0, missing: [] };
    const population = this.population(rule.roles);
    const missing = population.filter((tagId) => !this.zonesOf(tagId).has(rule.zoneId));
    return { present: population.length - missing.length, total: population.length, missing };
  }

  acknowledge(alertId: string, t: number): void {
    const a = this.active.get(alertId);
    if (!a || a.acknowledgedAt !== undefined) return;
    a.acknowledgedAt = t;
    this.bus.emit({ type: 'alert.acknowledged', t, alert: { ...a } });
    if (a.kind === 'sos') this.clear(alertId, t);
  }

  pressButton(tagId: string, t: number, reports: ReadonlyMap<string, ReportedPosition>): void {
    this.bus.emit({ type: 'button.pressed', t, tagId });
    const rule = this.world.rules.find((r) => r.type === 'sos');
    const tag = this.world.tags.find((x) => x.id === tagId);
    if (!rule || !tag?.sosButton) return;
    const report = reports.get(tagId);
    this.raise(
      {
        id: `${rule.id}:${tagId}:${++this.sosSeq}`,
        ruleId: rule.id,
        kind: 'sos',
        tagId,
        locationZoneId: report ? this.locationOf(report) : null,
        startedAt: t,
        data: {},
      },
      t,
    );
  }

  update(
    t: number,
    reports: ReadonlyMap<string, ReportedPosition>,
    readings: ReadonlyMap<string, ReadonlyMap<SensorKind, SensorReading>>,
  ): void {
    for (const [tagId, report] of reports) this.updateMembership(tagId, report.zoneIds, t);
    for (const rule of this.world.rules) {
      switch (rule.type) {
        case 'par':
          this.evalPar(rule, t);
          break;
        case 'geofence':
          this.evalGeofence(rule, t, reports);
          break;
        case 'sensor':
          this.evalSensor(rule, t, readings, reports);
          break;
        case 'gate':
          this.evalGate(rule, t, reports);
          break;
        case 'dwell':
          this.evalDwell(rule, t, reports);
          break;
        case 'muster':
          this.evalMuster(rule, t);
          break;
        case 'sos':
          break;
      }
    }
  }

  private updateMembership(tagId: string, zoneIds: readonly string[], t: number): void {
    const c = this.cfg.rules;
    let m = this.membership.get(tagId);
    if (!m) {
      m = { confirmed: new Map(), pendingEnter: new Map(), pendingExit: new Map() };
      this.membership.set(tagId, m);
    }
    const raw = new Set(zoneIds);
    for (const z of raw) {
      m.pendingExit.delete(z);
      if (m.confirmed.has(z)) continue;
      const since = m.pendingEnter.get(z) ?? t;
      m.pendingEnter.set(z, since);
      if (t - since >= c.zoneEnterDebounceS) {
        m.pendingEnter.delete(z);
        m.confirmed.set(z, t);
        this.bus.emit({ type: 'zone.enter', t, tagId, zoneId: z });
      }
    }
    for (const z of [...m.pendingEnter.keys()]) if (!raw.has(z)) m.pendingEnter.delete(z);
    for (const [z, enteredAt] of m.confirmed) {
      if (raw.has(z)) continue;
      const since = m.pendingExit.get(z) ?? t;
      m.pendingExit.set(z, since);
      if (t - since >= c.zoneExitDebounceS) {
        m.pendingExit.delete(z);
        m.confirmed.delete(z);
        this.bus.emit({ type: 'zone.exit', t, tagId, zoneId: z, dwellS: t - enteredAt });
      }
    }
  }

  private applies(tagId: string, filter?: ReadonlyArray<AgentRole | AssetClass>): boolean {
    if (!filter?.length) return true;
    const c = this.carrierOf(tagId);
    if (!c) return false;
    return filter.includes(c.type === 'agent' ? c.role : c.cls);
  }

  private population(roles: readonly AgentRole[]): string[] {
    return this.world.tags
      .filter((tag) => {
        const c = this.carrierOf(tag.id);
        return c?.type === 'agent' && roles.includes(c.role);
      })
      .map((tag) => tag.id);
  }

  private locationOf(report: ReportedPosition): string | null {
    if (report.roomId) return report.roomId;
    let best: string | null = null;
    let bestRank = -1;
    for (const z of report.zoneIds) {
      const kind = this.world.zones.find((x) => x.id === z)?.kind;
      const rank = kind === 'room' ? 3 : kind === 'corridor' ? 2 : kind === 'area' ? 1 : 0;
      if (rank > bestRank) {
        bestRank = rank;
        best = z;
      }
    }
    return best;
  }

  private raise(alert: AlertInfo, t: number): void {
    if (t < this.cfg.rules.warmupS && alert.kind !== 'sos') return;
    this.active.set(alert.id, alert);
    this.history.push(alert);
    this.lastUpdateEmit.set(alert.id, t);
    this.bus.emit({ type: 'alert.raised', t, alert: { ...alert } });
  }

  private refresh(id: string, t: number, data: AlertInfo['data'], force = false): void {
    const a = this.active.get(id);
    if (!a) return;
    const changed = Object.entries(data).some(([k, v]) => a.data[k] !== v);
    a.data = { ...a.data, ...data };
    if (force || (changed && t - (this.lastUpdateEmit.get(id) ?? 0) >= 1)) {
      this.lastUpdateEmit.set(id, t);
      this.bus.emit({ type: 'alert.updated', t, alert: { ...a } });
    }
  }

  private clear(id: string, t: number): void {
    const a = this.active.get(id);
    if (!a) return;
    a.clearedAt = t;
    this.active.delete(id);
    this.bus.emit({ type: 'alert.cleared', t, alert: { ...a } });
  }

  private evalPar(rule: Extract<RuleDef, { type: 'par' }>, t: number): void {
    const n = this.count(rule.zoneId, rule.cls);
    if (n < rule.min) {
      const since = this.belowSince.get(rule.id) ?? t;
      this.belowSince.set(rule.id, since);
      if (this.active.has(rule.id)) this.refresh(rule.id, t, { count: n });
      else if (t - since >= this.cfg.rules.parConfirmS) {
        this.raise(
          {
            id: rule.id,
            ruleId: rule.id,
            kind: 'par',
            zoneId: rule.zoneId,
            locationZoneId: rule.zoneId,
            startedAt: t,
            data: { count: n, min: rule.min, cls: rule.cls },
          },
          t,
        );
      }
    } else {
      this.belowSince.delete(rule.id);
      this.clear(rule.id, t);
    }
  }

  private evalGeofence(
    rule: Extract<RuleDef, { type: 'geofence' }>,
    t: number,
    reports: ReadonlyMap<string, ReportedPosition>,
  ): void {
    for (const tagId of reports.keys()) {
      const id = `${rule.id}:${tagId}`;
      const inside = this.zonesOf(tagId).get(rule.zoneId);
      const violating =
        inside !== undefined && this.applies(tagId, rule.appliesTo) && !rule.allowedTagIds?.includes(tagId);
      if (violating) {
        if (!this.active.has(id)) {
          this.raise(
            {
              id,
              ruleId: rule.id,
              kind: 'geofence',
              tagId,
              zoneId: rule.zoneId,
              locationZoneId: rule.zoneId,
              startedAt: t,
              data: { durationS: 0 },
            },
            t,
          );
        } else this.refresh(id, t, { durationS: Math.round(t - (this.active.get(id)?.startedAt ?? t)) });
      } else this.clear(id, t);
    }
  }

  private evalSensor(
    rule: Extract<RuleDef, { type: 'sensor' }>,
    t: number,
    readings: ReadonlyMap<string, ReadonlyMap<SensorKind, SensorReading>>,
    reports: ReadonlyMap<string, ReportedPosition>,
  ): void {
    const r = readings.get(rule.tagId)?.get(rule.metric);
    if (!r) return;
    const c = this.cfg.rules;
    const over = rule.max !== undefined && r.value > rule.max;
    const under = rule.min !== undefined && r.value < rule.min;
    const id = rule.id;
    const active = this.active.get(id);
    if (over || under) {
      const since = this.belowSince.get(id) ?? r.t;
      this.belowSince.set(id, since);
      if (active) {
        const peak = over
          ? Math.max(Number(active.data.peak), r.value)
          : Math.min(Number(active.data.peak), r.value);
        this.refresh(id, t, {
          value: round1(r.value),
          peak: round1(peak),
          durationS: Math.round(t - active.startedAt),
        });
      } else if (t - since >= c.sensorConfirmS) {
        const report = reports.get(rule.tagId);
        this.raise(
          {
            id,
            ruleId: rule.id,
            kind: 'sensor',
            tagId: rule.tagId,
            locationZoneId: report ? this.locationOf(report) : null,
            startedAt: t,
            data: {
              metric: rule.metric,
              value: round1(r.value),
              peak: round1(r.value),
              limit: (over ? rule.max : rule.min) as number,
              durationS: 0,
            },
          },
          t,
        );
      }
    } else {
      this.belowSince.delete(id);
      if (!active) return;
      const back =
        (rule.max === undefined || r.value <= rule.max - c.sensorHysteresis) &&
        (rule.min === undefined || r.value >= rule.min + c.sensorHysteresis);
      if (back) this.clear(id, t);
    }
  }

  private evalGate(
    rule: Extract<RuleDef, { type: 'gate' }>,
    t: number,
    reports: ReadonlyMap<string, ReportedPosition>,
  ): void {
    const c = this.cfg.rules;
    for (const tag of this.world.tags) {
      const carrier = this.carrierOf(tag.id);
      if (rule.appliesTo?.length && !(carrier?.type === 'asset' && rule.appliesTo.includes(carrier.cls)))
        continue;
      const zones = this.zonesOf(tag.id);
      if (!zones.size) continue;
      const key = `${rule.id}:${tag.id}`;
      let g = this.gates.get(key);
      if (!g) {
        g = { side: null, passedGate: false, pendingSide: null, pendingSince: t, lostAt: null };
        this.gates.set(key, g);
      }
      if (zones.has(rule.gateZoneId)) {
        const report = reports.get(tag.id);
        // Only a live report marks the gate as passed; a held one is just the last known place.
        if (!report?.held) g.passedGate = g.side !== null;
        g.pendingSide = null;
        // Exit by disappearance: last seen in the gate zone after passing it, then silent. Counted once.
        const heldSince = report?.held ? (report.heldSince ?? t) : null;
        if (
          g.side &&
          g.passedGate &&
          heldSince !== null &&
          g.lostAt !== heldSince &&
          t - heldSince >= c.gateLostS
        ) {
          g.lostAt = heldSince;
          this.cross(rule, tag.id, g, g.side === 'inside' ? 'outside' : 'inside', t);
        }
        continue;
      }
      const side = rule.outsideZoneIds.some((z) => zones.has(z))
        ? 'outside'
        : rule.insideZoneIds.some((z) => zones.has(z))
          ? 'inside'
          : null;
      if (!side) continue;
      if (g.side === null) {
        g.side = side;
        continue;
      }
      // A side only counts once it has been reported continuously for a while, so short glitches
      // (for example a noisy RSSI fix near the wall) neither trigger nor cancel a crossing.
      if (g.pendingSide !== side) {
        g.pendingSide = side;
        g.pendingSince = t;
      }
      if (side !== g.side) {
        if (t - g.pendingSince < c.gateConfirmS) continue;
        if (g.passedGate) this.cross(rule, tag.id, g, side, t);
        else g.side = side;
      } else if (g.passedGate && t - g.pendingSince >= c.gateReturnS) {
        // Went into the gate zone and came back out on the same side: not a crossing.
        g.passedGate = false;
      }
    }
  }

  private cross(
    rule: Extract<RuleDef, { type: 'gate' }>,
    tagId: string,
    g: GateState,
    side: 'inside' | 'outside',
    t: number,
  ) {
    this.bus.emit({
      type: side === 'outside' ? 'gate.checkout' : 'gate.checkin',
      t,
      tagId,
      ruleId: rule.id,
      gateZoneId: rule.gateZoneId,
    });
    g.side = side;
    g.passedGate = false;
    g.pendingSide = null;
  }

  private evalDwell(
    rule: Extract<RuleDef, { type: 'dwell' }>,
    t: number,
    reports: ReadonlyMap<string, ReportedPosition>,
  ): void {
    for (const [tagId, report] of reports) {
      if (!this.applies(tagId, rule.appliesTo)) continue;
      const id = `${rule.id}:${tagId}`;
      const zones = this.zonesOf(tagId);
      const enteredAt = zones.get(rule.zoneId);
      let since: number | undefined;
      if (rule.mode === 'inside') since = enteredAt;
      else if (rule.withinZoneId && !zones.has(rule.withinZoneId)) this.outsideSince.delete(id);
      else if (enteredAt === undefined) {
        since = this.outsideSince.get(id) ?? t;
        this.outsideSince.set(id, since);
      } else this.outsideSince.delete(id);
      if (since === undefined || t - since <= rule.maxS) {
        this.clear(id, t);
        continue;
      }
      const dwellS = Math.round(t - since);
      if (this.active.has(id)) this.refresh(id, t, { dwellS });
      else {
        this.raise(
          {
            id,
            ruleId: rule.id,
            kind: 'dwell',
            tagId,
            zoneId: rule.zoneId,
            locationZoneId: this.locationOf(report),
            startedAt: t,
            data: { dwellS, maxS: rule.maxS, mode: rule.mode },
          },
          t,
        );
      }
    }
  }

  private evalMuster(rule: Extract<RuleDef, { type: 'muster' }>, t: number): void {
    const s = this.musterStatus(rule.id);
    if (this.musterPresent.get(rule.id) === s.present) return;
    this.musterPresent.set(rule.id, s.present);
    this.bus.emit({
      type: 'muster.update',
      t,
      ruleId: rule.id,
      present: s.present,
      total: s.total,
      missingTagIds: s.missing,
    });
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
