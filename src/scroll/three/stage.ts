import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  CanvasTexture,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { cutawayUniforms } from '../../scene/materials/cutaway';
import type { WorldDef } from '../../sim/world';
import type { StoryState } from '../state';
import type { CameraPose, ScrollStory } from '../stories/types';
import type { Timeline } from '../timeline/timeline';
import { Effects } from './effects';
import { LOOK } from './look';
import { P, Props } from './props';
import { buildStageFloor, type StageFloor } from './floor';
import { buildWard, cropWorld, type Ward } from './ward';

const VignetteShader = {
  uniforms: { tDiffuse: { value: null as Texture | null }, uAmount: { value: 0.5 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uAmount;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  vec2 d = vUv - 0.5;
  float v = smoothstep(0.85, 0.2, length(d * vec2(1.1, 1.0)));
  c.rgb *= mix(1.0 - uAmount, 1.0, v);
  gl_FragColor = c;
}`,
};

function gradientTexture(center: string, edge: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(256, 230, 20, 256, 256, 380);
    grd.addColorStop(0, center);
    grd.addColorStop(1, edge);
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface StageOptions {
  phone: boolean;
  /** Device pixel ratio cap. */
  dpr: number;
}

/**
 * The 3D stage of the scroll story (vanilla three.js, no React, to keep the story's JavaScript small):
 * the cropped ward at night, people and equipment from the recording, the signals and a post-processing
 * chain with bloom, depth of field on close-ups and a vignette.
 */
export class ThreeStage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(34, 1, 0.5, 400);
  private readonly world: WorldDef;
  private readonly ward: Ward;
  private readonly floor: StageFloor;
  private readonly props: Props;
  private readonly effects: Effects;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly bokeh: BokehPass | null;
  private readonly vignette: ShaderPass;
  private readonly loader: KTX2Loader;
  private readonly background: CanvasTexture;
  private readonly envTarget: ReturnType<PMREMGenerator['fromScene']>;
  private size = new Vector2(1, 1);
  readonly ready: Promise<void>;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly story: ScrollStory,
    readonly timeline: Timeline,
    fullWorld: WorldDef,
    readonly opts: StageOptions,
  ) {
    const look = LOOK;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.dpr));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = look.exposure;
    this.renderer.outputColorSpace = SRGBColorSpace;
    // The composer renders several passes per frame; count them all (reset in render()).
    this.renderer.info.autoReset = false;

    this.background = gradientTexture(look.background.center, look.background.edge);
    this.scene.background = this.background;
    const pmrem = new PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    pmrem.dispose();
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = look.envIntensity;

    this.world = cropWorld(fullWorld, story.crop);
    const { x0, y0, x1, y1 } = story.crop;
    const center = P((x0 + x1) / 2, (y0 + y1) / 2);

    // Lights: soft sky, a key from the front left, a strong rim from behind the model.
    this.scene.add(
      new HemisphereLight(look.light.hemi.sky, look.light.hemi.ground, look.light.hemi.intensity),
    );
    const key = new DirectionalLight(look.light.key.color, look.light.key.intensity);
    key.position.copy(center).add(new Vector3(-14, 26, 20));
    key.target.position.copy(center);
    this.scene.add(key, key.target);
    const rim = new DirectionalLight(look.light.rim.color, look.light.rim.intensity);
    rim.position.copy(center).add(new Vector3(8, 10, -30));
    rim.target.position.copy(center);
    this.scene.add(rim, rim.target);

    this.addPracticals();

    this.loader = new KTX2Loader().detectSupport(this.renderer);
    this.ward = buildWard(this.world, this.loader);
    this.scene.add(this.ward.group);
    this.floor = buildStageFloor(this.ward.base.center, this.ward.base.y);
    this.scene.add(this.floor.mesh);
    this.props = new Props(this.world, fullWorld, timeline, this.loader);
    this.scene.add(this.props.group);
    this.effects = new Effects(this.world, this.props, story.solix, story.find.tagId);
    this.scene.add(this.effects.group);

    // Post-processing: bloom on the signals (HDR above the threshold), depth of field on close-ups.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new Vector2(256, 256),
      look.bloom.strength,
      look.bloom.radius,
      look.bloom.threshold,
    );
    this.composer.addPass(this.bloom);
    this.bokeh = opts.phone
      ? null
      : new BokehPass(this.scene, this.camera, { focus: 10, aperture: 0, maxblur: 0.008 });
    if (this.bokeh) this.composer.addPass(this.bokeh);
    this.vignette = new ShaderPass(VignetteShader);
    const amount = this.vignette.uniforms.uAmount;
    if (amount) amount.value = look.vignette;
    this.composer.addPass(this.vignette);
    this.composer.addPass(new OutputPass());

    this.ready = Promise.all([this.ward.ready, this.props.ready]).then(() => undefined);
  }

  /** Warm practical lights with pools of light on the floor: one per room, every 7 m along the corridor. */
  private addPracticals(): void {
    const pool = gradientTexture('rgba(255,214,160,0.9)', 'rgba(255,214,160,0)');
    const lights: Array<[number, number]> = [];
    for (const z of this.world.zones) {
      if (z.parent || z.kind === 'outdoor') continue;
      const xs = z.polygon.map((p) => p.x);
      const ys = z.polygon.map((p) => p.y);
      const [zx0, zx1, zy0, zy1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      if (z.kind === 'corridor') for (let x = zx0 + 3; x < zx1; x += 7) lights.push([x, (zy0 + zy1) / 2]);
      else lights.push([(zx0 + zx1) / 2, (zy0 + zy1) / 2 + (z.kind === 'room' ? 1 : 0)]);
    }
    for (const [lx, ly] of lights) {
      const l = new PointLight('#ffd6a0', 4, 7, 1.6);
      l.position.copy(P(lx, ly, 2.4));
      this.scene.add(l);
      const m = new Mesh(
        new PlaneGeometry(4.5, 4.5).rotateX(-Math.PI / 2),
        new MeshBasicMaterial({
          map: pool,
          transparent: true,
          opacity: 0.12,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      );
      m.position.copy(P(lx, ly, 0.05));
      this.scene.add(m);
    }
  }

  resize(width: number, height: number): void {
    this.size.set(width, height);
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloom.resolution.set(width / 2, height / 2);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  get portrait(): boolean {
    return this.size.x / Math.max(1, this.size.y) < 0.85;
  }

  private applyCamera(pose: Required<CameraPose>): void {
    const [px, py, pz] = pose.position;
    const [tx, ty, tz] = pose.target;
    this.camera.position.copy(P(px, py, pz));
    this.camera.fov = pose.fov;
    this.camera.lookAt(P(tx, ty, tz));
    const w = this.size.x;
    const h = this.size.y;
    // Leave room for the text: the scene sits a little right on wide screens and higher on phones.
    if (this.portrait) this.camera.setViewOffset(w, h, 0, h * 0.1, w, h);
    else this.camera.setViewOffset(w, h, -w * 0.11, 0, w, h);
    this.camera.updateProjectionMatrix();
    cutawayUniforms.uCamPos.value.set(this.camera.position.x, this.camera.position.z);
    if (this.bokeh) {
      const blur = pose.blur;
      this.bokeh.enabled = blur > 0.02;
      const u = this.bokeh.uniforms as Record<string, { value: number }>;
      if (u.focus) u.focus.value = this.camera.position.distanceTo(P(tx, ty, tz));
      if (u.aperture) u.aperture.value = 0.0025 * blur;
    }
  }

  render(state: StoryState): void {
    this.applyCamera(this.portrait ? state.camera.portrait : state.camera.landscape);
    this.props.update(state.t, state.fx.look);
    this.effects.update(state);
    this.renderer.info.reset();
    this.composer.render();
  }

  /** Draw calls and triangles of the last frame (for the budgets and the stats overlay). */
  stats(): { calls: number; triangles: number } {
    const info = this.renderer.info.render;
    return { calls: info.calls, triangles: info.triangles };
  }

  dispose(): void {
    this.effects.dispose();
    this.props.dispose();
    this.ward.dispose();
    this.floor.dispose();
    this.composer.dispose();
    this.background.dispose();
    this.envTarget.dispose();
    this.loader.dispose();
    this.renderer.dispose();
  }
}
