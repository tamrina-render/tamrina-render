import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { Bench, Cloud, Colonnade, Dumbbell, DumbbellRack, OliveTree, Pedestal, SkyDome, Treadmill, WallClock } from "./fact3d/props";
import { PAL, Part, box, circle, rbox, sphere } from "./fact3d/parts";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, hash, lerp, mix3, seg, springAt, wobble } from "./fact3d/anim";
import {
  alive,
  clapPose,
  dart,
  discusPose,
  flexPose,
  lerpPose,
  pressPose,
  proudPose,
  runnerPose,
  shyArms,
  shyPose,
  stretchPose,
  tremble,
  wavePose,
} from "./fact3d/acting";
import { Phone } from "./fact3d/Phone";
import { Beats, DEFAULT_DURATION, DEFAULT_STARTS, makeBeats } from "./fact3d/timing";

// "gym" comes from Greek gymnos (naked). Timed to the voice track: 13 clause starts (seconds) drive every beat.
//  0 gym · 1 lifter curious · 2 "train naked" (freeze on the last word) · 3 flight · 4 Greek yard · 5 proud statue
//  6 THE GAG (shy snap) · 7 athletes' effort · 8 runners big · 9 flex + clap · 10-12 ending set (mascot composited later)

export type Fact3DProps = {
  starts?: number[]; // 13 clause starts in seconds
  durationSec?: number;
  nakedWordSec?: number; // when the last word of clause 3 lands (default: starts[3] - 1.0)
  debug?: boolean; // overlay the mascot's reserved box and the caption line
};

const G = -70; // z of the Greek yard centre
const PED_H = 1.1;

type V3 = [number, number, number];

// ---------- colours ----------
const LIFTER: BlockyColors = { skin: "#E0A47A", shirt: PAL.terracotta, pants: PAL.teal, shoes: PAL.cream, hair: "#4A2E22", face: PAL.ink };
const JOGGER: BlockyColors = { skin: "#9A6444", shirt: PAL.teal, pants: "#3F4A5A", shoes: "#FFFFFF", hair: "#2C211D", face: PAL.ink };
const MARBLE: BlockyColors = { skin: PAL.marble, shirt: PAL.marble, pants: "#D3DCE4", shoes: PAL.marble, hair: "#DCE2E9", face: "#465060" };
const TONES = ["#E9EDF1", "#F3F5F7", "#E4E9EE", "#EEF0F3", "#E7ECF0", "#F1F3F6"];
const marbleOf = (i: number): BlockyColors => ({ ...MARBLE, skin: TONES[i % TONES.length], shirt: TONES[i % TONES.length], shoes: TONES[i % TONES.length] });

// ---------- the statue ----------
const statuePose = (f: number, B: Beats, peekAt: number): BlockyPose => {
  const S = B.s;
  const T = S[6]; // the snap lands exactly on "and it means naked"
  let p = proudPose();
  // smug idle: breathing, chest puffs and brow wiggles while he is admired
  const br = Math.sin(f * 0.12) * 0.012;
  p.lean += br;
  p.bob = br * 0.5;
  p.roll = Math.sin(f * 0.035) * 0.02;
  const puff = Math.max(seg(f, S[5] + 6, S[5] + 14, easeOut) * (1 - seg(f, S[5] + 26, S[5] + 40)), seg(f, S[5] + 44, S[5] + 50, easeOut) * (1 - seg(f, S[5] + 56, T - 26)));
  p.lean -= puff * 0.07;
  p.squash = 1 + puff * 0.035;
  p.headPitch -= puff * 0.1;
  p.browUp = Math.max(0, Math.sin((f - S[4]) * 0.5)) * (seg(f, S[5] + 18, S[5] + 20) - seg(f, S[5] + 30, S[5] + 32)) * 0.9;
  p.headTilt = Math.sin(f * 0.05) * 0.04;

  // 1) comes alive: eyes pop open, a blink, he looks down at himself
  const open = easeOutBack(clamp((f - (T - 22)) / 5), 2.2);
  p.eyeOpen = clamp(open, 0, 1.15);
  if (f >= T - 18 && f < T - 16) p.eyeOpen = 0.15;
  const lookDown = seg(f, T - 16, T - 12) * (1 - seg(f, T - 9, T - 6));
  p.headPitch = lerp(p.headPitch, 0.38, lookDown);
  p.eyeY = -lookDown;
  p.mouth = f > T - 16 ? "o" : "smile";
  p.mouthOpen = seg(f, T - 16, T - 11) * 0.3;

  // 2) anticipation (11 frames): head snaps up, he inhales, eyes go wide
  const ant = seg(f, T - 11, T, easeOut) * (f < T ? 1 : 0);
  p.eyeWide = lerp(1, 1.45, ant);
  p.browUp = Math.max(p.browUp, ant);
  p.mouthOpen = Math.max(p.mouthOpen, ant * 0.6);
  p.lean -= ant * 0.08;
  p.squash = 1 + ant * 0.05;
  p.armL = { ...p.armL, sz: p.armL.sz + ant * 0.12 };
  p.armR = { ...p.armR, sz: p.armR.sz + ant * 0.12 };

  if (f >= T) {
    // 3) the snap: spring into the shy pose with overshoot, squash and settle
    const s = clamp(springAt(f, T - 1, 0.7, 3.2), 0, 1.12);
    p = lerpPose({ ...p, squash: 1, eyeWide: 1.45 }, shyPose(), s);
    p.squash = 1 + wobble(f, T, -0.16, 0.75, 3.5);
    p.eyeWide = lerp(1.5, 1.2, seg(f, T + 4, T + 20));
    p.blush = seg(f, T + 1, T + 9, easeOut) * (1 + 0.08 * Math.sin(f * 0.5));
    p.mouth = "wavy";
    p.shrug = clamp(s, 0, 1.15) + Math.sin(f * 1.9) * 0.02; // little shiver
    p.roll = Math.sin(f * 0.07) * 0.03;
    const dx = dart(f, [
      [T + 8, -1],
      [T + 19, 1],
      [T + 31, -1],
      [T + 42, 0.6],
      [T + 54, -1],
      [T + 70, 0.8],
      [T + 86, -0.6],
      [T + 101, 1],
    ]);
    p.eyeX = dx;
    p.headYaw = dx * 0.14;
    p.eyeY = -0.2;
    // later: he follows whatever moves (runners, the flexer) - moderate turns only, the face is a sticker
    if (f >= B.cut(8)) {
      const w = seg(f, B.cut(8), B.cut(8) + 10);
      const yaw = clamp(peekAt, -0.45, 0.45);
      p.headYaw = lerp(p.headYaw, yaw, w);
      p.eyeX = lerp(p.eyeX, clamp(yaw * 2.2, -1, 1), w);
      p.eyeY = lerp(p.eyeY, -0.3, w);
      p.mouth = "o";
      p.mouthOpen = 0.25 + 0.1 * Math.sin(f * 0.3);
    }
    if (f >= B.cut(9)) {
      // peeks at the flexer from behind his raised arms
      const w = seg(f, B.cut(9), B.cut(9) + 8, easeOut);
      p.armL = { sx: lerp(p.armL.sx, -1.25, w), sz: lerp(p.armL.sz, -0.12, w), twist: -1.5, elbow: lerp(p.armL.elbow, -1.85, w) };
      p.armR = { sx: lerp(p.armR.sx, -1.05, w), sz: lerp(p.armR.sz, -0.12, w), twist: -1.5, elbow: lerp(p.armR.elbow, -1.95, w) };
      p.headPitch = lerp(p.headPitch, 0.02, w);
      const sneak = Math.sin((f - B.cut(9)) * 0.09); // leans out to look, then hides again
      p.headYaw = lerp(p.headYaw, -0.38 + sneak * 0.06, w);
      p.headTilt = lerp(p.headTilt, -0.12 - Math.max(0, sneak) * 0.1, w);
      p.roll = lerp(p.roll, -0.05 - Math.max(0, sneak) * 0.06, w);
      p.eyeX = lerp(p.eyeX, -1, w);
      p.eyeY = lerp(p.eyeY, 0, w);
      p.blush = 1 + 0.15 * Math.sin(f * 0.4);
      p.mouth = "wavy";
    }
    if (p.eyeOpen > 0.3) p.eyeOpen *= f > T + 30 && (f + 9) % 83 < 3 ? 0.08 : 1;
  }
  return p;
};

