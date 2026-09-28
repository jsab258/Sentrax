import type { ModelParts } from '../kit/instancing';
import { PartBuilder, rgb, type RGB } from '../kit/parts';

/**
 * Static warehouse and production pieces (local +x forward, origin on the floor). Placed and instanced by
 * layout.ts; nothing here moves.
 */

export const S = {
  upright: rgb('#3f5f7d'),
  // Rack beams are traditionally orange; a muted, darker orange stays clear of the amber warning colour.
  beam: rgb('#b0602f'),
  bracing: rgb('#56718b'),
  deck: rgb('#8f969c'),
  carton: rgb('#b99a6b'),
  cartonDark: rgb('#9f8157'),
  wrap: rgb('#e0e3e0'),
  palletWood: rgb('#a57d4f'),
  steel: rgb('#9aa1a8'),
  darkSteel: rgb('#3b3f44'),
  rubber: rgb('#1c1e21'),
  shelter: rgb('#23262a'),
  doorPanel: rgb('#c5ccd2'),
  doorRib: rgb('#aab2ba'),
  benchTop: rgb('#c9b28a'),
  benchFrame: rgb('#4f6c86'),
  toolBoard: rgb('#6f8193'),
  bin: rgb('#2f5d7a'),
  charger: rgb('#e6e7e5'),
  chargerFace: rgb('#2e3237'),
  battery: rgb('#35393e'),
  batteryCap: rgb('#c9a227'),
  cooling: rgb('#edf0f1'),
  grille: rgb('#8e969d'),
  curtain: rgb('#b9cfd8'),
  sign: rgb('#2f7a4a'),
  signText: rgb('#f2f4f2'),
  pole: rgb('#9ba2a8'),
  bollard: rgb('#c9a227'),
  lamp: rgb('#f3f1ea'),
  screen: rgb('#1b2227'),
  chair: rgb('#2f3338'),
  desk: rgb('#d9d4ca'),
};

/** Rack geometry shared with the layout (pallet centre offset from the row centre line, level beams). */
export const RACK_ROW = {
  /** Depth of a rack row (upright frame depth, along y). */
  depth: 1.1,
  /** Height of the upright frames. */
  height: 9.0,
  beamH: 0.12,
};

/** One upright frame: two posts, horizontal and diagonal bracing, base plates. Depth along local z. */
function rackFrame(): ModelParts {
  const b = new PartBuilder();
  const d = RACK_ROW.depth / 2;
  const H = RACK_ROW.height;
  for (const z of [-d, d]) {
    b.box('metal', [0.1, H, 0.07], { at: [0, H / 2, z], color: S.upright, rough: 0.45 });
    b.box('metal', [0.16, 0.01, 0.14], { at: [0, 0.005, z], color: S.darkSteel });
  }
  for (let y = 0.3; y < H; y += 1.5) {
    b.bar('metal', [0, y, -d], [0, y, d], 0.02, { color: S.bracing });
    if (y + 1.5 < H) b.bar('metal', [0, y, -d], [0, y + 1.5, d], 0.018, { color: S.bracing });
  }
  return b.build();
}

/** Beams of one bay: a front and a back beam at each level above the floor; bay width along local x. */
function rackBeams(width: number, levels: readonly number[]): ModelParts {
  const b = new PartBuilder();
  const d = RACK_ROW.depth / 2 - 0.02;
  for (const top of levels) {
    for (const z of [-d, d]) {
      b.box('metal', [width - 0.1, RACK_ROW.beamH, 0.05], {
        at: [0, top - RACK_ROW.beamH / 2, z],
        color: S.beam,
        rough: 0.5,
      });
    }
    // Pallet support bars across the depth.
    for (const x of [-width / 3, 0, width / 3])
      b.box('metal', [0.04, 0.03, RACK_ROW.depth], { at: [x, top - 0.015, 0], color: S.deck });
  }
  return b.build();
}

/**
 * Untagged stock on a pallet, simplified for instancing in the hundreds: pallet block, carton load with
 * seam stripes and a wrap band. Long side along x.
 */
