/**
 * Dev tools (claims overlay, ?dev=sim, ?dev=brand, ?swatches, ?cam) are reachable in the dev server and in
 * builds made with VITE_ENABLE_DEV_TOOLS=true (the online preview). Outside the dev server they only show
 * when their URL parameter is set (DECISIONS.md 75).
 */
export const devToolsEnabled: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';

/** The dev server shows the claims button and the stats HUD without being asked. */
export const devToolsShownByDefault: boolean = import.meta.env.DEV;

export function urlParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

/** Claims overlay: always in the dev server, elsewhere only with ?claims. */
export function claimsOverlayRequested(): boolean {
  return devToolsEnabled && (devToolsShownByDefault || urlParam('claims') !== null);
}

/** Stats HUD: ?stats=1 in any build; on by default in the dev server (?stats=0 hides it). */
export function statsRequested(): boolean {
  const q = urlParam('stats');
  return q === '1' || (devToolsShownByDefault && q !== '0');
}
