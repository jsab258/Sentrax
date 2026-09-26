import { pointInPolygon, polygonCentroid, type Vec2 } from './geometry';
import type { WorldDef, ZoneDef } from './world';

/** Zone lookups: which zones contain a point, zone ancestry and centroids. */
export class ZoneIndex {
  readonly byId = new Map<string, ZoneDef>();
  private readonly centroids = new Map<string, Vec2>();

  constructor(world: WorldDef) {
    for (const z of world.zones) {
      this.byId.set(z.id, z);
      this.centroids.set(z.id, polygonCentroid(z.polygon));
    }
  }

  get(id: string): ZoneDef {
    const z = this.byId.get(id);
    if (!z) throw new Error(`unknown zone ${id}`);
    return z;
  }

  centroid(id: string): Vec2 {
    return this.centroids.get(id) ?? { x: 0, y: 0 };
  }

  /** The zone and all its parents, innermost first. */
  withAncestors(id: string): string[] {
    const out: string[] = [];
    let cur: string | undefined = id;
    while (cur && !out.includes(cur)) {
      out.push(cur);
      cur = this.byId.get(cur)?.parent;
    }
    return out;
  }

  /** Every zone whose polygon contains the point. */
  zonesAt(p: Vec2): string[] {
    const out: string[] = [];
    for (const z of this.byId.values()) if (pointInPolygon(p, z.polygon)) out.push(z.id);
    return out;
  }

  /** Innermost room or corridor containing the point, if any. */
  roomAt(p: Vec2): string | null {
    let best: string | null = null;
    let bestDepth = -1;
    for (const z of this.byId.values()) {
      if ((z.kind !== 'room' && z.kind !== 'corridor') || !pointInPolygon(p, z.polygon)) continue;
      const depth = this.withAncestors(z.id).length;
      if (depth > bestDepth) {
        bestDepth = depth;
        best = z.id;
      }
    }
    return best;
  }
}