function stock(height: number): ModelParts {
  const b = new PartBuilder();
  b.box('wood', [1.2, 0.144, 0.8], { at: [0, 0.072, 0], color: S.palletWood });
  b.box('painted', [1.18, height, 0.78], { at: [0, 0.144 + height / 2, 0], color: S.carton });
  b.box('painted', [1.19, 0.014, 0.79], { at: [0, 0.144 + height * 0.5, 0], color: S.cartonDark });
  b.box('gloss', [1.2, height * 0.5, 0.8], { at: [0, 0.144 + height * 0.4, 0], color: S.wrap, rough: 0.25 });
  return b.build();
}

/** Dock leveler plate with its lip, and two rubber bumpers either side of the opening. */
function dockLeveler(): ModelParts {
  const b = new PartBuilder();
  b.box('metal', [2.0, 0.04, 2.8], { at: [0, 0.02, 0], color: S.steel, rough: 0.6 });
  b.box('metal', [0.4, 0.03, 2.8], { at: [-1.15, 0.015, 0], color: S.darkSteel });
  return b.build();
}

/**
 * Dock shelter outside the wall (local -x): black foam side pads and head pad around the 3.5 m opening,
 * and two rubber bumpers just below the dock edge. Origin at the hall floor on the wall face.
 */
function dockShelter(): ModelParts {
  const b = new PartBuilder();
  const w = 3.5;
  for (const z of [-w / 2 - 0.3, w / 2 + 0.3])
    b.box('fabric', [0.5, 3.8, 0.6], { at: [-0.25, 1.6, z], color: S.shelter });
  b.box('fabric', [0.5, 0.8, w + 1.2], { at: [-0.25, 3.6, 0], color: S.shelter });
  for (const z of [-1.1, 1.1]) b.box('rubber', [0.14, 0.3, 0.4], { at: [-0.07, -0.2, z], color: S.rubber });
  return b.build();
}

/** Sectional dock door, closed: horizontal panels filling the 3.5 x 3.2 m opening. Width along z. */
function dockDoorClosed(): ModelParts {
  const b = new PartBuilder();
  const w = 3.5;
  const h = 3.2;
  b.box('painted', [0.05, h, w], { at: [0, h / 2, 0], color: S.doorPanel });
  for (let y = 0.53; y < h; y += 0.53) b.box('painted', [0.06, 0.03, w], { at: [0, y, 0], color: S.doorRib });
  b.box('screen', [0.06, 0.3, 1.6], { at: [0, 2.0, 0], color: rgb('#8fa4b0') });
  return b.build();
}

/** Sectional dock door, open: panels rolled up under the ceiling track, just inside the opening. */
function dockDoorOpen(): ModelParts {
  const b = new PartBuilder();
  const w = 3.5;
  b.box('painted', [3.2, 0.05, w], { at: [1.7, 3.35, 0], color: S.doorPanel });
  for (const z of [-w / 2, w / 2])
    b.box('metal', [3.4, 0.06, 0.06], { at: [1.7, 3.4, z], color: S.darkSteel });
  return b.build();
}

/** Assembly workstation: bench, frame, tool board with bins, a monitor on an arm, a fixture. */
function workstation(): ModelParts {
  const b = new PartBuilder();
  for (const x of [-0.85, 0.85])
    for (const z of [-0.35, 0.35])
      b.box('metal', [0.05, 0.9, 0.05], { at: [x, 0.45, z], color: S.benchFrame });
  b.box('wood', [1.9, 0.05, 0.85], { at: [0, 0.92, 0], color: S.benchTop });
  b.box('metal', [1.8, 0.04, 0.7], { at: [0, 0.2, 0], color: S.benchFrame });
  // Tool board at the back with parts bins.
  for (const x of [-0.85, 0.85])
    b.box('metal', [0.05, 1.2, 0.05], { at: [x, 1.55, -0.4], color: S.benchFrame });
  b.box('painted', [1.8, 0.9, 0.03], { at: [0, 1.5, -0.4], color: S.toolBoard });
  for (let i = 0; i < 6; i++)
    b.box('painted', [0.22, 0.12, 0.16], { at: [-0.7 + i * 0.28, 1.12, -0.32], color: S.bin, radius: 0.01 });
  b.box('screen', [0.5, 0.32, 0.03], { at: [0.55, 1.45, -0.3], color: S.screen });
  // Fixture on the bench.
  b.box('metal', [0.5, 0.12, 0.35], { at: [-0.3, 1.0, 0.05], color: S.darkSteel });
  b.box('metal', [0.12, 0.3, 0.12], { at: [-0.3, 1.2, 0.05], color: S.steel });
  return b.build();
}

