/**
 * Sentrax brand tokens.
 *
 * STATUS: PLACEHOLDER. None of the values below are Sentrax brand values yet.
 *
 * SPEC section 10 requires colors, fonts and the logo to be extracted from sentrax.com (Elementor global kit
 * CSS, computed homepage styles, header logo). sentrax.com is blocked by the build environment's network
 * policy, so extraction has not run. The neutral values below only keep the UI readable during setup.
 * Run `npm run brand:extract` once the site is reachable, then replace this file with the extracted values
 * and document every source in BRAND.md. After that, do not change them.
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
    border: string;
    onPrimary: string;
  };
  /** Overlay colors for the Radio, Data and Insight layers. Must be taken from the brand palette. */
  overlay: {
    rssi: string;
    aoa: string;
    bilink: string;
    data: string;
    insight: string;
    alert: string;
  };
  fonts: {
    heading: BrandFont;
    body: BrandFont;
  };
  logo: {
    /** Path under /public once the header logo has been downloaded. */
    src: string | null;
    alt: string;
  };
}

const systemStack =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';

export const brand: Brand = {
  status: 'placeholder',
  colors: {
    primary: '#1F4E79',
    secondary: '#3A6EA5',
    accent: '#2A9D8F',
    text: '#1A1D21',
    textMuted: '#5B6470',
    background: '#F5F6F8',
    surface: '#FFFFFF',
    border: '#D9DDE3',
    onPrimary: '#FFFFFF',
  },
  overlay: {
    rssi: '#3A86FF',
    aoa: '#8338EC',
    bilink: '#06D6A0',
    data: '#00B4D8',
    insight: '#FFB703',
    alert: '#E63946',
  },
  fonts: {
    heading: { family: 'system-ui', fallback: systemStack, weights: [600, 700] },
    body: { family: 'system-ui', fallback: systemStack, weights: [400, 500] },
  },
  logo: { src: null, alt: 'Sentrax' },
};

/** Writes the brand tokens to CSS custom properties so stylesheets never hard-code colors. */
export function applyBrandTokens(root: HTMLElement, b: Brand = brand): void {
  const set = (name: string, value: string) => root.style.setProperty(name, value);
  for (const [key, value] of Object.entries(b.colors)) set(`--color-${kebab(key)}`, value);
  for (const [key, value] of Object.entries(b.overlay)) set(`--overlay-${kebab(key)}`, value);
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
