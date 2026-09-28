import { devToolsEnabled, urlParam } from '../app/devtools';
import { activePlayer, activeSim, applyDeepLink } from '../experience/runtime';
import { useExperience } from '../experience/store';
import { parseDeepLink } from '../experience/url';
import { baseWorld } from '../experience/worlds';

let booted = false;

/**
 * Applies the page's deep link once, when the 3D stage first loads; ?device=<id> opens a device's
 * product card in explore mode. Dev tool: ?select=<tag id> selects a tag, for reproducible screenshots.
 */
export function bootExperience(): void {
  if (booted) return;
  booted = true;
  // Dev tool: a handle for diagnostics from the browser console and end-to-end tests.
  if (devToolsEnabled)
    (window as unknown as { __sentrax?: unknown }).__sentrax = { activeSim, activePlayer, useExperience };
  applyDeepLink(parseDeepLink(window.location.search));
  const scene = useExperience.getState().scene;
  // ?device=<id> in explore mode opens that device's product card (shareable).
  const device = urlParam('device');
  if (
    device &&
    useExperience.getState().mode === 'sandbox' &&
    baseWorld(scene).devices.some((d) => d.id === device)
  )
    useExperience.setState({ inspectDevice: device });
  const select = devToolsEnabled ? urlParam('select') : null;
  if (select && baseWorld(scene).tags.some((t) => t.id === select)) {
    useExperience.setState({ selectedTag: select });
  }
}
