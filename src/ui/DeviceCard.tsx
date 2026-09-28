import { useEffect } from 'react';
import { track } from '../analytics/track';
import { assetUrl } from '../app/assetUrl';
import { devices } from '../content/devices';
import { ui } from '../content/ui';
import { useExperience } from '../experience/store';
import { baseWorld } from '../experience/worlds';

/** Product photo path for a model, for example public/devices/zenix-len-2.webp. */
function devicePhoto(model: string): string {
  return assetUrl(`devices/${model.toLowerCase().replace(/\s+/g, '-')}.webp`);
}

/**
 * Product card for a clicked device (SPEC section 4): photo, the one-line description from the site, its
 * role in this scene and a link to the product page. Never datasheet figures (DECISIONS 54).
 */
export function DeviceCard() {
  const id = useExperience((s) => s.inspectDevice);
  const scene = useExperience((s) => s.scene);
  const set = useExperience((s) => s.set);
  const def = id ? baseWorld(scene).devices.find((d) => d.id === id) : undefined;
  const spec = def ? devices[def.model] : undefined;

  useEffect(() => {
    if (!spec) return;
    track('device_inspected', { model: spec.model, scene });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') set({ inspectDevice: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spec, scene, set]);

  if (!spec) return null;
  const roles: Partial<Record<string, string>> = spec.roles;
  const role = roles[scene];
  return (
    <aside className="device-card" aria-label={spec.model} data-testid="device-card" data-model={spec.model}>
      <button
        type="button"
        className="device-card-close"
        aria-label={ui.deviceCard.close}
        onClick={() => set({ inspectDevice: null })}
      >
        <span aria-hidden="true">×</span>
      </button>
      <img src={devicePhoto(spec.model)} alt={ui.deviceCard.photoAlt(spec.model)} width={120} height={120} />
      <div>
        <h2>{spec.model}</h2>
        <p>{spec.description.text}</p>
        {role && (
          <p className="device-role">
            <span className="guided-kicker">{ui.deviceCard.inScene}</span>
            {role}
          </p>
        )}
        <a
          className="btn btn-secondary"
          href={spec.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="device-product-link"
        >
          {ui.deviceCard.viewProduct}
          <span className="visually-hidden"> ({ui.cta.newTabHint})</span>
        </a>
      </div>
    </aside>
  );
}
