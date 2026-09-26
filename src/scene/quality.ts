/**
 * Quality tiers (SPEC section 11): high, medium and low, auto-detected with a manual override.
 * Low disables SSAO and most shadows and reduces agents and effects.
 */
export type QualityTier = 'high' | 'medium' | 'low';

export interface TierSettings {
  /** Device pixel ratio range for the canvas. */
  dpr: [number, number];
  shadows: boolean;
  /** 'all': walls, furniture, equipment and people cast shadows; 'structure': only walls and people. */
  shadowCasters: 'all' | 'structure';
  shadowMapSize: number;
  ssao: 'full' | 'half' | 'off';
  /** Halo glow on Radio, Data and Insight overlays (drawn in the overlay pass). */
  glow: boolean;
  /** Multisampling of the post-processing buffer. */
  msaa: number;
  /** Which texture set to load. */
  textures: 'high' | 'low';
  /** Static figures (patients) and other non-essential characters. */
  extraFigures: boolean;
}

export const tierSettings: Record<QualityTier, TierSettings> = {
  high: {
    dpr: [1, 2],
    shadows: true,
    shadowCasters: 'all',
    shadowMapSize: 2048,
    ssao: 'full',
    glow: true,
    msaa: 4,
    textures: 'high',
    extraFigures: true,
  },
  medium: {
    dpr: [1, 1.5],
    shadows: true,
    shadowCasters: 'all',
    shadowMapSize: 1024,
    ssao: 'half',
    glow: true,
    msaa: 2,
    textures: 'low',
    extraFigures: true,
  },
  low: {
    dpr: [1, 1],
    // Most shadows off: only walls and people, on a small map.
    shadows: true,
    shadowCasters: 'structure',
    shadowMapSize: 1024,
    ssao: 'off',
    glow: false,
    msaa: 0,
    textures: 'low',
    extraFigures: false,
  },
};

export interface GpuHints {
  renderer: string;
  mobile: boolean;
  cores: number;
  memoryGb: number | undefined;
  maxTextureSize: number;
}

/** Reads what the browser exposes about the device. Never throws. */
export function readGpuHints(): GpuHints {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const hints: GpuHints = {
    renderer: '',
    mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(nav?.userAgent ?? '') || (nav?.maxTouchPoints ?? 0) > 1,
    cores: nav?.hardwareConcurrency ?? 4,
    memoryGb: (nav as (Navigator & { deviceMemory?: number }) | undefined)?.deviceMemory,
    maxTextureSize: 4096,
  };
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      hints.renderer = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
      hints.maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    // Keep defaults.
  }
  return hints;
}

/** Heuristic tier choice. Conservative: when unsure, medium. */
export function detectTier(h: GpuHints): QualityTier {
  const r = h.renderer.toLowerCase();
  if (/swiftshader|llvmpipe|software|basic render/.test(r)) return 'low';
  if (h.mobile) {
    // Recent iPhones and flagship Android GPUs handle medium; everything else low.
    if (/apple gpu|apple a1[5-9]|adreno \(tm\) 7[3-9]\d|mali-g7[1-9]/.test(r) && (h.memoryGb ?? 4) >= 4)
      return 'medium';
    return 'low';
  }
  if (/apple m\d|nvidia|geforce|rtx|radeon rx|radeon pro|arc a/.test(r)) return 'high';
  if (/intel|iris|uhd|hd graphics/.test(r)) return h.cores >= 8 ? 'medium' : 'low';
  if (h.maxTextureSize >= 16384 && h.cores >= 8) return 'high';
  return 'medium';
}

export function parseTier(value: string | null | undefined): QualityTier | null {
  return value === 'high' || value === 'medium' || value === 'low' ? value : null;
}
