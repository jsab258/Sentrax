import { describe, expect, it } from 'vitest';
import { CASING, SCENE_REFERENCE, SWATCHES } from '../dev/swatches';
import { brand, shade, tint } from './brand';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('brand tokens', () => {
  it('are extracted, not placeholders', () => {
    expect(brand.status).toBe('extracted');
    expect(brand.logo.src).not.toBeNull();
  });

  it('meet WCAG AA for text pairs used in the UI', () => {
    const c = brand.colors;
    expect(contrast(c.text, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.textMuted, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.textMuted, c.surfaceAlt)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.secondary, c.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('meets 3:1 for the focus ring against the page', () => {
    expect(contrast(brand.colors.secondary, brand.colors.background)).toBeGreaterThanOrEqual(3);
  });

  it('derives overlays only from the three visible brand colors (plus amber for warnings)', () => {
    const bases = [brand.colors.primary, brand.colors.secondary, brand.colors.accent];
    const derived = new Set<string>(['#F59E0B']);
    for (const b of bases) {
      for (let k = 0; k <= 100; k += 5) {
        derived.add(tint(b, k / 100));
        derived.add(shade(b, k / 100));
      }
    }
    const kit = new Set(Object.values(brand.kit));
    for (const value of Object.values(brand.overlay).flat()) {
      expect(derived.has(value), value).toBe(true);
      expect(kit.has(value), value).toBe(false);
    }
  });

  it('reserves red for critical alerts', () => {
    const uses = Object.entries(brand.overlay).filter(([, v]) => v === brand.colors.primary);
    expect(uses.map(([k]) => k)).toEqual(['critical']);
  });

  it('keeps every overlay mark at 3:1 or more against its casing', () => {
    expect(SWATCHES.find((x) => x.key === 'warning')?.casing).toBe(brand.overlay.insight);
    for (const s of SWATCHES.filter((x) => x.kind === 'mark' && x.key !== 'warning')) {
      expect(s.casing ?? CASING, s.key).toBe('#FFFFFF');
    }
    // Measured at M2: on the lit floor (#ABA79E) some marks fall below 3:1 on their own, so every line,
    // dot and ring is drawn with a casing (approved at the M2 review): white, or the insight shade for amber.
    for (const s of SWATCHES.filter((x) => x.kind === 'mark')) {
      expect(contrast(s.hex, s.casing ?? CASING), s.key).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the dark marks at 3:1 or more against the rendered walls and ground', () => {
    for (const key of ['rssiLine', 'aoa', 'bilink', 'data', 'insight', 'critical'] as const) {
      for (const bg of [SCENE_REFERENCE['Wall face'], SCENE_REFERENCE.Ground]) {
        expect(contrast(brand.overlay[key], bg), `${key} on ${bg}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
