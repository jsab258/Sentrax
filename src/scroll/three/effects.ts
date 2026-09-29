import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  QuadraticBezierCurve3,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector3,
  type Material,
} from 'three';
import type { WorldDef } from '../../sim/world';
import type { StoryState } from '../state';
import type { PlanPoint } from '../stories/types';
import { glow, type Look } from './looks';
import { P, type Props } from './props';

/** Sets a float uniform (the uniforms record is untyped, so each access is checked). */
function setU(m: ShaderMaterial, name: string, value: number): void {
  const u = m.uniforms[name];
  if (u) u.value = value;
}

const smooth = (v: number) => {
  const x = Math.min(1, Math.max(0, v));
  return x * x * (3 - 2 * x);
};

function radialTexture(ring: boolean): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    if (ring) {
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.72, 'rgba(255,255,255,0)');
      grd.addColorStop(0.86, 'rgba(255,255,255,1)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
    }
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(c);
}

const volumeVertex = /* glsl */ `
varying vec3 vLocal;
varying vec3 vNormalW;
void main() {
  vLocal = position;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const volumeFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uFill;
uniform float uHeight;
uniform float uStrength;
varying vec3 vLocal;
varying vec3 vNormalW;
void main() {
  float h = vLocal.y / uHeight;
  float level = uFill;
  if (h > level) discard;
  // Brighter towards the floor and at the rising surface, with glowing vertical edges.
  float surface = smoothstep(level - 0.08, level, h) * 1.4;
  float body = mix(0.22, 0.05, h);
  // Side faces only: the lid would hide the room, the base would sit on the floor.
  if (abs(vNormalW.y) > 0.5) discard;
  float top = 1.0;
  float a = (body + surface) * top * uStrength;
  gl_FragColor = vec4(uColor * a, a);
}`;

const trailVertex = /* glsl */ `
varying float vU;
void main() {
  vU = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const trailFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uHead;
uniform float uStrength;
varying float vU;
void main() {
  float d = uHead - vU;
  float tail = d >= 0.0 ? exp(-d * 9.0) : 0.0;
  float head = exp(-abs(d) * 40.0) * 2.2;
  float path = 0.18;
  float a = (path + tail + head) * uStrength;
  gl_FragColor = vec4(uColor * a, a);
}`;

