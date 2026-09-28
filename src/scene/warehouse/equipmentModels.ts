import type { AssetClass } from '../../sim/world';
import type { ModelParts } from '../kit/instancing';
import { PartBuilder, rgb, type RGB } from '../kit/parts';

/**
 * Tracked warehouse and production assets at real-world size (local +x forward, origin on the floor at
 * the asset position). Each class also defines where its tag sits.
 */

export const W = {
  pine: rgb('#b88a55'),
  pineDark: rgb('#8a6440'),
  carton: rgb('#b99a6b'),
  cartonLight: rgb('#cdb286'),
  wrap: rgb('#e4e6e3'),
  tape: rgb('#d9c9a5'),
  coolBox: rgb('#e9eef0'),
  coolLid: rgb('#3f6f8c'),
  cartFrame: rgb('#5b6168'),
  cartBin: rgb('#2f5d7a'),
  part: rgb('#a9afb5'),
  trailer: rgb('#e9ebec'),
  trailerRib: rgb('#cfd3d6'),
  chassis: rgb('#2a2d31'),
  tyre: rgb('#1d1f22'),
  rim: rgb('#8d9399'),
  reflector: rgb('#b84a3a'),
};

/** EUR pallet (1.2 x 0.8 x 0.144 m): three bottom boards, nine blocks, deck boards. Long side along x. */
export function palletBase(b: PartBuilder, color: RGB = W.pine): void {
  const dark = W.pineDark;
  for (const z of [-0.345, 0, 0.345]) b.box('wood', [1.2, 0.022, 0.1], { at: [0, 0.011, z], color: dark });
  for (const x of [-0.525, 0, 0.525])
    for (const z of [-0.345, 0, 0.345]) b.box('wood', [0.145, 0.078, 0.1], { at: [x, 0.061, z], color });
  for (const z of [-0.345, 0, 0.345]) b.box('wood', [1.2, 0.022, 0.145], { at: [0, 0.111, z], color: dark });
  for (const x of [-0.545, -0.27, 0, 0.27, 0.545])
    b.box('wood', [0.1, 0.022, 0.8], { at: [x, 0.133, 0], color });
}

/** Stretch-wrapped carton load on a pallet: tagged pallets and the static rack stock share it. */
function wrappedLoad(b: PartBuilder, height: number): void {
  const base = 0.144;
  b.box('painted', [1.18, height, 0.78], { at: [0, base + height / 2, 0], color: W.carton, radius: 0.02 });
  // Carton seams and the translucent wrap band read as horizontal stripes.
  const rows = Math.max(2, Math.round(height / 0.32));
  for (let i = 1; i < rows; i++) {
    const y = base + (height * i) / rows;
    b.box('painted', [1.19, 0.012, 0.79], { at: [0, y, 0], color: W.cartonLight });
  }
  b.box('gloss', [1.2, height * 0.55, 0.8], {
    at: [0, base + height * 0.42, 0],
    color: W.wrap,
    rough: 0.25,
  });
}

function pallet(): ModelParts {
  const b = new PartBuilder();
  palletBase(b);
  wrappedLoad(b, 1.05);
  return b.build();
}

/** Insulated pallet box for chilled goods, with a blue lid. */
function coldPallet(): ModelParts {
  const b = new PartBuilder();
  palletBase(b);
  b.box('gloss', [1.16, 0.9, 0.76], { at: [0, 0.144 + 0.45, 0], color: W.coolBox, radius: 0.04 });
  b.box('gloss', [1.2, 0.08, 0.8], { at: [0, 0.144 + 0.94, 0], color: W.coolLid, radius: 0.03 });
  for (const x of [-0.3, 0.3])
    b.box('painted', [0.012, 0.5, 0.77], { at: [x, 0.144 + 0.42, 0], color: W.trailerRib });
  return b.build();
}

