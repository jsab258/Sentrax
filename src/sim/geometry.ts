/** Plan coordinates in metres: x east, y north, z up (height above the floor). */
export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 extends Vec2 {
  z: number;
}

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });
export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export function dist2(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

/** Ray casting. Points exactly on an edge may fall either way. */
export function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Vec2;
    const b = poly[j] as Vec2;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function orient(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** True when segment p1-p2 properly crosses segment q1-q2 (touching endpoints count as crossing). */
export function segmentsIntersect(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  const d1 = orient(q1, q2, p1);
  const d2 = orient(q1, q2, p2);
  const d3 = orient(p1, p2, q1);
  const d4 = orient(p1, p2, q2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const onSeg = (a: Vec2, b: Vec2, c: Vec2) =>
    Math.min(a.x, b.x) - 1e-9 <= c.x &&
    c.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) - 1e-9 <= c.y &&
    c.y <= Math.max(a.y, b.y) + 1e-9;
  if (Math.abs(d1) < 1e-12 && onSeg(q1, q2, p1)) return true;
  if (Math.abs(d2) < 1e-12 && onSeg(q1, q2, p2)) return true;
  if (Math.abs(d3) < 1e-12 && onSeg(p1, p2, q1)) return true;
  if (Math.abs(d4) < 1e-12 && onSeg(p1, p2, q2)) return true;
  return false;
}

export function polygonArea(poly: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p = poly[i] as Vec2;
    const q = poly[j] as Vec2;
    a += (q.x + p.x) * (q.y - p.y);
  }
  return Math.abs(a) / 2;
}

export function polygonCentroid(poly: readonly Vec2[]): Vec2 {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p = poly[j] as Vec2;
    const q = poly[i] as Vec2;
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-12) return { ...(poly[0] as Vec2) };
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** Closest point inside (or on) the polygon. Points already inside are returned unchanged. */
export function clampToPolygon(p: Vec2, poly: readonly Vec2[], inset = 0.3): Vec2 {
  if (pointInPolygon(p, poly)) return p;
  let best = poly[0] as Vec2;
  let bestD = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const c = closestPointOnSegment(p, poly[j] as Vec2, poly[i] as Vec2);
    const d = dist2(p, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  const centre = polygonCentroid(poly);
  const toCentre = dist2(best, centre);
  if (toCentre < 1e-9) return best;
  const k = Math.min(inset, toCentre) / toCentre;
  return { x: best.x + (centre.x - best.x) * k, y: best.y + (centre.y - best.y) * k };
}

export function rect(x0: number, y0: number, x1: number, y1: number): Vec2[] {
  return [vec2(x0, y0), vec2(x1, y0), vec2(x1, y1), vec2(x0, y1)];
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[idx] as number;
}
