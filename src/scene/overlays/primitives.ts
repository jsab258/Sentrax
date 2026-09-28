import { devToolsEnabled, urlParam } from '../../app/devtools';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  GreaterDepth,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LessEqualDepth,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  type Blending,
  type DepthModes,
  type Vector3,
} from 'three';
import { brand } from '../../brand/brand';

/**
 * Overlay primitives for the Radio, Data and Insight layers (SPEC section 5):
 * - Every line, dot and ring carries a casing (DECISIONS.md 61): white around the dark brand colours,
 *   the insight shade around the amber warning. Casing and mark are one shader with smooth edges.
 * - Depth dimming (DECISIONS.md 70): each batch draws twice against the occluder depth, once where it is
 *   visible (full opacity) and once where it is hidden behind scene geometry (35 percent).
 * - Batches are instanced and rebuilt every frame, so all lines together cost two draw calls.
 * Positions are world coordinates (three.js: x, height, -plan y).
 */

export const HIDDEN_OPACITY = 0.35;

/** Dev tool for before and after comparisons: ?dimming=0 draws hidden overlay parts at full opacity. */
function hiddenOpacity(): number {
  return devToolsEnabled && urlParam('dimming') === '0' ? 1 : HIDDEN_OPACITY;
}

/** Shared uniforms: viewport in CSS pixels, and how far overlays are pulled towards the camera (m). */
export const overlayUniforms = {
  uViewport: { value: new Vector2(1, 1) },
  uBias: { value: 0.25 },
};

/** Casing colour for a mark colour: the insight shade for amber, white for the dark brand colours. */
export function casingFor(hex: string): string {
  return hex.toUpperCase() === brand.overlay.warning.toUpperCase() ? brand.overlay.insight : '#FFFFFF';
}

export interface StrokeStyle {
  color: string;
  /** Mark half width (lines) or radius (dots) in CSS pixels. */
  widthPx: number;
  /** Casing band outside the mark, in CSS pixels. 0 draws no casing. */
  casingPx?: number;
  /** Casing colour; defaults to casingFor(color). */
  casing?: string;
  opacity?: number;
}

const common = /* glsl */ `
uniform vec2 uViewport;
uniform float uBias;
vec4 biasedClip(vec3 world) {
  vec4 v = viewMatrix * vec4(world, 1.0);
  float len = length(v.xyz);
  // Pull towards the camera along the view ray: same screen position, nearer depth, so marks resting on
  // a surface are not counted as hidden by it.
  v.xyz *= max(0.0, 1.0 - uBias / max(len, 1e-3));
  return projectionMatrix * v;
}
`;

const strokeFragment = /* glsl */ `
uniform float uDim;
varying vec3 vColor;
varying vec3 vCasing;
varying vec2 vWidth;
varying float vAlpha;
varying float vDist;
void main() {
  float aa = 0.8;
  float d = abs(vDist);
  float outer = 1.0 - smoothstep(vWidth.y - aa, vWidth.y + aa, d);
  float inner = 1.0 - smoothstep(vWidth.x - aa, vWidth.x + aa, d);
  vec3 c = mix(vCasing, vColor, inner);
  float a = outer * vAlpha * uDim;
  if (a < 0.004) discard;
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}
`;

const lineVertex = /* glsl */ `
${common}
attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec3 aColor;
attribute vec3 aCasing;
attribute vec2 aWidth;
attribute float aAlpha;
varying vec3 vColor;
varying vec3 vCasing;
varying vec2 vWidth;
varying float vAlpha;
varying float vDist;
void main() {
  vec4 a = biasedClip(aStart);
  vec4 b = biasedClip(aEnd);
  a.w = max(a.w, 1e-3);
  b.w = max(b.w, 1e-3);
  vec2 sa = a.xy / a.w * uViewport * 0.5;
  vec2 sb = b.xy / b.w * uViewport * 0.5;
  vec2 dir = sb - sa;
  float l = length(dir);
  dir = l > 1e-4 ? dir / l : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  float halfW = aWidth.y + 1.0;
  vec4 p = position.x < 0.5 ? a : b;
  float along = position.x < 0.5 ? -1.0 : 1.0;
  // Extend each segment by half its width so the segments of a polyline overlap at the joins.
  vec2 off = n * position.y * halfW + dir * along * aWidth.y * 0.5;
  p.xy += off * 2.0 / uViewport * p.w;
  gl_Position = p;
  // Signed distance from the centre line; the fragment takes its absolute value after interpolation.
  vDist = position.y * halfW;
  vColor = aColor;
  vCasing = aCasing;
  vWidth = aWidth;
  vAlpha = aAlpha;
}
`;

const dotVertex = /* glsl */ `
${common}
attribute vec3 aCenter;
attribute vec3 aColor;
attribute vec3 aCasing;
attribute vec2 aWidth;
attribute float aAlpha;
varying vec3 vColor;
varying vec3 vCasing;
varying vec2 vWidth;
varying float vAlpha;
varying float vDist;
varying vec2 vLocal;
void main() {
  vec4 c = biasedClip(aCenter);
  float r = aWidth.y + 1.0;
  vLocal = position.xy * r;
  c.xy += position.xy * r * 2.0 / uViewport * c.w;
  gl_Position = c;
  vDist = 0.0;
  vColor = aColor;
  vCasing = aCasing;
  vWidth = aWidth;
  vAlpha = aAlpha;
}
`;

