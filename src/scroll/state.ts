import type { Beat, CameraPose, EffectCue, PlanPoint, ScrollStory } from './stories/types';
import type { Timeline } from './timeline/timeline';

/**
 * Everything the stage, the text and the effects show at one scroll position: a pure function of the
 * scroll progress (0 to 1) and the find value (0 to 1), so the same position renders the same frame
 * forwards and backwards (SCROLL-SPEC.md section 5).
 */
export interface StoryState {
  progress: number;
  beat: number;
  beatId: string;
  /** Position within the beat, 0 to 1. */
  local: number;
  /** Recorded simulation seconds shown. */
  t: number;
  /** The find in the last beat: 0 not started, 1 found. */
  find: number;
  text: { beat: number; mode: 'beat' | 'try' | 'found' };
  /** The two calls to action are showing. */
  cta: boolean;
  camera: { landscape: Required<CameraPose>; portrait: Required<CameraPose> };
  fx: FxState;
}

export interface FxState {
  /** Extra heading (rad) for people looking around. */
  look: Record<string, number>;
  /** Tags lit up with pulse rings: strength 0 to 1, phase counts pulses. */
  pulses: Array<{ tagId: string; strength: number; phase: number }>;
  /** Room volumes filling with light, 0 to 1. */
  rooms: Record<string, number>;
  /** Anchors pulsing, 0 to 1, with a shared pulse phase. */
  anchors: Record<string, number>;
  anchorPhase: number;
  /** Tags assigned to a lit room (they glow with it). */
  roomTags: Array<{ tagId: string; roomId: string; strength: number }>;
  /** Tags in no room, shown subtly. */
  unassigned: Array<{ tagId: string; strength: number }>;
  /** Light trails from anchors to gateways: head position 0 to 1 along the arc. */
  arcs: Array<{ anchorId: string; gatewayId: string; head: number; strength: number }>;
  /** Data stream from the gateways up to SOLIX. */
  stream: { strength: number; phase: number };
  /** The find: red beam over the asset and the phone card. */
  beam: number;
  card: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const round = (v: number) => Math.round(v * 1e6) / 1e6;

/** Fades in over the first and out over the last `edge` of a window. */
function envelope(local: number, from: number, to: number, edge = 0.12): number {
  if (local < from || local > to) return 0;
  const span = Math.max(1e-6, to - from);
  const n = (local - from) / span;
  return smooth(Math.min(n / edge, (1 - n) / edge, 1));
}

/** Beat boundaries on the 0 to 1 scroll track, from the beats' spans. */
export function beatRanges(story: ScrollStory): Array<[number, number]> {
  const total = story.beats.reduce((s, b) => s + b.span, 0);
  let acc = 0;
  return story.beats.map((b) => {
    const r: [number, number] = [acc / total, (acc + b.span) / total];
    acc += b.span;
    return r;
  });
}

function locate(story: ScrollStory, progress: number): { beat: number; local: number } {
  const ranges = beatRanges(story);
  const p = clamp01(progress);
  for (let i = 0; i < ranges.length; i++) {
    const [a, b] = ranges[i] as [number, number];
    if (p < b || i === ranges.length - 1) return { beat: i, local: clamp01((p - a) / (b - a)) };
  }
  return { beat: 0, local: 0 };
}

/** Portrait framing derived from a landscape pose: same target, further back, wider lens. */
export function portraitOf(pose: CameraPose): Required<CameraPose> {
  const [px, py, pz] = pose.position;
  const [tx, ty, tz] = pose.target;
  const k = 1.7;
  return {
    position: [tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k],
    target: pose.target,
    fov: 42,
    blur: pose.blur ?? 0,
  };
}

function full(pose: CameraPose): Required<CameraPose> {
  return { position: pose.position, target: pose.target, fov: pose.fov ?? 34, blur: pose.blur ?? 0 };
}

function lerpPoint(a: PlanPoint, b: PlanPoint, t: number): PlanPoint {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function lerpPose(a: Required<CameraPose>, b: Required<CameraPose>, t: number): Required<CameraPose> {
  return {
    position: lerpPoint(a.position, b.position, t),
    target: lerpPoint(a.target, b.target, t),
    fov: lerp(a.fov, b.fov, t),
    blur: lerp(a.blur, b.blur, t),
  };
}

/** The camera track: every key of every beat placed on the 0 to 1 scroll track. */
function cameraTrack(story: ScrollStory, orientation: 'landscape' | 'portrait') {
  const ranges = beatRanges(story);
  const keys: Array<{ p: number; pose: Required<CameraPose> }> = [];
  story.beats.forEach((b: Beat, i) => {
    const [a, z] = ranges[i] as [number, number];
    for (const k of b.camera) {
      const pose =
        orientation === 'landscape'
          ? full(k.landscape)
          : k.portrait
            ? full(k.portrait)
            : portraitOf(k.landscape);
      keys.push({ p: a + (z - a) * k.at, pose });
    }
  });
  return keys;
}

function cameraAt(story: ScrollStory, progress: number, orientation: 'landscape' | 'portrait') {
  const keys = cameraTrack(story, orientation);
  const first = keys[0];
  if (!first) throw new Error(`story ${story.id} has no camera keys`);
  if (progress <= first.p) return first.pose;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i] as (typeof keys)[number];
    const b = keys[i + 1] as (typeof keys)[number];
    if (progress <= b.p)
      return lerpPose(a.pose, b.pose, smooth((progress - a.p) / Math.max(1e-6, b.p - a.p)));
  }
  return (keys[keys.length - 1] as (typeof keys)[number]).pose;
}

