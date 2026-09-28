import { AgentSystem } from './agents';
import { simConfig, type SimConfig } from './config';
import { EventBus } from './events';
import { clampToPolygon, dist2, dist3, lerp3, pointInPolygon, type Vec2, type Vec3 } from './geometry';
import { Navigator } from './nav';
import { AoaPositioner, type AoaRay } from './positioning/aoa';
import { Bilink } from './positioning/bilink';
import { RssiPositioner } from './positioning/rssi';
import type { Estimate, Tech } from './positioning/types';
import type { PositionSource, ReportedPosition } from './positionSource';
import { RadioModel } from './rf';
import { Rng } from './rng';
import { RuleEngine, type CarrierKind, type SensorReading } from './rules';
import { SensorSystem } from './sensors';
import type { InfraDeviceDef, RoutineStep, SensorKind, TagDef, WorldDef, ZoneDef } from './world';
import { ZoneIndex } from './zones';

export type SimCommand =
  | { type: 'goTo'; agentId: string; to: string; dwellS?: number; replace?: boolean }
  | { type: 'route'; agentId: string; steps: RoutineStep[]; replace?: boolean }
  | { type: 'setRoutine'; agentId: string; steps: RoutineStep[]; loop: boolean }
  | { type: 'pickup'; agentId: string; assetId: string }
  | { type: 'drop'; agentId: string; assetId: string; at?: Vec3 }
  | { type: 'moveAsset'; assetId: string; to: Vec3 }
  | { type: 'moveAgent'; agentId: string; to: Vec2 }
  | { type: 'dismount'; agentId: string }
  | { type: 'setDoor'; doorId: string; open: boolean }
  | { type: 'pressButton'; tagId: string }
  | { type: 'acknowledge'; alertId: string };

export interface SimOptions {
  seed?: number | string;
  config?: SimConfig;
}

interface TagRuntime {
  def: TagDef;
  pos: Vec3;
  prevPos: Vec3;
  nextAdv: number;
  lastAdv: number;
}

/**
 * The simulation (SPEC section 6): deterministic and seeded, fixed 10 Hz steps, rendering interpolates.
 * Owns ground truth (agents, assets, tags) and every technology's reported estimate.
 */
export class Simulation implements PositionSource {
  readonly cfg: SimConfig;
  readonly dt: number;
  readonly bus = new EventBus();
  readonly zones: ZoneIndex;
  readonly nav: Navigator;
  readonly agents: AgentSystem;
  readonly radio: RadioModel;
  readonly rssi: RssiPositioner;
  readonly aoa: AoaPositioner;
  readonly bilink: Bilink;
  readonly sensors: SensorSystem;
  readonly rules: RuleEngine;

  time = 0;
  steps = 0;
  private accumulator = 0;
  private readonly tags = new Map<string, TagRuntime>();
  private readonly devices = new Map<string, InfraDeviceDef>();
  readonly gatewaysList: InfraDeviceDef[];
  readonly anchorsList: InfraDeviceDef[];
  readonly locatorsList: InfraDeviceDef[];
  private readonly bilinkRooms = new Set<string>();
  private readonly fallbackZones: ZoneDef[];
  private readonly buildingZones: ZoneDef[];
  private readonly fused = new Map<string, ReportedPosition>();
  /** Last point report per tag with the estimate and position it was built from (reused while unchanged). */
  private readonly pointReports = new Map<string, { e: Estimate; p: Vec3; r: ReportedPosition }>();
  /** Shadowing link keys per tag, one per device (`tag|device`), built once. */
  private readonly linkKeys = new Map<string, string[]>();
  private readonly seen = new Map<string, number>();
  private readonly readings = new Map<string, Map<SensorKind, SensorReading>>();
  private readonly lastReadingEmit = new Map<string, number>();
  private readonly scheduled: Array<{ t: number; seq: number; cmd: SimCommand }> = [];
  private scheduleSeq = 0;
  private readonly listeners = new Set<(changed: readonly string[]) => void>();
  private readonly rng: Rng;
  private readonly advRng: Rng;
  /** AoA rays of each tag's latest packet, for the Radio layer. */
  readonly lastRays = new Map<string, AoaRay[]>();

