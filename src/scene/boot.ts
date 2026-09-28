import { devToolsEnabled, urlParam } from '../app/devtools';
import { applyDeepLink } from '../experience/runtime';
import { useExperience } from '../experience/store';
import { parseDeepLink } from '../experience/url';
import { baseWorld } from '../experience/worlds';

let booted = false;

/**
 * Applies the page's deep link once, when the 3D stage first loads. Dev tool: ?select=<tag id> selects a
 * tag in explore mode, for reproducible review screenshots.
 */
export function bootExperience(): void {
  if (booted) return;
  booted = true;
  applyDeepLink(parseDeepLink(window.location.search));
  const select = devToolsEnabled ? urlParam('select') : null;
  const scene = useExperience.getState().scene;
  if (select && baseWorld(scene).tags.some((t) => t.id === select)) {
    useExperience.setState({ selectedTag: select });
  }
}
