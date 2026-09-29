import type { BufferGeometry } from 'three';
import { pointInPolygon, type Vec2 } from '../sim/geometry';
import type { DoorDef, WallDef, WallMaterial, WorldDef, ZoneDef } from '../sim/world';
import { GeometryBuilder, type VertexExtras } from './geometryBuilder';

/**
 * Turns world data into merged meshes: walls (with the attributes the cutaway shader needs), windows,
 * floors, the building slab and door leaves. Plan coordinates (x east, y north) map to three.js as
 * (x, -z); height is y.
 */

export const WALL_THICKNESS: Record<WallMaterial, number> = {
  concrete: 0.2,
  drywall: 0.1,
  glass: 0.03,
  insulated: 0.15,
  mesh: 0.04,
  metal: 0.05,
};

/** Wall groups rendered with one material each. `frame` holds window frames. */
export type WallGroup = 'solid' | 'glass' | 'mesh' | 'metal' | 'frame';
const groupOf: Record<WallMaterial, WallGroup> = {
  concrete: 'solid',
  drywall: 'solid',
  insulated: 'solid',
  glass: 'glass',
  mesh: 'mesh',
  metal: 'metal',
};

/** Color multiplier for the cut section on top of walls (the dark band of an architectural section). */
export const SECTION: [number, number, number] = [0.42, 0.43, 0.46];

/** Visual-only window in an exterior wall (RF still treats the wall as solid). */
export interface WindowDef {
  a: Vec2;
  b: Vec2;
  sill: number;
  head: number;
}

function indoorZones(world: WorldDef): ZoneDef[] {
  return world.zones.filter((z) => z.kind !== 'outdoor');
}

function insideAny(p: Vec2, zones: readonly ZoneDef[]): boolean {
  return zones.some((z) => pointInPolygon(p, z.polygon));
}

