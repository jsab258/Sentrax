import type { SimConfig } from './config';
import type { EventBus } from './events';
import type { Vec2, Vec3 } from './geometry';
import type { Navigator } from './nav';
import type { AgentDef, AgentRole, AssetDef, RoutineStep } from './world';

export interface AgentState {
  id: string;
  role: AgentRole;
  kind: 'person' | 'vehicle';
  pos: Vec2;
  prevPos: Vec2;
  /** Radians, 0 = +x, counter-clockwise. */
  heading: number;
  speedMps: number;
  /** Remaining waypoints of the current leg. */
  path: Vec2[];
  /** Nav node of the current leg's destination, or where the agent stands. */
  node: string;
  mode: 'idle' | 'moving' | 'dwelling' | 'riding';
  dwellUntil: number;
  /** Queued commands run before the routine continues. */
  queue: RoutineStep[];
  routine: RoutineStep[];
  routineIndex: number;
  loop: boolean;
  /** The step being executed on arrival. */
  current: RoutineStep | null;
  carrying: string[];
  rideOn: string | null;
  /** Forklifts: height of the load on the forks (m). */
  forkZ: number;
}

export interface AssetState {
  id: string;
  cls: AssetDef['cls'];
  pos: Vec3;
  prevPos: Vec3;
  heading: number;
  carriedBy: string | null;
  /** A trailer being towed: its rear axle point, which follows the tractor (plan). */
  towRear?: Vec2;
  /** A load inside a trailer: the trailer and the load's place in the trailer's frame. */
  inside?: { id: string; along: number; across: number; heading: number } | null;
}

/** Moves agents along nav graph routes with dwell times; carried assets follow their carrier. */
export class AgentSystem {
  readonly agents = new Map<string, AgentState>();
  readonly assets = new Map<string, AssetState>();

  constructor(
    agents: AgentDef[],
    assets: AssetDef[],
    private readonly nav: Navigator,
    private readonly cfg: SimConfig,
    private readonly bus: EventBus,
  ) {
    for (const a of assets) {
      this.assets.set(a.id, {
        id: a.id,
        cls: a.cls,
        pos: { ...a.position },
        prevPos: { ...a.position },
        heading: ((a.headingDeg ?? 0) * Math.PI) / 180,
        carriedBy: null,
      });
    }
    for (const def of agents) {
      const p = nav.position(def.start);
      this.agents.set(def.id, {
        id: def.id,
        role: def.role,
        kind: def.kind,
        pos: { ...p },
        prevPos: { ...p },
        heading: 0,
        speedMps: def.speedMps ?? this.defaultSpeed(def),
        path: [],
        node: def.start,
        mode: def.rideOn ? 'riding' : 'idle',
        dwellUntil: 0,
        queue: [],
        routine: def.routine ?? [],
        routineIndex: 0,
        loop: def.loop ?? true,
        current: null,
        carrying: [],
        rideOn: def.rideOn ?? null,
        forkZ: this.cfg.agents.forkTravelM,
      });
    }
  }

  private defaultSpeed(def: AgentDef): number {
    const a = this.cfg.agents;
    if (def.role === 'forklift') return a.forkliftMps;
    if (def.role === 'yard_tractor') return a.tractorMps;
    return a.walkMps;
  }

  get(id: string): AgentState {
    const a = this.agents.get(id);
    if (!a) throw new Error(`unknown agent ${id}`);
    return a;
  }

  asset(id: string): AssetState {
    const a = this.assets.get(id);
    if (!a) throw new Error(`unknown asset ${id}`);
    return a;
  }

  /** Queue steps for an agent. With `replace`, the current leg and queue are dropped first. */
  command(agentId: string, steps: RoutineStep[], replace = true): void {
    const a = this.get(agentId);
    if (a.mode === 'riding') return;
    if (replace) {
      a.queue = [];
      a.path = [];
      a.current = null;
      a.mode = 'idle';
      a.dwellUntil = 0;
    }
    a.queue.push(...steps);
  }

  setRoutine(agentId: string, routine: RoutineStep[], loop: boolean): void {
    const a = this.get(agentId);
    a.routine = routine;
    a.routineIndex = 0;
    a.loop = loop;
  }

