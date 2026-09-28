import { DOCKS } from '../../sim/scenes/warehouse';

/** Loading dock height: the hall floor lies this far above the yard (a standard truck bed height). */
export const DOCK_HEIGHT = 1.2;

/** Ramps from the exit doors down to the yard (plan rectangles and the direction they fall). */
const RAMP_LENGTH = 4;

/**
 * Ground height under a plan position in the warehouse: the hall and the inside of docked trailers at
 * floor level, the yard one dock height lower, with pedestrian ramps at the south and east exits.
 */
export function warehouseGround(x: number, y: number): number {
  if (x >= 0 && x <= 80 && y >= 0 && y <= 50) return 0;
  for (const dx of DOCKS) if (Math.abs(x - dx) <= 1.3 && y < 0 && y >= -14) return 0;
  if (x >= 30.4 && x <= 33.4 && y < 0 && y > -RAMP_LENGTH) return (DOCK_HEIGHT * y) / RAMP_LENGTH;
  if (y >= 19.4 && y <= 22.4 && x > 80 && x < 80 + RAMP_LENGTH)
    return (-DOCK_HEIGHT * (x - 80)) / RAMP_LENGTH;
  return -DOCK_HEIGHT;
}
