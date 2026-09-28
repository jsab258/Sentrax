import { describe, expect, it } from 'vitest';
import { hospitalWorld } from '../../sim/scenes/hospital';
import { h1, h2, h3, h4, h5 } from '../stories/hospital';
import { runStoryHeadless, StoryPlayer } from '../storyPlayer';
import type { StoryDef } from '../types';
import { storyEvents, type StoryEvent } from './storyEvents';

/**
 * Every hospital story on its fixed seed produces exactly these events, in this order, and nothing else:
 * no unexpected alerts, check-ins, check-outs or room changes (a false alert in a guided story is a
 * release blocker).
 */
const base = hospitalWorld();

const expected: Record<string, StoryEvent[]> = {
  h1: [
    ['room', 'tag-nurse-1', 'storage'],
    ['room', 'tag-nurse-1', null],
    ['room', 'tag-nurse-1', 'r101'],
    ['room', 'tag-nurse-1', null],
    ['room', 'tag-nurse-1', 'r102'],
    ['room', 'tag-nurse-1', null],
    ['room', 'tag-nurse-1', 'r103'],
    ['room', 'tag-nurse-1', null],
    ['room', 'tag-nurse-1', 'r104'],
  ],
  h2: [
    ['room', 'tag-porter', null],
    ['room', 'tag-wheelchair-02', null],
    ['room', 'tag-wheelchair-02', 'r101'],
    ['room', 'tag-porter', 'r101'],
    ['room', 'tag-wheelchair-02', null],
    ['room', 'tag-porter', null],
    ['room', 'tag-wheelchair-02', 'r102'],
    ['room', 'tag-porter', 'r102'],
    ['room', 'tag-wheelchair-02', null],
    ['room', 'tag-porter', null],
    ['room', 'tag-wheelchair-02', 'r103'],
    ['room', 'tag-porter', 'r103'],
  ],
  h3: [
    ['room', 'tag-vent-02', 'r102'],
    ['room', 'tag-porter', null],
    ['room', 'tag-porter', 'r102'],
    ['raised', 'par-icu-ventilators'],
    ['room', 'tag-biomed', 'r102'],
    ['cleared', 'par-icu-ventilators'],
    ['room', 'tag-vent-02', null],
    ['room', 'tag-biomed', 'icu'],
    ['room', 'tag-vent-02', 'icu'],
  ],
  h4: [
    ['raised', 'fridge-temperature'],
    ['room', 'tag-nurse-1', 'med'],
    ['cleared', 'fridge-temperature'],
  ],
  h5: [
    ['raised', 'sos'],
    ['room', 'tag-nurse-2', 'r105'],
    ['acknowledged', 'sos'],
    ['cleared', 'sos'],
  ],
};

function play(story: StoryDef) {
  return runStoryHeadless(story, base);
}

describe('hospital guided stories (fixed seeds, exact events)', () => {
  for (const story of [h1, h2, h3, h4, h5]) {
    it(`${story.id.toUpperCase()} produces exactly its expected events`, () => {
      const { events, player } = play(story);
      expect(storyEvents(events)).toEqual(expected[story.id]);
      // Every step finished on its own condition, not on the safety limit.
      expect(player.sim.time).toBeGreaterThan(30);
    });
  }

  it('finishes every step before its safety limit', () => {
    for (const story of [h1, h2, h3, h4, h5]) {
      const p = new StoryPlayer(story, base);
      story.steps.forEach((step, i) => {
        p.runStep(i);
        if (step.until.event || step.until.check) {
          expect(p.elapsed, `${story.id} step ${step.key}`).toBeLessThan(step.until.maxS);
        }
      });
      p.dispose();
    }
  });

  it('replays deterministically: starting at a later step reaches the same state as playing through', () => {
    const full = new StoryPlayer(h3, base);
    full.runStep(0);
    full.runStep(1);
    const jumped = StoryPlayer.at(h3, base, 2);
    expect(jumped.sim.time).toBeCloseTo(full.sim.time, 6);
    expect(jumped.sim.truth('tag-vent-02')).toEqual(full.sim.truth('tag-vent-02'));
    expect(jumped.sim.rules.activeAlerts().map((a) => a.ruleId)).toEqual(['par-icu-ventilators']);
  });

  it('shows the H2 anchor rejecting the tag in the corridor before accepting it in the room', () => {
    const p = new StoryPlayer(h2, base);
    const presence: Array<[string, boolean]> = [];
    p.sim.bus.on('bilink.presence', (e) => {
      if (e.tagId === 'tag-wheelchair-02' && e.anchorId === 'cen-r101')
        presence.push([e.anchorId, e.present]);
    });
    let rejectedInCorridor = false;
    p.sim.bus.on('agent.arrived', (e) => {
      if (e.agentId === 'porter' && e.nodeId === 'c-r101') {
        rejectedInCorridor = p.sim.bilink.anchorPresence('cen-r101', 'tag-wheelchair-02')?.present !== true;
      }
    });
    for (let i = 0; i < 3; i++) p.runStep(i);
    expect(rejectedInCorridor).toBe(true);
    expect(presence).toEqual([['cen-r101', true]]);
  });
});