  readonly world: WorldDef;

  constructor(world: WorldDef, options: SimOptions = {}) {
    // Private copy: commands such as opening a door must not leak into other runs.
    this.world = structuredClone(world);
    world = this.world;
    this.cfg = options.config ?? simConfig;
    this.dt = 1 / this.cfg.stepHz;
    this.rng = new Rng(options.seed ?? 1);
    this.advRng = this.rng.fork('adv');
    this.zones = new ZoneIndex(world);
    this.nav = new Navigator(world.nav);
    this.agents = new AgentSystem(world.agents, world.assets, this.nav, this.cfg, this.bus);
    this.radio = new RadioModel(world, this.cfg, this.rng.fork('rf'));
    for (const d of world.devices) this.devices.set(d.id, d);
    this.gatewaysList = world.devices.filter((d) => d.kind === 'gateway');
    this.anchorsList = world.devices.filter((d) => d.kind === 'anchor');
    this.locatorsList = world.devices.filter((d) => d.kind === 'locator');
    for (const a of this.anchorsList) if (a.roomId) this.bilinkRooms.add(a.roomId);
    this.fallbackZones = world.zones.filter(
      (z) => (z.kind === 'corridor' || z.kind === 'area') && !this.bilinkRooms.has(z.id) && !z.parent,
    );
    this.buildingZones = world.zones.filter((z) => z.kind !== 'outdoor');
    this.rssi = new RssiPositioner(this.cfg, this.gatewaysList);
    this.aoa = new AoaPositioner(this.cfg, this.rng.fork('aoa'));
    this.bilink = new Bilink(
      this.cfg,
      this.anchorsList,
      this.gatewaysList,
      this.rng.fork('bilink'),
      this.bus,
    );
    this.sensors = new SensorSystem(world, this.cfg, this.rng.fork('sensors'), this.zones);
    this.rules = new RuleEngine(world, this.cfg, this.bus, (tagId) => this.carrierOf(tagId));

    for (const def of world.tags) {
      const pos = this.computeTagPosition(def);
      this.tags.set(def.id, {
        def,
        pos,
        prevPos: { ...pos },
        nextAdv: this.advRng.range(0, this.cfg.tagAdvIntervalS[def.model]),
        lastAdv: -Infinity,
      });
    }
  }

  // ---------------------------------------------------------------- time

  /**
   * Advance by real elapsed time (already multiplied by the playback speed). Runs whole fixed steps and
   * returns the interpolation factor between the previous and the current step, in [0, 1).
   */
  advance(seconds: number): number {
    this.accumulator += Math.max(0, seconds);
    let n = 0;
    while (this.accumulator >= this.dt && n < this.cfg.maxStepsPerAdvance) {
      this.step();
      this.accumulator -= this.dt;
      n++;
    }
    if (n === this.cfg.maxStepsPerAdvance) this.accumulator = Math.min(this.accumulator, this.dt);
    return this.accumulator / this.dt;
  }

  /** Run until simulation time reaches `t` (used by tests and story seeking). */
  runUntil(t: number): void {
    while (this.time + 1e-9 < t) this.step();
  }

