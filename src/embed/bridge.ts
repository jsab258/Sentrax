/**
 * postMessage bridge for iframe embedding (SPEC section 11).
 *
 * Messages carry no personal data, only event names and small props, so the default target origin is '*'.
 * Set VITE_EMBED_PARENT_ORIGIN at build time to lock messages to the WordPress origin.
 */
export type EmbedEvent = 'ready' | 'cta_click' | 'story_complete' | 'content_height';

export interface EmbedMessage {
  source: 'sentrax-3d-demo';
  type: EmbedEvent;
  payload?: Record<string, string | number | boolean>;
}

const targetOrigin: string = import.meta.env.VITE_EMBED_PARENT_ORIGIN || '*';

export function isEmbedded(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

export function postToParent(type: EmbedEvent, payload?: EmbedMessage['payload']): void {
  if (!isEmbedded()) return;
  const message: EmbedMessage = { source: 'sentrax-3d-demo', type, ...(payload ? { payload } : {}) };
  window.parent.postMessage(message, targetOrigin);
}

/** Reports the document height to the parent whenever it changes, so the iframe can size itself. */
export function observeContentHeight(el: HTMLElement): () => void {
  if (!isEmbedded() || typeof ResizeObserver === 'undefined') return () => undefined;
  let last = -1;
  const ro = new ResizeObserver(() => {
    const height = Math.ceil(el.scrollHeight);
    if (height !== last) {
      last = height;
      postToParent('content_height', { height });
    }
  });
  ro.observe(el);
  return () => ro.disconnect();
}
