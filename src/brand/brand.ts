/**
 * Sentrax brand tokens, extracted from https://sentrax.com/ on 2026-09-26 with `npm run brand:extract`.
 * Every value and its source is documented in BRAND.md. Do not change these values (SPEC section 10).
 *
 * The site defines two palettes:
 * - the Woodmart theme, which the live site actually renders (buttons, links, logo, hero), and
 * - the Elementor global kit (--e-global-color-*), which is defined but barely visible on the homepage.
 * UI tokens follow what the site renders. Overlays are tints and shades of the three visible colors only.
 */

export type BrandStatus = 'placeholder' | 'extracted';

export interface BrandFont {
  family: string;
  /** CSS font stack used while the web font loads or if it fails. */
  fallback: string;
  weights: number[];
}

export interface Brand {
  status: BrandStatus;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    textMuted: string;
    background: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    onPrimary: string;
  };
  /** Elementor global kit colors, verbatim. */
  kit: {
    primary: string;
    secondary: string;
    text: string;
    accent: string;
  };
  /**
   * Overlay colors for the Radio, Data and Insight layers. Every value is a tint or shade of the three
   * colors visitors actually see on sentrax.com (logo blue, wordmark purple, button red), derived below.
   * Marks (lines, dots, outlines) meet 3:1 against the scene; fills are translucent and need not.
   */
  overlay: {
    /** RSSI range rings, trilateration circles and uncertainty disk (translucent fill). */
    rssi: string;
    /** RSSI strokes. */
    rssiLine: string;
    /** AoA rays and estimate dot. */
    aoa: string;
    /** BiLink relay arc and room outline. */
    bilink: string;
    /** BiLink room volume glow (translucent fill). */
    bilinkFill: string;
    /** Data packets, network plane, protocol labels. */
    data: string;
    /** In-scene labels and highlight outlines. */
    insight: string;
    /** Halo behind a highlighted asset (translucent). */
    highlight: string;
    /** Dwell heatmap ramp, low to high. */
    heatmap: [string, string, string, string];
    /** Warnings: standard amber (not a brand color). */
    warning: string;
    /** Critical alerts only. Red is otherwise reserved for the Book a meeting button. */
    critical: string;
  };
  radius: {
    button: string;
  };
  fonts: {
    heading: BrandFont;
    body: BrandFont;
  };
  logo: {
    /** Path relative to the app root (public/). */
    src: string | null;
    alt: string;
    width: number;
    height: number;
  };
}

const fallbackStack = 'Arial, Helvetica, sans-serif';

const palette = {
  /** Woodmart --wd-primary-color; computed background of every CTA button; logo "x". */
  red: '#D31F4C',
  /** Woodmart --wd-alternative-color; logo wordmark. */
  purple: '#352E86',
  /** Logo signal waves (sampled from the header logo). */
  blue: '#6683C2',
} as const;

/** Standard amber for warnings (not a brand color). */
const AMBER = '#F59E0B';

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: number[]): string {
  return `#${rgb
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** Mix a color towards white (tint) or black (shade) by k in [0, 1]. */
export function tint(hex: string, k: number): string {
  return toHex(toRgb(hex).map((v) => v + (255 - v) * k));
}

export function shade(hex: string, k: number): string {
  return toHex(toRgb(hex).map((v) => v * (1 - k)));
}

export const brand: Brand = {
  status: 'extracted',
  colors: {
    primary: palette.red,
    secondary: palette.purple,
    accent: palette.blue,
    /** Elementor kit --e-global-color-text; computed color of h1 to h3 and paragraphs. */
    text: '#000000',
    /** Woodmart --wd-entities-title-color and --wd-link-color. */
    textMuted: '#333333',
    /** Computed body background. */
    background: '#FFFFFF',
    surface: '#FFFFFF',
    /** Computed background of the theme's light buttons. */
    surfaceAlt: '#F3F3F3',
    /** Computed border of the theme's light buttons. */
    border: '#E9E9E9',
    /** Computed text color of the CTA buttons. */
    onPrimary: '#FFFFFF',
  },
  kit: {
    primary: '#ED5087',
    secondary: '#520088',
    text: '#000000',
    accent: '#2E0075',
  },
  overlay: {
    rssi: tint(palette.blue, 0.2),
    rssiLine: shade(palette.blue, 0.25),
    aoa: tint(palette.purple, 0.2),
    bilink: palette.purple,
    bilinkFill: tint(palette.purple, 0.55),
    data: shade(palette.blue, 0.45),
    insight: shade(palette.purple, 0.35),
    highlight: tint(palette.blue, 0.55),
    heatmap: [tint(palette.blue, 0.6), palette.blue, tint(palette.purple, 0.2), palette.purple],
    warning: AMBER,
    critical: palette.red,
  },
  radius: {
    /** Computed border radius of the CTA buttons. */
    button: '10px',
  },
  fonts: {
    /** Woodmart --wd-title-font and --wd-entities-title-font; computed font of h1 to h3. */
    heading: { family: 'Poppins', fallback: fallbackStack, weights: [500, 600] },
    /** Woodmart --wd-text-font and --wd-header-el-font; computed font of body and paragraphs. */
    body: { family: 'Lato', fallback: fallbackStack, weights: [400, 700] },
  },
  logo: { src: './brand/sentrax-logo.png', alt: 'Sentrax', width: 250, height: 95 },
};

/** Writes the brand tokens to CSS custom properties so stylesheets never hard-code colors. */
export function applyBrandTokens(root: HTMLElement, b: Brand = brand): void {
  const set = (name: string, value: string) => root.style.setProperty(name, value);
  for (const [key, value] of Object.entries(b.colors)) set(`--color-${kebab(key)}`, value);
  for (const [key, value] of Object.entries(b.overlay)) {
    if (typeof value === 'string') set(`--overlay-${kebab(key)}`, value);
  }
  set('--radius-button', b.radius.button);
  set('--font-heading', fontStack(b.fonts.heading));
  set('--font-body', fontStack(b.fonts.body));
}

const genericFamilies = new Set(['system-ui', 'sans-serif', 'serif', 'monospace', 'ui-sans-serif']);

export function fontStack(f: BrandFont): string {
  const family = genericFamilies.has(f.family) ? f.family : `"${f.family}"`;
  return `${family}, ${f.fallback}`;
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