/** Line-side flow rack: sloped roller shelves with small load carriers. */
function flowRack(): ModelParts {
  const b = new PartBuilder();
  for (const x of [-1.2, 1.2])
    for (const z of [-0.45, 0.45])
      b.box('metal', [0.05, 1.9, 0.05], { at: [x, 0.95, z], color: S.benchFrame });
  for (const [y, tilt] of [
    [0.45, 0.08],
    [1.0, 0.08],
    [1.55, 0.08],
  ] as Array<[number, number]>) {
    b.box('metal', [2.4, 0.03, 0.9], { at: [0, y, 0], rot: [tilt, 0, 0], color: S.steel });
    for (let i = 0; i < 6; i++)
      b.box('painted', [0.34, 0.16, 0.5], {
        at: [-1.0 + i * 0.4, y + 0.1, 0],
        rot: [tilt, 0, 0],
        color: S.bin,
      });
  }
  return b.build();
}

/** Wall-mounted battery charger with a cable to the floor. */
function charger(): ModelParts {
  const b = new PartBuilder();
  b.box('painted', [0.3, 0.7, 0.55], { at: [0, 1.4, 0], color: S.charger, radius: 0.02 });
  b.box('screen', [0.01, 0.14, 0.2], { at: [0.155, 1.6, 0], color: S.chargerFace });
  b.bar('rubber', [0.1, 1.05, 0.1], [0.3, 0.05, 0.2], 0.015, { color: S.rubber });
  return b.build();
}

/** Forklift traction battery on the floor. */
function battery(): ModelParts {
  const b = new PartBuilder();
  b.box('painted', [1.0, 0.75, 0.6], { at: [0, 0.375, 0], color: S.battery, radius: 0.02 });
  for (let i = 0; i < 8; i++)
    b.cyl('painted', 0.03, 0.03, {
      at: [-0.4 + (i % 4) * 0.27, 0.765, i < 4 ? -0.15 : 0.15],
      color: S.batteryCap,
    });
  return b.build();
}

/** Evaporator unit high on the cold room wall. */
function coolingUnit(): ModelParts {
  const b = new PartBuilder();
  b.box('painted', [0.6, 0.6, 2.2], { at: [0, 0, 0], color: S.cooling, radius: 0.03 });
  for (const z of [-0.6, 0, 0.6])
    b.cyl('painted', 0.22, 0.02, { at: [0.31, 0, z], rot: [0, 0, Math.PI / 2], color: S.grille });
  return b.build();
}

/** PVC strip curtain in a door opening (2.5 m wide). Width along z. */
function stripCurtain(): ModelParts {
  const b = new PartBuilder();
  for (let i = 0; i < 12; i++)
    b.box('gloss', [0.004, 2.7, 0.2], { at: [0, 1.4, -1.1 + i * 0.2], color: S.curtain, rough: 0.2 });
  return b.build();
}

/** Assembly point sign on a post (green, with a white pictogram panel). */
function musterSign(): ModelParts {
  const b = new PartBuilder();
  b.cyl('metal', 0.04, 2.6, { at: [0, 1.3, 0], color: S.pole });
  b.box('painted', [0.03, 0.7, 0.7], { at: [0.05, 2.35, 0], color: S.sign });
  b.box('painted', [0.034, 0.34, 0.34], { at: [0.05, 2.4, 0], color: S.signText });
  for (const [dy, dz] of [
    [0.1, -0.08],
    [0.1, 0.08],
    [-0.08, 0],
  ] as Array<[number, number]>)
    b.box('painted', [0.036, 0.1, 0.07], { at: [0.05, 2.4 + dy, dz], color: S.sign });
  return b.build();
}