// ---------- beat 8: three runners big across the yard track (left -> right, toward the camera) ----------
const TRACK_SLOPE = 0.55; // dz/dx of the diagonal lane
const laneZ = (x: number, off: number) => 4.0 + x * TRACK_SLOPE + off;
const BIG_RUNNERS = [
  { d: -8, speed: 0.2, off: -0.35, cad: 0.5 },
  { d: 10, speed: 0.215, off: 0.45, cad: 0.53 },
  { d: 25, speed: 0.19, off: 0.05, cad: 0.48 },
];

// ---------- camera ----------
type Shot = { p: V3; l: V3; fov: number; roll?: number };
const at = (s: Shot, dz: number): Shot => ({ ...s, p: [s.p[0], s.p[1], s.p[2] + dz], l: [s.l[0], s.l[1], s.l[2] + dz] });
const mixShot = (a: Shot, b: Shot, t: number): Shot => ({ p: mix3(a.p, b.p, t), l: mix3(a.l, b.l, t), fov: lerp(a.fov, b.fov, t), roll: lerp(a.roll ?? 0, b.roll ?? 0, t) });

// Greek shots in yard-local coordinates (shifted by G when used)
const Y_WIDE0: Shot = { p: [-0.9, 4.6, 13.5], l: [0, 1.5, 0.2], fov: 46 };
const Y_WIDE1: Shot = { p: [-0.4, 4.25, 12.4], l: [0, 1.6, 0.2], fov: 46 };
const Y_STAT0: Shot = { p: [-0.3, 3.35, 7.6], l: [0, 2.65, 0], fov: 42 };
const Y_STAT1: Shot = { p: [-0.15, 3.3, 7.0], l: [0, 2.68, 0], fov: 42 };
const Y_GAG: Shot = { p: [0, 3.3, 5.9], l: [0, 2.7, 0], fov: 42 };
const Y_ATH0: Shot = { p: [-1.7, 2.45, 9.4], l: [-2.0, 1.4, 1.3], fov: 44 };
const Y_ATH1: Shot = { p: [2.0, 2.45, 9.1], l: [2.2, 1.4, 1.0], fov: 44 };
const Y_RUN: Shot = { p: [2.3, 1.15, 8.4], l: [-1.0, 1.0, 3.0], fov: 50 };
const Y_FLEX: Shot = { p: [-1.1, 2.7, 12.6], l: [-1.3, 1.6, 1.5], fov: 48 };
export const Y_END: Shot = { p: [0, 6.4, 30], l: [0, 0.6, 12], fov: 40 };

const gymCam = (f: number, B: Beats): Shot => {
  const S = B.s;
  const push = seg(f, 0, S[1] + 10, easeInOut);
  const p = mix3([0.55, 2.6, 9.2], [0.45, 2.65, 8.4], push);
  const l: V3 = [0.4, 1.5, -0.6];
  const rise = seg(f, B.cut(1), B.cut(1) + 40, easeInOut); // beat 2: the camera lifts a little with his curiosity
  p[1] += rise * 0.45;
  l[1] += rise * 0.22;
  const creep = seg(f, B.cut(2), B.freeze - 2, easeInOut); // slow lean-in while the sentence builds
  p[2] -= creep * 1.0;
  p[0] -= creep * 0.15;
  const k = springAt(f, B.freeze - 1, 0.55, 3.2); // punch-in on "naked"
  p[2] -= k * 1.1;
  p[1] -= k * 0.2;
  l[1] -= k * 0.05;
  const shake = wobble(f, B.freeze, 0.03, 1.7, 3);
  return { p: [p[0] + shake, p[1] - shake * 0.5, p[2]], l, fov: 42, roll: wobble(f, B.freeze, 0.02, 1.3, 3.5) };
};

const camAt = (f: number, B: Beats): Shot => {
  const S = B.s;
  if (f < B.cut(3)) return gymCam(f, B);
  if (f < B.cut(4)) {
    // short flight (~1.2 s): over the gym wall, low over the desert, down into the yard; the ground is always in view
    const g = gymCam(B.cut(3), B);
    const end = at(Y_WIDE0, G);
    const t = seg(f, B.cut(3), B.cut(4), (x) => 0.5 - 0.5 * Math.cos(Math.PI * x));
    const pc = new THREE.CatmullRomCurve3(
      [new THREE.Vector3(...g.p), new THREE.Vector3(0.3, 8.6, 3.5), new THREE.Vector3(0, 9.0, -24), new THREE.Vector3(-0.7, 7.0, G + 27), new THREE.Vector3(...end.p)],
      false,
      "centripetal",
    );
    const lc = new THREE.CatmullRomCurve3(
      [new THREE.Vector3(...g.l), new THREE.Vector3(0.2, 1.2, -10), new THREE.Vector3(0, 0, -44), new THREE.Vector3(0, 0.6, G + 4), new THREE.Vector3(...end.l)],
      false,
      "centripetal",
    );
    const pp = pc.getPoint(t);
    const ll = lc.getPoint(t);
    return { p: [pp.x, pp.y, pp.z], l: [ll.x, ll.y, ll.z], fov: 42 + Math.sin(t * Math.PI) * 8 + 4 * t, roll: Math.sin(t * Math.PI * 2) * 0.05 };
  }
  if (f < B.cut(5)) return at(mixShot(Y_WIDE0, Y_WIDE1, seg(f, B.cut(4), B.cut(5), easeOut)), G);
  if (f < S[6]) {
    const t = seg(f, B.cut(5), B.cut(5) + 20, easeInOut);
    let s = mixShot(Y_WIDE1, Y_STAT0, t);
    s = mixShot(s, Y_STAT1, seg(f, B.cut(5) + 20, S[6] - 1, easeInOut));
    const push = seg(f, S[6] - 10, S[6], easeOut) * 0.25; // tiny lean-in on the anticipation
    return at({ ...s, p: [s.p[0], s.p[1], s.p[2] - push] }, G);
  }
  if (f < B.cut(7)) {
    const k = springAt(f, S[6] - 1, 0.55, 3.2); // punch-in with overshoot
    const from: Shot = { ...Y_STAT1, p: [Y_STAT1.p[0], Y_STAT1.p[1], Y_STAT1.p[2] - 0.25] };
    const s = mixShot(from, Y_GAG, k);
    const drift = seg(f, S[6] + 15, B.cut(7), easeInOut);
    s.p[0] += drift * 0.3;
    s.p[2] -= drift * 0.25;
    const shake = wobble(f, S[6], 0.035, 1.6, 3);
    return at({ ...s, p: [s.p[0] + shake, s.p[1] - shake * 0.5, s.p[2]], roll: wobble(f, S[6], 0.025, 1.3, 3.5) }, G);
  }
  if (f < B.cut(8)) return at(mixShot(Y_ATH0, Y_ATH1, seg(f, B.cut(7) + 6, B.cut(8) - 10, easeInOut)), G);
  if (f < B.cut(9)) {
    // low and close; a slight pan follows the pack
    const t = seg(f, B.cut(8), B.cut(9), easeInOut);
    return at({ ...Y_RUN, l: [Y_RUN.l[0] + t * 1.4, Y_RUN.l[1], Y_RUN.l[2] + t * 0.5], p: [Y_RUN.p[0] - t * 0.3, Y_RUN.p[1], Y_RUN.p[2]] }, G);
  }
  if (f < B.cut(10)) {
    const t = seg(f, B.cut(9), B.cut(10), easeInOut);
    return at({ ...Y_FLEX, p: [Y_FLEX.p[0] + t * 0.2, Y_FLEX.p[1] - t * 0.1, Y_FLEX.p[2] - t * 0.6] }, G);
  }
  return at(Y_END, G); // locked: the mascot is composited in 2D on this shot
};

