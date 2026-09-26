import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { WebGLRenderer } from 'three';
import { create } from 'zustand';

/** Render statistics for the dev HUD (?stats=1) and the Playwright budget checks. */
export interface RenderStats {
  fps: number;
  /** Draw calls per frame, including shadow and post-processing passes. */
  calls: number;
  triangles: number;
  frames: number;
  /** Main-thread time per frame for simulation and animation updates (ms, averaged). */
  scriptMs: number;
}

export const useRenderStats = create<RenderStats>(() => ({
  fps: 0,
  calls: 0,
  triangles: 0,
  frames: 0,
  scriptMs: 0,
}));

declare global {
  interface Window {
    __sentraxStats?: RenderStats;
  }
}

function setAutoReset(gl: WebGLRenderer, on: boolean) {
  gl.info.autoReset = on;
}

const acc = { frames: 0, time: 0, total: 0, scriptStart: 0, script: 0 };

/**
 * Counts every draw call of a frame. The composer renders several passes per frame, so automatic
 * per-render resets are switched off and the counters are read and reset once per frame instead.
 */
export function StatsProbe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    // Development only: scene and camera handles for debugging and colour sampling.
    if (import.meta.env.DEV) Object.assign(window, { __scene: scene, __camera: camera });
  }, [scene, camera]);
  useEffect(() => {
    setAutoReset(gl, false);
    return () => setAutoReset(gl, true);
  }, [gl]);
  useFrame((_, delta) => {
    const { calls, triangles } = gl.info.render;
    gl.info.reset();
    acc.frames++;
    acc.total++;
    acc.time += delta;
    acc.scriptStart = performance.now();
    if (acc.time >= 0.5) {
      const stats: RenderStats = {
        fps: acc.frames / acc.time,
        calls,
        triangles,
        frames: acc.total,
        scriptMs: acc.script / acc.frames,
      };
      useRenderStats.setState(stats);
      window.__sentraxStats = stats;
      acc.frames = 0;
      acc.time = 0;
      acc.script = 0;
    }
  }, -100);
  // Runs after the simulation (-50), assets (-30) and characters (-20), before rendering.
  useFrame(() => {
    acc.script += performance.now() - acc.scriptStart;
  }, -10);
  return null;
}
