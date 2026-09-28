import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { postToParent } from '../embed/bridge';
import { prefersReducedMotion } from '../app/motion';
import { useExperience } from '../experience/store';
import { useActiveSim } from '../experience/useActiveSim';
import { baseWorld } from '../experience/worlds';
import { devToolsEnabled, statsRequested, urlParam } from '../app/devtools';
import { ui } from '../content/ui';
import { SwatchPanel } from '../dev/SwatchPanel';
import { Dashboard } from '../ui/Dashboard';
import { CreditsButton } from '../ui/CreditsPanel';
import { DeviceCard } from '../ui/DeviceCard';
import { GuidedPanel } from '../ui/GuidedPanel';
import { SandboxPanel } from '../ui/SandboxPanel';
import { TeaserOverlay } from '../ui/TeaserOverlay';
import { LabelLayer } from '../ui/LabelLayer';
import { LayerToolbar, SceneBar } from '../ui/StageToolbar';
import { useStageInsets } from '../ui/useStageInsets';
import { useStageVisibility } from '../ui/useStageVisibility';
import { bootExperience } from './boot';
import { QualityMenu, SceneLoader, StatsHud } from './SceneOverlay';
import { useSceneStore } from './store';

/** Dev tool: ?swatches=1 shows the overlay colour sheet and strip, ?swatches=strip the strip only. */
function swatchesRequested(): 'sheet' | 'strip' | null {
  if (!devToolsEnabled) return null;
  const v = urlParam('swatches');
  return v === '1' ? 'sheet' : v === 'strip' ? 'strip' : null;
}

bootExperience();

let announced = false;

// Each scene is its own chunk, loaded when the visitor first opens it (SPEC section 11).
const HospitalScene = lazy(() => import('./hospital/HospitalScene'));
const WarehouseScene = lazy(() => import('./warehouse/WarehouseScene'));

/** The 3D stage (lazy chunk): canvas, labels, guided UI, dashboard, simulated-data label and menus. */
export default function SceneStage() {
  const ready = useSceneStore((s) => s.ready);
  const mode = useExperience((s) => s.mode);
  const scene = useExperience((s) => s.scene);
  const insight = useExperience((s) => s.layers.insight);
  const sim = useActiveSim();
  const swatches = swatchesRequested();
  const ref = useRef<HTMLDivElement>(null);
  useStageInsets(ref);
  useStageVisibility(ref);
  const teaser = mode === 'teaser';
  const dashboard = insight && !teaser;
  // A new scene shows its loading poster until its first frame.
  useLayoutEffect(() => useSceneStore.getState().setReady(false), [scene]);
  // Tells an embedding page the demo is interactive, once, after the first scene's first frame.
  useEffect(() => {
    if (!ready || announced) return;
    announced = true;
    postToParent('ready', { webgl: true, scene, mode });
  }, [ready, scene, mode]);
  return (
    <div
      ref={ref}
      className={`stage-inner${dashboard ? ' has-dashboard' : ''}${teaser ? ' is-teaser' : ''}`}
      data-testid="scene-stage"
      data-ready={ready ? 'true' : 'false'}
      data-mode={mode}
      data-scene={scene}
      data-motion={prefersReducedMotion() ? 'reduced' : 'full'}
    >
      <Suspense fallback={null}>
        {scene === 'warehouse' ? (
          <WarehouseScene key="warehouse" />
        ) : (
          <HospitalScene key="hospital" swatches={swatches !== null} />
        )}
      </Suspense>
      <LabelLayer />
      {!ready && <SceneLoader />}
      {!teaser && (
        <div className="stage-top">
          <SceneBar />
          <LayerToolbar />
        </div>
      )}
      <div className="stage-meta">
        {!teaser && <CreditsButton />}
        <p className="stage-badge">{ui.simulatedData}</p>
        {!teaser && <QualityMenu />}
      </div>
      {mode === 'guided' && <GuidedPanel />}
      {mode === 'sandbox' && <SandboxPanel />}
      {teaser && <TeaserOverlay />}
      {!teaser && <DeviceCard />}
      {dashboard && <Dashboard sim={sim} world={baseWorld(scene)} />}
      {statsRequested() && <StatsHud />}
      {swatches === 'sheet' && <SwatchPanel />}
    </div>
  );
}