function roundPose(p: Required<CameraPose>): Required<CameraPose> {
  return {
    position: p.position.map(round) as PlanPoint,
    target: p.target.map(round) as PlanPoint,
    fov: round(p.fov),
    blur: round(p.blur),
  };
}

function applyCues(
  fx: FxState,
  cues: EffectCue[],
  local: number,
  fade: number,
  t: number,
  tl: Timeline,
): void {
  for (const c of cues) {
    const env = envelope(local, c.from, c.to) * fade;
    const n = clamp01((local - c.from) / Math.max(1e-6, c.to - c.from));
    if (c.kind === 'lookAround') {
      if (env > 0) fx.look[c.agentId] = round(0.9 * Math.sin(n * Math.PI * 2 * 1.25) * env);
    } else if (c.kind === 'tagPulse') {
      if (env > 0) fx.pulses.push({ tagId: c.tagId, strength: round(env), phase: round(n * 4) });
    } else if (c.kind === 'rooms') {
      const count = c.rooms.length;
      c.rooms.forEach((room, i) => {
        // Rooms light one after another and stay lit to the end of the beat.
        const start = c.from + ((c.to - c.from) * i) / count;
        const fill = smooth((local - start) / 0.12) * fade;
        if (fill <= 0) return;
        const tags = tl.tagsInRoom(room, t);
        const lit = fill * (tags.length ? 1 : 0.35);
        fx.rooms[room] = round(Math.max(fx.rooms[room] ?? 0, lit));
        fx.anchors[`cen-${room}`] = round(Math.max(fx.anchors[`cen-${room}`] ?? 0, fill));
        for (const tagId of tags) fx.roomTags.push({ tagId, roomId: room, strength: round(fill) });
      });
      fx.anchorPhase = round(local * 5);
    } else if (c.kind === 'unassigned') {
      if (env > 0) fx.unassigned.push({ tagId: c.tagId, strength: round(env) });
    } else if (c.kind === 'relays') {
      c.anchors.forEach((anchorId, i) => {
        const gatewayId = tl.gatewayFor(anchorId);
        if (!gatewayId || env <= 0) return;
        // Staggered trails, each running from the anchor to its gateway twice.
        const cycle = clamp01(n * 1.6 - i * 0.12) * 2;
        fx.arcs.push({ anchorId, gatewayId, head: round(cycle % 1), strength: round(env) });
        fx.anchors[anchorId] = round(Math.max(fx.anchors[anchorId] ?? 0, env * 0.6));
      });
      fx.anchorPhase = round(local * 4);
    } else if (c.kind === 'stream') {
      if (env > 0) fx.stream = { strength: round(env), phase: round(n * 3) };
    }
  }
}

/** Effects fade out over the first part of the next beat instead of switching off. */
const CARRY = 0.12;

export function storyState(story: ScrollStory, tl: Timeline, progress: number, find = 0): StoryState {
  const p = clamp01(progress);
  const { beat, local } = locate(story, p);
  const b = story.beats[beat] as Beat;
  const last = beat === story.beats.length - 1;
  const t = round(lerp(b.timeline[0], b.timeline[1], local));

  const auto = last ? smooth((local - story.find.auto[0]) / (story.find.auto[1] - story.find.auto[0])) : 0;
  const f = last ? round(Math.max(auto, clamp01(find))) : 0;

  const fx: FxState = {
    look: {},
    pulses: [],
    rooms: {},
    anchors: {},
    anchorPhase: 0,
    roomTags: [],
    unassigned: [],
    arcs: [],
    stream: { strength: 0, phase: 0 },
    beam: round(smooth((f - 0.45) / 0.3)),
    card: round(smooth((f - 0.6) / 0.3)),
  };
  applyCues(fx, b.effects, local, 1, t, tl);
  const prev = story.beats[beat - 1];
  if (prev && local < CARRY) applyCues(fx, prev.effects, 1, 1 - local / CARRY, t, tl);
  if (last) {
    // The found asset glows in its room.
    const room = tl.roomOf(story.find.tagId, t);
    if (room && f > 0) {
      fx.rooms[room] = round(Math.max(fx.rooms[room] ?? 0, smooth((f - 0.5) / 0.4)));
      fx.pulses.push({
        tagId: story.find.tagId,
        strength: round(smooth((f - 0.4) / 0.3)),
        phase: round(f * 3),
      });
    }
  }

  const ease = smooth(f);
  const camLand = cameraAt(story, p, 'landscape');
  const camPort = cameraAt(story, p, 'portrait');
  const findLand = full(story.find.camera);
  const findPort = story.find.cameraPortrait
    ? full(story.find.cameraPortrait)
    : portraitOf(story.find.camera);

  return {
    progress: round(p),
    beat,
    beatId: b.id,
    local: round(local),
    t,
    find: f,
    text: { beat, mode: last ? (f >= 0.5 ? 'found' : 'try') : 'beat' },
    cta: last && f >= 0.85,
    camera: {
      landscape: roundPose(lerpPose(camLand, findLand, ease)),
      portrait: roundPose(lerpPose(camPort, findPort, ease)),
    },
    fx,
  };
}
