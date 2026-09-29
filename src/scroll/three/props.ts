import {
  Color,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { siteUrl } from '../paths';
import manifest from '../../scene/assets/manifest.json';
import { mannequinParts, OUTFITS, CLOTHED, type PartName } from '../../scene/characters/mannequin';
import { poseCharacter } from '../../scene/characters/pose';
import { devicePlacement } from '../../scene/devices/devicePlacement';
import { deviceModels } from '../../scene/devices/deviceModels';
import { hospitalEquipmentModels, tagMounts } from '../../scene/hospital/equipmentModels';
import { hospitalFurniture } from '../../scene/hospital/furnitureLayout';
import { hospitalFurnitureModels } from '../../scene/hospital/furnitureModels';
import { buildInstances, placementMatrix, type ModelParts, type Placement } from '../../scene/kit/instancing';
import type { Bucket } from '../../scene/kit/parts';
import { cutawayDepthMaterial, withCutaway } from '../../scene/materials/cutaway';
import type { Palette } from '../../scene/materials/palette';
import type { AssetClass, WorldDef } from '../../sim/world';
import type { Timeline } from '../timeline/timeline';
import { modelBucketMaterials, type Look } from './looks';
import { shownAt } from './ward';

const STRIDE_M = 1.35;
const LYING_Y = 0.64;

/** Plan (x, y, z) to three.js (x, z up, -y). */
export const P = (x: number, y: number, z = 0) => new Vector3(x, z, -y);

function vertexRoughness(m: MeshStandardMaterial): MeshStandardMaterial {
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n#ifdef USE_COLOR_ALPHA\nroughnessFactor *= vColor.a;\n#endif',
    );
  };
  m.customProgramCacheKey = () => 'scroll-vertex-roughness';
  return m;
}

function realisticMaterials(
  loader: KTX2Loader,
  disposables: Texture[],
): {
  mats: Record<Bucket, MeshStandardMaterial>;
  ready: Promise<unknown>;
} {
  const mats: Record<Bucket, MeshStandardMaterial> = {
    plain: vertexRoughness(new MeshStandardMaterial({ vertexColors: true, roughness: 1 })),
    metal: vertexRoughness(new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0.85 })),
    fabric: new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    upholstery: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
    wood: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
    screen: new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.12,
      emissive: new Color('#1d4d63'),
      emissiveIntensity: 1.4,
    }),
  };
  const set = (bucket: Bucket, name: keyof typeof manifest.textures) => {
    const e = manifest.textures[name];
    const [sx, sy] = e.sizeM as [number, number];
    return Promise.all([e.maps.diff.low, e.maps.nor.low].map((p) => loader.loadAsync(siteUrl(p)))).then(
      ([map, nor]) => {
        for (const t of [map, nor] as Texture[]) {
          t.wrapS = t.wrapT = 1000; // RepeatWrapping
          t.repeat.set(1 / sx, 1 / sy);
          disposables.push(t);
        }
        Object.assign(mats[bucket], { map, normalMap: nor });
        mats[bucket].needsUpdate = true;
      },
    );
  };
  return {
    mats,
    ready: Promise.all([set('fabric', 'linen'), set('upholstery', 'leather'), set('wood', 'veneer')]),
  };
}

/**
 * Furniture, equipment (with tags), room devices and people for the shown part of the ward. Equipment and
 * people take their positions from the recorded timeline at the time shown.
 */
export class Props {
  readonly group = new Group();
  readonly ready: Promise<unknown>;
  private readonly disposables: Array<BufferGeometry | Material | Texture> = [];
  private readonly assets: Array<{ id: string; cls: AssetClass; meshes: InstancedMesh[]; index: number }> =
    [];
  private readonly tagMeshes: Array<{ mesh: InstancedMesh; owners: string[] }> = [];
  private readonly people: string[];
  private readonly figures: WorldDef['figures'];
  private readonly parts: Record<PartName, InstancedMesh> = {} as Record<PartName, InstancedMesh>;
  private lastT = Number.NaN;
  private lastLook = '';

