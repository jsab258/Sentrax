import { Matrix4, Quaternion, Vector3 } from 'three';
import { BODY, type PartName } from './mannequin';

/**
 * Pose maths for the mannequin: joint transforms for walk, idle, push and lying poses. Pure functions,
 * so any renderer (the instanced mannequin today, skinned figures later) can use them.
 */

export type Pose = 'idle' | 'walk' | 'push' | 'lie' | 'sit';

export interface CharacterState {
  id: string;
  role: string;
  /** Three.js position of the feet (x, y up, z). */
  position: Vector3;
  /** Heading about +y in radians (plan heading). */
  yaw: number;
  pose: Pose;
  /** Walk cycle phase in radians. */
  phase: number;
  /** Seconds, for idle breathing and sway. */
  time: number;
}

export type Side = 'L' | 'R';

export interface PoseResult {
  /** Joint transforms; a lying figure's legs are collapsed (they stay under the blanket). */
  parts: Array<{ part: PartName; matrix: Matrix4 }>;
  /** Badge position on the chest (front of the torso). */
  chest: Matrix4;
  /** Left wrist (for the SOS wearable). */
  wrist: Matrix4;
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const _q = new Quaternion();
const _one = new Vector3(1, 1, 1);
const HIDDEN = new Vector3(0, 0, 0);

function tr(x: number, y: number, z: number): Matrix4 {
  return new Matrix4().makeTranslation(x, y, z);
}
function rot(axis: Vector3, a: number): Matrix4 {
  return new Matrix4().makeRotationAxis(axis, a);
}
function chain(...ms: Matrix4[]): Matrix4 {
  const out = new Matrix4();
  for (const m of ms) out.multiply(m);
  return out;
}

export function poseCharacter(s: CharacterState): PoseResult {
  const walking = s.pose === 'walk' || s.pose === 'push';
  const swing = walking ? Math.sin(s.phase) : 0;
  const bob = walking ? Math.abs(Math.cos(s.phase)) * 0.025 : Math.sin(s.time * 1.6) * 0.004;

  let root: Matrix4;
  if (s.pose === 'lie') {
    // Lying on the back, head towards the heading: up maps to the heading, forward to world up.
    root = chain(
      new Matrix4().compose(s.position, _q.setFromAxisAngle(Y, s.yaw + Math.PI), _one),
      rot(Z, Math.PI / 2),
    );
  } else {
    root = new Matrix4().compose(
      new Vector3(s.position.x, s.position.y + bob, s.position.z),
      _q.setFromAxisAngle(Y, s.yaw),
      _one,
    );
  }

  // Seated: `position` is the seat, so the pelvis sits on it.
  const pelvis = s.pose === 'sit' ? chain(root, tr(0, 0.08, 0)) : chain(root, tr(0, BODY.hip, 0));
  const lean = s.pose === 'push' ? 0.12 : walking ? 0.04 : 0;
  const torso = chain(pelvis, tr(0, 0.05, 0), rot(Z, -lean));
  const head = chain(torso, tr(0.01, BODY.torsoLength, 0), rot(Z, lean * 0.6));

  const parts: PoseResult['parts'] = [
    { part: 'pelvis', matrix: pelvis },
    { part: 'torso', matrix: torso },
    { part: 'head', matrix: head },
  ];

  let wrist = new Matrix4();
  for (const side of ['L', 'R'] as const) {
    const sign = side === 'L' ? -1 : 1;
    // Arms: swing opposite to the legs, reach forward when pushing, hang slightly out when idle.
    let shoulderA: number;
    let elbowA: number;
    if (s.pose === 'push') {
      shoulderA = 0.95 + lean;
      elbowA = 0.55;
    } else if (s.pose === 'sit') {
      // Hands on the steering wheel.
      shoulderA = 0.7;
      elbowA = 0.6;
    } else if (s.pose === 'lie') {
      shoulderA = 0.05;
      elbowA = 0.2;
    } else {
      shoulderA = -0.45 * swing * sign * (walking ? 1 : 0);
      elbowA = 0.25 + (walking ? 0.15 * (1 + sign * swing) : 0);
    }
    const shoulder = chain(
      torso,
      tr(0, BODY.shoulderY, sign * BODY.shoulderZ),
      rot(Z, shoulderA),
      rot(X, sign * 0.06),
    );
    const elbow = chain(shoulder, tr(0, -BODY.upperArm, 0), rot(Z, elbowA));
    parts.push({ part: 'upperArm', matrix: shoulder }, { part: 'forearm', matrix: elbow });
    if (side === 'L') wrist = chain(elbow, tr(0, -BODY.forearm + 0.02, 0));

    // Legs: swing, knee bends while the leg travels forward.
    const legA = s.pose === 'lie' ? 0 : s.pose === 'sit' ? Math.PI / 2 : 0.42 * swing * -sign;
    const kneeA = walking
      ? 0.1 + 0.55 * Math.max(0, Math.sin(s.phase + (sign > 0 ? 0 : Math.PI) - 0.6))
      : s.pose === 'sit'
        ? Math.PI / 2
        : 0.03;
    const hip = chain(pelvis, tr(0, -0.02, sign * BODY.pelvisHalfWidth), rot(Z, legA));
    const knee = chain(hip, tr(0, -BODY.thigh, 0), rot(Z, -kneeA));
    if (s.pose === 'lie') {
      hip.scale(HIDDEN);
      knee.scale(HIDDEN);
    }
    parts.push({ part: 'thigh', matrix: hip }, { part: 'shin', matrix: knee });
  }

  const chest = chain(torso, tr(0.165, 0.36, -0.07));
  return { parts, chest, wrist };
}
