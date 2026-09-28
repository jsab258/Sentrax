import { useProgress } from '@react-three/drei';
import { assetUrl } from '../app/assetUrl';
import { ui } from '../content/ui';
import type { QualityTier } from './quality';
import { useRenderStats } from './stats';
import { useSceneStore } from './store';

/** Poster and progress until the first complete frame has rendered. */
export function SceneLoader() {
  const { progress } = useProgress();
  return (
    <div className="stage-loader" role="status" aria-live="polite" data-testid="scene-loader">
      <img className="stage-poster" src={assetUrl('poster.svg')} alt="" />
      <div className="stage-progress">
        <span>{ui.loading.label}</span>
        <progress max={100} value={progress} aria-label={ui.loading.percent(progress)} />
      </div>
    </div>
  );
}

const TIER_OPTIONS: Array<{ value: QualityTier | 'auto'; label: string }> = [
  { value: 'auto', label: ui.quality.auto },
  { value: 'high', label: ui.quality.high },
  { value: 'medium', label: ui.quality.medium },
  { value: 'low', label: ui.quality.low },
];

export function QualityMenu() {
  const override = useSceneStore((s) => s.override);
  const detected = useSceneStore((s) => s.detected);
  const setOverride = useSceneStore((s) => s.setOverride);
  return (
    <label className="stage-quality">
      <span>{ui.quality.label}</span>
      <select
        value={override ?? 'auto'}
        onChange={(e) => setOverride(e.target.value === 'auto' ? null : (e.target.value as QualityTier))}
        data-testid="quality-select"
      >
        {TIER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value === 'auto' ? `${o.label} (${ui.quality[detected]})` : o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Dev HUD: frame rate, draw calls and triangles (?stats=1, or always in development). */
export function StatsHud() {
  const s = useRenderStats();
  const tier = useSceneStore((st) => st.tier);
  return (
    <div className="stage-stats" data-testid="stats-hud" aria-hidden="true">
      <span>{s.fps.toFixed(0)} fps</span>
      <span>{s.calls} calls</span>
      <span>{(s.triangles / 1000).toFixed(0)}k tris</span>
      <span>{s.scriptMs.toFixed(2)} ms js</span>
      <span>{tier}</span>
    </div>
  );
}
