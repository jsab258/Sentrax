import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import { assetUrl } from './app/assetUrl';
import { hasWebGL2 } from './app/webgl';
import { Fallback } from './app/Fallback';
import { BookMeetingButton } from './app/CtaButton';
import { claimsOverlayRequested, devToolsEnabled } from './app/devtools';
import { ui } from './content/ui';
import { brand } from './brand/brand';
import { observeContentHeight, postToParent } from './embed/bridge';

const SceneStage = lazy(() => import('./scene/SceneStage'));
const ClaimsOverlay = lazy(() => import('./dev/ClaimsOverlay').then((m) => ({ default: m.ClaimsOverlay })));
const BrandSheet = lazy(() => import('./dev/BrandSheet').then((m) => ({ default: m.BrandSheet })));
const SimDebugView = lazy(() => import('./dev/SimDebugView').then((m) => ({ default: m.SimDebugView })));

export function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const webgl = useMemo(() => hasWebGL2(), []);
  const query = new URLSearchParams(window.location.search);
  // Teaser mode (homepage embed): no header, the stage fills the frame.
  const teaser = query.get('mode') === 'teaser';
  const devView = devToolsEnabled
    ? (query.get('dev') ?? (query.get('debug') === 'sim' ? 'sim' : null))
    : null;

  useEffect(() => {
    // With WebGL2 the stage announces `ready` once the first scene has rendered (SceneStage).
    if (!webgl || devView) postToParent('ready', { webgl });
    return rootRef.current ? observeContentHeight(rootRef.current) : undefined;
  }, [webgl, devView]);

  return (
    <div className={`app${teaser ? ' is-teaser' : ''}`} ref={rootRef}>
      {!teaser && (
        <header className="topbar">
          {brand.logo.src ? (
            <img
              className="logo"
              src={assetUrl(brand.logo.src)}
              alt={brand.logo.alt}
              width={brand.logo.width}
              height={brand.logo.height}
            />
          ) : (
            <span className="wordmark">{ui.brandName}</span>
          )}
          <span className="topbar-title">{ui.appTitle}</span>
          <BookMeetingButton placement="topbar" />
        </header>
      )}

      {devView === 'brand' ? (
        <Suspense fallback={null}>
          <BrandSheet />
        </Suspense>
      ) : devView === 'sim' ? (
        <Suspense fallback={null}>
          <SimDebugView />
        </Suspense>
      ) : !webgl ? (
        <Fallback />
      ) : (
        <main className="stage">
          <Suspense fallback={<StageLoader />}>
            <SceneStage />
          </Suspense>
        </main>
      )}

      {claimsOverlayRequested() && (
        <Suspense fallback={null}>
          <ClaimsOverlay />
        </Suspense>
      )}
    </div>
  );
}

function StageLoader() {
  return (
    <div className="stage-loader" role="status" aria-live="polite">
      <img className="stage-poster" src={assetUrl('poster.svg')} alt="" />
      <span>{ui.loading.label}</span>
    </div>
  );
}
