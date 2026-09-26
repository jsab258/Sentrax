import {
  CanvasTexture,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { brand } from '../../brand/brand';

/**
 * Billboard markers for devices too small to see in the dollhouse view (SPEC section 9). Each marker has
 * a constant screen size and fades out once the real, true-scale model is large enough on screen.
 */

export type MarkerIcon = 'anchor' | 'gateway' | 'locator';
const ICONS: MarkerIcon[] = ['anchor', 'gateway', 'locator'];

/** Marker fill per technology: BiLink anchors, RSSI gateways, AoA locators (tints and shades, brand.ts). */
export const markerColors: Record<MarkerIcon, string> = {
  anchor: brand.overlay.bilink,
  gateway: brand.overlay.rssiLine,
  locator: brand.overlay.aoa,
};

const CELL = 128;

function drawIcon(ctx: CanvasRenderingContext2D, icon: MarkerIcon, x0: number) {
  const c = CELL / 2;
  ctx.save();
  ctx.translate(x0 + c, c);
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.fillStyle = markerColors[icon];
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  if (icon === 'gateway') {
    // Radio waves above a dot.
    ctx.beginPath();
    ctx.arc(0, 14, 7, 0, Math.PI * 2);
    ctx.fill();
    for (const r of [20, 34]) {
      ctx.beginPath();
      ctx.arc(0, 14, r, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
    }
  } else if (icon === 'locator') {
    // Crosshair.
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(dx * 12, dy * 12);
      ctx.lineTo(dx * 34, dy * 34);
      ctx.stroke();
    }
  } else {
    // Room anchor: a room outline with a dot in the middle.
    ctx.strokeRect(-24, -24, 48, 48);
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function atlas(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CELL * ICONS.length;
  canvas.height = CELL;
  const ctx = canvas.getContext('2d');
  if (ctx) ICONS.forEach((icon, i) => drawIcon(ctx, icon, i * CELL));
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const vertexShader = /* glsl */ `
attribute float aIcon;
attribute float aSize;
uniform vec2 uViewport;
uniform float uPixels;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 center = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  // Size of the real model on screen, in pixels; hand over to it between 18 and 30 px.
  float modelPx = aSize * projectionMatrix[1][1] / max(center.w, 0.001) * uViewport.y * 0.5;
  vAlpha = 1.0 - smoothstep(18.0, 30.0, modelPx);
  center.xy += position.xy * uPixels * 2.0 / uViewport * center.w;
  gl_Position = center;
  vUv = vec2((uv.x + aIcon) / ${ICONS.length}.0, uv.y);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 c = texture2D(uAtlas, vUv);
  float a = c.a * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(c.rgb, a);
  #include <colorspace_fragment>
}
`;

export interface MarkerSpec {
  position: Vector3;
  icon: MarkerIcon;
  /** Largest dimension of the device (m). */
  sizeM: number;
}

export function createMarkers(specs: readonly MarkerSpec[], pixels = 24): InstancedMesh {
  const geometry = new PlaneGeometry(1, 1);
  geometry.setAttribute(
    'aIcon',
    new InstancedBufferAttribute(new Float32Array(specs.map((s) => ICONS.indexOf(s.icon))), 1),
  );
  geometry.setAttribute(
    'aSize',
    new InstancedBufferAttribute(new Float32Array(specs.map((s) => s.sizeM)), 1),
  );
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uAtlas: { value: atlas() },
      uViewport: { value: [1, 1] },
      uPixels: { value: pixels },
    },
  });
  const mesh = new InstancedMesh(geometry, material, specs.length);
  const m = new Matrix4();
  specs.forEach((s, i) => mesh.setMatrixAt(i, m.makeTranslation(s.position)));
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.name = 'device-markers';
  return mesh;
}

/** Keeps the constant marker size in CSS pixels when the canvas resizes. */
export function setMarkerViewport(mesh: InstancedMesh, width: number, height: number): void {
  const u = (mesh.material as ShaderMaterial).uniforms.uViewport;
  if (u) u.value = [width, height];
}
