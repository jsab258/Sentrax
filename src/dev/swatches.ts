import { brand } from '../brand/brand';

/**
 * Overlay swatch data for the M2 checkpoint: each overlay colour's role and its contrast against colours
 * measured in the rendered hospital (high tier, default view, 1440 x 900, 2026-09-26).
 */

/** Scene colours sampled from the render (7 x 7 px averages at known world points). */
export const SCENE_REFERENCE = {
  'Floor, lit': '#ABA79E',
  'Floor, shaded': '#8A8779',
  'Wall face': '#E1E1E2',
  'Wall section': '#A8A49E',
  Ground: '#E1E1E1',
} as const;

/**
 * Casing drawn around overlay lines and dots so they read on any part of the scene (see DECISIONS.md):
 * white for the dark marks, the dark insight shade for the light amber warning.
 */
export const CASING = '#FFFFFF';

export interface SwatchSpec {
  key: string;
  hex: string;
  /** How the colour is derived from the three visible brand colours. */
  derivation: string;
  role: string;
  /** Marks (lines, dots, outlines) need 3:1; fills are translucent washes. */
  kind: 'mark' | 'fill';
  /** Casing colour for marks. */
  casing?: string;
}

const o = brand.overlay;
export const SWATCHES: SwatchSpec[] = [
  {
    key: 'rssi',
    hex: o.rssi,
    derivation: 'blue tint 0.20',
    role: 'RSSI uncertainty disk, ring fills',
    kind: 'fill',
  },
  {
    key: 'rssiLine',
    hex: o.rssiLine,
    derivation: 'blue shade 0.25',
    role: 'RSSI rings and circles',
    kind: 'mark',
  },
  { key: 'aoa', hex: o.aoa, derivation: 'purple tint 0.20', role: 'AoA rays and estimate dot', kind: 'mark' },
  {
    key: 'bilink',
    hex: o.bilink,
    derivation: 'purple',
    role: 'BiLink relay arc, room outline',
    kind: 'mark',
  },
  {
    key: 'bilinkFill',
    hex: o.bilinkFill,
    derivation: 'purple tint 0.55',
    role: 'BiLink room glow',
    kind: 'fill',
  },
  {
    key: 'data',
    hex: o.data,
    derivation: 'blue shade 0.45',
    role: 'Data packets, network plane',
    kind: 'mark',
  },
  {
    key: 'insight',
    hex: o.insight,
    derivation: 'purple shade 0.35',
    role: 'Labels, highlight outlines',
    kind: 'mark',
  },
  {
    key: 'highlight',
    hex: o.highlight,
    derivation: 'blue tint 0.55',
    role: 'Halo behind a highlighted asset',
    kind: 'fill',
  },
  ...o.heatmap.map((hex, i): SwatchSpec => ({
    key: `heatmap ${i + 1}`,
    hex,
    derivation: ['blue tint 0.60', 'blue', 'purple tint 0.20', 'purple'][i] ?? '',
    role: i === 0 ? 'Dwell heatmap, low' : i === 3 ? 'Dwell heatmap, high' : 'Dwell heatmap',
    kind: 'fill',
  })),
  {
    key: 'warning',
    hex: o.warning,
    derivation: 'standard amber (not a brand colour)',
    role: 'Warnings',
    kind: 'mark',
    casing: o.insight,
  },
  { key: 'critical', hex: o.critical, derivation: 'red', role: 'Critical alerts only', kind: 'mark' },
];

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
