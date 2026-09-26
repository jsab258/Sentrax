import type { WorldDef } from '../../sim/world';
import { wallAttachment } from '../buildingGeometry';
import type { Placement } from '../kit/instancing';

/**
 * Where the static furniture stands, in plan coordinates (see src/sim/scenes/hospital.ts for the room
 * grid). Beds follow the patient figures in the world data. Headings point from the wall into the room.
 */

const ROOM_W = 34 / 6;

/** Pieces hung on a wall: they fold away when their wall is cut. */
const WALL_MOUNTED = new Set(['headwall', 'wallMonitor', 'sink', 'shower', 'upperCabinets']);

export function hospitalFurniture(world: WorldDef): Placement[] {
  const p: Placement[] = [];
  const put = (model: string, x: number, y: number, heading = 0, extra: Partial<Placement> = {}) => {
    const wall = WALL_MOUNTED.has(model) ? wallAttachment(world, x, y, heading) : undefined;
    p.push({ model, x, y, heading, ...extra, ...(wall ? { wall } : {}) });
  };

  // Beds under every patient figure (6 patient rooms and 2 ICU bays).
  for (const f of world.figures) put('bed', f.position.x, f.position.y, f.headingDeg);

  // Patient rooms 101 to 106.
  for (let i = 0; i < 6; i++) {
    const x0 = i * ROOM_W;
    put('headwall', x0 + 3.2, 19.86, 270);
    put('bedsideCabinet', x0 + 2.2, 19.55, 270);
    put('overbedTable', x0 + 4.05, 17.55, 180);
    put('visitorChair', x0 + 1.0, 17.1, 0);
    put('wardrobe', x0 + 0.42, 14.7, 0);
    // Bathroom pod.
    put('toilet', x0 + 5.0, 15.12, 270);
    put('sink', x0 + 5.35, 14.45, 180);
    put('shower', x0 + 5.1, 13.55, 180);
  }

  // ICU: headwalls and monitors behind both beds, charting desk, supply cabinet.
  put('headwall', 2.8, 0.14, 90);
  put('headwall', 8.0, 0.14, 90);
  put('wallMonitor', 3.95, 0.1, 90);
  put('wallMonitor', 9.15, 0.1, 90);
  put('desk', 10.55, 7.8, 180);
  put('officeChair', 9.95, 7.8, 0);
  put('tallCabinet', 0.4, 7.6, 0);

  // Equipment storage: wire shelving on both long walls (wheelchairs park in the free corner).
  for (const y of [2.0, 3.3, 4.6]) put('wireShelf', 11.37, y, 0);
  for (const y of [6.0, 7.3, 8.6]) put('wireShelf', 17.13, y, 180);

  // Dirty utility: sluice counter and linen carts.
  put('sinkCounter', 17.9, 6.3, 0);
  put('counter', 17.9, 5.1, 0, { scale: [1, 1, 1.4] });
  put('linenCart', 20.9, 1.0, 180);
  put('linenCart', 20.9, 1.85, 180);

  // Medication room: counter with wall cabinets, tall cabinets opposite (the fridge is a tracked asset).
  put('counter', 21.9, 5.6, 0, { scale: [1, 1, 4] });
  put('upperCabinets', 21.78, 5.6, 0, { scale: [1, 1, 4] });
  put('tallCabinet', 26.1, 5.5, 180);
  put('tallCabinet', 26.1, 6.55, 180);

  // Nurse station: reception counter facing the corridor (gap for the walkway), desks behind.
  put('stationCounter', 28.1, 8.4, 90, { scale: [1, 1, 2.2] });
  put('stationCounter', 32.1, 8.4, 90, { scale: [1, 1, 2.4] });
  put('stationMonitor', 27.6, 8.45, 270, { z: 0.755 });
  put('stationMonitor', 32.5, 8.45, 270, { z: 0.755 });
  put('officeChair', 27.8, 7.5, 90);
  put('officeChair', 32.2, 7.5, 90);
  put('desk', 28.5, 4.35, 90);
  put('desk', 31.5, 4.35, 90);
  put('officeChair', 28.5, 5.05, 270);
  put('officeChair', 31.5, 5.05, 270);
  put('tallCabinet', 33.6, 2.0, 180);
  put('tallCabinet', 33.6, 3.05, 180);

  // Elevator lobby: beam seating on the north and south walls.
  put('waitingSeats', 36.8, 16.6, 270);
  put('waitingSeats', 36.8, 4.4, 90);

  return p;
}
