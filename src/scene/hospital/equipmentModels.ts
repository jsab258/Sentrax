import type { AssetClass } from '../../sim/world';
import type { ModelParts } from '../kit/instancing';
import { PartBuilder, rgb } from '../kit/parts';

/**
 * Tracked hospital equipment at real-world size (local +x forward, origin on the floor). Each class also
 * defines where its tag sits, matching the tag mount heights in the world data.
 */

const C = {
  white: rgb('#eef0f1'),
  lightGrey: rgb('#c9cdd1'),
  midGrey: rgb('#8f969d'),
  darkGrey: rgb('#3c4147'),
  charcoal: rgb('#26292d'),
  steel: rgb('#c4c9ce'),
  chrome: rgb('#e1e4e7'),
  screen: rgb('#1a2227'),
  bag: rgb('#e6eef2'),
  hose: rgb('#9fc0d2'),
  seat: rgb('#2f3338'),
  // Crash carts are traditionally red; a muted red keeps it apart from the red of critical alerts.
  cart: rgb('#8e3a3a'),
  defib: rgb('#d9d3c4'),
};

function starBase(b: PartBuilder, radius: number, legs = 5) {
  for (let i = 0; i < legs; i++) {
    const a = (i / legs) * Math.PI * 2 + 0.3;
    b.bar('painted', [0, 0.09, 0], [Math.cos(a) * radius, 0.07, Math.sin(a) * radius], 0.014, {
      color: C.midGrey,
    });
    b.castor(Math.cos(a) * radius, Math.sin(a) * radius, 0.03);
  }
}

/** Infusion pump on an IV pole. */
function infusionPump(): ModelParts {
  const b = new PartBuilder();
  starBase(b, 0.28);
  b.cyl('metal', 0.013, 1.95, { at: [0, 1.05, 0], color: C.chrome, segments: 10 });
  for (const a of [0, Math.PI])
    b.bar('metal', [0, 2.0, 0], [Math.cos(a) * 0.12, 2.04, Math.sin(a) * 0.12], 0.006, { color: C.chrome });
  b.box('gloss', [0.03, 0.2, 0.1], { at: [0.12, 1.86, 0], color: C.bag, radius: 0.012 });
  b.bar('painted', [0.12, 1.76, 0], [0.1, 1.2, 0.02], 0.003, { color: C.bag });
  b.box('gloss', [0.14, 0.22, 0.2], { at: [0.08, 1.1, 0], color: C.white, radius: 0.02 });
  b.box('screen', [0.004, 0.08, 0.12], { at: [0.152, 1.15, 0], color: C.screen });
  b.box('painted', [0.004, 0.05, 0.12], { at: [0.152, 1.04, 0], color: C.lightGrey });
  return b.build();
}

function ventilator(): ModelParts {
  const b = new PartBuilder();
  for (const x of [-0.22, 0.22]) for (const z of [-0.2, 0.2]) b.castor(x, z, 0.04);
  b.box('painted', [0.55, 0.08, 0.48], { at: [0, 0.12, 0], color: C.midGrey, radius: 0.02 });
  b.box('painted', [0.1, 0.62, 0.12], { at: [-0.1, 0.47, 0], color: C.lightGrey, radius: 0.02 });
  b.box('gloss', [0.36, 0.32, 0.42], { at: [0, 0.94, 0], color: C.white, radius: 0.04 });
  b.box('painted', [0.05, 0.3, 0.38], {
    at: [0.08, 1.3, 0],
    rot: [0, 0, -0.25],
    color: C.darkGrey,
    radius: 0.015,
  });
  b.box('screen', [0.005, 0.26, 0.34], { at: [0.108, 1.305, 0], rot: [0, 0, -0.25], color: C.screen });
  b.bar('metal', [-0.2, 1.12, -0.2], [-0.2, 1.12, 0.2], 0.012, { color: C.chrome });
  b.bar('rubber', [0.18, 0.95, 0.12], [0.34, 0.72, 0.3], 0.012, { color: C.hose });
  b.bar('rubber', [0.18, 0.95, -0.12], [0.34, 0.72, -0.3], 0.012, { color: C.hose });
  return b.build();
}

