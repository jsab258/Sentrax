import { devices } from '../../content/devices';
import type { InfraModel, TagModel } from '../../sim/world';
import type { ModelParts } from '../kit/instancing';
import { PartBuilder, rgb } from '../kit/parts';

/**
 * True-scale Sentrax device models from the datasheet dimensions in src/content/devices.ts and the
 * product photos (docs/device-photos-sheet.jpg). Origin at the mounting face, top face up (+y); front
 * panel towards +x. No wordmark decals: at the closest camera distance a tag is about 15 px wide.
 */

const WHITE = rgb('#f2f2f0');
const OFF_WHITE = rgb('#ebeae6');
const LIGHT_GREY = rgb('#d4d6d8');
const DARK = rgb('#1d1f22');
const PORT = rgb('#4a4e53');

const mm = (v: number) => v / 1000;

function box(model: keyof typeof devices) {
  const s = devices[model].sizeMm;
  if (s.shape !== 'box') throw new Error(`${model} is not a box`);
  return { w: mm(s.w), d: mm(s.d), h: mm(s.h) };
}

function round(model: keyof typeof devices) {
  const s = devices[model].sizeMm;
  if (s.shape !== 'round') throw new Error(`${model} is not round`);
  return { r: mm(s.diameter) / 2, h: mm(s.h) };
}

/** NODIX CEN-1: tapered round puck with a softly rounded top edge. */
function cen1(): ModelParts {
  const { r, h } = round('NODIX CEN-1');
  const b = new PartBuilder();
  b.lathe(
    'gloss',
    [
      [0, 0],
      [r, 0],
      [r * 0.97, h * 0.5],
      [r * 0.9, h * 0.85],
      [r * 0.8, h * 0.97],
      [r * 0.6, h],
      [0, h],
    ],
    { color: WHITE, segments: 28 },
  );
  // Oval LED window on the side.
  b.box('gloss', [0.002, 0.004, 0.009], { at: [r * 0.97, h * 0.45, 0], color: LIGHT_GREY, radius: 0.0015 });
  return b.build();
}

/** ZENIX LEN-1 and LEN-2: square housing, port panel on the front, one rod antenna. */
function len(model: 'ZENIX LEN-1' | 'ZENIX LEN-2'): ModelParts {
  const { w, d, h } = box(model);
  const b = new PartBuilder();
  b.box('gloss', [d, h, w], { at: [0, h / 2, 0], color: OFF_WHITE, radius: 0.008 });
  b.box('painted', [0.002, h * 0.55, w * 0.8], { at: [d / 2 - 0.0008, h * 0.45, 0], color: LIGHT_GREY });
  b.box('painted', [0.0016, 0.012, 0.016], { at: [d / 2 - 0.0006, h * 0.45, -w * 0.25], color: PORT });
  b.box('painted', [0.0016, 0.01, 0.01], { at: [d / 2 - 0.0006, h * 0.45, w * 0.2], color: DARK });
  b.capsule('gloss', 0.004, 0.11, { at: [-d * 0.1, h + 0.055, 0], color: WHITE });
  if (model === 'ZENIX LEN-2') b.sphere('gloss', 0.011, { at: [0, h, 0], color: DARK, scale: [1, 0.7, 1] });
  return b.build();
}

/** ZENIX LON-2: large square locator with an internal antenna array. */
function lon2(): ModelParts {
  const { w, d, h } = box('ZENIX LON-2');
  const b = new PartBuilder();
  b.box('gloss', [d, h, w], { at: [0, h / 2, 0], color: OFF_WHITE, radius: 0.012 });
  b.box('painted', [0.002, h * 0.5, w * 0.8], { at: [d / 2 - 0.0008, h * 0.42, 0], color: LIGHT_GREY });
  b.box('painted', [0.0016, 0.012, 0.016], { at: [d / 2 - 0.0006, h * 0.42, 0.02], color: PORT });
  return b.build();
}

