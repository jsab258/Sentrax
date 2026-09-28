import { BufferAttribute, BufferGeometry, MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { withCutaway } from '../materials/cutaway';
import { placementMatrix, type ModelParts, type Placement } from '../kit/instancing';

/** Depth-only material for occluders; the cutaway variant for walls and doors. */
export function occluderMaterial(cut: boolean): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ colorWrite: false });
  return cut ? withCutaway(m) : m;
}

/**
 * One static geometry holding every placement of the given models (positions only), for the occluder
 * depth pass: large furniture that can hide an overlay costs a single draw call.
 */
export function mergedPlacements(
  models: Record<string, ModelParts>,
  placements: readonly Placement[],
  include: ReadonlySet<string>,
): BufferGeometry | null {
  const parts: BufferGeometry[] = [];
  for (const p of placements) {
    if (!include.has(p.model) || p.wall) continue;
    const m = placementMatrix(p).clone();
    for (const g of Object.values(models[p.model] ?? {})) {
      if (!g) continue;
      const c = new BufferGeometry();
      c.setAttribute('position', (g.getAttribute('position') as BufferAttribute).clone());
      c.setIndex(g.index ? g.index.clone() : null);
      c.applyMatrix4(m);
      parts.push(c);
    }
  }
  if (!parts.length) return null;
  const merged = mergeGeometries(parts, false);
  for (const c of parts) c.dispose();
  merged?.computeBoundingSphere();
  return merged;
}