  constructor(
    readonly look: Look,
    readonly world: WorldDef,
    readonly fullWorld: WorldDef,
    readonly timeline: Timeline,
    opts: { shadows: boolean; loader?: KTX2Loader },
  ) {
    const realistic = look.model === 'realistic';
    const textures: Texture[] = [];
    let mats: Record<Bucket, MeshStandardMaterial>;
    let ready: Promise<unknown> = Promise.resolve();
    if (realistic && opts.loader) {
      const r = realisticMaterials(opts.loader, textures);
      mats = r.mats;
      ready = r.ready;
    } else mats = modelBucketMaterials(look);
    this.ready = ready;
    this.disposables.push(...Object.values(mats));
    const cut = realistic
      ? (Object.fromEntries(Object.entries(mats).map(([k, m]) => [k, withCutaway(m.clone())])) as Record<
          Bucket,
          MeshStandardMaterial
        >)
      : mats;
    if (realistic) this.disposables.push(...Object.values(cut));
    const palette: Palette = { mats, cut, cutDepth: cutawayDepthMaterial() };
    const shadows = { cast: opts.shadows, receive: true };

    // Furniture of the shown rooms (the model looks drop the wall cutaway attachments).
    const furniture = hospitalFurniture(fullWorld)
      .filter((p) => shownAt(world, p.x, p.y))
      .map((p) => (realistic ? p : { ...p, wall: undefined }));
    const furnitureModels = hospitalFurnitureModels();
    for (const m of buildInstances(furnitureModels, furniture, palette, shadows)) this.group.add(m);
    this.disposeModels(furnitureModels);

    // Devices (room anchors, corridor gateways).
    const devModels = deviceModels();
    // In the model looks the devices sit on top of the lowered walls.
    const top = look.wallHeight ?? Infinity;
    const devs: Placement[] = world.devices.map((d) => {
      const p = devicePlacement(fullWorld, d);
      return { ...p, z: Math.min(p.z ?? d.position.z, top) };
    });
    for (const m of buildInstances(devModels as Record<string, ModelParts>, devs, palette, shadows))
      this.group.add(m);

    // Tagged equipment, placed from the recording each frame.
    const equipment = hospitalEquipmentModels();
    const byClass = new Map<AssetClass, string[]>();
    for (const id of timeline.assetIds()) {
      const a = timeline.data.assets[id];
      if (!a) continue;
      const pos = timeline.assetAt(id, 0);
      if (!pos || !shownAt(world, pos.x, pos.y)) continue;
      const cls = a.cls as AssetClass;
      byClass.set(cls, [...(byClass.get(cls) ?? []), id]);
    }
    for (const [cls, ids] of byClass) {
      const parts = equipment[cls];
      if (!parts) continue;
      const meshes = buildInstances(
        { [cls]: parts },
        ids.map(() => ({ model: cls, x: 0, y: 0 })),
        palette,
        shadows,
      );
      meshes.forEach((m) => this.group.add(m));
      ids.forEach((id, index) => this.assets.push({ id, cls, meshes, index }));
    }
    this.disposeModels(equipment as Record<string, ModelParts>);

    // Asset tags (PINIX TOW-1): lit in the model looks so the eye finds them.
    const tagParts = devModels['PINIX TOW-1'];
    const owners = this.assets.map((a) => a.id);
    if (tagParts && owners.length) {
      for (const [mat, g] of Object.entries(tagParts) as Array<[Bucket, BufferGeometry]>) {
        const mesh = new InstancedMesh(g, mats[mat], owners.length);
        mesh.name = `tag:${mat}`;
        this.group.add(mesh);
        this.tagMeshes.push({ mesh, owners });
      }
    }
    this.disposeModels(devModels as Record<string, ModelParts>);

    // People and patients.
    this.people = timeline.agentIds().filter((id) => {
      const p = timeline.agentAt(id, 0);
      return !!p;
    });
    this.figures = world.figures;
    const count = this.people.length + this.figures.length;
    const partDefs = mannequinParts();
    const roles = [
      ...this.people.map((id) => timeline.data.agents[id]?.role ?? 'default'),
      ...this.figures.map(() => 'patient'),
    ];
    for (const [name, def] of Object.entries(partDefs) as Array<[PartName, (typeof partDefs)[PartName]]>) {
      const per = name === 'upperArm' || name === 'forearm' || name === 'thigh' || name === 'shin' ? 2 : 1;
      const mesh = new InstancedMesh(def.geometry, mats[def.mat], Math.max(1, count * per));
      mesh.name = `person:${name}`;
      mesh.castShadow = opts.shadows;
      mesh.frustumCulled = false;
      const slot = CLOTHED[name];
      const c = new Color();
      roles.forEach((role, i) => {
        const outfit = OUTFITS[role] ?? OUTFITS.default;
        if (realistic && slot && outfit) c.setRGB(...outfit[slot]);
        else c.setRGB(1, 1, 1);
        for (let k = 0; k < per; k++) mesh.setColorAt(i * per + k, c);
      });
      this.parts[name] = mesh;
      this.group.add(mesh);
      this.disposables.push(def.geometry);
    }
    this.disposables.push(...textures);
  }

