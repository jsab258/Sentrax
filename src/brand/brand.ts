/**
 * Sentrax brand tokens, extracted from https://sentrax.com/ on 2026-09-26 with `npm run brand:extract`.
 * Every value and its source is documented in BRAND.md. Do not change these values (SPEC section 10).
 *
 * The site defines two palettes:
 * - the Woodmart theme, which the live site actually renders (buttons, links, logo, hero), and
 * - the Elementor global kit (--e-global-color-*), which is defined but barely visible on the homepage.
 * UI tokens follow what the site renders. Kit colors are kept for the Radio, Data and Insight overlays.
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
   * Overlay colors for the Radio, Data and Insight layers, all taken from the brand palette above.
   * Mapping is a proposal until the M3 checkpoint (see BRAND.md).
   */
  overlay: {
    rssi: string;
    aoa: string;
    bilink: string;
    data: string;
    insight: string;
    alert: string;
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
  /** Elementor kit --e-global-color-primary. */
  kitPink: '#ED5087',
  /** Elementor kit --e-global-color-secondary. */
  kitViolet: '#520088',
  /** Elementor kit --e-global-color-accent. */
  kitDeepPurple: '#2E0075',
} as const;

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
    primary: palette.kitPink,
    secondary: palette.kitViolet,
    text: '#000000',
    accent: palette.kitDeepPurple,
  },
  overlay: {
    rssi: palette.blue,
    aoa: palette.kitPink,
    bilink: palette.kitViolet,
    data: palette.purple,
    insight: palette.kitDeepPurple,
    alert: palette.red,
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
  for (const [key, value] of Object.entries(b.overlay)) set(`--overlay-${kebab(key)}`, value);
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
