import { tagName } from '../content/alerts';
import { ui } from '../content/ui';
import { activeSim, requestCamera, resetSandbox } from '../experience/runtime';
import { useExperience } from '../experience/store';
import { cameraPresets, triggers } from '../experience/triggers';
import { baseWorld } from '../experience/worlds';
import { useSceneStore } from '../scene/store';

const SPEEDS = [1, 4];

/**
 * Explore mode (SPEC section 4): time controls, camera presets per zone, event triggers, and a hint for
 * dragging tagged people and equipment and opening device product cards.
 */
export function SandboxPanel() {
  const scene = useExperience((s) => s.scene);
  const selected = useExperience((s) => s.selectedTag);
  const set = useExperience((s) => s.set);
  const speed = useSceneStore((s) => s.speed);
  const setSpeed = useSceneStore((s) => s.setSpeed);
  const world = baseWorld(scene);
  return (
    <section className="sandbox" aria-label={ui.sandbox.title} data-testid="sandbox-panel">
      <div className="sandbox-row" role="group" aria-label={ui.sandbox.time}>
        <span className="guided-kicker">{ui.sandbox.time}</span>
        <div className="segmented">
          <button
            type="button"
            aria-pressed={speed === 0}
            onClick={() => setSpeed(speed === 0 ? 1 : 0)}
            data-testid="time-pause"
          >
            {speed === 0 ? ui.sandbox.play : ui.sandbox.pause}
          </button>
          {SPEEDS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={speed === n}
              onClick={() => setSpeed(n)}
              data-testid={`time-${n}x`}
            >
              {ui.sandbox.speed(n)}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" onClick={resetSandbox} data-testid="time-reset">
          {ui.sandbox.reset}
        </button>
      </div>

      <div className="sandbox-block">
        <span className="guided-kicker">{ui.sandbox.presets}</span>
        <div className="chips">
          {cameraPresets[scene].map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip chip-plain"
              onClick={() => requestCamera(p.shot)}
              data-testid={`preset-${p.id}`}
            >
              {ui.sandbox.presetNames[p.id] ?? p.id}
            </button>
          ))}
        </div>
      </div>

      <div className="sandbox-block">
        <span className="guided-kicker">{ui.sandbox.events}</span>
        <div className="sandbox-triggers">
          {triggers[scene].map((t) => (
            <button
              key={t.id}
              type="button"
              className="btn btn-secondary"
              onClick={() => t.run(activeSim())}
              data-testid={`trigger-${t.id}`}
            >
              {ui.sandbox.triggerNames[t.id] ?? t.id}
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <p className="sandbox-following">
          {ui.sandbox.following}: <strong>{tagName(world, selected)}</strong>{' '}
          <button type="button" className="link-button" onClick={() => set({ selectedTag: null })}>
            {ui.sandbox.clear}
          </button>
        </p>
      ) : (
        <p className="muted">{ui.sandbox.hint}</p>
      )}
    </section>
  );
}
