import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  Color,
  DataTexture,
  LinearFilter,
  MeshBasicMaterial,
  PlaneGeometry,
  RGBAFormat,
  UnsignedByteType,
} from 'three';
import { brand } from '../../brand/brand';
import { useExperience } from '../../experience/store';
import type { Simulation } from '../../sim/engine';
import type { WorldDef } from '../../sim/world';
import { HEATMAP_CELL_M, HeatmapGrid } from './heatmap';

/** Colour ramp from the brand heatmap tokens, sampled into a lookup table. */
function ramp(): Uint8Array {
  const stops = brand.overlay.heatmap.map((c) => new Color(c));
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const f = (i / 255) * (stops.length - 1);
    const k = Math.min(Math.floor(f), stops.length - 2);
    const a = stops[k];
    const b = stops[k + 1];
    if (!a || !b) continue;
    const c = a.clone().lerp(b, f - k);
    lut[i * 3] = Math.round(c.r * 255);
    lut[i * 3 + 1] = Math.round(c.g * 255);
    lut[i * 3 + 2] = Math.round(c.b * 255);
  }
  return lut;
}

class HeatmapLayer {
  readonly grid: HeatmapGrid;
  readonly texture: DataTexture;
  readonly geometry: PlaneGeometry;
  readonly material: MeshBasicMaterial;
  private readonly pixels: Uint8Array;
  private readonly lut = ramp();

  constructor(
    private readonly sim: Simulation,
    world: WorldDef,
    bounds: { x0: number; y0: number; x1: number; y1: number },
  ) {
    this.grid = new HeatmapGrid(world, bounds);
    const { cols, rows } = this.grid;
    this.pixels = new Uint8Array(cols * rows * 4);
    this.texture = new DataTexture(this.pixels, cols, rows, RGBAFormat, UnsignedByteType);
    this.texture.magFilter = LinearFilter;
    this.texture.minFilter = LinearFilter;
    this.texture.needsUpdate = true;
    const w = cols * HEATMAP_CELL_M;
    const h = rows * HEATMAP_CELL_M;
    // Plan (x, y) maps to three (x, -z): facing up, texture row 0 lands on the plan's smallest y.
    this.geometry = new PlaneGeometry(w, h)
      .rotateX(-Math.PI / 2)
      // Above the painted lines (FLOOR_LAYERS.lines), below the overlay marks.
      .translate(this.grid.x0 + w / 2, 0.045, -(this.grid.y0 + h / 2));
    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
  }

  update(): void {
    if (!this.grid.sample(this.sim)) return;
    const { values, max } = this.grid;
    const px = this.pixels;
    for (let i = 0; i < values.length; i++) {
      const v = max > 0 ? Math.sqrt((values[i] ?? 0) / max) : 0;
      const k = Math.min(255, Math.round(v * 255));
      px[i * 4] = this.lut[k * 3] ?? 0;
      px[i * 4 + 1] = this.lut[k * 3 + 1] ?? 0;
      px[i * 4 + 2] = this.lut[k * 3 + 2] ?? 0;
      px[i * 4 + 3] = v < 0.04 ? 0 : Math.round(60 + 150 * v);
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Dwell heatmap on the floor, accumulated while the scene runs and shown when switched on. */
export function Heatmap({
  sim,
  world,
  bounds,
}: {
  sim: Simulation;
  world: WorldDef;
  bounds: { x0: number; y0: number; x1: number; y1: number };
}) {
  const layer = useMemo(() => new HeatmapLayer(sim, world, bounds), [sim, world, bounds]);
  useEffect(() => () => layer.dispose(), [layer]);
  const visible = useExperience((s) => s.heatmap && s.layers.insight);
  useFrame(() => layer.update());
  return <mesh geometry={layer.geometry} material={layer.material} visible={visible} renderOrder={1} />;
}
