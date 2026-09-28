import { create } from 'zustand';
import {
  DEFAULT_LAYERS,
  type CameraShot,
  type LayerKey,
  type LayerState,
  type Lens,
  type Mode,
  type SceneKey,
  type StepUi,
} from './types';

/** Everything the UI and the 3D layers need to know about where the visitor is in the experience. */
export interface ExperienceState {
  mode: Mode;
  scene: SceneKey;
  storyId: string | null;
  step: number;
  /** The story's end card is showing. */
  endCard: boolean;
  /** The current step's simulation part has finished. */
  stepComplete: boolean;
  autoplay: boolean;
  layers: LayerState;
  lens: Lens;
  /** Tags whose technology visuals and labels are shown. */
  focus: string[];
  /** Assets, tags or devices drawn with a halo. */
  highlight: string[];
  stepUi: StepUi;
  /** Sandbox selection (a tag id). */
  selectedTag: string | null;
  /** H2 infrastructure comparison. */
  compare: 'bilink' | 'conventional';
  /** Dwell heatmap on the floor (Insight). */
  heatmap: boolean;
  /** Bumped whenever the active simulation is replaced (new story, back, scene change). */
  simVersion: number;
  /** Explore mode: the device whose product card is open. */
  inspectDevice: string | null;
  /** A camera move requested by the UI (presets); the nonce makes repeated requests fly again. */
  cameraRequest: { shot: CameraShot; nonce: number } | null;
  set: (patch: Partial<ExperienceState>) => void;
  toggleLayer: (k: LayerKey) => void;
}

export const useExperience = create<ExperienceState>((set) => ({
  mode: 'guided',
  scene: 'hospital',
  storyId: null,
  step: 0,
  endCard: false,
  stepComplete: false,
  autoplay: false,
  layers: { ...DEFAULT_LAYERS },
  lens: 'hybrid',
  focus: [],
  highlight: [],
  stepUi: {},
  selectedTag: null,
  compare: 'bilink',
  heatmap: false,
  simVersion: 0,
  inspectDevice: null,
  cameraRequest: null,
  set: (patch) => set(patch),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
}));
