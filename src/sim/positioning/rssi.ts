import type { SimConfig } from '../config';
import { dist2, type Vec2, type Vec3 } from '../geometry';
import { rssiToDistance } from '../rf';
import type { InfraDeviceDef } from '../world';
import type { Estimate } from './types';

interface Sample {
  t: number;
  rssi: number;
}

/** Height the estimator assumes for tags (it cannot know the real one). */
const ASSUMED_TAG_HEIGHT = 1.0;

/**
 * RSSI positioning: average recent RSSI per gateway, convert to distance with the log-distance model
 * (without knowledge of walls), then weighted least-squares trilateration from the strongest gateways.
 * With one or two gateways it falls back to proximity (weighted centroid).
 */
export class RssiPositioner {
  private readonly samples = new Map<string, Map<string, Sample[]>>();
  private readonly estimates = new Map<string, Estimate>();
  private readonly nextUpdate = new Map<string, number>();
  private readonly gateways = new Map<string, InfraDeviceDef>();
  private readonly lastSample = new Map<string, number>();

  constructor(
    private readonly cfg: SimConfig,
    gateways: InfraDeviceDef[],
  ) {
    for (const g of gateways) this.gateways.set(g.id, g);
  }

  ingest(tagId: string, gatewayId: string, rssi: number, t: number): void {
    this.lastSample.set(tagId, t);
    let perTag = this.samples.get(tagId);
    if (!perTag) {
      perTag = new Map();
      this.samples.set(tagId, perTag);
    }
    let list = perTag.get(gatewayId);
    if (!list) {
      list = [];
      perTag.set(gatewayId, list);
    }
    list.push({ t, rssi });
  }

  update(t: number): void {
    const c = this.cfg.rssi;
    for (const [tagId, perTag] of this.samples) {
      if (t < (this.nextUpdate.get(tagId) ?? 0)) continue;
      this.nextUpdate.set(tagId, t + c.updateS);
      const means: Array<{ g: InfraDeviceDef; rssi: number; from: number }> = [];
      for (const [gwId, list] of perTag) {
        while (list.length && (list[0] as Sample).t < t - c.windowS) list.shift();
        if (!list.length) continue;
        const g = this.gateways.get(gwId);
        if (!g) continue;
        means.push({
          g,
          rssi: list.reduce((s, x) => s + x.rssi, 0) / list.length,
          from: (list[0] as Sample).t,
        });
      }
      const rx = (m: { g: InfraDeviceDef }) => this.cfg.receivers[m.g.model];
      const usable = means.filter((m) => m.rssi >= (rx(m).fixFloorDbm ?? c.floorDbm));
      const only = usable[0];
      const proximity =
        usable.length === 1 && !!only && only.rssi >= (rx(only).proximityDbm ?? c.proximityDbm);
      if (usable.length < c.minGateways && !proximity) continue;
      usable.sort((a, b) => b.rssi - a.rssi);
      const used = usable.slice(0, c.maxGateways);
      const raw = this.solve(used);
      const prev = this.estimates.get(tagId);
      const a = c.smoothingAlpha;
      const position: Vec3 =
        prev?.position && t - prev.t < c.staleS
          ? {
              x: prev.position.x + a * (raw.p.x - prev.position.x),
              y: prev.position.y + a * (raw.p.y - prev.position.y),
              z: ASSUMED_TAG_HEIGHT,
            }
          : { x: raw.p.x, y: raw.p.y, z: ASSUMED_TAG_HEIGHT };
      this.estimates.set(tagId, {
        tagId,
        tech: 'rssi',
        t,
        position,
        uncertaintyM: raw.uncertainty,
        sources: used.map((u) => u.g.id),
        from: Math.min(...used.map((u) => u.from)),
      });
    }
  }

  get(tagId: string, t: number): Estimate | undefined {
    const e = this.estimates.get(tagId);
    return e && t - e.t <= this.cfg.rssi.staleS ? e : undefined;
  }

