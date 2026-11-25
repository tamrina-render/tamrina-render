import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { Part, box, cyl, rbox, sphere } from "./fact3d/parts";
import { clamp, easeIn, easeInOut, easeOut, hash, lerp, seg, springAt } from "./fact3d/anim";
import { alive, flexPose, lerpPose, wavePose } from "./fact3d/acting";
import { Crowd, CrowdItem, MiniLook, MiniPose, PuffRing, miniRest, miniRun } from "./fact3d/mob";
import { Dumbbell, SkyDome, Cloud } from "./fact3d/props";
import { Building } from "./fact3d/waffarha";
import { Shot, ShotRig, mixShot, orbit, whipBlur, whipPan } from "./fact3d/cameraMoves";
import { BET_DURATION, BET_STARTS, BET_WORDS, BetBeats, BetWords, makeBetBeats } from "./fact3d/betTiming";
import { loadFonts } from "../lib/fonts";

loadFonts();

// «اتنين صحاب راهنوا بعض على نص مرتبهم…» (videos/bet-salary, v2 after the owner found v1 boring): ONE bright toy world,
// ONE camera, no cuts, something new every ~1-2 s, close on the people.
//  1 frame 0: gold coins rain onto the table while the two chubby friends slap hands on the bet (Mr. Coin watches from
//    the front, drawn by the reel on top; the camera stays still for lines 1-2); «نص» = the pile splits into two rings
//    over their heads «½ المرتب»; «يخسّوا» = the red one reaches for a cake, his own coins snatch it away (the laugh)
//  2 «والنتيجة؟» both hold their breath; «خسّوا» = pop thin with a puff, flex, ✓ ✓, the coins drop back to them
//  3 the camera rises and circles (orbit): the company slams down behind them, goal flags rain down all around, counter
//  4 the grey track, runners coming AT the camera: one by one they sit, lie down, quit; three break the tape, «29%»
//  5 a 180° whip pan to the gold track: coins on their backs, eight break the tape, confetti, «80%», a shake
//  6 on to the gym (camera still from here: Mr. Coin walks in on top): people walk in, a coin pile is swept off, a
//    dumbbell drops; the partner waves, a lime line to the coin, it snaps on «خلعت», the warning card (app wording);
//    «تمرينة» = the logo, the line joins again, the partner waves him in, the door opens.

export type FactBetProps = { starts?: number[]; words?: Partial<BetWords>; durationSec?: number; debug?: boolean };
type V3 = [number, number, number];

const LIME = "#D6FF3C";
const INK = "#0E0F12";
const GOLD = "#F2B632";
const GOLD_D = "#C98A1E";
const AR = "Cairo";
const TEXT_MAX_Y = 1000;

// ---------------------------------------------------------------- places
const FRIEND_X = 0.95;
const GOALS_C: V3 = [0, 0, -4];
const TRACK_Z = -30;
const RUN_FROM = 23;
const FIN_X = 6.5;
const NEAR_X = 5.4;
const GYM: V3 = [0, 0, -58];

// ---------------------------------------------------------------- camera
const A0: Shot = { p: [0, 2.7, 7.4], l: [0, 2.05, 0], fov: 40 };
const A1: Shot = { p: [0, 2.7, 7.1], l: [0, 2.05, 0], fov: 40 };
const ORB = { target: [0, 0.6, -4] as V3, radius: 19, height: 11, fov: 50 };
const GREY0: Shot = { p: [0, 3.0, TRACK_Z + 4.2], l: [-11, 0.7, TRACK_Z], fov: 52 };
const GREY1: Shot = { p: [-0.6, 2.9, TRACK_Z + 4.0], l: [-11, 0.7, TRACK_Z - 0.2], fov: 50 };
const GOLD_S: Shot = { p: [0.2, 3.0, TRACK_Z + 4.2], l: [11, 0.7, TRACK_Z - 0.4], fov: 50 };
const GYMSHOT: Shot = { p: [GYM[0], 2.7, GYM[2] + 14.5], l: [GYM[0], 2.0, GYM[2]], fov: 46 };

const camAt = (B: BetBeats, f: number): { c: Shot; blur: number } => {
  const w = B.w;
  if (f < B.s[2]) return { c: mixShot(A0, A1, seg(f, 0, B.s[2], (x) => x)), blur: 0 };
  const r1 = w.company - 10;
  const o1 = B.s[3] - 26;
  const orb = (ff: number) => orbit((ff - r1) / (o1 - r1), { ...ORB, fromDeg: 0, toDeg: 40 });
  if (f < r1) return { c: mixShot(A1, orb(r1), seg(f, B.s[2], r1, easeInOut)), blur: 0 };
  if (f < o1) return { c: orb(f), blur: 0 };
  const d1 = B.s[3] + 16;
  if (f < d1) {
    // fly OVER the company building (it stands between the orbit and the track)
    const u = seg(f, o1, d1, easeInOut);
    const m = mixShot(orb(o1), GREY0, u);
    return { c: { ...m, p: [m.p[0], m.p[1] + 9 * Math.sin(Math.PI * u), m.p[2]] }, blur: 0 };
  }
  const wA = w.has - 12;
  const wB = w.has + 10;
  if (f < wA) return { c: mixShot(GREY0, GREY1, seg(f, d1, wA, easeInOut)), blur: 0 };
  if (f < wB) {
    const t = (f - wA) / (wB - wA);
    return { c: whipPan(t, { from: GREY1, to: GOLD_S, mid: 0.5, turn: 0.6 }), blur: whipBlur(t, 0.5, 0.6) };
  }
  const g0 = w.n80 + 20;
  const g1 = B.s[5] - 6;
  let c: Shot = f < g0 ? GOLD_S : mixShot(GOLD_S, GYMSHOT, seg(f, g0, g1, easeInOut));
  const k = f - w.n80;
  if (k >= 0 && k < 14) {
    const a = 0.08 * Math.exp(-k / 4);
    c = { ...c, p: [c.p[0], c.p[1] + a * Math.cos(k * 2.7), c.p[2] + a * Math.sin(k * 2.1)] };
  }
  return { c, blur: 0 };
};

