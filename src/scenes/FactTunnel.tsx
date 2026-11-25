import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { PAL, Part, box } from "./fact3d/parts";
import { clamp, easeIn, easeInOut, easeOut, hash, lerp, seg, springAt } from "./fact3d/anim";
import { alive, lerpPose, walkPose, wavePose } from "./fact3d/acting";
import { mixC } from "./fact3d/zander";
import { Key, ModernBall, SmallGoal, sampleTrack } from "./fact3d/mob";
import { Building, COURT, PadelCourt, Racket, SpotRing, WPAL } from "./fact3d/waffarha";
import { CairoMap } from "./fact3d/cairoMap";
import {
  DiscountGate, FlyItem, GATE, GlowDumbbell, GymFront, GymGate, Item, LockedCourt, Padlock, PercentTag, PITCH, Pitch, PopTag, Rib, ShopFront, TPAL, TrackFloor, V3, frontCells, gateCells,
} from "./fact3d/tunnel";
import { TBeats, TUNNEL_DURATION, TUNNEL_STARTS, TUNNEL_WORDS, TunnelWords, makeTunnelBeats } from "./fact3d/tunnelTiming";
import { loadFonts } from "../lib/fonts";

loadFonts();

// «ليه عشان تطلب أكل بتلاقي 100 عرض…» (videos/waffarha-tunnel): ONE camera, no cuts, no coin.
//  1 flying down a warm track of offers (burgers, coffee, bags, tickets, pizza, each with a spinning «%»), discount gates
//    open ahead of us, a burst of «%» on «100»
//  2 «تنزل»: the track ends at the locked gym gate, hard brake + shake, everything flying with us crashes into it and
//    piles up, a red «دفع كامل» card drops on it
//  3 pull back: open shops pop (food, café, cinema), then dark locked venues (gym, court, academy), a big «؟»
//  4 back at the gate: «تمرينة» = a lime wave, the gate shatters, the shards build a lit gym front
//  5 through its door down a lime track: venue gates open for us, courts rise, lime «%» on all of them, a coupon ✕
//  6 a pitch and a padel court (one empty spot each), a lonely man at a gym door, friends walk in
//  7 the camera rises, the Cairo map (Obour lime, «؟» elsewhere); the last 0.6 s dives back into frame 0 (a loop).

export type FactTunnelProps = { starts?: number[]; words?: Partial<TunnelWords>; durationSec?: number; debug?: boolean };

type Shot = { p: V3; l: V3; fov: number };

// ---------------------------------------------------------------- the opening run (closed form, valid for t < 0 too)
const V0 = 10; // u/s at frame 0 (already moving)
const V1 = 26; // top speed after ACC s
const ACC = 2;
const BR = 0.45; // the hard brake (s)
const CAM_Y = 1.9;
const STOP_D = 7.5; // the camera stops this far from the gate
const distAt = (t: number, tb: number) => {
  if (t <= 0) return V0 * t;
  const dAcc = (u: number) => V0 * u * ACC + (V1 - V0) * ACC * (u ** 3 - u ** 4 / 2);
  if (t <= ACC) return dAcc(t / ACC);
  const d2 = dAcc(1);
  if (t <= tb) return d2 + V1 * (t - ACC);
  const d3 = d2 + V1 * (tb - ACC);
  const b = Math.min(1, (t - tb) / BR);
  return d3 + ((V1 * BR) / 3) * (1 - (1 - b) ** 3);
};
const velAt = (t: number, tb: number) => {
  if (t <= 0) return V0;
  if (t <= ACC) { const u = t / ACC; return V0 + (V1 - V0) * u * u * (3 - 2 * u); }
  if (t <= tb) return V1;
  const b = Math.min(1, (t - tb) / BR);
  return V1 * (1 - b) ** 2;
};

type Lay = {
  tb: number;
  zG: number; // the gym gate's face
  gates: number[]; // discount gates in the opening run
  // the lime run
  GZ1: number;
  GZ2: number;
  ZC: number; // courts that rise
  ZV: number[]; // venues along the lime track
  Zp: number; // the pitch
  Zpd: number; // the padel court
  Zd: number; // the gym door with the lonely man
  KB: Key[];
  KC: Key[];
};

const layout = (B: TBeats): Lay => {
  const fps = B.fps;
  const tb = Math.max(ACC + 0.2, B.w.down / fps);
  const zStop = -distAt(tb + BR + 1, tb);
  const zG = zStop - STOP_D;
  const gates = [0.9, 2.1, 3.3].filter((t) => t < tb - 0.3).map((t) => -distAt(t, tb));
  const w = B.w;
  // ---- part 3: pull back, the open shops (right), the dark venues (left), back to the gate
  const R = 9.8;
  const KB: Key[] = [
    { f: B.s[1], p: [0, 3, zG + STOP_D - 0.5], l: [0, 3.1, zG], fov: 58, still: true },
    { f: w.waff - 4, p: [3.8, 4.4, zG + 16.5], l: [5.0, 2.0, zG], fov: 50, still: true },
    { f: w.outings + 18, p: [R + 0.9, 4.4, zG + 18], l: [R + 0.3, 1.8, zG], fov: 50, still: true },
    { f: w.gyms - 3, p: [-R, 4.6, zG + 19.5], l: [-R, 1.8, zG], fov: 50, still: true },
    { f: w.free - 2, p: [-R + 0.3, 4.2, zG + 16.5], l: [-R, 2.2, zG], fov: 50 },
    { f: w.free + 22, p: [-R + 0.5, 4.8, zG + 16], l: [-R, 3.4, zG], fov: 50, still: true },
    { f: B.s[2] - 2, p: [0, 3, zG + 8], l: [0, 3.1, zG], fov: 58, still: true },
  ];
  // ---- parts 4-6: the shatter, through the new door, the lime run, the sports, the gym door
  const fC5 = B.s[3] + 28;
  const v2 = 16 / fps;
  const lin = (f: number) => zG - 1 - v2 * (f - fC5);
  const GZ1 = lin(w.gyms5 + 14);
  const GZ2 = Math.min(lin(w.acad5 + 14), GZ1 - 6);
  const z8 = Math.min(lin(w.courts5 + 8), GZ2 - 6);
  const ZC = z8 - 22;
  const ZV = [ZC - 18, ZC - 24, ZC - 30, ZC - 36];
  const Zp = ZC - 50;
  const Zpd = Zp - 17;
  const Zd = Zpd - 16;
  const KC: Key[] = [
    { f: B.s[2] - 2, p: [0, 3, zG + 8], l: [0, 3.1, zG], fov: 58, still: true },
    { f: w.tam - 2, p: [0, 3, zG + 7], l: [0, 3.1, zG], fov: 58, still: true },
    { f: w.tam + 7, p: [0, 2.9, zG + 4.8], l: [0, 3.2, zG], fov: 62, still: true },
    { f: w.tam + 40, p: [0, 3.4, zG + 12.5], l: [0, 3.3, zG], fov: 58, still: true },
    { f: B.s[3] + 10, p: [0, 2.8, zG + 9], l: [0, 2.2, zG - 10], fov: 60 },
    { f: fC5, p: [0, 1.9, zG - 1], l: [0, 1.9, zG - 14], fov: 64 },
    { f: w.gyms5 + 14, p: [0, 1.9, GZ1], l: [0, 1.9, GZ1 - 13], fov: 64 },
    { f: w.acad5 + 14, p: [0, 2.0, GZ2], l: [0, 2.0, GZ2 - 13], fov: 64 },
    { f: w.courts5 + 8, p: [0, 2.6, z8], l: [0, 1.6, z8 - 16], fov: 64 },
    { f: w.offers + 19, p: [0, 5.5, ZC - 2], l: [0, 1.8, ZC - 22], fov: 62 },
    { f: w.coupon, p: [0, 5.5, ZC - 14], l: [0, 1.8, ZC - 34], fov: 62 },
    { f: B.s[4], p: [0, 6.0, ZC - 20], l: [0, 0.5, ZC - 40], fov: 60 },
    { f: w.ball - 14, p: [0, 8.5, Zp + 12], l: [0, 0, Zp - 1], fov: 52 },
    { f: w.padel + 8, p: [0, 9.5, Zp + 1], l: [0, 0, Zpd], fov: 52 },
    { f: w.lazy + 20, p: [0, 4.8, Zd + 12.5], l: [0, -0.4, Zd], fov: 50, still: true },
    { f: B.riseA, p: [0, 4.6, Zd + 11.4], l: [0, -0.4, Zd], fov: 50, still: true },
  ];
  return { tb, zG, gates, GZ1, GZ2, ZC, ZV, Zp, Zpd, Zd, KB, KC };
};

