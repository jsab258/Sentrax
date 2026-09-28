import type { Simulation } from '../sim/engine';
import { createPrerolledSimulation } from '../sim/prewarm';
import { track } from '../analytics/track';
import { postToParent } from '../embed/bridge';
import { alertFeed } from './alertFeed';
import { attachIntegrationLog } from './integrationLog';
import { useExperience } from './store';
import { StoryPlayer } from './storyPlayer';
import { storyById, storiesByScene } from './stories';
import { DEFAULT_LAYERS, type Mode, type SceneKey } from './types';
import { replaceUrl, type DeepLink } from './url';
import { baseWorld } from './worlds';

/**
 * Owns the active simulation: a StoryPlayer in guided mode, the free-running scene simulation in sandbox
 * mode. Kept outside React so replacing a simulation never re-renders the tree; components read
 * `activeSim()` and re-subscribe when `simVersion` changes.
 */

const SANDBOX_SEEDS: Record<SceneKey, number> = { hospital: 1101, warehouse: 2201 };
const sandboxSims = new Map<SceneKey, Simulation>();
let player: StoryPlayer | null = null;

function sandboxSim(scene: SceneKey): Simulation {
  let sim = sandboxSims.get(scene);
  if (!sim) {
    sim = createPrerolledSimulation(baseWorld(scene), { seed: SANDBOX_SEEDS[scene] });
    sandboxSims.set(scene, sim);
    alertFeed(sim);
    attachIntegrationLog(sim, baseWorld(scene), () => {
      const s = useExperience.getState();
      return s.layers.data && s.selectedTag ? [s.selectedTag] : [];
    });
  }
  return sim;
}

/**
 * Tags whose room changes SOLIX forwards to the integration cards: the step's focus tags, in steps that
 * show the Data layer (alerts are always forwarded).
 */
export function forwardedTags(p: StoryPlayer): readonly string[] {
  if (p.index < 0 || !p.step.layers?.data) return [];
  return p.step.focus ?? [];
}

export function activeSim(): Simulation {
  const s = useExperience.getState();
  if (s.mode !== 'sandbox' && player) return player.sim;
  return sandboxSim(s.scene);
}

export function activePlayer(): StoryPlayer | null {
  return player;
}

function syncUrl() {
  const s = useExperience.getState();
  const link: DeepLink = {
    mode: s.mode,
    scene: s.scene,
    story: s.storyId,
    step: s.step,
    layers: s.mode === 'sandbox' ? s.layers : null,
    lens: s.mode === 'sandbox' || s.lens !== 'hybrid' ? s.lens : null,
  };
  replaceUrl(link);
}

function applyStep(bump: boolean) {
  if (!player) return;
  const step = player.step;
  const prev = useExperience.getState();
  useExperience.setState({
    storyId: player.story.id,
    step: player.index,
    endCard: false,
    stepComplete: false,
    layers: { ...DEFAULT_LAYERS, ...step.layers },
    lens: step.lens ?? 'hybrid',
    focus: step.focus ?? [],
    highlight: step.highlight ?? [],
    stepUi: step.ui ?? {},
    heatmap: step.ui?.heatmap ?? false,
    compare: 'bilink',
    simVersion: bump ? prev.simVersion + 1 : prev.simVersion,
  });
  syncUrl();
  track('story_step', { story: player.story.id, step: player.index + 1 });
}

/** Opens a story at a step (zero-based), replaying earlier steps instantly. */
export function openStory(storyId: string, step = 0): void {
  const story = storyById(storyId);
  if (!story) return;
  player?.dispose();
  const p = new StoryPlayer(story, baseWorld(story.scene));
  // Dashboard alerts and integration cards record the replayed steps too.
  alertFeed(p.sim);
  attachIntegrationLog(p.sim, baseWorld(story.scene), () => forwardedTags(p));
  p.seek(step);
  player = p;
  useExperience.setState({ mode: 'guided', scene: story.scene });
  if (step === 0) track('story_started', { story: story.id });
  applyStep(true);
}

export function nextStep(): void {
  if (!player) return;
  // The next step starts from the state this step ends in, exactly as in the story tests.
  player.finish();
  if (player.index + 1 >= player.story.steps.length) {
    showEndCard();
    return;
  }
  player.enter(player.index + 1);
  applyStep(false);
}

export function previousStep(): void {
  const s = useExperience.getState();
  if (!player) return;
  if (s.endCard) {
    useExperience.setState({ endCard: false });
    return;
  }
  if (player.index === 0) return;
  openStory(player.story.id, player.index - 1);
}

export function showEndCard(): void {
  if (!player) return;
  player.finish();
  useExperience.setState({ endCard: true, autoplay: false });
  track('story_completed', { story: player.story.id });
  postToParent('story_complete', { story: player.story.id });
}

export function closeStory(): void {
  player?.dispose();
  player = null;
  const s = useExperience.getState();
  useExperience.setState({
    storyId: null,
    step: 0,
    endCard: false,
    focus: [],
    highlight: [],
    stepUi: {},
    layers: { ...DEFAULT_LAYERS },
    lens: 'hybrid',
    simVersion: s.simVersion + 1,
  });
  syncUrl();
}

export function setMode(mode: Mode): void {
  const s = useExperience.getState();
  if (mode === 'sandbox') {
    player?.dispose();
    player = null;
    useExperience.setState({
      mode,
      storyId: null,
      endCard: false,
      focus: [],
      highlight: [],
      stepUi: {},
      layers: { physical: true, radio: true, data: false, insight: true },
      simVersion: s.simVersion + 1,
    });
    track('sandbox_opened', { scene: s.scene });
  } else {
    useExperience.setState({ mode });
  }
  syncUrl();
}

export function setScene(scene: SceneKey): void {
  const s = useExperience.getState();
  if (s.scene === scene) return;
  player?.dispose();
  player = null;
  useExperience.setState({
    scene,
    storyId: null,
    endCard: false,
    focus: [],
    highlight: [],
    stepUi: {},
    simVersion: s.simVersion + 1,
  });
  track('scene_opened', { scene });
  syncUrl();
  if (s.mode === 'guided') {
    const first = storiesByScene[scene][0];
    if (first) openStory(first.id);
  }
}

/** Advances the active simulation by real time; returns the interpolation factor. */
export function tickRuntime(realSeconds: number, userSpeed: number): number {
  const s = useExperience.getState();
  if (s.mode !== 'sandbox' && player) {
    const alpha = player.tick(realSeconds, userSpeed);
    const complete = player.complete;
    if (complete !== s.stepComplete) useExperience.setState({ stepComplete: complete });
    return alpha;
  }
  return sandboxSim(s.scene).advance(realSeconds * userSpeed);
}

/** Applies a deep link on load. */
export function applyDeepLink(link: DeepLink): void {
  useExperience.setState({ mode: link.mode, scene: link.scene });
  if (link.mode === 'sandbox') {
    setMode('sandbox');
    useExperience.setState({
      layers: link.layers ?? useExperience.getState().layers,
      lens: link.lens ?? 'hybrid',
    });
    syncUrl();
    return;
  }
  const story = storyById(link.story) ?? storiesByScene[link.scene][0];
  if (story && link.mode === 'guided') openStory(story.id, link.step);
  if (link.lens || link.layers) {
    useExperience.setState({
      ...(link.lens ? { lens: link.lens } : {}),
      ...(link.layers ? { layers: link.layers } : {}),
    });
  }
  track('scene_opened', { scene: link.scene });
}

export function setLens(lens: DeepLink['lens'] & string): void {
  useExperience.setState({ lens });
  track('lens_changed', { lens });
  syncUrl();
}