// ---------------------------------------------------------------- light
const SunRig: React.FC<{ target: V3 }> = ({ target }) => {
  const { light, tgt } = useMemo(() => {
    const l = new THREE.DirectionalLight();
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.02;
    const t = new THREE.Object3D();
    l.target = t;
    const cam = l.shadow.camera;
    cam.left = -26; cam.right = 26; cam.top = 26; cam.bottom = -26; cam.near = 1; cam.far = 160;
    cam.updateProjectionMatrix();
    return { light: l, tgt: t };
  }, []);
  const snap = (v: number) => Math.round(v / 0.5) * 0.5;
  const tp: V3 = [snap(target[0]), 0, snap(target[2])];
  tgt.position.set(...tp);
  light.position.set(tp[0] - 14, 26, tp[2] + 18);
  light.intensity = 2.3;
  light.color.set("#FFF3DE");
  return (
    <>
      <primitive object={tgt} />
      <primitive object={light} />
    </>
  );
};

// ---------------------------------------------------------------- the two friends, the coins, the cake
const FRIENDS: { x: number; rot: number; colors: BlockyColors }[] = [
  { x: -FRIEND_X, rot: Math.PI / 2 - 0.75, colors: { skin: "#E8B48C", shirt: "#E2574C", pants: "#3C4A66", shoes: "#2B2B30", hair: "#2C211D", face: "#2A1E1A" } },
  { x: FRIEND_X, rot: -Math.PI / 2 + 0.75, colors: { skin: "#C98A63", shirt: "#3F8FD6", pants: "#4A4038", shoes: "#2B2B30", hair: "#3B2A20", face: "#2A1E1A" } },
];

const fatAt = (f: number, B: BetBeats) => {
  const suck = 0.12 * seg(f, B.s[1] + 4, B.s[1] + 12) * (1 - seg(f, B.w.lost - 3, B.w.lost));
  return (1 - clamp(springAt(f, B.w.lost, 0.5, 4), 0, 1.15)) * (1 - suck);
};

const friendPose = (f: number, B: BetBeats, i: number): BlockyPose => {
  const w = B.w;
  const base = restPose();
  const slap = Math.max(0, Math.sin(f * 0.32));
  const shake: BlockyPose = { ...base, armR: { sx: -1.0 - 0.5 * slap, sz: -0.15, twist: 0, elbow: -0.25 - 0.3 * slap }, lean: 0.14, mouth: "grin", brow: -0.4 };
  const look: BlockyPose = { ...base, headPitch: -0.3, eyeY: 0.7, mouth: "o", mouthOpen: 0.5, browUp: 0.7 };
  let p = shake;
  p = lerpPose(p, look, seg(f, 40, 56));
  if (i === 0) {
    const reach: BlockyPose = { ...base, armR: { sx: -1.1, sz: 0.3, twist: 0, elbow: -0.3 }, lean: 0.25, headPitch: 0.25, mouth: "grin", eyeY: -0.5 };
    const robbed: BlockyPose = { ...base, armR: { sx: -1.6, sz: 0.2, twist: 0, elbow: -0.2 }, headPitch: -0.35, eyeY: 0.8, mouth: "o", mouthOpen: 1, eyeWide: 1.35, browUp: 1 };
    p = lerpPose(p, reach, seg(f, w.lose1 - 14, w.lose1 - 2));
    p = lerpPose(p, robbed, seg(f, w.lose1 + 6, w.lose1 + 12));
  } else {
    const laugh: BlockyPose = { ...base, armL: { sx: -0.6, sz: 0.3, twist: 0.4, elbow: -1.2 }, armR: { sx: -0.6, sz: 0.3, twist: 0.4, elbow: -1.2 }, headPitch: -0.2 + 0.08 * Math.sin(f * 0.9), mouth: "grin", eyeOpen: 0.25, roll: 0.05 * Math.sin(f * 0.9) };
    p = lerpPose(p, laugh, seg(f, w.lose1 + 10, w.lose1 + 18));
  }
  const hold: BlockyPose = { ...base, shrug: 0.5, eyeOpen: 0.1, mouth: "flat", brow: 0.6, squash: 1.03 };
  p = lerpPose(p, hold, seg(f, B.s[1], B.s[1] + 10));
  const pump = 0.5 + 0.5 * Math.sin((f - w.lost) * 0.35);
  p = lerpPose(p, flexPose(pump), seg(f, w.lost - 2, w.lost + 6, easeOut));
  p = lerpPose(p, { ...wavePose(f, i * 3), armR: { sx: -0.1, sz: 2.35, twist: 1.57, elbow: -0.5 + 0.3 * Math.sin(f * 0.4) } }, seg(f, B.s[2] + 10, B.s[2] + 22));
  return alive(p, f, i * 7.3);
};

const Belly: React.FC<{ fat: number; color: string }> = ({ fat, color }) =>
  fat > 0.01 ? <Part geo={sphere(0.44, 20)} color={color} position={[0, 0.25, 0.12 + 0.12 * fat]} scale={[fat * 1.05, fat * 0.95, fat]} /> : null;

const Coin: React.FC<{ position: V3; rot?: V3; s?: number }> = ({ position, rot = [0, 0, 0], s = 1 }) => (
  <group position={position} rotation={rot} scale={s}>
    <Part geo={cyl(0.17, 0.17, 0.05, 20)} color={GOLD} rough={0.35} emissive={GOLD} emissiveIntensity={0.18} />
    <Part geo={cyl(0.12, 0.12, 0.055, 20)} color={GOLD_D} rough={0.4} />
  </group>
);

