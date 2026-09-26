import type { SimConfig } from './config';
import { dist3, segmentsIntersect, type Vec2, type Vec3 } from './geometry';
import type { Rng } from './rng';
import type { WorldDef } from './world';

interface RfObstacle {
  a: Vec2;
  b: Vec2;
  attenuationDb: number;
}

/**
 * BLE propagation model (illustrative):
 *   RSSI = P(1 m) - 10 n log10(d) - sum(wall and door losses) + shadowing + noise
 * Shadowing is a slowly varying offset per tag-receiver link that decorrelates as the tag moves, which is
 * what keeps RSSI errors from averaging away. Noise is drawn per packet.
 */
export class RadioModel {
  private obstacles: RfObstacle[] = [];
  private readonly shadow = new Map<string, { value: number; at: Vec3 }>();

  constructor(
    private readonly world: WorldDef,
    private readonly cfg: SimConfig,
    private readonly rng: Rng,
  ) {
    this.rebuild();
  }

  /** Recompute obstacles, for example after a door opened or closed. */
  rebuild(): void {
    const rf = this.cfg.rf;
    const walls: RfObstacle[] = this.world.walls.map((w) => ({
      a: w.a,
      b: w.b,
      attenuationDb: rf.wallAttenuationDb[w.material],
    }));
    const doors: RfObstacle[] = this.world.doors
      .filter((d) => d.kind !== 'opening' && d.kind !== 'gate')
      .map((d) => ({
        a: d.a,
        b: d.b,
        attenuationDb: d.open
          ? rf.doorAttenuationDb.open
          : d.kind === 'dock' || d.kind === 'elevator'
            ? rf.doorAttenuationDb.closedDock
            : rf.doorAttenuationDb.closed,
      }));
    this.obstacles = [...walls, ...doors];
  }

  /** Total obstacle loss on the straight line between two points (plan view). */
  obstacleLossDb(a: Vec2, b: Vec2): number {
    let loss = 0;
    for (const o of this.obstacles) if (segmentsIntersect(a, b, o.a, o.b)) loss += o.attenuationDb;
    return loss;
  }

  /** Mean RSSI without shadowing or noise. Used by tests and by commissioning helpers. */
  meanRssi(tx: Vec3, rx: Vec3): number {
    const rf = this.cfg.rf;
    const d = Math.max(0.3, dist3(tx, rx));
    return rf.rssiAt1mDbm - 10 * rf.pathLossExponent * Math.log10(d) - this.obstacleLossDb(tx, rx);
  }

  /** One received packet's RSSI for the link `linkKey` (tag id plus receiver id). */
  sample(tx: Vec3, rx: Vec3, linkKey: string): number {
    const rf = this.cfg.rf;
    let s = this.shadow.get(linkKey);
    if (!s) {
      s = { value: this.rng.normal(0, rf.shadowSigmaDb), at: { ...tx } };
      this.shadow.set(linkKey, s);
    } else {
      const moved = dist3(s.at, tx);
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