  /**
   * Mean RSSI per gateway over the current window and the distance it implies under the estimator's
   * path loss model (read-only; for the RSSI lens: range rings and trilateration circles).
   */
  ranges(tagId: string, t: number): Array<{ gatewayId: string; rssi: number; distanceM: number }> {
    const { rf, rssi: c } = this.cfg;
    const out: Array<{ gatewayId: string; rssi: number; distanceM: number }> = [];
    for (const [gatewayId, list] of this.samples.get(tagId) ?? []) {
      const recent = list.filter((x) => x.t >= t - c.windowS);
      if (!recent.length) continue;
      const rssi = recent.reduce((s, x) => s + x.rssi, 0) / recent.length;
      const g = this.gateways.get(gatewayId);
      if (rssi < ((g && this.cfg.receivers[g.model].fixFloorDbm) ?? c.floorDbm)) continue;
      out.push({
        gatewayId,
        rssi,
        distanceM: rssiToDistance(rssi, rf.rssiAt1mDbm, c.estimatorPathLossExponent),
      });
    }
    return out.sort((a, b) => b.rssi - a.rssi).slice(0, c.maxGateways);
  }

  /** Time of the most recent packet from the tag at any gateway. */
  lastSampleAt(tagId: string): number {
    return this.lastSample.get(tagId) ?? -Infinity;
  }

  private solve(used: Array<{ g: InfraDeviceDef; rssi: number }>): { p: Vec2; uncertainty: number } {
    const { rf, rssi: c } = this.cfg;
    const pts = used.map((u) => {
      const d = rssiToDistance(u.rssi, rf.rssiAt1mDbm, c.estimatorPathLossExponent);
      const dz = u.g.position.z - ASSUMED_TAG_HEIGHT;
      return { g: u.g.position as Vec2, r: Math.sqrt(Math.max(0.25, d * d - dz * dz)) };
    });
    // Weighted centroid, weights 1/r^2: the proximity estimate and the starting point for trilateration.
    let wx = 0;
    let wy = 0;
    let ws = 0;
    for (const p of pts) {
      const w = 1 / (p.r * p.r);
      wx += p.g.x * w;
      wy += p.g.y * w;
      ws += w;
    }
    let est: Vec2 = { x: wx / ws, y: wy / ws };
    if (pts.length >= 3) {
      // Gauss-Newton on sum w_i (|p - g_i| - r_i)^2.
      for (let iter = 0; iter < 12; iter++) {
        let a11 = 0;
        let a12 = 0;
        let a22 = 0;
        let b1 = 0;
        let b2 = 0;
        for (const p of pts) {
          const dx = est.x - p.g.x;
          const dy = est.y - p.g.y;
          const d = Math.max(0.1, Math.hypot(dx, dy));
          const res = d - p.r;
          const jx = dx / d;
          const jy = dy / d;
          const w = 1 / (p.r * p.r);
          a11 += w * jx * jx;
          a12 += w * jx * jy;
          a22 += w * jy * jy;
          b1 += w * jx * res;
          b2 += w * jy * res;
        }
        const det = a11 * a22 - a12 * a12;
        if (Math.abs(det) < 1e-12) break;
        const sx = (a22 * b1 - a12 * b2) / det;
        const sy = (a11 * b2 - a12 * b1) / det;
        est = { x: est.x - sx, y: est.y - sy };
        if (Math.hypot(sx, sy) < 0.01) break;
      }
      // Guard against divergence: stay near the gateways that heard the tag.
      const maxR = Math.max(...pts.map((p) => p.r));
      const centroid = { x: wx / ws, y: wy / ws };
      if (dist2(est, centroid) > maxR + 5) est = centroid;
    }
    let rw = 0;
    let rs = 0;
    for (const p of pts) {
      const w = 1 / (p.r * p.r);
      const res = dist2(est, p.g) - p.r;
      rw += w * res * res;
      rs += w;
    }
    const rms = Math.sqrt(rw / rs);
    const minR = Math.min(...pts.map((p) => p.r));
    const raw = pts.length === 1 ? minR : 1 + rms + 0.15 * minR;
    const uncertainty = Math.min(c.uncertaintyMaxM, Math.max(c.uncertaintyMinM, raw));
    return { p: est, uncertainty };
  }
}