const streamVertex = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aEnd;
attribute float aOffset;
uniform float uPhase;
uniform float uSize;
uniform float uLift;
varying float vFade;
void main() {
  float t = fract(uPhase * 0.6 + aOffset);
  vec3 mid = mix(aStart, aEnd, 0.5) + vec3(0.0, uLift, 0.0);
  vec3 p = mix(mix(aStart, mid, t), mix(mid, aEnd, t), t);
  vFade = sin(t * 3.14159);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (8.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const streamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying float vFade;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = dot(c, c) * 4.0;
  float a = exp(-r * 3.0) * vFade * uStrength;
  gl_FragColor = vec4(uColor * a, a);
}`;

const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
void main() {
  float fade = pow(1.0 - vUv.y, 1.6);
  float edge = 0.55 + 0.45 * sin(vUv.x * 6.2831 * 3.0);
  float a = fade * uStrength * (0.6 + 0.4 * edge);
  gl_FragColor = vec4(uColor * a, a);
}`;

const beamVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

interface Pulse {
  core: Sprite;
  /** Flat ripples spreading out from the source. */
  rings: Mesh[];
}

/**
 * The story's signals (SCROLL-SPEC.md section 4): tag pulses, room volumes filling with light, anchor
 * pulses, relay light trails, the particle data stream to SOLIX and the found beam. Everything is driven
 * by the story state, so the same scroll position always shows the same effects.
 */
export class Effects {
  readonly group = new Group();
  private readonly materials: Material[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly glowTex = radialTexture(false);
  private readonly ringTex = radialTexture(true);
  private readonly ringGeo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly rooms = new Map<string, { mesh: Mesh; mat: ShaderMaterial }>();
  private readonly anchors = new Map<string, Pulse>();
  private readonly pulses: Pulse[] = [];
  private readonly arcs = new Map<string, { mesh: Mesh; mat: ShaderMaterial }>();
  private readonly stream: { points: Points; mat: ShaderMaterial; links: Mesh[]; linkMat: MeshBasicMaterial };
  private readonly solix: {
    group: Group;
    mats: Array<{ m: MeshBasicMaterial | SpriteMaterial; base: number }>;
  };
  private readonly beam: { group: Group; mat: ShaderMaterial; spot: Sprite; ring: Sprite };
  private readonly unassigned: Pulse;
  private readonly devicePos = new Map<string, Vector3>();
  private readonly tmp = new Vector3();

  constructor(
    readonly look: Look,
    readonly world: WorldDef,
    readonly props: Props,
    readonly solixAt: PlanPoint,
    /** Tag the find marks with the beam. */
    readonly findTagId: string,
  ) {
    // In the model looks the devices sit on top of the (lowered) walls.
    const top = look.wallHeight ?? Infinity;
    for (const d of world.devices)
      this.devicePos.set(d.id, P(d.position.x, d.position.y, Math.min(d.position.z, top)));
    const radio = glow(look.signal.radio, 1.7);
    const data = glow(look.signal.data, 2);

    // Room volumes.
    for (const z of world.zones) {
      if (z.kind !== 'room' || z.parent) continue;
      const xs = z.polygon.map((p) => p.x);
      const ys = z.polygon.map((p) => p.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const height = Math.min(2.3, (look.wallHeight ?? 2.4) - 0.05);
      // Inset from the walls so the volume's faces never coincide with wall faces (no z-fighting).
      const geo = boxGeometry(x1 - x0 - 0.7, height, y1 - y0 - 0.7);
      const mat = new ShaderMaterial({
        vertexShader: volumeVertex,
        fragmentShader: volumeFragment,
        uniforms: {
          uColor: { value: radio.clone() },
          uFill: { value: 0 },
          uHeight: { value: height },
          uStrength: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        toneMapped: false,
      });
      const mesh = new Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 5;
      mesh.position.set((x0 + x1) / 2, 0.06, -(y0 + y1) / 2);
      this.group.add(mesh);
      this.rooms.set(z.id, { mesh, mat });
      this.materials.push(mat);
      this.geometries.push(geo);
    }

    // Anchor pulses at every room anchor.
    for (const d of world.devices) {
      if (d.kind !== 'anchor') continue;
      const p = this.makePulse(radio, 0.5);
      p.core.position.copy(this.devicePos.get(d.id) as Vector3);
      for (const r of p.rings) r.position.copy(p.core.position);
      this.anchors.set(d.id, p);
    }

    // Relay trails from room anchors to their gateways.
    for (const [anchorId, gatewayId] of Object.entries(props.timeline.data.gateways)) {
      const a = this.devicePos.get(anchorId);
      const g = this.devicePos.get(gatewayId);
      if (!a || !g) continue;
      const mid = a
        .clone()
        .lerp(g, 0.5)
        .add(new Vector3(0, 1.6, 0));
      const curve = new QuadraticBezierCurve3(a, mid, g);
      const geo = new TubeGeometry(curve, 64, 0.07, 8, false);
      const mat = new ShaderMaterial({
        vertexShader: trailVertex,
        fragmentShader: trailFragment,
        uniforms: { uColor: { value: radio.clone() }, uHead: { value: 0 }, uStrength: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      });
      const mesh = new Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 6;
      this.group.add(mesh);
      this.arcs.set(anchorId, { mesh, mat });
      this.materials.push(mat);
      this.geometries.push(geo);
    }

    // Data stream: particles from the corridor gateways up to SOLIX.
    const solix = P(...solixAt);
    const gateways = [...new Set(Object.values(props.timeline.data.gateways))]
      .map((id) => this.devicePos.get(id))
      .filter((v): v is Vector3 => !!v);
    const perGateway = 90;
    const n = gateways.length * perGateway;
    const starts = new Float32Array(n * 3);
    const ends = new Float32Array(n * 3);
    const offsets = new Float32Array(n);
    gateways.forEach((g, gi) => {
      for (let i = 0; i < perGateway; i++) {
        const k = gi * perGateway + i;
        starts.set([g.x, g.y, g.z], k * 3);
        ends.set([solix.x, solix.y, solix.z], k * 3);
        // Deterministic spread (no random numbers: the same frame at the same scroll position).
        offsets[k] = (((i * 0.618034 + gi * 0.31) % 1) + 1) % 1;
      }
    });
    const sgeo = new BufferGeometry();
    sgeo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    sgeo.setAttribute('aStart', new BufferAttribute(starts, 3));
    sgeo.setAttribute('aEnd', new BufferAttribute(ends, 3));
    sgeo.setAttribute('aOffset', new BufferAttribute(offsets, 1));
    const smat = new ShaderMaterial({
      vertexShader: streamVertex,
      fragmentShader: streamFragment,
      uniforms: {
        uColor: { value: data.clone() },
        uPhase: { value: 0 },
        uSize: { value: 26 },
        uLift: { value: 3 },
        uStrength: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const points = new Points(sgeo, smat);
    points.frustumCulled = false;
    points.visible = false;
    points.renderOrder = 7;
    this.group.add(points);
    const linkMat = new MeshBasicMaterial({
      color: data.clone().multiplyScalar(0.5),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const links = gateways.map((g) => {
      const mid = g
        .clone()
        .lerp(solix, 0.5)
        .add(new Vector3(0, 3, 0));
      const geo = new TubeGeometry(new QuadraticBezierCurve3(g, mid, solix), 40, 0.03, 5, false);
      this.geometries.push(geo);
      const m = new Mesh(geo, linkMat);
      m.visible = false;
      this.group.add(m);
      return m;
    });
    this.stream = { points, mat: smat, links, linkMat };
    this.materials.push(smat, linkMat);
    this.geometries.push(sgeo);

    // SOLIX node: a glowing core in a wire shell above the building.
    const sg = new Group();
    sg.position.copy(solix);
    const shellGeo = new IcosahedronGeometry(1.1, 1);
    const shellMat = new MeshBasicMaterial({
      color: data.clone(),
      wireframe: true,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    });
    const coreGeo = new IcosahedronGeometry(0.45, 2);
    const coreMat = new MeshBasicMaterial({
      color: data.clone().multiplyScalar(1.6),
      transparent: true,
      opacity: 0,
      toneMapped: false,
    });
    const halo = new Sprite(
      new SpriteMaterial({
        map: this.glowTex,
        color: data.clone(),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    halo.scale.setScalar(5);
    sg.add(new Mesh(shellGeo, shellMat), new Mesh(coreGeo, coreMat), halo);
    sg.visible = false;
    this.group.add(sg);
    this.solix = {
      group: sg,
      mats: [
        { m: shellMat, base: 0.9 },
        { m: coreMat, base: 1 },
        { m: halo.material, base: 0.8 },
      ],
    };
    this.materials.push(shellMat, coreMat, halo.material);
    this.geometries.push(shellGeo, coreGeo);

    // Found beam (button red, only for this).
    const red = glow(look.signal.found, 2);
    const bgeo = new CylinderGeometry(0.42, 0.42, 7, 32, 1, true);
    bgeo.translate(0, 3.5, 0);
    const bmat = new ShaderMaterial({
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      uniforms: { uColor: { value: red.clone() }, uStrength: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
    });
    const bg = new Group();
    const spot = new Sprite(
      new SpriteMaterial({
        map: this.glowTex,
        color: red.clone(),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    spot.scale.setScalar(1.2);
    spot.position.y = 0.9;
    const ring = new Sprite(
      new SpriteMaterial({
        map: this.ringTex,
        color: red.clone(),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    bg.add(new Mesh(bgeo, bmat), spot, ring);
    bg.visible = false;
    this.group.add(bg);
    this.beam = { group: bg, mat: bmat, spot, ring };
    this.materials.push(bmat, spot.material, ring.material);
    this.geometries.push(bgeo);

    this.unassigned = this.makePulse(glow(look.signal.unassigned, 1.2), 0.6);
  }

  private makePulse(color: Color, size: number): Pulse {
    const opts = {
      color: color.clone(),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    };
    const coreMat = new SpriteMaterial({ map: this.glowTex, ...opts });
    const core = new Sprite(coreMat);
    core.visible = false;
    core.scale.setScalar(size);
    this.group.add(core);
    this.materials.push(coreMat);
    const rings = [0, 1, 2].map(() => {
      const m = new MeshBasicMaterial({ map: this.ringTex, side: DoubleSide, ...opts });
      this.materials.push(m);
      const r = new Mesh(this.ringGeo, m);
      r.visible = false;
      this.group.add(r);
      return r;
    });
    return { core, rings };
  }

  private showPulse(p: Pulse, at: Vector3, strength: number, phase: number, size: number): void {
    p.core.visible = strength > 0.01;
    p.core.position.copy(at);
    (p.core.material as SpriteMaterial).opacity = strength;
    p.core.scale.setScalar(size * (0.9 + 0.1 * Math.sin(phase * Math.PI * 2)));
    p.rings.forEach((r, i) => {
      const f = (((phase + i / 3) % 1) + 1) % 1;
      r.visible = strength > 0.01;
      r.position.copy(at);
      r.scale.setScalar(size * (0.5 + f * 3));
      (r.material as MeshBasicMaterial).opacity = strength * (1 - f) * (1 - f) * 0.9;
    });
  }

  private hidePulse(p: Pulse): void {
    p.core.visible = false;
    for (const r of p.rings) r.visible = false;
  }

  update(state: StoryState): void {
    const fx = state.fx;
    // Tag pulses (reuse a pool).
    fx.pulses.forEach((pulse, i) => {
      let p = this.pulses[i];
      if (!p) {
        p = this.makePulse(glow(this.look.signal.radio, 1.8), 0.35);
        this.pulses.push(p);
      }
      const at = this.props.tagPosition(pulse.tagId, state.t, this.tmp);
      if (at) this.showPulse(p, at, pulse.strength, pulse.phase, 0.4);
      else this.hidePulse(p);
    });
    for (let i = fx.pulses.length; i < this.pulses.length; i++) this.hidePulse(this.pulses[i] as Pulse);

    for (const [id, r] of this.rooms) {
      const v = fx.rooms[id] ?? 0;
      r.mesh.visible = v > 0.005;
      setU(r.mat, 'uFill', 0.15 + 0.85 * smooth(v));
      setU(r.mat, 'uStrength', v * this.look.signalGain);
    }
    for (const [id, p] of this.anchors) {
      const v = fx.anchors[id] ?? 0;
      if (v > 0.01) this.showPulse(p, this.devicePos.get(id) as Vector3, v, fx.anchorPhase, 0.6);
      else this.hidePulse(p);
    }
    const shownArcs = new Set<string>();
    for (const a of fx.arcs) {
      const arc = this.arcs.get(a.anchorId);
      if (!arc) continue;
      shownArcs.add(a.anchorId);
      arc.mesh.visible = a.strength > 0.01;
      setU(arc.mat, 'uHead', a.head);
      setU(arc.mat, 'uStrength', a.strength * this.look.signalGain);
    }
    for (const [id, arc] of this.arcs) if (!shownArcs.has(id)) arc.mesh.visible = false;

    const s = fx.stream.strength;
    this.stream.points.visible = s > 0.01;
    setU(this.stream.mat, 'uStrength', s);
    setU(this.stream.mat, 'uPhase', fx.stream.phase);
    this.stream.linkMat.opacity = s * 0.5;
    for (const l of this.stream.links) l.visible = s > 0.01;
    const node = Math.max(s, state.beat >= 3 ? 0.35 : 0) * (state.beat >= 3 ? 1 : s);
    this.solix.group.visible = node > 0.01;
    for (const { m, base } of this.solix.mats) m.opacity = node * base;
    this.solix.group.rotation.y = fx.stream.phase * 0.8;

    // Unassigned tag in the corridor.
    const u = fx.unassigned[0];
    const uat = u ? this.props.tagPosition(u.tagId, state.t, new Vector3()) : null;
    if (u && uat) this.showPulse(this.unassigned, uat, u.strength * 0.8, state.local * 3, 0.45);
    else this.hidePulse(this.unassigned);

    // The find.
    const b = fx.beam;
    this.beam.group.visible = b > 0.01;
    if (b > 0.01) {
      const at = this.props.tagPosition(this.findTagId, state.t, new Vector3());
      if (at) this.beam.group.position.set(at.x, 0, at.z);
      setU(this.beam.mat, 'uStrength', b);
      (this.beam.spot.material as SpriteMaterial).opacity = b;
      const f = (((state.find * 2.5) % 1) + 1) % 1;
      this.beam.ring.position.y = 0.05;
      this.beam.ring.scale.setScalar(1 + f * 3);
      (this.beam.ring.material as SpriteMaterial).opacity = b * (1 - f);
    }
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
    for (const g of this.geometries) g.dispose();
    this.glowTex.dispose();
    this.ringTex.dispose();
    this.ringGeo.dispose();
  }
}

/** Box without the degenerate caps problem: 6 faces, local origin at the centre. */
function boxGeometry(w: number, h: number, d: number): BufferGeometry {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const faces: Array<[number[], number[]]> = [
    [
      [hw, -hh, -hd, hw, hh, -hd, hw, hh, hd, hw, -hh, hd],
      [1, 0, 0],
    ],
    [
      [-hw, -hh, hd, -hw, hh, hd, -hw, hh, -hd, -hw, -hh, -hd],
      [-1, 0, 0],
    ],
    [
      [-hw, hh, -hd, -hw, hh, hd, hw, hh, hd, hw, hh, -hd],
      [0, 1, 0],
    ],
    [
      [-hw, -hh, hd, hw, -hh, hd, hw, hh, hd, -hw, hh, hd],
      [0, 0, 1],
    ],
    [
      [hw, -hh, -hd, -hw, -hh, -hd, -hw, hh, -hd, hw, hh, -hd],
      [0, 0, -1],
    ],
  ];
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  faces.forEach(([v, n], f) => {
    pos.push(...v);
    for (let i = 0; i < 4; i++) nor.push(...n);
    const b = f * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  geo.setIndex(idx);
  // Local y from 0 (floor) to h.
  geo.translate(0, hh, 0);
  return geo;
}
