import { vec2, type Vec2 } from './geometry';
import type { DoorDef, DoorKind, NavGraph, WallDef, WallMaterial } from './world';

/** Helpers to author world data compactly. */

type Gap = readonly [number, number];

function splitSpan(from: number, to: number, gaps: readonly Gap[]): Array<[number, number]> {
  const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  let cur = from;
  for (const [g0, g1] of sorted) {
    if (g0 > cur + 1e-6) out.push([cur, Math.min(g0, to)]);
    cur = Math.max(cur, g1);
  }
  if (cur < to - 1e-6) out.push([cur, to]);
  return out;
}

/** Horizontal wall along y from x0 to x1, leaving openings at `gaps` (x ranges). */
export function hWall(
  id: string,
  y: number,
  x0: number,
  x1: number,
  material: WallMaterial,
  height: number,
  gaps: readonly Gap[] = [],
): WallDef[] {
  return splitSpan(Math.min(x0, x1), Math.max(x0, x1), gaps).map(([a, b], i) => ({
    id: `${id}-${i}`,
    a: vec2(a, y),
    b: vec2(b, y),
    material,
    height,
  }));
}

/** Vertical wall along x from y0 to y1, leaving openings at `gaps` (y ranges). */
export function vWall(
  id: string,
  x: number,
  y0: number,
  y1: number,
  material: WallMaterial,
  height: number,
  gaps: readonly Gap[] = [],
): WallDef[] {
  return splitSpan(Math.min(y0, y1), Math.max(y0, y1), gaps).map(([a, b], i) => ({
    id: `${id}-${i}`,
    a: vec2(x, a),
    b: vec2(x, b),
    material,
    height,
  }));
}

export function door(id: string, a: Vec2, b: Vec2, kind: DoorKind, open = true): DoorDef {
  return { id, a, b, kind, open };
}

/** Incremental nav graph authoring. */
export class NavBuilder {
  private readonly nodes = new Map<string, Vec2>();
  private readonly edges: Array<[string, string]> = [];

  node(id: string, x: number, y: number): this {
    if (this.nodes.has(id)) throw new Error(`duplicate nav node ${id}`);
    this.nodes.set(id, vec2(x, y));
    return this;
  }

  link(...ids: string[]): this {
    for (let i = 1; i < ids.length; i++) this.edges.push([ids[i - 1] as string, ids[i] as string]);
    return this;
  }

  build(): NavGraph {
    return { nodes: [...this.nodes].map(([id, p]) => ({ id, p })), edges: this.edges };
  }
}