/**
 * PINIX TOW-1 and TOW-5: square tag with a screw flange on the left and right and a light grey disc on
 * top. The datasheet size (51 x 51 mm) includes the flanges.
 */
function tow(model: 'PINIX TOW-1' | 'PINIX TOW-5'): ModelParts {
  const { w, d, h } = box(model);
  const b = new PartBuilder();
  b.box('gloss', [d, h, w * 0.78], { at: [0, h / 2, 0], color: WHITE, radius: 0.004 });
  b.box('gloss', [d * 0.4, 0.0025, w], { at: [0, 0.00125, 0], color: WHITE, radius: 0.001 });
  b.cyl('painted', w * 0.26, 0.0006, { at: [0, h + 0.0003, 0], color: LIGHT_GREY, segments: 20 });
  return b.build();
}

/** PINIX TOK-1: rounded badge with a lanyard loop and a QR code on the front (+x). */
function tok1(): ModelParts {
  const s = devices['PINIX TOK-1'].sizeMm;
  if (s.shape !== 'box') throw new Error('TOK-1 is not a box');
  const [w, t, h] = [mm(s.w), mm(s.d), mm(s.h)];
  const b = new PartBuilder();
  b.box('gloss', [t, h, w], { at: [0, h / 2, 0], color: WHITE, radius: 0.004 });
  b.ring('gloss', 0.006, 0.0015, { at: [0, h + 0.004, 0], rot: [Math.PI / 2, 0, Math.PI / 2], color: WHITE });
  b.box('painted', [0.0004, 0.015, 0.015], { at: [t / 2 + 0.0001, h * 0.45, 0], color: DARK });
  return b.build();
}

/** PINIX TOB-1: round wearable with its wrist strap; the strap ring lies around the wrist (y axis). */
function tob1(): ModelParts {
  const { r, h } = round('PINIX TOB-1');
  const b = new PartBuilder();
  b.lathe(
    'gloss',
    [
      [0, 0],
      [r, 0],
      [r * 0.95, h * 0.7],
      [r * 0.75, h],
      [0, h],
    ],
    { color: WHITE, segments: 24, at: [0.036, 0, 0], rot: [0, 0, -Math.PI / 2] },
  );
  b.ring('painted', 0.034, 0.003, { color: WHITE, scale: [1, 3, 0.8] });
  return b.build();
}

/** ZENIX LEF-3: outdoor housing with sealed glands on the front and two side rod antennas. */
function lef3(): ModelParts {
  const { w, d, h } = box('ZENIX LEF-3');
  const b = new PartBuilder();
  b.box('gloss', [d, h, w], { at: [0, h / 2, 0], color: OFF_WHITE, radius: 0.008 });
  for (const z of [-w * 0.28, w * 0.28])
    b.cyl('painted', 0.011, 0.012, {
      at: [d / 2 + 0.006, h * 0.5, z],
      rot: [0, 0, Math.PI / 2],
      color: DARK,
    });
  for (const z of [-w / 2 - 0.008, w / 2 + 0.008])
    b.capsule('gloss', 0.007, 0.17, { at: [0, h + 0.06, z], color: WHITE });
  return b.build();
}

export type DeviceModel = InfraModel | TagModel;

export function deviceModels(): Record<DeviceModel, ModelParts> {
  return {
    'NODIX CEN-1': cen1(),
    'ZENIX LEN-1': len('ZENIX LEN-1'),
    'ZENIX LEN-2': len('ZENIX LEN-2'),
    'ZENIX LON-2': lon2(),
    'ZENIX LEF-3': lef3(),
    'PINIX TOW-1': tow('PINIX TOW-1'),
    'PINIX TOW-5': tow('PINIX TOW-5'),
    'PINIX TOK-1': tok1(),
    'PINIX TOB-1': tob1(),
  };
}

/** Largest dimension of each device in metres (for the marker handover). */
export function deviceSizeM(model: DeviceModel): number {
  const s = devices[model].sizeMm;
  return mm(s.shape === 'round' ? s.diameter : Math.max(s.w, s.d, s.h));
}