const CameraRig: React.FC<{ frame: number; B: Beats }> = ({ frame, B }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const c = camAt(frame, B);
  camera.position.set(...c.p);
  camera.up.set(0, 1, 0);
  camera.lookAt(...c.l);
  camera.rotateZ(c.roll ?? 0);
  if (camera.fov !== c.fov) {
    camera.fov = c.fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  return null;
};

// ---------- lights ----------
const Sun: React.FC<{ at: V3; dir: V3; intensity: number }> = ({ at: target0, dir, intensity }) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(...target0);
  return (
    <>
      <primitive object={target} />
      <directionalLight
        position={[target0[0] + dir[0], target0[1] + dir[1], target0[2] + dir[2]]}
        target={target}
        color="#FFE6C4"
        intensity={intensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
    </>
  );
};

// ---------- small effects ----------
const Puff: React.FC<{ x: number; z: number; age: number; life?: number; s?: number; drift?: number }> = ({ x, z, age, life = 16, s = 1, drift = -0.45 }) => {
  if (age < 0 || age > life) return null;
  const a = age / life;
  return (
    <Part
      geo={sphere(0.14, 10)}
      color="#C9A26C"
      rough={1}
      opacity={0.85 * (1 - a) * (1 - a)}
      position={[x + a * drift, 0.08 + a * 0.18, z]}
      scale={[(0.7 + easeOut(a) * 1.1) * s, (0.45 + easeOut(a) * 0.6) * s, (0.7 + easeOut(a) * 1.1) * s]}
      shadow={false}
    />
  );
};

const SweatDrops: React.FC<{ f: number; times: number[]; at: V3; spread?: number }> = ({ f, times, at: p0, spread = 0.5 }) => (
  <>
    {times.map((t0, i) => {
      const t = (f - t0) / 30;
      if (t < 0 || t > 0.6) return null;
      const side = i % 2 ? -1 : 1;
      const sp = 0.85 + hash(t0 + i) * 0.25;
      return (
        <Part
          key={i}
          geo={sphere(0.07, 12)}
          color="#8FD0E8"
          emissive="#8FD0E8"
          emissiveIntensity={0.4}
          rough={0.2}
          opacity={1 - t / 0.6}
          position={[p0[0] + side * (spread + t * 2.2 * sp), p0[1] + t * 2.2 * sp - 6 * t * t, p0[2]]}
          rotation={[0, 0, side * (0.4 + t * 2)]}
          scale={[0.8, 1.25, 0.8]}
          shadow={false}
        />
      );
    })}
  </>
);

// ---------- gym ----------
const LIFTER_AT: V3 = [-0.45, 0.06, 0.9];
const LIFTER_ROT = 0.35;
const TREAD_AT: V3 = [1.55, 0, -1.6];
const TREAD_ROT = 2.25;

const Towel: React.FC<{ hug: boolean }> = ({ hug }) =>
  hug ? (
    <group position={[0, 0.5, 0.32]}>
      <Part geo={rbox(0.62, 0.34, 0.2, 0.08)} color={PAL.mustard} rotation={[0, 0, 0.08]} />
      <Part geo={rbox(0.5, 0.06, 0.21, 0.03)} color={PAL.terracotta} position={[0.02, 0.06, 0]} rotation={[0, 0, 0.08]} />
    </group>
  ) : (
    <>
      <Part geo={rbox(0.86, 0.12, 0.56, 0.05)} color={PAL.mustard} position={[0, 0.8, 0]} />
      <Part geo={rbox(0.18, 0.46, 0.06, 0.03)} color={PAL.mustard} position={[0.22, 0.58, 0.27]} />
      <Part geo={rbox(0.18, 0.4, 0.06, 0.03)} color={PAL.mustard} position={[-0.22, 0.6, 0.27]} />
    </>
  );

const GymWorld: React.FC<{ f: number; B: Beats }> = ({ f, B }) => {
  const S = B.s;
  const F = B.freeze;
  // ---- lifter ----
  const cyc = ((f + 8) % 36) / 36;
  const curlLift = cyc < 0.42 ? easeInOut(cyc / 0.42) : 1 - easeInOut((cyc - 0.42) / 0.58);
  // beat 1 curls; beat 2 he stops and looks up; beat 3 one slow puzzled rep; lowered before the freeze
  const stopW = seg(f, S[1], S[1] + 8, easeOut);
  const slowRep = Math.sin(clamp((f - (S[2] + 44)) / 30) * Math.PI);
  const lift = lerp(curlLift, 0, stopW) + (f > S[2] + 44 && f < F - 8 ? slowRep * 0.85 : 0);
  let p = restPose();
  p.armR = { sx: -0.12 - lift * 0.2, sz: 0.12, twist: 0.35, elbow: -0.25 - lift * 1.95 };
  p.armL = { sx: 0.05, sz: 0.75, twist: -1.5, elbow: -1.7 };
  p.legL = { hip: -0.06, sz: 0.12, knee: 0.05 };
  p.legR = { hip: 0.03, sz: 0.12, knee: 0.02 };
  p.lean = -0.04 * lift;
  p.bob = -0.02 * lift;
  p.headPitch = 0.05 - lift * 0.08;
  p.headYaw = -0.15;
  p.headTilt = -0.04 * lift;
  p.eyeX = -0.4;
  p.eyeY = 0.2;
  p.brow = lerp(0, -0.8, lift * (1 - stopW));
  p.mouth = lift > 0.55 && stopW < 0.5 ? "grin" : "flat";
  p.squash = 1 - 0.015 * lift;
  // curious look up (beat 2)
  const cur = stopW * (1 - seg(f, S[2] + 6, S[2] + 16));
  const tiltSide = f < S[1] + 26 ? 1 : -1; // switches the tilt half way - "hm?"
  p.headPitch = lerp(p.headPitch, -0.24, cur);
  p.headTilt = lerp(p.headTilt, 0.17 * tiltSide, seg(f, S[1] + 2, S[1] + 10) * cur * (f < S[1] + 26 ? 1 : seg(f, S[1] + 26, S[1] + 31)));
  p.headYaw = lerp(p.headYaw, 0.05, cur);
  p.eyeY = lerp(p.eyeY, 0.8, cur);
  p.eyeX = lerp(p.eyeX, 0.1, cur);
  p.browUp = cur * 0.9;
  if (f >= S[1] + 4 && f < S[2] + 10) p.mouth = "o";
  p.mouthOpen = 0.15;
  // beat 3: looks over at the jogger, shrugs, then a slow rep
  const toJog = seg(f, S[2] + 8, S[2] + 16) * (1 - seg(f, S[2] + 40, S[2] + 48));
  p.headYaw = lerp(p.headYaw, 0.42, toJog);
  p.eyeX = lerp(p.eyeX, 1, toJog);
  p.browUp = Math.max(p.browUp, toJog * 0.6);
  const shrug = Math.sin(clamp((f - (S[2] + 28)) / 14) * Math.PI);
  p.shrug += shrug * 0.9;
  p.armL = { ...p.armL, sz: p.armL.sz + shrug * 0.25 };
  if (f > S[2] + 28 && f < S[2] + 44) p.mouth = "flat";
  // anticipation: lowers the dumbbell, eyes squint then pop
  const ant = seg(f, F - 8, F, easeOut);
  p.eyeWide = lerp(1, 0.75, ant);
  p.bob -= ant * 0.03;
  p = alive(p, f, 1.3);
  let holdsDumbbell = true;
  if (f >= F) {
    holdsDumbbell = false;
    const s = clamp(springAt(f, F - 1, 0.75, 3), 0, 1.1);
    const shy = { ...shyPose(), blush: 0.85 };
    p = lerpPose({ ...p, squash: 1 }, shy, s);
    p.squash = 1 + wobble(f, F, -0.14, 0.8, 3.5);
    p.eyeWide = lerp(1.55, 1.3, seg(f, F + 4, F + 20));
    p.headPitch = 0.02;
    p.mouth = "wavy";
    const dx = dart(f, [
      [F + 6, 0.8],
      [F + 16, -0.8],
      [F + 26, 1],
    ]);
    p.eyeX = dx;
    p.headYaw = dx * 0.12;
    p = tremble(p, f, 2);
  }
  // ---- jogger (3/4 to camera, on the treadmill) ----
  const jogPh = f * 0.36;
  let j = runnerPose(jogPh, 0.55);
  j.lean = 0.1;
  j.mouth = "smile";
  j.brow = 0;
  j.headYaw = 0.22;
  j.eyeX = 0.6;
  // glances at the lifter when he looks around, a little nod
  const glance = seg(f, S[2] + 12, S[2] + 18) * (1 - seg(f, S[2] + 40, S[2] + 46));
  j.eyeX = lerp(j.eyeX, -0.2, glance);
  j.browUp = glance * 0.6;
  j.headPitch += Math.sin(clamp((f - (S[2] + 20)) / 10) * Math.PI) * 0.15;
  j = alive(j, f, 4.1, 0.6);
  let slide = 0;
  if (f >= F) {
    const s = clamp(springAt(f, F, 0.75, 3), 0, 1.1);
    const shy: BlockyPose = { ...shyPose(), ...shyArms(), legL: { hip: 0, sz: -0.06, knee: 0.12, toe: 0.3 }, legR: { hip: 0, sz: -0.06, knee: 0.12, toe: 0.3 }, blush: 0.8 };
    j = lerpPose(j, shy, s);
    j.squash = 1 + wobble(f, F + 1, -0.12, 0.8, 3.5);
    j.eyeWide = lerp(1.5, 1.3, seg(f, F + 5, F + 22));
    j.headYaw = 0.25;
    j.headPitch = 0;
    j.mouth = "o";
    j.mouthOpen = 0.35;
    j.eyeX = dart(f, [
      [F + 9, 1],
      [F + 20, -0.4],
      [F + 30, 1],
    ]);
    j = tremble(j, f, 5);
    slide = seg(f, F + 2, F + 22, easeOut) * 0.45; // the belt keeps going and carries him back
  }
  // ---- the dropped dumbbell ----
  const drop = (() => {
    const t = f - F;
    if (t < 0) return null;
    const y0 = 0.8;
    const g = 0.012;
    const t1 = Math.sqrt((2 * (y0 - 0.12)) / g); // first hit
    let y: number;
    if (t < t1) y = y0 - 0.5 * g * t * t;
    else {
      const b = t - t1;
      const h1 = 0.22;
      const T1 = 2 * Math.sqrt((2 * h1) / g);
      if (b < T1) y = 0.12 + Math.max(0, (Math.sqrt(2 * g * h1) * b - 0.5 * g * b * b));
      else {
        const b2 = b - T1;
        const h2 = 0.06;
        const T2 = 2 * Math.sqrt((2 * h2) / g);
        y = 0.12 + (b2 < T2 ? Math.max(0, Math.sqrt(2 * g * h2) * b2 - 0.5 * g * b2 * b2) : 0);
      }
    }
    const roll = Math.min(t, 40) * 0.012;
    const hit = t >= t1 && t < t1 + 3 ? 1 - (t - t1) / 3 : 0;
    return { pos: [-1.0 - roll * 0.6, y, 1.12 + roll] as V3, rot: [0, 0.6, -Math.min(t, 30) * 0.05] as V3, hit };
  })();

  return (
    <group>
      {/* floor slab + walls (a toy diorama) */}
      <Part geo={rbox(10, 0.5, 9, 0.08)} color={PAL.wood} position={[0, -0.25, -0.5]} />
      {[...Array(7)].map((_, i) => (
        <Part key={i} geo={box(0.02, 0.005, 9)} color="#B87F4A" basic position={[-4.3 + i * 1.45, 0.003, -0.5]} shadow={false} />
      ))}
      <Part geo={rbox(3.0, 0.06, 2.4, 0.03)} color={PAL.teal} position={[-0.45, 0.03, 1.0]} />
      <Part geo={rbox(10, 5.8, 0.3, 0.05)} color={PAL.wall} position={[0, 2.9, -4.85]} />
      <Part geo={box(10, 0.5, 0.02)} color={PAL.mustard} position={[0, 1.4, -4.69]} shadow={false} />
      <Part geo={box(10, 0.14, 0.02)} color={PAL.terracotta} position={[0, 1.05, -4.69]} shadow={false} />
      <Part geo={rbox(0.3, 5.8, 9, 0.05)} color="#E8CDA0" position={[-4.85, 2.9, -0.5]} />
      <Part geo={box(0.02, 0.5, 9)} color={PAL.mustard} position={[-4.69, 1.4, -0.5]} shadow={false} />
      {/* window to the sky, a cloud drifts past */}
      <Part geo={rbox(1.9, 1.6, 0.1, 0.05)} color={PAL.cream} position={[1.9, 3.2, -4.7]} />
      <Part geo={box(1.6, 1.3, 0.02)} color="#9FD3DF" basic position={[1.9, 3.2, -4.64]} shadow={false} />
      <Part geo={rbox(0.5, 0.2, 0.01, 0.1)} color="#FFFFFF" basic position={[1.35 + ((f * 0.008) % 1.1), 3.45, -4.628]} shadow={false} />
      <Part geo={box(0.06, 1.3, 0.03)} color={PAL.cream} position={[1.9, 3.2, -4.62]} shadow={false} />
      <WallClock position={[-1.3, 3.5, -4.68]} frame={f} />
      {/* plant */}
      <group position={[-3.6, 0, -3.8]}>
        <Part geo={rbox(0.6, 0.6, 0.6, 0.08)} color={PAL.terracotta} position={[0, 0.3, 0]} />
        {[0, 1, 2, 3, 4].map((i) => (
          <Part key={i} geo={rbox(0.14, 0.9, 0.06, 0.03)} color={PAL.olive} position={[Math.sin(i * 1.3) * 0.15, 0.95, Math.cos(i * 1.3) * 0.1]} rotation={[Math.cos(i * 1.3) * 0.4, 0, Math.sin(i * 1.3) * 0.5 + Math.sin(f * 0.07 + i) * 0.04]} />
        ))}
      </group>
      <DumbbellRack position={[-0.9, 0, -4.2]} />
      <Bench position={[-2.6, 0, -1.6]} rotationY={0.5} />
      <group position={TREAD_AT} rotation={[0, TREAD_ROT, 0]}>
        <Treadmill frame={f} />
        <Blocky
          pose={j}
          colors={JOGGER}
          position={[0, 0.245, 0.15 + slide]}
          rotationY={Math.PI}
          sleeves={PAL.teal}
          headband={PAL.terracotta}
          chest={<Towel hug={f >= F} />}
        />
      </group>
      {/* kettlebell */}
      <group position={[-2.1, 0, 1.7]}>
        <Part geo={sphere(0.2, 16)} color={PAL.ink} position={[0, 0.2, 0]} />
        <Part geo={rbox(0.26, 0.08, 0.05, 0.02)} color={PAL.ink} position={[0, 0.45, 0]} />
      </group>
      <Blocky
        pose={p}
        colors={LIFTER}
        position={LIFTER_AT}
        rotationY={LIFTER_ROT}
        headband={PAL.mustard}
        rightHand={holdsDumbbell ? <Dumbbell color={PAL.teal} position={[0, -0.02, 0]} rotation={[0, 1.57 - 0.35, 0]} s={0.85} /> : null}
      />
      {drop && (
        <>
          <Dumbbell color={PAL.teal} position={drop.pos} rotation={drop.rot} s={0.85} />
          {drop.hit > 0 &&
            [-1, 1].map((k) => <Part key={k} geo={rbox(0.05, 0.16, 0.03, 0.02)} color={PAL.terracotta} basic opacity={drop.hit} position={[drop.pos[0] + k * 0.32, 0.25, drop.pos[2]]} rotation={[0, 0, -k * 0.7]} shadow={false} />)}
          <Puff x={-1.0} z={1.12} age={f - F - 11} life={14} s={0.8} drift={0.3} />
        </>
      )}
    </group>
  );
};

// ---------- Greek yard ----------
const A_AT: V3 = [-2.5, 0, 1.4]; // stone presser
const B_AT: V3 = [-3.3, 0, -0.7]; // stretcher
const C_AT: V3 = [2.6, 0, 1.1]; // discus
const PODIUM: V3 = [-1.95, 0, 2.6];

// ending set (yard-local); spots were placed from pixels on the locked end camera (see Y_END)
const OVAL = { x: -1.35, z: 14.6, rx: 1.55, rz: 1.3 };
const PHONE_AT: V3 = [-1.4, 0, 14.4];
const SPOTS: V3[] = [
  [-1.08, 0, 20.25], // screen ~ (290, 1690)
  [-0.42, 0, 20.5], // screen ~ (445, 1720)
  [-1.75, 0, 19.9], // the late one, screen ~ (145, 1645)
];

const TRACK_RING = new THREE.RingGeometry(OVAL.rx - 0.42, OVAL.rx + 0.42, 64);
const TRACK_LINE = new THREE.RingGeometry(OVAL.rx - 0.02, OVAL.rx + 0.02, 64);

const ovalAt = (th: number) => ({ x: OVAL.x + OVAL.rx * Math.cos(th), z: OVAL.z + OVAL.rz * Math.sin(th), heading: Math.atan2(-OVAL.rx * Math.sin(th), OVAL.rz * Math.cos(th)) });

const Stones: React.FC = () => <Part geo={sphere(0.2, 14)} color="#A9A49B" position={[0, -0.05, 0.05]} />;

const GreekWorld: React.FC<{ f: number; B: Beats }> = ({ f, B }) => {
  const S = B.s;
  const ending = f >= B.cut(10);
  const flexBeat = f >= B.cut(9) && !ending;

  // ---- big runners (beat 8) ----
  const bigRunners = BIG_RUNNERS.map((r, i) => {
    const t = f - (B.cut(8) + r.d);
    const x = -6.5 + t * r.speed;
    return { i, t, x, z: laneZ(x, r.off), phase: t * r.cad, r };
  });
  const runnersOn = f >= B.cut(8) - 10 && f < B.cut(9);
  const watchX = (() => {
    if (!runnersOn) return 0;
    const xs = bigRunners.filter((r) => r.t > 0 && r.x > -5 && r.x < 5).map((r) => r.x);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length / 4 : 0;
  })();
  const sp = statuePose(f, B, watchX);

  // ---- athletes ----
  const effort = f >= B.cut(7) && f < B.cut(8) ? 1 : 0.35;
  const pressPeriod = effort > 0.5 ? 34 : 48;
  const pressT = ((f + 20) % pressPeriod) / pressPeriod;
  let a = alive(pressPose(pressT, effort), f, 7.2, 0.5);
  if (effort > 0.5) a.squash *= 1 + Math.sin(f * 0.37) * 0.01;
  let b = alive(stretchPose(f * 0.09), f, 3.3, 0.4);
  // discus: winds up; in beat 7 he spins and throws
  const throwAt = B.cut(8) - 24;
  const spinT = clamp((f - throwAt) / 10);
  const wind = Math.sin(f * 0.16) * (f > throwAt - 30 && f < throwAt ? 1.3 : 1);
  let c = alive(discusPose(wind), f, 5.5, 0.4);
  let cSpin = 0;
  let discusHeld = true;
  if (f >= throwAt && f < B.cut(9)) {
    cSpin = -easeInOut(spinT) * Math.PI * 2;
    if (f >= throwAt + 8) {
      discusHeld = false;
      const k = seg(f, throwAt + 8, throwAt + 16, easeOut);
      c = lerpPose(c, { ...wavePose(f, 1), armR: { sx: -0.2, sz: 2.4, twist: 1.57, elbow: -0.3 }, mouth: "grin" }, k);
    }
  }
  const discusFlight = (() => {
    const t = f - (throwAt + 8);
    if (t < 0 || t > 40 || f >= B.cut(9)) return null;
    return [C_AT[0] + 0.6 + t * 0.32, 1.6 + t * 0.22 - t * t * 0.004, C_AT[2] - t * 0.12] as V3;
  })();

  // beat 9 (flex + clap): A flexes on the podium, B and C clap beside him
  let flexer = a;
  let clapB = b;
  let clapC = c;
  if (flexBeat || ending) {
    const pumpT = (f - B.cut(9)) % 26;
    const pump = pumpT < 6 ? easeOut(pumpT / 6) : 1 - easeInOut(clamp((pumpT - 10) / 14));
    flexer = alive(flexPose(pump), f, 7.2, 0.4);
    flexer.twist += Math.sin((f - B.cut(9)) * 0.06) * 0.25; // shows off to both sides
    flexer.headYaw = Math.sin((f - B.cut(9)) * 0.06) * 0.2;
    flexer.eyeOpen *= (f + 30) % 70 < 3 ? 0.1 : 1; // a wink-ish blink
    clapB = alive(clapPose(f, 0.55, 0), f, 3.3, 0.5);
    clapC = alive(clapPose(f, 0.6, 1.5), f, 5.5, 0.5);
    clapB.headYaw = 0.3;
    clapC.headYaw = -0.25;
  }

  // ---- ending runners ----
  const endRunners = (() => {
    if (!ending) return [];
    const out: { pos: V3; rot: number; pose: BlockyPose; dust: { x: number; z: number; age: number }[] }[] = [];
    const t0 = B.cut(10);
    const w = (Math.PI * 2) / 96; // one lap in 3.2 s
    const leave = S[12];
    for (let i = 0; i < 2; i++) {
      const thAt = (ff: number) => 1.9 + (ff - t0) * w - i * 1.05;
      const ff = Math.min(f, leave + i * 6);
      const o = ovalAt(thAt(ff));
      let pos: V3 = [o.x, 0, o.z];
      let rot = o.heading;
      const phase = (f - t0) * 0.42 + i * 1.3;
      let pose = runnerPose(phase, 0.6);
      pose.mouth = "smile";
      pose.brow = 0;
      pose = alive(pose, f, 11 + i, 0.4);
      const dust: { x: number; z: number; age: number }[] = [];
      const go = f - (leave + i * 6);
      if (go >= 0) {
        // jog over to stand next to the mascot's spot
        const dur = 30;
        const k = clamp(go / dur);
        const e = easeInOut(k);
        const spot = SPOTS[i];
        pos = [lerp(o.x, spot[0], e), 0, lerp(o.z, spot[2], e)];
        const head = Math.atan2(spot[0] - o.x, spot[2] - o.z);
        const face = 0.55; // 3/4 toward the mascot (screen right) and the camera
        rot = k < 0.8 ? head : lerp(head, face, seg(go, dur * 0.8, dur + 6));
        if (k >= 1) {
          const arrive = seg(go, dur, dur + 10, easeOut);
          const idle = alive(i === 0 ? wavePose(f, 0) : go < dur + 60 ? wavePose(f, 2.1) : clapPose(f, 0.6, 0.7), f, 11 + i, 0.6);
          pose = lerpPose(runnerPose(phase, 0.6 * (1 - arrive)), idle, arrive);
          pose.headYaw += 0.1;
          pose.eyeX = 0.8;
          pose.eyeY = 0.1;
        }
      }
      out.push({ pos, rot, pose, dust });
    }
    // the late one: sprints in from the left edge and skids to a stop
    const st = S[12] + 24;
    const g = f - st;
    if (g >= 0) {
      const spot = SPOTS[2];
      const runDur = 22;
      const x0 = -4.6;
      const k = clamp(g / runDur);
      const x = lerp(x0, spot[0], 1 - Math.pow(1 - k, 2.2));
      const z = lerp(spot[2] + 0.4, spot[2], k);
      let pose: BlockyPose;
      let rot = Math.PI / 2 - 0.35;
      const dust: { x: number; z: number; age: number }[] = [];
      if (g < runDur - 8) pose = runnerPose(g * 0.6, 1);
      else if (g < runDur + 10) {
        // skid: leans back, front leg braced, arms flailing
        const sk = seg(g, runDur - 8, runDur - 4, easeOut);
        pose = lerpPose(runnerPose(g * 0.6, 1), {
          ...restPose(),
          legL: { hip: -0.75, sz: 0.1, knee: 0.1 },
          legR: { hip: 0.45, sz: 0.1, knee: 0.7 },
          armL: { sx: -0.6, sz: 1.3 + Math.sin(g * 1.4) * 0.3, twist: 0, elbow: -0.3 },
          armR: { sx: -0.4, sz: 1.2 - Math.sin(g * 1.4) * 0.3, twist: 0, elbow: -0.3 },
          lean: -0.3,
          bob: -0.12,
          eyeWide: 1.35,
          browUp: 1,
          mouth: "o",
          mouthOpen: 0.4,
        }, sk);
        for (let q = 0; q < 4; q++) dust.push({ x: x + 0.3 - q * 0.15, z: z + (q % 2 ? 0.25 : -0.2), age: g - (runDur - 8) - q * 2 });
      } else {
        const ga = g - (runDur + 10);
        rot = lerp(rot, 0.55, seg(ga, 0, 8));
        // catches his breath (hands on knees), then pops up and waves
        const up = seg(ga, 26, 34, easeOutBack);
        const tired: BlockyPose = {
          ...restPose(),
          armL: { sx: -0.75, sz: 0.25, twist: 0, elbow: -0.2 },
          armR: { sx: -0.75, sz: 0.25, twist: 0, elbow: -0.2 },
          legL: { hip: -0.35, sz: 0.14, knee: 0.55 },
          legR: { hip: -0.35, sz: 0.14, knee: 0.55 },
          lean: 0.55 + Math.sin(ga * 0.5) * 0.04,
          bob: -0.14,
          headPitch: -0.45,
          eyeOpen: 0.4 + 0.6 * clamp(Math.sin(ga * 0.25) + 0.5),
          mouth: "o",
          mouthOpen: 0.3 + 0.2 * Math.sin(ga * 0.5),
        };
        pose = lerpPose(tired, wavePose(f, 4.4), clamp(up, 0, 1.05));
        pose = alive(pose, f, 17, 0.6);
        pose.eyeX = 0.8;
      }
      out.push({ pos: [x, 0, z], rot, pose, dust });
    }
    return out;
  })();

  // ---- the phone (beat 11) ----
  const phoneStart = S[11] - 4;
  const rise = clamp(springAt(f, phoneStart, 0.3, 6), 0, 1.15);
  const phoneY = -3.6 * (1 - rise);
  const phoneWobble = wobble(f, phoneStart + 6, 0.06, 0.45, 8) + Math.sin(f * 0.05) * 0.012;
  const mound = seg(f, phoneStart - 8, phoneStart + 4, easeOut);
  const pressK = f > S[11] + 30 ? Math.max(0, Math.sin((f - S[11] - 30) * 0.21)) ** 6 : 0;
  const shoeHop = f > S[11] + 14 ? Math.max(0, Math.sin((f - S[11] - 14) * 0.16)) ** 3 : 0;

  const lookPhoneYaw = Math.atan2(-PHONE_AT[0], Y_END.p[2] - PHONE_AT[2]);

  return (
    <group position={[0, 0, G]}>
      {/* sand + distant hills */}
      <Part geo={circle(46, 64)} color={PAL.sand} rotation={[-Math.PI / 2, 0, 0]} />
      <Part geo={circle(8.2, 48)} color={PAL.sandDark} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} />
      <Part geo={circle(7.6, 48)} color={PAL.sand} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} />
      {/* the diagonal running lane (beat 8) */}
      <Part geo={box(19, 0.004, 1.9)} color="#E2C28E" position={[0, 0.012, 4.0]} rotation={[0, -Math.atan(TRACK_SLOPE), 0]} shadow={false} />
      {[
        [-28, -40, 14, PAL.olive],
        [-6, -55, 18, "#A9B37A"],
        [22, -45, 15, PAL.oliveDark],
        [40, -30, 12, PAL.olive],
      ].map(([x, z, r, col], i) => (
        <Part key={i} geo={sphere(1, 24)} color={col as string} scale={[r as number, (r as number) * 0.32, (r as number) * 0.7]} position={[x as number, -1, z as number]} shadow={false} />
      ))}
      <Colonnade radius={7} count={12} gap={4} h={4.3} />
      <OliveTree position={[-4.2, 0, -2.5]} s={1.05} seed={2} frame={f} />
      <OliveTree position={[4.6, 0, -1.8]} s={0.95} seed={5} frame={f} />
      <OliveTree position={[-8.8, 0, 3.5]} s={1.2} seed={9} frame={f} />
      <OliveTree position={[9.5, 0, 2.0]} s={1.1} seed={13} frame={f} />
      <OliveTree position={[3.4, 0, 10.8]} s={1.0} seed={17} frame={f} />
      <OliveTree position={[-6.2, 0, 12.5]} s={1.1} seed={21} frame={f} />
      {/* amphorae, tucked behind the statue so no shot cuts them in half */}
      <group position={[1.2, 0, -3.5]}>
        <Part geo={sphere(0.32, 14)} color={PAL.terracotta} scale={[1, 1.3, 1]} position={[0, 0.42, 0]} />
        <Part geo={rbox(0.2, 0.25, 0.2, 0.05)} color={PAL.terracotta} position={[0, 0.88, 0]} />
        <Part geo={box(0.66, 0.08, 0.66)} color={PAL.ink} position={[0, 0.48, 0]} scale={[0.98, 1, 0.98]} shadow={false} />
      </group>
      <group position={[0.65, 0, -3.9]}>
        <Part geo={sphere(0.22, 14)} color={PAL.mustard} scale={[1, 1.3, 1]} position={[0, 0.29, 0]} />
      </group>
      <Pedestal h={PED_H} />
      <Blocky pose={sp} colors={MARBLE} statue position={[0, PED_H, 0]} />
      {/* shock lines at the snap */}
      {f >= S[6] - 1 &&
        f < S[6] + 12 &&
        [-0.75, 0, 0.75].map((ang, i) => {
          const t = (f - S[6] + 1) / 13;
          const r = 0.7 + easeOut(t) * 0.45;
          const headY = PED_H + 2.23;
          return (
            <Part
              key={i}
              geo={rbox(0.07, 0.3, 0.05, 0.02)}
              color={PAL.terracotta}
              basic
              opacity={1 - t}
              position={[Math.sin(ang) * r, headY + 0.1 + Math.cos(ang) * r, 0.2]}
              rotation={[0, 0, -ang]}
              scale={1 - t * 0.4}
              shadow={false}
            />
          );
        })}
      <SweatDrops f={f} times={[S[6] + 2, S[6] + 3, S[6] + 22, S[6] + 40, S[9] + 10, S[9] + 40]} at={[0, PED_H + 2.65, 0.25]} />

      {/* the training athletes (beats 4 and 7) / flex + clap (beat 9 onwards) */}
      {!(flexBeat || ending) ? (
        <>
          <Blocky pose={a} colors={marbleOf(0)} statue headband={PAL.olive} position={A_AT} rotationY={0.35} leftHand={<Stones />} rightHand={<Stones />} />
          {effort > 0.5 && <SweatDrops f={f} times={[B.cut(7) + 6, B.cut(7) + 7, B.cut(7) + 30, B.cut(7) + 31, B.cut(7) + 52]} at={[A_AT[0], 2.9, A_AT[2] + 0.3]} spread={0.45} />}
          <Blocky pose={b} colors={marbleOf(1)} statue position={B_AT} rotationY={0.4} />
          <group position={C_AT} rotation={[0, -0.6 + cSpin, 0]}>
            <Blocky pose={c} colors={marbleOf(2)} statue headband={PAL.olive} rightHand={discusHeld ? <Part geo={sphere(0.2, 16)} color="#B9A889" scale={[1, 0.3, 1]} rotation={[0, 0, 1.4]} /> : null} />
          </group>
          {discusFlight && <Part geo={sphere(0.2, 16)} color="#B9A889" scale={[1, 0.3, 1]} position={discusFlight} rotation={[0.3, 0, f * 0.5]} />}
          {/* a drop of effort shadow / puff when the presser drives up */}
          <Puff x={A_AT[0] + 0.2} z={A_AT[2] + 0.2} age={((f + 20) % pressPeriod) - pressPeriod * 0.25} life={10} s={0.6} drift={0.2} />
        </>
      ) : (
        <>
          <Part geo={rbox(1.3, 0.6, 1.1, 0.06)} color={PAL.marbleShade} position={[PODIUM[0], 0.3, PODIUM[2]]} />
          <Part geo={rbox(1.36, 0.06, 1.16, 0.03)} color={PAL.marble} position={[PODIUM[0], 0.61, PODIUM[2]]} />
          <Part geo={rbox(0.7, 0.32, 0.02, 0.03)} color={PAL.terracotta} position={[PODIUM[0], 0.3, PODIUM[2] + 0.56]} />
          <Blocky pose={flexer} colors={marbleOf(0)} statue headband={PAL.olive} position={[PODIUM[0], 0.64, PODIUM[2]]} rotationY={0.15} />
          <Blocky pose={clapB} colors={marbleOf(1)} statue position={[-3.7, 0, 1.3]} rotationY={0.7} />
          <Blocky pose={clapC} colors={marbleOf(2)} statue headband={PAL.olive} position={[-0.2, 0, 1.75]} rotationY={-0.6} />
        </>
      )}

      {/* beat 8: the runners, big, with dust */}
      {runnersOn &&
        bigRunners.map(({ i, t, x, z, phase, r }) => {
          if (t < 0 || x > 9) return null;
          const puffs: React.ReactNode[] = [];
          const lastStep = Math.floor(phase / Math.PI);
          for (let k = lastStep; k > lastStep - 5 && k >= 0; k--) {
            const age = (phase - k * Math.PI) / r.cad;
            const px = -6.5 + ((k * Math.PI) / r.cad) * r.speed;
            puffs.push(<Puff key={k} x={px - 0.2} z={laneZ(px, r.off) + (k % 2 ? 0.15 : -0.15)} age={age} />);
          }
          let pose = runnerPose(phase, 1);
          pose.headYaw = -0.4; // toward the camera (it sits ahead of them, to their left)
          pose.eyeX = -0.7;
          return (
            <group key={i}>
              <Blocky pose={pose} colors={marbleOf(3 + i)} statue headband={PAL.olive} position={[x, 0, z]} rotationY={Math.atan2(1, TRACK_SLOPE)} />
              {puffs}
            </group>
          );
        })}

      {/* ---- ending set: oval track, the phone, the runners. Lower-right stays open sand for the mascot. ---- */}
      {ending && (
        <>
          <group position={[OVAL.x, 0.014, OVAL.z]} scale={[1, 1, OVAL.rz / OVAL.rx]}>
            <Part geo={TRACK_RING} color="#D99A6C" rotation={[-Math.PI / 2, 0, 0]} shadow={false} />
            <Part geo={TRACK_LINE} color="#F6E7CF" rotation={[-Math.PI / 2, 0, 0.001]} position={[0, 0.002, 0]} shadow={false} basic />
          </group>
          {/* a few darker sand patches so the open ground reads as ground */}
          {[
            [1.6, 21.4, 1.4],
            [0.2, 23.0, 1.0],
            [2.4, 18.6, 1.1],
            [-2.8, 22.2, 0.9],
          ].map(([x, z, r], i) => (
            <Part key={i} geo={circle(1, 32)} color={PAL.sandDark} basic opacity={0.22} rotation={[-Math.PI / 2, 0, 0]} scale={[r * 1.6, r, 1]} position={[x, 0.008, z]} shadow={false} />
          ))}
          {/* phone rising out of the sand */}
          {f >= phoneStart - 10 && (
            <>
              <Part geo={sphere(1, 20)} color={PAL.sandDark} scale={[1.3 * mound, 0.28 * mound, 0.8 * mound]} position={[PHONE_AT[0], 0, PHONE_AT[2] + 0.1]} />
              <group position={[PHONE_AT[0], phoneY - 0.12, PHONE_AT[2]]} rotation={[-0.12, lookPhoneYaw, phoneWobble]}>
                <Phone press={pressK} shoeHop={shoeHop} />
              </group>
              {[0, 1, 2, 3, 4, 5].map((q) => (
                <Puff key={q} x={PHONE_AT[0] + (q - 2.5) * 0.45} z={PHONE_AT[2] + 0.3 + (q % 2) * 0.3} age={f - phoneStart - q} life={22} s={1.3} drift={(q - 2.5) * 0.25} />
              ))}
            </>
          )}
          {endRunners.map((r, i) => (
            <React.Fragment key={i}>
              <Blocky pose={r.pose} colors={marbleOf(3 + i)} statue headband={PAL.olive} position={r.pos} rotationY={r.rot} scale={0.72} />
              {r.dust.map((d, q) => (
                <Puff key={q} x={d.x} z={d.z} age={d.age} life={16} s={1} drift={0.3} />
              ))}
            </React.Fragment>
          ))}
        </>
      )}

      {/* sun + clouds in the Greek sky (always drifting) */}
      <Part geo={sphere(5, 32)} color="#FFF2CF" basic position={[-26, 30, -110]} shadow={false} />
      <Part geo={sphere(7.5, 32)} color="#FFE7B0" basic opacity={0.35} position={[-26, 30, -111]} shadow={false} />
      <Cloud position={[14 + f * 0.02, 19, -70]} s={3} seed={3} />
      <Cloud position={[-18 + f * 0.016, 15, -60]} s={2.4} seed={7} />
      <Cloud position={[4 + f * 0.022, 24, -95]} s={3.6} seed={11} />
      <Cloud position={[-30 + f * 0.018, 21, -85]} s={2.8} seed={14} />
    </group>
  );
};

