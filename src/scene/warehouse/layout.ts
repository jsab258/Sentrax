import { Rng } from '../../sim/rng';
import { DOCKS, RACK, slotPosition } from '../../sim/scenes/warehouse';
import type { WorldDef } from '../../sim/world';
import type { Placement } from '../kit/instancing';
import { rgb, type RGB } from '../kit/parts';
import { warehouseGround } from './ground';

/**
 * Where the static warehouse pieces stand (plan coordinates). Rack rows follow the rack constants in the
 * world data, so every tagged pallet sits in a real rack slot; untagged stock fills other slots.
 */

/** Beam tops: the level heights plus the pallet base offset the world data uses (slotPosition). */
export const BEAM_LEVELS = RACK.levelHeights.map((h) => h + 0.15);

/** Rack rows: pallet centre line of each face (south and north face of every aisle). */
export function rackRows(): Array<{ aisle: string; north: boolean; y: number }> {
  const rows: Array<{ aisle: string; north: boolean; y: number }> = [];
  for (const [aisle, y] of Object.entries(RACK.aisles)) {
    rows.push({ aisle, north: false, y: y - RACK.faceOffset });
    rows.push({ aisle, north: true, y: y + RACK.faceOffset });
  }
  return rows;
}

/** Positions across a bay (pallets stand 0.8 m wide face-on, three per bay); the middle one is the slot. */
const ACROSS = [-0.93, 0, 0.93];

const STOCK_TINTS: RGB[] = [[1, 1, 1], rgb('#f1ede4'), rgb('#e4dccb'), rgb('#ded6c7'), rgb('#c9d3d9')];

export function warehouseLayout(world: WorldDef): Placement[] {
  const out: Placement[] = [];
  const rng = new Rng('warehouse-stock');
  const tagged = new Set(
    world.assets
      .filter((a) => a.slot)
      .map((a) => {
        const s = a.slot as NonNullable<typeof a.slot>;
        return `${s.aisle}|${s.bay % 2 === 0 ? 'N' : 'S'}|${Math.ceil(s.bay / 2) - 1}|${s.level}`;
      }),
  );
  for (const row of rackRows()) {
    for (let k = 0; k <= RACK.baysPerFace; k++)
      out.push({ model: 'rackFrame', x: RACK.x0 + k * RACK.bayPitch, y: row.y });
    out.push({ model: 'rackGuard', x: RACK.x0 - 0.2, y: row.y });
    for (let i = 0; i < RACK.baysPerFace; i++) {
      const x = RACK.x0 + RACK.bayPitch / 2 + i * RACK.bayPitch;
      out.push({ model: 'rackBeams', x, y: row.y });
      for (let level = 1; level <= RACK.levelHeights.length; level++) {
        const bay = row.north ? 2 * (i + 1) : 2 * i + 1;
        const base = slotPosition({ aisle: row.aisle, bay, level });
        for (const dx of ACROSS) {
          if (dx === 0 && tagged.has(`${row.aisle}|${row.north ? 'N' : 'S'}|${i}|${level}`)) continue;
          if (rng.next() > 0.72) continue;
          const model = rng.pick(['stock-low', 'stock-mid', 'stock-mid', 'stock-high']);
          out.push({
            model,
            x: base.x + dx,
            y: base.y,
            z: base.z,
            heading: 90,
            tint: rng.pick(STOCK_TINTS),
          });
        }
      }
    }
  }

  // Docks: leveler inside, shelter and bumpers outside, door open or closed as in the world data.
  DOCKS.forEach((x, i) => {
    out.push({ model: 'dockLeveler', x, y: 1.1, heading: 90 });
    out.push({ model: 'dockShelter', x, y: 0, heading: 90 });
    const door = world.doors.find((d) => d.id === `dock-door-${i + 1}`);
    out.push({ model: door?.open ? 'dockDoorOpen' : 'dockDoorClosed', x, y: 0.12, heading: 90 });
    for (const dx of [-2.2, 2.2]) out.push({ model: 'bollard', x: x + dx, y: 0.5 });
  });

  // Staging: a few untagged pallets waiting for dispatch.
  for (const [x, y] of [
    [37, 9.5],
    [39, 9.5],
    [53, 5],
    [55, 5],
    [57, 5],
  ] as Array<[number, number]>)
    out.push({
      model: rng.pick(['stock-mid', 'stock-high']),
      x,
      y,
      heading: 90,
      tint: rng.pick(STOCK_TINTS),
    });

  // Cold room: evaporator high on the north wall, strip curtain in the door.
  out.push({ model: 'coolingUnit', x: 71, y: 15.5, z: 3.9, heading: -90 });
  out.push({ model: 'stripCurtain', x: 64, y: 9.25 });

  // Battery charging cage: chargers on the north fence, batteries on the floor in front of them.
  for (const x of [23.2, 25, 26.8, 28.6]) {
    out.push({ model: 'charger', x, y: 19.6, heading: -90 });
    out.push({ model: 'battery', x, y: 18.6, heading: 0 });
  }

  // Production: a workstation at the back of each station, flow racks behind the line-side buffer.
  for (const x of [7, 15, 23]) out.push({ model: 'workstation', x, y: 38.3 });
  for (const x of [8, 15, 22]) out.push({ model: 'flowRack', x, y: 31.4 });

  // Office desks.
  for (const [x, y] of [
    [2.8, 18.2],
    [7.2, 18.2],
    [2.8, 15.6],
  ] as Array<[number, number]>)
    out.push({ model: 'officeDesk', x, y, heading: 90 });

  // Yard: the LEF-3 pole and the assembly point sign.
  const lef = world.devices.find((d) => d.model === 'ZENIX LEF-3');
  if (lef) {
    const [x, y] = [lef.position.x - 0.12, lef.position.y];
    out.push({ model: 'yardPole', x, y, z: warehouseGround(x, y) });
  }
  out.push({ model: 'musterSign', x: 71, y: -29.6, z: warehouseGround(71, -29.6), heading: -90 });
  return out;
}

