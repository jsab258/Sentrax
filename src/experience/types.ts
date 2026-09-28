import type { ClaimId } from '../content/claims';
import type { Simulation } from '../sim/engine';
import type { SimEvent } from '../sim/events';
import type { WorldDef } from '../sim/world';

export type Mode = 'guided' | 'sandbox' | 'teaser';
export type SceneKey = 'hospital' | 'warehouse';
export type LayerKey = 'physical' | 'radio' | 'data' | 'insight';
export type LayerState = Record<LayerKey, boolean>;
export type Lens = 'hybrid' | 'rssi' | 'aoa' | 'bilink';

export const LAYER_KEYS: LayerKey[] = ['physical', 'radio', 'data', 'insight'];
export const LENSES: Lens[] = ['hybrid', 'rssi', 'aoa', 'bilink'];
export const DEFAULT_LAYERS: LayerState = { physical: true, radio: false, data: false, insight: false };

/** Camera framing: a zone preset, or an explicit target in plan coordinates (x, y, height). */
export interface CameraShot {
  zone?: string;
  /** Several zones framed together. */
  zones?: string[];
  target?: [number, number, number];
  distance?: number;
  azimuth?: number;
  polar?: number;
  /** Also frame the network plane (steps about data flowing to SOLIX and the integration cards). */
  network?: boolean;
}

/** Extra UI a step shows alongside the narration. */
export interface StepUi {
  /** "Without RTLS" stopwatch counting simulation time in this step. */
  stopwatch?: boolean;
  /** A content claim shown with the narration (unapproved claims only where dev tools are enabled). */
  claim?: ClaimId;
  /** Dashboard search query typed for the visitor. */
  search?: string;
  /** Live temperature chart for a sensor tag. */
  chart?: { tagId: string };
  /** Conventional versus BiLink infrastructure comparison. */
  compare?: boolean;
  /** Dashboard hint: nearest available asset of a class for a zone. */
  nearest?: { cls: string; zoneId: string };
  /** Dashboard panel section to bring forward. */
  panel?: 'assets' | 'alerts';
  /** Mark the rack slot the system reports for this asset (warehouse W1). */
  slot?: string;
  /** Dashboard: work in progress and dwell per station (W3). */
  stations?: boolean;
  /** Switch the dwell heatmap on for this step (W3). */
  heatmap?: boolean;
  /** Dashboard: live muster count and missing people (W4). */
  muster?: boolean;
}

export interface StepUntil {
  /** The step's simulation part is done when this event arrives (then `plusS` more seconds run). */
  event?: (e: SimEvent) => boolean;
  /** Or when this state check passes. */
  check?: (sim: Simulation) => boolean;
  plusS?: number;
  /** Never shorter than this (s of simulation time). */
  minS?: number;
  /** Safety limit (s of simulation time). */
  maxS: number;
}

export interface StoryStep {
  /** Content key in src/content/stories.ts. */
  key: string;
  camera: CameraShot;
  layers?: Partial<LayerState>;
  lens?: Lens;
  /** Tags whose technology visuals and labels the step shows. */
  focus?: string[];
  /** Assets, tags or devices to highlight with a halo. */
  highlight?: string[];
  /** Simulation speed during the step (sped-up searches and waits). */
  speed?: number;
  /**
   * Commands at the start of the step. It may subscribe to the bus and return the unsubscribe function;
   * any other return value is ignored.
   */
  enter?: (sim: Simulation) => unknown;
  until: StepUntil;
  ui?: StepUi;
}

export interface StoryDef {
  id: string;
  scene: SceneKey;
  /** Fixed seed: every visitor and every test sees the same run. */
  seed: number;
  /** Starting state (agent positions, routines) applied before the 30 s pre-roll. */
  world: (base: WorldDef) => WorldDef;
  steps: StoryStep[];
  /** Teaser version (?mode=teaser): a shortened loop of this story; its copy lives under `copyOf`. */
  teaser?: boolean;
  /** Content key in src/content/stories.ts, when it differs from the id. */
  copyOf?: string;
}