// ---------- composition ----------
const World: React.FC<{ B: Beats }> = ({ B }) => {
  const frame = useCurrentFrame();
  const inGym = frame < B.cut(3) + 18;
  const sunAt: V3 = inGym ? [0, 0, 0] : frame < B.cut(10) ? [0, 0, G + 1] : [0, 0, G + 17];
  return (
    <>
      <CameraRig frame={frame} B={B} />
      <SkyDome />
      <fog attach="fog" args={["#F6E2C0", 45, 160]} />
      <hemisphereLight args={["#D6ECF6", "#EBCB9C", 1.75]} />
      <directionalLight position={[8, 4, 6]} intensity={0.35} color="#9DBFE0" />
      {/* cool rim from behind so the marble figures separate from the warm sand */}
      <directionalLight position={[-3, 7, -12]} intensity={1.1} color="#D8E8FF" />
      <Sun at={sunAt} dir={inGym ? [6, 12, 9] : [-7, 11, 8]} intensity={inGym ? 2.9 : 3.0} />
      {frame < B.cut(4) + 2 && <GymWorld f={frame} B={B} />}
      {/* a few desert trees and rocks along the flight line, so the short flight always has something below it */}
      {frame >= B.cut(3) - 2 && frame < B.cut(4) + 2 && (
        <>
          {[
            [-6, -14, 1.2, 31],
            [7, -20, 1.4, 33],
            [-8, -30, 1.3, 35],
            [6, -38, 1.1, 37],
            [-5, -46, 1.2, 39],
            [8, -52, 1.3, 41],
          ].map(([x, z, s, seed]) => (
            <group key={seed} position={[0, -0.55, 0]}>
              <OliveTree position={[x, 0, z]} s={s} seed={seed} frame={frame} />
            </group>
          ))}
          {[...Array(10)].map((_, i) => (
            <Part key={i} geo={rbox(0.9, 0.5, 0.7, 0.2)} color={i % 2 ? PAL.sandDark : "#CFA874"} position={[(hash(i * 3.3) - 0.5) * 18, -0.4, -8 - i * 5]} rotation={[0, hash(i) * 3, 0]} />
          ))}
          <Cloud position={[-16, 17, -20]} s={2} seed={1} />
          <Cloud position={[17, 19, -34]} s={2.4} seed={4} />
          <Cloud position={[-17, 18, -48]} s={2.2} seed={8} />
        </>
      )}
      {/* one desert floor under both worlds, so the flight never shows an edge */}
      <Part geo={circle(220, 64)} color={PAL.sand} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, -40]} />
      {frame >= B.cut(3) - 2 && <GreekWorld f={frame} B={B} />}
    </>
  );
};

