import { ui } from '../content/ui';
import { setLens, setMode, setScene } from '../experience/runtime';
import { useExperience } from '../experience/store';
import { LAYER_KEYS, LENSES, type Lens, type SceneKey } from '../experience/types';
import { sceneAvailable } from '../experience/worlds';

const SCENES: SceneKey[] = ['hospital', 'warehouse'];

/** Scene switcher and mode toggle (SPEC section 4). */
export function SceneBar() {
  const scene = useExperience((s) => s.scene);
  const mode = useExperience((s) => s.mode);
  return (
    <div className="scene-bar">
      <div className="segmented" role="group" aria-label={ui.scenes.label}>
        {SCENES.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={scene === k}
            disabled={!sceneAvailable(k)}
            onClick={() => setScene(k)}
            data-testid={`scene-${k}`}
          >
            {ui.scenes[k]}
          </button>
        ))}
      </div>
      <div className="segmented" role="group" aria-label={ui.modes.label}>
        {(['guided', 'sandbox'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            data-testid={`mode-${m}`}
          >
            {ui.modes[m]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Layer toggles and the technology lens (SPEC section 5). */
export function LayerToolbar() {
  const layers = useExperience((s) => s.layers);
  const lens = useExperience((s) => s.lens);
  const scene = useExperience((s) => s.scene);
  const toggleLayer = useExperience((s) => s.toggleLayer);
  const note = lens === 'rssi' && scene === 'hospital' ? ui.lens.notes.rssiHospital : ui.lens.notes[lens];
  return (
    <div className="layer-toolbar">
      <div className="chips" role="group" aria-label={ui.layers.title}>
        {LAYER_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`chip chip-${k}`}
            aria-pressed={layers[k]}
            onClick={() => toggleLayer(k)}
            data-testid={`layer-${k}`}
          >
            {ui.layers[k]}
          </button>
        ))}
      </div>
      {(layers.radio || lens !== 'hybrid') && (
        <div className="lens">
          <label>
            <span>{ui.lens.title}</span>
            <select value={lens} onChange={(e) => setLens(e.target.value as Lens)} data-testid="lens-select">
              {LENSES.map((l) => (
                <option key={l} value={l}>
                  {ui.lens.names[l]}
                </option>
              ))}
            </select>
          </label>
          <p className="lens-note" data-testid="lens-note">
            {note}
          </p>
        </div>
      )}
    </div>
  );
}
