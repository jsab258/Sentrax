import {
  DEFAULT_LAYERS,
  LAYER_KEYS,
  LENSES,
  type LayerState,
  type Lens,
  type Mode,
  type SceneKey,
} from './types';

/**
 * Deep links (SPEC section 4): mode, scene, story, step, layers and lens live in the URL and stay in sync
 * through history.replaceState. Other parameters (quality, stats, dev tools) are left untouched.
 */
export interface DeepLink {
  mode: Mode;
  scene: SceneKey;
  story: string | null;
  /** Zero-based step index (the URL shows one-based). */
  step: number;
  layers: LayerState | null;
  lens: Lens | null;
}

const MODES: Mode[] = ['guided', 'sandbox', 'teaser'];
const SCENES: SceneKey[] = ['hospital', 'warehouse'];

export function parseDeepLink(search: string): DeepLink {
  const q = new URLSearchParams(search);
  const mode = MODES.find((m) => m === q.get('mode')) ?? 'guided';
  const scene = SCENES.find((s) => s === q.get('scene')) ?? 'hospital';
  const story = q.get('story')?.toLowerCase() ?? null;
  const stepN = Number(q.get('step'));
  const layersParam = q.get('layers');
  let layers: LayerState | null = null;
  if (layersParam !== null) {
    const on = new Set(layersParam.split(',').map((s) => s.trim().toLowerCase()));
    layers = { ...DEFAULT_LAYERS };
    for (const k of LAYER_KEYS) layers[k] = on.has(k);
    // The building never disappears; "physical" only controls furniture, equipment and people.
    if (!on.size) layers = { ...DEFAULT_LAYERS };
  }
  const lens = LENSES.find((l) => l === q.get('lens')) ?? null;
  return {
    mode,
    scene,
    story,
    step: Number.isFinite(stepN) && stepN >= 1 ? Math.floor(stepN) - 1 : 0,
    layers,
    lens,
  };
}

export function serializeDeepLink(link: DeepLink, search: string): string {
  const q = new URLSearchParams(search);
  const set = (k: string, v: string | null) => (v === null ? q.delete(k) : q.set(k, v));
  set('mode', link.mode === 'guided' ? null : link.mode);
  set('scene', link.scene);
  set('story', link.mode === 'guided' ? link.story : null);
  set('step', link.mode === 'guided' && link.story ? String(link.step + 1) : null);
  set('layers', link.layers ? LAYER_KEYS.filter((k) => link.layers?.[k]).join(',') : null);
  set('lens', link.lens);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Replaces the current URL's deep-link parameters without adding a history entry. */
export function replaceUrl(link: DeepLink): void {
  try {
    const next = serializeDeepLink(link, window.location.search);
    if (next !== window.location.search) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${next}${window.location.hash}`,
      );
    }
  } catch {
    // Sandboxed iframes may refuse history changes; the demo keeps working without them.
  }
}
