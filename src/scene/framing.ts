export interface SceneFrameBounds {
  /** Plan-coordinate box of the building (x east, y north). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Largest camera distance the orbit allows (portrait screens need the most). */
export const MAX_DISTANCE = 170;

/** Closest a story shot comes: near enough to read a room, far enough to keep its neighbours in view. */
export const MIN_SHOT_DISTANCE = 18;

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
  const distance = Math.min(Math.max(fitH, fitV * 0.75, 24), MAX_DISTANCE);
  return { azimuth, polar, distance };
}

/**
 * Camera shot that frames a plan-coordinate box (story steps, zone presets): the same view angles as the
 * overview, closer in. Returns spherical coordinates around the box centre.
 */
export function frameBox(
  box: SceneFrameBounds,
  aspect: number,
  fovDeg: number,
  opts: { distance?: number; azimuth?: number; polar?: number } = {},
) {
  const portrait = aspect < 0.9;
  const azimuth = opts.azimuth ?? (portrait ? 1.48 : -0.28);
  const polar = opts.polar ?? (portrait ? 0.8 : 0.85);
  const w = Math.max(4, box.x1 - box.x0);
  const d = Math.max(4, box.y1 - box.y0);
  const halfV = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const halfH = halfV * aspect;
  const across = w * Math.abs(Math.cos(azimuth)) + d * Math.abs(Math.sin(azimuth));
  const along = w * Math.abs(Math.sin(azimuth)) + d * Math.abs(Math.cos(azimuth));
  const fit = Math.max((across * 0.62) / halfH, ((along * 0.7) / halfV) * 0.8);
  const distance = opts.distance ?? Math.min(Math.max(fit, MIN_SHOT_DISTANCE), MAX_DISTANCE);
  return {
    azimuth,
    polar,
    distance,
    center: { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 },
  };
}
