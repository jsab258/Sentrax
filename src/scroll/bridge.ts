/**
 * Messages between the scroll story (in its iframe) and the embed loader on the host page. The host sends
 * the scroll progress; the story reports that it is ready and forwards its calls to action.
 */
export const HOST_SOURCE = 'sentrax-scroll-host';
export const STORY_SOURCE = 'sentrax-scroll';

export interface HostMessage {
  source: typeof HOST_SOURCE;
  type: 'progress';
  value: number;
}

export interface StoryMessage {
  source: typeof STORY_SOURCE;
  type: 'ready' | 'cta_click' | 'beat' | 'track';
  payload?: Record<string, unknown>;
}

export function isHostMessage(data: unknown): data is HostMessage {
  const d = data as Partial<HostMessage> | null;
  return !!d && d.source === HOST_SOURCE && d.type === 'progress' && typeof d.value === 'number';
}

export function postToHost(type: StoryMessage['type'], payload?: StoryMessage['payload']): void {
  if (window.parent === window) return;
  const msg: StoryMessage = { source: STORY_SOURCE, type, ...(payload ? { payload } : {}) };
  window.parent.postMessage(msg, '*');
}
