import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { Part, box, circle, cyl, rbox, sphere, torusArc } from "./fact3d/parts";
import { clamp, easeIn, easeInOut, easeOut, hash, lerp, seg, springAt } from "./fact3d/anim";
import { alive, lerpPose, runnerPose, shyArms, walkPose } from "./fact3d/acting";
import { Dumbbell, SkyDome, Treadmill, Bench } from "./fact3d/props";
import { Building } from "./fact3d/waffarha";
import { Shot, ShotRig, birdsEye, mixShot, orbit, whipBlur, whipPan } from "./fact3d/cameraMoves";
import { AppPhone, AppPhoneSpec } from "./fact3d/AppPhone";
import { ABeats, ALONE_BEATS, ALONE_DURATION, AloneBeats, makeAloneBeats } from "./fact3d/aloneTiming";
import { loadFonts } from "../lib/fonts";

loadFonts();

// «أكتر مكان في مصر مليان ناس.. بس كل اللي فيه لوحدهم» (videos/gym-alone, 2026-11-20): NO coin on screen (owner:
// "انسى مستر كوين خالص"), the narrator is only a voice. ONE bright toy world, ONE camera, no cuts:
//  gym (open roof, open front, a dollhouse): 40 people, every one in big headphones, nobody looks at anybody ->
//  whip pan to the machine: the shy one asks, the cold one doesn't look up -> the new guy by the door with his phone,
//  the wall clock runs 20 minutes -> bird's eye up out of the open roof -> the next building: a guy in gym clothes waiting
//  on his balcony, the same clock -> way up: lime rings under people on roofs and streets, they go grey, our two pulse,
//  lime lines join the pairs -> down to the new guy: the REAL app (partner card -> «تمرينتكم اتأكدت») -> the neighbour
//  walks in, +1 coin over each -> back to the machine: he is still sitting there, cobwebs; orbit -> the logo; the last
//  frames glide back to the frame-0 shot (loop).

export type FactAloneProps = { beats?: Partial<AloneBeats>; durationSec?: number; debug?: boolean };
type V3 = [number, number, number];

const LIME = "#D6FF3C";
const INK = "#0E0F12";
const AR = "Cairo";

// ---------------------------------------------------------------- places
const GYM = { x0: -9, x1: 9, zb: -10, zf: 5.5, h: 5 };
const MACH: V3 = [-4.6, 0, 2.6];
const MACH_ROT = 0.55;
export const SEAT_TOP = 0.56;
const SHY: V3 = [-3.05, 0, 3.05];
const SHY_ROT = -1.15;
const NEW: V3 = [7.0, 0, 2.2];
const NEW_ROT = -0.75;
const DOOR_Z = 4.2;
const CLOCK_GYM: V3 = [8.72, 3.5, 0.6];
const TOWER = { x: 18, z: -2.5, w: 7, d: 9, h: 15 };
const BALC_Y = 6.7;
const NB: V3 = [TOWER.x, BALC_Y, 2.75];
const CLOCK_NB: V3 = [TOWER.x + 1.35, BALC_Y + 1.95, 2.06];

// ---------------------------------------------------------------- the people
const SHIRTS = ["#E2574C", "#3F8FD6", "#2F8C86", "#E3A93B", "#8E6CC9", "#F07E86", "#4C5566", "#D9693F", "#5BA25B", "#F1E1C2", "#2B2F3A", "#C94F7C"];
const SKINS = ["#E8B48C", "#C98A63", "#A86B47", "#F0C7A0", "#8C5A3C", "#D9A27A"];
const HAIRS = ["#2C211D", "#3B2A20", "#151212", "#5A3B28", "#1E1A18"];
const PANTS = ["#2B2F3A", "#3C4A66", "#4A4038", "#22262E", "#5D6670"];
const CUPS = ["#1C1F26", "#F6F6F6", "#E2574C", "#3F8FD6", "#2B2F3A", "#E3A93B"];
export const look = (i: number): BlockyColors => ({
  skin: SKINS[Math.floor(hash(i * 1.37) * SKINS.length)],
  shirt: SHIRTS[Math.floor(hash(i * 2.71) * SHIRTS.length)],
  pants: PANTS[Math.floor(hash(i * 3.33) * PANTS.length)],
  shoes: "#2B2B30",
  hair: HAIRS[Math.floor(hash(i * 4.9) * HAIRS.length)],
  face: "#2A1E1A",
});

export type Kind = "run" | "curl" | "squat" | "nod" | "bench";
export type Person = { pos: V3; rot: number; kind: Kind; c: BlockyColors; seed: number; cup: string };

const gymPeople = (): Person[] => {
  const out: Person[] = [];
  for (let i = 0; i < 8; i++) out.push({ pos: [-7 + i * 2, 0, -8.3], rot: 0, kind: "run", c: look(i), seed: i, cup: CUPS[i % CUPS.length] });
  const kinds: Kind[] = ["curl", "nod", "squat", "curl", "bench", "nod"];
  let n = 8;
  for (let r = 0; r < 5; r++)
    for (let col = 0; col < 7; col++) {
      const x = -7.6 + col * 2.55 + (r % 2) * 0.7;
      const z = -5.4 + r * 2.0;
      if (Math.hypot(x - MACH[0], z - MACH[2]) < 2.6 || Math.hypot(x - SHY[0], z - SHY[2]) < 1.6) continue;
      if (x > 5.2 && z > 0.6) continue; // the door corner belongs to the new guy
      if (n >= 38) continue;
      const kind = kinds[(col * 3 + r * 2) % kinds.length];
      out.push({ pos: [x + (hash(n * 9.1) - 0.5) * 0.5, 0, z + (hash(n * 5.3) - 0.5) * 0.4], rot: (hash(n * 7.7) - 0.5) * 1.6, kind, c: look(n), seed: n, cup: CUPS[n % CUPS.length] });
      n++;
    }
  return out;
};

