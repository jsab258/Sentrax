import type { StoryDef, StoryStep } from '../types';
import { h1 } from './hospital';
import { w1 } from './warehouse';

/**
 * Teaser mode (SPEC section 4): short versions of H1 and W1 for the homepage embed, played in a loop.
 * Same seeds, starting states and steps as the full stories, so they produce exactly the same events
 * (src/experience/__tests__/teaserStories.test.ts); only the playback speed is higher.
 */
function faster(story: StoryDef, speeds: number[]): StoryDef {
  return {
    ...story,
    id: `${story.id}-teaser`,
    copyOf: story.id,
    teaser: true,
    steps: story.steps.map((s: StoryStep, i) => ({ ...s, speed: speeds[i] ?? s.speed })),
  };
}

// About 40 s (hospital) and 50 s (warehouse) of real time per loop, instead of 47 s and 87 s.
export const h1Teaser = faster(h1, [8, 1.5, 1.5]);
export const w1Teaser = faster(w1, [8, 1.5, 3]);

/** Play order of the teaser loop. */
export const teaserStories: StoryDef[] = [h1Teaser, w1Teaser];
