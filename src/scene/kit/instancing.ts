import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { Palette } from '../materials/palette';
import type { Bucket, RGB } from './parts';

export type ModelParts = Partial<Record<Bucket, BufferGeometry>>;

/** Where one instance of a model stands, in plan coordinates (x east, y north) plus height. */
export interface Placement {
  model: string;
  x: number;
  y: number;
  /** Height of the model origin above the floor (m). */
  z?: number;
  /** Plan heading in degrees; 0 means the model's +x faces east, 90 north. */
  heading?: number;
  /**
   * Rotation about the model's local z axis (radians), applied before the heading: Math.PI mounts a
   * device upside down on a ceiling, -Math.PI / 2 turns its top face towards +x for a wall.
   */
  pitch?: number;
  /** Instance colour, multiplied with the part colours (for example chair fabric variations). */
  tint?: RGB;
  /** Restrict the tint to one material (for example only the upholstery of a chair). */
  tintMat?: Bucket;
  /** Uniform scale, for parametric pieces. Defaults to 1. */
  scale?: [number, number, number];
  /** Wall-mounted pieces cut down together with the wall behind them (see materials/cutaway.ts). */
  wall?: WallAttachment;
}

/** Cutaway attributes of the host wall, in three.js xz coordinates. */
export interface WallAttachment {
  normal: [number, number];
  center: [number, number];
  exterior: 0 | 1;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _fwd = new Vector3(0, 0, 1);
const _qp = new Quaternion();
const _c = new Color();

/** Instance matrix for a plan position and heading (three.js: x, height, -y; rotation about y). */
export function placementMatrix(p: Placement, out = _m): Matrix4 {
  _p.set(p.x, p.z ?? 0, -p.y);
  _q.setFromAxisAngle(_up, ((p.heading ?? 0) * Math.PI) / 180);
  if (p.pitch) _q.multiply(_qp.setFromAxisAngle(_fwd, p.pitch));
  _s.set(...(p.scale ?? [1, 1, 1]));
  return out.compose(_p, _q, _s);
}

/**
 * One InstancedMesh per (model, material): every bed frame in the scene is a single draw call, every
 * bed mattress another, and so on.
 */
export function buildInstances(
  models: Record<string, ModelParts>,
  placements: readonly Placement[],
  palette: Palette,
  shadows: { cast: boolean; receive: boolean },
): InstancedMesh[] {
  const byModel = new Map<string, Placement[]>();
  for (const p of placements) {
    const list = byModel.get(p.model) ?? [];
    list.push(p);
    byModel.set(p.model, list);
  }
  const meshes: InstancedMesh[] = [];
  for (const [name, list] of byModel) {
    const parts = models[name];
    if (!parts) throw new Error(`unknown model ${name}`);
    for (const [mat, geometry] of Object.entries(parts) as Array<[Bucket, BufferGeometry]>) {
      const onWall = list.some((p) => p.wall);
      if (onWall) {
        geometry.setAttribute(
          'aWallNormal',
          new InstancedBufferAttribute(new Float32Array(list.flatMap((p) => p.wall?.normal ?? [0, 0])), 2),
        );
        geometry.setAttribute(
          'aWallCenter',
          new InstancedBufferAttribute(new Float32Array(list.flatMap((p) => p.wall?.center ?? [0, 0])), 2),
        );
        geometry.setAttribute(
          'aExterior',
          new InstancedBufferAttribute(new Float32Array(list.map((p) => p.wall?.exterior ?? 0)), 1),
        );
      }
      const mesh = new InstancedMesh(geometry, onWall ? palette.cut[mat] : palette.mats[mat], list.length);
      if (onWall) mesh.customDepthMaterial = palette.cutDepth;
      mesh.name = `${name}:${mat}`;
      const tinted = (p: Placement) => p.tint && (!p.tintMat || p.tintMat === mat);
      const anyTint = list.some(tinted);
      list.forEach((p, i) => {
        mesh.setMatrixAt(i, placementMatrix(p));
        if (anyTint) mesh.setColorAt(i, tinted(p) && p.tint ? _c.setRGB(...p.tint) : _c.setRGB(1, 1, 1));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = shadows.cast && mat !== 'screen';
      mesh.receiveShadow = shadows.receive;
      mesh.computeBoundingSphere();
      meshes.push(mesh);
    }
  }
  return meshes;
}
