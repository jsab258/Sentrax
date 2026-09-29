import { siteUrl } from './paths';
import type { StoryState } from './state';

/** Clip or poster for a state: one per beat, and the last beat's try and found states. */
export function clipFor(state: StoryState): string {
  if (state.text.mode === 'try') return 'try';
  if (state.text.mode === 'found') return 'found';
  return state.beatId;
}

export function mediaUrl(orientation: 'landscape' | 'portrait', clip: string, ext: string): string {
  return siteUrl(`scroll-media/${orientation}/${clip}.${ext}`);
}

/**
 * Fallback stages (SCROLL-SPEC.md section 6): short muted looping clips per beat for weak devices, or
 * still posters for reduced motion, switched by scroll position with a crossfade.
 */
export class MediaStage {
  readonly el: HTMLDivElement;
  private readonly layers: Array<HTMLVideoElement | HTMLImageElement>;
  private front = 0;
  private current = '';

  constructor(
    readonly kind: 'video' | 'static',
    private orientation: () => 'landscape' | 'portrait',
  ) {
    this.el = document.createElement('div');
    this.el.className = `ss-media ss-media-${kind}`;
    const make = () => {
      if (kind === 'static') {
        const img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        return img;
      }
      const v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.preload = 'auto';
      return v;
    };
    this.layers = [make(), make()];
    for (const l of this.layers) this.el.append(l);
  }

  /** The clip shown for this state (for tests). */
  get clip(): string {
    return this.current;
  }

  update(state: StoryState): void {
    const clip = clipFor(state);
    const key = `${this.orientation()}/${clip}`;
    if (key === this.current) return;
    this.current = key;
    const next = this.layers[1 - this.front] as HTMLVideoElement | HTMLImageElement;
    const prev = this.layers[this.front] as HTMLVideoElement | HTMLImageElement;
    const o = this.orientation();
    if (next instanceof HTMLImageElement) {
      next.src = mediaUrl(o, clip, 'webp');
    } else {
      next.replaceChildren();
      next.poster = mediaUrl(o, clip, 'webp');
      for (const [ext, type] of [
        ['webm', 'video/webm'],
        ['mp4', 'video/mp4'],
      ] as const) {
        const s = document.createElement('source');
        s.src = mediaUrl(o, clip, ext);
        s.type = type;
        next.append(s);
      }
      next.load();
      void next.play().catch(() => undefined);
    }
    next.classList.add('is-front');
    prev.classList.remove('is-front');
    if (prev instanceof HTMLVideoElement) window.setTimeout(() => prev.pause(), 600);
    this.front = 1 - this.front;
    this.el.dataset.clip = clip;
  }

  dispose(): void {
    for (const l of this.layers) if (l instanceof HTMLVideoElement) l.pause();
    this.el.remove();
  }
}
