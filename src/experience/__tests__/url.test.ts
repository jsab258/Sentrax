import { describe, expect, it } from 'vitest';
import { parseDeepLink, serializeDeepLink } from '../url';

describe('deep links', () => {
  it('parses mode, scene, story, step, layers and lens', () => {
    const d = parseDeepLink('?scene=hospital&story=h3&step=2&layers=physical,radio,insight&lens=bilink');
    expect(d).toEqual({
      mode: 'guided',
      scene: 'hospital',
      story: 'h3',
      step: 1,
      layers: { physical: true, radio: true, data: false, insight: true },
      lens: 'bilink',
    });
  });

  it('ignores unknown values and keeps other parameters when serializing', () => {
    const d = parseDeepLink('?mode=nope&scene=moon&lens=laser&step=-3');
    expect(d.mode).toBe('guided');
    expect(d.scene).toBe('hospital');
    expect(d.lens).toBeNull();
    expect(d.step).toBe(0);
    const s = serializeDeepLink({ ...d, story: 'h1', step: 2 }, '?quality=low&stats=1');
    expect(s).toBe('?quality=low&stats=1&scene=hospital&story=h1&step=3');
  });

  it('round-trips sandbox and teaser links without story parameters', () => {
    const s = serializeDeepLink(
      { mode: 'sandbox', scene: 'warehouse', story: 'w1', step: 4, layers: null, lens: 'aoa' },
      '',
    );
    expect(s).toBe('?mode=sandbox&scene=warehouse&lens=aoa');
    expect(parseDeepLink(s)).toMatchObject({ mode: 'sandbox', scene: 'warehouse', lens: 'aoa' });
  });
});

describe('infrastructure comparison', () => {
  it('counts devices from the hospital scene', async () => {
    const { infrastructureCounts } = await import('../compare');
    const { hospitalWorld } = await import('../../sim/scenes/hospital');
    expect(infrastructureCounts(hospitalWorld())).toEqual({
      conventional: { gateways: 11, powered: 11, cables: 11, anchors: 0 },
      bilink: { gateways: 2, powered: 2, cables: 2, anchors: 11 },
    });
  });
});