const CAKE0: V3 = [-0.05, 1.06, 0.36];
const cakeAt = (f: number, B: BetBeats): V3 => {
  const a = B.w.lose1 + 2;
  const u = seg(f, a, a + 20, easeIn);
  return [lerp(CAKE0[0], -3.2, u), CAKE0[1] + 4 * u * u + 0.4 * Math.sin(u * Math.PI), CAKE0[2] + 0.4 * u];
};

const Cake: React.FC<{ f: number; B: BetBeats }> = ({ f, B }) => {
  if (f > B.w.lose1 + 24) return null;
  const p = cakeAt(f, B);
  const wob = f > B.w.lose1 ? 0.25 * Math.sin(f * 0.8) : 0;
  return (
    <group position={p} rotation={[wob, f * 0.04, wob * 0.6]} scale={1.45}>
      <Part geo={cyl(0.22, 0.22, 0.04, 24)} color="#FFFFFF" position={[0, 0.02, 0]} />
      <Part geo={cyl(0.17, 0.18, 0.16, 24)} color="#8A4B2E" position={[0, 0.12, 0]} />
      <Part geo={cyl(0.175, 0.175, 0.05, 24)} color="#F7C6D0" position={[0, 0.22, 0]} />
      <Part geo={sphere(0.04, 12)} color="#E01E3C" position={[0, 0.28, 0]} />
    </group>
  );
};

const TableCoins: React.FC<{ f: number; B: BetBeats }> = ({ f, B }) => {
  const w = B.w;
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const k = Math.floor(i / 2);
    const pile: V3 = [(hash(i) - 0.5) * 0.4, 1.08 + k * 0.045, (hash(i + 9) - 0.5) * 0.3];
    const land = -6 + i * 1.6;
    const fall = seg(f, land - 10, land, easeIn);
    let p: V3 = [pile[0], lerp(pile[1] + 2.6, pile[1], fall), pile[2]];
    const ang = (k / 8) * Math.PI * 2 + f * 0.035 * side;
    const over: V3 = [side * FRIEND_X * 0.98 + 0.4 * Math.cos(ang), 3.3 + 0.38 * Math.sin(ang) + 0.05 * Math.sin(f * 0.12 + i), 0.1];
    const a = w.half + (k % 4);
    const u = seg(f, a, a + 18, easeInOut);
    const arc = Math.sin(Math.PI * u) * 0.8;
    p = [lerp(p[0], over[0], u), lerp(p[1], over[1], u) + arc, lerp(p[2], over[2], u)];
    if (side < 0 && k < 3) {
      const dive = seg(f, w.lose1 - 4, w.lose1 + 2, easeIn) * (1 - seg(f, w.lose1 + 24, w.lose1 + 40, easeInOut));
      const c = cakeAt(Math.min(f, w.lose1 + 24), B);
      const tgt: V3 = [c[0] + 0.25 * Math.cos(k * 2.1), c[1] + 0.35, c[2] + 0.25 * Math.sin(k * 2.1)];
      p = [lerp(p[0], tgt[0], dive), lerp(p[1], tgt[1], dive), lerp(p[2], tgt[2], dive)];
    }
    const d = seg(f, w.lost + 4 + k, w.lost + 16 + k, easeIn);
    p = [p[0], lerp(p[1], 1.4, d), p[2]];
    const s = 1 - d;
    if (s < 0.02) continue;
    const spin = (u > 0 && u < 1) || fall < 1 ? f * 0.4 + i : 0;
    nodes.push(<Coin key={i} position={p} rot={[u * Math.PI * 0.5 + spin, f * 0.05 * u, 0]} s={s} />);
  }
  return <>{nodes}</>;
};

const Table: React.FC = () => (
  <group>
    <Part geo={rbox(1.5, 0.12, 1.0, 0.04)} color="#C98F57" position={[0, 1.0, 0]} />
    {[[-0.62, -0.38], [0.62, -0.38], [-0.62, 0.38], [0.62, 0.38]].map(([x, z], i) => (
      <Part key={i} geo={box(0.1, 0.95, 0.1)} color="#8A6A4E" position={[x, 0.48, z]} />
    ))}
  </group>
);

// ---------------------------------------------------------------- the goals: flags that rain down around the table
const N_GOALS = 900;
const GoalsField: React.FC<{ f: number; B: BetBeats }> = ({ f, B }) => {
  const built = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.36, 0.04), new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.7 }), N_GOALS);
    const pole = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: "#6B6F78" }), N_GOALS);
    m.frustumCulled = false;
    pole.frustumCulled = false;
    const cols = ["#E2574C", "#3F8FD6", "#F2B632", "#2F8C86", "#D6FF3C", "#F07E86", "#8E6AD8"];
    const c = new THREE.Color();
    const data = Array.from({ length: N_GOALS }, (_, i) => {
      const a = hash(i * 1.37) * Math.PI * 2;
      const r = 3.0 + Math.sqrt(hash(i * 2.91)) * 12;
      m.setColorAt(i, c.set(cols[i % cols.length]));
      return { x: GOALS_C[0] + Math.cos(a) * r, z: GOALS_C[2] + Math.sin(a) * r, rot: hash(i * 5.1) * Math.PI };
    });
    return { m, pole, data };
  }, []);
  const a = B.w.analysed;
  const b = B.w.thousand;
  const o = new THREE.Object3D();
  built.data.forEach((d, i) => {
    const at = lerp(a - 4, b - 8, hash(i * 3.3));
    const fall = seg(f, at, at + 9, easeIn);
    const bounce = f > at + 9 ? 0.25 * Math.abs(Math.sin((f - at - 9) * 0.5)) * Math.exp(-(f - at - 9) / 4) : 0;
    const vis = f >= at;
    const y = lerp(14, 0, fall) + bounce;
    const tilt = (1 - fall) * 2.5 * (hash(i) - 0.5);
    o.rotation.set(tilt, d.rot + (1 - fall) * 4, 0);
    o.scale.setScalar(vis ? 1 : 0.0001);
    o.position.set(d.x, y + 0.82, d.z);
    o.updateMatrix();
    built.m.setMatrixAt(i, o.matrix);
    o.position.set(d.x - 0.23 * Math.cos(d.rot), y + 0.35, d.z + 0.23 * Math.sin(d.rot));
    o.updateMatrix();
    built.pole.setMatrixAt(i, o.matrix);
  });
  built.m.instanceMatrix.needsUpdate = true;
  built.pole.instanceMatrix.needsUpdate = true;
  if (built.m.instanceColor) built.m.instanceColor.needsUpdate = true;
  return (
    <>
      <primitive object={built.m} />
      <primitive object={built.pole} />
    </>
  );
};