  step(): void {
    this.steps++;
    this.time = this.steps * this.dt;
    const t = this.time;

    this.runScheduled(t);
    this.agents.step(t, this.dt);
    for (const tag of this.tags.values()) {
      tag.prevPos = tag.pos;
      tag.pos = this.computeTagPosition(tag.def);
    }
    this.sensors.step(this.dt, (id) => this.agents.asset(id).pos);

    for (const tag of this.tags.values()) {
      // Motion-triggered advertising: a moving tag switches to its faster interval straight away.
      const moving = dist3(tag.pos, tag.prevPos) > this.cfg.tagMotionThresholdM;
      const interval = moving
        ? this.cfg.tagAdvIntervalMovingS[tag.def.model]
        : this.cfg.tagAdvIntervalS[tag.def.model];
      if (moving) tag.nextAdv = Math.min(tag.nextAdv, tag.lastAdv + interval);
      if (t < tag.nextAdv) continue;
      tag.lastAdv = t;
      tag.nextAdv = t + interval + this.advRng.range(0, 0.01);
      this.advertise(tag, t);
    }

    this.rssi.update(t);
    this.bilink.update(t);

    const changed: string[] = [];
    for (const tag of this.tags.values()) {
      const r = this.fuse(tag.def.id, t);
      if (!r) continue;
      const prev = this.fused.get(tag.def.id);
      this.fused.set(tag.def.id, r);
      if (!prev || prev.t !== r.t || prev.roomId !== r.roomId) changed.push(tag.def.id);
    }
    this.rules.update(t, this.fused, this.readings);
    if (changed.length) this.listeners.forEach((l) => l(changed));
  }

  // ---------------------------------------------------------------- commands

  command(cmd: SimCommand): void {
    const t = this.time;
    switch (cmd.type) {
      case 'goTo':
        this.agents.command(cmd.agentId, [{ to: cmd.to, dwellS: cmd.dwellS ?? 0 }], cmd.replace ?? true);
        break;
      case 'route':
        this.agents.command(cmd.agentId, cmd.steps, cmd.replace ?? true);
        break;
      case 'setRoutine':
        this.agents.setRoutine(cmd.agentId, cmd.steps, cmd.loop);
        break;
      case 'pickup':
        this.agents.pickup(cmd.agentId, cmd.assetId, t);
        break;
      case 'drop':
        this.agents.drop(cmd.agentId, cmd.assetId, t, cmd.at);
        break;
      case 'moveAsset':
        this.agents.moveAsset(cmd.assetId, cmd.to, t);
        break;
      case 'moveAgent':
        this.agents.moveAgent(cmd.agentId, cmd.to);
        break;
      case 'dismount':
        this.agents.dismount(cmd.agentId);
        break;
      case 'setDoor': {
        if (this.sensors.setFridgeDoor(cmd.doorId, cmd.open)) {
          this.bus.emit({ type: 'door.changed', t, doorId: cmd.doorId, open: cmd.open });
          break;
        }
        const door = this.world.doors.find((d) => d.id === cmd.doorId);
        if (!door || door.open === cmd.open) break;
        door.open = cmd.open;
        this.radio.rebuild();
        this.bus.emit({ type: 'door.changed', t, doorId: cmd.doorId, open: cmd.open });
        break;
      }
      case 'pressButton':
        this.rules.pressButton(cmd.tagId, t, this.fused);
        break;
      case 'acknowledge':
        this.rules.acknowledge(cmd.alertId, t);
        break;
    }
  }

  /** Run a command when simulation time reaches `t`. */
  schedule(t: number, cmd: SimCommand): void {
    this.scheduled.push({ t, seq: this.scheduleSeq++, cmd });
    this.scheduled.sort((a, b) => a.t - b.t || a.seq - b.seq);
  }

  private runScheduled(t: number): void {
    while (this.scheduled.length && (this.scheduled[0] as { t: number }).t <= t + 1e-9) {
      const item = this.scheduled.shift();
      if (item) this.command(item.cmd);
    }
  }

  // ---------------------------------------------------------------- radio

