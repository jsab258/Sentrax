import { describe, expect, it } from 'vitest';
import { warehouseWorld } from '../../sim/scenes/warehouse';
import { slotFromReport } from '../slot';
import { w1, w2, w3, w4, w5 } from '../stories/warehouse';
import { runStoryHeadless, StoryPlayer } from '../storyPlayer';
import type { StoryDef } from '../types';
import { storyEvents, type StoryEvent } from './storyEvents';

/**
 * Every warehouse story on its fixed seed produces exactly these events, in this order, and nothing else:
 * no unexpected alerts, check-ins, check-outs or room changes.
 */
const base = warehouseWorld();

const expected: Record<string, StoryEvent[]> = {
  // AoA locates the pallet in its slot; the forklift takes it to staging. No rooms, gates or alerts.
  w1: [],
  w2: [
    ['room', 'tag-driver-1', 'dock-2'],
    ['room', 'tag-forklift-1', 'dock-2'],
    ['room', 'tag-pallet-2401', 'dock-2'],
    ['room', 'tag-driver-1', null],
    ['room', 'tag-pallet-2401', null],
    ['room', 'tag-forklift-1', null],
    ['checkout', 'tag-pallet-2401', 'dock-2'],
    ['room', 'tag-forklift-1', 'dock-2'],
    ['room', 'tag-forklift-1', null],
  ],
  w3: [
    ['raised', 'dwell-station-2'],
    ['cleared', 'dwell-station-2'],
  ],
  w4: [
    ['raised', 'cage'],
    ['cleared', 'cage'],
    ['room', 'tag-driver-1', 'muster'],
    ['room', 'tag-picker-1', 'muster'],
    ['room', 'tag-picker-4', 'muster'],
    ['room', 'tag-driver-2', 'muster'],
    ['room', 'tag-picker-2', 'muster'],
    ['room', 'tag-driver-3', 'muster'],
    ['room', 'tag-picker-3', 'muster'],
    ['room', 'tag-assembly-1', 'muster'],
    ['room', 'tag-assembly-2', 'muster'],
  ],
  w5: [
    ['room', 'tag-driver-3', null],
    ['room', 'tag-forklift-3', null],
    ['room', 'tag-driver-3', 'dock-3'],
    ['room', 'tag-forklift-3', 'dock-3'],
    ['room', 'tag-driver-3', null],
    ['room', 'tag-forklift-3', null],
    ['raised', 'cold-chain'],
    ['room', 'tag-cold-pallet-04', 'cold-entry'],
    ['room', 'tag-driver-3', 'cold-entry'],
    ['room', 'tag-forklift-3', 'cold-entry'],
    ['cleared', 'cold-chain'],
    ['room', 'tag-cold-pallet-04', null],
    ['room', 'tag-driver-3', null],
    ['room', 'tag-forklift-3', null],
    ['checkin', 'tag-cold-pallet-04', 'cold-entry'],
  ],
};

const stories: StoryDef[] = [w1, w2, w3, w4, w5];

describe('warehouse guided stories (fixed seeds, exact events)', () => {
  for (const story of stories) {
    it(`${story.id.toUpperCase()} produces exactly its expected events`, () => {
      const { events } = runStoryHeadless(story, base);
      expect(storyEvents(events)).toEqual(expected[story.id]);
    });
  }

  it('W1 takes PL-2291 from aisle C, bay 14, level 4 to staging, and AoA reports the slot first', () => {
    const p = new StoryPlayer(w1, base);
    p.runStep(0);
    p.runStep(1);
    expect(slotFromReport(p.sim.report('tag-pallet-2291'))).toEqual({ aisle: 'C', bay: 14, level: 4 });
    p.runStep(2);
    const pallet = p.sim.agents.asset('pallet-2291');
    expect(pallet.carriedBy).toBeNull();
    expect(Math.hypot(pallet.pos.x - 50, pallet.pos.y - 12)).toBeLessThan(2.5);
  });

  it('W2 tows the loaded trailer to its bay with the pallet inside, and the trailer stays located', () => {
    const p = new StoryPlayer(w2, base);
    p.runStep(0);
    p.runStep(1);
    const trailer = p.sim.agents.asset('trailer-02');
    const pallet = p.sim.agents.asset('pallet-2401');
    expect(trailer.pos.y).toBeLessThan(-40);
    expect(pallet.inside?.id).toBe('trailer-02');
    const r = p.sim.report('tag-trailer-02');
    expect(r?.held ?? false).toBe(false);
    expect(r?.zoneIds).toContain('yard');
  });

  it('W4 counts everyone at the muster point except the straggler, then everyone', () => {
    const p = new StoryPlayer(w4, base);
    for (let i = 0; i < 3; i++) p.runStep(i);
    expect(p.sim.rules.musterStatus('muster').missing).toEqual(['tag-assembly-2']);
    p.runStep(3);
    const s = p.sim.rules.musterStatus('muster');
    expect(s.present).toBe(s.total);
  });

  it('finishes every step before its safety limit', () => {
    for (const story of stories) {
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
});