/** the opening run's camera at t seconds (negative t = the loop's last frames) */
const camRun = (B: TBeats, L: Lay, t: number): Shot => {
  const { tb, zG } = L;
  const z = -distAt(t, tb);
  const v = velAt(t, tb);
  const u = easeInOut(clamp((t - tb) / BR));
  const x = 0.3 * Math.sin(t * 1.1) * (1 - u);
  const y = lerp(CAM_Y + 0.12 * Math.sin(t * 1.7), 3.0, u);
  const p: V3 = [x, y, z];
  const l: V3 = [x * 0.5, lerp(CAM_Y + 0.25, 3.1, u), lerp(z - 12, zG, u)];
  const f = t * B.fps;
  const h = t - (tb + BR);
  if (h > 0) {
    // the shake on «الجيم» + breathing + a slow push while the gate holds
    const k = f - B.w.gym1;
    const sh = (amp: number, fr: number) => (k > 0 ? amp * Math.exp(-k / 5) * Math.sin(k * fr) : 0);
    p[0] += sh(0.16, 1.5) + 0.05 * Math.sin(h * 0.9);
    p[1] += sh(0.11, 1.9) + 0.04 * Math.sin(h * 1.3);
    p[2] -= 0.5 * easeInOut(clamp(h / Math.max(0.5, B.s[1] / B.fps - tb - BR)));
    l[0] += sh(0.05, 1.2);
  }
  return { p, l, fov: 58 + (10 * v) / V1 };
};

const MAP_P = (L: Lay): Shot => ({ p: [0, 150, L.Zd + 4], l: [0, 0, L.Zd], fov: 50 });
const LOOP_HIGH: Shot = { p: [0, 46, 22], l: [0, 0, 6], fov: 58 };
const mixShot = (a: Shot, b: Shot, u: number): Shot => ({
  p: [lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u)],
  l: [lerp(a.l[0], b.l[0], u), lerp(a.l[1], b.l[1], u), lerp(a.l[2], b.l[2], u)],
  fov: lerp(a.fov, b.fov, u),
});

const camAt = (B: TBeats, L: Lay, f: number): Shot => {
  if (f >= B.loopA) return mixShot(LOOP_HIGH, camRun(B, L, (f - B.end) / B.fps), seg(f, B.loopA, B.end - 1, easeInOut));
  if (f < B.s[1]) return camRun(B, L, f / B.fps);
  if (f < B.s[2] - 2) return sampleTrack(L.KB, f);
  if (f < B.riseA) return sampleTrack(L.KC, f);
  if (f < B.riseB) {
    const a = L.KC[L.KC.length - 1];
    const m = MAP_P(L);
    const u = seg(f, B.riseA, B.riseB, easeInOut);
    const up = seg(f, B.riseA, B.riseB, (x) => 1 - Math.pow(1 - x, 2.4));
    return { p: [0, lerp(a.p[1], m.p[1], up), lerp(a.p[2], m.p[2], u)], l: [0, lerp(a.l[1], m.l[1], u), lerp(a.l[2], m.l[2], u)], fov: 50 };
  }
  return MAP_P(L);
};

const CameraRig: React.FC<{ c: Shot }> = ({ c }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(...c.p);
  camera.up.set(0, 1, 0);
  camera.lookAt(...c.l);
  if (camera.fov !== c.fov || camera.near !== 0.1 || camera.far !== 3000) {
    camera.fov = c.fov;
    camera.near = 0.1;
    camera.far = 3000;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  return null;
};

/** Screen position (px) of a world point for a camera, + px per world unit at that depth. */
const projector = () => {
  const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.1, 3000);
  return (c: Shot, w: V3) => {
    cam.fov = c.fov;
    cam.position.set(...c.p);
    cam.up.set(0, 1, 0);
    cam.lookAt(...c.l);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const v = new THREE.Vector3(...w).project(cam);
    const depth = new THREE.Vector3(...w).applyMatrix4(cam.matrixWorldInverse).z * -1;
    return { x: ((v.x + 1) / 2) * 1080, y: ((1 - v.y) / 2) * 1920, behind: depth <= 0.2, ppu: 960 / (Math.max(0.2, depth) * Math.tan((c.fov * Math.PI) / 360)) };
  };
};
type Proj = ReturnType<typeof projector>;

// ---------------------------------------------------------------- the opening's offers (static in the world)
type Fly = { kind: number; pos: V3; seed: number; s: number };
const makeFlies = (L: Lay): Fly[] => {
  const out: Fly[] = [];
  let i = 0;
  for (let z = 22; z > L.zG + 24; z -= 1.55) {
    const a = hash(i * 7.31) * Math.PI * 2;
    const r = 1.9 + hash(i * 3.17) * 2.5;
    out.push({ kind: Math.floor(hash(i * 1.93) * 5), pos: [Math.cos(a) * r, Math.max(0.45, CAM_Y + Math.sin(a) * r * 0.75), z - hash(i * 5.3) * 0.8], seed: i * 1.7, s: 0.9 + hash(i * 9.1) * 0.4 });
    i++;
  }
  return out;
};

