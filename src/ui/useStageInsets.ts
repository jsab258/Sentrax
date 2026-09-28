import { useEffect, type RefObject } from 'react';
import { useSceneStore } from '../scene/store';

/** Stages narrower than this lay panels out as bottom sheets. */
const MOBILE_MAX_W = 720;

/**
 * Measures the stage area covered by UI panels a few times per second: the dashboard on the right on
 * desktop, the narration card and the dashboard handle at the bottom on mobile.
 */
export function useStageInsets(stage: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const measure = () => {
      const root = stage.current;
      if (!root) return;
      const r = root.getBoundingClientRect();
      const dash = root.querySelector<HTMLElement>('[data-testid="dashboard"]');
      const guided = root.querySelector<HTMLElement>(
        '[data-testid="guided-panel"], [data-testid="sandbox-panel"]',
      );
      let right = 0;
      let bottom = 0;
      if (r.width > MOBILE_MAX_W) {
        if (dash) right = r.right - dash.getBoundingClientRect().left;
      } else {
        const tops: number[] = [];
        if (guided) tops.push(guided.getBoundingClientRect().top);
        if (dash && !dash.classList.contains('is-open')) tops.push(dash.getBoundingClientRect().top);
        if (tops.length) bottom = Math.min(r.bottom - Math.min(...tops), r.height * 0.5);
      }
      useSceneStore
        .getState()
        .setInsets({ right: Math.max(0, Math.round(right)), bottom: Math.max(0, Math.round(bottom)) });
    };
    measure();
    const id = window.setInterval(measure, 250);
    return () => window.clearInterval(id);
  }, [stage]);
}