const dotFragment = strokeFragment
  .replace('varying float vDist;', 'varying float vDist;\nvarying vec2 vLocal;')
  .replace('float aa = 0.8;', 'float aa = 0.8;\n  float dist = length(vLocal);')
  .replaceAll('vDist)', 'dist)');

const glowFragment = /* glsl */ `
uniform float uDim;
varying vec3 vColor;
varying vec2 vWidth;
varying float vAlpha;
varying vec2 vLocal;
void main() {
  float t = clamp(length(vLocal) / max(vWidth.y, 1.0), 0.0, 1.0);
  float a = (1.0 - t) * (1.0 - t) * vAlpha * uDim;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a, a);
  #include <colorspace_fragment>
}
`;

const ringVertex = /* glsl */ `
${common}
attribute vec3 aCenter;
attribute float aRadius;
attribute vec3 aColor;
attribute vec3 aCasing;
attribute vec2 aWidth;
attribute vec4 aFill;
attribute float aAlpha;
uniform float uPad;
varying vec3 vColor;
varying vec3 vCasing;
varying vec2 vWidth;
varying vec4 vFill;
varying float vAlpha;
varying vec2 vLocal;
varying float vRadius;
void main() {
  float ext = aRadius + uPad;
  vLocal = position.xy * ext;
  // Plane y maps to -z so the quad keeps its front face towards the sky (the camera is always above).
  vec3 world = aCenter + vec3(vLocal.x, 0.0, -vLocal.y);
  gl_Position = biasedClip(world);
  vRadius = aRadius;
  vColor = aColor;
  vCasing = aCasing;
  vWidth = aWidth;
  vFill = aFill;
  vAlpha = aAlpha;
}
`;

const ringFragment = /* glsl */ `
uniform float uDim;
varying vec3 vColor;
varying vec3 vCasing;
varying vec2 vWidth;
varying vec4 vFill;
varying float vAlpha;
varying vec2 vLocal;
varying float vRadius;
void main() {
  float dist = length(vLocal);
  float fw = max(fwidth(dist), 1e-5);
  float dPx = abs(dist - vRadius) / fw;
  float aa = 0.8;
  float stroke = step(0.01, vWidth.y) * (1.0 - smoothstep(vWidth.y - aa, vWidth.y + aa, dPx));
  float inner = 1.0 - smoothstep(vWidth.x - aa, vWidth.x + aa, dPx);
  vec3 strokeColor = mix(vCasing, vColor, inner);
  float inside = 1.0 - smoothstep(-fw, fw, dist - vRadius);
  float fillA = vFill.a * inside;
  vec3 c = mix(vFill.rgb, strokeColor, stroke);
  float a = (stroke + fillA * (1.0 - stroke)) * vAlpha * uDim;
  if (a < 0.004) discard;
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}
`;

function material(
  vertexShader: string,
  fragmentShader: string,
  hidden: boolean,
  blending: Blending = NormalBlending,
) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      ...overlayUniforms,
      uDim: { value: hidden ? hiddenOpacity() : 1 },
      uPad: { value: 0.6 },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    depthFunc: (hidden ? GreaterDepth : LessEqualDepth) as DepthModes,
    blending,
    premultipliedAlpha: blending === AdditiveBlending,
    toneMapped: false,
  });
}

interface AttrSpec {
  name: string;
  size: number;
}

/** A growable set of instanced attributes on a base shape, drawn by a visible and a hidden mesh. */
class Batch {
  readonly visible: Mesh;
  readonly hidden: Mesh;
  protected readonly geometry: InstancedBufferGeometry;
  private readonly specs: AttrSpec[];
  private arrays = new Map<string, Float32Array>();
  private capacity = 0;
  protected count = 0;

  constructor(
    base: BufferGeometry,
    specs: AttrSpec[],
    vertexShader: string,
    fragmentShader: string,
    name: string,
    blending?: Blending,
  ) {
    this.geometry = new InstancedBufferGeometry();
    this.geometry.index = base.index;
    this.geometry.setAttribute('position', base.getAttribute('position'));
    this.specs = specs;
    this.ensure(32);
    this.visible = new Mesh(this.geometry, material(vertexShader, fragmentShader, false, blending));
    this.hidden = new Mesh(this.geometry, material(vertexShader, fragmentShader, true, blending));
    for (const m of [this.visible, this.hidden]) {
      m.frustumCulled = false;
      m.name = `${name}${m === this.hidden ? ':hidden' : ''}`;
    }
    // Hidden parts first, so the visible parts blend over them.
    this.hidden.renderOrder = 1;
    this.visible.renderOrder = 2;
  }

