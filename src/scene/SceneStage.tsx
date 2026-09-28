import { devToolsEnabled, statsRequested, urlParam } from '../app/devtools';
import { ui } from '../content/ui';
import { SwatchPanel } from '../dev/SwatchPanel';
import HospitalScene from './hospital/HospitalScene';
import { QualityMenu, SceneLoader, StatsHud } from './SceneOverlay';
import { useSceneStore } from './store';

/** Dev tool: ?swatches=1 shows the overlay colour sheet and strip, ?swatches=strip the strip only. */
function swatchesRequested(): 'sheet' | 'strip' | null {
  if (!devToolsEnabled) return null;
  const v = urlParam('swatches');
  return v === '1' ? 'sheet' : v === 'strip' ? 'strip' : null;
}

/** The 3D stage (lazy chunk): canvas, loading poster, simulated-data label and quality menu. */
export default function SceneStage() {
  const ready = useSceneStore((s) => s.ready);
  const swatches = swatchesRequested();
  return (
    <div className="stage-inner" data-testid="scene-stage" data-ready={ready ? 'true' : 'false'}>
      <HospitalScene swatches={swatches !== null} />
      {!ready && <SceneLoader />}
      <p className="stage-badge">{ui.simulatedData}</p>
      <div className="stage-controls">
        <QualityMenu />
      </div>
      {statsRequested() && <StatsHud />}
      {swatches === 'sheet' && <SwatchPanel />}
    </div>
  );
}
