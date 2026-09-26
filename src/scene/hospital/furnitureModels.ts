import { PartBuilder, rgb, type RGB } from '../kit/parts';
import type { ModelParts } from '../kit/instancing';

/**
 * Procedural hospital furniture at real-world size. Local +x is the front of each piece (a bed's head
 * end, a cabinet's doors, a chair's facing direction); origin on the floor at the footprint centre.
 */

const C = {
  white: rgb('#eef0f1'),
  offWhite: rgb('#e4e2dd'),
  lightGrey: rgb('#c9cdd1'),
  midGrey: rgb('#8f969d'),
  darkGrey: rgb('#3c4147'),
  charcoal: rgb('#26292d'),
  steel: rgb('#c4c9ce'),
  chrome: rgb('#e1e4e7'),
  mattress: rgb('#b9c7d1'),
  blanket: rgb('#dde6ee'),
  pillow: rgb('#f4f5f6'),
  lightWood: rgb('#d9cdbb'),
  laminate: rgb('#dcdad5'),
  seatBlue: rgb('#56707f'),
  seatDark: rgb('#3d4750'),
  mirror: rgb('#dfe4e8'),
  screen: rgb('#1a2227'),
  boxBlue: rgb('#8fa6bb'),
  boxWhite: rgb('#e9ebed'),
  boxGrey: rgb('#aeb4ba'),
  linenBag: rgb('#7f95a6'),
};

function bed(): ModelParts {
  const b = new PartBuilder();
  // Chassis on castors, lifting columns, deck.
  for (const x of [-0.82, 0.82]) for (const z of [-0.36, 0.36]) b.castor(x, z, 0.05);
  b.box('painted', [1.9, 0.08, 0.72], { at: [0, 0.16, 0], color: C.midGrey, radius: 0.02 });
  b.box('painted', [0.14, 0.22, 0.32], { at: [0.5, 0.3, 0], color: C.lightGrey, radius: 0.02 });
  b.box('painted', [0.14, 0.22, 0.32], { at: [-0.5, 0.3, 0], color: C.lightGrey, radius: 0.02 });
  b.box('painted', [2.0, 0.06, 0.9], { at: [0, 0.45, 0], color: C.white, radius: 0.02 });
  // Mattress, pillow, blanket (thick enough to cover a lying figure).
  b.box('upholstery', [1.98, 0.15, 0.88], { at: [0, 0.555, 0], color: C.mattress, radius: 0.05 });
  b.box('fabric', [0.34, 0.1, 0.62], { at: [0.78, 0.67, 0], color: C.pillow, radius: 0.045 });
  b.box('fabric', [1.4, 0.16, 0.92], { at: [-0.3, 0.7, 0], color: C.blanket, radius: 0.05 });
  b.box('fabric', [0.14, 0.13, 0.93], { at: [0.4, 0.71, 0], color: C.pillow, radius: 0.05 });
  // Head and foot boards, split side rails.
  b.box('wood', [0.05, 0.46, 0.96], { at: [1.05, 0.72, 0], color: C.lightWood, radius: 0.02 });
  b.box('wood', [0.05, 0.34, 0.96], { at: [-1.05, 0.64, 0], color: C.lightWood, radius: 0.02 });
  for (const z of [-0.47, 0.47]) {
    b.box('painted', [0.7, 0.2, 0.025], { at: [0.5, 0.79, z], color: C.white, radius: 0.01 });
    b.box('painted', [0.6, 0.18, 0.025], { at: [-0.35, 0.76, z], color: C.white, radius: 0.01 });
  }
  return b.build();
}

function bedsideCabinet(): ModelParts {
  const b = new PartBuilder();
  b.box('wood', [0.45, 0.78, 0.45], { at: [0, 0.41, 0], color: C.lightWood, radius: 0.012 });
  b.box('painted', [0.01, 0.16, 0.39], { at: [0.228, 0.66, 0], color: C.white });
  b.box('painted', [0.01, 0.4, 0.39], { at: [0.228, 0.3, 0], color: C.white });
  b.box('metal', [0.02, 0.015, 0.12], { at: [0.24, 0.7, 0], color: C.steel });
  b.box('metal', [0.02, 0.015, 0.12], { at: [0.24, 0.46, 0], color: C.steel });
  b.box('painted', [0.47, 0.02, 0.47], { at: [0, 0.81, 0], color: C.laminate, radius: 0.008 });
  for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) b.castor(x, z, 0.02);
  return b.build();
}

