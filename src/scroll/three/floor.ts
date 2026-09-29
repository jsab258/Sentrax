import { CircleGeometry, Color, Mesh, MeshStandardMaterial, Vector2, Vector3, type Material } from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { Look } from './looks';

/**
 * Glossy stage floor with a soft, blurred reflection of the model and its signals (looks A and B on
 * desktop), fading out into the background around the model.
 */
const ReflectiveFloorShader = {
  name: 'StoryFloorShader',
  uniforms: {
    color: { value: null as Color | null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uStrength: { value: 0.35 },
    uCenter: { value: new Vector2() },
    uRadius: { value: 30 },
    uTexel: { value: new Vector2(1 / 512, 1 / 512) },
  },
  vertexShader: /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vUv;
varying vec3 vWorld;
void main() {
  vUv = textureMatrix * vec4(position, 1.0);
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  fragmentShader: /* glsl */ `
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform float uStrength;
uniform vec2 uCenter;
uniform float uRadius;
uniform vec2 uTexel;
varying vec4 vUv;
varying vec3 vWorld;
void main() {
  vec2 uv = vUv.xy / vUv.w;
  vec3 r = texture2D(tDiffuse, uv).rgb * 0.36;
  r += texture2D(tDiffuse, uv + vec2(uTexel.x * 3.0, 0.0)).rgb * 0.16;
  r += texture2D(tDiffuse, uv - vec2(uTexel.x * 3.0, 0.0)).rgb * 0.16;
  r += texture2D(tDiffuse, uv + vec2(0.0, uTexel.y * 3.0)).rgb * 0.16;
  r += texture2D(tDiffuse, uv - vec2(0.0, uTexel.y * 3.0)).rgb * 0.16;
  float d = length(vWorld.xz - uCenter) / uRadius;
  float fade = 1.0 - smoothstep(0.35, 1.0, d);
  gl_FragColor = vec4(color + r * uStrength, fade);
}`,
};

export interface StageFloor {
  mesh: Mesh;
  /** Call once per frame before rendering (the reflection renders at most once per frame). */
  frame(): void;
  dispose(): void;
}

export function buildStageFloor(
  look: Look,
  center: Vector3,
  y: number,
  opts: { reflect: boolean; width: number; height: number },
): StageFloor {
  const radius = 34;
  const geo = new CircleGeometry(radius * 1.1, 64);
  if (opts.reflect) {
    const w = Math.max(256, Math.round(opts.width / 2));
    const h = Math.max(256, Math.round(opts.height / 2));
    const floor = new Reflector(geo, {
      color: new Color(look.stageFloor.color),
      textureWidth: w,
      textureHeight: h,
      clipBias: 0.003,
      shader: ReflectiveFloorShader,
    });
    const mat = floor.material as Material & { uniforms: typeof ReflectiveFloorShader.uniforms };
    mat.transparent = true;
    mat.uniforms.uCenter.value.set(center.x, center.z);
    mat.uniforms.uRadius.value = radius;
    mat.uniforms.uStrength.value = look.model === 'glass' ? 0.5 : 0.38;
    mat.uniforms.uTexel.value.set(1 / w, 1 / h);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(center.x, y, center.z);
    // The depth-of-field pass renders the scene again; reflect only on the first render of a frame.
    const reflect = floor.onBeforeRender.bind(floor);
    let fresh = true;
    floor.onBeforeRender = (...args) => {
      if (!fresh) return;
      fresh = false;
      reflect(...args);
    };
    return {
      mesh: floor,
      frame: () => {
        fresh = true;
      },
      dispose: () => {
        geo.dispose();
        floor.dispose();
      },
    };
  }
  const mat = new MeshStandardMaterial({
    color: look.stageFloor.color,
    roughness: look.stageFloor.roughness,
    metalness: look.stageFloor.metalness,
    envMapIntensity: 0,
    transparent: true,
  });
  // Same fade into the background as the reflective floor.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCenter = { value: new Vector2(center.x, center.z) };
    shader.uniforms.uRadius = { value: radius };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFloorWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvFloorWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec2 uCenter;\nuniform float uRadius;\nvarying vec3 vFloorWorld;',
      )
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - smoothstep(0.35, 1.0, length(vFloorWorld.xz - uCenter) / uRadius);',
      );
  };
  const mesh = new Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(center.x, y, center.z);
  mesh.receiveShadow = true;
  return {
    mesh,
    frame: () => undefined,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}