  private disposeModels(models: Record<string, ModelParts>): void {
    for (const parts of Object.values(models))
      for (const g of Object.values(parts)) if (g) this.disposables.push(g);
  }

  /** Where a tag is at time t (three.js coordinates). */
  tagPosition(tagId: string, t: number, out = new Vector3()): Vector3 | null {
    const tag = this.timeline.data.tags[tagId];
    if (!tag) return null;
    const asset = this.timeline.assetAt(tag.carrier, t);
    if (asset) {
      const cls = this.timeline.data.assets[tag.carrier]?.cls as AssetClass;
      const at = tagMounts[cls]?.at ?? [0, tag.mount / 100, 0];
      const base = placementMatrix(
        { model: cls, x: asset.x, y: asset.y, heading: asset.heading },
        new Matrix4(),
      );
      return out.set(...at).applyMatrix4(base);
    }
    const person = this.timeline.agentAt(tag.carrier, t);
    if (person) return out.set(person.x, 1.3, -person.y);
    return null;
  }

  /** Equipment, tags and people at time t, people turned by the look-around offsets. */
  update(t: number, look: Record<string, number>): void {
    const lookKey = JSON.stringify(look);
    if (t === this.lastT && lookKey === this.lastLook) return;
    this.lastT = t;
    this.lastLook = lookKey;
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    for (const a of this.assets) {
      const pos = this.timeline.assetAt(a.id, t);
      if (!pos) continue;
      placementMatrix({ model: a.cls, x: pos.x, y: pos.y, heading: pos.heading }, m);
      for (const mesh of a.meshes) mesh.setMatrixAt(a.index, m);
    }
    // Instances move: refresh the bounds too, or frustum culling uses where they were at the first frame.
    const moved = new Set(this.assets.flatMap((a) => a.meshes));
    for (const mesh of moved) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    for (const { mesh, owners } of this.tagMeshes) {
      owners.forEach((id, i) => {
        const asset = this.timeline.assetAt(id, t);
        const cls = this.timeline.data.assets[id]?.cls as AssetClass;
        const mount = tagMounts[cls];
        if (!asset || !mount) return;
        const base = placementMatrix(
          { model: cls, x: asset.x, y: asset.y, heading: asset.heading },
          new Matrix4(),
        );
        e.set(...mount.rot);
        q.setFromEuler(e);
        m.compose(new Vector3(...mount.at), q, new Vector3(1, 1, 1));
        mesh.setMatrixAt(i, base.multiply(m));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    const counters: Partial<Record<PartName, number>> = {};
    const place = (s: Parameters<typeof poseCharacter>[0]) => {
      for (const { part, matrix } of poseCharacter(s).parts) {
        const i = counters[part] ?? 0;
        this.parts[part].setMatrixAt(i, matrix);
        counters[part] = i + 1;
      }
    };
    for (const id of this.people) {
      const p = this.timeline.agentAt(id, t);
      if (!p) continue;
      const walking = p.speed > 0.15;
      place({
        id,
        role: this.timeline.data.agents[id]?.role ?? 'default',
        position: P(p.x, p.y),
        yaw: p.heading + (look[id] ?? 0),
        pose: walking ? (p.pushing ? 'push' : 'walk') : 'idle',
        phase: (p.walked / STRIDE_M) * Math.PI * 2,
        time: t + id.length,
      });
    }
    for (const f of this.figures) {
      const h = (f.headingDeg * Math.PI) / 180;
      place({
        id: f.id,
        role: 'patient',
        position: new Vector3(
          f.position.x - Math.cos(h) * 0.86,
          LYING_Y,
          -(f.position.y - Math.sin(h) * 0.86),
        ),
        yaw: h,
        pose: 'lie',
        phase: 0,
        time: t,
      });
    }
    for (const mesh of Object.values(this.parts)) mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
