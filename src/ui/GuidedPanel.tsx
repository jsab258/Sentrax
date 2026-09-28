import { useEffect, useState } from 'react';
import { BookMeetingButton } from '../app/CtaButton';
import { claimsOverlayRequested } from '../app/devtools';
import { claims } from '../content/claims';
import { storyCopy } from '../content/stories';
import { formatClock, ui } from '../content/ui';
import { infrastructureCounts } from '../experience/compare';
import { activePlayer, nextStep, openStory, previousStep, setMode, showEndCard } from '../experience/runtime';
import { storiesByScene } from '../experience/stories';
import { useExperience } from '../experience/store';
import { baseWorld } from '../experience/worlds';
import { useSimTick } from './useSimTick';

/** Reading time after a step's simulation completes before autoplay moves on (real milliseconds). */
const AUTOPLAY_READ_MS = 4000;

function isTyping(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
}

/**
 * Guided mode (SPEC section 4): story picker, narration card (title plus one or two sentences), step
 * extras (stopwatch, claim, comparison), controls (back, next, autoplay, skip) and the end card.
 */
export function GuidedPanel() {
  const scene = useExperience((s) => s.scene);
  const storyId = useExperience((s) => s.storyId);
  const step = useExperience((s) => s.step);
  const endCard = useExperience((s) => s.endCard);
  const complete = useExperience((s) => s.stepComplete);
  const autoplay = useExperience((s) => s.autoplay);
  const stepUi = useExperience((s) => s.stepUi);
  const set = useExperience((s) => s.set);
  const [listOpen, setListOpen] = useState(false);

  const stories = storiesByScene[scene];
  const story = stories.find((s) => s.id === storyId);
  const copy = storyId ? storyCopy[storyId] : undefined;
  const def = story?.steps[step];
  const stepCopy = def && copy ? copy.steps[def.key] : undefined;

  // Autoplay: move on a little after the step's simulation part completes.
  useEffect(() => {
    if (!autoplay || !complete || endCard) return;
    const id = window.setTimeout(nextStep, AUTOPLAY_READ_MS);
    return () => window.clearTimeout(id);
  }, [autoplay, complete, endCard, step, storyId]);

  // Keyboard: arrow keys step through the story.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previousStep();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!story || !copy || !def || !stepCopy) return null;
  const index = stories.indexOf(story);
  const nextStory = stories[index + 1];

  return (
    <section
      className={`guided${endCard ? ' is-end' : ''}`}
      aria-label={copy.title}
      data-testid="guided-panel"
      data-story={story.id}
      data-step={step + 1}
      data-complete={complete ? 'true' : 'false'}
    >
      <header className="guided-head">
        <button
          type="button"
          className="guided-picker"
          aria-expanded={listOpen}
          aria-controls="story-list"
          onClick={() => setListOpen((v) => !v)}
          data-testid="story-picker"
        >
          <span className="guided-kicker">{ui.guided.storyNumber(index + 1, stories.length)}</span>
          <strong>{copy.title}</strong>
          <span className="chevron" aria-hidden="true" />
        </button>
        {listOpen && (
          <ul className="story-list" id="story-list" aria-label={ui.guided.storyList}>
            {stories.map((s) => {
              const c = storyCopy[s.id];
              if (!c) return null;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={s.id === story.id ? 'true' : undefined}
                    onClick={() => {
                      setListOpen(false);
                      openStory(s.id);
                    }}
                    data-testid={`story-${s.id}`}
                  >
                    <strong>{c.title}</strong>
                    <span>{c.summary}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </header>

      {endCard ? (
        <div className="guided-card end-card" data-testid="end-card">
          <p className="guided-kicker">{ui.guided.takeaway}</p>
          <h2>{copy.takeaway}</h2>
          <div className="end-actions">
            <BookMeetingButton placement={`end_card_${story.id}`} />
            <button type="button" className="btn btn-secondary" onClick={() => setMode('sandbox')}>
              {ui.cta.exploreFreely}
            </button>
          </div>
          <div className="end-links">
            <button type="button" className="link-button" onClick={() => openStory(story.id)}>
              {ui.guided.replay}
            </button>
            {nextStory && storyCopy[nextStory.id] && (
              <button
                type="button"
                className="link-button"
                onClick={() => openStory(nextStory.id)}
                data-testid="next-story"
              >
                {ui.guided.nextStory(storyCopy[nextStory.id]?.title ?? '')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="guided-card" aria-live="polite">
          <p className="guided-kicker">
            {ui.guided.stepOf(step + 1, story.steps.length)}
            <span className={`step-state${complete ? ' is-ready' : ''}`}>
              {complete ? ui.guided.ready : ui.guided.running}
            </span>
          </p>
          <h2 data-testid="step-title">{stepCopy.title}</h2>
          <p className="guided-body">{stepCopy.body}</p>
          {stepUi.stopwatch && <Stopwatch />}
          {stepUi.claim && <ClaimNote id={stepUi.claim} />}
          {stepUi.compare && <ComparePanel />}
        </div>
      )}

      <nav className="guided-controls" aria-label={ui.guided.controls}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={previousStep}
          disabled={step === 0 && !endCard}
          data-testid="step-back"
        >
          {ui.guided.back}
        </button>
        {!endCard && (
          <button
            type="button"
            className={`btn ${complete ? 'btn-primary' : 'btn-secondary'}`}
            onClick={nextStep}
            data-testid="step-next"
          >
            {ui.guided.next}
          </button>
        )}
        {!endCard && (
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={autoplay}
            onClick={() => set({ autoplay: !autoplay })}
            data-testid="autoplay"
          >
            {autoplay ? ui.guided.pause : ui.guided.autoplay}
          </button>
        )}
        {!endCard && (
          <button type="button" className="btn btn-ghost" onClick={showEndCard} data-testid="skip">
            {ui.guided.skip}
          </button>
        )}
      </nav>
      <p className="visually-hidden">{ui.guided.keyboardHint}</p>
    </section>
  );
}

/** "Without RTLS" stopwatch: simulation time spent searching in this step (sped up on screen). */
function Stopwatch() {
  useSimTick(8);
  const elapsed = activePlayer()?.elapsed ?? 0;
  return (
    <p className="stopwatch" data-testid="stopwatch">
      <span>{ui.guided.withoutRtls}</span>
      <strong>{formatClock(elapsed)}</strong>
    </p>
  );
}

/** A content claim next to the narration. Unapproved claims show only for review, with a badge. */
function ClaimNote({ id }: { id: keyof typeof claims }) {
  const claim = claims[id];
  const approved: boolean = claim.approved;
  if (!approved && !claimsOverlayRequested()) return null;
  return (
    <blockquote className={`claim${approved ? '' : ' is-unapproved'}`} data-testid="claim">
      <p>{claim.text}</p>
      {!approved && <span className="claim-badge">{ui.guided.unapprovedClaim}</span>}
    </blockquote>
  );
}

/** H2: conventional versus BiLink infrastructure, counted from the devices in the scene. */
function ComparePanel() {
  const compare = useExperience((s) => s.compare);
  const scene = useExperience((s) => s.scene);
  const set = useExperience((s) => s.set);
  const counts = infrastructureCounts(baseWorld(scene))[compare];
  const rows: Array<[string, number]> = [
    [ui.compare.gateways, counts.gateways],
    [ui.compare.powered, counts.powered],
    [ui.compare.cables, counts.cables],
    [ui.compare.anchors, counts.anchors],
  ];
  return (
    <div className="compare" data-testid="compare">
      <div className="segmented" role="group" aria-label={ui.compare.title}>
        {(['conventional', 'bilink'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={compare === k}
            onClick={() => set({ compare: k })}
            data-testid={`compare-${k}`}
          >
            {ui.compare[k]}
          </button>
        ))}
      </div>
      <dl>
        {rows.map(([label, n]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd data-testid={`count-${label}`}>{n}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">{ui.compare.source}</p>
    </div>
  );
}