/** the things that were flying with us: they overtake the braking camera and hit the gate, bounce, pile up */
const CRASH_N = 18;
const crasherAt = (i: number, f: number, B: TBeats, L: Lay) => {
  const fps = B.fps;
  const tau = (f - B.w.down) / fps;
  if (tau < 0) return null;
  const zb = -distAt(L.tb, L.tb);
  const side = i % 2 ? 1 : -1;
  const x0 = side * (1.45 + hash(i * 3.1) * 2.0);
  const y0 = 0.8 + hash(i * 5.7) * 3.0;
  const z0 = zb + 1 + i * 0.75;
  const zh = L.zG + 0.8;
  const th = (z0 - zh) / V1;
  let x = x0, y = y0, z = z0 - V1 * tau, spin = tau * 3 + i;
  if (tau >= th) {
    const dt = tau - th;
    const vy = 1.5 + hash(i * 2.3) * 2.2;
    const vz = 2.2 + hash(i * 4.4) * 2.4;
    const g = 20;
    const yr = 0.32 + (hash(i * 9.1) < 0.4 ? 0.5 : 0);
    const T1 = (vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, y0 - yr))) / g;
    x = x0 * (1 - 0.3 * Math.min(1, dt / T1));
    if (dt < T1) {
      y = y0 + vy * dt - (g / 2) * dt * dt;
      z = zh + vz * dt;
      spin = th * 3 + i + dt * 9;
    } else {
      const e = Math.min(dt - T1, 0.3);
      y = yr + 0.3 * Math.sin((Math.PI * e) / 0.3);
      z = zh + vz * T1 + 0.9 * e;
      spin = th * 3 + i + (T1 + e) * 9;
    }
  }
  // the shatter blows the pile away
  const blow = seg(f, B.w.tam + 3, B.w.tam + 20, easeOut);
  if (blow >= 1) return null;
  const n = Math.hypot(x, 1) || 1;
  return { pos: [x + (x / n) * 9 * blow, y + 3 * Math.sin(Math.PI * blow), z + 4 * blow] as V3, spin, s: 1 - blow, kind: i % 5 };
};

const SHARDS = frontCells();
const SHARD_START = gateCells(SHARDS.cells.length);

// ---------------------------------------------------------------- people
const SKIN = ["#EDBE97", "#C98E66", "#F1C9A6", "#B07A55"];
const look = (i: number, shirt: string): BlockyColors => ({ skin: SKIN[i % 4], shirt, pants: "#1E2230", shoes: "#F2F2F2", hair: ["#2A1E18", "#4A3222", "#1A1412", "#3B2A20"][i % 4], face: PAL.ink });
const ready = (f: number, seed: number): BlockyPose => {
  const p = alive(restPose(), f, seed, 0.6);
  const b = Math.sin(f * 0.22 + seed);
  p.legL = { hip: -0.32, sz: 0.12, knee: 0.55 };
  p.legR = { hip: -0.32, sz: 0.12, knee: 0.55 };
  p.bob = -0.1 + 0.025 * b;
  p.lean = 0.16;
  p.armR = { sx: -0.85, sz: 0.25, twist: 0, elbow: -0.9 };
  p.armL = { sx: -0.5, sz: 0.12, twist: 0, elbow: -1.2 };
  p.mouth = "smile";
  return p;
};
const sadPose = (f: number): BlockyPose => {
  const p = alive(restPose(), f, 5, 0.5);
  p.headPitch = 0.35;
  p.hunch = 0.6;
  p.shrug = 0.2;
  p.brow = 1;
  p.mouth = "flat";
  p.eyeOpen *= 0.8;
  return p;
};

const SportsPeople: React.FC<{ f: number; B: TBeats; L: Lay }> = ({ f, B, L }) => {
  const nodes: React.ReactNode[] = [];
  const { Zp, Zpd } = L;
  // the pitch: three players + the empty lime spot; the kick on «كورة»
  const PP: { pos: V3; rot: number; shirt: string }[] = [
    { pos: [-1.9, 0, Zp + 2.8], rot: Math.PI, shirt: "#E8473C" },
    { pos: [1.7, 0, Zp - 1.2], rot: Math.PI * 0.85, shirt: "#E8473C" },
    { pos: [-1.0, 0, Zp - 3.8], rot: 0.2, shirt: "#3F7FE0" },
  ];
  const k = B.w.ball;
  PP.forEach((pl, i) => {
    let p = ready(f, 3 + i * 2);
    if (i === 0) {
      const sw = seg(f, k - 8, k - 1, easeIn) * (1 - seg(f, k + 2, k + 12));
      p.legR = { hip: lerp(-0.3, -1.3, sw) + 0.6 * seg(f, k - 14, k - 8) * (1 - sw), sz: 0.05, knee: 0.4 * (1 - sw) };
      p.lean = 0.1 - 0.2 * sw;
      p.armL = { sx: -0.9 * sw, sz: 0.7 * sw + 0.1, twist: 0, elbow: -0.3 };
    }
    nodes.push(<Blocky key={`pp${i}`} pose={p} colors={look(i, pl.shirt)} position={pl.pos} rotationY={pl.rot} scale={0.9} />);
  });
  const ku = seg(f, k - 1, k + 16, easeOut);
  const bx = lerp(-1.75, 0.6, ku);
  const bz = lerp(Zp + 1.9, Zp - PITCH.l / 2 + 0.4, ku);
  const by = 0.3 + 0.9 * Math.sin(Math.PI * ku);
  nodes.push(<ModernBall key="ball" position={[bx, by, bz]} spin={ku * 14} s={1.1} />);
  nodes.push(<SpotRing key="spotP" position={[1.9, 0.1, Zp + 3.2]} op={1} pulse={0.5 + 0.5 * Math.sin(f * 0.25)} />);
  // the padel court: three players + the empty spot
  const PD: { pos: V3; rot: number; c: string; r: string }[] = [
    { pos: [-1.9, 0, Zpd + 3.6], rot: Math.PI + 0.25, c: "#F5C542", r: "#3FA7F0" },
    { pos: [-1.8, 0, Zpd - 3.6], rot: 0.15, c: "#2FB38C", r: "#FF5B5B" },
    { pos: [1.8, 0, Zpd - 3.6], rot: -0.15, c: "#8C5CF0", r: "#FFD23F" },
  ];
  PD.forEach((pl, i) => {
    const p = ready(f, 11 + i * 2);
    nodes.push(<Blocky key={`pd${i}`} pose={p} colors={look(i + 1, pl.c)} position={pl.pos} rotationY={pl.rot} scale={0.9} rightHand={<Racket color={pl.r} />} />);
  });
  nodes.push(<SpotRing key="spotD" position={[1.8, 0.1, Zpd + 3.6]} op={1} pulse={0.5 + 0.5 * Math.sin(f * 0.25 + 1)} />);
  // the padel ball flies between the two sides
  const pb = (f * 0.045) % 2;
  const pu = pb < 1 ? pb : 2 - pb;
  nodes.push(<Part key="pball" geo={box(0.16, 0.16, 0.16)} color="#E6FF4A" emissive="#E6FF4A" emissiveIntensity={0.5} position={[lerp(-1.6, 1.4, pu), 1.0 + 1.2 * Math.sin(Math.PI * ((pb % 1))), lerp(Zpd + 3.2, Zpd - 3.2, pu)]} />);
  return <>{nodes}</>;
};

