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
}

export interface AssetState {
  id: string;
  cls: AssetDef['cls'];
  pos: Vec3;
  prevPos: Vec3;
  heading: number;
  carriedBy: string | null;
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
    if (at) asset.pos = { ...at };
    else asset.pos = { ...asset.pos, z: 0 };
    this.bus.emit({ type: 'asset.dropped', t, agentId, assetId, at: { ...asset.pos } });
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
      const k =
        c.kind === 'vehicle' ? this.cfg.agents.carryOffsetForkliftM : this.cfg.agents.carryOffsetPersonM;
      const z = c.role === 'yard_tractor' ? 0 : c.kind === 'vehicle' ? 0.3 : 0;
      asset.pos = { x: c.pos.x + Math.cos(c.heading) * k, y: c.pos.y + Math.sin(c.heading) * k, z };
      asset.heading = c.heading;
    }
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
      if (d > 1e-6) a.heading = Math.atan2(dy, dx);
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
