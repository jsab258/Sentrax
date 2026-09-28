import { useEffect } from 'react';
import { BookMeetingButton } from '../app/CtaButton';
import { track } from '../analytics/track';
import { storyCopy } from '../content/stories';
import { ui } from '../content/ui';
import { postToParent } from '../embed/bridge';
import { advanceTeaser } from '../experience/runtime';
import { storyById } from '../experience/stories';
import { useExperience } from '../experience/store';
import type { SceneKey } from '../experience/types';
import { useSceneStore } from '../scene/store';

/** Pause after a teaser step's simulation completes, before the loop moves on (real milliseconds). */
const TEASER_READ_MS = 2500;

/**
 * Where "Explore the interactive demo" leads: VITE_DEMO_URL when the build sets it (the later /demo page),
 * otherwise this app in guided mode, in the scene the teaser is showing.
 */
function demoUrl(scene: SceneKey): string {
  const configured: string = import.meta.env.VITE_DEMO_URL || '';
  const url = new URL(configured || import.meta.env.BASE_URL, window.location.href);
  url.searchParams.set('scene', scene);
  return url.toString();
}

/**
 * Teaser mode (SPEC section 4): short H1 and W1 in a loop with minimal UI, a caption, the two calls to
 * action and a pause control. The camera takes no input, so the page around the embed scrolls normally.
 */
export function TeaserOverlay() {
  const storyId = useExperience((s) => s.storyId);
  const step = useExperience((s) => s.step);
  const scene = useExperience((s) => s.scene);
  const complete = useExperience((s) => s.stepComplete);
  const paused = useSceneStore((s) => s.speed === 0);
  const setSpeed = useSceneStore((s) => s.setSpeed);

  useEffect(() => {
    if (paused || !complete) return;
    const id = window.setTimeout(advanceTeaser, TEASER_READ_MS);
    return () => window.clearTimeout(id);
  }, [paused, complete, storyId, step]);

  const story = storyById(storyId);
  const copy = story ? storyCopy[story.copyOf ?? story.id] : undefined;
  const def = story?.steps[step];
  const stepCopy = def && copy ? copy.steps[def.key] : undefined;

  return (
    <section className="teaser" aria-label={ui.teaser.label} data-testid="teaser">
      <button
        type="button"
        className={`teaser-pause${paused ? ' is-paused' : ''}`}
        aria-label={paused ? ui.teaser.play : ui.teaser.pause}
        title={paused ? ui.teaser.play : ui.teaser.pause}
        onClick={() => setSpeed(paused ? 1 : 0)}
        data-testid="teaser-pause"
      >
        <span aria-hidden="true" />
      </button>
      <div className="teaser-bar">
        {copy && stepCopy && (
          <div
            className="teaser-caption"
            data-testid="teaser-caption"
            data-story={story?.id}
            data-step={step + 1}
          >
            <p className="guided-kicker">{copy.title}</p>
            <h2>{stepCopy.title}</h2>
            <p className="teaser-body">{stepCopy.body}</p>
          </div>
        )}
        <div className="teaser-actions">
          <a
            className="btn btn-primary"
            href={demoUrl(scene)}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="explore-demo"
            onClick={() => {
              track('cta_clicked', { cta: 'explore_demo', placement: 'teaser' });
              postToParent('cta_click', { cta: 'explore_demo', placement: 'teaser' });
            }}
          >
            {ui.cta.exploreDemo}
            <span className="visually-hidden"> ({ui.cta.newTabHint})</span>
          </a>
          <BookMeetingButton placement="teaser" variant="secondary" />
        </div>
      </div>
    </section>
  );
}