  private advertise(tag: TagRuntime, t: number): void {
    const rays: AoaRay[] = [];
    let heard = false;
    let keys = this.linkKeys.get(tag.def.id);
    if (!keys) {
      keys = this.world.devices.map((d) => `${tag.def.id}|${d.id}`);
      this.linkKeys.set(tag.def.id, keys);
    }
    const devices = this.world.devices;
    for (let i = 0; i < devices.length; i++) {
      const d = devices[i] as InfraDeviceDef;
      const rx = this.cfg.receivers[d.model];
      // Cheap squared-distance rejection first (with a margin, so the exact test decides every close call).
      const dx = tag.pos.x - d.position.x;
      const dy = tag.pos.y - d.position.y;
      const dz = tag.pos.z - d.position.z;
      const far = rx.rangeM + 1e-6;
      if (dx * dx + dy * dy + dz * dz > far * far) continue;
      if (dist3(tag.pos, d.position) > rx.rangeM) continue;
      const rssi = this.radio.sample(tag.pos, d.position, keys[i] as string);
      if (rssi < rx.sensitivityDbm) continue;
      heard = true;
      if (d.kind === 'gateway') this.rssi.ingest(tag.def.id, d.id, rssi, t);
      else if (d.kind === 'anchor') this.bilink.ingest(d.id, tag.def.id, rssi, t);
      else {
        const ray = this.aoa.measure(d, tag.pos);
        if (ray) rays.push(ray);
      }
    }
    if (rays.length) {
      this.aoa.ingest(tag.def.id, rays, t);
      this.lastRays.set(tag.def.id, rays);
    } else this.lastRays.delete(tag.def.id);
    if (!heard) return;
    this.seen.set(tag.def.id, t);
    const values = this.sensors.readTag(tag.def);
    for (const [metric, value] of Object.entries(values) as Array<[SensorKind, number]>) {
      let m = this.readings.get(tag.def.id);
      if (!m) {
        m = new Map();
        this.readings.set(tag.def.id, m);
      }
      m.set(metric, { value, t });
      const key = `${tag.def.id}|${metric}`;
      if (t - (this.lastReadingEmit.get(key) ?? -Infinity) >= 1) {
        this.lastReadingEmit.set(key, t);
        this.bus.emit({ type: 'sensor.reading', t, tagId: tag.def.id, metric, value });
      }
    }
  }

  // ---------------------------------------------------------------- fusion

  /** Hybrid: AoA where covered, otherwise BiLink room, otherwise RSSI (SPEC section 6). */
  private fuse(tagId: string, t: number): ReportedPosition | undefined {
    const aoa = this.aoa.get(tagId, t);
    if (aoa?.position) return this.pointReport(aoa, aoa.position);
    const bl = this.bilink.get(tagId, t);
    if (bl?.roomId) {
      return {
        tagId,
        tech: 'bilink',
        t: bl.t,
        roomId: bl.roomId,
        zoneIds: this.zones.withAncestors(bl.roomId),
      };
    }
    // After BiLink reports that a tag left its room, an RSSI fix only counts if it is based on packets
    // received after that moment; older samples describe where the tag was, not where it is.
    const asg = this.bilink.assignment(tagId);
    const leftRoomAt = asg && asg.roomId === null ? asg.since : -Infinity;
    const rs = this.rssi.get(tagId, t);
    if (rs?.position && (rs.from ?? rs.t) > leftRoomAt) {
      let p: Vec3 = rs.position;
      // BiLink negative evidence: a room with an anchor that does not report the tag is not where the tag
      // is, so an RSSI fix inside such a room is moved to the nearest zone without an anchor.
      const room = this.bilinkRooms.size ? this.zones.roomAt(p) : null;
      if (room && this.bilinkRooms.has(room) && bl?.roomId !== room && this.fallbackZones.length) {
        let best = p as Vec2;
        let bestD = Infinity;
        for (const z of this.fallbackZones) {
          const q = clampToPolygon(p, z.polygon);
          const d = dist2(p, q);
          if (d < bestD) {
            bestD = d;
            best = q;
          }
        }
        p = { ...p, x: best.x, y: best.y };
      }
      return this.pointReport(rs, p);
    }
    const prev = this.fused.get(tagId);
    if (!prev) return undefined;
    return prev.held ? prev : { ...prev, held: true, heldSince: t };
  }

