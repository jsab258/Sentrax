import { describe, expect, it } from 'vitest';
import { detectTier, parseTier, tierSettings } from './quality';

const base = { mobile: false, cores: 8, memoryGb: 8, maxTextureSize: 16384 };

describe('quality tiers', () => {
  it('maps common GPUs to tiers', () => {
    expect(
      detectTier({ ...base, renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)' }),
    ).toBe('high');
    expect(detectTier({ ...base, renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)' })).toBe('high');
    expect(detectTier({ ...base, renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620)', cores: 4 })).toBe(
      'low',
    );
    expect(detectTier({ ...base, renderer: 'Google SwiftShader' })).toBe('low');
    expect(detectTier({ ...base, renderer: 'Apple GPU', mobile: true, memoryGb: 4 })).toBe('medium');
    expect(detectTier({ ...base, renderer: 'Mali-G52', mobile: true })).toBe('low');
    expect(detectTier({ ...base, renderer: 'Unknown', maxTextureSize: 8192, cores: 4 })).toBe('medium');
  });

  it('low disables SSAO and most shadows, high enables everything', () => {
    expect(tierSettings.low).toMatchObject({
      ssao: 'off',
      shadowCasters: 'structure',
      glow: false,
      extraFigures: false,
    });
    expect(tierSettings.high).toMatchObject({
      ssao: 'full',
      shadows: true,
      shadowCasters: 'all',
      glow: true,
      textures: 'high',
    });
  });

  it('parses overrides', () => {
    expect(parseTier('low')).toBe('low');
    expect(parseTier('ultra')).toBeNull();
  });
});
