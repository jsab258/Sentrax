import type { WorldDef } from '../../sim/world';

/**
 * Scroll stories are data (SCROLL-SPEC.md section 5): beats with copy, camera keyframes, the recorded
 * timeline range they scrub, highlights, effects and the tap action. A new story only needs a new file in
 * src/scroll/stories and an entry in stories/index.ts.
 */

/** Plan coordinates: x east, y north, z height above the floor (metres), as in the world data. */
export type PlanPoint = [number, number, number];

export interface CameraPose {
  position: PlanPoint;
  target: PlanPoint;
  /** Vertical field of view (degrees). */
  fov?: number;
  /** Depth of field amount for close-ups: 0 sharp everywhere, 1 strong background blur. */
  blur?: number;
}

export interface CameraKey {
  /** Position within the beat, 0 to 1. */
  at: number;
  landscape: CameraPose;
  /** Framing for tall (phone) viewports; derived from the landscape pose when absent. */
  portrait?: CameraPose;
}

/** Draft copy: every line stays unapproved until the Sentrax team signs it off (SPEC.md section 3). */
export interface Copy {
  headline: string;
  body: string;
  approved: false;
}

/** One visual effect of a beat, active between `from` and `to` (beat-local, 0 to 1). */
export type EffectCue =
  /** A tag lights up and emits pulse rings. */
  | { kind: 'tagPulse'; tagId: string; from: number; to: number }
  /** Room volumes fill with light one after another, with their anchors pulsing. */
  | { kind: 'rooms'; rooms: string[]; from: number; to: number }
  /** A tag no room claims (in the corridor outside a door), shown subtly. */
  | { kind: 'unassigned'; tagId: string; from: number; to: number }
  /** Light arcs from room anchors to their corridor gateways. */
  | { kind: 'relays'; anchors: string[]; from: number; to: number }
  /** A particle data stream from the gateways up to the SOLIX node above the building. */
  | { kind: 'stream'; from: number; to: number }
  /** A person turns to look around (the nurse at the station). */
  | { kind: 'lookAround'; agentId: string; from: number; to: number };

export interface Beat {
  id: string;
  /** Share of the scroll track (relative to the other beats). */
  span: number;
  /** Recorded simulation seconds this beat scrubs through. */
  timeline: [number, number];
  copy: Copy;
  camera: CameraKey[];
  effects: EffectCue[];
}

/** The final beat's tap: find an asset, fly to it, mark it and show its card. */
export interface FindAction {
  button: string;
  /** Tag the system is asked for, and the room the recording must assign it to. */
  tagId: string;
  roomId: string;
  card: { title: string; place: string; when: string; approved: false };
  found: Copy;
  /** Camera for the found state (the try-it pose is the beat's own camera). */
  camera: CameraPose;
  cameraPortrait?: CameraPose;
  /** Beat-local window in which the find plays by itself when the visitor scrolls on without tapping. */
  auto: [number, number];
  /** Duration of the find after a tap (s). */
  durationS: number;
}

export interface ScrollStory {
  id: string;
  scene: 'hospital';
  /** Fixed seed of the recorded simulation. */
  seed: number;
  /** Starting state applied to the scene's base world before the pre-roll. */
  world: (base: WorldDef) => WorldDef;
  /** Recorded simulation seconds after the pre-roll. */
  recordS: number;
  /** Part of the world the story shows (plan metres); the simulation still runs on the whole ward. */
  crop: { x0: number; y0: number; x1: number; y1: number };
  /** SOLIX node above the building (plan metres). */
  solix: PlanPoint;
  beats: Beat[];
  /** The last beat's tap. */
  find: FindAction;
  /** Label in a corner of the stage. */
  label: string;
}
