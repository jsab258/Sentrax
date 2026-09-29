import { createPrerolledSimulation } from '../../sim/prewarm';
import type { WorldDef } from '../../sim/world';
import type { ScrollStory } from '../stories/types';
import type { TimelineData } from './timeline';

const HZ = 5;
/** Heading smoothing (1/s), as people turn in the full demo (characters/characterSystem.ts). */
const TURN_RATE = 6;
/** Margin around the crop for what gets recorded (m). */
const MARGIN = 2;

/** Rounded to whole units; `+ 0` turns -0 into 0 so the JSON round trip is exact. */
const int = (v: number) => Math.round(v) + 0;
const cm = (m: number) => int(m * 100);

/**
 * Runs the story's simulation once (fixed seed, story starting state, 30 s pre-roll) and records what
 * the scroll story shows: people and tagged equipment in the crop, SOLIX room assignments and BiLink
 * relays. Used by `npm run scroll:record` and by the test that keeps the committed recording current.
 */
export function recordTimeline(story: ScrollStory, base: WorldDef): TimelineData {
  const world = story.world(base);
  const sim = createPrerolledSimulation(world, { seed: story.seed });
  const t0 = sim.time;
  const { x0, y0, x1, y1 } = story.crop;
  const inCrop = (x: number, y: number) =>
    x >= x0 - MARGIN && x <= x1 + MARGIN && y >= y0 - MARGIN && y <= y1 + MARGIN;
  const rel = (t: number) => int((t - t0) * 100) / 100;

  const rooms: TimelineData['rooms'] = {};
  const relays: TimelineData['relays'] = [];
  for (const tag of world.tags) {
    const r = sim.report(tag.id);
    rooms[tag.id] = [[0, r?.tech === 'bilink' ? (r.roomId ?? null) : null]];
  }
  const off = sim.bus.onAny((e) => {
    if (e.type === 'position.room') rooms[e.tagId]?.push([rel(e.t), e.roomId]);
    else if (e.type === 'bilink.relay') relays.push([rel(e.t), e.anchorId, e.gatewayId, e.tagId]);
  });

  const people = [...sim.agents.agents.values()].filter((a) => a.kind === 'person');
  const yaw = new Map(people.map((a) => [a.id, a.heading]));
  const walked = new Map(people.map((a) => [a.id, 0]));
  const agents: Record<
    string,
    { role: string; x: number[]; y: number[]; h: number[]; d: number[]; push: number[] }
  > = {};
  for (const a of people) agents[a.id] = { role: a.role, x: [], y: [], h: [], d: [], push: [] };
  const assets: Record<string, { cls: string; heading: number; x: number[]; y: number[] }> = {};
  const tagged = new Set(world.tags.filter((t) => t.carrier.type === 'asset').map((t) => t.carrier.id));
  for (const a of sim.agents.assets.values()) {
    if (!tagged.has(a.id)) continue;
    const def = world.assets.find((d) => d.id === a.id);
    assets[a.id] = { cls: a.cls, heading: def?.headingDeg ?? 0, x: [], y: [] };
  }

  const sample = () => {
    for (const a of people) {
      const rec = agents[a.id];
      if (!rec) continue;
      rec.x.push(cm(a.pos.x));
      rec.y.push(cm(a.pos.y));
      rec.h.push(int((yaw.get(a.id) ?? 0) * 1000));
      rec.d.push(cm(walked.get(a.id) ?? 0));
      rec.push.push(a.carrying.length ? 1 : 0);
    }
    for (const a of sim.agents.assets.values()) {
      const rec = assets[a.id];
      if (!rec) continue;
      rec.x.push(cm(a.pos.x));
      rec.y.push(cm(a.pos.y));
    }
  };

  const stepsPerSample = Math.round(1 / (sim.dt * HZ));
  const total = Math.round(story.recordS / sim.dt);
  sample();
  for (let s = 1; s <= total; s++) {
    const before = new Map(people.map((a) => [a.id, { x: a.pos.x, y: a.pos.y }]));
    sim.step();
    for (const a of people) {
      const b = before.get(a.id);
      if (b) walked.set(a.id, (walked.get(a.id) ?? 0) + Math.hypot(a.pos.x - b.x, a.pos.y - b.y));
      const cur = yaw.get(a.id) ?? a.heading;
      const d = Math.atan2(Math.sin(a.heading - cur), Math.cos(a.heading - cur));
      yaw.set(a.id, cur + d * Math.min(1, sim.dt * TURN_RATE));
    }
    if (s % stepsPerSample === 0) sample();
  }
  off();

  // Keep only what the story shows; store equipment that never moved as a single position.
  const inView = (a: { x: number[]; y: number[] }) =>
    a.x.some((x, i) => inCrop(x / 100, (a.y[i] ?? 0) / 100));
  const shownAgents = Object.fromEntries(Object.entries(agents).filter(([, a]) => inView(a)));
  const shownAssets = Object.fromEntries(
    Object.entries(assets)
      .filter(([, a]) => inView(a))
      .map(([id, a]) => {
        const still = a.x.every((x) => x === a.x[0]) && a.y.every((y) => y === a.y[0]);
        return [id, still ? { ...a, x: a.x.slice(0, 1), y: a.y.slice(0, 1) } : a];
      }),
  );
  const shown = new Set([...Object.keys(shownAgents), ...Object.keys(shownAssets)]);
  const tags: TimelineData['tags'] = {};
  for (const t of world.tags) {
    if (shown.has(t.carrier.id))
      tags[t.id] = { carrier: t.carrier.id, model: t.model, mount: cm(t.mountHeightM) };
  }
  const shownRooms = Object.fromEntries(Object.entries(rooms).filter(([id]) => tags[id]));
  const anchors = world.devices.filter(
    (d) => d.kind === 'anchor' && d.roomId && inCrop(d.position.x, d.position.y),
  );
  const gateways: Record<string, string> = {};
  for (const a of anchors) {
    const g = sim.bilink.gatewayFor(a.id);
    if (g) gateways[a.id] = g;
  }
  return {
    version: 1,
    story: story.id,
    seed: story.seed,
    hz: HZ,
    duration: story.recordS,
    agents: shownAgents,
    assets: shownAssets,
    tags,
    rooms: shownRooms,
    relays: relays.filter((r) => gateways[r[1]] !== undefined && tags[r[3]] !== undefined),
    gateways,
  };
}