/** the lonely man at the gym door, then friends walk in on «هتلاقي ناس» */
const DoorPeople: React.FC<{ f: number; B: TBeats; L: Lay }> = ({ f, B, L }) => {
  const { Zd } = L;
  const nodes: React.ReactNode[] = [];
  const happy = seg(f, B.w.people + 2, B.w.people + 10);
  let p = sadPose(f);
  if (happy > 0) p = lerpPose(p, wavePose(f, 1), happy);
  const lift = seg(f, B.w.find, B.w.find + 8);
  p.headPitch = lerp(p.headPitch, 0, lift);
  nodes.push(<Blocky key="lone" pose={p} colors={look(0, "#3F7FE0")} position={[0, 0, Zd + 1.6]} rotationY={lerp(0, 0.0, 1)} scale={0.85} />);
  const FR: { from: V3; to: V3; d: number; shirt: string }[] = [
    { from: [-7.5, 0, Zd + 3.6], to: [-1.55, 0, Zd + 1.9], d: 0, shirt: "#E8473C" },
    { from: [7.5, 0, Zd + 3.4], to: [1.55, 0, Zd + 1.9], d: 3, shirt: "#2FB38C" },
    { from: [6.5, 0, Zd + 8.5], to: [2.7, 0, Zd + 3.0], d: 6, shirt: "#F5C542" },
  ];
  FR.forEach((fr, i) => {
    const a = B.w.find - 6 + fr.d;
    const b = B.w.people + 10 + fr.d;
    const u = seg(f, a, b, (x) => x);
    const pos: V3 = [lerp(fr.from[0], fr.to[0], easeOut(u)), 0, lerp(fr.from[2], fr.to[2], easeOut(u))];
    const head = Math.atan2(fr.to[0] - fr.from[0], fr.to[2] - fr.from[2]);
    const walking = u > 0 && u < 1;
    let q = walking ? walkPose(f * 0.5 + i, 1) : u >= 1 ? lerpPose(walkPose(f * 0.5 + i, 1), wavePose(f, i + 2), seg(f, b, b + 6)) : restPose();
    if (u >= 1) q = alive(q, f, i + 4, 0.6);
    nodes.push(<Blocky key={`fr${i}`} pose={q} colors={look(i + 1, fr.shirt)} position={pos} rotationY={u < 1 ? head : lerp(head, 0, seg(f, b, b + 8))} scale={0.85} />);
  });
  return <>{nodes}</>;
};

/** a venue gate across the lime track (sign colour, an icon), its doors swing in */
const VenueGate: React.FC<{ z: number; open: number; sign: string; icon: "gym" | "acad" }> = ({ z, open, sign, icon }) => {
  const W = 6.4;
  const H = 5.0;
  return (
    <group position={[0, 0, z]}>
      {[-1, 1].map((k) => (
        <React.Fragment key={k}>
          <Part geo={box(0.45, H, 0.5)} color="#1E2A20" position={[k * (W / 2 + 0.22), H / 2, 0]} shadow={false} />
          <group position={[k * (W / 2), 0, 0]} rotation={[0, k * -1.45 * open, 0]}>
            <Part geo={box(W / 2 - 0.05, H - 0.2, 0.1)} color="#9FD0FF" opacity={0.35} emissive={sign} emissiveIntensity={0.2} position={[-k * (W / 4), H / 2, 0]} shadow={false} />
            <Part geo={box(0.06, H - 0.2, 0.12)} color={sign} emissive={sign} emissiveIntensity={1} position={[-k * (W / 2 - 0.05), H / 2, 0]} shadow={false} />
          </group>
        </React.Fragment>
      ))}
      <Part geo={box(W + 1.4, 1.5, 0.5)} color={sign} emissive={sign} emissiveIntensity={0.7} position={[0, H + 0.75, 0]} shadow={false} />
      {icon === "gym" ? (
        <GlowDumbbell color={TPAL.ink} glow={0} position={[-1.8, H + 0.75, 0.35]} s={0.8} />
      ) : (
        <ModernBall position={[-2.0, H + 0.75, 0.35]} s={1.6} />
      )}
    </group>
  );
};