  private pointReport(e: Estimate, p: Vec3): ReportedPosition {
    // Same estimate and position as last step: the same report (zone lookup skipped).
    const cached = this.pointReports.get(e.tagId);
    if (cached && cached.e === e && cached.p === p) return cached.r;
    const r = this.buildPointReport(e, p);
    this.pointReports.set(e.tagId, { e, p, r });
    return r;
  }

  private buildPointReport(e: Estimate, p: Vec3): ReportedPosition {
    const zoneIds = this.zones.zonesAt(p);
    return {
      tagId: e.tagId,
      tech: e.tech,
      t: e.t,
      position: p,
      ...(e.uncertaintyM !== undefined ? { uncertaintyM: e.uncertaintyM } : {}),
      zoneIds,
    };
  }

  // ---------------------------------------------------------------- queries (PositionSource)

  report(tagId: string): ReportedPosition | undefined {
    return this.fused.get(tagId);
  }

  reports(): ReadonlyMap<string, ReportedPosition> {
    return this.fused;
  }

  estimate(tagId: string, tech: Tech): Estimate | undefined {
    if (tech === 'rssi') return this.rssi.get(tagId, this.time);
    if (tech === 'aoa') return this.aoa.get(tagId, this.time);
    return this.bilink.get(tagId, this.time);
  }

  lastSeen(tagId: string): number | undefined {
    return this.seen.get(tagId);
  }

  subscribe(listener: (changed: readonly string[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------------------------------------------------------------- ground truth (debug view, tests)

  tagIds(): string[] {
    return [...this.tags.keys()];
  }

  tagDef(tagId: string): TagDef {
    const t = this.tags.get(tagId);
    if (!t) throw new Error(`unknown tag ${tagId}`);
    return t.def;
  }

  /** True position of a tag at the current step. */
  truth(tagId: string): Vec3 {
    const t = this.tags.get(tagId);
    if (!t) throw new Error(`unknown tag ${tagId}`);
    return t.pos;
  }

  /** True position interpolated between the previous and current step, for rendering. */
  truthInterpolated(tagId: string, alpha: number): Vec3 {
    const t = this.tags.get(tagId);
    if (!t) throw new Error(`unknown tag ${tagId}`);
    return lerp3(t.prevPos, t.pos, alpha);
  }

  /** Room or corridor the tag is really in. */
  truthRoom(tagId: string): string | null {
    return this.zones.roomAt(this.truth(tagId));
  }

  lastAdvertised(tagId: string): number {
    return this.tags.get(tagId)?.lastAdv ?? -Infinity;
  }

  device(id: string): InfraDeviceDef {
    const d = this.devices.get(id);
    if (!d) throw new Error(`unknown device ${id}`);
    return d;
  }

  reading(tagId: string, metric: SensorKind): SensorReading | undefined {
    return this.readings.get(tagId)?.get(metric);
  }

  insideBuilding(p: Vec2): boolean {
    return this.buildingZones.some((z) => pointInPolygon(p, z.polygon));
  }

  carrierOf(tagId: string): CarrierKind | undefined {
    const def = this.tags.get(tagId)?.def ?? this.world.tags.find((x) => x.id === tagId);
    if (!def) return undefined;
    if (def.carrier.type === 'agent') {
      const a = this.agents.agents.get(def.carrier.id);
      return a ? { type: 'agent', role: a.role } : undefined;
    }
    const s = this.agents.assets.get(def.carrier.id);
    return s ? { type: 'asset', cls: s.cls } : undefined;
  }

  private computeTagPosition(def: TagDef): Vec3 {
    if (def.carrier.type === 'agent') {
      const a = this.agents.get(def.carrier.id);
      return { x: a.pos.x, y: a.pos.y, z: def.mountHeightM };
    }
    const s = this.agents.asset(def.carrier.id);
    return { x: s.pos.x, y: s.pos.y, z: s.pos.z + def.mountHeightM };
  }
}
