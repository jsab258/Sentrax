/**
 * Which stage a visitor gets (SCROLL-SPEC.md section 6): 3D where the device can handle it, short video
 * clips on weak devices, still posters for reduced motion. ?force=3d|video|static overrides detection.
 */
export type StageMode = '3d' | 'video' | 'static';
export type FallbackReason =
  'forced' | 'reduced-motion' | 'no-webgl2' | 'save-data' | 'low-memory' | 'probe' | 'slow';

export interface DeviceEnv {
  force: string | null;
  webgl2: boolean;
  saveData: boolean;
  deviceMemory: number | undefined;
  reducedMotion: boolean;
}

export function chooseMode(env: DeviceEnv): { mode: StageMode; reason: FallbackReason | null } {
  if (env.force === '3d') return { mode: '3d', reason: null };
  if (env.force === 'video' || env.force === 'static') return { mode: env.force, reason: 'forced' };
  if (env.reducedMotion) return { mode: 'static', reason: 'reduced-motion' };
  if (!env.webgl2) return { mode: 'video', reason: 'no-webgl2' };
  if (env.saveData) return { mode: 'video', reason: 'save-data' };
  if (env.deviceMemory !== undefined && env.deviceMemory <= 2) return { mode: 'video', reason: 'low-memory' };
  return { mode: '3d', reason: null };
}

/** The performance probe in the first second: the median frame time must stay under 40 ms. */
export const PROBE_BUDGET_MS = 40;
/** Later, a sustained median above this (ms) crossfades to video. */
export const SLOW_BUDGET_MS = 55;

export function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

export function probePasses(frameTimesMs: readonly number[]): boolean {
  return frameTimesMs.length > 0 && median(frameTimesMs) < PROBE_BUDGET_MS;
}

export function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

export function readEnv(search: string): DeviceEnv {
  const q = new URLSearchParams(search);
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  let reducedMotion: boolean;
  try {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    reducedMotion = false;
  }
  return {
    force: q.get('force'),
    webgl2: hasWebGL2(),
    saveData: !!nav.connection?.saveData,
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined,
    reducedMotion,
  };
}
