import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
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
import { glow, withFresnel, type Look } from './looks';

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

/** Clamps every vertex to a height (the model's wall height) and drops the triangles that collapse. */
function clampHeight(g: BufferGeometry, h: number): BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g.clone();
  const pos = src.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, Math.min(pos.getY(i), h));
  const keepTri: number[] = [];
  for (let t = 0; t < pos.count / 3; t++) {
    const i = t * 3;
    const ax = pos.getX(i + 1) - pos.getX(i);
    const ay = pos.getY(i + 1) - pos.getY(i);
    const az = pos.getZ(i + 1) - pos.getZ(i);
    const bx = pos.getX(i + 2) - pos.getX(i);
    const by = pos.getY(i + 2) - pos.getY(i);
    const bz = pos.getZ(i + 2) - pos.getZ(i);
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    if (Math.hypot(cx, cy, cz) > 1e-6) keepTri.push(t);
  }
  const out = new BufferGeometry();
  for (const name of Object.keys(src.attributes)) {
    const attr = src.getAttribute(name) as BufferAttribute;
    const size = attr.itemSize;
    const arr = new Float32Array(keepTri.length * 3 * size);
    keepTri.forEach((t, k) => {
      for (let v = 0; v < 3; v++)
        for (let c = 0; c < size; c++)
          arr[(k * 3 + v) * size + c] = attr.array[(t * 3 + v) * size + c] as number;
    });
    out.setAttribute(name, new BufferAttribute(arr, size));
  }
  src.dispose();
  return out;
}

export interface Ward {
  group: Group;
  base: { center: Vector3; y: number };
  /** Resolves once textures (look C) are uploaded. */
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
 * The building for a look: floors, walls, doors, the model base and the dark stage floor. Looks A and B
 * are architectural models (walls at model height, no textures); look C keeps full-height textured walls
 * with the full demo's cutaway (walls facing the camera cut down).
 */
export function buildWard(look: Look, world: WorldDef, opts: { phone: boolean; loader?: KTX2Loader }): Ward {
  const group = new Group();
  group.name = 'ward';
  const disposables: Array<BufferGeometry | Material | Texture> = [];
  const add = (m: Mesh | LineSegments) => {
    group.add(m);
    disposables.push(m.geometry, m.material as Material);
    return m;
  };
  const realistic = look.model === 'realistic';
  const tasks: Array<Promise<unknown>> = [];

  // Floors.
  const floors = buildFloors(world);
  const floorMat = realistic
    ? new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, color: '#d9d6d0' })
    : look.model === 'white'
      ? withFresnel(new MeshStandardMaterial({ color: '#d4d4de', roughness: 0.9 }), look.fresnel, 'a-floor')
      : new MeshStandardMaterial({
          color: '#0d2344',
          roughness: 0.2,
          metalness: 0.5,
          emissive: '#0a1f3d',
          emissiveIntensity: 0.6,
        });
  if (floors.vinyl) add(new Mesh(floors.vinyl, floorMat)).receiveShadow = true;
  if (floors.tiles) {
    const tileMat = realistic
      ? new MeshStandardMaterial({ roughness: 0.4, color: '#e6e8ea' })
      : floorMat.clone();
    add(new Mesh(floors.tiles, tileMat)).receiveShadow = true;
    if (realistic) {
      tasks.push(
        loadSet(opts.loader as KTX2Loader, 'bath-tiles', 'low').then(([map, nor, rough]) => {
          Object.assign(tileMat, { map, normalMap: nor, roughnessMap: rough, color: new Color('#ffffff') });
          tileMat.needsUpdate = true;
          disposables.push(map, nor, rough);
        }),
      );
    }
  }
  if (realistic) {
    tasks.push(
      loadSet(opts.loader as KTX2Loader, 'vinyl', 'low').then(([map, nor, rough]) => {
        Object.assign(floorMat, { map, normalMap: nor, roughnessMap: rough, color: new Color('#ffffff') });
        floorMat.needsUpdate = true;
        disposables.push(map, nor, rough);
      }),
    );
  }

  // Walls.
  const model = look.wallHeight !== null;
  const modelWorld: WorldDef = model
    ? { ...world, doors: [], walls: world.walls.map((w) => ({ ...w, height: look.wallHeight ?? w.height })) }
    : world;
  const walls = buildWalls(modelWorld, model ? [] : hospitalWindows, model ? [] : hospitalVisualDoors);
  if (look.model === 'white') {
    const mat = withFresnel(
      new MeshStandardMaterial({ color: '#f6f6fb', roughness: 0.8 }),
      look.fresnel,
      'a-wall',
    );
    for (const g of [walls.solid, walls.frame, walls.glass]) {
      if (!g) continue;
      const m = add(new Mesh(clampHeight(g, look.wallHeight ?? 1.4), mat));
      m.castShadow = true;
      m.receiveShadow = true;
      g.dispose();
    }
  } else if (look.model === 'glass') {
    const pane = new MeshStandardMaterial({
      color: '#cfe6ff',
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      emissive: '#3c79c9',
      emissiveIntensity: 0.25,
    });
    const edge = new LineBasicMaterial({
      color: glow('#bfe2ff', 1.3),
      toneMapped: false,
      transparent: true,
      opacity: 0.85,
    });
    for (const g of [walls.solid, walls.frame, walls.glass]) {
      if (!g) continue;
      const clamped = clampHeight(g, look.wallHeight ?? 1.6);
      const m = add(new Mesh(clamped, pane));
      m.renderOrder = 2;
      add(new LineSegments(new EdgesGeometry(clamped, 25), edge));
      g.dispose();
    }
  } else {
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
      loadSet(opts.loader as KTX2Loader, 'plaster', 'low').then(([map, nor, rough]) => {
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
  }

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
  const plinthMat =
    look.model === 'white'
      ? withFresnel(new MeshStandardMaterial({ color: '#dcdbe6', roughness: 0.7 }), look.fresnel, 'a-plinth')
      : look.model === 'glass'
        ? new MeshStandardMaterial({
            color: '#0b1c36',
            roughness: 0.2,
            metalness: 0.6,
            emissive: '#10325e',
            emissiveIntensity: 0.5,
          })
        : new MeshStandardMaterial({ color: '#3a3d45', roughness: 0.8 });
  add(new Mesh(plinth, plinthMat)).receiveShadow = true;
  if (look.model === 'glass') {
    add(
      new LineSegments(
        new EdgesGeometry(plinth),
        new LineBasicMaterial({ color: glow('#8fd0ff', 1.6), toneMapped: false }),
      ),
    );
  }
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
