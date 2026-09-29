import { setAnalyticsSink, track } from '../analytics/track';
import { links } from '../content/links';
import { hospitalWorld } from '../sim/scenes/hospital';
import { isHostMessage, postToHost } from './bridge';
import { ScrollController } from './controller';
import {
  chooseMode,
  median,
  probePasses,
  SLOW_BUDGET_MS,
  type FallbackReason,
  type StageMode,
} from './detect';
import { MediaStage } from './media';
import { siteUrl } from './paths';
import { Overlay } from './overlay';
import { beatRanges, storyState, type StoryState } from './state';
import type { ScrollStory } from './stories/types';
import type { LookId } from './three/looks';
import type { ThreeStage } from './three/stage';
import { Timeline, type TimelineData } from './timeline/timeline';

export interface AppOptions {
  story: ScrollStory;
  timeline: TimelineData;
  look: LookId;
  /** Inside the embed loader's iframe: the host page scrolls and sends the progress. */
  embed: boolean;
  /** Clip capture: no loop, frames rendered on request, no text. */
  capture: boolean;
  env: Parameters<typeof chooseMode>[0];
}

/** Scroll track length in viewport heights (SCROLL-SPEC.md section 2). */
export const TRACK_VH = 600;
const PROBE_MS = 1000;
const SLOW_WINDOW_S = 2;

/**
 * The homepage scroll story: scroll progress in (the host page or this page's own scroll track), eased
 * story state out, shown on the 3D stage or the video or poster fallback, with the text overlay on top.
 */
export class ScrollApp {
  readonly root: HTMLElement;
  private readonly stageEl: HTMLDivElement;
  private readonly controller: ScrollController;
  private readonly overlay: Overlay;
  private readonly timeline: Timeline;
  private three: ThreeStage | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private media: MediaStage | null = null;
  private mode: StageMode;
  private reason: FallbackReason | null;
  private state: StoryState;
  private raf = 0;
  private last = 0;
  private dirty = true;
  private probeUntil = 0;
  private probeTimes: number[] = [];
  private slowTimes: number[] = [];
  private slowFor = 0;
  private viewed = false;
  private lastBeat = -1;
  private autoTracked = false;
  private visible = true;
  private wasMoving = false;

  constructor(
    host: HTMLElement,
    readonly opts: AppOptions,
  ) {
    this.timeline = new Timeline(opts.timeline);
    this.controller = new ScrollController(opts.story, this.timeline);
    this.state = this.controller.state();
    const choice = chooseMode(opts.env);
    this.mode = choice.mode;
    this.reason = choice.reason;

    this.root = document.createElement('div');
    this.root.className = `ss ss-look-${opts.look}${opts.embed ? ' is-embed' : ''}${opts.capture ? ' is-capture' : ''}`;
    this.root.dataset.look = opts.look;
    this.stageEl = document.createElement('div');
    this.stageEl.className = 'ss-stage';
    if (opts.embed || opts.capture) this.root.append(this.stageEl);
    else {
      const track = document.createElement('div');
      track.className = 'ss-track';
      track.style.height = `${TRACK_VH}vh`;
      track.append(this.stageEl);
      this.root.append(track);
    }
    const demo = import.meta.env.VITE_DEMO_URL || siteUrl();
    // Embedded: every analytics event also goes to the host page (the loader re-dispatches it, EMBED.md).
    if (opts.embed) {
      setAnalyticsSink((event, props) => {
        console.info('[track]', event, props);
        postToHost('track', { event, props });
      });
    }
    this.overlay = new Overlay(
      opts.story,
      { book: links.bookMeeting, demo },
      {
        onFind: () => this.find(),
        onCta: (cta) => {
          track('cta_clicked', { cta, placement: 'scroll_story' });
          postToHost('cta_click', { cta, placement: 'scroll_story' });
        },
      },
    );
    this.stageEl.append(this.overlay.root);
    host.append(this.root);
    if (this.reason) track('fallback_used', { reason: this.reason, mode: this.mode });
    this.reflect();
  }

  async start(): Promise<void> {
    if (this.mode === '3d') await this.start3d();
    else this.startMedia(this.mode);
    if (this.opts.capture) {
      this.exposeCapture();
      return;
    }
    this.listen();
    this.exposeHooks();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
    postToHost('ready');
  }

  private orientation = (): 'landscape' | 'portrait' =>
    this.stageEl.clientWidth / Math.max(1, this.stageEl.clientHeight) < 0.85 ? 'portrait' : 'landscape';