// ---------------------------------------------------------------- the two tracks (runners come AT the camera)
const GREY_LOOK = (i: number): MiniLook => ({ skin: ["#D9B49A", "#C9A58C", "#BFA08A"][i % 3], tunic: ["#9A9EA6", "#8D9199", "#A7AAB0"][i % 3], legs: "#6E7178", hair: "#4A4448", shoes: "#3A3A3E" });
const GOLD_LOOK = (i: number): MiniLook => ({ skin: ["#EDBE97", "#D9A27A", "#C98A63", "#F1C9A6"][i % 4], tunic: ["#E2574C", "#3F8FD6", "#2F8C86", "#8E6AD8", "#E07A52"][i % 5], legs: "#2E3A55", hair: "#2C211D", shoes: "#F4F5F7" });
const WIN_L = [1, 4, 7];
const FAIL_R = [3, 8];

/** how a quitter gives up: 0 sits, 1 lies flat, 2 hands on knees, 3 sits and waves "bye" */
const quitPose = (kind: number, u: number, f: number, i: number): MiniPose => {
  const r = miniRest();
  if (kind === 1) return { ...r, tumbleX: -1.45 * u, lift: -0.55 * u, armL: -2.8 * u, armR: -2.8 * u, eye: lerp(1, 0.2, u) };
  if (kind === 2) return { ...r, lean: 0.75 * u, armL: -0.5 * u, armR: -0.5 * u, bob: -0.12 * u + 0.03 * Math.sin(f * 0.6 + i), mouth: 0.9, headPitch: -0.3 * u };
  const sit: MiniPose = { ...r, hipL: -1.45 * u, hipR: -1.35 * u, bob: -0.48 * u, lean: -0.15 * u, armL: -0.3 * u, armR: -0.2 * u, headPitch: 0.35 * u, mouth: 0.3 * u, eye: lerp(1, 0.4, u) };
  if (kind === 3) return { ...sit, armR: -2.6 * u + 0.35 * Math.sin(f * 0.5), outR: 0.5 * u, headPitch: 0 };
  return sit;
};

const runner = (f: number, i: number, sign: number, go: number, cross: number, win: boolean, quitX: number) => {
  const lane = (i % 2 ? 0.6 : -0.6) + (hash(i * 4.4) - 0.5) * 0.25;
  const row = Math.floor(i / 2);
  const x0 = RUN_FROM + row * 1.1;
  const speed = (x0 - FIN_X) / Math.max(1, cross - go + row * 3);
  const phase = (f - go) * 0.6 + i;
  const z = TRACK_Z + lane;
  const rot = sign < 0 ? Math.PI / 2 : -Math.PI / 2;
  const stopX = NEAR_X + (i % 3) * 0.5;
  const tStop = win ? Infinity : go + (x0 - quitX) / speed;
  const t = Math.max(0, Math.min(f, tStop) - go);
  let ax = x0 - speed * t;
  if (win) ax = Math.max(ax, stopX);
  const pos: V3 = [sign * ax, 0, z];
  if (!win && f >= tStop) return { pos, rot, pose: quitPose(i % 4, seg(f, tStop, tStop + 9, easeOut), f, i) };
  if (win && ax <= stopX + 0.01) return { pos, rot, pose: { ...miniRest(), armL: -2.6 + 0.3 * Math.sin(f * 0.5 + i), armR: -2.6 - 0.3 * Math.sin(f * 0.5 + i), outL: 0.4, outR: 0.4, lift: 0.2 * Math.abs(Math.sin(f * 0.3 + i)), mouth: 1 } };
  return { pos, rot, pose: miniRun(phase, 0.85) };
};

const Track: React.FC<{ sign: number; gold: boolean; f: number; tapeAt: number }> = ({ sign, gold, f, tapeAt }) => {
  const len = RUN_FROM + 8;
  const cx = sign * (len / 2 + 1);
  const brk = seg(f, tapeAt, tapeAt + 10, easeOut);
  return (
    <group>
      <Part geo={box(len, 0.04, 3.2)} color={gold ? "#C8574A" : "#9C9EA3"} position={[cx, 0.02, TRACK_Z]} />
      {[-1.6, 0, 1.6].map((lz) => (
        <Part key={lz} geo={box(len, 0.05, 0.06)} color="#FFFFFF" position={[cx, 0.04, TRACK_Z + lz]} shadow={false} />
      ))}
      {[-1.8, 1.8].map((pz) => (
        <Part key={pz} geo={box(0.16, 1.4, 0.16)} color="#F4F5F7" position={[sign * FIN_X, 0.7, TRACK_Z + pz]} />
      ))}
      {[-1, 1].map((k) => (
        <group key={k} position={[sign * FIN_X, 1.15, TRACK_Z + k * 1.8]} rotation={[k * 1.35 * brk, 0, 0]}>
          <Part geo={box(0.04, 0.1, 1.8)} color={gold ? LIME : "#E8E8EA"} emissive={gold ? LIME : "#000000"} emissiveIntensity={gold ? 0.3 : 0} position={[0, 0, -k * 0.9]} shadow={false} />
        </group>
      ))}
    </group>
  );
};

