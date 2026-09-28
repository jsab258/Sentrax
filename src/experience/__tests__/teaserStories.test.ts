import { describe, expect, it } from 'vitest';
import { hospitalWorld } from '../../sim/scenes/hospital';
import { warehouseWorld } from '../../sim/scenes/warehouse';
import { storiesByScene, storyById, teaserStories } from '../stories';
import { h1 } from '../stories/hospital';
import { h1Teaser, w1Teaser } from '../stories/teaser';
import { w1 } from '../stories/warehouse';
import type { WorldDef } from '../../sim/world';
import { runStoryHeadless, StoryPlayer } from '../storyPlayer';
import type { StoryDef } from '../types';
import { storyEvents } from './storyEvents';

/**
 * Teaser mode plays short versions of H1 and W1. They only play faster, so on their fixed seeds they
 * produce exactly the events of the full stories (asserted event by event in the story tests): no
 * extra alerts, check-ins, check-outs or room changes.
 */
describe('teaser stories', () => {
  it('H1 teaser produces exactly the H1 events', () => {
    const full = runStoryHeadless(h1, hospitalWorld()).events;
    const teaser = runStoryHeadless(h1Teaser, hospitalWorld()).events;
    expect(storyEvents(teaser)).toEqual(storyEvents(full));
    expect(storyEvents(teaser).length).toBeGreaterThan(0);
    expect(teaser.length).toBe(full.length);
  });

  it('W1 teaser produces exactly the W1 events (none: the pallet never leaves the hall)', () => {
    const full = runStoryHeadless(w1, warehouseWorld()).events;
    const teaser = runStoryHeadless(w1Teaser, warehouseWorld()).events;
    expect(storyEvents(teaser)).toEqual(storyEvents(full));
    expect(storyEvents(teaser)).toEqual([]);
    expect(teaser.length).toBe(full.length);
  });

  it('are shorter to watch than the full stories, under a minute each', () => {
    /** Real seconds a visitor watches: each step's simulation time divided by its playback speed. */
    const watchS = (story: StoryDef, base: WorldDef) => {
      const p = new StoryPlayer(story, base);
      let total = 0;
      story.steps.forEach((step, i) => {
        p.enter(i);
        const t0 = p.sim.time;
        p.finish();
        total += (p.sim.time - t0) / (step.speed ?? 1);
      });
      p.dispose();
      return total;
    };
    for (const [full, teaser, base] of [
      [h1, h1Teaser, hospitalWorld],
      [w1, w1Teaser, warehouseWorld],
    ] as const) {
      const t = watchS(teaser, base());
      expect(t).toBeLessThan(watchS(full, base()));
      expect(t).toBeLessThan(60);
    }
  });

  it('loop alternates the scenes, are found by id and stay out of the story lists', () => {
    expect(teaserStories.map((s) => s.scene)).toEqual(['hospital', 'warehouse']);
    expect(storyById('h1-teaser')).toBe(h1Teaser);
    expect(storyById('w1-teaser')).toBe(w1Teaser);
    expect(h1Teaser.copyOf).toBe('h1');
    expect(w1Teaser.copyOf).toBe('w1');
    const listed = [...storiesByScene.hospital, ...storiesByScene.warehouse];
    expect(listed.some((s) => s.teaser)).toBe(false);
    expect(listed).toHaveLength(10);
  });
});
