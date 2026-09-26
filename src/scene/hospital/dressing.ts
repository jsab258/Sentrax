import type { DoorDef } from '../../sim/world';
import type { WindowDef } from '../buildingGeometry';

/**
 * Visual-only dressing for the hospital that the simulation does not need: windows in the exterior
 * walls and the bathroom sliding doors. Plan coordinates, like the world data.
 */

const ROOM_W = 34 / 6;
const SILL = 0.9;
const HEAD = 2.3;

const h = (y: number, x0: number, x1: number): WindowDef => ({
  a: { x: x0, y },
  b: { x: x1, y },
  sill: SILL,
  head: HEAD,
});
const v = (x: number, y0: number, y1: number): WindowDef => ({
  a: { x, y: y0 },
  b: { x, y: y1 },
  sill: SILL,
  head: HEAD,
});

export const hospitalWindows: WindowDef[] = [
  // Patient rooms: one window each, beside the bed head.
  ...Array.from({ length: 6 }, (_, i) => h(20, i * ROOM_W + 0.5, i * ROOM_W + 2.5)),
  // ICU, storage, dirty utility and nurse station on the south facade. The medication room has none.
  h(0, 1.0, 4.6),
  h(0, 6.4, 10.0),
  h(0, 13.2, 15.4),
  h(0, 18.6, 20.4),
  h(0, 28.0, 32.6),
  // Corridor end and the lobby.
  v(0, 10.5, 12.5),
  h(17, 35.2, 38.8),
  h(4, 35.2, 38.8),
];

/** Sliding doors of the bathroom pods, shown open (the pod openings in the world data). */
export const hospitalVisualDoors: DoorDef[] = Array.from({ length: 6 }, (_, i) => ({
  id: `door-bath-${i + 1}`,
  a: { x: i * ROOM_W + 3.3, y: 13.8 },
  b: { x: i * ROOM_W + 3.3, y: 14.6 },
  kind: 'sliding',
  open: true,
}));