/** Classifies a wall as exterior (one side outdoors) or interior, and orients exterior normals outwards. */
export function classifyWall(
  a: Vec2,
  b: Vec2,
  zones: readonly ZoneDef[],
): { exterior: boolean; normal: Vec2 } {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const plus = insideAny({ x: m.x + n.x * 0.4, y: m.y + n.y * 0.4 }, zones);
  const minus = insideAny({ x: m.x - n.x * 0.4, y: m.y - n.y * 0.4 }, zones);
  if (plus && !minus) return { exterior: true, normal: { x: -n.x, y: -n.y } };
  if (minus && !plus) return { exterior: true, normal: n };
  return { exterior: false, normal: n };
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * How far a wall end reaches past its end point: into a crossing wall it goes almost half its own
 * thickness (so corners close without coplanar faces), a free end at a door opening stays put, and
 * collinear walls butt exactly.
 */
function endExtension(end: Vec2, self: WallDef, walls: readonly WallDef[]): number {
  const t = WALL_THICKNESS[self.material];
  const ux = self.b.x - self.a.x;
  const uy = self.b.y - self.a.y;
  const ul = Math.hypot(ux, uy) || 1;
  for (const w of walls) {
    if (w === self) continue;
    if (distToSegment(end, w.a, w.b) > 0.01) continue;
    const vx = w.b.x - w.a.x;
    const vy = w.b.y - w.a.y;
    const cross = Math.abs(ux * vy - uy * vx) / (ul * (Math.hypot(vx, vy) || 1));
    if (cross > 0.5) return t / 2 - 0.002;
  }
  return 0;
}

interface Span {
  t0: number;
  t1: number;
  window?: WindowDef;
}

function spansFor(w: WallDef, len: number, windows: readonly WindowDef[]): Span[] {
  const u = { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len };
  const along = (p: Vec2) => (p.x - w.a.x) * u.x + (p.y - w.a.y) * u.y;
  const onWall = windows
    .filter((win) => distToSegment(win.a, w.a, w.b) < 0.02 && distToSegment(win.b, w.a, w.b) < 0.02)
    .map((win) => {
      const [t0, t1] = [along(win.a), along(win.b)].sort((x, y) => x - y) as [number, number];
      return { t0, t1, window: win };
    })
    .sort((x, y) => x.t0 - y.t0);
  const spans: Span[] = [];
  let cur = 0;
  for (const s of onWall) {
    if (s.t0 > cur + 1e-3) spans.push({ t0: cur, t1: s.t0 });
    spans.push(s);
    cur = s.t1;
  }
  if (cur < len - 1e-3) spans.push({ t0: cur, t1: len });
  return spans;
}

/** Height of door heads; the wall above a door is filled with a lintel. */
export const DOOR_HEAD = 2.1;

export function buildWalls(
  world: WorldDef,
  windows: readonly WindowDef[] = [],
  extraDoors: readonly DoorDef[] = [],
): Partial<Record<WallGroup, BufferGeometry>> {
  const zones = indoorZones(world);
  const builders = new Map<WallGroup, GeometryBuilder>();
  const builder = (g: WallGroup) => {
    let b = builders.get(g);
    if (!b) {
      b = new GeometryBuilder();
      builders.set(g, b);
    }
    return b;
  };
  for (const w of world.walls) {
    const dx = w.b.x - w.a.x;
    const dy = w.b.y - w.a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) continue;
    const u = { x: dx / len, y: dy / len };
    const t = WALL_THICKNESS[w.material];
    const { exterior, normal } = classifyWall(w.a, w.b, zones);
    const yaw = Math.atan2(dy, dx);
    // One cut decision for the whole wall (all its pieces), taken at the wall's midpoint.
    const extras: VertexExtras = {
      wallNormal: [normal.x, -normal.y],
      exterior: exterior ? 1 : 0,
      wallCenter: [(w.a.x + w.b.x) / 2, -(w.a.y + w.b.y) / 2],
    };
    const cap: VertexExtras = { ...extras, color: SECTION };
    const extA = endExtension(w.a, w, world.walls);
    const extB = endExtension(w.b, w, world.walls);
    const piece = (
      g: WallGroup,
      t0: number,
      t1: number,
      y0: number,
      y1: number,
      depth: number,
      top = cap,
    ) => {
      const c = (t0 + t1) / 2;
      builder(g).box(
        [w.a.x + u.x * c, (y0 + y1) / 2, -(w.a.y + u.y * c)],
        [t1 - t0, y1 - y0, depth],
        yaw,
        extras,
        top,
      );
    };
    const spans = spansFor(w, len, windows);
    spans.forEach((s, i) => {
      const t0 = i === 0 ? s.t0 - extA : s.t0;
      const t1 = i === spans.length - 1 ? s.t1 + extB : s.t1;
      const win = s.window;
      if (!win) {
        piece(groupOf[w.material], t0, t1, 0, w.height, t);
        return;
      }
      // Window: wall below the sill (its top is a sill, not a cut), wall above the head, frame and pane.
      piece('solid', t0, t1, 0, win.sill, t, extras);
      piece('solid', t0, t1, win.head, w.height, t);
      const f = 0.05;
      piece('frame', s.t0, s.t1, win.sill, win.sill + f, t * 0.6, extras);
      piece('frame', s.t0, s.t1, win.head - f, win.head, t * 0.6, extras);
      piece('frame', s.t0, s.t0 + f, win.sill + f, win.head - f, t * 0.6, extras);
      piece('frame', s.t1 - f, s.t1, win.sill + f, win.head - f, t * 0.6, extras);
      const mid = (s.t0 + s.t1) / 2;
      if (s.t1 - s.t0 > 1.6)
        piece('frame', mid - f / 2, mid + f / 2, win.sill + f, win.head - f, t * 0.5, extras);
      piece('glass', s.t0 + f, s.t1 - f, win.sill + f, win.head - f, 0.012, extras);
    });
  }
  for (const d of [...world.doors, ...extraDoors]) addDoorSurround(d, world.walls, zones, builder);
  const out: Partial<Record<WallGroup, BufferGeometry>> = {};
  for (const [g, b] of builders) out[g] = b.build();
  return out;
}

/** The wall a door sits in: a collinear wall touching one of the door's end points. */
function hostWall(d: DoorDef, walls: readonly WallDef[]): WallDef | undefined {
  const ux = d.b.x - d.a.x;
  const uy = d.b.y - d.a.y;
  const ul = Math.hypot(ux, uy) || 1;
  return walls.find((w) => {
    const touches = [w.a, w.b].some(
      (p) => Math.hypot(p.x - d.a.x, p.y - d.a.y) < 0.02 || Math.hypot(p.x - d.b.x, p.y - d.b.y) < 0.02,
    );
    if (!touches) return false;
    const vx = w.b.x - w.a.x;
    const vy = w.b.y - w.a.y;
    return Math.abs(ux * vy - uy * vx) / (ul * (Math.hypot(vx, vy) || 1)) < 0.05;
  });
}

