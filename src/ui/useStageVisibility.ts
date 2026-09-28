import { useEffect, type RefObject } from 'react';
import { useSceneStore } from '../scene/store';

/**
 * Stops rendering while the stage is scrolled out of view (for example the teaser embedded in a long
 * homepage). Inside a cross-origin iframe the observer still reports visibility in the top-level page.
 */
export function useStageVisibility(stage: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      if (e) useSceneStore.getState().setVisible(e.isIntersecting);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      useSceneStore.getState().setVisible(true);
    };
  }, [stage]);
}