  private async start3d(): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.className = 'ss-canvas';
    this.stageEl.prepend(canvas);
    this.canvas = canvas;
    try {
      const { ThreeStage } = await import('./three/stage');
      const phone = Math.min(window.innerWidth, window.innerHeight) < 600;
      this.three = new ThreeStage(canvas, this.opts.story, this.timeline, hospitalWorld(), {
        look: this.opts.look,
        phone,
        dpr: phone ? 1.5 : 1.5,
      });
      this.resize();
      await this.three.ready;
      this.three.render(this.state);
      this.root.dataset.ready = 'true';
      this.probeUntil = performance.now() + PROBE_MS;
    } catch {
      this.switchToMedia('video', 'no-webgl2');
    }
  }

  private startMedia(kind: 'video' | 'static'): void {
    this.media = new MediaStage(kind, this.opts.look, this.orientation);
    this.stageEl.prepend(this.media.el);
    this.media.update(this.state);
    this.root.dataset.ready = 'true';
  }

  /** Crossfades from the 3D stage to the video clips (probe failed, or frames got slow later). */
  private switchToMedia(kind: 'video' | 'static', reason: FallbackReason): void {
    if (this.mode !== '3d') return;
    this.mode = kind;
    this.reason = reason;
    track('fallback_used', { reason, mode: kind });
    this.startMedia(kind);
    this.media?.el.classList.add('is-fading-in');
    const three = this.three;
    const canvas = this.canvas;
    this.three = null;
    window.setTimeout(() => {
      three?.dispose();
      canvas?.remove();
      this.media?.el.classList.remove('is-fading-in');
    }, 700);
    this.reflect();
  }

  private listen(): void {
    if (this.opts.embed) {
      let first = true;
      window.addEventListener('message', (e) => {
        if (e.source !== window.parent || !isHostMessage(e.data)) return;
        this.controller.setTarget(e.data.value);
        // Arriving mid-section (a reload, a deep link): start there instead of playing up to it.
        if (first) this.controller.snap();
        first = false;
        this.dirty = true;
      });
    } else {
      const onScroll = () => {
        const track = this.root.querySelector<HTMLElement>('.ss-track');
        if (!track) return;
        const r = track.getBoundingClientRect();
        this.controller.setTarget(-r.top / Math.max(1, r.height - window.innerHeight));
        this.dirty = true;
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      this.controller.snap();
    }
    new ResizeObserver(() => this.resize()).observe(this.stageEl);
    const io = new IntersectionObserver((entries) => {
      this.visible = entries.some((e) => e.isIntersecting);
      if (this.visible && !this.viewed) {
        this.viewed = true;
        track('scroll_story_view', { story: this.opts.story.id, look: this.opts.look, mode: this.mode });
      }
    });
    io.observe(this.stageEl);
  }

  private resize(): void {
    const w = this.stageEl.clientWidth;
    const h = this.stageEl.clientHeight;
    this.three?.resize(w, h);
    this.dirty = true;
  }

  private find(): void {
    if (this.controller.tap()) {
      track('find_tapped', { story: this.opts.story.id });
      this.dirty = true;
    }
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dtMs = now - this.last;
    this.last = now;
    if (!this.visible || document.visibilityState === 'hidden') return;
    const moving = this.controller.update(Math.min(0.1, dtMs / 1000));
    const probing = this.three !== null && now < this.probeUntil;
    // One more frame after the motion stops, so the settled state is drawn and reported.
    const stopped = this.wasMoving && !moving;
    this.wasMoving = moving;
    if (!moving && !stopped && !this.dirty && !probing) return;
    this.dirty = false;
    this.state = this.controller.state();
    if (this.three) {
      this.three.render(this.state);
      if (probing) this.probeTimes.push(dtMs);
      else if (this.probeTimes.length && this.probeUntil) this.endProbe();
      else if (moving) this.watchSpeed(dtMs);
    } else this.media?.update(this.state);
    this.overlay.update(this.state);
    this.reflect();
    this.report();
  };

  private endProbe(): void {
    this.probeUntil = 0;
    const times = this.probeTimes.slice(2);
    this.root.dataset.probeMs = median(times).toFixed(1);
    if (this.opts.env.force !== '3d' && !probePasses(times)) this.switchToMedia('video', 'probe');
    this.probeTimes = [];
  }

  private watchSpeed(dtMs: number): void {
    if (this.opts.env.force === '3d') return;
    this.slowTimes.push(dtMs);
    if (this.slowTimes.length > 60) this.slowTimes.shift();
    if (this.slowTimes.length >= 30 && median(this.slowTimes) > SLOW_BUDGET_MS) this.slowFor += dtMs / 1000;
    else this.slowFor = 0;
    if (this.slowFor > SLOW_WINDOW_S) this.switchToMedia('video', 'slow');
  }

  private report(): void {
    const s = this.state;
    if (s.beat !== this.lastBeat) {
      this.lastBeat = s.beat;
      track('scroll_beat', { beat: s.beatId });
      postToHost('beat', { beat: s.beatId });
    }
    if (!this.autoTracked && !this.controller.tapped && s.text.mode === 'found') {
      this.autoTracked = true;
      track('find_auto', { story: this.opts.story.id });
    }
  }

  private reflect(): void {
    const d = this.root.dataset;
    d.mode = this.mode;
    if (this.reason) d.reason = this.reason;
    d.beat = this.state.beatId;
    d.text = this.state.text.mode;
    d.find = this.state.find.toFixed(2);
    d.cta = String(this.state.cta);
    d.settled = String(this.controller.settled);
  }

  /** Hooks for tests: the shown state, and whether it has settled. */
  private exposeHooks(): void {
    (window as unknown as { __scrollStory: unknown }).__scrollStory = {
      state: () => this.state,
      key: () => JSON.stringify(this.state),
      settled: () => this.controller.settled,
      mode: () => this.mode,
      clip: () => this.media?.clip ?? null,
      stats: () => this.three?.stats() ?? null,
      target: () => this.controller.target,
      ranges: () => beatRanges(this.opts.story),
    };
  }

  /** Clip capture (scripts/scroll-clips.mjs): render exactly the requested frame. */
  private exposeCapture(): void {
    (window as unknown as { __scrollCapture: unknown }).__scrollCapture = {
      frame: (progress: number, find: number) => {
        this.state = storyState(this.opts.story, this.timeline, progress, find);
        this.three?.render(this.state);
        return this.state.beatId;
      },
      stats: () => this.three?.stats() ?? null,
      /** Scroll progress of a position inside a beat (0 to 1). */
      progressOf: (beat: number, local: number) => {
        const r = beatRanges(this.opts.story)[beat] ?? [0, 1];
        return r[0] + (r[1] - r[0]) * local;
      },
    };
    this.root.dataset.capture = 'ready';
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.three?.dispose();
    this.media?.dispose();
  }
}
