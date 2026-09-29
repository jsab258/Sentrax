import { beatRanges, storyState, type StoryState } from './state';
import type { ScrollStory } from './stories/types';
import type { Timeline } from './timeline/timeline';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

/** How quickly the shown position follows the scroll position (1/s): eased, never jittery. */
const FOLLOW = 7;

/**
 * Scroll position in, story state out. The shown position eases towards the scroll position; the tap
 * plays the find over a fixed time. Once settled, the state depends only on the scroll position (and on
 * whether the visitor tapped in the last beat), so scrolling back to a position shows the same frame.
 */
export class ScrollController {
  target = 0;
  shown = 0;
  private clock = 0;
  private tapAt: number | null = null;
  private readonly lastStart: number;

  constructor(
    readonly story: ScrollStory,
    readonly timeline: Timeline,
  ) {
    const ranges = beatRanges(story);
    this.lastStart = (ranges[ranges.length - 1] as [number, number])[0];
  }

  /** New scroll position (0 to 1). Leaving the last beat undoes the tap. */
  setTarget(progress: number): void {
    this.target = clamp01(progress);
    if (this.target < this.lastStart) this.tapAt = null;
  }

  get tapped(): boolean {
    return this.tapAt !== null;
  }

  /** The visitor pressed Find (only in the last beat). Returns whether it started the find. */
  tap(): boolean {
    if (this.tapAt !== null || this.shown < this.lastStart - 0.01) return false;
    this.tapAt = this.clock;
    return true;
  }

  /** Jumps straight to the scroll position (first frame, captures, tests). */
  snap(): void {
    this.shown = this.target;
  }

  private tapFind(): number {
    return this.tapAt === null ? 0 : smooth((this.clock - this.tapAt) / this.story.find.durationS);
  }

  /** Advances by real seconds. Returns true while something is still moving. */
  update(dt: number): boolean {
    this.clock += dt;
    const d = this.target - this.shown;
    if (Math.abs(d) < 1e-4) this.shown = this.target;
    else this.shown += d * (1 - Math.exp(-dt * FOLLOW));
    return !this.settled;
  }

  get settled(): boolean {
    return this.shown === this.target && (this.tapAt === null || this.tapFind() >= 1);
  }

  state(): StoryState {
    return storyState(this.story, this.timeline, this.shown, this.tapFind());
  }
}
