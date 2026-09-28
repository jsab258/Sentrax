import { InstancedMesh, Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import type { AgentState } from '../../sim/agents';
import type { Simulation } from '../../sim/engine';
import type { Elevation } from '../elevation';
import type { ModelParts } from '../kit/instancing';
import type { Bucket } from '../kit/parts';
import type { Palette } from '../materials/palette';

const TURN_RATE = 6;
/** Fork carriage height with no load (blades just above the floor). */
const FORKS_DOWN = 0.08;
/** Carriage rise and fall speed when following a load (m/s), for a smooth mast motion. */
const LIFT_MPS = 0.8;

interface Driven {
  agent: AgentState;
  yaw: number;
  forkY: number;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _one = new Vector3(1, 1, 1);
const _up = new Vector3(0, 1, 0);

function meshes(
  parts: ModelParts,
  count: number,
  palette: Palette,
  cast: boolean,
  name: string,
): InstancedMesh[] {
  return (Object.entries(parts) as Array<[Bucket, NonNullable<ModelParts[Bucket]>]>).map(([mat, g]) => {
    const m = new InstancedMesh(g, palette.mats[mat], count);
    m.name = `${name}:${mat}`;
    m.castShadow = cast && mat !== 'screen';
    m.receiveShadow = true;
    m.frustumCulled = false;
    return m;
  });
}

/**
 * Forklifts and the yard tractor. Positions come from the simulation, interpolated between steps; turns
 * are smoothed. A forklift's carriage follows the height of the pallet it carries.
 */
export class VehicleSystem {
  readonly objects: Object3D[] = [];
  private readonly forklifts: Driven[];
  private readonly tractors: Driven[];
  private readonly forkliftMeshes: InstancedMesh[];
  private readonly carriageMeshes: InstancedMesh[];
  private readonly tractorMeshes: InstancedMesh[];

  constructor(
    private readonly sim: Simulation,
    models: { forklift: ModelParts; carriage: ModelParts; tractor: ModelParts },
    palette: Palette,
    castShadow: boolean,
    private readonly ground: Elevation,
  ) {
    const vehicles = [...sim.agents.agents.values()].filter((a) => a.kind === 'vehicle');
    const driven = (a: AgentState): Driven => ({ agent: a, yaw: a.heading, forkY: FORKS_DOWN });
    this.forklifts = vehicles.filter((a) => a.role === 'forklift').map(driven);
    this.tractors = vehicles.filter((a) => a.role === 'yard_tractor').map(driven);
    this.forkliftMeshes = meshes(
      models.forklift,
      Math.max(1, this.forklifts.length),
      palette,
      castShadow,
      'forklift',
    );
    this.carriageMeshes = meshes(
      models.carriage,
      Math.max(1, this.forklifts.length),
      palette,
      castShadow,
      'forks',
    );
    this.tractorMeshes = meshes(
      models.tractor,
      Math.max(1, this.tractors.length),
      palette,
      castShadow,
      'tractor',
    );
    this.objects.push(...this.forkliftMeshes, ...this.carriageMeshes, ...this.tractorMeshes);
  }

  /** Interpolated plan position and smoothed yaw of a vehicle, in three.js coordinates. */
  private place(d: Driven, alpha: number, dt: number): Vector3 {
    const a = d.agent;
    const x = a.prevPos.x + (a.pos.x - a.prevPos.x) * alpha;
    const y = a.prevPos.y + (a.pos.y - a.prevPos.y) * alpha;
    const turn = Math.atan2(Math.sin(a.heading - d.yaw), Math.cos(a.heading - d.yaw));
    d.yaw += turn * Math.min(1, dt * TURN_RATE);
    return _p.set(x, this.ground(x, y), -y);
  }

  update(alpha: number, delta: number): void {
    const dt = Math.min(delta, 0.1);
    this.forklifts.forEach((d, i) => {
      const pos = this.place(d, alpha, dt);
      _q.setFromAxisAngle(_up, d.yaw);
      _m.compose(pos, _q, _one);
      for (const m of this.forkliftMeshes) m.setMatrixAt(i, _m);
      // Carriage: at the carried pallet's base, else down.
      const load = d.agent.carrying[0];
      const target = load ? (this.sim.agents.assets.get(load)?.pos.z ?? FORKS_DOWN) : FORKS_DOWN;
      const step = LIFT_MPS * dt;
      d.forkY += Math.max(-step, Math.min(step, target - d.forkY));
      if (Math.abs(target - d.forkY) > 2) d.forkY = target;
      _m.compose(_p.set(pos.x, pos.y + d.forkY, pos.z), _q, _one);
      for (const m of this.carriageMeshes) m.setMatrixAt(i, _m);
    });
    this.tractors.forEach((d, i) => {
      const pos = this.place(d, alpha, dt);
      _q.setFromAxisAngle(_up, d.yaw);
      _m.compose(pos, _q, _one);
      for (const m of this.tractorMeshes) m.setMatrixAt(i, _m);
    });
    for (const m of [...this.forkliftMeshes, ...this.carriageMeshes, ...this.tractorMeshes]) {
      m.count = m.name.startsWith('tractor') ? this.tractors.length : this.forklifts.length;
      m.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const o of this.objects) (o as InstancedMesh).dispose();
  }
}
