import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { Simulation } from '../../sim/engine';
import type { AssetClass, TagModel } from '../../sim/world';
import type { Palette } from '../materials/palette';
import { simFrame } from '../simRuntime';
import type { ModelParts } from './instancing';
import type { Bucket } from './parts';

interface Group {
  meshes: InstancedMesh[];
  /** Asset ids in instance order. */
  ids: string[];
  /** Per-instance extra transform (tag mounts); none for the equipment itself. */
  locals?: Matrix4[];
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _one = new Vector3(1, 1, 1);
const _up = new Vector3(0, 1, 0);

function meshesFor(parts: ModelParts, count: number, palette: Palette, cast: boolean, name: string) {
  return (Object.entries(parts) as Array<[Bucket, NonNullable<ModelParts[Bucket]>]>).map(([mat, g]) => {
    const mesh = new InstancedMesh(g, palette.mats[mat], count);
    mesh.name = `${name}:${mat}`;
    mesh.castShadow = cast && mat !== 'screen';
    mesh.receiveShadow = true;
    // Instances move every frame, so the bounds computed at creation would cull wrongly.
    mesh.frustumCulled = false;
    return mesh;
  });
}

/**
 * Equipment that the simulation moves (carried, pushed or parked), with its tags. Transforms are read
 * from the simulation every frame, interpolated between steps, and turns are smoothed.
 */
class AssetSystem {
  readonly objects: InstancedMesh[] = [];
  private readonly groups: Group[] = [];
  private readonly yaw = new Map<string, number>();

  constructor(
    private readonly sim: Simulation,
    models: Partial<Record<AssetClass, ModelParts>>,
    tagModels: Partial<Record<TagModel, ModelParts>>,
    tagMounts: Partial<Record<AssetClass, TagMount>>,
    palette: Palette,
    castShadow: boolean,
  ) {
    const assets = [...sim.agents.assets.values()];
    for (const [cls, parts] of Object.entries(models) as Array<[AssetClass, ModelParts]>) {
      const ids = assets.filter((a) => a.cls === cls).map((a) => a.id);
      if (ids.length)
        this.groups.push({ meshes: meshesFor(parts, ids.length, palette, castShadow, cls), ids });
    }
    // Tags on assets: one group per tag model, each instance with its class's mount.
    const byModel = new Map<TagModel, { ids: string[]; locals: Matrix4[] }>();
    for (const t of sim.world.tags) {
      if (t.carrier.type !== 'asset') continue;
      const cls = sim.agents.assets.get(t.carrier.id)?.cls;
      const mount = cls && tagMounts[cls];
      if (!mount) continue;
      const entry = byModel.get(t.model) ?? { ids: [], locals: [] };
      entry.ids.push(t.carrier.id);
      entry.locals.push(
        new Matrix4().compose(
          new Vector3(...mount.at),
          new Quaternion().setFromEuler(new Euler(...mount.rot)),
          new Vector3(1, 1, 1),
        ),
      );
      byModel.set(t.model, entry);
    }
    for (const [model, { ids, locals }] of byModel) {
      const parts = tagModels[model];
      if (parts)
        this.groups.push({
          meshes: meshesFor(parts, ids.length, palette, false, `tag-${model}`),
          ids,
          locals,
        });
    }
    for (const g of this.groups) this.objects.push(...g.meshes);
  }

  update(alpha: number, delta: number): void {
    const k = Math.min(1, Math.min(delta, 0.1) * 9);
    for (const a of this.sim.agents.assets.values()) {
      const prev = this.yaw.get(a.id);
      if (prev === undefined) this.yaw.set(a.id, a.heading);
      else this.yaw.set(a.id, prev + Math.atan2(Math.sin(a.heading - prev), Math.cos(a.heading - prev)) * k);
    }
    for (const g of this.groups) {
      g.ids.forEach((id, i) => {
        const a = this.sim.agents.asset(id);
        _p.set(
          a.prevPos.x + (a.pos.x - a.prevPos.x) * alpha,
          a.prevPos.z + (a.pos.z - a.prevPos.z) * alpha,
          -(a.prevPos.y + (a.pos.y - a.prevPos.y) * alpha),
        );
        _q.setFromAxisAngle(_up, this.yaw.get(id) ?? a.heading);
        _m.compose(_p, _q, _one);
        const local = g.locals?.[i];
        if (local) _m.multiply(local);
        for (const mesh of g.meshes) mesh.setMatrixAt(i, _m);
      });
      for (const mesh of g.meshes) mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const m of this.objects) m.dispose();
  }
}

export type TagMount = { at: [number, number, number]; rot: [number, number, number] };

export function TrackedAssets({
  sim,
  models,
  tagModels,
  tagMounts,
  palette,
  castShadow,
}: {
  sim: Simulation;
  models: Partial<Record<AssetClass, ModelParts>>;
  tagModels: Partial<Record<TagModel, ModelParts>>;
  tagMounts: Partial<Record<AssetClass, TagMount>>;
  palette: Palette;
  castShadow: boolean;
}) {
  const system = useMemo(
    () => new AssetSystem(sim, models, tagModels, tagMounts, palette, castShadow),
    [sim, models, tagModels, tagMounts, palette, castShadow],
  );
  useEffect(() => () => system.dispose(), [system]);
  useFrame((_, delta) => system.update(simFrame.alpha, delta), -30);
  return (
    <>
      {system.objects.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
    </>
  );
}
