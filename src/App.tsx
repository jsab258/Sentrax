import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import { hasWebGL2 } from './app/webgl';
import { Fallback } from './app/Fallback';
import { BookMeetingButton } from './app/CtaButton';
import { devToolsEnabled } from './app/devtools';
import { ui } from './content/ui';
import { brand } from './brand/brand';
import { observeContentHeight, postToParent } from './embed/bridge';

const PlaceholderStage = lazy(() => import('./app/PlaceholderStage'));
const ClaimsOverlay = lazy(() => import('./dev/ClaimsOverlay').then((m) => ({ default: m.ClaimsOverlay })));
const BrandSheet = lazy(() => import('./dev/BrandSheet').then((m) => ({ default: m.BrandSheet })));

export function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const webgl = useMemo(() => hasWebGL2(), []);
  const devView = devToolsEnabled ? new URLSearchParams(window.location.search).get('dev') : null;

  useEffect(() => {
    postToParent('ready');
    return rootRef.current ? observeContentHeight(rootRef.current) : undefined;
  }, []);

  return (
    <div className="app" ref={rootRef}>
      <header className="topbar">
        {brand.logo.src ? (
          <img
            className="logo"
            src={brand.logo.src}
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

      {devView === 'brand' ? (
        <Suspense fallback={null}>
          <BrandSheet />
        </Suspense>
      ) : !webgl ? (
        <Fallback />
      ) : (
        <main className="stage">
          <Suspense fallback={<StageLoader />}>
            <PlaceholderStage />
          </Suspense>
          <div className="stage-card" role="note">
            <h1>{ui.placeholderStage.title}</h1>
            <p>{ui.placeholderStage.body}</p>
          </div>
        </main>
      )}

      {devToolsEnabled && (
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
      <img className="stage-poster" src="./poster.svg" alt="" />
      <span>{ui.loading.label}</span>
    </div>
  );
}