function overbedTable(): ModelParts {
  const b = new PartBuilder();
  b.box('painted', [0.62, 0.03, 0.08], { at: [0, 0.05, -0.16], color: C.midGrey });
  b.box('painted', [0.08, 0.03, 0.4], { at: [-0.27, 0.05, 0], color: C.midGrey });
  b.box('painted', [0.08, 0.03, 0.4], { at: [0.27, 0.05, 0], color: C.midGrey });
  for (const x of [-0.27, 0.27]) for (const z of [-0.18, 0.18]) b.castor(x, z, 0.025);
  b.box('metal', [0.05, 0.78, 0.05], { at: [0, 0.45, -0.16], color: C.steel, radius: 0.01 });
  b.box('wood', [0.8, 0.025, 0.4], { at: [0, 0.86, 0.02], color: C.lightWood, radius: 0.01 });
  return b.build();
}

function visitorChair(): ModelParts {
  const b = new PartBuilder();
  b.box('upholstery', [0.5, 0.1, 0.5], { at: [0, 0.45, 0], color: C.seatBlue, radius: 0.04 });
  b.box('upholstery', [0.1, 0.52, 0.5], {
    at: [-0.25, 0.76, 0],
    rot: [0, 0, -0.12],
    color: C.seatBlue,
    radius: 0.04,
  });
  for (const z of [-0.28, 0.28]) {
    b.box('wood', [0.52, 0.04, 0.07], { at: [0, 0.66, z], color: C.lightWood, radius: 0.015 });
    b.bar('metal', [0.2, 0, z], [0.2, 0.64, z], 0.013, { color: C.steel });
    b.bar('metal', [-0.24, 0, z], [-0.24, 0.64, z], 0.013, { color: C.steel });
  }
  return b.build();
}

function wardrobe(): ModelParts {
  const b = new PartBuilder();
  b.box('wood', [0.58, 2.0, 1.0], { at: [0, 1.0, 0], color: C.lightWood, radius: 0.01 });
  b.box('painted', [0.012, 1.9, 0.004], { at: [0.292, 1.02, 0], color: C.midGrey });
  for (const z of [-0.06, 0.06]) b.box('metal', [0.03, 0.3, 0.015], { at: [0.3, 1.1, z], color: C.steel });
  return b.build();
}

function headwall(): ModelParts {
  const b = new PartBuilder();
  b.box('painted', [0.07, 0.26, 1.6], { at: [0, 1.45, 0], color: C.white, radius: 0.015 });
  b.box('painted', [0.02, 0.26, 1.6], { at: [0.04, 1.45, 0], color: C.lightGrey });
  for (const [z, c] of [
    [-0.45, C.white],
    [-0.3, C.darkGrey],
    [0.3, C.white],
    [0.45, C.midGrey],
  ] as Array<[number, RGB]>) {
    b.cyl('gloss', 0.028, 0.04, { at: [0.07, 1.42, z], rot: [0, 0, Math.PI / 2], color: c });
  }
  b.box('gloss', [0.05, 0.05, 0.3], { at: [0.06, 1.52, 0], color: C.pillow });
  return b.build();
}

function toilet(): ModelParts {
  const b = new PartBuilder();
  b.box('gloss', [0.1, 0.8, 0.45], { at: [-0.3, 0.55, 0], color: C.white, radius: 0.02 });
  b.box('gloss', [0.52, 0.3, 0.37], { at: [-0.02, 0.36, 0], color: C.white, radius: 0.12 });
  b.box('gloss', [0.46, 0.03, 0.36], { at: [0, 0.525, 0], color: C.pillow, radius: 0.012 });
  b.box('gloss', [0.02, 0.16, 0.22], { at: [-0.25, 0.95, 0], color: C.chrome });
  b.bar('metal', [-0.34, 0.75, 0.38], [0.3, 0.75, 0.38], 0.016, { color: C.chrome });
  return b.build();
}

function sink(): ModelParts {
  const b = new PartBuilder();
  b.box('gloss', [0.42, 0.14, 0.55], { at: [0, 0.8, 0], color: C.white, radius: 0.05 });
  b.bar('metal', [-0.17, 0.87, 0], [-0.17, 1.0, 0], 0.015, { color: C.chrome });
  b.bar('metal', [-0.17, 1.0, 0], [-0.05, 1.0, 0], 0.012, { color: C.chrome });
  b.box('metal', [0.012, 0.65, 0.5], { at: [-0.2, 1.5, 0], color: C.mirror });
  return b.build();
}

function shower(): ModelParts {
  const b = new PartBuilder();
  b.box('gloss', [0.9, 0.04, 0.9], { at: [0, 0.02, 0], color: C.white, radius: 0.01 });
  b.bar('metal', [-0.44, 1.0, 0.3], [-0.44, 2.0, 0.3], 0.012, { color: C.chrome });
  b.cyl('metal', 0.07, 0.02, { at: [-0.36, 2.0, 0.3], color: C.chrome });
  b.bar('metal', [-0.44, 1.9, 0.3], [-0.36, 2.0, 0.3], 0.01, { color: C.chrome });
  return b.build();
}

