import { useEffect, useRef } from 'react';
import { brand } from '../brand/brand';
import { ui } from '../content/ui';
import type { Simulation } from '../sim/engine';
import { sensorHistory } from './sensorHistory';
import { useSimTick } from './useSimTick';

/** Live temperature chart (H4): the reading over the last minutes and the alert threshold. */
export function TempChart({ sim, tagId, limit }: { sim: Simulation; tagId: string; limit?: number }) {
  useSimTick(4);
  const ref = useRef<HTMLCanvasElement>(null);
  const data = sensorHistory(sim, tagId);
  const last = data[data.length - 1];
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pts = data.slice(-240);
    const vals = pts.map((p) => p.v).concat(limit ?? []);
    const lo = Math.min(...vals, 2) - 0.5;
    const hi = Math.max(...vals, 9) + 0.5;
    const t0 = pts[0]?.t ?? 0;
    const t1 = Math.max((pts[pts.length - 1]?.t ?? 1) - t0, 1);
    const x = (t: number) => ((t - t0) / t1) * (w - 8) + 4;
    const y = (v: number) => h - 4 - ((v - lo) / (hi - lo)) * (h - 8);
    if (limit !== undefined) {
      ctx.strokeStyle = brand.overlay.warning;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(4, y(limit));
      ctx.lineTo(w - 4, y(limit));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = brand.overlay.data;
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(x(p.t), y(p.v)) : ctx.moveTo(x(p.t), y(p.v))));
    ctx.stroke();
  });
  return (
    <figure className="temp-chart" data-testid="temp-chart">
      <figcaption>
        {ui.dashboard.temperature}: <strong>{last ? `${last.v.toFixed(1)} °C` : '...'}</strong>
      </figcaption>
      <canvas ref={ref} aria-hidden="true" />
    </figure>
  );
}
