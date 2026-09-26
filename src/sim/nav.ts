import { dist2, type Vec2 } from './geometry';
import type { NavGraph } from './world';

/** Shortest paths on the navigation graph (Dijkstra; graphs are small). */
export class Navigator {
  private readonly pos = new Map<string, Vec2>();
  private readonly adj = new Map<string, Array<{ to: string; w: number }>>();

  constructor(graph: NavGraph) {
    for (const n of graph.nodes) {
      this.pos.set(n.id, n.p);
      this.adj.set(n.id, []);
    }
    for (const [a, b] of graph.edges) {
      const pa = this.pos.get(a);
      const pb = this.pos.get(b);
      if (!pa || !pb) throw new Error(`nav edge ${a}-${b} references a missing node`);
      const w = dist2(pa, pb);
      this.adj.get(a)?.push({ to: b, w });
      this.adj.get(b)?.push({ to: a, w });
    }
  }

  has(id: string): boolean {
    return this.pos.has(id);
  }

  position(id: string): Vec2 {
    const p = this.pos.get(id);
    if (!p) throw new Error(`unknown nav node ${id}`);
    return p;
  }

  nearest(p: Vec2): string {
    let best = '';
    let bestD = Infinity;
    for (const [id, q] of this.pos) {
      const d = dist2(p, q);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  /** Node ids from `from` to `to`, inclusive. Throws if unreachable. */
  path(from: string, to: string): string[] {
    if (from === to) return [from];
    const distances = new Map<string, number>([[from, 0]]);
    const prev = new Map<string, string>();
    const open = new Set<string>([from]);
    while (open.size > 0) {
      let current = '';
      let currentD = Infinity;
      for (const id of open) {
        const d = distances.get(id) ?? Infinity;
        if (d < currentD) {
          currentD = d;
          current = id;
        }
      }
      open.delete(current);
      if (current === to) break;
      for (const { to: next, w } of this.adj.get(current) ?? []) {
        const nd = currentD + w;
        if (nd < (distances.get(next) ?? Infinity)) {
          distances.set(next, nd);
          prev.set(next, current);
          open.add(next);
        }
      }
    }
    if (!prev.has(to)) throw new Error(`no nav path from ${from} to ${to}`);
    const out = [to];
    let cur = to;
    while (cur !== from) {
      cur = prev.get(cur) as string;
      out.push(cur);
    }
    return out.reverse();
  }

  /** Every node reachable from `start`. Used by scene validation tests. */
  reachable(start: string): Set<string> {
    const seen = new Set<string>([start]);
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop() as string;
      for (const { to } of this.adj.get(cur) ?? []) {
        if (!seen.has(to)) {
          seen.add(to);
          stack.push(to);
        }
      }
    }
    return seen;
  }
}
