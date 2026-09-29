import { Color } from 'three';

/**
 * The story's look, "Realistic night" (SCROLL-SPEC.md section 4, look C, chosen after review; DECISIONS.md
 * 140): the demo's realistic materials relit at night with warm practical lights and window glow, and the
 * signals in brand colours with bloom: logo blue for radio pulses and room glows, purple for data, button
 * red only for the found-pump beam and the primary button.
 */
export const BRAND = {
  blue: '#6683C2',
  purple: '#352E86',
  red: '#D31F4C',
} as const;

export const LOOK = {
  /** Stage background: radial gradient from the centre to the edges. */
  background: { center: '#141b30', edge: '#03040a' },
  vignette: 0.6,
  exposure: 1.1,
  /** Image-based light from the studio environment. */
  envIntensity: 0.12,
  bloom: { strength: 0.7, radius: 0.5, threshold: 1.05 },
  /** Sky fill, a cool key from the front left and a rim from behind the building. */
  light: {
    hemi: { sky: '#6f7fa8', ground: '#0a0c14', intensity: 0.28 },
    key: { color: '#b9c6e6', intensity: 0.35 },
    rim: { color: '#6d7fb8', intensity: 0.8 },
  },
  /** Signal colours (HDR multipliers give the glow). */
  signal: { radio: '#7f9cff', data: '#9b8cff', found: BRAND.red, unassigned: '#8c8fa8' },
  /** Extra strength for room volumes and relay trails. */
  signalGain: 1.2,
  stageFloor: { color: '#06070c', roughness: 0.6, metalness: 0.1 },
} as const;

export type Look = typeof LOOK;

/** HDR colour for glowing effects: brand hue pushed above 1 so the bloom picks it up. */
export function glow(hex: string, intensity: number): Color {
  return new Color(hex).multiplyScalar(intensity);
}