const Runners: React.FC<{ f: number; B: BetBeats }> = ({ f, B }) => {
  const w = B.w;
  const items: CrowdItem[] = [];
  const coins: React.ReactNode[] = [];
  let q = 0;
  for (let i = 0; i < 10; i++) {
    const win = WIN_L.includes(i);
    const r = runner(f, i, -1, B.s[3] - 20, w.n29 - 2, win, win ? 0 : 7.5 + 1.2 * (6 - q++));
    items.push({ pos: r.pos, rot: r.rot, pose: r.pose, look: GREY_LOOK(i), scale: 0.95 });
  }
  for (let i = 0; i < 10; i++) {
    const win = !FAIL_R.includes(i);
    const r = runner(f, i, 1, w.has - 50, w.n80 - 2, win, 19);
    items.push({ pos: r.pos, rot: r.rot, pose: r.pose, look: GOLD_LOOK(i), scale: 0.95 });
    coins.push(<Coin key={i} position={[r.pos[0] + 0.32, 1.05 + r.pose.bob * 0.95, r.pos[2]]} rot={[0, 0, Math.PI / 2]} s={1.5} />);
  }
  return (
    <>
      <Crowd items={items} cap={24} />
      {coins}
    </>
  );
};

// ---------------------------------------------------------------- the gym set
const PARTNER: BlockyColors = { skin: "#D9A27A", shirt: "#4FB3F0", pants: "#2E3A55", shoes: "#F4F5F7", hair: "#2C211D", face: "#2A1E1A" };
const PARTNER_AT: V3 = [GYM[0] - 1.7, 0, GYM[2] + 1.4];

const partnerPose = (f: number, B: BetBeats): BlockyPose => {
  const w = B.w;
  const base = restPose();
  let p = lerpPose(base, wavePose(f, 3), seg(f, w.partner - 4, w.partner + 4) * (1 - seg(f, w.waiting + 6, w.waiting + 12)));
  const watch: BlockyPose = { ...base, armL: { sx: -1.25, sz: 0.2, twist: 0.9, elbow: -1.7 }, headPitch: 0.3, headYaw: 0.35, eyeX: 0.6, eyeY: -0.4, legR: { hip: -0.08 * Math.max(0, Math.sin(f * 0.5)), sz: 0.05, knee: 0.1 }, mouth: "flat" };
  p = lerpPose(p, watch, seg(f, w.waiting + 6, w.waiting + 14));
  const annoyed: BlockyPose = { ...base, armL: { sx: 0.1, sz: 0.7, twist: 1.3, elbow: -1.6 }, armR: { sx: 0.1, sz: 0.7, twist: 1.3, elbow: -1.6 }, brow: -0.7, mouth: "flat", headTilt: 0.15 };
  p = lerpPose(p, annoyed, seg(f, w.skip, w.skip + 8));
  p = lerpPose(p, { ...wavePose(f, 5), mouth: "grin" }, seg(f, w.tamrina + 2, w.tamrina + 10));
  return alive(p, f, 11);
};

/** people walk into the gym door, one every ~2 s (the gym is alive) */
const Walkers: React.FC<{ f: number; B: BetBeats }> = ({ f, B }) => {
  const items: CrowdItem[] = [];
  const t0 = B.s[5] - 40;
  const door: V3 = [GYM[0], 0, GYM[2] + 0.4];
  for (let k = 0; k < 7; k++) {
    const a = t0 + k * 58;
    const u = (f - a) / 100;
    if (u < 0 || u > 1) continue;
    const side = k % 2 ? 1 : -1;
    const x = lerp(side * 6.5, door[0], u);
    const z = lerp(GYM[2] + 4.5, door[2], u * u);
    const dx = door[0] - x;
    const dzz = door[2] - z;
    items.push({ pos: [x, 0, z], rot: Math.atan2(dx, dzz), pose: { ...miniRun((f - a) * 0.35 + k, 0.35), mouth: 0.2, lean: 0.05 }, look: { ...GOLD_LOOK(k + 3), legs: "#2E3A55" }, scale: 0.9 });
  }
  return <Crowd items={items} cap={4} />;
};

const GymCoins: React.FC<{ f: number; B: BetBeats }> = ({ f, B }) => {
  const a = B.w.bet;
  const u = seg(f, a, a + 14, easeIn);
  if (u >= 1) return null;
  const base: V3 = [GYM[0] - 1.25, 0, GYM[2] + 5.2];
  const nodes: React.ReactNode[] = [<Part key="stool" geo={cyl(0.32, 0.36, 0.6, 16)} color="#8A6A4E" position={[base[0] - u * 6, 0.3, base[2]]} />];
  for (let i = 0; i < 12; i++) {
    const fly = u * (5 + hash(i) * 4);
    nodes.push(<Coin key={i} position={[base[0] - fly + (hash(i + 2) - 0.5) * 0.3, 0.63 + (i % 6) * 0.05 + Math.floor(i / 6) * 0.02 + u * hash(i + 5) * 2, base[2] + (hash(i + 7) - 0.5) * 0.3]} rot={[u * 6 * hash(i), 0, u * 4]} />);
  }
  return <>{nodes}</>;
};

const DropDumbbell: React.FC<{ f: number; B: BetBeats }> = ({ f, B }) => {
  const a = B.w.gym - 8;
  if (f < a) return null;
  const fall = seg(f, a, a + 8, easeIn);
  const bounce = f > a + 8 ? Math.abs(Math.sin((f - a - 8) * 0.5)) * 0.35 * Math.exp(-(f - a - 8) / 5) : 0;
  return <Dumbbell color="#3A3F4A" s={2.6} position={[GYM[0] - 0.75, lerp(7, 0.36, fall) + bounce, GYM[2] + 5.6]} rotation={[0, 0.35, 0]} />;
};

