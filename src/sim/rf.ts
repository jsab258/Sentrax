import type { SimConfig } from './config';
import { dist3, segmentsIntersect, type Vec2, type Vec3 } from './geometry';
import type { Rng } from './rng';
import type { WorldDef, ZoneDef } from './world';
import { pointInPolygon } from './geometry';

interface RfObstacle {
  a: Vec2;
  b: Vec2;
  attenuationDb: number;
  /** Bounding box, for a cheap rejection before the exact crossing test. */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Bounding boxes are compared with this margin, well above the crossing test's own tolerance (1e-9), so
 * the rejection never skips a pair the exact test would count.
 */
const BOX_MARGIN = 1e-6;

function obstacle(a: Vec2, b: Vec2, attenuationDb: number): RfObstacle {
  return {
    a,
    b,
    attenuationDb,
    minX: Math.min(a.x, b.x) - BOX_MARGIN,
    maxX: Math.max(a.x, b.x) + BOX_MARGIN,
    minY: Math.min(a.y, b.y) - BOX_MARGIN,
    maxY: Math.max(a.y, b.y) + BOX_MARGIN,
  };
}

/**
 * BLE propagation model (illustrative):
 *   RSSI = P(1 m) - 10 n log10(d) - sum(wall and door losses) + shadowing + noise
 * Shadowing is a slowly varying offset per tag-receiver link that decorrelates as the tag moves, which is
 * what keeps RSSI errors from averaging away. Noise is drawn per packet.
 */
export class RadioModel {
  private obstacles: RfObstacle[] = [];
  private readonly indoorZones: ZoneDef[];
  private readonly shadow = new Map<string, { value: number; at: Vec3 }>();
  /** isOutdoor results for receiver positions (static) and for the last transmitter position. */
  private readonly outdoorAt = new WeakMap<Vec2, { x: number; y: number; out: boolean }>();

  constructor(
    private readonly world: WorldDef,
    private readonly cfg: SimConfig,
    private readonly rng: Rng,
  ) {
    this.indoorZones = world.zones.filter((z) => z.kind !== 'outdoor' && !z.parent);
    this.rebuild();
  }

  /** True when the point lies outside every top-level indoor zone. */
  isOutdoor(p: Vec2): boolean {
    return !this.indoorZones.some((z) => pointInPolygon(p, z.polygon));
  }

  /** Recompute obstacles, for example after a door opened or closed. */
  rebuild(): void {
    const rf = this.cfg.rf;
    const walls: RfObstacle[] = this.world.walls.map((w) =>
      obstacle(w.a, w.b, rf.wallAttenuationDb[w.material]),
    );
    const doors: RfObstacle[] = this.world.doors
      .filter((d) => d.kind !== 'opening' && d.kind !== 'gate')
      .map((d) =>
        obstacle(
          d.a,
          d.b,
          d.open
            ? rf.doorAttenuationDb.open
            : d.kind === 'dock' || d.kind === 'elevator'
              ? rf.doorAttenuationDb.closedDock
              : rf.doorAttenuationDb.closed,
        ),
      );
    this.obstacles = [...walls, ...doors];
  }

  /** Total obstacle loss on the straight line between two points (plan view). */
  obstacleLossDb(a: Vec2, b: Vec2): number {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    let loss = 0;
    for (const o of this.obstacles) {
      if (o.maxX < minX || o.minX > maxX || o.maxY < minY || o.minY > maxY) continue;
      if (segmentsIntersect(a, b, o.a, o.b)) loss += o.attenuationDb;
    }
    return loss;
  }

  /** isOutdoor, remembered per point object while its coordinates stay the same. */
  private outdoorCached(p: Vec2): boolean {
    const c = this.outdoorAt.get(p);
    if (c && c.x === p.x && c.y === p.y) return c.out;
    const out = this.isOutdoor(p);
    this.outdoorAt.set(p, { x: p.x, y: p.y, out });
    return out;
  }

  /** Mean RSSI without shadowing or noise. Used by tests and by commissioning helpers. */
  meanRssi(tx: Vec3, rx: Vec3): number {
    const rf = this.cfg.rf;
    const d = Math.max(0.3, dist3(tx, rx));
    // Receivers first: they never move, so their answer is cached and most are indoors.
    const n =
      this.outdoorCached(rx) && this.outdoorCached(tx) ? rf.pathLossExponentOutdoor : rf.pathLossExponent;
    return rf.rssiAt1mDbm - 10 * n * Math.log10(d) - this.obstacleLossDb(tx, rx);
  }

  /** One received packet's RSSI for the link `linkKey` (tag id plus receiver id). */
  sample(tx: Vec3, rx: Vec3, linkKey: string): number {
    const rf = this.cfg.rf;
    let s = this.shadow.get(linkKey);
    if (!s) {
      s = { value: this.rng.normal(0, rf.shadowSigmaDb), at: { ...tx } };
      this.shadow.set(linkKey, s);
    } else {
      // Squared-distance check first (with a margin): most packets come from a tag that has not moved.
      const dx = s.at.x - tx.x;
      const dy = s.at.y - tx.y;
      const dz = s.at.z - tx.z;
      const moved = dx * dx + dy * dy + dz * dz < 0.0499 * 0.0499 ? 0 : dist3(s.at, tx);
      if (moved > 0.05) {
        const rho = Math.exp(-moved / rf.shadowDecorrelationM);
        s.value = rho * s.value + Math.sqrt(1 - rho * rho) * this.rng.normal(0, rf.shadowSigmaDb);
        s.at = { ...tx };
      }
    }
    return this.meanRssi(tx, rx) + s.value + this.rng.normal(0, rf.noiseSigmaDb);
  }
}

/** Distance implied by an RSSI value under the log-distance model (what an estimator can infer). */
export function rssiToDistance(rssi: number, rssiAt1m: number, n: number): number {
  return Math.pow(10, (rssiAt1m - rssi) / (10 * n));
}