  private ensure(n: number) {
    if (n <= this.capacity) return;
    const cap = Math.max(n, this.capacity * 2, 32);
    for (const s of this.specs) {
      const next = new Float32Array(cap * s.size);
      const prev = this.arrays.get(s.name);
      if (prev) next.set(prev);
      this.arrays.set(s.name, next);
      this.geometry.setAttribute(s.name, new InstancedBufferAttribute(next, s.size).setUsage(35048));
    }
    this.capacity = cap;
  }

  begin(): void {
    this.count = 0;
  }

  protected push(values: Record<string, ArrayLike<number>>): void {
    this.ensure(this.count + 1);
    for (const s of this.specs) {
      const arr = this.arrays.get(s.name);
      const v = values[s.name];
      if (arr && v) for (let k = 0; k < s.size; k++) arr[this.count * s.size + k] = v[k] ?? 0;
    }
    this.count++;
  }

  end(): void {
    for (const s of this.specs) {
      const attr = this.geometry.getAttribute(s.name) as InstancedBufferAttribute;
      attr.needsUpdate = true;
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, this.count * s.size);
    }
    this.geometry.instanceCount = this.count;
    this.visible.visible = this.hidden.visible = this.count > 0;
  }

  get size(): number {
    return this.count;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.visible.material as ShaderMaterial).dispose();
    (this.hidden.material as ShaderMaterial).dispose();
  }
}

const _c = new Color();
const _k = new Color();
function rgb(hex: string, out: Color): [number, number, number] {
  out.set(hex);
  return [out.r, out.g, out.b];
}

function widths(s: StrokeStyle): [number, number] {
  return [s.widthPx, s.widthPx + (s.casingPx ?? 2)];
}

function lineBase(): BufferGeometry {
  const g = new BufferGeometry();
  // x: 0 at the start, 1 at the end; y: -1 to 1 across.
  // Per-vertex corners of the unit quad (a plain attribute: the per-segment data is instanced).
  g.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

export class LineBatch extends Batch {
  constructor(name = 'overlay-lines') {
    super(
      lineBase(),
      [
        { name: 'aStart', size: 3 },
        { name: 'aEnd', size: 3 },
        { name: 'aColor', size: 3 },
        { name: 'aCasing', size: 3 },
        { name: 'aWidth', size: 2 },
        { name: 'aAlpha', size: 1 },
      ],
      lineVertex,
      strokeFragment,
      name,
    );
  }

  segment(a: Vector3, b: Vector3, s: StrokeStyle): void {
    this.push({
      aStart: [a.x, a.y, a.z],
      aEnd: [b.x, b.y, b.z],
      aColor: rgb(s.color, _c),
      aCasing: rgb(s.casing ?? casingFor(s.color), _k),
      aWidth: widths(s),
      aAlpha: [s.opacity ?? 1],
    });
  }

  polyline(points: readonly Vector3[], s: StrokeStyle): void {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (a && b) this.segment(a, b, s);
    }
  }
}

export class DotBatch extends Batch {
  constructor(name = 'overlay-dots', glow = false) {
    super(
      new PlaneGeometry(2, 2),
      [
        { name: 'aCenter', size: 3 },
        { name: 'aColor', size: 3 },
        { name: 'aCasing', size: 3 },
        { name: 'aWidth', size: 2 },
        { name: 'aAlpha', size: 1 },
      ],
      dotVertex,
      glow ? glowFragment : dotFragment,
      name,
      glow ? AdditiveBlending : NormalBlending,
    );
  }

  dot(center: Vector3, s: StrokeStyle): void {
    this.push({
      aCenter: [center.x, center.y, center.z],
      aColor: rgb(s.color, _c),
      aCasing: rgb(s.casing ?? casingFor(s.color), _k),
      aWidth: widths(s),
      aAlpha: [s.opacity ?? 1],
    });
  }
}

export interface RingFill {
  color: string;
  opacity: number;
}

export class RingBatch extends Batch {
  constructor(name = 'overlay-rings') {
    super(
      new PlaneGeometry(2, 2),
      [
        { name: 'aCenter', size: 3 },
        { name: 'aRadius', size: 1 },
        { name: 'aColor', size: 3 },
        { name: 'aCasing', size: 3 },
        { name: 'aWidth', size: 2 },
        { name: 'aFill', size: 4 },
        { name: 'aAlpha', size: 1 },
      ],
      ringVertex,
      ringFragment,
      name,
    );
  }

  /** Horizontal circle of `radius` metres around `center`; `fill` paints the inside (uncertainty disk). */
  ring(center: Vector3, radius: number, s: StrokeStyle | null, fill?: RingFill): void {
    const f = fill ? [...rgb(fill.color, _k), fill.opacity] : [0, 0, 0, 0];
    this.push({
      aCenter: [center.x, center.y, center.z],
      aRadius: [radius],
      aColor: rgb(s?.color ?? '#000000', _c),
      aCasing: s ? rgb(s.casing ?? casingFor(s.color), _k) : [1, 1, 1],
      aWidth: s ? widths(s) : [0, 0],
      aFill: f,
      aAlpha: [s?.opacity ?? 1],
    });
  }
}
