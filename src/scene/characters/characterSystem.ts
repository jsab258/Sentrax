import { Color, InstancedMesh, Matrix4, Vector3, type Object3D } from 'three';
import type { AgentState } from '../../sim/agents';
import type { Simulation } from '../../sim/engine';
import type { FigureDef, TagModel } from '../../sim/world';
import type { ModelParts } from '../kit/instancing';
import type { Bucket } from '../kit/parts';
import type { Palette } from '../materials/palette';
import { CLOTHED, mannequinParts, OUTFITS, type PartName } from './mannequin';
import { poseCharacter, type CharacterState } from './pose';

const STRIDE_M = 1.35;
const TURN_RATE = 9;
/** Height of a lying figure's centre line: the back sinks into the mattress, the front stays under the blanket. */
const LYING_Y = 0.64;

interface Walker {
  yaw: number;
  phase: number;
  last: Vector3;
  speed: number;
}

const _pos = new Vector3();
const _c = new Color();

/**
 * Instanced mannequins for everyone in a scene. One InstancedMesh per body part; per-instance colours
 * dress each figure for its role. Updated once per frame from the simulation.
 */
export class CharacterSystem {
  readonly objects: Object3D[] = [];
  private readonly meshes = {} as Record<PartName, InstancedMesh>;
  private readonly worn: Array<{ mesh: InstancedMesh; owners: string[]; at: 'chest' | 'wrist' }> = [];
  private readonly walkers = new Map<string, Walker>();
  private readonly parts = mannequinParts();
  private readonly people: AgentState[];
  private readonly figures: FigureDef[];

  constructor(
    sim: Simulation,
    palette: Palette,
    opts: { showFigures: boolean; castShadow: boolean; tagModels: Partial<Record<TagModel, ModelParts>> },
  ) {
    this.people = [...sim.agents.agents.values()].filter((a) => a.kind === 'person');
    this.figures = opts.showFigures ? sim.world.figures : [];
    const count = this.people.length + this.figures.length;
    const roles = [...this.people.map((a) => a.role as string), ...this.figures.map(() => 'patient')];
    for (const [name, p] of Object.entries(this.parts) as Array<[PartName, (typeof this.parts)[PartName]]>) {
      const per = name === 'upperArm' || name === 'forearm' || name === 'thigh' || name === 'shin' ? 2 : 1;
      const mesh = new InstancedMesh(p.geometry, palette.mats[p.mat], Math.max(1, count * per));
      mesh.name = `character:${name}`;
      mesh.castShadow = opts.castShadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const slot = CLOTHED[name];
      roles.forEach((role, i) => {
        const outfit = OUTFITS[role] ?? OUTFITS.default;
        const c = slot && outfit ? outfit[slot] : ([1, 1, 1] as const);
        for (let k = 0; k < per; k++) mesh.setColorAt(i * per + k, _c.setRGB(c[0], c[1], c[2]));
      });
      this.meshes[name] = mesh;
      this.objects.push(mesh);
    }
    // Worn tags: a badge for every tagged person, the SOS wearable on the wrist.
    const worn = sim.world.tags.filter((t) => t.carrier.type === 'agent');
    for (const model of ['PINIX TOK-1', 'PINIX TOB-1'] as const) {
      const owners = worn.filter((t) => t.model === model).map((t) => t.carrier.id);
      const parts = opts.tagModels[model];
      if (!owners.length || !parts) continue;
      for (const [mat, g] of Object.entries(parts) as Array<[Bucket, NonNullable<ModelParts[Bucket]>]>) {
        const mesh = new InstancedMesh(g, palette.mats[mat], owners.length);
        mesh.name = `worn:${model}:${mat}`;
        mesh.frustumCulled = false;
        this.worn.push({ mesh, owners, at: model === 'PINIX TOK-1' ? 'chest' : 'wrist' });
        this.objects.push(mesh);
      }
    }
  }

  update(alpha: number, delta: number, time: number): void {
    const dt = Math.min(delta, 0.1);
    const counters: Partial<Record<PartName, number>> = {};
    const place = (s: CharacterState) => {
      const res = poseCharacter(s);
      for (const { part, matrix } of res.parts) {
        const i = counters[part] ?? 0;
        this.meshes[part].setMatrixAt(i, matrix);
        counters[part] = i + 1;
      }
      return res;
    };
    const anchors = new Map<string, { chest: Matrix4; wrist: Matrix4 }>();
    for (const a of this.people) {
      _pos.set(
        a.prevPos.x + (a.pos.x - a.prevPos.x) * alpha,
        0,
        -(a.prevPos.y + (a.pos.y - a.prevPos.y) * alpha),
      );
      let w = this.walkers.get(a.id);
      if (!w) {
        w = { yaw: a.heading, phase: 0, last: _pos.clone(), speed: 0 };
        this.walkers.set(a.id, w);
      }
      const moved = w.last.distanceTo(_pos);
      w.last.copy(_pos);
      w.speed += (moved / Math.max(dt, 1e-3) - w.speed) * Math.min(1, dt * 8);
      w.phase += (moved / STRIDE_M) * Math.PI * 2;
      // Turn smoothly towards the simulation heading along the shortest arc.
      const d = Math.atan2(Math.sin(a.heading - w.yaw), Math.cos(a.heading - w.yaw));
      w.yaw += d * Math.min(1, dt * TURN_RATE);
      const pose = w.speed > 0.15 ? (a.carrying.length ? 'push' : 'walk') : 'idle';
      const res = place({
        id: a.id,
        role: a.role,
        position: _pos,
        yaw: w.yaw,
        pose,
        phase: w.phase,
        time: time + a.id.length,
      });
      anchors.set(a.id, { chest: res.chest, wrist: res.wrist });
    }
    for (const f of this.figures) {
      const h = (f.headingDeg * Math.PI) / 180;
      // Feet towards the foot of the bed, head on the pillow.
      _pos.set(f.position.x - Math.cos(h) * 0.86, LYING_Y, -(f.position.y - Math.sin(h) * 0.86));
      place({ id: f.id, role: 'patient', position: _pos, yaw: h, pose: 'lie', phase: 0, time });
    }
    for (const m of Object.values(this.meshes)) m.instanceMatrix.needsUpdate = true;
    for (const { mesh, owners, at } of this.worn) {
      owners.forEach((id, i) => {
        const a = anchors.get(id);
        if (a) mesh.setMatrixAt(i, at === 'chest' ? a.chest : a.wrist);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const o of this.objects) (o as InstancedMesh).dispose();
    for (const p of Object.values(this.parts)) p.geometry.dispose();
  }
}