// ---------------------------------------------------------------- the 3D world
const World: React.FC<{ B: TBeats; L: Lay; f: number; c: Shot; flies: Fly[] }> = ({ B, L, f, c, flies }) => {
  const { zG } = L;
  const w = B.w;
  const fps = B.fps;
  const loop = f >= B.loopA;
  const ft = loop ? f - B.end : f; // the opening's own clock (the loop flies back into frame 0)
  const t = ft / fps;
  const lime = !loop && f >= w.tam - 2;
  const limeK = loop ? 0 : seg(f, w.tam - 2, w.tam + 14);
  const bg = mixC(TPAL.warmBg, TPAL.limeBg, limeK);
  const fog = mixC(TPAL.warmFog, TPAL.limeFog, limeK);
  const camZ = c.p[2];
  const near = (z: number, ahead = 80, behind = 6) => z < camZ + behind && z > camZ - ahead;
  const nodes: React.ReactNode[] = [];
  const warmSets = loop || f < w.tam + 24;
  const opening = loop || f < B.s[1];

  // ---- the warm world: ground, the opening track, its offers and gates
  if (warmSets) {
    nodes.push(<Part key="gW" geo={box(400, 0.1, 400)} color="#1A0D0A" position={[0, -0.12, zG + 60]} shadow={false} />);
    nodes.push(<TrackFloor key="tf1" z0={40} z1={zG + 3} color={TPAL.floor} edge={TPAL.rib} dash="#FFB27A" />);
  }
  if (opening) {
    for (let z = 36, i = 0; z > zG + 24; z -= 7, i++) if (near(z)) nodes.push(<Rib key={`r1${i}`} z={z} color={i % 3 === 0 ? TPAL.amber : TPAL.rib} dark={TPAL.ribDark} />);
    flies.forEach((fl, i) => {
      if (!near(fl.pos[2], 70, 3)) return;
      nodes.push(<FlyItem key={`fl${i}`} kind={fl.kind} position={fl.pos} t={t} seed={fl.seed} s={fl.s} tag={i % 3 === 2 ? TPAL.amber : TPAL.red} tagInk={i % 3 === 2 ? TPAL.ink : undefined} />);
    });
    // light streaks high on the sides (they sweep like a light motion blur)
    for (let i = 0; i < 46; i++) {
      const z = 30 - i * ((30 - zG - 24) / 46);
      if (!near(z, 60, 4)) continue;
      const side = i % 2 ? 1 : -1;
      nodes.push(<Part key={`st${i}`} geo={box(0.035, 0.035, 3.2)} color={i % 3 ? TPAL.rib : TPAL.amber} basic position={[side * (2.7 + hash(i * 1.3) * 1.6), 3.2 + hash(i * 2.9) * 2.4, z]} shadow={false} />);
    }
    L.gates.forEach((gz, i) => {
      if (!near(gz, 80, 4)) return;
      const dz = camZ - gz;
      nodes.push(<DiscountGate key={`dg${i}`} z={gz} open={easeInOut(clamp((15 - dz) / 10))} color={i % 2 ? TPAL.rib : TPAL.red} />);
    });
    // «100»: a burst of «%» tags just ahead
    const bt = (ft - w.hundred) / fps;
    if (bt >= 0 && bt < 1.1) {
      const bz = -distAt(w.hundred / fps, L.tb) - 10;
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + hash(i) * 0.3;
        const r = 0.3 + (4 + hash(i * 3.3) * 2.5) * easeOut(clamp(bt / 0.5));
        const pop = clamp(springAt(bt * fps, 0, 0.6, 4), 0, 1.25);
        nodes.push(<PercentTag key={`bu${i}`} position={[Math.cos(a) * r, 2.3 + Math.sin(a) * r * 0.85, bz + (hash(i * 7.7) - 0.5) * 4]} s={1.1 * pop} spin={bt * 9 + i} color={i % 2 ? TPAL.red : TPAL.amber} ink={i % 2 ? "#FFFFFF" : TPAL.ink} glow={0.8} />);
      }
    }
  }

  // ---- the locked gate, the crash pile, the shops and the dark venues
  if (!loop && f < w.tam + 3) {
    const sway = Math.sin(f * 0.07) + 1.6 * Math.exp(-Math.max(0, f - w.gym1) / 14) * Math.sin(Math.max(0, f - w.gym1) * 0.5);
    nodes.push(
      <group key="gate" position={[0, 0, zG]}>
        <GymGate f={f} lime={seg(f, w.tam - 4, w.tam + 2)} sway={sway} />
      </group>,
    );
  }
  if (!loop && f >= w.down && f < w.tam + 20) {
    for (let i = 0; i < CRASH_N; i++) {
      const cr = crasherAt(i, f, B, L);
      if (!cr || cr.s <= 0.01) continue;
      nodes.push(
        <group key={`cr${i}`} position={cr.pos} scale={cr.s * 1.15} rotation={[cr.spin * 0.7, cr.spin, cr.spin * 0.4]}>
          <Item kind={cr.kind} />
        </group>,
      );
    }
  }
  if (!loop && f >= w.waff - 8 && f < B.riseA) {
    const pop = (at: number) => clamp(springAt(f, at - 3, 0.5, 4.5), 0, 1.2);
    const SH: { x: number; at: number; color: string; sign: string; awning: string; icon: number }[] = [
      { x: 6.4, at: w.waff, color: "#4A2A20", sign: TPAL.rib, awning: "#D9332A", icon: 0 },
      { x: 9.8, at: w.rest, color: "#3E2A22", sign: TPAL.amber, awning: "#8A4F2A", icon: 1 },
      { x: 13.2, at: w.outings, color: "#46222A", sign: TPAL.red, awning: "#2A2E66", icon: 3 },
    ];
    SH.forEach((s, i) => {
      const p = pop(s.at);
      if (p <= 0.001) return;
      nodes.push(
        <group key={`sh${i}`} position={[s.x, 0, zG]} scale={[1, p, 1]}>
          <ShopFront w={3} h={4.2} color={s.color} sign={s.sign} lit={1} awning={s.awning}>
            <group position={[0, 5.0, -1.2]} scale={1.8} rotation={[0, Math.sin(f * 0.05 + i) * 0.4, 0]}>
              <Item kind={s.icon} />
            </group>
          </ShopFront>
        </group>,
      );
      nodes.push(<PopTag key={`sht${i}`} position={[s.x + 0.9, 6.3, zG + 0.4]} pop={pop(s.at + 4)} spin={f * 0.12 + i} color={i === 1 ? TPAL.amber : TPAL.red} ink={i === 1 ? TPAL.ink : "#FFFFFF"} s={1.5} />);
    });
    // the dark, locked venues
    const dg = pop(w.gyms);
    if (dg > 0.001)
      nodes.push(
        <group key="dgym" position={[-6.4, 0, zG]} scale={[1, dg, 1]}>
          <ShopFront w={3} h={4.4} color="#565862" sign="#6A6D76" lit={0}>
            <Padlock position={[0, 1.5, 0.2]} s={1.1} swing={0.15 * Math.sin(f * 0.1)} color="#8A8E99" />
            <GlowDumbbell color="#55585F" glow={0} position={[0, 5.0, -1.2]} s={1.1} />
          </ShopFront>
        </group>,
      );
    const dc = pop(w.courts);
    if (dc > 0.001)
      nodes.push(
        <group key="dcourt" position={[-9.8, 0, zG]} scale={[1, dc, 1]}>
          <LockedCourt w={3} f={f} />
        </group>,
      );
    const da = pop(w.acads);
    if (da > 0.001)
      nodes.push(
        <group key="dacad" position={[-13.2, 0, zG]} scale={[1, da, 1]}>
          <ShopFront w={3} h={5.4} color="#4C4E58" sign="#62656E" lit={0}>
            <Padlock position={[0, 1.5, 0.2]} s={1.1} swing={0.15 * Math.sin(f * 0.09 + 1)} color="#8A8E99" />
            <ModernBall position={[0, 6.1, -1.2]} s={1.8} />
          </ShopFront>
        </group>,
      );
  }

  // ---- the shatter: lime shards fly out and build the lit gym front
  if (!loop && f >= w.tam + 3 && f < w.tam + 50) {
    const tau = f - (w.tam + 3);
    SHARDS.cells.forEach((tg, i) => {
      const s0 = SHARD_START[i];
      const h1 = hash(i * 1.71);
      const h2 = hash(i * 2.93);
      const h3 = hash(i * 4.37);
      const d: V3 = [s0[0] * 0.9 + (h1 - 0.5) * 2.5, (s0[1] - 3.2) * 0.7 + h2 * 1.8, 0.4 + h3 * 0.8];
      const ex = easeOut(clamp(tau / 12)) * 2.4;
      const E: V3 = [s0[0] + d[0] * ex, s0[1] + d[1] * ex, s0[2] + d[2] * ex];
      const g = seg(tau, 11 + h1 * 6, 32 + h2 * 4, easeInOut);
      const pos: V3 = [lerp(E[0], tg[0], g), lerp(E[1], tg[1], g) + Math.sin(Math.PI * g) * 1.2, lerp(E[2], tg[2], g) + zG];
      const spin = (1 - g) * (tau * (0.25 + h3 * 0.3) + h1 * 6);
      const fade = 1 - seg(f, w.tam + 40, w.tam + 47);
      if (fade <= 0.01) return;
      const sx = lerp(0.62, SHARDS.cw, g);
      const sy = lerp(0.55, SHARDS.ch, g);
      nodes.push(<Part key={`sd${i}`} geo={box(1, 1, 0.3)} color={TPAL.lime} emissive={TPAL.lime} emissiveIntensity={lerp(1.1, 0.5, g)} position={pos} rotation={[spin, spin * 1.3, spin * 0.6]} scale={[sx * fade, sy * fade, 1]} shadow={false} />);
    });
  }
  if (lime && f < w.lazy) {
    const op = seg(f, w.tam + 34, w.tam + 44);
    if (op > 0)
      nodes.push(
        <group key="front" position={[0, 0, zG]}>
          <GymFront op={op} glow={1} door={seg(f, B.s[3] - 4, B.s[3] + 12)} />
        </group>,
      );
  }

  // ---- the lime world: ground, track, venue gates, courts, venues
  if (lime && f >= w.tam + 6) {
    nodes.push(<Part key="gL" geo={box(300, 0.1, 400)} color="#17291D" position={[0, -0.12, zG - 120]} shadow={false} />);
    nodes.push(<TrackFloor key="tf2" z0={zG - 0.2} z1={L.ZC + 12} color={TPAL.limeFloor} edge={TPAL.lime} dash="#B8E04A" />);
    for (let z = zG - 5, i = 0; z > L.ZC + 12; z -= 7, i++) if (near(z, 90)) nodes.push(<Rib key={`r2${i}`} z={z} color={i % 3 === 0 ? "#3FD0C0" : TPAL.lime} dark="#1E2A20" glow={0.9} />);
    for (let i = 0; i < 30; i++) {
      const z = zG - 6 - i * ((zG - 6 - L.ZC - 12) / 30);
      if (!near(z, 60, 4)) continue;
      const side = i % 2 ? 1 : -1;
      nodes.push(<Part key={`st2${i}`} geo={box(0.035, 0.035, 3.2)} color={i % 3 ? TPAL.lime : "#3FD0C0"} basic position={[side * (2.7 + hash(i * 1.9) * 1.6), 3.2 + hash(i * 3.1) * 2.4, z]} shadow={false} />);
    }
    const tagPop = (k: number) => clamp(springAt(f, w.offers - 2 + k * 4, 0.5, 4.5), 0, 1.25);
    if (near(L.GZ1, 90, 8)) nodes.push(<VenueGate key="vg1" z={L.GZ1} open={seg(f, w.gyms5 - 4, w.gyms5 + 8)} sign={TPAL.lime} icon="gym" />);
    if (near(L.GZ2, 90, 8)) nodes.push(<VenueGate key="vg2" z={L.GZ2} open={seg(f, w.acad5 - 4, w.acad5 + 8)} sign="#4FB3F0" icon="acad" />);
    // the courts rise from the ground on «وملاعب»
    const rise = clamp(springAt(f, w.courts5 - 4, 0.45, 5), 0, 1.15);
    if (rise > 0.001) {
      nodes.push(
        <group key="cp" position={[-5.2, -3.2 * (1 - rise), L.ZC]}>
          <PadelCourt lit={1} />
        </group>,
      );
      nodes.push(
        <group key="cf" position={[5.2, -3.2 * (1 - rise), L.ZC]}>
          <Pitch lit={1} />
          <SmallGoal position={[0, 0, -PITCH.l / 2 + 0.2]} />
          <SmallGoal position={[0, 0, PITCH.l / 2 - 0.2]} rotationY={Math.PI} />
        </group>,
      );
      nodes.push(<PopTag key="tc1" position={[-5.2, 4.2, L.ZC + 4]} pop={tagPop(0)} spin={f * 0.1} s={1.9} />);
      nodes.push(<PopTag key="tc2" position={[5.2, 4.2, L.ZC + 4]} pop={tagPop(1)} spin={f * 0.1 + 1} s={1.9} />);
    }
    const VN: { sign: string; name: string; h: number }[] = [
      { sign: TPAL.lime, name: "gym", h: 5.2 },
      { sign: "#4FB3F0", name: "acad", h: 6.0 },
      { sign: "#3FD0C0", name: "studio", h: 4.6 },
      { sign: TPAL.lime, name: "gym2", h: 5.0 },
    ];
    L.ZV.forEach((z, i) => {
      if (!near(z, 90, 10)) return;
      const side = i % 2 ? 1 : -1;
      const v = VN[i];
      nodes.push(
        <group key={`vn${i}`} position={[side * 5.6, 0, z]} rotation={[0, -side * Math.PI / 2, 0]}>
          <Building w={4.6} d={5} h={v.h} color="#3E4A56" lit={1} sign={v.sign} accent={v.sign} floors={2} door={0.4} />
        </group>,
      );
      nodes.push(<PopTag key={`vt${i}`} position={[side * 3.3, v.h - 0.4, z + 1]} pop={tagPop(i + 2)} spin={f * 0.1 + i} s={2.6} />);
    });
  }

  // ---- the sports area + the gym door
  if (lime && f >= w.offers && !loop) {
    nodes.push(
      <group key="pitch" position={[0, 0, L.Zp]}>
        <Pitch lit={1} />
        <SmallGoal position={[0, 0, -PITCH.l / 2 + 0.2]} />
        <SmallGoal position={[0, 0, PITCH.l / 2 - 0.2]} rotationY={Math.PI} />
      </group>,
    );
    nodes.push(
      <group key="padel" position={[0, 0, L.Zpd]}>
        <PadelCourt lit={1} />
      </group>,
    );
    nodes.push(
      <group key="door" position={[0, 0, L.Zd]}>
        <Building w={6} d={6} h={5} color="#2E3640" lit={1} sign={TPAL.lime} accent={TPAL.lime} floors={2} door={seg(f, w.people + 12, w.people + 26)} />
      </group>,
    );
    if (f >= B.s[4] - 60) nodes.push(<SportsPeople key="sp" f={f} B={B} L={L} />);
    if (f >= w.lazy - 30) nodes.push(<DoorPeople key="dp" f={f} B={B} L={L} />);
  }
  void COURT;

  return (
    <>
      <CameraRig c={c} />
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[fog, 26 + Math.max(0, c.p[1] - 8), 82 + 1.6 * Math.max(0, c.p[1] - 8)]} />
      <hemisphereLight args={[lime ? "#9FB8A0" : "#C89A86", lime ? "#14201A" : "#2A1410", 1.25]} />
      <directionalLight position={[-6, 18, 10]} intensity={0.75} color={lime ? "#E8FFD0" : "#FFD8B8"} />
      <pointLight position={[c.p[0], c.p[1] + 1.2, c.p[2] - 1]} intensity={9} distance={20} decay={1.2} color={lime ? "#E8FFC8" : "#FFC79A"} />
      <pointLight position={[0, 6, zG + 4]} intensity={(lime ? 30 : 18) * (f < B.riseA ? 1 : 0)} distance={18} decay={1.2} color={lime ? TPAL.lime : "#FF8A4A"} />
      <pointLight position={[-9.8, 7, zG + 6]} intensity={!loop && f >= w.gyms - 6 && f < w.tam ? 40 : 0} distance={20} decay={1.2} color="#A8B8FF" />
      {nodes}
    </>
  );
};

