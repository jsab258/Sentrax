import { describe, expect, it } from 'vitest';
import { brand } from './brand';

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

  it('only uses palette colors for overlays', () => {
    const palette = new Set([...Object.values(brand.colors), ...Object.values(brand.kit)]);
    for (const color of Object.values(brand.overlay)) expect(palette.has(color), color).toBe(true);
  });
});