/** Debug overlay: the mascot's reserved area and the caption line. */
const DebugOverlay: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 560, top: 1220, width: 420, height: 560, border: "4px dashed #ff00aa" }} />
    <div style={{ position: "absolute", left: 750, top: 1480, width: 40, height: 40, borderRadius: 20, background: "#ff00aa" }} />
    <div style={{ position: "absolute", left: 0, top: 1344, width: 1080, height: 0, borderTop: "4px dashed #00aaff" }} />
    <div style={{ position: "absolute", left: 290, top: 870, width: 80, height: 60, border: "4px dashed #22cc22" }} />
  </AbsoluteFill>
);

export const Fact3D: React.FC<Fact3DProps> = ({ starts = DEFAULT_STARTS, durationSec = DEFAULT_DURATION, nakedWordSec, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const B = useMemo(() => makeBeats(starts, fps, durationSec, nakedWordSec), [starts, fps, durationSec, nakedWordSec]);
  return (
    <AbsoluteFill style={{ backgroundColor: PAL.skyHorizon }}>
      <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 42, near: 0.1, far: 900, position: [0, 3, 10] }} gl={{ antialias: true }}>
        <World B={B} />
      </ThreeCanvas>
      {debug && <DebugOverlay />}
    </AbsoluteFill>
  );
};
