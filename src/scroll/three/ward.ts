import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  Vector3,
  type Material,
  type Texture,
} from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { siteUrl } from '../paths';
import manifest from '../../scene/assets/manifest.json';
import { buildDoors, buildFloors, buildWalls, FLOOR_LAYERS } from '../../scene/buildingGeometry';
import { hospitalVisualDoors, hospitalWindows } from '../../scene/hospital/dressing';
import { withCutaway } from '../../scene/materials/cutaway';
import { pointInPolygon } from '../../sim/geometry';
import type { WallDef, WorldDef, ZoneDef } from '../../sim/world';

export interface Crop {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const bboxOf = (z: ZoneDef) => {
  const xs = z.polygon.map((p) => p.x);
  const ys = z.polygon.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

/** Distance from a point to a zone's bounding box (0 inside). */
function distToZone(z: ZoneDef, x: number, y: number): number {
  const b = bboxOf(z);
  const dx = Math.max(b.x0 - x, 0, x - b.x1);
  const dy = Math.max(b.y0 - y, 0, y - b.y1);
  return Math.hypot(dx, dy);
}

/**
 * The part of the ward the story shows (SCROLL-SPEC.md section 5): rooms and areas that lie mostly inside
 * the crop, the corridor clipped to it, and the walls, doors and devices around them.
 */
export function cropWorld(world: WorldDef, crop: Crop): WorldDef {
  const w = structuredClone(world);
  const clip = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const zones: ZoneDef[] = [];
  for (const z of w.zones) {
    if (z.kind === 'outdoor') continue;
    const b = bboxOf(z);
    const ix = Math.max(0, Math.min(b.x1, crop.x1) - Math.max(b.x0, crop.x0));
    const iy = Math.max(0, Math.min(b.y1, crop.y1) - Math.max(b.y0, crop.y0));
    const share = (ix * iy) / Math.max(1e-6, (b.x1 - b.x0) * (b.y1 - b.y0));
    if (share < 0.95 && z.kind !== 'corridor') continue;
    if (share <= 0) continue;
    z.polygon = z.polygon.map((p) => ({ x: clip(p.x, crop.x0, crop.x1), y: clip(p.y, crop.y0, crop.y1) }));
    zones.push(z);
  }
  const keep = new Set(zones.map((z) => z.id));
  // Nested areas (bathrooms, bays) follow their room.
  w.zones = zones.filter((z) => !z.parent || keep.has(z.parent));
  const near = (x: number, y: number) => w.zones.some((z) => distToZone(z, x, y) < 0.3);
  const walls: WallDef[] = [];
  for (const wall of w.walls) {
    const a = { x: clip(wall.a.x, crop.x0, crop.x1), y: clip(wall.a.y, crop.y0, crop.y1) };
    const b = { x: clip(wall.b.x, crop.x0, crop.x1), y: clip(wall.b.y, crop.y0, crop.y1) };
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.05) continue;
    if (!near((a.x + b.x) / 2, (a.y + b.y) / 2)) continue;
    walls.push({ ...wall, a, b });
  }
  w.walls = walls;
  const inCrop = (x: number, y: number) => x >= crop.x0 && x <= crop.x1 && y >= crop.y0 && y <= crop.y1;
  w.doors = w.doors.filter((d) => inCrop((d.a.x + d.b.x) / 2, (d.a.y + d.b.y) / 2) && near(d.a.x, d.a.y));
  const inZones = (x: number, y: number) => w.zones.some((z) => pointInPolygon({ x, y }, z.polygon));
  // Devices of the shown rooms only (not a neighbour's anchor that happens to sit inside the crop).
  w.devices = w.devices.filter(
    (d) => inCrop(d.position.x, d.position.y) && inZones(d.position.x, d.position.y),
  );
  w.figures = w.figures.filter((f) => inZones(f.position.x, f.position.y));
  return w;
}

/** Point inside one of the shown zones. */
export function shownAt(world: WorldDef, x: number, y: number): boolean {
  return world.zones.some((z) => pointInPolygon({ x, y }, z.polygon));
}

export interface Ward {
  group: Group;
  base: { center: Vector3; y: number };
  /** Resolves once the textures are uploaded. */
  ready: Promise<void>;
  dispose(): void;
}

function loadSet(loader: KTX2Loader, name: keyof typeof manifest.textures, tier: 'high' | 'low') {
  const entry = manifest.textures[name];
  const [sx, sy] = entry.sizeM as [number, number];
  const load = (path: string) =>
    loader.loadAsync(siteUrl(path)).then((t: Texture) => {
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.repeat.set(1 / sx, 1 / sy);
      t.anisotropy = 4;
      return t;
    });
  return Promise.all([load(entry.maps.diff[tier]), load(entry.maps.nor[tier]), load(entry.maps.rough[tier])]);
}

/**
 * The building: floors, full-height textured walls with the full demo's cutaway (walls facing the camera
 * cut down), warm window glow, doors and the model base. Textures load on the low tier.
 */
export function buildWard(world: WorldDef, loader: KTX2Loader): Ward {
  const group = new Group();
  group.name = 'ward';
  const disposables: Array<BufferGeometry | Material | Texture> = [];
  const add = (m: Mesh) => {
    group.add(m);
    disposables.push(m.geometry, m.material as Material);
    return m;
  };
  const tasks: Array<Promise<unknown>> = [];

  // Floors.
  const floors = buildFloors(world);
  const floorMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, color: '#d9d6d0' });
  if (floors.vinyl) add(new Mesh(floors.vinyl, floorMat)).receiveShadow = true;
  if (floors.tiles) {
    const tileMat = new MeshStandardMaterial({ roughness: 0.4, color: '#e6e8ea' });
    add(new Mesh(floors.tiles, tileMat)).receiveShadow = true;
    tasks.push(
      loadSet(loader, 'bath-tiles', 'low').then(([map, nor, rough]) => {
        Object.assign(tileMat, { map, normalMap: nor, roughnessMap: rough, color: new Color('#ffffff') });
        tileMat.needsUpdate = true;
        disposables.push(map, nor, rough);
      }),
    );
  }
  tasks.push(
    loadSet(loader, 'vinyl', 'low').then(([map, nor, rough]) => {
      Object.assign(floorMat, { map, normalMap: nor, roughnessMap: rough, color: new Color('#ffffff') });
      floorMat.needsUpdate = true;
      disposables.push(map, nor, rough);
    }),
  );

  // Walls.
  const walls = buildWalls(world, hospitalWindows, hospitalVisualDoors);
  const plaster = withCutaway(
    new MeshStandardMaterial({ color: '#efece6', roughness: 0.9, vertexColors: true }),
  );
  const frame = withCutaway(
    new MeshStandardMaterial({ color: '#b9bec4', metalness: 0.6, roughness: 0.35, vertexColors: true }),
  );
  // Window panes glow warm at night.
  const glass = withCutaway(
    new MeshStandardMaterial({
      color: '#2a3140',
      emissive: new Color('#ffcf8f'),
      emissiveIntensity: 0.8,
      roughness: 0.2,
    }),
  );
  if (walls.solid) add(new Mesh(walls.solid, plaster));
  if (walls.frame) add(new Mesh(walls.frame, frame));
  if (walls.glass) add(new Mesh(walls.glass, glass));
  tasks.push(
    loadSet(loader, 'plaster', 'low').then(([map, nor, rough]) => {
      Object.assign(plaster, { map, normalMap: nor, roughnessMap: rough });
      plaster.needsUpdate = true;
      disposables.push(map, nor, rough);
    }),
  );
  const doors = buildDoors(world, hospitalVisualDoors);
  const leaf = withCutaway(
    new MeshStandardMaterial({ color: '#d8cfc2', roughness: 0.6, vertexColors: true }),
  );
  if (doors.leaf) add(new Mesh(doors.leaf, leaf));
  if (doors.steel) add(new Mesh(doors.steel, frame.clone()));

  // Model base: a plinth under the shown rooms (the stage floor around it is built by the stage).
  const xs = world.zones.flatMap((z) => z.polygon.map((p) => p.x));
  const ys = world.zones.flatMap((z) => z.polygon.map((p) => p.y));
  const bx0 = Math.min(...xs) - 0.3;
  const bx1 = Math.max(...xs) + 0.3;
  const by0 = Math.min(...ys) - 0.3;
  const by1 = Math.max(...ys) + 0.3;
  const plinthH = 0.35;
  const plinth = new BoxGeometry(bx1 - bx0, plinthH, by1 - by0).translate(
    (bx0 + bx1) / 2,
    FLOOR_LAYERS.slabTop - plinthH / 2,
    -(by0 + by1) / 2,
  );
  add(new Mesh(plinth, new MeshStandardMaterial({ color: '#3a3d45', roughness: 0.8 }))).receiveShadow = true;
  return {
    group,
    // Where the stage floor goes: under the plinth, centred on the model.
    base: {
      center: new Vector3((bx0 + bx1) / 2, 0, -(by0 + by1) / 2),
      y: FLOOR_LAYERS.slabTop - plinthH - 0.02,
    },
    ready: Promise.all(tasks).then(() => undefined),
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