const Headphones: React.FC<{ color: string; glow: number }> = ({ color, glow }) => (
  <group position={[0, 0.42, 0]}>
    <Part geo={torusArc(0.49, 0.05, Math.PI)} color="#2A2D34" />
    {[1, -1].map((k) => (
      <group key={k} position={[k * 0.49, -0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
        <Part geo={cyl(0.19, 0.19, 0.14, 18)} color={color} emissive={LIME} emissiveIntensity={1.6 * glow} />
        <Part geo={cyl(0.12, 0.12, 0.16, 14)} color={glow > 0.05 ? LIME : "#3A3E48"} emissive={LIME} emissiveIntensity={1.2 * glow} />
      </group>
    ))}
  </group>
);

export const PhoneInHand: React.FC = () => (
  <group position={[0, -0.02, 0.08]} rotation={[0.3, 0, 0]}>
    <Part geo={rbox(0.2, 0.34, 0.04, 0.02)} color="#15171C" />
    <Part geo={box(0.16, 0.28, 0.005)} color="#9FD0FF" emissive="#9FD0FF" emissiveIntensity={0.6} position={[0, 0, 0.023]} shadow={false} />
  </group>
);

export const seated = (): BlockyPose => ({
  ...restPose(),
  legL: { hip: -1.5, sz: 0.12, knee: 1.5 },
  legR: { hip: -1.5, sz: 0.12, knee: 1.5 },
});

export const talkMouth = (f: number, a: number, b: number) => (f >= a + 3 && f < b - 6 ? 0.2 + 0.55 * Math.abs(Math.sin((f - a) * 0.75)) : 0);

export const personPose = (p: Person, f: number): BlockyPose => {
  const s = p.seed;
  let q: BlockyPose;
  if (p.kind === "run") q = runnerPose(f * 0.32 + s * 1.3, 0.75);
  else if (p.kind === "curl") {
    const a = Math.max(0, Math.sin(f * 0.13 + s));
    const b = Math.max(0, Math.sin(f * 0.13 + s + Math.PI));
    q = { ...restPose(), armR: { sx: -0.15, sz: 0.12, twist: 0, elbow: -0.25 - 1.7 * a }, armL: { sx: -0.15, sz: 0.12, twist: 0, elbow: -0.25 - 1.7 * b } };
  } else if (p.kind === "squat") {
    const k = 0.5 - 0.5 * Math.cos(f * 0.12 + s);
    q = { ...restPose(), legL: { hip: -1.0 * k, sz: 0.14, knee: 1.6 * k }, legR: { hip: -1.0 * k, sz: 0.14, knee: 1.6 * k }, bob: -0.36 * k, lean: 0.35 * k, armL: { sx: -1.4, sz: 0.1, twist: 0, elbow: -0.1 }, armR: { sx: -1.4, sz: 0.1, twist: 0, elbow: -0.1 } };
  } else if (p.kind === "bench") {
    const k = 0.5 + 0.5 * Math.sin(f * 0.1 + s);
    q = { ...seated(), armL: { sx: -0.6 - 0.9 * k, sz: 0.2, twist: 0, elbow: -1.2 + 0.9 * k }, armR: { sx: -0.6 - 0.9 * k, sz: 0.2, twist: 0, elbow: -1.2 + 0.9 * k } };
  } else {
    q = { ...restPose(), armL: { sx: 0, sz: 0.1, twist: 0, elbow: -0.2 }, armR: { sx: -0.2, sz: 0.15, twist: 0, elbow: -1.1 } };
    q.headPitch += 0.22 * Math.sin(f * 0.26 + s);
    q.bob += 0.05 * Math.abs(Math.sin(f * 0.26 + s));
    q.armR = { sx: -0.2 - 0.5 * Math.max(0, Math.sin(f * 0.13 + s)), sz: 0.15, twist: 0, elbow: -1.1 };
  }
  q.mouth = "flat";
  q.eyeOpen = Math.min(q.eyeOpen, 0.75 + 0.25 * hash(s * 3.1));
  q.headPitch += 0.1;
  return alive(q, f, s, 0.8);
};

// ---------------------------------------------------------------- props
export const Machine: React.FC = () => (
  <group>
    <Part geo={rbox(0.78, 0.14, 0.78, 0.05)} color="#2F8C86" position={[0, SEAT_TOP - 0.07, 0]} />
    <Part geo={rbox(0.78, 1.1, 0.16, 0.05)} color="#2F8C86" position={[0, SEAT_TOP + 0.55, -0.42]} rotation={[-0.12, 0, 0]} />
    <Part geo={rbox(0.14, SEAT_TOP - 0.1, 0.14, 0.03)} color="#3A2E2A" position={[0, (SEAT_TOP - 0.1) / 2, 0]} />
    <Part geo={rbox(1.1, 0.08, 1.4, 0.03)} color="#3A2E2A" position={[0, 0.04, -0.3]} />
    {/* the weight stack behind */}
    {[1, -1].map((k) => (
      <Part key={k} geo={rbox(0.09, 2.4, 0.09, 0.02)} color="#3A2E2A" position={[k * 0.42, 1.2, -1.05]} />
    ))}
    <Part geo={rbox(0.95, 0.09, 0.2, 0.02)} color="#3A2E2A" position={[0, 2.4, -1.05]} />
    {Array.from({ length: 9 }, (_, i) => (
      <Part key={i} geo={rbox(0.6, 0.11, 0.28, 0.02)} color={i % 2 ? "#5D6670" : "#6E7883"} position={[0, 0.2 + i * 0.12, -1.05]} />
    ))}
    {/* the handles */}
    {[1, -1].map((k) => (
      <Part key={`h${k}`} geo={rbox(0.08, 0.08, 0.62, 0.03)} color="#3A2E2A" position={[k * 0.52, SEAT_TOP + 0.62, 0.05]} />
    ))}
  </group>
);

export const BigClock: React.FC<{ position: V3; rotY: number; minutes: number; s?: number }> = ({ position, rotY, minutes, s = 1 }) => {
  const mA = -(minutes / 60) * Math.PI * 2;
  const hA = -((7 * 60 + minutes) / 720) * Math.PI * 2;
  return (
    <group position={position} rotation={[0, rotY, 0]} scale={s}>
      <Part geo={cyl(0.62, 0.62, 0.1, 32)} color="#D9693F" rotation={[Math.PI / 2, 0, 0]} />
      <Part geo={circle(0.52, 32)} color="#FFF6E6" basic position={[0, 0, 0.055]} shadow={false} />
      {Array.from({ length: 12 }, (_, i) => (
        <Part key={i} geo={box(0.03, 0.09, 0.01)} color="#3A2E2A" basic position={[Math.sin((i / 12) * Math.PI * 2) * 0.43, Math.cos((i / 12) * Math.PI * 2) * 0.43, 0.06]} rotation={[0, 0, -(i / 12) * Math.PI * 2]} shadow={false} />
      ))}
      <group position={[0, 0, 0.065]} rotation={[0, 0, hA]}>
        <Part geo={box(0.06, 0.26, 0.01)} color="#3A2E2A" basic position={[0, 0.11, 0]} shadow={false} />
      </group>
      <group position={[0, 0, 0.075]} rotation={[0, 0, mA]}>
        <Part geo={box(0.04, 0.42, 0.01)} color="#3A2E2A" basic position={[0, 0.18, 0]} shadow={false} />
      </group>
      <Part geo={circle(0.05, 12)} color="#D9693F" basic position={[0, 0, 0.085]} shadow={false} />
    </group>
  );
};

const GymShell: React.FC = () => {
  const { x0, x1, zb, zf, h } = GYM;
  const W = x1 - x0;
  const D = zf - zb;
  const wall = "#EFD9B0";
  return (
    <group>
      <Part geo={box(W, 0.1, D)} color="#C9B591" position={[0, 0.0, (zb + zf) / 2]} />
      <Part geo={box(W - 0.6, 0.02, D - 0.6)} color="#8E7F69" position={[0, 0.06, (zb + zf) / 2]} />
      <Part geo={box(W, h, 0.3)} color={wall} position={[0, h / 2, zb]} />
      <Part geo={box(0.3, h, D)} color={wall} position={[x0, h / 2, (zb + zf) / 2]} />
      {/* right wall with the door gap */}
      <Part geo={box(0.3, h, DOOR_Z - 0.7 - zb)} color={wall} position={[x1, h / 2, (zb + DOOR_Z - 0.7) / 2]} />
      <Part geo={box(0.3, h, zf - (DOOR_Z + 0.7))} color={wall} position={[x1, h / 2, (zf + DOOR_Z + 0.7) / 2]} />
      <Part geo={box(0.3, h - 2.6, 1.4)} color={wall} position={[x1, 2.6 + (h - 2.6) / 2, DOOR_Z]} />
      {/* lime stripe on top of the walls: the gym is easy to find from up high */}
      <Part geo={box(W + 0.3, 0.16, 0.42)} color={LIME} emissive={LIME} emissiveIntensity={0.4} position={[0, h + 0.08, zb]} />
      <Part geo={box(0.42, 0.16, D)} color={LIME} emissive={LIME} emissiveIntensity={0.4} position={[x0, h + 0.08, (zb + zf) / 2]} />
      <Part geo={box(0.42, 0.16, D)} color={LIME} emissive={LIME} emissiveIntensity={0.4} position={[x1, h + 0.08, (zb + zf) / 2]} />
      {/* mirrors on the back wall */}
      {[-6, -2, 2, 6].map((x) => (
        <Part key={x} geo={box(3.4, 2.2, 0.04)} color="#BFE3F2" rough={0.15} position={[x, 2.2, zb + 0.17]} shadow={false} />
      ))}
      {/* a stripe along the side walls */}
      <Part geo={box(0.04, 0.3, D - 0.4)} color="#D9693F" position={[x0 + 0.17, 3.6, (zb + zf) / 2]} shadow={false} />
    </group>
  );
};

// ---------------------------------------------------------------- the neighbourhood
type Block = { x: number; z: number; w: number; d: number; h: number; color: string; floors: number };
const BCOL = ["#F1E1C2", "#E9CF9F", "#EAD7C7", "#D9C4A3", "#F4E9D8", "#E6D3B0", "#DCC8B8"];
const blocks = (): Block[] => {
  const out: Block[] = [];
  for (let gx = -2; gx <= 2; gx++)
    for (let gz = -3; gz <= 2; gz++) {
      if (gx === 0 && gz === 0) continue;
      if (gx === 1 && gz === 0) continue; // the tower's cell
      const k = gx * 13 + gz * 7;
      const h = 5 + Math.floor(hash(k * 1.9) * 5) * 2.2;
      out.push({ x: gx * 24 + (hash(k) - 0.5) * 3, z: gz * 22 + (hash(k * 2.3) - 0.5) * 3, w: 9 + hash(k * 3.1) * 6, d: 8 + hash(k * 4.1) * 5, h, color: BCOL[Math.floor(hash(k * 5.7) * BCOL.length)], floors: Math.max(2, Math.floor(h / 1.7)) });
    }
  return out;
};

// people who want to train, around the area (roofs and streets). Our two are first.
type Dot = { p: V3; c: BlockyColors; rot: number; roof: boolean };
const dots = (B: Block[]): Dot[] => {
  const out: Dot[] = [
    { p: NEW, c: look(901), rot: NEW_ROT, roof: false },
    { p: NB, c: look(902), rot: 0, roof: false },
  ];
  const picks = [0, 3, 5, 8, 11, 14, 17, 20, 22, 25];
  picks.forEach((i, k) => {
    const b = B[i % B.length];
    out.push({ p: [b.x + (hash(k * 3.3) - 0.5) * b.w * 0.5, b.h + 0.2, b.z - b.d / 2 + (hash(k * 4.4) - 0.5) * b.d * 0.4], c: look(500 + k), rot: hash(k) * 6, roof: true });
  });
  const street: V3[] = [[-12, 0, 12], [12, 0, -12], [-12, 0, -34], [36, 0, 11], [-36, 0, -12], [12, 0, 33], [-36, 0, 32], [36, 0, -33]];
  street.forEach((p, k) => out.push({ p, c: look(700 + k), rot: hash(k * 9) * 6, roof: false }));
  return out;
};
// pairs: ours first, then neighbours by list order
const PAIRS: [number, number][] = [[0, 1], [2, 12], [3, 13], [4, 14], [5, 15], [6, 16], [7, 17], [8, 18], [9, 19], [10, 11]];

const ringState = (i: number, f: number, b: ABeats) => {
  const pop = clamp(springAt(f, b.city + 4 + i * 5, 0.5, 4), 0, 1.15);
  const ours = i < 2;
  const pair = PAIRS.findIndex(([a, c]) => a === i || c === i);
  const joinAt = b.join + Math.max(0, pair) * 4;
  const grey = seg(f, b.but, b.but + 14) * (1 - seg(f, joinAt, joinAt + 8));
  const ourLime = ours ? seg(f, b.exists, b.exists + 8) : 0;
  const pulse = ours && f >= b.exists && f < b.join ? 0.35 * (0.5 + 0.5 * Math.sin((f - b.exists) * 0.25)) : 0;
  const g = ours ? grey * (1 - ourLime) : grey;
  return { pop: f < b.city ? 0 : pop * (1 - seg(f, b.join + 40, b.join + 52)), grey: g, pulse };
};

// ---------------------------------------------------------------- camera
const A0: Shot = { p: [-3.4, 3.6, 13.6], l: [-1.0, 1.3, -3], fov: 50 };
const A1: Shot = { p: [2.6, 3.3, 11.4], l: [0.6, 1.3, -3.2], fov: 48 };
const HIGH: Shot = { p: [0, 9.5, 13.5], l: [0, 0.6, -3], fov: 52 };
const TALK: Shot = { p: [-5.3, 2.3, 8.2], l: [-3.6, 1.25, 2.8], fov: 46 };
const TALK2: Shot = { p: [-5.0, 2.2, 7.2], l: [-3.7, 1.3, 2.8], fov: 44 };
const NEWS: Shot = { p: [3.9, 2.25, 7.4], l: [7.05, 1.75, 2.1], fov: 40 };
const NEWS2: Shot = { p: [4.6, 2.6, 9.4], l: [7.7, 1.5, 2.8], fov: 46 };
const BALC: Shot = { p: [14.6, 8.4, 10.6], l: [17.4, 7.6, 2.6], fov: 40 };
const ORB = { target: [-4.5, 1.45, 2.6] as V3, radius: 4.6, height: 2.5, fov: 46 };
const UP1 = { target: [1, 0, -2.5] as V3, height: 34, fov: 50 };
const UP2 = { target: [5, 0, -3] as V3, height: 96, fov: 50 };

const camAt = (b: ABeats, f: number): { c: Shot; blur: number } => {
  if (f < b.gym) return { c: mixShot(A0, A1, seg(f, 0, b.gym, (x) => x)), blur: 0 };
  if (f < b.forty1) return { c: A1, blur: 0 };
  if (f < b.talk - 6) return { c: mixShot(A1, HIGH, seg(f, b.forty1, b.forty1 + 40, easeInOut)), blur: 0 };
  if (f < b.talk + 10) {
    const t = (f - (b.talk - 6)) / 16;
    return { c: whipPan(t, { from: HIGH, to: TALK, mid: 0.5, turn: 0.8 }), blur: whipBlur(t, 0.5, 0.8) };
  }
  if (f < b.newbie) return { c: mixShot(TALK, TALK2, seg(f, b.talk + 10, b.newbie, (x) => x)), blur: 0 };
  if (f < b.up1) {
    const m = mixShot(TALK2, NEWS, seg(f, b.newbie, b.newbie + 30, easeInOut));
    const push = seg(f, b.twenty, b.up1, (x) => x);
    return { c: { ...m, fov: m.fov - 4 * push }, blur: 0 };
  }
  const NEWSP = { ...NEWS, fov: NEWS.fov - 4 };
  if (f < b.building) return { c: birdsEye(seg(f, b.up1, b.building + 6, (x) => x), { ...UP1, from: NEWSP, blend: 0.9 }), blur: 0 };
  const top1 = birdsEye(1, UP1);
  if (f < b.up2) return { c: mixShot(top1, BALC, seg(f, b.building - 4, b.building + 40, easeInOut)), blur: 0 };
  const DESC = b.join + 40;
  const up2At = (ff: number) => {
    const t = seg(ff, b.up2, DESC, (x) => x);
    const sh = birdsEye(t, { ...UP2, spinDeg: 14, from: BALC, blend: 0.22 });
    const k = seg(ff, b.city, DESC, (x) => x);
    return { ...sh, p: [sh.p[0], sh.p[1] - 34 * k, sh.p[2]] as V3 };
  };
  if (f < DESC) return { c: up2At(f), blur: 0 };
  if (f < b.coins) return { c: mixShot(up2At(DESC), NEWS, seg(f, DESC, b.app + 46, easeInOut)), blur: 0 };
  const SEC = orbit(0, { ...ORB, fromDeg: 8, toDeg: 8 });
  if (f < b.secret) return { c: mixShot(NEWS, NEWS2, seg(f, b.coins - 10, b.coins + 16, easeInOut)), blur: 0 };
  if (f < b.hour) return { c: mixShot(NEWS2, SEC, seg(f, b.secret, b.hour + 4, easeInOut)), blur: 0 };
  const o = orbit(seg(f, b.hour, b.end - 22, (x) => x), { ...ORB, fromDeg: 8, toDeg: 42 });
  const back = seg(f, b.end - 22, b.end - 1, easeInOut);
  return { c: back > 0 ? mixShot(o, A0, back) : o, blur: 0 };
};

// ---------------------------------------------------------------- light
const SunRig: React.FC<{ target: V3; wide: number }> = ({ target, wide }) => {
  const { light, tgt } = useMemo(() => {
    const l = new THREE.DirectionalLight();
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.02;
    const t = new THREE.Object3D();
    l.target = t;
    return { light: l, tgt: t };
  }, []);
  const R = wide > 0.5 ? 80 : 22;
  const cam = light.shadow.camera;
  if (cam.right !== R) {
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R; cam.near = 1; cam.far = 260;
    cam.updateProjectionMatrix();
  }
  const snap = (v: number) => Math.round(v / 0.5) * 0.5;
  const tp: V3 = [snap(target[0]), 0, snap(target[2])];
  tgt.position.set(...tp);
  light.position.set(tp[0] - 30, 60, tp[2] + 40);
  light.intensity = 2.3;
  light.color.set("#FFF3DE");
  return (
    <>
      <primitive object={tgt} />
      <primitive object={light} />
    </>
  );
};

// ---------------------------------------------------------------- the world
const World: React.FC<{ f: number; b: ABeats; c: Shot; P: Person[]; B: Block[]; D: Dot[] }> = ({ f, b, c, P, B, D }) => {
  const wide = c.p[1] > 20 ? 1 : 0;
  const nodes: React.ReactNode[] = [];
  // headphones light up in a wave on «سماعة», left to right
  const glowFor = (x: number) => {
    const at = b.forty2 + 6 + (x + 9) * 1.4;
    const k = f - at;
    return k < 0 ? 0 : Math.max(0.15 * seg(f, b.forty2, b.talk), Math.exp(-k / 14)) * (1 - seg(f, b.talk, b.talk + 10));
  };
  P.forEach((p, i) => {
    const y = p.kind === "run" ? 0.25 : p.kind === "bench" ? SEAT_TOP - 0.84 : 0;
    if (p.kind === "run") nodes.push(<Treadmill key={`t${i}`} position={p.pos} frame={f} />);
    if (p.kind === "bench") nodes.push(<Bench key={`b${i}`} position={[p.pos[0], 0, p.pos[2] - 0.35]} rotationY={p.rot} />);
    nodes.push(
      <group key={`p${i}`} position={[p.pos[0], y, p.pos[2]]} rotation={[0, p.rot, 0]}>
        <Blocky
          pose={personPose(p, f)}
          colors={p.c}
          scale={0.92}
          noBlob={p.kind === "bench"}
          headgear={<Headphones color={p.cup} glow={glowFor(p.pos[0])} />}
          rightHand={p.kind === "curl" ? <Dumbbell s={0.32} color="#5D6670" /> : undefined}
          leftHand={p.kind === "curl" ? <Dumbbell s={0.32} color="#5D6670" /> : undefined}
        />
      </group>,
    );
  });

  // the machine + the cold one (seated, phone, never looks up) + the shy one
  const coldP: BlockyPose = (() => {
    let q: BlockyPose = { ...seated(), armR: { sx: -1.0, sz: 0.1, twist: 0, elbow: -1.3 }, armL: { sx: -0.5, sz: 0.25, twist: 0, elbow: -0.6 } };
    q.headPitch = 0.42;
    q.mouth = "flat";
    q.eyeOpen = 0.7;
    q.brow = -0.2;
    const m = talkMouth(f, b.reply, b.newbie);
    if (m > 0) { q.mouth = "o"; q.mouthOpen = m * 0.7; }
    // he still sits there at the end; the head drops a little lower, a slow yawn
    if (f >= b.hour) { q.headPitch = 0.22; q.eyeOpen = 0.5; q.headYaw = -0.15; }
    return alive(q, f, 77, 0.5);
  })();
  const web = seg(f, b.hour + 8, b.hour + 40);
  nodes.push(
    <group key="mach" position={MACH} rotation={[0, MACH_ROT, 0]}>
      <Machine />
      <group position={[0, SEAT_TOP - 0.84, 0.08]}>
        <Blocky pose={coldP} colors={{ ...look(77), shirt: "#2B2F3A", pants: "#22262E" }} noBlob headgear={<Headphones color="#E2574C" glow={glowFor(MACH[0])} />} rightHand={<PhoneInHand />} />
      </group>
      {web > 0 && <Cobwebs k={web} />}
    </group>,
  );
  const shyP: BlockyPose = (() => {
    let q: BlockyPose = { ...restPose(), ...shyArms(), hunch: 0.5, headPitch: 0.1, brow: 0.6, mouth: "smile", blush: 0.3 };
    const tap = f >= b.ask && f < b.ask + 26;
    if (f >= b.talk && f < b.newbie) {
      const reach = seg(f, b.ask - 6, b.ask + 4) * (1 - seg(f, b.ask + 22, b.ask + 32));
      q = lerpPose(q, { ...q, armR: { sx: -1.25, sz: -0.05, twist: 0, elbow: -0.35 - (tap ? 0.18 * Math.abs(Math.sin((f - b.ask) * 0.9)) : 0) }, lean: 0.1 }, reach);
      const m = talkMouth(f, b.ask, b.reply);
      if (m > 0) { q.mouth = "o"; q.mouthOpen = m * 0.6; }
      const deflate = seg(f, b.reply + 18, b.reply + 34);
      q.shrug += 0.4 * deflate;
      q.headPitch += 0.25 * deflate;
      q.mouth = deflate > 0.5 ? "wavy" : q.mouth;
    }
    if (f >= b.hour) {
      // he is STILL waiting: hands on hips, foot tapping, looks at the man
      q = { ...restPose(), armL: { sx: 0.1, sz: 0.6, twist: 1.2, elbow: -1.6 }, armR: { sx: 0.1, sz: 0.6, twist: 1.2, elbow: -1.6 }, brow: -0.3, mouth: "flat", headPitch: 0.15 };
      q.legR = { hip: -0.05, sz: 0.05, knee: 0.1, toe: 0 };
      q.bob = 0.01 * Math.abs(Math.sin(f * 0.5));
    }
    return alive(q, f, 66, 0.7);
  })();
  nodes.push(
    <group key="shy" position={SHY} rotation={[0, SHY_ROT, 0]}>
      <Blocky pose={shyP} colors={{ ...look(66), shirt: "#F1E1C2", pants: "#3C4A66" }} headgear={<Headphones color="#3F8FD6" glow={0} />} />
    </group>,
  );

  // the new guy by the door: looks around, then into his phone; the neighbour walks in on «سوا»
  const newP: BlockyPose = (() => {
    let q: BlockyPose = { ...restPose(), ...shyArms(), hunch: 0.35, brow: 0.5, mouth: "flat", headPitch: 0.05 };
    q.eyeX = Math.sin(f * 0.07) * 0.8;
    q.headYaw = Math.sin(f * 0.045) * 0.25;
    const ph = seg(f, b.phone - 8, b.phone + 6);
    q = lerpPose(q, { ...restPose(), armR: { sx: -1.05, sz: 0.05, twist: 0, elbow: -1.25 }, armL: { sx: -0.9, sz: -0.15, twist: 0, elbow: -1.2 }, headPitch: 0.45, eyeY: -0.6, mouth: "flat", brow: 0.3 }, ph);
    if (f >= b.twenty && f < b.up1) q.roll += 0.04 * Math.sin((f - b.twenty) * 0.08);
    // after the app: he looks up, smiles; the high five with the neighbour
    const up = seg(f, b.coins - 4, b.coins + 10);
    if (up > 0) q = lerpPose(q, { ...restPose(), headYaw: 0.5, mouth: "grin", brow: -0.2, eyeX: 0.6 }, up);
    const hf = seg(f, b.coins + 46, b.coins + 54) * (1 - seg(f, b.coins + 64, b.coins + 76));
    if (hf > 0) q = lerpPose(q, { ...q, armR: { sx: -2.6, sz: 0.25, twist: 0, elbow: -0.2 } }, hf);
    return alive(q, f, 901, 0.8);
  })();
  if (f < b.up2 + 20 || f >= b.join) {
    nodes.push(
      <group key="new" position={NEW} rotation={[0, NEW_ROT, 0]}>
        <Blocky pose={newP} colors={{ ...look(901), shirt: "#3F8FD6", pants: "#2B2F3A" }} headgear={<Headphones color="#F6F6F6" glow={0} />} rightHand={f < b.coins + 30 ? <PhoneInHand /> : undefined} />
      </group>,
    );
  }
  nodes.push(<BigClock key="ck" position={CLOCK_GYM} rotY={-Math.PI / 2} s={1.3} minutes={20 * seg(f, b.twenty, b.twenty + 60, easeInOut) + (f >= b.up1 ? 0 : 0)} />);
  nodes.push(<Part key="door" geo={box(0.05, 2.5, 1.35)} color="#FFF3D6" emissive="#FFF3D6" emissiveIntensity={0.5} basic position={[GYM.x1 + 0.2, 1.25, DOOR_Z]} shadow={false} />);

  // the neighbour: on his balcony until the city; then he walks in through the gym door on «سوا»
  const nbC = { ...look(902), shirt: "#E3A93B", pants: "#2B2F3A" };
  if (f < b.coins) {
    const bounce = Math.abs(Math.sin(f * 0.22));
    const q: BlockyPose = alive({ ...seated(), legL: { hip: -1.5, sz: 0.12, knee: 1.5 + 0.15 * bounce }, armR: { sx: -0.4, sz: 0.2, twist: 0, elbow: -1.6 }, headYaw: -0.35 + 0.25 * Math.sin(f * 0.03), brow: 0.4, mouth: "flat" }, f, 902, 0.8);
    nodes.push(
      <group key="nb" position={[NB[0], BALC_Y + 0.05 + 0.48 - 0.84, NB[2]]}>
        <Blocky pose={q} colors={nbC} noBlob />
        <Part geo={rbox(0.7, 0.1, 0.7, 0.04)} color="#D9693F" position={[0, 0.84 - 0.48 + 0.42, -0.05]} />
      </group>,
    );
  } else {
    const t = seg(f, b.coins + 2, b.coins + 44, (x) => x);
    const path: [V3, V3] = [[9.4, 0, DOOR_Z], [8.15, 0, 3.15]];
    const p = [lerp(path[0][0], path[1][0], t), 0, lerp(path[0][2], path[1][2], t)] as V3;
    let q = t < 1 ? walkPose(f * 0.38, 1) : { ...restPose(), mouth: "grin" as const, brow: -0.2 };
    const hf = seg(f, b.coins + 46, b.coins + 54) * (1 - seg(f, b.coins + 64, b.coins + 76));
    if (hf > 0) q = lerpPose(q, { ...q, armL: { sx: -2.6, sz: 0.25, twist: 0, elbow: -0.2 } }, hf);
    q.mouth = "grin";
    nodes.push(
      <group key="nbw" position={p} rotation={[0, -1.85, 0]}>
        <Blocky pose={alive(q, f, 902, 0.6)} colors={nbC} />
      </group>,
    );
  }

  // the tower + balcony + its clock, and the rest of the area
  nodes.push(
    <group key="tower" position={[TOWER.x, 0, TOWER.z + TOWER.d / 2]}>
      <Building w={TOWER.w} d={TOWER.d} h={TOWER.h} color="#EAD7C7" lit={0.3} sign="#3F8FD6" accent="#E3A93B" floors={8} />
    </group>,
  );
  nodes.push(
    <group key="balc" position={[TOWER.x, BALC_Y, TOWER.z + TOWER.d / 2 + 0.75]}>
      <Part geo={box(3.6, 0.18, 1.5)} color="#D9C4A3" />
      <Part geo={box(3.6, 0.9, 0.08)} color="#F4E9D8" position={[0, 0.5, 0.72]} opacity={0.55} />
      <Part geo={box(3.6, 0.08, 0.12)} color="#3A2E2A" position={[0, 0.98, 0.72]} />
      <Part geo={box(1.1, 2.1, 0.06)} color="#26303F" position={[-1.0, 1.1, -0.72]} />
    </group>,
  );
  nodes.push(<BigClock key="ck2" position={CLOCK_NB} rotY={0} s={0.9} minutes={20 * seg(f, b.twenty, b.twenty + 60, easeInOut)} />);
  B.forEach((bl, i) =>
    nodes.push(
      <group key={`bl${i}`} position={[bl.x, 0, bl.z + bl.d / 2]}>
        <Building w={bl.w} d={bl.d} h={bl.h} color={bl.color} lit={0.25} sign="#D9693F" accent="#E3A93B" floors={bl.floors} />
      </group>,
    ),
  );

  // people on roofs and streets + their rings (the city beats only)
  if (f >= b.up2 && f < b.join + 54) {
    D.forEach((d, i) => {
      const st = ringState(i, f, b);
      if (i >= 2) {
        const q = alive({ ...restPose(), armR: { sx: -0.2, sz: 0.15, twist: 0, elbow: -1.1 }, headPitch: 0.15 }, f, 300 + i, 0.8);
        nodes.push(
          <group key={`dp${i}`} position={d.p} rotation={[0, d.rot, 0]} scale={2.2}>
            <Blocky pose={q} colors={d.c} />
          </group>,
        );
      }
      if (st.pop > 0.01) {
        const col = new THREE.Color(LIME).lerp(new THREE.Color("#8E949C"), st.grey).getStyle();
        nodes.push(
          <group key={`ring${i}`} position={[d.p[0], d.p[1] + 0.12, d.p[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={st.pop * (1 + st.pulse)}>
            <Part geo={circle(4.2, 32)} color={col} basic opacity={0.45} shadow={false} />
            <Part geo={torusArc(4.2, 0.6, Math.PI * 2)} color={col} basic shadow={false} />
          </group>,
        );
      }
    });
  }

  return (
    <>
      <SkyDome />
      <fog attach="fog" args={["#F6EBD6", 140, 420]} />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#FFF6E6", "#C9B08A", 0.6]} />
      <SunRig target={wide ? [5, 0, -3] : [c.l[0], 0, c.l[2]]} wide={wide} />
      <ShotRig shot={c} />
      {/* the ground: streets + block plates */}
      <Part geo={box(400, 0.1, 400)} color="#B9AE9C" position={[0, -0.06, 0]} />
      <GymShell />
      {nodes}
    </>
  );
};

export const Cobwebs: React.FC<{ k: number }> = ({ k }) => {
  const lines: [V3, V3][] = [
    [[0.0, 1.95, 0.05], [0.38, 1.66, -0.42]],
    [[0.0, 1.95, 0.05], [-0.38, 1.66, -0.42]],
    [[0.32, 1.8, 0.2], [0.52, 1.18, 0.05]],
    [[-0.32, 1.8, 0.2], [-0.52, 1.18, 0.05]],
    [[0.3, 1.25, 0.1], [0.52, 1.18, 0.35]],
    [[0.0, 1.95, 0.05], [0.0, 2.4, -1.05]],
    [[0.38, 1.66, -0.42], [0.42, 2.4, -1.05]],
  ];
  return (
    <group>
      {lines.map(([a, c], i) => {
        const mid: V3 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
        const d = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
        const len = d.length() * k;
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
        const e = new THREE.Euler().setFromQuaternion(q);
        return <Part key={i} geo={cyl(0.008, 0.008, 1, 4)} color="#FFFFFF" basic opacity={0.85} scale={[1, Math.max(0.001, len), 1]} position={mid} rotation={[e.x, e.y, e.z]} shadow={false} />;
      })}
      {/* a little web disc on the backrest corner */}
      <group position={[0.42, 1.55, -0.3]} rotation={[0, 0.5, 0]} scale={k * 1.4}>
        {Array.from({ length: 6 }, (_, i) => (
          <Part key={i} geo={box(0.006, 0.4, 0.006)} color="#FFFFFF" basic opacity={0.8} rotation={[0, 0, (i / 6) * Math.PI]} shadow={false} />
        ))}
        {[0.08, 0.14, 0.2].map((r) => (
          <Part key={r} geo={torusArc(r, 0.004, Math.PI * 2)} color="#FFFFFF" basic opacity={0.75} shadow={false} />
        ))}
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- 2D layers
const projector = () => {
  const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.1, 3000);
  return (c: Shot, wp: V3) => {
    cam.fov = c.fov;
    cam.position.set(...c.p);
    cam.up.set(...(c.up ?? [0, 1, 0]));
    cam.lookAt(...c.l);
    cam.rotateZ(c.roll ?? 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const v = new THREE.Vector3(...wp).project(cam);
    const depth = new THREE.Vector3(...wp).applyMatrix4(cam.matrixWorldInverse).z * -1;
    return { x: ((v.x + 1) / 2) * 1080, y: ((1 - v.y) / 2) * 1920, behind: depth <= 0.2 };
  };
};
type Proj = ReturnType<typeof projector>;

const Forty: React.FC<{ f: number; b: ABeats }> = ({ f, b }) => {
  if (f < b.forty1 + 4 || f > b.talk + 2) return null;
  const s = clamp(springAt(f, b.forty1 + 4, 0.5, 4), 0, 1.2);
  const op = 1 - seg(f, b.talk - 8, b.talk + 2);
  const hp = clamp(springAt(f, b.forty2 + 4, 0.5, 4), 0, 1.25);
  return (
    <div style={{ position: "absolute", left: 0, top: 230, width: 1080, display: "flex", justifyContent: "center", alignItems: "center", gap: 30, opacity: op, transform: `scale(${s})`, transformOrigin: "540px 360px" }}>
      <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 240, lineHeight: 1, color: "#FFFFFF", WebkitTextStroke: `10px ${INK}`, paintOrder: "stroke fill", textShadow: "0 12px 30px rgba(0,0,0,0.35)" }}>40</span>
      {f >= b.forty2 + 4 && <HeadphoneIcon s={hp} />}
    </div>
  );
};

const HeadphoneIcon: React.FC<{ s: number }> = ({ s }) => (
  <svg width={210} height={210} viewBox="0 0 100 100" style={{ transform: `scale(${s})`, filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.4))" }}>
    <path d="M18 60 V50 A32 32 0 0 1 82 50 V60" fill="none" stroke={INK} strokeWidth={16} strokeLinecap="round" />
    <path d="M18 60 V50 A32 32 0 0 1 82 50 V60" fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" />
    <rect x={8} y={52} width={22} height={36} rx={9} fill={LIME} stroke={INK} strokeWidth={5} />
    <rect x={70} y={52} width={22} height={36} rx={9} fill={LIME} stroke={INK} strokeWidth={5} />
  </svg>
);

const JoinLines: React.FC<{ f: number; b: ABeats; c: Shot; proj: Proj; D: Dot[] }> = ({ f, b, c, proj, D }) => {
  if (f < b.join || f > b.join + 54) return null;
  const fade = 1 - seg(f, b.join + 40, b.join + 52);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, opacity: fade }}>
      <defs>
        <filter id="lg" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      {PAIRS.map(([i, j], k) => {
        const a = proj(c, [D[i].p[0], D[i].p[1] + 1.4, D[i].p[2]]);
        const e = proj(c, [D[j].p[0], D[j].p[1] + 1.4, D[j].p[2]]);
        if (a.behind || e.behind) return null;
        const t = seg(f, b.join + k * 4, b.join + k * 4 + 14, easeOut);
        if (t <= 0) return null;
        const x2 = lerp(a.x, e.x, t);
        const y2 = lerp(a.y, e.y, t);
        const mx = (a.x + x2) / 2;
        const my = (a.y + y2) / 2 - 0.25 * Math.hypot(x2 - a.x, y2 - a.y);
        const d = `M ${a.x} ${a.y} Q ${mx} ${my} ${x2} ${y2}`;
        const w = k === 0 ? 1.4 : 1;
        return (
          <g key={k}>
            <path d={d} stroke={LIME} strokeWidth={16 * w} fill="none" opacity={0.55} filter="url(#lg)" />
            <path d={d} stroke={LIME} strokeWidth={8 * w} strokeLinecap="round" strokeDasharray="18 14" strokeDashoffset={-f * 3} fill="none" />
          </g>
        );
      })}
    </svg>
  );
};

const PlusOne: React.FC<{ f: number; b: ABeats; c: Shot; proj: Proj }> = ({ f, b, c, proj }) => {
  const a0 = b.coins + 62;
  if (f < a0 || f > b.secret + 6) return null;
  const heads: V3[] = [[NEW[0], 2.35, NEW[2]], [8.15, 2.35, 3.15]];
  const out = seg(f, b.secret - 6, b.secret + 6);
  return (
    <>
      {heads.map((h, i) => {
        const p = proj(c, h);
        if (p.behind) return null;
        const s = clamp(springAt(f, a0 + i * 4, 0.5, 4), 0, 1.25);
        const rise = 40 * seg(f, a0, a0 + 30, easeOut);
        return (
          <div key={i} style={{ position: "absolute", left: p.x - 70, top: p.y - 120 - rise, width: 140, height: 140, transform: `scale(${s})`, opacity: 1 - out }}>
            <div style={{ width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #FFE58A, #F2B632 60%, #C98A1E)", border: "6px solid #8C5A12", boxShadow: "0 10px 24px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 60, color: "#5A3B10" }}>+1</div>
          </div>
        );
      })}
      {f >= a0 + 26 && (
        <div dir="rtl" style={{ position: "absolute", left: 140, top: 330, transform: `scale(${clamp(springAt(f, a0 + 26, 0.5, 4), 0, 1.2)}) rotate(-4deg)`, opacity: 1 - out }}>
          <div style={{ background: LIME, border: `6px solid ${INK}`, borderRadius: 28, padding: "12px 34px", fontFamily: AR, fontWeight: 900, fontSize: 70, color: INK, boxShadow: "0 12px 26px rgba(0,0,0,0.3)" }}>خصومات %</div>
        </div>
      )}
    </>
  );
};

export const PHONE: AppPhoneSpec = {
  screens: ["footage/gym-alone/app/card.png", "footage/gym-alone/app/match.png"],
  img: { w: 1080, h: 2402 },
  rest: { x: 70, y: 120, w: 430 },
  focus: { x0: 98, y0: 795, x1: 984, y1: 1105 },
  to: { x: 330, y: 560 },
  zoom: 1.35,
  button: { x0: 52, y0: 1800, x1: 1028, y1: 1944 },
  accent: LIME,
  rings: { rects: [{ x0: 98, y0: 795, x1: 984, y1: 940 }, { x0: 98, y0: 960, x1: 984, y1: 1105 }], on: [0, 0], off: 0, color: LIME },
};

const Logo: React.FC<{ f: number; b: ABeats }> = ({ f, b }) => {
  const a = b.logo;
  if (f < a - 2) return null;
  const s = clamp(springAt(f, a - 2, 0.5, 5), 0, 1.2);
  const sweep = seg(f, a + 8, a + 30, easeInOut);
  const float = 8 * Math.sin((f - a) * 0.08);
  const out = seg(f, b.end - 14, b.end - 2);
  const src = staticFile("footage/gym-alone/logo.svg");
  return (
    <div style={{ position: "absolute", left: 540 - 230, top: 90 + float, width: 460, height: 420, transform: `scale(${0.78 * s * (1 - 0.3 * out)})`, transformOrigin: "50% 60%", opacity: 1 - out }}>
      <div style={{ position: "absolute", inset: -40, borderRadius: "50%", background: "radial-gradient(circle, rgba(214,255,60,0.45) 0%, rgba(214,255,60,0) 65%)" }} />
      <Img src={src} style={{ position: "absolute", left: 30, top: 0, width: 400, height: 362, filter: "drop-shadow(0 16px 26px rgba(0,0,0,0.35))" }} />
      <div style={{ position: "absolute", left: 30, top: 0, width: 400, height: 362, overflow: "hidden", WebkitMaskImage: `url(${src})`, WebkitMaskSize: "100% 100%", maskImage: `url(${src})`, maskSize: "100% 100%" }}>
        <div style={{ position: "absolute", top: -100, left: lerp(-300, 520, sweep), width: 120, height: 600, background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.85), rgba(255,255,255,0))", transform: "rotate(20deg)" }} />
      </div>
      <div dir="rtl" style={{ position: "absolute", left: -100, top: 360, width: 660, textAlign: "center", fontFamily: AR, fontWeight: 900, fontSize: 76, color: INK, textShadow: "0 0 20px rgba(255,255,255,0.9)", opacity: seg(f, a + 4, a + 12) }}>
        تمرينة
      </div>
    </div>
  );
};

// a whisper beat: the picture dims and holds still around «الجيم»
const Hush: React.FC<{ f: number; b: ABeats }> = ({ f, b }) => {
  const k = seg(f, b.gym - 4, b.gym + 6) * (1 - seg(f, b.forty1 - 8, b.forty1 + 4));
  if (k <= 0) return null;
  return <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 35%, rgba(10,8,6,0.55) 100%)", opacity: k }} />;
};

const DebugOverlay: React.FC<{ info: string }> = ({ info }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 20, top: 20, right: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "22px monospace", padding: 8, whiteSpace: "pre-wrap" }}>{info}</div>
  </AbsoluteFill>
);

export const FactAlone: React.FC<FactAloneProps> = ({ beats = ALONE_BEATS, durationSec = ALONE_DURATION, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const b = useMemo(() => makeAloneBeats(beats, fps, durationSec), [beats, fps, durationSec]);
  const proj = useMemo(() => projector(), []);
  const P = useMemo(() => gymPeople(), []);
  const B = useMemo(() => blocks(), []);
  const D = useMemo(() => dots(B), [B]);
  const frame = useCurrentFrame();
  const { c, blur } = camAt(b, frame);
  const tap = Math.round(lerp(b.app, b.coins, 0.72));
  const phoneT = { inF: b.app + 18, pushF: b.app + 34, tapF: tap, outF: b.coins + 4 };
  const phoneSpec: AppPhoneSpec = { ...PHONE, rings: { ...PHONE.rings!, on: [b.app + 40, b.app + 70], off: tap - 3 } };
  return (
    <AbsoluteFill style={{ backgroundColor: "#F6EBD6" }}>
      <AbsoluteFill style={{ filter: blur > 0.01 ? `blur(${(blur * 3).toFixed(2)}px)` : undefined }}>
        <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 50, near: 0.1, far: 1000, position: [0, 2, 9] }} gl={{ antialias: true }}>
          <World f={frame} b={b} c={c} P={P} B={B} D={D} />
        </ThreeCanvas>
      </AbsoluteFill>
      <Hush f={frame} b={b} />
      <Forty f={frame} b={b} />
      <JoinLines f={frame} b={b} c={c} proj={proj} D={D} />
      <AppPhone f={frame} t={phoneT} spec={phoneSpec} />
      <PlusOne f={frame} b={b} c={c} proj={proj} />
      <Logo f={frame} b={b} />
      {debug && <DebugOverlay info={`f${frame} ${(frame / fps).toFixed(2)}s  p ${c.p.map((v) => v.toFixed(1)).join(",")} l ${c.l.map((v) => v.toFixed(1)).join(",")} fov ${c.fov.toFixed(0)}`} />}
    </AbsoluteFill>
  );
};