/** Lintel above the door and a frame (two jambs and a head) around the opening. */
function addDoorSurround(
  d: DoorDef,
  walls: readonly WallDef[],
  zones: readonly ZoneDef[],
  builder: (g: WallGroup) => GeometryBuilder,
): void {
  if (d.kind === 'gate' || d.kind === 'dock') return;
  const width = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
  if (d.kind === 'opening' && width > 3) return;
  const host = hostWall(d, walls);
  if (!host) return;
  const t = WALL_THICKNESS[host.material];
  const u = { x: (d.b.x - d.a.x) / width, y: (d.b.y - d.a.y) / width };
  const yaw = Math.atan2(u.y, u.x);
  const { exterior, normal } = classifyWall(d.a, d.b, zones);
  const extras: VertexExtras = {
    wallNormal: [normal.x, -normal.y],
    exterior: exterior ? 1 : 0,
    wallCenter: [(d.a.x + d.b.x) / 2, -(d.a.y + d.b.y) / 2],
  };
  const cap: VertexExtras = { ...extras, color: SECTION };
  const at = (s: number, y: number): [number, number, number] => [d.a.x + u.x * s, y, -(d.a.y + u.y * s)];
  if (host.height > DOOR_HEAD + 0.01) {
    builder('solid').box(
      at(width / 2, (DOOR_HEAD + host.height) / 2),
      [width, host.height - DOOR_HEAD, t],
      yaw,
      extras,
      cap,
    );
  }
  const f = 0.05;
  const depth = t + 0.02;
  builder('frame').box(at(f / 2, DOOR_HEAD / 2), [f, DOOR_HEAD, depth], yaw, extras, cap);
  builder('frame').box(at(width - f / 2, DOOR_HEAD / 2), [f, DOOR_HEAD, depth], yaw, extras, cap);
  builder('frame').box(at(width / 2, DOOR_HEAD - f / 2), [width, f, depth], yaw, extras, cap);
}

export type FloorFinish = 'vinyl' | 'tiles';

/** Subtle per-zone tints, multiplied with the floor texture. */
/**
 * Heights of stacked floor layers (m). Hardware depth buffers cannot separate surfaces a few millimetres
 * apart at 100 m or more, so layers sit centimetres apart: invisible at dollhouse scale, never flickering.
 */
export const FLOOR_LAYERS = {
  /** Top of the building slab, under the floor. */
  slabTop: -0.03,
  base: 0,
  /** Floors laid over the base floor: station areas, bathroom tiles, tinted rooms. */
  inset: 0.015,
  /** Painted lines, above every floor. */
  lines: 0.03,
  /** Shadow catcher above the ground disc outside the building. */
  catcher: 0.01,
} as const;

export function floorTint(z: ZoneDef): [number, number, number] {
  const tags = z.tags ?? [];
  if (z.kind === 'corridor') return [0.93, 0.95, 0.98];
  if (tags.includes('icu')) return [0.9, 0.95, 0.99];
  if (tags.includes('patient')) return [1.0, 0.98, 0.95];
  if (tags.includes('station')) return [0.97, 0.95, 0.92];
  if (tags.includes('lobby')) return [0.86, 0.86, 0.88];
  return [0.95, 0.95, 0.95];
}

export function buildFloors(world: WorldDef): Partial<Record<FloorFinish, BufferGeometry>> {
  const vinyl = new GeometryBuilder();
  const tiles = new GeometryBuilder();
  for (const z of world.zones) {
    if (z.kind === 'outdoor') continue;
    const xs = z.polygon.map((p) => p.x);
    const ys = z.polygon.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    if (z.id.endsWith('-bath')) {
      tiles.floorRect(x0, -y1, x1, -y0, FLOOR_LAYERS.inset);
      continue;
    }
    // Floors for rooms, corridors and top-level areas; nested areas (bays) share their parent's floor.
    if (z.parent && z.kind === 'area') continue;
    if (z.kind === 'area' && !z.tags?.some((t) => t === 'station')) continue;
    // Station areas lie inside corridors: a layer above them, not on the same plane.
    const y = z.kind === 'area' ? FLOOR_LAYERS.inset : FLOOR_LAYERS.base;
    vinyl.floorRect(x0, -y1, x1, -y0, y, { color: floorTint(z) });
  }
  const out: Partial<Record<FloorFinish, BufferGeometry>> = {};
  if (!vinyl.empty) out.vinyl = vinyl.build();
  if (!tiles.empty) out.tiles = tiles.build();
  return out;
}