/** Plan rectangles painted on the floor: forklift lanes (edge lines) and pedestrian walkways. */
export interface FloorLine {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: 'lane' | 'walk' | 'zone';
}

export function floorLines(): FloorLine[] {
  const lines: FloorLine[] = [];
  const hLine = (y: number, x0: number, x1: number, color: FloorLine['color']) =>
    lines.push({ x0, y0: y - 0.05, x1, y1: y + 0.05, color });
  const vLine = (x: number, y0: number, y1: number, color: FloorLine['color']) =>
    lines.push({ x0: x - 0.05, y0, x1: x + 0.05, y1, color });
  // Main lanes at y 18 and y 8, edged with lines 1.8 m either side of the centre.
  for (const y of [18, 8]) {
    hLine(y - 1.8, 1, 79, 'lane');
    hLine(y + 1.8, 1, 79, 'lane');
  }
  // Dock approach boxes.
  for (const x of DOCKS) {
    vLine(x - 2.6, 0.2, 5, 'zone');
    vLine(x + 2.6, 0.2, 5, 'zone');
    hLine(5, x - 2.6, x + 2.6, 'zone');
  }
  // Pedestrian walkway from the south exit.
  vLine(30.9, 0.2, 6.2, 'walk');
  vLine(32.3, 0.2, 6.2, 'walk');
  // Stations: outlined work areas.
  for (const x of [7, 15, 23]) {
    hLine(34, x - 2.5, x + 2.5, 'zone');
    hLine(39, x - 2.5, x + 2.5, 'zone');
    vLine(x - 2.5, 34, 39, 'zone');
    vLine(x + 2.5, 34, 39, 'zone');
  }
  // Line-side buffer.
  hLine(27, 3, 27, 'zone');
  hLine(30, 3, 27, 'zone');
  return lines;
}