  dismount(agentId: string): void {
    const a = this.get(agentId);
    if (a.mode !== 'riding') return;
    a.rideOn = null;
    a.mode = 'idle';
    a.node = this.nav.nearest(a.pos);
    a.pos = { ...this.nav.position(a.node) };
  }

  pickup(agentId: string, assetId: string, t: number): boolean {
    const agent = this.get(agentId);
    const asset = this.asset(assetId);
    if (asset.carriedBy) return false;
    if (Math.hypot(asset.pos.x - agent.pos.x, asset.pos.y - agent.pos.y) > this.cfg.agents.pickupReachM)
      return false;
    asset.carriedBy = agentId;
    asset.inside = null;
    // A forklift lifts the load from where it stands (a rack level), then lowers it to travel height.
    if (agent.role === 'forklift') agent.forkZ = Math.max(asset.pos.z, this.cfg.agents.forkTravelM);
    if (agent.role === 'yard_tractor' && asset.cls === 'trailer') {
      const L = this.cfg.agents.trailerAxleM;
      asset.towRear = {
        x: asset.pos.x + Math.cos(asset.heading) * L,
        y: asset.pos.y + Math.sin(asset.heading) * L,
      };
    }
    agent.carrying.push(assetId);
    this.bus.emit({ type: 'asset.pickedUp', t, agentId, assetId });
    return true;
  }

  drop(agentId: string, assetId: string, t: number, at?: Vec3): void {
    const agent = this.get(agentId);
    const asset = this.asset(assetId);
    if (asset.carriedBy !== agentId) return;
    asset.carriedBy = null;
    agent.carrying = agent.carrying.filter((id) => id !== assetId);
    asset.towRear = undefined;
    if (at) asset.pos = { ...at };
    else asset.pos = { ...asset.pos, z: 0 };
    if (asset.cls !== 'trailer') asset.inside = this.trailerAround(asset);
    this.bus.emit({ type: 'asset.dropped', t, agentId, assetId, at: { ...asset.pos } });
  }

  /** The parked trailer a dropped load sits in, with the load's place in the trailer's frame. */
  private trailerAround(load: AssetState): AssetState['inside'] {
    const { trailerLengthM: L, trailerWidthM: W } = this.cfg.agents;
    for (const tr of this.assets.values()) {
      if (tr.cls !== 'trailer' || tr.carriedBy) continue;
      const dx = load.pos.x - tr.pos.x;
      const dy = load.pos.y - tr.pos.y;
      const along = dx * Math.cos(tr.heading) + dy * Math.sin(tr.heading);
      const across = -dx * Math.sin(tr.heading) + dy * Math.cos(tr.heading);
      if (along >= 0 && along <= L && Math.abs(across) <= W / 2)
        return { id: tr.id, along, across, heading: load.heading - tr.heading };
    }
    return null;
  }

  /** Sandbox drag: teleport an asset (dropping it if carried). */
  moveAsset(assetId: string, to: Vec3, t: number): void {
    const asset = this.asset(assetId);
    if (asset.carriedBy) this.drop(asset.carriedBy, assetId, t);
    asset.pos = { ...to };
    asset.prevPos = { ...to };
  }

  /** Sandbox drag for people: teleport to the nearest nav node and pause the routine. */
  moveAgent(agentId: string, to: Vec2): void {
    const a = this.get(agentId);
    if (a.mode === 'riding') return;
    a.node = this.nav.nearest(to);
    a.pos = { ...to };
    a.prevPos = { ...to };
    a.path = [];
    a.queue = [];
    a.current = null;
    a.mode = 'dwelling';
    a.dwellUntil = Infinity;
  }

