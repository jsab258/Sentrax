import { Vector3, type Camera } from 'three';

/**
 * In-scene labels as DOM elements (crisp brand typography, no texture cost). Layers describe the labels
 * they want each frame; the bridge projects them and updates the DOM directly, without React renders.
 */
export type LabelKind = 'asset' | 'card' | 'protocol' | 'state' | 'lens';

export interface LabelSpec {
  id: string;
  kind: LabelKind;
  /** World position (three.js coordinates). */
  at: Vector3;
  title: string;
  lines?: string[];
  /** Visual accent: technology or status. */
  tone?: 'rssi' | 'aoa' | 'bilink' | 'data' | 'insight' | 'warning' | 'critical' | 'ok';
}

const _v = new Vector3();

class LabelBridge {
  private container: HTMLElement | null = null;
  private nodes = new Map<string, { el: HTMLElement; key: string }>();
  private pending: LabelSpec[] = [];

  attach(el: HTMLElement | null): void {
    this.container = el;
    if (!el) this.nodes.clear();
  }

  begin(): void {
    this.pending = [];
  }

  add(spec: LabelSpec): void {
    this.pending.push(spec);
  }

  /** Projects and places every label added since begin(); removes the rest. */
  flush(camera: Camera, width: number, height: number): void {
    const root = this.container;
    if (!root) return;
    const seen = new Set<string>();
    for (const spec of this.pending) {
      seen.add(spec.id);
      _v.copy(spec.at).project(camera);
      const behind = _v.z > 1 || _v.z < -1;
      let entry = this.nodes.get(spec.id);
      const key = `${spec.kind}|${spec.tone ?? ''}|${spec.title}|${(spec.lines ?? []).join('|')}`;
      if (!entry) {
        const el = document.createElement('div');
        el.dataset.labelId = spec.id;
        root.appendChild(el);
        entry = { el, key: '' };
        this.nodes.set(spec.id, entry);
      }
      if (entry.key !== key) {
        entry.el.className = `scene-label scene-label-${spec.kind}${spec.tone ? ` tone-${spec.tone}` : ''}`;
        entry.el.replaceChildren();
        const t = document.createElement('strong');
        t.textContent = spec.title;
        entry.el.appendChild(t);
        for (const line of spec.lines ?? []) {
          const l = document.createElement('span');
          l.textContent = line;
          entry.el.appendChild(l);
        }
        entry.key = key;
      }
      const x = (_v.x * 0.5 + 0.5) * width;
      const y = (-_v.y * 0.5 + 0.5) * height;
      entry.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      entry.el.style.visibility = behind ? 'hidden' : 'visible';
    }
    for (const [id, entry] of this.nodes) {
      if (!seen.has(id)) {
        entry.el.remove();
        this.nodes.delete(id);
      }
    }
  }
}

export const labelBridge = new LabelBridge();
