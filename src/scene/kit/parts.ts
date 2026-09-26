import {
  BoxGeometry,
  BufferAttribute,
  CapsuleGeometry,
  CylinderGeometry,
  Euler,
  LatheGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural modelling kit: furniture, equipment and devices are assembled from primitives, merged into
 * one geometry per material and then instanced (SPEC section 11: instancing for repeated furniture).
 * Units are metres; y is up; a model's local +x is its "forward" (plan heading 0 points east).
 */

/** Surface types used when modelling. Colour variation comes from vertex and instance colours. */
export type MatKey = 'painted' | 'gloss' | 'metal' | 'fabric' | 'upholstery' | 'wood' | 'screen' | 'rubber';

/**
 * Render materials (see materials/palette.ts). Painted, gloss and rubber surfaces share one material,
 * with roughness stored per vertex in the colour alpha, so a model needs as few draw calls as possible.
 */
export type Bucket = 'plain' | 'metal' | 'fabric' | 'upholstery' | 'wood' | 'screen';

const SURFACE: Record<MatKey, { bucket: Bucket; rough: number }> = {
  painted: { bucket: 'plain', rough: 0.55 },
  gloss: { bucket: 'plain', rough: 0.18 },
  rubber: { bucket: 'plain', rough: 0.9 },
  metal: { bucket: 'metal', rough: 0.3 },
  fabric: { bucket: 'fabric', rough: 1 },
  upholstery: { bucket: 'upholstery', rough: 1 },
  wood: { bucket: 'wood', rough: 1 },
  screen: { bucket: 'screen', rough: 0.12 },
};

export type RGB = [number, number, number];

/** sRGB hex to linear RGB, for vertex colours (three.js expects linear vertex colours). */
export function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}

export interface PartOptions {
  /** Position of the part's origin (centre, unless noted). */
  at?: [number, number, number];
  /** Rotation in radians (x, y, z), applied before translation. */
  rot?: [number, number, number];
  color?: RGB;
  /** Roughness override for this part (plain and metal surfaces). */
  rough?: number;
}

const WHITE: RGB = [1, 1, 1];

/** Box-projected UVs in metres, so tiling textures keep their real-world scale on any part. */
function projectUvs(g: BufferGeometry): void {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const [u, v] =
      ax >= ay && ax >= az
        ? [pos.getZ(i), pos.getY(i)]
        : ay >= az
          ? [pos.getX(i), pos.getZ(i)]
          : [pos.getX(i), pos.getY(i)];
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
}

export class PartBuilder {
  private readonly parts = new Map<Bucket, BufferGeometry[]>();

  /** Adds a geometry (consumed) with a transform and a colour. */
  add(mat: MatKey, geometry: BufferGeometry, o: PartOptions = {}): this {
    let g = geometry.index ? geometry : mergeVertices(geometry);
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    const m = new Matrix4().compose(
      new Vector3(...(o.at ?? [0, 0, 0])),
      new Quaternion().setFromEuler(new Euler(...(o.rot ?? [0, 0, 0]))),
      new Vector3(1, 1, 1),
    );
    g.applyMatrix4(m);
    projectUvs(g);
    const surface = SURFACE[mat];
    const c = [...(o.color ?? WHITE), o.rough ?? surface.rough];
    const colors = new Float32Array(g.getAttribute('position').count * 4);
    for (let i = 0; i < colors.length; i += 4) colors.set(c, i);
    g.setAttribute('color', new BufferAttribute(colors, 4));
    g = g.index ? g : mergeVertices(g);
    const list = this.parts.get(surface.bucket) ?? [];
    list.push(g);
    this.parts.set(surface.bucket, list);
    return this;
  }

  /** Box of size [x, y, z] centred at `at`, with optional rounded edges. */
  box(mat: MatKey, size: [number, number, number], o: PartOptions & { radius?: number } = {}): this {
    const r = Math.min(o.radius ?? 0, Math.min(...size) / 2 - 1e-4);
    const g = r > 0 ? new RoundedBoxGeometry(size[0], size[1], size[2], 1, r) : new BoxGeometry(...size);
    return this.add(mat, g, o);
  }

  /** Vertical cylinder (along y) centred at `at`. Use `rot` to lay it down. */
  cyl(
    mat: MatKey,
    radius: number,
    height: number,
    o: PartOptions & { segments?: number; radiusTop?: number } = {},
  ) {
    return this.add(mat, new CylinderGeometry(o.radiusTop ?? radius, radius, height, o.segments ?? 12), o);
  }

  /** Capsule along y (total length includes the caps). */
  capsule(mat: MatKey, radius: number, length: number, o: PartOptions = {}) {
    return this.add(mat, new CapsuleGeometry(radius, Math.max(0.001, length - 2 * radius), 3, 10), o);
  }

  sphere(mat: MatKey, radius: number, o: PartOptions & { scale?: [number, number, number] } = {}) {
    const g = new SphereGeometry(radius, 12, 8);
    if (o.scale) g.scale(...o.scale);
    return this.add(mat, g, o);
  }

  /** Solid of revolution around y from a profile of [radius, height] points. */
  lathe(mat: MatKey, profile: Array<[number, number]>, o: PartOptions & { segments?: number } = {}) {
    const g = new LatheGeometry(
      profile.map(([r, y]) => new Vector2(r, y)),
      o.segments ?? 24,
    );
    return this.add(mat, g, o);
  }

  /** Ring (torus) lying in the xz plane, for straps and handles. */
  ring(
    mat: MatKey,
    radius: number,
    tube: number,
    o: PartOptions & { scale?: [number, number, number] } = {},
  ) {
    const g = new TorusGeometry(radius, tube, 6, 24).rotateX(Math.PI / 2);
    if (o.scale) g.scale(...o.scale);
    return this.add(mat, g, o);
  }

  /** Straight bar between two points (a thin cylinder), for tubing, rails and legs. */
  bar(
    mat: MatKey,
    a: [number, number, number],
    b: [number, number, number],
    radius: number,
    o: PartOptions = {},
  ) {
    const va = new Vector3(...a);
    const vb = new Vector3(...b);
    const len = va.distanceTo(vb);
    const g = new CylinderGeometry(radius, radius, len, 8);
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    g.applyQuaternion(q);
    const mid = va.add(vb).multiplyScalar(0.5);
    return this.add(mat, g, { ...o, at: [mid.x, mid.y, mid.z], rot: [0, 0, 0] });
  }

  /** Castor wheel: small dark wheel with its axis along z, touching the floor at `at` (x, z). */
  castor(x: number, z: number, radius = 0.04): this {
    return this.cyl('rubber', radius, 0.025, {
      at: [x, radius, z],
      rot: [Math.PI / 2, 0, 0],
      color: rgb('#2b2e33'),
    });
  }

  build(): Partial<Record<Bucket, BufferGeometry>> {
    const out: Partial<Record<Bucket, BufferGeometry>> = {};
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) throw new Error(`could not merge parts for ${mat}`);
      merged.computeBoundingSphere();
      out[mat] = merged;
      for (const g of list) g.dispose();
    }
    return out;
  }
}
