import type { Vector3 } from 'three';

/** Lets components outside the rig (the story director, zone presets) move the camera. */
export const cameraApi: {
  fly: ((position: Vector3, target: Vector3, animate: boolean) => void) | null;
  /** Pauses orbit, pan and zoom (while the visitor drags a person or an asset). */
  setEnabled: ((on: boolean) => void) | null;
} = { fly: null, setEnabled: null };