/** Light pole in the yard, carrying the ZENIX LEF-3 at the mounting height from the world data. */
function yardPole(height: number): ModelParts {
  const b = new PartBuilder();
  b.cyl('metal', 0.09, height, { at: [0, height / 2, 0], color: S.pole, radiusTop: 0.06 });
  b.box('metal', [0.9, 0.06, 0.06], { at: [0.4, height + 0.4, 0], color: S.pole });
  b.box('gloss', [0.5, 0.1, 0.25], { at: [0.8, height + 0.35, 0], color: S.lamp });
  b.cyl('painted', 0.35, 0.3, { at: [0, 0.15, 0], color: S.steel });
  return b.build();
}

/** Yellow steel bollard (column and rack end protection). */
function bollard(): ModelParts {
  const b = new PartBuilder();
  b.cyl('gloss', 0.08, 1.1, { at: [0, 0.55, 0], color: S.bollard });
  b.cyl('painted', 0.081, 0.08, { at: [0, 0.85, 0], color: S.shelter });
  return b.build();
}

/** Rack end protector: a low L-shaped steel guard at the aisle end of a rack row. */
function rackGuard(): ModelParts {
  const b = new PartBuilder();
  b.box('gloss', [0.1, 0.4, RACK_ROW.depth + 0.2], { at: [0, 0.2, 0], color: S.bollard });
  b.box('painted', [0.105, 0.06, RACK_ROW.depth + 0.21], { at: [0, 0.3, 0], color: S.shelter });
  return b.build();
}

/** Simple office desk with a monitor and a task chair. */
function officeDesk(): ModelParts {
  const b = new PartBuilder();
  b.box('wood', [1.6, 0.03, 0.8], { at: [0, 0.74, 0], color: S.desk });
  for (const x of [-0.75, 0.75]) b.box('metal', [0.05, 0.72, 0.7], { at: [x, 0.36, 0], color: S.darkSteel });
  b.box('screen', [0.03, 0.34, 0.56], { at: [-0.25, 1.0, 0], color: S.screen });
  b.box('metal', [0.1, 0.2, 0.1], { at: [-0.27, 0.84, 0], color: S.darkSteel });
  b.box('upholstery', [0.48, 0.08, 0.48], { at: [0.6, 0.48, 0], color: S.chair, radius: 0.03 });
  b.box('upholstery', [0.06, 0.55, 0.46], { at: [0.85, 0.8, 0], color: S.chair, radius: 0.03 });
  b.cyl('metal', 0.03, 0.4, { at: [0.6, 0.24, 0], color: S.darkSteel });
  return b.build();
}

/** High-bay light fixture (seen from above as a pale disc under the open roof). */
function highBay(): ModelParts {
  const b = new PartBuilder();
  b.cyl('gloss', 0.28, 0.12, { at: [0, 0, 0], color: S.lamp, segments: 16 });
  b.cyl('metal', 0.01, 0.8, { at: [0, 0.46, 0], color: S.darkSteel });
  return b.build();
}

export function warehouseStaticModels(
  bayWidth: number,
  beamLevels: readonly number[],
): Record<string, ModelParts> {
  return {
    rackFrame: rackFrame(),
    rackBeams: rackBeams(bayWidth, beamLevels),
    'stock-low': stock(0.7),
    'stock-mid': stock(1.05),
    'stock-high': stock(1.35),
    dockLeveler: dockLeveler(),
    dockShelter: dockShelter(),
    dockDoorClosed: dockDoorClosed(),
    dockDoorOpen: dockDoorOpen(),
    workstation: workstation(),
    flowRack: flowRack(),
    charger: charger(),
    battery: battery(),
    coolingUnit: coolingUnit(),
    stripCurtain: stripCurtain(),
    musterSign: musterSign(),
    yardPole: yardPole(6),
    bollard: bollard(),
    rackGuard: rackGuard(),
    officeDesk: officeDesk(),
    highBay: highBay(),
  };
}

export type StockTint = RGB;
