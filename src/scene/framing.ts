export interface SceneFrameBounds {
  /** Plan-coordinate box of the building (x east, y north). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Largest camera distance the orbit allows (portrait screens need the most). */
export const MAX_DISTANCE = 100;

/** Initial view: fits the building to the canvas, turning the long axis upright on portrait screens. */
export function framing(bounds: SceneFrameBounds, aspect: number, fovDeg: number) {
  const w = bounds.x1 - bounds.x0;
  const d = bounds.y1 - bounds.y0;
  const portrait = aspect < 0.9;
  // Portrait: long axis nearly upright and a steeper view, since width is the scarce dimension.
  const azimuth = portrait ? 1.48 : -0.28;
  const polar = portrait ? 0.78 : 0.9;
  const halfV = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const halfH = halfV * aspect;
  // Extent of the footprint across the screen and along the view direction for this azimuth.
  const across = w * Math.abs(Math.cos(azimuth)) + d * Math.abs(Math.sin(azimuth));
  const along = w * Math.abs(Math.sin(azimuth)) + d * Math.abs(Math.cos(azimuth));
  const fitH = (across * (portrait ? 0.56 : 0.5)) / halfH;
  const fitV = (along * 0.62) / halfV;
  const distance = Math.min(Math.max(fitH, fitV * 0.75, 24), portrait ? MAX_DISTANCE : 70);
  return { azimuth, polar, distance };
}
