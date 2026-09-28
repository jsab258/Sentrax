import type { BufferGeometry } from 'three';
import { PartBuilder, rgb, type Bucket, type RGB } from '../kit/parts';

/**
 * Faceless, mannequin-style figure (SPEC section 10) for a person of about 1.75 m, split into body parts
 * that are instanced across all characters. Each part's origin is its joint; limbs hang along -y.
 */

export const BODY = {
  hip: 0.93,
  pelvisHalfWidth: 0.1,
  torsoLength: 0.5,
  shoulderY: 0.45,
  shoulderZ: 0.19,
  upperArm: 0.29,
  forearm: 0.25,
  thigh: 0.43,
  shin: 0.43,
} as const;

export type PartName = 'pelvis' | 'torso' | 'head' | 'upperArm' | 'forearm' | 'thigh' | 'shin';

/** Which parts wear clothing (tinted per role) and which show the mannequin finish. */
export const CLOTHED: Record<PartName, 'top' | 'bottom' | null> = {
  pelvis: 'bottom',
  torso: 'top',
  head: null,
  upperArm: 'top',
  forearm: null,
  thigh: 'bottom',
  shin: 'bottom',
};

const SKIN = rgb('#d8cfc6');
const SHOE = rgb('#2a2c30');
const WHITE: RGB = [1, 1, 1];

function one(build: (b: PartBuilder) => void, mat: Bucket): BufferGeometry {
  const b = new PartBuilder();
  build(b);
  const g = b.build()[mat];
  if (!g) throw new Error('empty part');
  return g;
}

export interface PartGeometry {
  geometry: BufferGeometry;
  mat: Bucket;
}

export function mannequinParts(): Record<PartName, PartGeometry> {
  return {
    pelvis: {
      mat: 'fabric',
      geometry: one(
        (b) => b.sphere('fabric', 0.17, { at: [0, 0.02, 0], scale: [0.72, 0.62, 1.02], color: WHITE }),
        'fabric',
      ),
    },
    torso: {
      mat: 'fabric',
      geometry: one((b) => {
        b.lathe(
          'fabric',
          [
            [0, 0],
            [0.15, 0.02],
            [0.16, 0.2],
            [0.18, 0.36],
            [0.17, 0.46],
            [0.08, 0.52],
            [0, 0.52],
          ],
          { color: WHITE, segments: 16 },
        );
      }, 'fabric').scale(0.68, 1, 1),
    },
    head: {
      mat: 'plain',
      geometry: one((b) => {
        b.cyl('painted', 0.045, 0.1, { at: [0, 0.04, 0], color: SKIN });
        b.sphere('painted', 0.1, { at: [0.01, 0.17, 0], scale: [1.0, 1.18, 0.88], color: SKIN });
      }, 'plain'),
    },
    upperArm: {
      mat: 'fabric',
      geometry: one(
        (b) =>
          b.capsule('fabric', 0.05, BODY.upperArm + 0.04, { at: [0, -BODY.upperArm / 2, 0], color: WHITE }),
        'fabric',
      ),
    },
    forearm: {
      mat: 'plain',
      geometry: one((b) => {
        b.capsule('painted', 0.037, BODY.forearm, { at: [0, -BODY.forearm / 2, 0], color: SKIN });
        b.sphere('painted', 0.045, {
          at: [0.005, -BODY.forearm - 0.05, 0],
          scale: [0.7, 1.3, 0.45],
          color: SKIN,
        });
      }, 'plain'),
    },
    thigh: {
      mat: 'fabric',
      geometry: one(
        (b) => b.capsule('fabric', 0.075, BODY.thigh + 0.06, { at: [0, -BODY.thigh / 2, 0], color: WHITE }),
        'fabric',
      ),
    },
    shin: {
      mat: 'fabric',
      geometry: one((b) => {
        b.capsule('fabric', 0.058, BODY.shin + 0.04, { at: [0, -BODY.shin / 2, 0], color: WHITE });
        b.box('fabric', [0.26, 0.08, 0.1], { at: [0.06, -BODY.shin - 0.04, 0], color: SHOE, radius: 0.035 });
      }, 'fabric'),
    },
  };
}

/** Clothing colours by role: realistic workwear, kept away from the blue and violet overlay hues. */
export const OUTFITS: Record<string, { top: RGB; bottom: RGB }> = {
  nurse: { top: rgb('#2f7d7b'), bottom: rgb('#2f7d7b') },
  biomed: { top: rgb('#4a4f57'), bottom: rgb('#2c3440') },
  porter: { top: rgb('#3d5a45'), bottom: rgb('#2f3336') },
  patient: { top: rgb('#c9d6de'), bottom: rgb('#c9d6de') },
  // Warehouse: hi-vis yellow vests (yellow-green, clear of the amber warning colour) over navy.
  picker: { top: rgb('#cfd83c'), bottom: rgb('#2b3442') },
  forklift_driver: { top: rgb('#cfd83c'), bottom: rgb('#30353b') },
  assembly: { top: rgb('#39475a'), bottom: rgb('#2f3336') },
  default: { top: rgb('#6d7278'), bottom: rgb('#3a3e44') },
};
