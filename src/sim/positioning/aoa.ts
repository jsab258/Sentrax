import type { SimConfig } from '../config';
import { dist3, type Vec3 } from '../geometry';
import type { Rng } from '../rng';
import type { InfraDeviceDef } from '../world';
import type { Estimate } from './types';

export interface AoaRay {
  locatorId: string;
  origin: Vec3;
  /** Unit direction from the locator towards the tag, including measurement noise. */
  dir: Vec3;
  /** Measured azimuth (rad, from +x towards +y) and elevation below horizontal (rad). */
  azimuth: number;
  elevation: number;
}

const DEG = Math.PI / 180;

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/** Least-squares point closest to all rays: minimise sum w_i |(I - u_i u_i^T)(p - a_i)|^2. */
export function intersectRays(rays: readonly AoaRay[], weights?: readonly number[]): Vec3 | null {
  // Normal equations A p = b with A = sum w (I - u u^T) (symmetric) and b = sum w (I - u u^T) a.
  let a00 = 0;
  let a01 = 0;
  let a02 = 0;
  let a11 = 0;
  let a12 = 0;
  let a22 = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  rays.forEach((r, i) => {
    const w = weights?.[i] ?? 1;
    const { x: ux, y: uy, z: uz } = r.dir;
    const { x: ax, y: ay, z: az } = r.origin;
    const p00 = 1 - ux * ux;
    const p01 = -ux * uy;
    const p02 = -ux * uz;
    const p11 = 1 - uy * uy;
    const p12 = -uy * uz;
    const p22 = 1 - uz * uz;
    a00 += w * p00;
    a01 += w * p01;
    a02 += w * p02;
    a11 += w * p11;
    a12 += w * p12;
    a22 += w * p22;
    b0 += w * (p00 * ax + p01 * ay + p02 * az);
    b1 += w * (p01 * ax + p11 * ay + p12 * az);
    b2 += w * (p02 * ax + p12 * ay + p22 * az);
  });
  // Cramer's rule.
  const det = a00 * (a11 * a22 - a12 * a12) - a01 * (a01 * a22 - a12 * a02) + a02 * (a01 * a12 - a11 * a02);
  if (Math.abs(det) < 1e-10) return null;
  const x = (b0 * (a11 * a22 - a12 * a12) - a01 * (b1 * a22 - a12 * b2) + a02 * (b1 * a12 - a11 * b2)) / det;
  const y = (a00 * (b1 * a22 - a12 * b2) - b0 * (a01 * a22 - a12 * a02) + a02 * (a01 * b2 - b1 * a02)) / det;
  const z = (a00 * (a11 * b2 - b1 * a12) - a01 * (a01 * b2 - b1 * a02) + b0 * (a01 * a12 - a11 * a02)) / det;
  return { x, y, z };
}

/** Perpendicular distance from a point to a ray's line. */
export function rayResidual(r: AoaRay, p: Vec3): number {
  const v = { x: p.x - r.origin.x, y: p.y - r.origin.y, z: p.z - r.origin.z };
  const t = v.x * r.dir.x + v.y * r.dir.y + v.z * r.dir.z;
  return Math.hypot(v.x - t * r.dir.x, v.y - t * r.dir.y, v.z - t * r.dir.z);
}

/**
 * AoA positioning: each ceiling locator measures azimuth and elevation of the tag with angular noise;
 * the estimate is the least-squares intersection of the rays from two or more locators, reweighted by
 * distance, with one round of outlier rejection, then lightly smoothed.
 */
export class AoaPositioner {
  private readonly estimates = new Map<string, Estimate>();

  constructor(
    private readonly cfg: SimConfig,
    private readonly rng: Rng,
  ) {}

  /** Simulated measurement of one packet at one locator, or null when outside the field of view. */
  measure(locator: InfraDeviceDef, tag: Vec3): AoaRay | null {
    const c = this.cfg.aoa;
    const v = { x: tag.x - locator.position.x, y: tag.y - locator.position.y, z: tag.z - locator.position.z };
    const u = normalize(v);
    // Ceiling mount looks straight down: off-axis angle from nadir.
    const offAxis = Math.acos(Math.max(-1, Math.min(1, -u.z)));
    if (offAxis > c.fovHalfAngleDeg * DEG) return null;
    const sigma = (this.rng.chance(c.outlierProbability) ? c.outlierNoiseDeg : c.angleNoiseDeg) * DEG;
    const helper = Math.abs(u.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    const e1 = normalize(cross(u, helper));
    const e2 = cross(u, e1);
    const n1 = this.rng.normal(0, sigma);
    const n2 = this.rng.normal(0, sigma);
    const dir = normalize({
      x: u.x + e1.x * n1 + e2.x * n2,
      y: u.y + e1.y * n1 + e2.y * n2,
      z: u.z + e1.z * n1 + e2.z * n2,
    });
    return {
      locatorId: locator.id,
      origin: locator.position,
      dir,
      azimuth: Math.atan2(dir.y, dir.x),
      elevation: Math.atan2(-dir.z, Math.hypot(dir.x, dir.y)),
    };
  }

  /** Rays from one advertising packet. Produces or updates the tag's estimate. */
  ingest(tagId: string, rays: AoaRay[], t: number): void {
    const c = this.cfg.aoa;
    if (rays.length < c.minLocators) return;
    let used = rays;
    let p = intersectRays(used);
    if (!p) return;
    // Lateral error grows with distance, so weight rays by 1/d^2 and solve again.
    const weigh = (rs: AoaRay[], at: Vec3) => rs.map((r) => 1 / Math.max(1, dist3(r.origin, at)) ** 2);
    p = intersectRays(used, weigh(used, p)) ?? p;
    if (used.length >= 3) {
      const expected = used.map((r) => Math.max(0.2, dist3(r.origin, p as Vec3) * c.angleNoiseDeg * DEG));
      const ratios = used.map((r, i) => rayResidual(r, p as Vec3) / (expected[i] as number));
      const worst = ratios.indexOf(Math.max(...ratios));
      if ((ratios[worst] as number) > 3.5) {
        used = used.filter((_, i) => i !== worst);
        p = intersectRays(used, weigh(used, p)) ?? p;
      }
    }
    // Rays must meet below the locators.
    const ceiling = Math.min(...used.map((r) => r.origin.z));
    if (p.z > ceiling || p.z < -1) return;
    p = { ...p, z: Math.max(0, p.z) };

    const prev = this.estimates.get(tagId);
    let position = p;
    if (prev?.position && t - prev.t < c.staleS && dist3(prev.position, p) < c.resetJumpM) {
      const a = c.smoothingAlpha;
      position = {
        x: prev.position.x + a * (p.x - prev.position.x),
        y: prev.position.y + a * (p.y - prev.position.y),
        z: prev.position.z + a * (p.z - prev.position.z),
      };
    }
    this.estimates.set(tagId, {
      tagId,
      tech: 'aoa',
      t,
      position,
      uncertaintyM: 0.5,
      sources: used.map((r) => r.locatorId),
    });
  }

  get(tagId: string, t: number): Estimate | undefined {
    const e = this.estimates.get(tagId);
    return e && t - e.t <= this.cfg.aoa.staleS ? e : undefined;
  }
}
