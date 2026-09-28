import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { devToolsEnabled } from '../app/devtools';
import { useExperience } from '../experience/store';
import type { Simulation } from '../sim/engine';
import type { WorldDef } from '../sim/world';
import { cameraApi } from './cameraApi';
import type { Elevation } from './elevation';

type Hit = { kind: 'asset' | 'agent' | 'device'; id: string };

/** Screen distance (px) within which a press picks a person, a tagged asset or a device. */
const PICK_PX = 22;
/** Pointer travel (px) after which a press is a drag rather than a click. */
const DRAG_PX = 4;

const _v = new Vector3();
const _ndc = new Vector2();
const _ray = new Raycaster();
const _floor = new Plane(new Vector3(0, 1, 0), 0);
const _hit = new Vector3();

/**
 * Explore mode interaction (SPEC section 4): drag any tagged asset or person across the floor, click a
 * device for its product card, click a person or asset to follow its tag. Picks by screen distance to
 * the rendered positions, so small tags are easy to grab on a phone too.
 */
export function Picker({ sim, world, ground }: { sim: Simulation; world: WorldDef; ground: Elevation }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const mode = useExperience((s) => s.mode);

  useEffect(() => {
    if (mode !== 'sandbox') return;
    const el = gl.domElement;
    const tagOf = new Map(world.tags.map((t) => [t.carrier.id, t.id]));

    const screen = (x: number, y: number, h: number, rect: DOMRect) => {
      _v.set(x, h + ground(x, y), -y).project(camera);
      if (_v.z > 1) return null;
      return { x: ((_v.x + 1) / 2) * rect.width, y: ((1 - _v.y) / 2) * rect.height };
    };

    const pick = (clientX: number, clientY: number): Hit | null => {
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      let best: Hit | null = null;
      let bestD = PICK_PX;
      const consider = (hit: Hit, x: number, y: number, h: number) => {
        const s = screen(x, y, h, rect);
        if (!s) return;
        const d = Math.hypot(s.x - px, s.y - py);
        if (d < bestD) {
          bestD = d;
          best = hit;
        }
      };
      for (const d of world.devices)
        consider({ kind: 'device', id: d.id }, d.position.x, d.position.y, d.position.z);
      for (const a of sim.agents.assets.values())
        if (tagOf.has(a.id) && a.cls !== 'trailer')
          consider({ kind: 'asset', id: a.id }, a.pos.x, a.pos.y, a.pos.z + 0.6);
      for (const a of sim.agents.agents.values())
        if (a.kind === 'person' && a.mode !== 'riding' && tagOf.has(a.id))
          consider({ kind: 'agent', id: a.id }, a.pos.x, a.pos.y, 1.0);
      return best;
    };

    const floorAt = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      _ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      _ray.setFromCamera(_ndc, camera);
      return _ray.ray.intersectPlane(_floor, _hit) ? { x: _hit.x, y: -_hit.z } : null;
    };

    let press: (Hit & { x: number; y: number; moved: boolean; pointer: number }) | null = null;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const hit = pick(e.clientX, e.clientY);
      if (!hit) return;
      // Ours: the camera controls do not see this press.
      e.stopImmediatePropagation();
      e.preventDefault();
      press = { ...hit, x: e.clientX, y: e.clientY, moved: false, pointer: e.pointerId };
      el.setPointerCapture(e.pointerId);
      cameraApi.setEnabled?.(false);
    };

    const onMove = (e: PointerEvent) => {
      if (!press) {
        if (e.pointerType === 'mouse') el.style.cursor = pick(e.clientX, e.clientY) ? 'grab' : '';
        return;
      }
      e.stopImmediatePropagation();
      if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_PX) return;
      press.moved = true;
      if (press.kind === 'device') return;
      el.style.cursor = 'grabbing';
      const p = floorAt(e.clientX, e.clientY);
      if (!p) return;
      if (press.kind === 'asset')
        sim.command({ type: 'moveAsset', assetId: press.id, to: { x: p.x, y: p.y, z: 0 } });
      else sim.command({ type: 'moveAgent', agentId: press.id, to: p });
    };

    const onUp = (e: PointerEvent) => {
      if (!press) return;
      e.stopImmediatePropagation();
      if (el.hasPointerCapture(press.pointer)) el.releasePointerCapture(press.pointer);
      const { kind, id, moved } = press;
      press = null;
      el.style.cursor = '';
      cameraApi.setEnabled?.(true);
      const store = useExperience.getState();
      if (kind === 'device') {
        if (!moved) store.set({ inspectDevice: id });
        return;
      }
      const tag = tagOf.get(id) ?? null;
      store.set({ selectedTag: moved || store.selectedTag !== tag ? tag : null });
    };

    // Dev tool: screen position of a person, asset or device (end-to-end tests drag and click with it).
    const dbg = devToolsEnabled
      ? (window as unknown as { __sentrax?: Record<string, unknown> }).__sentrax
      : undefined;
    if (dbg)
      dbg.screenOf = (kind: Hit['kind'], id: string) => {
        const rect = el.getBoundingClientRect();
        let at: { x: number; y: number; h: number } | undefined;
        if (kind === 'device') {
          const d = world.devices.find((x) => x.id === id);
          if (d) at = { x: d.position.x, y: d.position.y, h: d.position.z };
        } else if (kind === 'asset') {
          const a = sim.agents.assets.get(id);
          if (a) at = { x: a.pos.x, y: a.pos.y, h: a.pos.z + 0.6 };
        } else {
          const a = sim.agents.agents.get(id);
          if (a) at = { x: a.pos.x, y: a.pos.y, h: 1.0 };
        }
        if (!at) return null;
        const sp = screen(at.x, at.y, at.h, rect);
        return sp ? { x: rect.left + sp.x, y: rect.top + sp.y } : null;
      };

    el.addEventListener('pointerdown', onDown, { capture: true });
    el.addEventListener('pointermove', onMove, { capture: true });
    el.addEventListener('pointerup', onUp, { capture: true });
    el.addEventListener('pointercancel', onUp, { capture: true });
    return () => {
      el.removeEventListener('pointerdown', onDown, { capture: true });
      el.removeEventListener('pointermove', onMove, { capture: true });
      el.removeEventListener('pointerup', onUp, { capture: true });
      el.removeEventListener('pointercancel', onUp, { capture: true });
      el.style.cursor = '';
      cameraApi.setEnabled?.(true);
    };
  }, [mode, gl, camera, sim, world, ground]);
  return null;
}
