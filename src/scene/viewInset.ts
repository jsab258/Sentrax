import type { Camera, PerspectiveCamera } from 'three';
import type { ViewInsets } from './store';

/** Vertical field of view the canvas is created with (degrees). */
export const BASE_FOV = 35;

/**
 * The part of the canvas not covered by UI panels, as an aspect ratio and a vertical field of view, so
 * shots fit the free area instead of the whole canvas.
 */
export function visibleFrustum(
  size: { width: number; height: number },
  insets: ViewInsets,
): { aspect: number; fov: number } {
  const w = Math.max(1, size.width - insets.right);
  const h = Math.max(1, size.height - insets.bottom);
  const t = Math.tan(((BASE_FOV / 2) * Math.PI) / 180) * (h / Math.max(1, size.height));
  return { aspect: w / h, fov: (2 * Math.atan(t) * 180) / Math.PI };
}

function isPerspective(c: Camera): c is PerspectiveCamera {
  return (c as PerspectiveCamera).isPerspectiveCamera === true;
}

/**
 * Shifts the projection centre into the free area (a wider or taller virtual view of which the canvas
 * shows one corner) while keeping the on-screen scale. Cheap to call every frame: it only touches the
 * camera when something changed, including after the renderer reset the aspect on resize.
 */
export function applyViewInset(camera: Camera, size: { width: number; height: number }, insets: ViewInsets) {
  if (!isPerspective(camera)) return;
  const { width: W, height: H } = size;
  const D = Math.round(insets.right);
  const B = Math.round(insets.bottom);
  const fullW = W + D;
  const fullH = H + B;
  const fov = (2 * Math.atan(Math.tan(((BASE_FOV / 2) * Math.PI) / 180) * (fullH / H)) * 180) / Math.PI;
  const aspect = fullW / fullH;
  const v = camera.view;
  if (!D && !B) {
    if (v?.enabled || camera.fov !== BASE_FOV || Math.abs(camera.aspect - W / H) > 1e-6) {
      camera.clearViewOffset();
      camera.fov = BASE_FOV;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }
    return;
  }
  const same =
    v?.enabled &&
    v.fullWidth === fullW &&
    v.fullHeight === fullH &&
    v.offsetX === D &&
    v.offsetY === B &&
    v.width === W &&
    v.height === H &&
    Math.abs(camera.aspect - aspect) < 1e-6 &&
    Math.abs(camera.fov - fov) < 1e-6;
  if (same) return;
  camera.fov = fov;
  camera.aspect = aspect;
  camera.setViewOffset(fullW, fullH, D, B, W, H);
}