// ---------------------------------------------------------------- the world
const World: React.FC<{ f: number; B: BetBeats; c: Shot }> = ({ f, B, c }) => {
  const w = B.w;
  const fat = fatAt(f, B);
  const showA = f < B.s[3] + 30;
  const showC = f >= B.s[3] - 50 && f < B.s[5] + 10;
  const showD = f >= B.s[4];
  const nodes: React.ReactNode[] = [];
  if (showA) {
    nodes.push(<Table key="table" />);
    FRIENDS.forEach((fr, i) => {
      const sx = lerp(1, 1.18, fat);
      nodes.push(
        <group key={`fr${i}`} position={[fr.x, 0, 0]} rotation={[0, fr.rot, 0]} scale={[sx, 1, sx]}>
          <Blocky pose={friendPose(f, B, i)} colors={fr.colors} chest={<Belly fat={fat} color={fr.colors.shirt} />} />
        </group>,
      );
      nodes.push(<PuffRing key={`pf${i}`} at={[fr.x * 1.25, 1.3, 0.3]} age={f - w.lost} n={7} r={0.7} s={0.45} color="#FFFFFF" life={14} />);
    });
    nodes.push(<Cake key="cake" f={f} B={B} />);
    nodes.push(<TableCoins key="tc" f={f} B={B} />);
    const drop = seg(f, w.company - 8, w.company, easeIn);
    if (f >= w.company - 8) {
      const bob = f > w.company ? 0.3 * Math.abs(Math.sin((f - w.company) * 0.6)) * Math.exp(-(f - w.company) / 4) : 0;
      nodes.push(
        <group key="co" position={[0, lerp(22, 0, drop) + bob, -10]}>
          <Building w={5} d={4} h={7.5} color="#F1E1C2" lit={1} sign="#3F8FD6" accent="#3F8FD6" floors={4} />
        </group>,
      );
      nodes.push(<PuffRing key="cop" at={[0, 0.2, -9]} age={f - w.company} n={10} r={3.2} s={1.6} color="#EDE3D0" life={20} />);
    }
    nodes.push(<GoalsField key="gf" f={f} B={B} />);
  }
  if (showC) {
    nodes.push(<Track key="tl" sign={-1} gold={false} f={f} tapeAt={w.n29 - 3} />);
    nodes.push(<Track key="tr" sign={1} gold f={f} tapeAt={w.n80 - 3} />);
    nodes.push(<Runners key="run" f={f} B={B} />);
  }
  if (showD) {
    nodes.push(
      <group key="gym" position={GYM}>
        <Building w={7} d={5} h={5.2} color="#F4F5F7" lit={1} sign={LIME} accent={LIME} floors={2} door={Math.max(0.35, seg(f, w.come - 4, w.come + 14))} />
      </group>,
    );
    nodes.push(<Blocky key="partner" pose={partnerPose(f, B)} colors={PARTNER} position={PARTNER_AT} rotationY={0.35} />);
    nodes.push(<Walkers key="wk" f={f} B={B} />);
    nodes.push(<GymCoins key="gc" f={f} B={B} />);
    nodes.push(<DropDumbbell key="db" f={f} B={B} />);
    nodes.push(<PuffRing key="dbp" at={[GYM[0] - 0.75, 0.1, GYM[2] + 5.6]} age={f - B.w.gym} n={9} r={1.2} s={1.0} color="#EDE3D0" />);
    [-3.0, 3.0].forEach((x) => nodes.push(<Part key={`pl${x}`} geo={sphere(0.5, 14)} color="#5E9A4A" position={[GYM[0] + x, 0.55, GYM[2] + 0.8]} />));
  }
  return (
    <>
      <ShotRig shot={c} />
      <SkyDome top="#6FBDEB" horizon="#FFF1D8" />
      <fog attach="fog" args={["#F6EBD6", 45, 130]} />
      <hemisphereLight args={["#F2F7FF", "#B8A487", 1.6]} />
      <SunRig target={c.l} />
      <Part geo={box(400, 0.2, 400)} color="#E6D6B6" position={[0, -0.1, 0]} shadow />
      <Cloud position={[-14, 16, -50]} s={2.2} seed={1} />
      <Cloud position={[18, 19, -60]} s={2.6} seed={2} />
      <Cloud position={[-30, 15, -30]} s={2.4} seed={4} />
      <Cloud position={[30, 17, -26]} s={2.4} seed={5} />
      <Cloud position={[2, 22, -80]} s={3} seed={3} />
      {nodes}
    </>
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
    return { x: ((v.x + 1) / 2) * 1080, y: ((1 - v.y) / 2) * 1920, behind: depth <= 0.2, ppu: 960 / (Math.max(0.2, depth) * Math.tan((c.fov * Math.PI) / 360)) };
  };
};
type Proj = ReturnType<typeof projector>;

const glow = (c: string) => `0 0 24px ${c}, 0 4px 10px rgba(0,0,0,0.55)`;

