import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAnalyticsSink, track } from './track';

describe('track', () => {
  afterEach(() => setAnalyticsSink(null));

  it('forwards events to the installed sink', () => {
    const sink = vi.fn();
    setAnalyticsSink(sink);
    track('scene_opened', { scene: 'hospital' });
    expect(sink).toHaveBeenCalledWith('scene_opened', { scene: 'hospital' });
  });

  it('never throws when the sink fails', () => {
    setAnalyticsSink(() => {
      throw new Error('boom');
    });
    expect(() => track('cta_clicked')).not.toThrow();
  });
});
