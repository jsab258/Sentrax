/**
 * A recorded simulation run (SCROLL-SPEC.md section 5). Scroll position maps to a time in the recording,
 * and every lookup here is a pure function of that time, so the same scroll position always shows the
 * same state, whichever way the visitor scrolls.
 *
 * Units in the data: positions in centimetres, headings in milliradians, times in seconds.
 */
export interface TimelineData {
  version: 1;
  story: string;
  seed: number;
  /** Samples per second. */
  hz: number;
  /** Recorded seconds (sample count is duration * hz + 1). */
  duration: number;
  /** People: plan position, smoothed heading, walked distance (for the walk cycle), pushing flag. */
  agents: Record<
    string,
    { role: string; x: number[]; y: number[]; h: number[]; d: number[]; push: number[] }
  >;
  /** Tagged equipment: one entry when it never moves, else one per sample. */
  assets: Record<string, { cls: string; heading: number; x: number[]; y: number[] }>;
  /** Tag id to its carrier and mounting height (cm). */
  tags: Record<string, { carrier: string; model: string; mount: number }>;
  /** SOLIX room assignment per tag: [time, room or null] at the start and at every change. */
  rooms: Record<string, Array<[number, string | null]>>;
  /** BiLink relays: [time, anchor, gateway, tag]. */
  relays: Array<[number, string, string, string]>;
  /** The gateway each room anchor relays to. */
  gateways: Record<string, string>;
}

export interface AgentPose {
  x: number;
  y: number;
  heading: number;
  /** Walked distance (m), which drives the walk cycle. */
  walked: number;
  /** Walking speed (m/s) around this moment. */
  speed: number;
  pushing: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function angleLerp(a: number, b: number, t: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

export class Timeline {
  readonly samples: number;

  constructor(readonly data: TimelineData) {
    this.samples = Math.round(data.duration * data.hz) + 1;
  }

  get duration(): number {
    return this.data.duration;
  }

  /** Sample index and blend factor for a time (clamped to the recording). */
  private at(t: number): { i: number; j: number; f: number } {
    const s = Math.min(Math.max(t, 0), this.data.duration) * this.data.hz;
    const i = Math.min(Math.floor(s), this.samples - 1);
    const j = Math.min(i + 1, this.samples - 1);
    return { i, j, f: s - i };
  }

  agentIds(): string[] {
    return Object.keys(this.data.agents);
  }

  agentAt(id: string, t: number): AgentPose | null {
    const a = this.data.agents[id];
    if (!a) return null;
    const { i, j, f } = this.at(t);
    const v = (arr: number[], k: number) => arr[Math.min(k, arr.length - 1)] ?? 0;
    const walked = lerp(v(a.d, i), v(a.d, j), f) / 100;
    const step = (v(a.d, j) - v(a.d, i)) / 100;
    return {
      x: lerp(v(a.x, i), v(a.x, j), f) / 100,
      y: lerp(v(a.y, i), v(a.y, j), f) / 100,
      heading: angleLerp(v(a.h, i) / 1000, v(a.h, j) / 1000, f),
      walked,
      speed: j > i ? step * this.data.hz : 0,
      pushing: (f < 0.5 ? v(a.push, i) : v(a.push, j)) === 1,
    };
  }

  assetIds(): string[] {
    return Object.keys(this.data.assets);
  }

  assetAt(id: string, t: number): { x: number; y: number; heading: number } | null {
    const a = this.data.assets[id];
    if (!a) return null;
    const { i, j, f } = this.at(t);
    const v = (arr: number[], k: number) => arr[Math.min(k, arr.length - 1)] ?? 0;
    return {
      x: lerp(v(a.x, i), v(a.x, j), f) / 100,
      y: lerp(v(a.y, i), v(a.y, j), f) / 100,
      heading: a.heading,
    };
  }

  /** Room SOLIX assigns the tag to at time t (null: in no room). */
  roomOf(tagId: string, t: number): string | null {
    const list = this.data.rooms[tagId];
    if (!list?.length) return null;
    let lo = 0;
    let hi = list.length - 1;
    if (t < (list[0] as [number, string | null])[0]) return null;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((list[mid] as [number, string | null])[0] <= t) lo = mid;
      else hi = mid - 1;
    }
    return (list[lo] as [number, string | null])[1];
  }

  /** Tags SOLIX assigns to a room at time t. */
  tagsInRoom(roomId: string, t: number): string[] {
    return Object.keys(this.data.rooms).filter((tag) => this.roomOf(tag, t) === roomId);
  }

  relaysBetween(t0: number, t1: number): Array<[number, string, string, string]> {
    return this.data.relays.filter((r) => r[0] >= t0 && r[0] < t1);
  }

  gatewayFor(anchorId: string): string | undefined {
    return this.data.gateways[anchorId];
  }
}