const HeadMarks: React.FC<{ f: number; B: BetBeats; c: Shot; proj: Proj }> = ({ f, B, c, proj }) => {
  const w = B.w;
  if (f > B.s[2] + 10) return null;
  const out: React.ReactNode[] = [];
  FRIENDS.forEach((fr, i) => {
    const a = proj(c, [fr.x, 3.95, 0.1]);
    if (a.behind || a.y > TEXT_MAX_Y) return;
    const half = seg(f, w.half + 10, w.half + 18) * (1 - seg(f, w.lost - 6, w.lost));
    if (half > 0.01)
      out.push(
        <div key={`h${i}`} dir="rtl" style={{ position: "absolute", left: a.x - 200, top: a.y - 50, width: 400, textAlign: "center", fontFamily: AR, fontWeight: 900, fontSize: 56, color: "#FFF6E0", opacity: half, textShadow: glow("rgba(242,182,50,0.9)"), transform: `scale(${0.7 + 0.3 * half})` }}>
          ½ المرتب
        </div>,
      );
    const ck = clamp(springAt(f, w.lost + 2 + i * 3, 0.55, 4), 0, 1.2) * (1 - seg(f, B.s[2] - 4, B.s[2] + 8));
    if (ck > 0.01) {
      const s = 130 * ck;
      out.push(
        <div key={`c${i}`} style={{ position: "absolute", left: a.x - s / 2, top: a.y - s / 2 - 20, width: s, height: s, borderRadius: "50%", background: "#3BC45A", border: `${s * 0.06}px solid #FFFFFF`, boxShadow: "0 6px 18px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontSize: s * 0.62, fontWeight: 900, lineHeight: 1 }}>
          ✓
        </div>,
      );
    }
  });
  return <>{out}</>;
};

const CompanyLabel: React.FC<{ f: number; B: BetBeats; c: Shot; proj: Proj }> = ({ f, B, c, proj }) => {
  const w = B.w;
  const op = seg(f, w.company, w.company + 6) * (1 - seg(f, w.analysed + 14, w.analysed + 24));
  if (op <= 0.01) return null;
  const a = proj(c, [0, 8.4, -10]);
  if (a.behind || a.y > TEXT_MAX_Y) return null;
  return (
    <div style={{ position: "absolute", left: a.x - 300, top: a.y - 70, width: 600, textAlign: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 90, color: "#FFFFFF", opacity: op, textShadow: glow("rgba(63,143,214,0.9)") }}>
      stickK
    </div>
  );
};

const Counter: React.FC<{ f: number; B: BetBeats }> = ({ f, B }) => {
  const w = B.w;
  const a = w.analysed;
  const b = w.thousand;
  if (f < a - 4 || f > B.s[3] + 8) return null;
  const v = Math.round(125000 * seg(f, a, b, (x) => 1 - Math.pow(1 - x, 2.2)));
  const land = clamp(springAt(f, b, 0.6, 4), 0, 1.2);
  const op = seg(f, a - 4, a + 4) * (1 - seg(f, B.s[3] - 6, B.s[3] + 8));
  const sc = 1 + 0.14 * (land > 0 ? Math.sin(Math.min(land, 1) * Math.PI) : 0);
  return (
    <div style={{ position: "absolute", left: 0, top: 290, width: 1080, textAlign: "center", opacity: op }}>
      <div style={{ display: "inline-block", padding: "18px 46px", borderRadius: 34, background: "rgba(14,15,18,0.84)", border: `5px solid ${f >= b ? LIME : "#FFFFFF"}`, boxShadow: "0 14px 40px rgba(0,0,0,0.35)", transform: `scale(${sc})` }}>
        <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 150, lineHeight: 1, color: f >= b ? LIME : "#FFFFFF", fontVariantNumeric: "tabular-nums", letterSpacing: 2 }}>{v.toLocaleString("en-US")}</div>
        <div dir="rtl" style={{ fontFamily: AR, fontWeight: 800, fontSize: 56, color: "#FFFFFF", marginTop: 4 }}>هدف</div>
      </div>
    </div>
  );
};

const Percent: React.FC<{ f: number; at: number; until: number; text: string; color: string; stroke: string; big: number }> = ({ f, at, until, text, color, stroke, big }) => {
  if (f < at - 2 || f > until) return null;
  const s = clamp(springAt(f, at - 2, 0.55, 4), 0, 1.25);
  const op = 1 - seg(f, until - 8, until);
  return (
    <div style={{ position: "absolute", left: 0, top: 250, width: 1080, textAlign: "center", opacity: op, transform: `scale(${s})`, transformOrigin: "540px 420px" }}>
      <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: big, lineHeight: 1, color, WebkitTextStroke: `8px ${stroke}`, paintOrder: "stroke fill", textShadow: "0 12px 30px rgba(0,0,0,0.35)" }}>{text}</span>
    </div>
  );
};

const Confetti: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const k = f - at;
  if (k < 0 || k > 50) return null;
  const cols = [LIME, "#F2B632", "#E2574C", "#3F8FD6", "#FFFFFF", "#F07E86"];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 70 }, (_, i) => {
        const a = (hash(i * 3.1) - 0.5) * Math.PI * 1.4 - Math.PI / 2;
        const v = 28 + hash(i * 7.7) * 30;
        const x = 540 + Math.cos(a) * v * k;
        const y = 900 + Math.sin(a) * v * k + 1.4 * k * k;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 18, height: 30, background: cols[i % cols.length], transform: `rotate(${k * 20 + i * 40}deg)`, opacity: 1 - k / 50, borderRadius: 3 }} />;
      })}
    </AbsoluteFill>
  );
};

const COIN_HEAD = { x: 760, y: 1330 };

const Link: React.FC<{ f: number; B: BetBeats; c: Shot; proj: Proj }> = ({ f, B, c, proj }) => {
  const w = B.w;
  if (f < w.partner || f > B.end) return null;
  const a = proj(c, [PARTNER_AT[0] + 0.25, 2.1, PARTNER_AT[2]]);
  const draw = seg(f, w.partner, w.partner + 14, easeOut);
  const snap = seg(f, w.skip, w.skip + 6, easeOut) * (1 - seg(f, w.tamrina, w.tamrina + 10, easeOut));
  const x1 = a.x;
  const y1 = a.y;
  const x2 = lerp(x1, COIN_HEAD.x, draw);
  const y2 = lerp(y1, COIN_HEAD.y, draw);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - 60;
  const gap = 60 * snap;
  const color = snap > 0.5 ? "#9A9EA8" : LIME;
  const pulse = f >= w.tamrina ? 1 + 0.4 * Math.exp(-(f - w.tamrina) / 8) : 1;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <filter id="lg" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {[0, 1].map((k) => {
        const sx = k === 0 ? x1 : x2;
        const sy = k === 0 ? y1 : y2;
        const ex = mx + (k === 0 ? -gap : gap);
        const ey = my + gap * 0.8;
        const d = `M ${sx} ${sy} Q ${(sx + ex) / 2} ${(sy + ey) / 2 - 30} ${ex} ${ey}`;
        return (
          <g key={k}>
            <path d={d} stroke={color} strokeWidth={14 * pulse} fill="none" opacity={0.5} filter="url(#lg)" />
            <path d={d} stroke={color} strokeWidth={8} strokeLinecap="round" strokeDasharray="18 14" strokeDashoffset={-f * 3} fill="none" />
          </g>
        );
      })}
    </svg>
  );
};

