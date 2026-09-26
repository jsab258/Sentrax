import { Color } from 'three';

/** Page-like light grey around the model. */
export const BACKGROUND = '#eef1f4';
/**
 * With the composer the background passes through AgX, which maps 1.0 to a mid-light grey; this HDR
 * value comes out close to BACKGROUND. Without the composer the clear colour is not tone mapped.
 */
export const BACKGROUND_HDR = new Color(BACKGROUND).multiplyScalar(3.2);
/** Unlit ground colour: tone mapped like every material, it lands near BACKGROUND on screen. */
export const GROUND_HDR = BACKGROUND_HDR;