/** Bounding box of the building footprint in plan coordinates. */
export function footprint(world: WorldDef): { x0: number; y0: number; x1: number; y1: number } {
  const pts = indoorZones(world).flatMap((z) => z.polygon);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Slab under every indoor zone, so the dollhouse sits on a base. */
export function buildSlab(world: WorldDef, depth = 0.3, margin = 0.2): BufferGeometry {
  const b = new GeometryBuilder();
  for (const z of indoorZones(world)) {
    if (z.parent) continue;
    const xs = z.polygon.map((p) => p.x);
    const ys = z.polygon.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    b.box(
      [(x0 + x1) / 2, -depth / 2 + FLOOR_LAYERS.slabTop, -(y0 + y1) / 2],
      [x1 - x0 + 2 * margin, depth, y1 - y0 + 2 * margin],
    );
  }
  return b.build();
}

export type DoorGroup = 'leaf' | 'steel';

/**
 * Door leaves: open swing doors turn 90 degrees into the room, closed ones fill their opening. Leaves
 * carry their wall's cutaway attributes so they cut down together with it.
 */
export function buildDoors(
  world: WorldDef,
  extraDoors: readonly DoorDef[] = [],
  leafHeight = DOOR_HEAD - 0.02,
): Partial<Record<DoorGroup, BufferGeometry>> {
  const zones = indoorZones(world);
  const rooms = world.zones.filter((z) => z.kind === 'room');
  const leaf = new GeometryBuilder();
  const steel = new GeometryBuilder();
  const T = 0.045;
  for (const d of [...world.doors, ...extraDoors]) {
    if (d.kind === 'opening' || d.kind === 'gate' || d.kind === 'dock') continue;
    const target = d.kind === 'elevator' ? steel : leaf;
    const { exterior, normal } = classifyWall(d.a, d.b, zones);
    const extras: VertexExtras = {
      wallNormal: [normal.x, -normal.y],
      exterior: exterior ? 1 : 0,
      wallCenter: [(d.a.x + d.b.x) / 2, -(d.a.y + d.b.y) / 2],
    };
    for (const p of doorPieces(d, rooms)) {
      target.box([p.cx, leafHeight / 2, -p.cy], [p.len, leafHeight, T], p.yaw, extras, {
        ...extras,
        color: SECTION,
      });
    }
  }
  const out: Partial<Record<DoorGroup, BufferGeometry>> = {};
  if (!leaf.empty) out.leaf = leaf.build();
  if (!steel.empty) out.steel = steel.build();
  return out;
}

interface Piece {
  cx: number;
  cy: number;
  len: number;
  yaw: number;
}

function doorPieces(d: DoorDef, rooms: readonly ZoneDef[]): Piece[] {
  const dx = d.b.x - d.a.x;
  const dy = d.b.y - d.a.y;
  const width = Math.hypot(dx, dy);
  const u = { x: dx / width, y: dy / width };
  const n = { x: -u.y, y: u.x };
  const mid = { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 };
  // Doors swing into the room side.
  const into = insideAny({ x: mid.x + n.x * 0.5, y: mid.y + n.y * 0.5 }, rooms) ? n : { x: -n.x, y: -n.y };
  const along = Math.atan2(u.y, u.x);
  const perp = Math.atan2(into.y, into.x);
  if (!d.open || d.kind === 'elevator') {
    return [{ cx: mid.x, cy: mid.y, len: width, yaw: along }];
  }
  if (d.kind === 'sliding') {
    // Slid open along the wall face on the room side.
    const off = 0.09;
    return [
      {
        cx: mid.x + u.x * width + into.x * off,
        cy: mid.y + u.y * width + into.y * off,
        len: width,
        yaw: along,
      },
    ];
  }
  const leaves = d.kind === 'double' ? 2 : 1;
  const leafW = width / leaves - 0.02;
  const hinges = leaves === 2 ? [d.a, d.b] : [d.a];
  return hinges.map((h) => {
    const inset = h === d.a ? 0.03 : -0.03;
    return {
      cx: h.x + u.x * inset + into.x * (leafW / 2 + 0.03),
      cy: h.y + u.y * inset + into.y * (leafW / 2 + 0.03),
      len: leafW,
      yaw: perp,
    };
  });
}

/**
 * Cutaway attributes for a piece mounted on the wall behind it (plan position and heading pointing into
 * the room), matching the host wall's own attributes so both cut together.
 */
export function wallAttachment(
  world: WorldDef,
  x: number,
  y: number,
  headingDeg: number,
): { normal: [number, number]; center: [number, number]; exterior: 0 | 1 } | undefined {
  const h = (headingDeg * Math.PI) / 180;
  const probe = { x: x - Math.cos(h) * 0.3, y: y - Math.sin(h) * 0.3 };
  let best: WallDef | undefined;
  let bestD = 0.6;
  for (const w of world.walls) {
    const d = distToSegment(probe, w.a, w.b);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  if (!best) return undefined;
  const { exterior, normal } = classifyWall(best.a, best.b, indoorZones(world));
  return {
    normal: [normal.x, -normal.y],
    center: [(best.a.x + best.b.x) / 2, -(best.a.y + best.b.y) / 2],
    exterior: exterior ? 1 : 0,
  };
}