const WarnCard: React.FC<{ f: number; B: BetBeats }> = ({ f, B }) => {
  const w = B.w;
  const a = w.warn - 3;
  if (f < a || f > w.tamrina + 12) return null;
  const s = clamp(springAt(f, a, 0.5, 4), 0, 1.2);
  const out = seg(f, w.tamrina - 2, w.tamrina + 10, easeIn);
  const pulse = 1 + 0.03 * Math.max(0, Math.sin((f - a) * 0.35)) * Math.exp(-(f - a) / 30);
  return (
    <div dir="rtl" style={{ position: "absolute", left: 90, top: 300 - 700 * out, width: 900, transform: `scale(${s * pulse}) rotate(${-2 + 2 * Math.sin(f * 0.05)}deg)`, transformOrigin: "50% 50%", opacity: 1 - out }}>
      <div style={{ background: "#FFFFFF", borderRadius: 40, padding: "30px 38px", boxShadow: "0 22px 50px rgba(0,0,0,0.35)", borderRight: "18px solid #F05A28", display: "flex", gap: 26, alignItems: "center" }}>
        <div style={{ width: 120, height: 120, borderRadius: 30, background: "#FFE6DA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 84, flexShrink: 0 }}>⚠️</div>
        <div style={{ fontFamily: AR }}>
          <div style={{ fontWeight: 900, fontSize: 66, color: "#E1251B", lineHeight: 1.15 }}>إنذار</div>
          <div style={{ fontWeight: 700, fontSize: 40, color: "#33363D", lineHeight: 1.35 }}>التمرينة اللي متروحهاش بتتحسب إنذار</div>
        </div>
      </div>
    </div>
  );
};

const Logo: React.FC<{ f: number; B: BetBeats }> = ({ f, B }) => {
  const a = B.w.tamrina;
  if (f < a - 2) return null;
  const s = clamp(springAt(f, a - 2, 0.5, 5), 0, 1.2);
  const sweep = seg(f, a + 8, a + 30, easeInOut);
  const float = 8 * Math.sin((f - a) * 0.08);
  const src = staticFile("footage/bet-salary/logo.svg");
  return (
    <div style={{ position: "absolute", left: 540 - 230, top: 250 + float, width: 460, height: 420, transform: `scale(${s})`, transformOrigin: "50% 60%" }}>
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

const GymSign: React.FC<{ f: number; B: BetBeats; c: Shot; proj: Proj }> = ({ f, B, c, proj }) => {
  if (f < B.s[5] - 20) return null;
  const a = proj(c, [GYM[0], 2.62, GYM[2] + 0.2]);
  if (a.behind || a.y > TEXT_MAX_Y) return null;
  const fs = 0.5 * a.ppu;
  if (fs < 12) return null;
  return (
    <div dir="rtl" style={{ position: "absolute", left: a.x - 400, top: a.y - fs * 0.62, width: 800, textAlign: "center", fontFamily: AR, fontWeight: 900, fontSize: fs, lineHeight: 1.2, color: INK }}>
      جيم
    </div>
  );
};

const DebugOverlay: React.FC<{ info: string }> = ({ info }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 20, top: 20, right: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "22px monospace", padding: 8, whiteSpace: "pre-wrap" }}>{info}</div>
    <div style={{ position: "absolute", left: 0, top: 1100, width: 1080, height: 150, background: "rgba(0,170,255,0.12)", borderTop: "3px dashed #00aaff", borderBottom: "3px dashed #00aaff" }} />
  </AbsoluteFill>
);

export const FactBet: React.FC<FactBetProps> = ({ starts = BET_STARTS, words = BET_WORDS, durationSec = BET_DURATION, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const B = useMemo(() => makeBetBeats(starts, words, fps, durationSec), [starts, words, fps, durationSec]);
  const proj = useMemo(() => projector(), []);
  const frame = useCurrentFrame();
  const { c, blur } = camAt(B, frame);
  const w = B.w;
  return (
    <AbsoluteFill style={{ backgroundColor: "#F6EBD6" }}>
      <AbsoluteFill style={{ filter: blur > 0.01 ? `blur(${(blur * 3).toFixed(2)}px)` : undefined }}>
        <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 40, near: 0.1, far: 1000, position: [0, 2, 7] }} gl={{ antialias: true }}>
          <World f={frame} B={B} c={c} />
        </ThreeCanvas>
      </AbsoluteFill>
      <HeadMarks f={frame} B={B} c={c} proj={proj} />
      <CompanyLabel f={frame} B={B} c={c} proj={proj} />
      <Counter f={frame} B={B} />
      <Percent f={frame} at={w.n29} until={w.has - 8} text="29%" color="#B9BBC0" stroke="#5E6168" big={260} />
      <Percent f={frame} at={w.n80} until={B.s[5] - 10} text="80%" color={LIME} stroke={INK} big={300} />
      <Confetti f={frame} at={w.n80} />
      <GymSign f={frame} B={B} c={c} proj={proj} />
      <Link f={frame} B={B} c={c} proj={proj} />
      <WarnCard f={frame} B={B} />
      <Logo f={frame} B={B} />
      {debug && <DebugOverlay info={`f${frame} ${(frame / fps).toFixed(2)}s  p ${c.p.map((v) => v.toFixed(1)).join(",")} l ${c.l.map((v) => v.toFixed(1)).join(",")} fov ${c.fov.toFixed(0)}`} />}
    </AbsoluteFill>
  );
};
