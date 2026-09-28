import type { ModelParts } from '../kit/instancing';
import { PartBuilder, rgb } from '../kit/parts';

/**
 * Vehicles (local +x forward, origin on the floor under the vehicle position). The forklift is split
 * into the truck and its fork carriage, so the carriage can ride up and down the mast.
 */

const V = {
  // Forklift body: a muted industrial yellow, darker and greener than the amber of warnings.
  body: rgb('#c9a227'),
  counterweight: rgb('#3a3d41'),
  mast: rgb('#2f3237'),
  guard: rgb('#2b2e32'),
  seat: rgb('#1f2226'),
  tyre: rgb('#1b1d20'),
  rim: rgb('#8a8f95'),
  fork: rgb('#3b3f44'),
  glass: rgb('#9fb4c0'),
  light: rgb('#e8e2c8'),
  tractorCab: rgb('#d8dadc'),
  tractorFrame: rgb('#33363a'),
  beacon: rgb('#d88a2a'),
};

/** Where the driver's hips sit on the forklift (local, metres). */
export const FORKLIFT_SEAT: [number, number, number] = [-0.35, 1.02, 0];
/** Fork tips start ahead of the truck; the carried pallet centre sits here (matches the sim offset 1.3 m). */
export const FORK_REACH = 1.3;

function wheel(b: PartBuilder, x: number, z: number, r: number, w: number): void {
  b.cyl('rubber', r, w, { at: [x, r, z], rot: [Math.PI / 2, 0, 0], color: V.tyre, segments: 16 });
  b.cyl('metal', r * 0.55, w + 0.01, { at: [x, r, z], rot: [Math.PI / 2, 0, 0], color: V.rim, segments: 12 });
}

/** Counterbalance forklift, 2.5 t class: body, counterweight, overhead guard, mast. */
export function forklift(): ModelParts {
  const b = new PartBuilder();
  wheel(b, 0.45, -0.52, 0.32, 0.24);
  wheel(b, 0.45, 0.52, 0.32, 0.24);
  wheel(b, -0.85, -0.45, 0.26, 0.2);
  wheel(b, -0.85, 0.45, 0.26, 0.2);
  // Chassis and body.
  b.box('gloss', [1.9, 0.55, 1.1], { at: [-0.2, 0.55, 0], color: V.body, radius: 0.05 });
  b.box('gloss', [0.55, 0.75, 1.12], { at: [-1.05, 0.72, 0], color: V.counterweight, radius: 0.1 });
  b.box('gloss', [0.7, 0.35, 1.0], { at: [0.25, 0.98, 0], color: V.body, radius: 0.05 });
  // Seat, steering column and wheel.
  b.box('upholstery', [0.45, 0.1, 0.48], { at: [-0.35, 0.92, 0], color: V.seat, radius: 0.04 });
  b.box('upholstery', [0.1, 0.5, 0.46], {
    at: [-0.58, 1.2, 0],
    rot: [0, 0, 0.12],
    color: V.seat,
    radius: 0.04,
  });
  b.bar('metal', [0.35, 1.1, 0], [0.15, 1.45, 0], 0.03, { color: V.guard });
  b.ring('rubber', 0.16, 0.015, { at: [0.15, 1.48, 0], rot: [0, 0, 0.5], color: V.seat });
  // Overhead guard: four posts and a slatted roof.
  for (const [x, z] of [
    [0.45, -0.48],
    [0.45, 0.48],
    [-0.75, -0.48],
    [-0.75, 0.48],
  ] as Array<[number, number]>)
    b.bar('metal', [x, 0.9, z], [x * 0.95, 2.15, z], 0.035, { color: V.guard });
  for (let i = 0; i < 6; i++)
    b.box('metal', [1.3, 0.04, 0.05], { at: [-0.15, 2.17, -0.45 + i * 0.18], color: V.guard });
  b.box('metal', [0.1, 0.05, 1.02], { at: [0.47, 2.17, 0], color: V.guard });
  // Head lights and a warning beacon.
  for (const z of [-0.42, 0.42]) b.box('gloss', [0.06, 0.08, 0.1], { at: [0.5, 2.05, z], color: V.light });
  b.cyl('gloss', 0.06, 0.1, { at: [-0.7, 2.25, 0.4], color: V.beacon });
  // Mast: two channels and cross members in front of the front axle.
  for (const z of [-0.36, 0.36]) b.box('metal', [0.1, 2.3, 0.1], { at: [0.6, 1.2, z], color: V.mast });
  for (const y of [0.25, 1.2, 2.3]) b.box('metal', [0.1, 0.1, 0.82], { at: [0.6, y, 0], color: V.mast });
  // Tilt cylinders.
  for (const z of [-0.3, 0.3]) b.bar('metal', [0.3, 1.0, z], [0.55, 1.3, z], 0.035, { color: V.rim });
  return b.build();
}

/** Fork carriage with backrest and two forks; its origin is at the fork blades' top face. */
export function forkCarriage(): ModelParts {
  const b = new PartBuilder();
  // Carriage plate just in front of the mast; the pallet's back edge (1.3 - 0.6 m) rests against it.
  b.box('metal', [0.06, 0.5, 0.95], { at: [0.67, 0.25, 0], color: V.fork });
  for (let i = 0; i < 5; i++)
    b.box('metal', [0.03, 0.55, 0.03], { at: [0.67, 0.78, -0.4 + i * 0.2], color: V.fork });
  b.box('metal', [0.03, 0.04, 0.95], { at: [0.67, 1.05, 0], color: V.fork });
  for (const z of [-0.28, 0.28]) {
    b.box('metal', [1.15, 0.045, 0.12], { at: [0.7 + 0.575, -0.022, z], color: V.fork });
    b.box('metal', [0.05, 0.45, 0.12], { at: [0.7, 0.2, z], color: V.fork });
  }
  return b.build();
}

/** Terminal tractor (yard truck) with a single-seat cab and a fifth wheel at the back. */
export function yardTractor(): ModelParts {
  const b = new PartBuilder();
  wheel(b, 1.6, -1.0, 0.5, 0.35);
  wheel(b, 1.6, 1.0, 0.5, 0.35);
  for (const z of [-1.0, -0.7, 0.7, 1.0]) wheel(b, -1.1, z, 0.5, 0.28);
  b.box('metal', [4.6, 0.35, 1.0], { at: [0.2, 0.75, 0], color: V.tractorFrame });
  // Cab on the left, engine hood in front.
  b.box('gloss', [1.6, 1.9, 1.3], { at: [1.3, 2.0, -0.55], color: V.tractorCab, radius: 0.08 });
  b.box('screen', [0.02, 0.8, 1.1], { at: [2.11, 2.35, -0.55], color: V.glass });
  b.box('screen', [1.2, 0.8, 0.02], { at: [1.3, 2.35, -1.21], color: V.glass });
  b.box('gloss', [1.2, 0.9, 1.0], { at: [1.6, 1.35, 0.6], color: V.tractorCab, radius: 0.06 });
  b.box('metal', [0.1, 0.5, 2.3], { at: [2.4, 0.8, 0], color: V.tractorFrame });
  // Fifth wheel plate and mudguards.
  b.cyl('metal', 0.6, 0.12, { at: [-1.0, 1.1, 0], color: V.tractorFrame, segments: 18 });
  for (const z of [-0.85, 0.85])
    b.box('painted', [1.2, 0.05, 0.7], { at: [-1.1, 1.08, z], color: V.tractorFrame });
  b.cyl('gloss', 0.08, 0.12, { at: [1.3, 3.02, -0.55], color: V.beacon });
  return b.build();
}