/** Chrome wire shelving with storage boxes; 1.2 m wide (z), 0.5 m deep (x). */
function wireShelf(): ModelParts {
  const b = new PartBuilder();
  for (const x of [-0.23, 0.23])
    for (const z of [-0.58, 0.58]) b.bar('metal', [x, 0, z], [x, 1.9, z], 0.012, { color: C.chrome });
  const levels = [0.15, 0.55, 0.95, 1.35, 1.75];
  for (const y of levels) b.box('metal', [0.48, 0.02, 1.18], { at: [0, y, 0], color: C.steel });
  const boxes: Array<[number, number, number, RGB]> = [
    [0.15, -0.3, 0.26, C.boxBlue],
    [0.15, 0.3, 0.26, C.boxBlue],
    [0.55, -0.3, 0.22, C.boxWhite],
    [0.55, 0.28, 0.3, C.boxGrey],
    [0.95, -0.28, 0.24, C.boxWhite],
    [0.95, 0.3, 0.2, C.boxWhite],
    [1.35, 0, 0.28, C.boxGrey],
    [1.75, -0.3, 0.14, C.boxBlue],
  ];
  for (const [y, z, h, c] of boxes)
    b.box('painted', [0.4, h, 0.5], { at: [0, y + 0.01 + h / 2, z], color: c, radius: 0.015 });
  return b.build();
}

/** Base cabinets with a worktop, 1 m long along z; scaled along z per placement. */
function counter(withSink: boolean): ModelParts {
  const b = new PartBuilder();
  b.box('painted', [0.56, 0.08, 1.0], { at: [-0.02, 0.04, 0], color: C.darkGrey });
  b.box('painted', [0.58, 0.8, 1.0], { at: [0, 0.48, 0], color: C.white });
  for (const z of [-0.25, 0.25])
    b.box('painted', [0.004, 0.76, 0.004], { at: [0.292, 0.48, z], color: C.lightGrey });
  b.box('gloss', [0.62, 0.04, 1.0], { at: [0.01, 0.9, 0], color: C.laminate });
  if (withSink) {
    b.box('metal', [0.42, 0.02, 0.46], { at: [0.03, 0.915, 0], color: C.steel });
    b.bar('metal', [-0.2, 0.92, 0], [-0.2, 1.15, 0], 0.014, { color: C.chrome });
    b.bar('metal', [-0.2, 1.15, 0], [-0.05, 1.15, 0], 0.012, { color: C.chrome });
  }
  return b.build();
}

function upperCabinets(): ModelParts {
  const b = new PartBuilder();
  b.box('painted', [0.35, 0.7, 1.0], { at: [0, 1.85, 0], color: C.white });
  b.box('painted', [0.004, 0.66, 0.004], { at: [0.177, 1.85, 0], color: C.lightGrey });
  return b.build();
}

function tallCabinet(): ModelParts {
  const b = new PartBuilder();
  b.box('painted', [0.6, 2.0, 1.0], { at: [0, 1.0, 0], color: C.white, radius: 0.01 });
  b.box('painted', [0.004, 1.92, 0.004], { at: [0.302, 1.0, 0], color: C.lightGrey });
  for (const z of [-0.05, 0.05])
    b.box('metal', [0.025, 0.25, 0.015], { at: [0.31, 1.05, z], color: C.steel });
  return b.build();
}

function desk(): ModelParts {
  const b = new PartBuilder();
  b.box('wood', [0.7, 0.03, 1.4], { at: [0, 0.735, 0], color: C.lightWood, radius: 0.008 });
  for (const z of [-0.66, 0.66])
    b.box('painted', [0.6, 0.72, 0.03], { at: [0, 0.36, z], color: C.lightGrey });
  b.box('painted', [0.2, 0.012, 0.22], { at: [-0.18, 0.756, 0], color: C.charcoal });
  b.box('painted', [0.04, 0.3, 0.04], { at: [-0.2, 0.9, 0], color: C.charcoal });
  b.box('painted', [0.03, 0.36, 0.58], { at: [-0.18, 1.12, 0], color: C.charcoal, radius: 0.01 });
  b.box('screen', [0.005, 0.32, 0.54], { at: [-0.163, 1.12, 0], color: C.screen });
  b.box('painted', [0.15, 0.02, 0.44], { at: [0.12, 0.76, 0], color: C.darkGrey, radius: 0.005 });
  return b.build();
}

function officeChair(): ModelParts {
  const b = new PartBuilder();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.bar('painted', [0, 0.07, 0], [Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3], 0.018, {
      color: C.charcoal,
    });
    b.castor(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.025);
  }
  b.cyl('metal', 0.025, 0.36, { at: [0, 0.26, 0], color: C.steel });
  b.box('upholstery', [0.48, 0.08, 0.48], { at: [0, 0.48, 0], color: C.seatDark, radius: 0.03 });
  b.box('upholstery', [0.06, 0.5, 0.44], {
    at: [-0.24, 0.85, 0],
    rot: [0, 0, -0.08],
    color: C.seatDark,
    radius: 0.03,
  });
  return b.build();
}