// ---------------------------------------------------------------- 2D layers
const AR = "Cairo";
const LIME = TPAL.lime;
const TEXT_MAX_Y = 1000; // the captions sit around y 1170: no film text below this

/** a DOM label riding a world point (sign names); hidden when it would sit in the caption band */
const Label: React.FC<{ c: Shot; proj: Proj; at: V3; text: string; size: number; color: string; op?: number; shadow?: string; weight?: number }> = ({ c, proj, at, text, size, color, op = 1, shadow, weight = 800 }) => {
  if (op <= 0.01) return null;
  const a = proj(c, at);
  const fs = size * a.ppu;
  if (a.behind || fs < 10 || a.y > TEXT_MAX_Y || a.x < -300 || a.x > 1380) return null;
  return (
    <div dir="rtl" style={{ position: "absolute", left: a.x - 600, top: a.y - fs * 0.62, width: 1200, textAlign: "center", fontFamily: AR, fontWeight: weight, fontSize: fs, lineHeight: 1.2, color, opacity: op, textShadow: shadow, whiteSpace: "nowrap" }}>
      {text}
    </div>
  );
};

/** the red «دفع كامل» card hanging on the locked gate */
const PayCard: React.FC<{ f: number; B: TBeats; L: Lay; c: Shot; proj: Proj }> = ({ f, B, L, c, proj }) => {
  const w = B.w;
  const a0 = w.gym1 + 3;
  if (f < a0 || f >= w.tam + 10 || f >= B.loopA) return null;
  const a = proj(c, [0, 3.65, L.zG + 0.55]);
  if (a.behind) return null;
  const W = 1.9 * a.ppu;
  if (W < 20) return null;
  const drop = seg(f, a0, a0 + 7, easeIn);
  const k = f - (a0 + 7);
  const k2 = f - w.pay;
  const swing = (k > 0 ? 9 * Math.exp(-k / 14) * Math.sin(k * 0.35) : 0) + (k2 > 0 ? 5 * Math.exp(-k2 / 12) * Math.sin(k2 * 0.4) : 0) + 1.5 * Math.sin(f * 0.06);
  const pulse = 1 + 0.035 * Math.sin(f * 0.13);
  const off = seg(f, w.tam - 1, w.tam + 9, easeIn);
  const H = W * 0.48;
  return (
    <div style={{ position: "absolute", left: a.x - W / 2, top: a.y - H / 2 - lerp(700, 0, drop) - 400 * off, width: W, height: H, transform: `rotate(${swing + 30 * off}deg) scale(${pulse * (1 + 0.3 * off)})`, transformOrigin: "50% -40%", opacity: 1 - off }}>
      {/* two strings up to the chain */}
      {[-1, 1].map((s) => (
        <div key={s} style={{ position: "absolute", left: W / 2 + s * W * 0.22 - 2, top: -H * 0.42, width: 4, height: H * 0.45, background: "#C9CED6", transform: `rotate(${-s * 18}deg)`, transformOrigin: "50% 100%" }} />
      ))}
      <div dir="rtl" style={{ position: "absolute", inset: 0, background: "#E1251B", borderRadius: H * 0.16, border: `${Math.max(3, W * 0.012)}px solid #FFFFFF`, boxShadow: `0 ${H * 0.08}px ${H * 0.25}px rgba(0,0,0,0.55), 0 0 ${H * 0.3}px rgba(255,60,40,0.55)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontFamily: AR, fontWeight: 900, fontSize: H * 0.5, lineHeight: 1 }}>
        دفع كامل
      </div>
    </div>
  );
};

/** the big «؟» that rises above the dark venues on «حصة ببلاش» */
const BigQuestion: React.FC<{ f: number; B: TBeats; L: Lay; c: Shot; proj: Proj }> = ({ f, B, L, c, proj }) => {
  const w = B.w;
  if (f < w.free - 3 || f > B.s[2] + 4) return null;
  const up = seg(f, w.free - 3, w.free + 12, easeOut);
  const op = up * (1 - seg(f, B.s[2] - 24, B.s[2] - 6));
  const a = proj(c, [-9.8, lerp(5.6, 7.6, up), L.zG]);
  if (a.behind) return null;
  const fs = 3.6 * a.ppu * clamp(springAt(f, w.free - 3, 0.5, 5), 0, 1.2);
  return (
    <div style={{ position: "absolute", left: a.x - fs, top: a.y - fs * 0.6, width: fs * 2, textAlign: "center", fontFamily: AR, fontWeight: 900, fontSize: fs, lineHeight: 1.2, color: "#FFB23F", opacity: op, textShadow: `0 0 ${fs * 0.15}px rgba(255,140,40,0.8), 0 ${fs * 0.04}px ${fs * 0.08}px rgba(0,0,0,0.8)`, transform: `rotate(${6 * Math.sin(f * 0.08)}deg)` }}>
      ؟
    </div>
  );
};

/** the lime wave on «تمرينة» */
const LimeWave: React.FC<{ f: number; B: TBeats }> = ({ f, B }) => {
  const a = B.w.tam - 4;
  if (f < a || f > a + 22) return null;
  const u = seg(f, a, a + 18, easeOut);
  const flash = Math.exp(-Math.abs(f - (a + 6)) / 3) * 0.45;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 42%, rgba(214,255,60,${flash}), rgba(214,255,60,${flash * 0.3}) 60%, rgba(214,255,60,0) 85%)` }} />
      <div style={{ position: "absolute", left: 540 - 1500 * u, top: 800 - 1500 * u, width: 3000 * u, height: 3000 * u, borderRadius: "50%", border: `${lerp(60, 10, u)}px solid rgba(214,255,60,${0.85 * (1 - u)})`, boxShadow: `0 0 80px rgba(214,255,60,${0.6 * (1 - u)})` }} />
    </AbsoluteFill>
  );
};

