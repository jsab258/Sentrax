import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hospitalWorld } from '../../sim/scenes/hospital';
import { ScrollController } from '../controller';
import { beatRanges, storyState } from '../state';
import { hospitalBilink } from '../stories/hospital-bilink';
import { recordTimeline } from '../timeline/record';
import { Timeline, type TimelineData } from '../timeline/timeline';

const file = join(import.meta.dirname, '..', 'stories', 'hospital-bilink.timeline.json');

/**
 * The committed recording must be exactly what the simulation produces for the story's seed and starting
 * state. `npm run scroll:record` (SCROLL_RECORD=1) rewrites it after a story or engine change.
 */
describe('scroll story timeline', () => {
  const fresh = recordTimeline(hospitalBilink, hospitalWorld());

  it('is the recording the simulation produces for the story seed', () => {
    if (process.env.SCROLL_RECORD) writeFileSync(file, `${JSON.stringify(fresh)}\n`);
    const committed = JSON.parse(readFileSync(file, 'utf8')) as TimelineData;
    expect(committed).toEqual(fresh);
  });

  const tl = new Timeline(fresh);
  const story = hospitalBilink;
  const ranges = beatRanges(story);
  const beatTimes = (id: string) => story.beats.find((b) => b.id === id)?.timeline ?? [0, 0];

  it('keeps the corridor tag out of every room (no hallway bleed)', () => {
    for (let t = 0; t <= fresh.duration; t += 0.5) expect(tl.roomOf('tag-crashcart-01', t)).toBeNull();
  });

  it('has tagged equipment assigned to each room while the rooms beat lights them', () => {
    const [t0, t1] = beatTimes('rooms');
    for (const room of ['r103', 'r104', 'r105', 'r106'])
      for (let t = t0; t <= t1; t += 1)
        expect(tl.tagsInRoom(room, t).length, `${room} at ${t}`).toBeGreaterThan(0);
  });

  it('shows pump P-07 in room 104 whenever the find beat plays', () => {
    const [t0, t1] = beatTimes('find');
    for (let t = t0; t <= t1; t += 0.5) expect(tl.roomOf(story.find.tagId, t)).toBe(story.find.roomId);
  });

  it('records BiLink relays from the room anchors to their corridor gateways', () => {
    for (const room of ['r103', 'r104', 'r105', 'r106'])
      expect(tl.gatewayFor(`cen-${room}`)).toMatch(/^len1-/);
    const [t0, t1] = beatTimes('relay');
    expect(tl.relaysBetween(0, fresh.duration).length).toBeGreaterThan(0);
    expect(t1).toBeGreaterThan(t0);
  });

  it('renders the same state at the same scroll position, forwards and backwards', () => {
    const positions = Array.from({ length: 81 }, (_, i) => i / 80);
    const forward = positions.map((p) => JSON.stringify(storyState(story, tl, p)));
    const backward = [...positions].reverse().map((p) => JSON.stringify(storyState(story, tl, p)));
    expect(backward.reverse()).toEqual(forward);
  });

  it('settles on the same state after scrolling down and back up (controller with easing)', () => {
    const c = new ScrollController(story, tl);
    const settle = () => {
      for (let i = 0; i < 2000 && !c.settled; i++) c.update(1 / 60);
      expect(c.settled).toBe(true);
      return JSON.stringify(c.state());
    };
    const probes = [0.05, 0.25, 0.45, 0.62, 0.8, 0.95];
    const down = probes.map((p) => {
      c.setTarget(p);
      return settle();
    });
    c.setTarget(1);
    settle();
    const up = [...probes].reverse().map((p) => {
      c.setTarget(p);
      return settle();
    });
    expect(up.reverse()).toEqual(down);
  });

  it('finds the pump by itself when the visitor scrolls on, and after a tap', () => {
    const lastStart = (ranges[ranges.length - 1] as [number, number])[0];
    expect(storyState(story, tl, lastStart + 0.01).text.mode).toBe('try');
    expect(storyState(story, tl, 1).text.mode).toBe('found');
    expect(storyState(story, tl, 1).cta).toBe(true);
    const c = new ScrollController(story, tl);
    c.setTarget(lastStart + 0.02);
    c.snap();
    expect(c.tap()).toBe(true);
    for (let i = 0; i < 400; i++) c.update(1 / 60);
    expect(c.state().text.mode).toBe('found');
    expect(c.state().cta).toBe(true);
    // Leaving the last beat undoes the tap.
    c.setTarget(0.3);
    expect(c.tapped).toBe(false);
  });
});