function wheelchair(): ModelParts {
  const b = new PartBuilder();
  for (const z of [-0.26, 0.26]) {
    b.cyl('rubber', 0.3, 0.03, {
      at: [-0.1, 0.3, z],
      rot: [Math.PI / 2, 0, 0],
      color: C.charcoal,
      segments: 24,
    });
    b.ring('metal', 0.27, 0.008, { at: [-0.1, 0.3, z * 1.12], rot: [Math.PI / 2, 0, 0], color: C.chrome });
    b.castor(0.28, z * 0.8, 0.07);
    b.bar('metal', [0.28, 0.12, z * 0.8], [0.22, 0.5, z * 0.85], 0.01, { color: C.steel });
    b.bar('metal', [-0.24, 0.5, z * 0.85], [0.22, 0.5, z * 0.85], 0.012, { color: C.steel });
    b.bar('metal', [-0.24, 0.5, z * 0.85], [-0.28, 0.98, z * 0.85], 0.012, { color: C.steel });
    b.bar('rubber', [-0.28, 0.98, z * 0.85], [-0.4, 0.98, z * 0.85], 0.016, { color: C.charcoal });
    b.bar('metal', [0.22, 0.5, z * 0.7], [0.36, 0.1, z * 0.5], 0.01, { color: C.steel });
    b.box('painted', [0.12, 0.012, 0.14], { at: [0.38, 0.1, z * 0.45], color: C.charcoal });
  }
  b.box('upholstery', [0.44, 0.05, 0.44], { at: [0, 0.52, 0], color: C.seat, radius: 0.015 });
  b.box('upholstery', [0.04, 0.4, 0.44], {
    at: [-0.25, 0.76, 0],
    rot: [0, 0, -0.08],
    color: C.seat,
    radius: 0.015,
  });
  return b.build();
}

function crashCart(): ModelParts {
  const b = new PartBuilder();
  for (const x of [-0.22, 0.22]) for (const z of [-0.3, 0.3]) b.castor(x, z, 0.05);
  b.box('painted', [0.55, 0.88, 0.75], { at: [0, 0.54, 0], color: C.cart, radius: 0.02 });
  for (const y of [0.3, 0.5, 0.66, 0.8])
    b.box('painted', [0.005, 0.01, 0.7], { at: [0.277, y, 0], color: C.darkGrey });
  b.box('painted', [0.6, 0.03, 0.8], { at: [0, 1.0, 0], color: C.lightGrey, radius: 0.01 });
  b.box('gloss', [0.3, 0.13, 0.26], { at: [-0.05, 1.08, 0.12], color: C.defib, radius: 0.02 });
  b.bar('metal', [-0.3, 0.95, -0.3], [-0.3, 0.95, 0.3], 0.012, { color: C.chrome });
  return b.build();
}

function mobileMonitor(): ModelParts {
  const b = new PartBuilder();
  starBase(b, 0.26);
  b.cyl('metal', 0.018, 1.05, { at: [0, 0.6, 0], color: C.chrome });
  b.box('painted', [0.12, 0.08, 0.26], { at: [0.02, 0.95, 0], color: C.lightGrey, radius: 0.01 });
  b.box('gloss', [0.1, 0.28, 0.34], { at: [0.02, 1.24, 0], color: C.white, radius: 0.02 });
  b.box('screen', [0.005, 0.22, 0.28], { at: [0.073, 1.25, 0], color: C.screen });
  return b.build();
}

function fridge(): ModelParts {
  const b = new PartBuilder();
  b.box('painted', [0.6, 1.85, 0.6], { at: [0, 0.925, 0], color: C.white, radius: 0.015 });
  b.box('metal', [0.02, 1.7, 0.54], { at: [0.3, 0.97, 0], color: C.steel });
  b.box('screen', [0.006, 1.5, 0.44], { at: [0.312, 0.96, 0], color: rgb('#5d6f78') });
  b.bar('metal', [0.33, 0.8, 0.22], [0.33, 1.3, 0.22], 0.01, { color: C.chrome });
  b.box('painted', [0.004, 0.04, 0.1], { at: [0.312, 1.78, 0], color: C.charcoal });
  return b.build();
}

export function hospitalEquipmentModels(): Partial<Record<AssetClass, ModelParts>> {
  return {
    infusion_pump: infusionPump(),
    ventilator: ventilator(),
    wheelchair: wheelchair(),
    crash_cart: crashCart(),
    mobile_monitor: mobileMonitor(),
    fridge: fridge(),
  };
}

/** Where the tag sits on each class: local offset and rotation (top face pointing outwards). */
export const tagMounts: Partial<
  Record<AssetClass, { at: [number, number, number]; rot: [number, number, number] }>
> = {
  infusion_pump: { at: [0.08, 1.0, 0.1], rot: [Math.PI / 2, 0, 0] },
  ventilator: { at: [0, 1.0, 0.21], rot: [Math.PI / 2, 0, 0] },
  wheelchair: { at: [-0.27, 0.86, 0], rot: [0, 0, Math.PI / 2] },
  crash_cart: { at: [0, 0.9, 0.376], rot: [Math.PI / 2, 0, 0] },
  mobile_monitor: { at: [0.02, 1.15, 0.17], rot: [Math.PI / 2, 0, 0] },
  fridge: { at: [0, 1.7, 0.3], rot: [Math.PI / 2, 0, 0] },
};