/** Reception counter of the nurse station, 1 m long along z (scaled per placement); front faces +x. */
function stationCounter(): ModelParts {
  const b = new PartBuilder();
  b.box('wood', [0.05, 1.1, 1.0], { at: [0.38, 0.55, 0], color: C.lightWood });
  b.box('wood', [0.34, 0.035, 1.0], { at: [0.3, 1.12, 0], color: C.lightWood });
  b.box('gloss', [0.7, 0.03, 1.0], { at: [0.02, 0.74, 0], color: C.laminate });
  b.box('painted', [0.62, 0.72, 0.04], { at: [0.02, 0.36, -0.48], color: C.white });
  b.box('painted', [0.62, 0.72, 0.04], { at: [0.02, 0.36, 0.48], color: C.white });
  return b.build();
}

function stationMonitor(): ModelParts {
  const b = new PartBuilder();
  b.box('painted', [0.2, 0.012, 0.22], { at: [0, 0.006, 0], color: C.charcoal });
  b.box('painted', [0.04, 0.3, 0.04], { at: [-0.02, 0.15, 0], color: C.charcoal });
  b.box('painted', [0.03, 0.34, 0.55], { at: [0, 0.38, 0], color: C.charcoal, radius: 0.01 });
  b.box('screen', [0.005, 0.3, 0.51], { at: [0.017, 0.38, 0], color: C.screen });
  return b.build();
}

function waitingSeats(): ModelParts {
  const b = new PartBuilder();
  b.box('metal', [0.08, 0.06, 2.3], { at: [-0.05, 0.36, 0], color: C.steel });
  for (const z of [-1.0, 1.0]) {
    b.bar('metal', [-0.05, 0, z], [-0.05, 0.36, z], 0.02, { color: C.steel });
    b.box('metal', [0.5, 0.02, 0.06], { at: [-0.05, 0.01, z], color: C.steel });
  }
  for (let i = 0; i < 4; i++) {
    const z = -0.84 + i * 0.56;
    b.box('upholstery', [0.48, 0.07, 0.5], { at: [0, 0.44, z], color: C.seatBlue, radius: 0.03 });
    b.box('upholstery', [0.06, 0.44, 0.5], {
      at: [-0.23, 0.72, z],
      rot: [0, 0, -0.1],
      color: C.seatBlue,
      radius: 0.03,
    });
  }
  return b.build();
}

function linenCart(): ModelParts {
  const b = new PartBuilder();
  for (const x of [-0.26, 0.26])
    for (const z of [-0.2, 0.2]) {
      b.castor(x, z, 0.04);
      b.bar('metal', [x, 0.08, z], [x, 0.95, z], 0.012, { color: C.steel });
    }
  b.box('metal', [0.56, 0.02, 0.44], { at: [0, 0.1, 0], color: C.steel });
  b.box('fabric', [0.5, 0.62, 0.38], { at: [0, 0.6, 0], color: C.linenBag, radius: 0.04 });
  b.bar('metal', [-0.3, 0.95, -0.2], [-0.3, 0.95, 0.2], 0.012, { color: C.steel });
  return b.build();
}

function wallMonitor(): ModelParts {
  const b = new PartBuilder();
  b.box('painted', [0.04, 0.2, 0.1], { at: [0, 1.55, 0], color: C.lightGrey });
  b.bar('painted', [0.02, 1.55, 0], [0.32, 1.6, 0], 0.02, { color: C.lightGrey });
  b.box('painted', [0.05, 0.3, 0.38], { at: [0.35, 1.62, 0], color: C.darkGrey, radius: 0.015 });
  b.box('screen', [0.005, 0.26, 0.34], { at: [0.377, 1.62, 0], color: C.screen });
  return b.build();
}

export function hospitalFurnitureModels(): Record<string, ModelParts> {
  return {
    bed: bed(),
    bedsideCabinet: bedsideCabinet(),
    overbedTable: overbedTable(),
    visitorChair: visitorChair(),
    wardrobe: wardrobe(),
    headwall: headwall(),
    toilet: toilet(),
    sink: sink(),
    shower: shower(),
    wireShelf: wireShelf(),
    counter: counter(false),
    sinkCounter: counter(true),
    upperCabinets: upperCabinets(),
    tallCabinet: tallCabinet(),
    desk: desk(),
    officeChair: officeChair(),
    stationCounter: stationCounter(),
    stationMonitor: stationMonitor(),
    waitingSeats: waitingSeats(),
    linenCart: linenCart(),
    wallMonitor: wallMonitor(),
  };
}
