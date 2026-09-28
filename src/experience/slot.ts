import type { ReportedPosition } from '../sim/positionSource';
import { RACK } from '../sim/scenes/warehouse';

export interface SlotRef {
  aisle: string;
  bay: number;
  level: number;
}

/** Height of a pallet tag above its pallet base (world data: TOW-1 on pallets at 0.9 m). */
const TAG_ABOVE_BASE = 0.9;

/**
 * The rack slot a reported 3D position falls in: aisle and face from y, bay from x, level from height.
 * Uses only what the system reports (an AoA fix), never ground truth; null outside the racking or
 * without a height.
 */
export function slotFromReport(r: ReportedPosition | undefined): SlotRef | null {
  const p = r?.position;
  if (!p || r?.tech !== 'aoa') return null;
  let best: { aisle: string; north: boolean; d: number } | null = null;
  for (const [aisle, y] of Object.entries(RACK.aisles)) {
    for (const north of [false, true]) {
      const d = Math.abs(p.y - (y + (north ? RACK.faceOffset : -RACK.faceOffset)));
      if (!best || d < best.d) best = { aisle, north, d };
    }
  }
  if (!best || best.d > 1.2) return null;
  const index = Math.floor((p.x - RACK.x0) / RACK.bayPitch);
  if (index < 0 || index >= RACK.baysPerFace) return null;
  const base = p.z - TAG_ABOVE_BASE;
  let level = 1;
  let bestDz = Infinity;
  RACK.levelHeights.forEach((h, i) => {
    const dz = Math.abs(base - (h + 0.15));
    if (dz < bestDz) {
      bestDz = dz;
      level = i + 1;
    }
  });
  if (bestDz > 0.9) return null;
  return { aisle: best.aisle, bay: best.north ? 2 * (index + 1) : 2 * index + 1, level };
}
