import type { Simulation } from '../../sim/engine';
import { pointInPolygon } from '../../sim/geometry';
import type { WorldDef } from '../../sim/world';

/** Grid cell size (m). */
export const HEATMAP_CELL_M = 0.5;
/** Sampling interval in simulation time (s). */
const SAMPLE_S = 1;

/**
 * Dwell heatmap (SPEC section 5, Insight): time tags spend at each place, accumulated from what the system
 * reports, never from ground truth. Coordinate reports (RSSI, AoA) are spread over their uncertainty;
 * room-level BiLink reports are spread evenly over the room, because that is all the system knows.
 */
export class HeatmapGrid {
  readonly x0: number;
  readonly y0: number;
  readonly cols: number;
  readonly rows: number;
  readonly values: Float32Array;
  private lastSample = -Infinity;
  private roomCells = new Map<string, number[]>();
  max = 0;

  constructor(
    private readonly world: WorldDef,
    bounds: { x0: number; y0: number; x1: number; y1: number },
  ) {
    this.x0 = bounds.x0;
    this.y0 = bounds.y0;
    this.cols = Math.ceil((bounds.x1 - bounds.x0) / HEATMAP_CELL_M);
    this.rows = Math.ceil((bounds.y1 - bounds.y0) / HEATMAP_CELL_M);
    this.values = new Float32Array(this.cols * this.rows);
  }

  private cellsOfRoom(roomId: string): number[] {
    let cells = this.roomCells.get(roomId);
    if (cells) return cells;
    cells = [];
    const zone = this.world.zones.find((z) => z.id === roomId);
    if (zone) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const p = {
            x: this.x0 + (c + 0.5) * HEATMAP_CELL_M,
            y: this.y0 + (r + 0.5) * HEATMAP_CELL_M,
          };
          if (pointInPolygon(p, zone.polygon)) cells.push(r * this.cols + c);
        }
      }
    }
    this.roomCells.set(roomId, cells);
    return cells;
  }

  private add(i: number, w: number): void {
    const v = (this.values[i] ?? 0) + w;
    this.values[i] = v;
    if (v > this.max) this.max = v;
  }

  /** Adds one sample per located tag if a sampling interval has passed. Returns true if it sampled. */
  sample(sim: Simulation): boolean {
    if (sim.time - this.lastSample < SAMPLE_S) return false;
    this.lastSample = sim.time;
    for (const r of sim.reports().values()) {
      if (r.held) continue;
      if (r.position) {
        const radius = Math.min(Math.max(r.uncertaintyM ?? 1, 0.75), 3);
        const cx = (r.position.x - this.x0) / HEATMAP_CELL_M;
        const cy = (r.position.y - this.y0) / HEATMAP_CELL_M;
        const rc = Math.ceil(radius / HEATMAP_CELL_M);
        const s2 = (radius / HEATMAP_CELL_M / 2) ** 2;
        let total = 0;
        const hits: Array<[number, number]> = [];
        for (let dy = -rc; dy <= rc; dy++) {
          for (let dx = -rc; dx <= rc; dx++) {
            const c = Math.floor(cx) + dx;
            const row = Math.floor(cy) + dy;
            if (c < 0 || row < 0 || c >= this.cols || row >= this.rows) continue;
            const d2 = (c + 0.5 - cx) ** 2 + (row + 0.5 - cy) ** 2;
            const w = Math.exp(-d2 / (2 * s2));
            total += w;
            hits.push([row * this.cols + c, w]);
          }
        }
        for (const [i, w] of hits) this.add(i, w / (total || 1));
      } else if (r.roomId) {
        const cells = this.cellsOfRoom(r.roomId);
        for (const i of cells) this.add(i, 1 / cells.length);
      }
    }
    return true;
  }
}
