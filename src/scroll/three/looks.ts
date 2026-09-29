import { Color, MeshStandardMaterial, type Material } from 'three';
import type { Bucket } from '../../scene/kit/parts';

/**
 * The three looks (SCROLL-SPEC.md section 4), switchable with ?look=a|b|c. Signals always use the brand
 * colours with bloom: logo blue for radio pulses and room glows, purple for data, button red only for the
 * found-pump beam and the primary button.
 */
export type LookId = 'a' | 'b' | 'c';

export const BRAND = {
  blue: '#6683C2',
  purple: '#352E86',
  red: '#D31F4C',
} as const;

export interface Look {
  id: LookId;
  name: string;
  /** Stage background: radial gradient from the centre to the edges. */
  background: { center: string; edge: string };
  vignette: number;
  /** Building finish. */
  model: 'white' | 'glass' | 'realistic';
  /** Wall height of the model (m); the realistic look keeps full-height walls with the cutaway. */
  wallHeight: number | null;
  exposure: number;
  /** Image-based light from the studio environment. */
  envIntensity: number;
  bloom: { strength: number; radius: number; threshold: number };
  /** Key, fill and rim lights. */
  light: {
    hemi: { sky: string; ground: string; intensity: number };
    key: { color: string; intensity: number; shadows: boolean };
    rim: { color: string; intensity: number };
  };
  /** Fresnel edge light on the model, for the rim-lit look. */
  fresnel: { color: string; strength: number; power: number };
  /** Signal colours (HDR multipliers give the glow). */
  signal: { radio: string; data: string; found: string; unassigned: string };
  /** Extra strength for room volumes and relay trails (they need more on the white model). */
  signalGain: number;
  /** Warm practical lights and window glow (realistic night). */
  practicals: boolean;
  stageFloor: { color: string; roughness: number; metalness: number };
}

export const LOOKS: Record<LookId, Look> = {
  a: {
    id: 'a',
    name: 'Night model',
    background: { center: '#2a2266', edge: '#05040f' },
    vignette: 0.55,
    model: 'white',
    wallHeight: 1.4,
    exposure: 0.85,
    envIntensity: 0.16,
    bloom: { strength: 0.8, radius: 0.5, threshold: 1.0 },
    light: {
      hemi: { sky: '#b3afe6', ground: '#0d0b24', intensity: 0.2 },
      key: { color: '#ffffff', intensity: 0.95, shadows: true },
      rim: { color: '#8e9cff', intensity: 1.4 },
    },
    fresnel: { color: '#8a94ff', strength: 0.22, power: 3 },
    signal: { radio: '#7f9cff', data: '#9b8cff', found: BRAND.red, unassigned: '#8c8fa8' },
    signalGain: 1.5,
    practicals: false,
    stageFloor: { color: '#0b0a1f', roughness: 0.32, metalness: 0.25 },
  },
  b: {
    id: 'b',
    name: 'Glass',
    background: { center: '#10284d', edge: '#02050c' },
    vignette: 0.6,
    model: 'glass',
    wallHeight: 1.6,
    exposure: 1.0,
    envIntensity: 0.35,
    bloom: { strength: 1.15, radius: 0.6, threshold: 1.0 },
    light: {
      hemi: { sky: '#cfe4ff', ground: '#06101f', intensity: 0.7 },
      key: { color: '#e4f0ff', intensity: 1.1, shadows: false },
      rim: { color: '#6fb7ff', intensity: 2.6 },
    },
    fresnel: { color: '#8fd0ff', strength: 0.5, power: 2.2 },
    signal: { radio: '#8fb0ff', data: '#a79bff', found: BRAND.red, unassigned: '#7d8aa3' },
    signalGain: 1,
    practicals: false,
    stageFloor: { color: '#030a16', roughness: 0.18, metalness: 0.55 },
  },
  c: {
    id: 'c',
    name: 'Realistic night',
    background: { center: '#141b30', edge: '#03040a' },
    vignette: 0.6,
    model: 'realistic',
    wallHeight: null,
    exposure: 1.1,
    envIntensity: 0.12,
    bloom: { strength: 0.7, radius: 0.5, threshold: 1.05 },
    light: {
      hemi: { sky: '#6f7fa8', ground: '#0a0c14', intensity: 0.28 },
      key: { color: '#b9c6e6', intensity: 0.35, shadows: false },
      rim: { color: '#6d7fb8', intensity: 0.8 },
    },
    fresnel: { color: '#6683C2', strength: 0, power: 3 },
    signal: { radio: '#7f9cff', data: '#9b8cff', found: BRAND.red, unassigned: '#8c8fa8' },
    signalGain: 1.2,
    practicals: true,
    stageFloor: { color: '#06070c', roughness: 0.6, metalness: 0.1 },
  },
};

export function parseLook(v: string | null | undefined): LookId {
  return v === 'b' || v === 'c' ? v : 'a';
}

/** Adds a Fresnel edge glow to a standard material (in place). */
export function withFresnel<T extends MeshStandardMaterial>(m: T, f: Look['fresnel'], key: string): T {
  if (f.strength <= 0) return m;
  const color = new Color(f.color);
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.uniforms.uRimColor = { value: color };
    shader.uniforms.uRimStrength = { value: f.strength };
    shader.uniforms.uRimPower = { value: f.power };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimPower;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), uRimPower);
totalEmissiveRadiance += uRimColor * rimF * uRimStrength;`,
      );
  };
  const prevKey = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${prevKey()}|rim-${key}`;
  return m;
}

function glassy(m: MeshStandardMaterial): MeshStandardMaterial {
  m.transparent = true;
  m.opacity = 0.62;
  return m;
}

/** Materials per furniture bucket for the model looks (A white, B glass); C builds textured ones. */
export function modelBucketMaterials(look: Look): Record<Bucket, MeshStandardMaterial> {
  const white = look.model === 'white';
  const make = (color: string, rough: number, metal = 0, emissive = '#000000', emissiveIntensity = 0) =>
    withFresnel(
      new MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity }),
      look.fresnel,
      `${look.id}-furniture`,
    );
  return white
    ? {
        plain: make('#f4f4f9', 0.8),
        metal: make('#d8dae6', 0.45, 0.35),
        fabric: make('#eeeef6', 0.9),
        upholstery: make('#e4e4ee', 0.85),
        wood: make('#efece9', 0.75),
        screen: make('#1a1d3d', 0.3, 0, BRAND.blue, 0.6),
      }
    : {
        // Frosted glass: translucent blue with bright Fresnel edges.
        plain: glassy(make('#5f86c0', 0.2, 0.1, '#1c3d6e', 0.35)),
        metal: glassy(make('#6f93c8', 0.15, 0.4, '#1c3d6e', 0.35)),
        fabric: glassy(make('#6a8fc6', 0.35, 0, '#1c3d6e', 0.35)),
        upholstery: glassy(make('#5a80ba', 0.3, 0, '#1c3d6e', 0.35)),
        wood: glassy(make('#6389c2', 0.25, 0, '#1c3d6e', 0.35)),
        screen: make('#0b1a33', 0.2, 0, '#8fb0ff', 0.8),
      };
}

/** HDR colour for glowing effects: brand hue pushed above 1 so the bloom picks it up. */
export function glow(hex: string, intensity: number): Color {
  return new Color(hex).multiplyScalar(intensity);
}

export function disposeMaterials(ms: Iterable<Material>): void {
  for (const m of ms) m.dispose();
}