/** a paper coupon flies at the camera, gets a ✕, tears in two */
const Coupon: React.FC<{ f: number; B: TBeats }> = ({ f, B }) => {
  const k = B.w.coupon;
  const a = k - 14;
  const b = k + 34;
  if (f < a || f > b) return null;
  const inU = seg(f, a, k, easeOut);
  const sc = lerp(0.25, 1.1, inU);
  const y = lerp(520, 640, inU);
  const xo = clamp(springAt(f, k + 1, 0.55, 4), 0, 1.2);
  const tear = seg(f, k + 14, b, easeIn);
  const rot = -10 + 8 * Math.sin((f - a) * 0.15);
  const W = 520;
  const H = 250;
  const half = (side: -1 | 1) => (
    <div key={side} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, clipPath: side < 0 ? `polygon(0 0, 52% 0, 46% 30%, 54% 55%, 47% 80%, 52% 100%, 0 100%)` : `polygon(52% 0, 100% 0, 100% 100%, 52% 100%, 47% 80%, 54% 55%, 46% 30%)`, transform: `translate(${side * 420 * tear}px, ${900 * tear * tear}px) rotate(${side * 35 * tear}deg)` }}>
      <div dir="rtl" style={{ position: "absolute", inset: 0, background: "#FFF1D2", borderRadius: 18, border: "6px dashed #C98A3A", display: "flex", alignItems: "center", justifyContent: "center", gap: 24, fontFamily: AR, fontWeight: 900, color: "#B4501E" }}>
        <span style={{ fontSize: 96 }}>%</span>
        <span style={{ fontSize: 76 }}>كوبون</span>
      </div>
      {xo > 0 &&
        [45, -45].map((r) => (
          <div key={r} style={{ position: "absolute", left: W / 2 - 190, top: H / 2 - 20, width: 380, height: 40, borderRadius: 20, background: "#FF3B3B", transform: `rotate(${r}deg) scale(${xo})`, boxShadow: "0 4px 10px rgba(0,0,0,0.35)" }} />
        ))}
    </div>
  );
  return (
    <div style={{ position: "absolute", left: 540 - W / 2, top: y - H / 2, width: W, height: H, transform: `rotate(${rot}deg) scale(${sc})`, filter: "drop-shadow(0 18px 30px rgba(0,0,0,0.5))", opacity: clamp(inU * 3) }}>
      {half(-1)}
      {half(1)}
    </div>
  );
};