  step(t: number, dt: number): void {
    for (const a of this.agents.values()) {
      a.prevPos = { ...a.pos };
      if (a.mode === 'riding') continue;
      if (a.mode === 'dwelling') {
        if (t < a.dwellUntil) continue;
        a.mode = 'idle';
      }
      if (a.mode === 'idle') this.startNextLeg(a);
      if (a.mode === 'moving') this.move(a, t, dt);
    }
    // Riders follow their vehicle.
    for (const a of this.agents.values()) {
      if (a.mode !== 'riding' || !a.rideOn) continue;
      const v = this.agents.get(a.rideOn);
      if (!v) continue;
      a.pos = { ...v.pos };
      a.heading = v.heading;
    }
    // Carried assets sit just ahead of their carrier.
    for (const asset of this.assets.values()) {
      asset.prevPos = { ...asset.pos };
      if (!asset.carriedBy) continue;
      const c = this.agents.get(asset.carriedBy);
      if (!c) continue;
      if (c.role === 'yard_tractor' && asset.cls === 'trailer') {
        this.tow(c, asset);
        continue;
      }
      const k =
        c.kind === 'vehicle' ? this.cfg.agents.carryOffsetForkliftM : this.cfg.agents.carryOffsetPersonM;
      let z = c.kind === 'vehicle' ? this.cfg.agents.forkTravelM : 0;
      if (c.role === 'forklift') {
        c.forkZ = Math.max(this.cfg.agents.forkTravelM, c.forkZ - this.cfg.agents.forkLowerMps * dt);
        z = c.forkZ;
      }
      asset.pos = { x: c.pos.x + Math.cos(c.heading) * k, y: c.pos.y + Math.sin(c.heading) * k, z };
      asset.heading = c.heading;
    }
    // Loads inside a trailer move with it.
    for (const asset of this.assets.values()) {
      if (!asset.inside || asset.carriedBy) continue;
      const tr = this.assets.get(asset.inside.id);
      if (!tr) continue;
      const { along, across } = asset.inside;
      const h = tr.heading;
      asset.pos = {
        x: tr.pos.x + Math.cos(h) * along - Math.sin(h) * across,
        y: tr.pos.y + Math.sin(h) * along + Math.cos(h) * across,
        z: asset.pos.z,
      };
      asset.heading = h + asset.inside.heading;
    }
  }

  /**
   * A towed trailer: its nose (the asset position, where the tag sits) rides on the tractor's fifth
   * wheel and its rear axle follows at a fixed distance, so the trailer swings in behind on turns.
   */
  private tow(c: AgentState, trailer: AssetState): void {
    const { fifthWheelM: F, trailerAxleM: L } = this.cfg.agents;
    const fx = c.pos.x - Math.cos(c.heading) * F;
    const fy = c.pos.y - Math.sin(c.heading) * F;
    const rear = trailer.towRear ?? {
      x: fx + Math.cos(trailer.heading) * L,
      y: fy + Math.sin(trailer.heading) * L,
    };
    const dx = rear.x - fx;
    const dy = rear.y - fy;
    const d = Math.hypot(dx, dy) || 1;
    trailer.towRear = { x: fx + (dx / d) * L, y: fy + (dy / d) * L };
    trailer.pos = { x: fx, y: fy, z: 0 };
    trailer.heading = Math.atan2(dy, dx);
  }

  private startNextLeg(a: AgentState): void {
    let step = a.queue.shift();
    if (!step && a.routine.length) {
      if (a.routineIndex >= a.routine.length) {
        if (!a.loop) return;
        a.routineIndex = 0;
      }
      step = a.routine[a.routineIndex++];
    }
    if (!step) return;
    a.current = step;
    const nodes = this.nav.path(a.node, step.to);
    a.path = nodes.slice(1).map((id) => ({ ...this.nav.position(id) }));
    a.node = step.to;
    a.mode = 'moving';
  }

  private move(a: AgentState, t: number, dt: number): void {
    let budget = a.speedMps * dt;
    while (budget > 0 && a.path.length) {
      const target = a.path[0] as Vec2;
      const dx = target.x - a.pos.x;
      const dy = target.y - a.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-6) a.heading = Math.atan2(dy, dx) + (a.current?.reverse ? Math.PI : 0);
      if (d <= budget) {
        a.pos = { ...target };
        a.path.shift();
        budget -= d;
      } else {
        a.pos = { x: a.pos.x + (dx / d) * budget, y: a.pos.y + (dy / d) * budget };
        budget = 0;
      }
    }
    if (a.path.length) return;
    const step = a.current;
    a.current = null;
    this.bus.emit({ type: 'agent.arrived', t, agentId: a.id, nodeId: a.node });
    if (step?.drop) this.drop(a.id, step.drop, t, step.dropAt);
    if (step?.pickup) this.pickup(a.id, step.pickup, t);
    a.mode = 'dwelling';
    a.dwellUntil = t + (step?.dwellS ?? 0);
  }
}
