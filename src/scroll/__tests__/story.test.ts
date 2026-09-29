import { describe, expect, it } from 'vitest';
import { scrollStories } from '../stories';
import type { Copy } from '../stories/types';

/** SCROLL-SPEC.md sections 2 and 3, and the claims policy of SPEC.md section 3, for every scroll story. */
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe.each(Object.values(scrollStories))('scroll story $story.id', ({ story, timeline }) => {
  const copies: Array<[string, Copy]> = [
    ...story.beats.map((b) => [b.id, b.copy] as [string, Copy]),
    ['found', story.find.found],
  ];

  it('keeps every headline to 8 words and every body line to 18, all unapproved drafts', () => {
    for (const [id, c] of copies) {
      expect(words(c.headline), id).toBeLessThanOrEqual(8);
      expect(words(c.body), id).toBeLessThanOrEqual(18);
      expect(c.approved, id).toBe(false);
    }
    expect(story.find.card.approved).toBe(false);
  });

  it('uses no em dashes and no figures beyond the allowed claims', () => {
    const text = [
      ...copies.flatMap(([, c]) => [c.headline, c.body]),
      story.find.button,
      story.find.card.title,
      story.find.card.place,
      story.find.card.when,
      story.label,
    ].join(' ');
    expect(text).not.toMatch(/[—–]/);
    expect(text).not.toMatch(/%|\$|€|CHF/);
  });

  it('labels the stage and scrubs only recorded time', () => {
    expect(story.label).toBe('Illustrative animation');
    for (const b of story.beats) {
      const [t0, t1] = b.timeline;
      expect(t0).toBeGreaterThanOrEqual(0);
      expect(t1).toBeLessThanOrEqual(timeline.duration);
      expect(t1).toBeGreaterThan(t0);
      const at = b.camera.map((k) => k.at);
      expect(at).toEqual([...at].sort((x, y) => x - y));
      for (const a of at) expect(a >= 0 && a <= 1).toBe(true);
    }
    const [a0, a1] = story.find.auto;
    expect(a0).toBeGreaterThan(0);
    expect(a1).toBeLessThanOrEqual(1);
  });
});