const Signs: React.FC<{ f: number; B: TBeats; L: Lay; c: Shot; proj: Proj }> = ({ f, B, L, c, proj }) => {
  const w = B.w;
  const { zG } = L;
  const loop = f >= B.loopA;
  const out: React.ReactNode[] = [];
  const glowW = "0 0 18px rgba(255,140,40,0.7), 0 3px 8px rgba(0,0,0,0.8)";
  const glowL = "0 0 18px rgba(214,255,60,0.6), 0 3px 8px rgba(0,0,0,0.8)";
  if (!loop && f < w.tam + 1) out.push(<Label key="gate" c={c} proj={proj} at={[1.05, GATE.signY, zG + 0.32]} text="جيم" size={1.05} color="#FFB23F" shadow={glowW} op={1 - seg(f, w.tam - 3, w.tam + 1)} />);
  if (!loop && f >= w.waff && f < B.s[2] + 10) {
    const show = (at: number) => seg(f, at + 2, at + 8);
    [["مطعم", 6.4, w.waff], ["كافيه", 9.8, w.rest], ["سينما", 13.2, w.outings]].forEach(([t, x, at]) =>
      out.push(<Label key={`s${t}`} c={c} proj={proj} at={[x as number, 2.62, zG + 0.2]} text={t as string} size={0.42} color={TPAL.ink} op={show(at as number)} />),
    );
    [["جيم", -6.4, w.gyms, 2.62], ["ملعب", -9.8, w.courts, 3.75], ["أكاديمية", -13.2, w.acads, 2.62]].forEach(([t, x, at, y]) =>
      out.push(<Label key={`d${t}`} c={c} proj={proj} at={[x as number, y as number, zG + 0.2]} text={t as string} size={0.42} color="#9A9EA8" op={show(at as number)} shadow="0 2px 6px rgba(0,0,0,0.9)" />),
    );
  }
  if (!loop && f >= w.tam + 40 && f < B.s[3] + 30) out.push(<Label key="front" c={c} proj={proj} at={[1.05, 5.55, zG + 0.4]} text="جيم" size={1.0} color={TPAL.ink} />);
  if (!loop && f >= w.gyms5 - 30 && f < w.courts5 + 10) {
    out.push(<Label key="vg1" c={c} proj={proj} at={[0.9, 5.75, L.GZ1 + 0.3]} text="جيم" size={0.95} color={TPAL.ink} />);
    out.push(<Label key="vg2" c={c} proj={proj} at={[0.7, 5.75, L.GZ2 + 0.3]} text="أكاديمية" size={0.85} color={TPAL.ink} />);
  }
  if (!loop && f >= w.lazy - 30 && f < B.riseA + 20) out.push(<Label key="door" c={c} proj={proj} at={[0, 2.62, L.Zd + 0.2]} text="جيم" size={0.45} color={TPAL.ink} op={1 - seg(f, B.riseA, B.riseA + 20)} />);
  void glowL;
  return <>{out}</>;
};

const DebugOverlay: React.FC<{ info: string }> = ({ info }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 20, top: 20, right: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "22px monospace", padding: 8, whiteSpace: "pre-wrap" }}>{info}</div>
    <div style={{ position: "absolute", left: 0, top: 1100, width: 1080, height: 150, background: "rgba(0,170,255,0.12)", borderTop: "3px dashed #00aaff", borderBottom: "3px dashed #00aaff" }} />
    <div style={{ position: "absolute", left: 0, top: TEXT_MAX_Y, width: 1080, height: 0, borderTop: "3px dashed #ff00aa" }} />
  </AbsoluteFill>
);

export const FactTunnel: React.FC<FactTunnelProps> = ({ starts = TUNNEL_STARTS, words = TUNNEL_WORDS, durationSec = TUNNEL_DURATION, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const B = useMemo(() => makeTunnelBeats(starts, words, fps, durationSec), [starts, words, fps, durationSec]);
  const L = useMemo(() => layout(B), [B]);
  const flies = useMemo(() => makeFlies(L), [L]);
  const proj = useMemo(() => projector(), []);
  const frame = useCurrentFrame();
  const c = camAt(B, L, frame);
  const mapShow = seg(frame, B.riseA + 3, B.riseA + 14, easeInOut) * (1 - seg(frame, B.loopA, B.loopA + 9, easeIn));
  return (
    <AbsoluteFill style={{ backgroundColor: TPAL.warmBg }}>
      {mapShow < 0.999 && (
        <ThreeCanvas width={width} height={height} flat camera={{ fov: 60, near: 0.1, far: 3000, position: [0, 2, 10] }} gl={{ antialias: true }}>
          <World B={B} L={L} f={frame} c={c} flies={flies} />
        </ThreeCanvas>
      )}
      <Signs f={frame} B={B} L={L} c={c} proj={proj} />
      <PayCard f={frame} B={B} L={L} c={c} proj={proj} />
      <BigQuestion f={frame} B={B} L={L} c={c} proj={proj} />
      <LimeWave f={frame} B={B} />
      <Coupon f={frame} B={B} />
      {/* the map sits higher than in waffarha-story (its south names stay above the caption row at y 1170) and pushes in
          slowly the whole time it is on screen, so the ending is never a still picture */}
      {mapShow > 0.001 && <AbsoluteFill style={{ opacity: mapShow, background: "radial-gradient(75% 75% at 50% 40%, #1A2130 0%, #0B0E15 100%)" }} />}
      <AbsoluteFill style={{ transformOrigin: "540px 680px", transform: `translateY(-230px) scale(${0.82 + 0.08 * seg(frame, B.riseA + 3, B.loopA, easeInOut)})` }}>
        <CairoMap f={frame} show={mapShow} obourAt={B.w.obour} marksAt={B.w.now} markStep={10} noBg />
      </AbsoluteFill>
      {debug && <DebugOverlay info={`f${frame} ${(frame / fps).toFixed(2)}s  p ${c.p.map((v) => v.toFixed(1)).join(",")} l ${c.l.map((v) => v.toFixed(1)).join(",")} fov ${c.fov.toFixed(0)}\nzG ${L.zG.toFixed(1)} ZC ${L.ZC.toFixed(1)} Zp ${L.Zp.toFixed(1)} Zd ${L.Zd.toFixed(1)}`} />}
    </AbsoluteFill>
  );
};
