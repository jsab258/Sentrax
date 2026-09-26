import { BufferAttribute, BufferGeometry } from 'three';

/**
 * Collects boxes and quads into one merged BufferGeometry with custom attributes, so every material in a
 * scene is a single draw call. Coordinates here are three.js world coordinates (y up).
 */
export interface VertexExtras {
  /** Per-vertex RGB multiplier (used as vertex colors). */
  color?: [number, number, number];
  /** Horizontal wall normal in the xz plane (walls only). */
  wallNormal?: [number, number];
  /** 1 for exterior walls (wallNormal points outwards), 0 for interior walls. */
  exterior?: number;
  /** Centre of the wall piece in the xz plane; the cutaway decides per piece, not per vertex. */
  wallCenter?: [number, number];
}

export class GeometryBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private uvs: number[] = [];
  private colors: number[] = [];
  private wallNormals: number[] = [];
  private exteriors: number[] = [];
  private wallCenters: number[] = [];
  private tops: number[] = [];
  private indices: number[] = [];
  private vertexCount = 0;

  private vertex(
    p: [number, number, number],
    n: [number, number, number],
    uv: [number, number],
    top: number,
    e: VertexExtras,
  ) {
    this.positions.push(...p);
    this.normals.push(...n);
    this.uvs.push(...uv);
    this.colors.push(...(e.color ?? [1, 1, 1]));
    this.wallNormals.push(...(e.wallNormal ?? [0, 0]));
    this.exteriors.push(e.exterior ?? 0);
    this.wallCenters.push(...(e.wallCenter ?? [0, 0]));
    this.tops.push(top);
    return this.vertexCount++;
  }

  /** A quad from four corners in counter-clockwise order (seen from the normal side). */
  quad(
    corners: [number, number, number][],
    normal: [number, number, number],
    uvs: [number, number][],
    tops: number[],
    extras: VertexExtras = {},
  ): void {
    const idx = corners.map((c, i) => this.vertex(c, normal, uvs[i] ?? [0, 0], tops[i] ?? 0, extras));
    const [a, b, c, d] = idx as [number, number, number, number];
    this.indices.push(a, b, c, a, c, d);
  }

  /**
   * Axis-aligned-in-local-space box: centred at `center`, rotated by `yaw` around y, size [length along
   * local x, height, depth along local z]. UVs are box-mapped in world metres (u along the face, v up).
   * `topExtras` override the extras of the top face (for example a darker section color on cut walls).
   */
  box(
    center: [number, number, number],
    size: [number, number, number],
    yaw = 0,
    extras: VertexExtras = {},
    topExtras?: VertexExtras,
    faces: { bottom?: boolean } = {},
  ): void {
    const [cx, cy, cz] = center;
    const [lx, ly, lz] = [size[0] / 2, size[1] / 2, size[2] / 2];
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const w = (x: number, y: number, z: number): [number, number, number] => [
      cx + x * cos + z * sin,
      cy + y,
      cz - x * sin + z * cos,
    ];
    const rot = (x: number, z: number): [number, number, number] => [
      x * cos + z * sin,
      0,
      -x * sin + z * cos,
    ];
    const L = size[0];
    const Hh = size[1];
    const D = size[2];
    const y0 = cy - ly;
    // Side faces: +z, -z, +x, -x (local).
    const sides: Array<{ n: [number, number, number]; c: [number, number, number][]; width: number }> = [
      { n: rot(0, 1), c: [w(-lx, -ly, lz), w(lx, -ly, lz), w(lx, ly, lz), w(-lx, ly, lz)], width: L },
      { n: rot(0, -1), c: [w(lx, -ly, -lz), w(-lx, -ly, -lz), w(-lx, ly, -lz), w(lx, ly, -lz)], width: L },
      { n: rot(1, 0), c: [w(lx, -ly, lz), w(lx, -ly, -lz), w(lx, ly, -lz), w(lx, ly, lz)], width: D },
      { n: rot(-1, 0), c: [w(-lx, -ly, -lz), w(-lx, -ly, lz), w(-lx, ly, lz), w(-lx, ly, -lz)], width: D },
    ];
    for (const s of sides) {
      this.quad(
        s.c,
        s.n,
        [
          [0, y0],
          [s.width, y0],
          [s.width, y0 + Hh],
          [0, y0 + Hh],
        ],
        [0, 0, 1, 1],
        extras,
      );
    }
    this.quad(
      [w(-lx, ly, lz), w(lx, ly, lz), w(lx, ly, -lz), w(-lx, ly, -lz)],
      [0, 1, 0],
      [
        [0, 0],
        [L, 0],
        [L, D],
        [0, D],
      ],
      [1, 1, 1, 1],
      topExtras ?? extras,
    );
    if (faces.bottom) {
      this.quad(
        [w(-lx, -ly, -lz), w(lx, -ly, -lz), w(lx, -ly, lz), w(-lx, -ly, lz)],
        [0, -1, 0],
        [
          [0, 0],
          [L, 0],
          [L, D],
          [0, D],
        ],
        [0, 0, 0, 0],
        extras,
      );
    }
  }

  /** Horizontal rectangle (floor piece) with world-metre UVs taken from x and z. */
  floorRect(x0: number, z0: number, x1: number, z1: number, y: number, extras: VertexExtras = {}): void {
    this.quad(
      [
        [x0, y, z1],
        [x1, y, z1],
        [x1, y, z0],
        [x0, y, z0],
      ],
      [0, 1, 0],
      [
        [x0, -z1],
        [x1, -z1],
        [x1, -z0],
        [x0, -z0],
      ],
      [0, 0, 0, 0],
      extras,
    );
  }

  get empty(): boolean {
    return this.vertexCount === 0;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.normals), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3));
    g.setAttribute('aWallNormal', new BufferAttribute(new Float32Array(this.wallNormals), 2));
    g.setAttribute('aExterior', new BufferAttribute(new Float32Array(this.exteriors), 1));
    g.setAttribute('aWallCenter', new BufferAttribute(new Float32Array(this.wallCenters), 2));
    g.setAttribute('aTop', new BufferAttribute(new Float32Array(this.tops), 1));
    const index = this.vertexCount > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices);
    g.setIndex(new BufferAttribute(index, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}