/** Work-in-progress carrier: a steel trolley with bins of parts, pushed between stations. */
function wipCarrier(): ModelParts {
  const b = new PartBuilder();
  for (const x of [-0.42, 0.42]) for (const z of [-0.26, 0.26]) b.castor(x, z, 0.06);
  for (const y of [0.18, 0.62]) b.box('metal', [1.0, 0.03, 0.62], { at: [0, y, 0], color: W.cartFrame });
  for (const x of [-0.48, 0.48])
    for (const z of [-0.29, 0.29]) b.bar('metal', [x, 0.1, z], [x, 0.95, z], 0.014, { color: W.cartFrame });
  // Push handle at the back.
  b.bar('metal', [-0.5, 0.95, -0.29], [-0.5, 0.95, 0.29], 0.016, { color: W.cartFrame });
  for (const [x, y] of [
    [-0.24, 0.26],
    [0.24, 0.26],
    [-0.24, 0.7],
    [0.24, 0.7],
  ] as Array<[number, number]>) {
    b.box('painted', [0.44, 0.16, 0.54], { at: [x, y + 0.08, 0], color: W.cartBin, radius: 0.015 });
    b.box('metal', [0.3, 0.05, 0.36], { at: [x, y + 0.17, 0], color: W.part });
  }
  return b.build();
}

/**
 * Box semi-trailer, 13.6 m long. The asset position is the nose (where its tag sits, outside the metal
 * box); the body runs along +x from the nose towards the doors at the rear.
 */
function trailer(): ModelParts {
  const b = new PartBuilder();
  const L = 13.6;
  const Wd = 2.55;
  const floor = 1.2;
  const H = 2.8;
  b.box('painted', [L, H, Wd], { at: [L / 2, floor + H / 2, 0], color: W.trailer, radius: 0.03 });
  // Side ribs and the rear frame.
  for (let x = 0.6; x < L; x += 1.2)
    for (const z of [-Wd / 2 - 0.005, Wd / 2 + 0.005])
      b.box('painted', [0.05, H - 0.1, 0.012], { at: [x, floor + H / 2, z], color: W.trailerRib });
  b.box('metal', [0.08, H + 0.04, Wd + 0.04], { at: [L + 0.02, floor + H / 2, 0], color: W.rim });
  // Chassis, landing legs near the nose, axles and wheels at the rear.
  b.box('metal', [L - 0.4, 0.28, 1.1], { at: [L / 2 + 0.2, floor - 0.14, 0], color: W.chassis });
  for (const z of [-0.5, 0.5]) b.box('metal', [0.12, 0.95, 0.12], { at: [2.2, 0.5, z], color: W.chassis });
  for (const x of [L - 3.8, L - 2.5, L - 1.2]) {
    for (const z of [-1.0, 1.0]) {
      b.cyl('rubber', 0.5, 0.5, { at: [x, 0.5, z], rot: [Math.PI / 2, 0, 0], color: W.tyre, segments: 18 });
      b.cyl('metal', 0.28, 0.52, { at: [x, 0.5, z], rot: [Math.PI / 2, 0, 0], color: W.rim, segments: 14 });
    }
  }
  // Rear under-run guard and reflectors.
  b.box('metal', [0.1, 0.12, Wd - 0.2], { at: [L - 0.1, 0.55, 0], color: W.chassis });
  for (const z of [-1.1, 1.1])
    b.box('gloss', [0.02, 0.1, 0.2], { at: [L + 0.07, 0.95, z], color: W.reflector });
  return b.build();
}

export function warehouseEquipmentModels(): Partial<Record<AssetClass, ModelParts>> {
  return {
    pallet: pallet(),
    cold_pallet: coldPallet(),
    wip_carrier: wipCarrier(),
    trailer: trailer(),
  };
}

/** Static rack stock: the same load in a few heights (instanced, untagged). */
export function stockModels(): Record<string, ModelParts> {
  const out: Record<string, ModelParts> = {};
  for (const [name, h] of [
    ['stock-low', 0.7],
    ['stock-mid', 1.05],
    ['stock-high', 1.35],
  ] as Array<[string, number]>) {
    const b = new PartBuilder();
    palletBase(b);
    wrappedLoad(b, h);
    out[name] = b.build();
  }
  return out;
}

/** Where the tag sits on each class: local offset and rotation (top face pointing outwards). */
export const warehouseTagMounts: Partial<
  Record<AssetClass, { at: [number, number, number]; rot: [number, number, number] }>
> = {
  pallet: { at: [0.605, 0.75, 0], rot: [0, 0, -Math.PI / 2] },
  cold_pallet: { at: [0.585, 0.75, 0], rot: [0, 0, -Math.PI / 2] },
  wip_carrier: { at: [0.505, 0.8, 0], rot: [0, 0, -Math.PI / 2] },
  // On the nose, outside the metal box (a tag inside would not be heard).
  trailer: { at: [-0.01, 3.0, 0], rot: [0, 0, Math.PI / 2] },
};
