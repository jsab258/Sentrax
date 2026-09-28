import type { Simulation } from '../sim/engine';
import type { SimEvent } from '../sim/events';
import { createPrerolledSimulation } from '../sim/prewarm';
import type { WorldDef } from '../sim/world';
import type { StoryDef, StoryStep } from './types';

/** Simulation keeps running this long after a step completes, then holds until the visitor moves on. */
export const HOLD_AFTER_S = 45;

/**
 * Plays a guided story on its own simulation (fixed seed, story starting state, 30 s pre-roll). Steps
 * complete on an event, a state check or a time limit. Starting at step N replays steps 1 to N-1
 * instantly, so Back and deep links land on exactly the state a full playthrough reaches.
 */
export class StoryPlayer {
  readonly sim: Simulation;
  index = -1;
  private stepStart = 0;
  private doneAt: number | null = null;
  private cleanup: Array<() => void> = [];

  constructor(
    readonly story: StoryDef,
    base: WorldDef,
  ) {
    this.sim = createPrerolledSimulation(story.world(base), { seed: story.seed });
  }

  /** A player positioned at the start of step `index` (replaying the earlier steps). */
  static at(story: StoryDef, base: WorldDef, index: number): StoryPlayer {
    const p = new StoryPlayer(story, base);
    p.seek(index);
    return p;
  }

  /** From a new player: replays the steps before `index` instantly, then enters `index`. */
  seek(index: number): void {
    const target = Math.max(0, Math.min(index, this.story.steps.length - 1));
    for (let i = 0; i < target; i++) this.runStep(i);
    this.enter(target);
  }

  get step(): StoryStep {
    const s = this.story.steps[this.index];
    if (!s) throw new Error(`story ${this.story.id} has no step ${this.index}`);
    return s;
  }

  /** Simulation seconds since the step started. */
  get elapsed(): number {
    return this.sim.time - this.stepStart;
  }

  get complete(): boolean {
    const u = this.step.until;
    const e = this.elapsed;
    if (e < (u.minS ?? 0)) return false;
    if (e >= u.maxS) return true;
    if (this.doneAt === null && u.check?.(this.sim)) this.doneAt = this.sim.time;
    if (this.doneAt === null && !u.event && !u.check) return false;
    return this.doneAt !== null && this.sim.time >= this.doneAt + (u.plusS ?? 0);
  }

  enter(index: number): void {
    this.leave();
    this.index = index;
    this.stepStart = this.sim.time;
    this.doneAt = null;
    const step = this.step;
    const u = step.until;
    if (u.event) {
      const matcher = u.event;
      this.cleanup.push(
        this.sim.bus.onAny((e: SimEvent) => {
          if (this.doneAt === null && matcher(e)) this.doneAt = e.t;
        }),
      );
    }
    const off = step.enter?.(this.sim);
    if (typeof off === 'function') this.cleanup.push(off as () => void);
  }

  private leave(): void {
    for (const f of this.cleanup) f();
    this.cleanup = [];
  }

  /** Runs step `index` from its start until it completes (headless). */
  runStep(index: number): void {
    this.enter(index);
    this.finish();
  }

  /** Runs the current step to completion instantly (Next pressed before the step's event). */
  finish(): void {
    while (!this.complete) this.sim.step();
  }

  /** Advances by real time; returns the interpolation factor. Holds a while after the step completes. */
  tick(realSeconds: number, userSpeed: number): number {
    if (this.complete && this.doneAtOrEnd() + HOLD_AFTER_S < this.sim.time) return 0;
    return this.sim.advance(realSeconds * userSpeed * (this.step.speed ?? 1));
  }

  private doneAtOrEnd(): number {
    return this.doneAt ?? this.stepStart + this.step.until.maxS;
  }

  dispose(): void {
    this.leave();
  }
}

/** Runs a whole story headless and returns every event it produced (for the story tests). */
export function runStoryHeadless(
  story: StoryDef,
  base: WorldDef,
): { events: SimEvent[]; player: StoryPlayer } {
  const player = new StoryPlayer(story, base);
  const events: SimEvent[] = [];
  const off = player.sim.bus.onAny((e) => events.push(e));
  for (let i = 0; i < story.steps.length; i++) player.runStep(i);
  off();
  player.dispose();
  return { events, player };
}
