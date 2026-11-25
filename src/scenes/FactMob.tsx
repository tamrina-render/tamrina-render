import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { PAL, Part, box, circle, cyl, rbox, sphere, torusArc } from "./fact3d/parts";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, hash, lerp, seg, springAt, wobble } from "./fact3d/anim";
import { alive, lerpPose, runnerPose } from "./fact3d/acting";
import { GradientSky, Moon } from "./fact3d/titanic";
import {
  BALCONY_Y,
  Beard,
  BladderBall,
  Belt,
  Cap,
  Castle,
  Cottage,
  Crowd,
  CrowdItem,
  Crown,
  DustCloud,
  Fields,
  Floodlight,
  Haystack,
  Key,
  MPAL,
  MillGoal,
  MiniPose,
  ModernBall,
  PineTree,
  Pig,
  Puff,
  PuffRing,
  RoundTree,
  Scroll,
  SmallGoal,
  Sheep,
  prismGeo,
  SunDisc,
  V3,
  VegCart,
  Watch,
  Windmill,
  lookFor,
  miniFlail,
  miniRest,
  miniRun,
  sampleTrack,
} from "./fact3d/mob";
import { MBeats, MOB_DURATION, MOB_POST_IMGS, MOB_STARTS, MOB_WORDS, MobWords, makeMobBeats } from "./fact3d/mobTiming";
import { loadFonts } from "../lib/fonts";

loadFonts();

// Mob football (medieval England) -> a modern five-a-side booking. ONE continuous camera journey, no cuts:
//  1 a tidy 11-a-side pitch, a village mob pours in, the lines get trampled · 2 up: two villages emptying toward the middle
//  3 low and fast along the road to the far goal (distance counter to "5 كم") · 4 time-lapse: sun down, moon over, sun up
//  5 dive into the scrum pile · 6 the pig's-bladder ball pops out (slow), a pig watches · 7 down the village street, over a cart, into the trees
//  8 the blank rules scroll + its one red cross · 9 the king on the balcony, everyone freezes, the ball deflates, "1314"
//  10 the castle sinks, a floodlit five-a-side pitch rises; the camera is locked from here on (open turf lower right for the mascot)
//  11 three players wait · 12 the real app post card · 13 four more jog in, the card counts up to 5/5.

export type FactMobProps = {
  starts?: number[];
  words?: Partial<MobWords>;
  durationSec?: number;
  /** five app post screenshots (paths under public/), shown from beat 12; swaps 2..5 on each arrival */
  postImgs?: string[];
  /** the four arrival times (seconds) in beat 13; default: even steps from starts[12] */
  joins?: number[];
  debug?: boolean;
};

// ---------------------------------------------------------------- the map (world units; Blocky at scale 1 is ~2.65 tall)
const VL: [number, number] = [-22, -4]; // red village (left of the pitch, its lane opens toward the pitch)
const VR: [number, number] = [22, -4]; // blue village (right)
const G: V3 = [0, 0, -150]; // the far goal (mill gate)
const O: V3 = [0, 0, -138]; // the field in front of it: the chase, the scrum, the pig
const CART_X = 17;
const K: V3 = [46, 0, -138]; // the forest clearing: scroll, castle in front, later the modern pitch
const CASTLE: V3 = [K[0], 0, K[2] - 13];
const BALL_R = 0.55;
const REST: V3 = [K[0] + 2.2, BALL_R, K[2] - 1.8];
// the scrum (beats 5-6): in the field by the village street, away from the goal; the pig beside it, toward the camera
const PILE: V3 = [O[0] + 3, 0, O[2] + 1.5];
const PIG: V3 = [PILE[0] - 2.0, 0, PILE[2] - 2.4];
const RISE: V3 = [PILE[0] - 2.6, 3.0, PILE[2] - 0.6]; // where the ball hangs in beat 6
const BAL: [number, number] = [K[0] + 1.4, K[2] - 13 + 2.2]; // the ball lands on the balcony (beat 9)
// final, locked camera (a person standing on the pitch) and the row of modern players
const FIN: V3 = [K[0] + 0.5, 3.2, K[2] + 12];
const FINL: V3 = [K[0] + 0.5, 0.66, K[2] - 5];
// the centre spot sits under the mascot's feet (screen ~x 770, y 1780)
const CS: [number, number] = [K[0] + 1.2, K[2] + 6.5];
const ROW_Z = K[2] - 5;
const ROW_X = [-3, -2, -1, 0, 1, 2, 3].map((x) => FIN[0] + x);
// the three who wait stand with gaps between them; the four who join fill the gaps
const SLOT = [0, 2, 4, 1, 3, 5, 6];

const SKIN = ["#EDBE97", "#D9A27A", "#C98A63", "#F1C9A6", "#B9805B"];

// ---------------------------------------------------------------- small helpers
const popIn = (f: number, t0: number) => (f < t0 ? 0 : clamp(springAt(f, t0, 0.55, 3.2), 0, 1.25));
const popOut = (f: number, t0: number, dur = 9) => {
  if (f < t0) return 1;
  const t = (f - t0) / dur;
  if (t >= 1) return 0;
  return t < 0.3 ? 1 + 0.12 * Math.sin((t / 0.3) * Math.PI * 0.5) : 1.12 * (1 - easeIn((t - 0.3) / 0.7));
};
const nz = (v: number) => Math.max(0.0001, v);
type Path = [number, number][];
/** Position at distance d along a polyline. */
const along = (path: Path, d: number) => {
  let rest = Math.max(0, d);
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (rest <= L || i === path.length - 2) {
      const u = clamp(rest / Math.max(1e-6, L));
      return { x: lerp(ax, bx, u), z: lerp(az, bz, u), heading: Math.atan2(bx - ax, bz - az), done: rest >= L && i === path.length - 2 };
    }
    rest -= L;
  }
  const [x, z] = path[path.length - 1];
  return { x, z, heading: 0, done: true };
};
const angLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
/** Keys whose frames came out non-increasing (very short beats) are pushed forward by a frame. */
const monotone = (keys: Key[]) => {
  for (let i = 1; i < keys.length; i++) if (keys[i].f <= keys[i - 1].f) keys[i] = { ...keys[i], f: keys[i - 1].f + 1 };
  return keys;
};

// ---------------------------------------------------------------- outfits
type Outfit = { colors: BlockyColors; trousers?: string; skirt?: string; sleeves?: string; chest?: React.ReactNode; headgear?: React.ReactNode };
const villager = (tunic: string, legs: string, skin: string, hair: string, cap?: string): Outfit => ({
  colors: { skin, shirt: tunic, pants: legs, shoes: "#4A2E22", hair, face: PAL.ink },
  trousers: legs,
  sleeves: tunic,
  skirt: tunic,
  chest: <Belt />,
  headgear: cap ? <Cap color={cap} /> : undefined,
});
const player = (shirt: string, shorts: string, skin: string, hair: string, shoes = "#FFFFFF"): Outfit => ({
  colors: { skin, shirt, pants: shorts, shoes, hair, face: PAL.ink },
});
const KING: Outfit = {
  colors: { skin: SKIN[3], shirt: MPAL.robe, pants: MPAL.robe, shoes: "#3A2A20", hair: "#F2EEE6", face: PAL.ink },
  trousers: MPAL.robe,
  sleeves: MPAL.robe,
  skirt: MPAL.robe,
  chest: (
    <>
      <Part geo={rbox(0.96, 0.2, 0.6, 0.08)} color={MPAL.ermine} position={[0, 0.74, 0]} />
      <Part geo={rbox(0.5, 0.08, 0.04, 0.02)} color={MPAL.gold} position={[0, 0.5, 0.26]} />
      <Part geo={rbox(0.14, 0.14, 0.04, 0.03)} color={MPAL.gold} position={[0, 0.4, 0.27]} />
    </>
  ),
  headgear: (
    <>
      <Crown />
      <Beard />
    </>
  ),
};
const SCROLL_GUY = villager("#2F8C86", "#6B4A35", SKIN[1], "#8A5A30", "#7A4A28");
const SLEEPER = villager("#E3A93B", "#5A5048", SKIN[0], "#D9B25A");
const PILE_O: Outfit[] = [
  villager("#C8553D", "#6B4A35", SKIN[2], "#3B2A20"),
  villager("#3F6FB0", "#4A3A2E", SKIN[0], "#A8642E", "#5E7A3A"),
  villager("#E3A93B", "#5A5048", SKIN[4], "#2C211D"),
  villager("#2F8C86", "#7A5A3A", SKIN[3], "#5A3B28"),
  villager("#B23A2E", "#3E4660", SKIN[1], "#D9B25A", "#8A2F2A"),
];
const RED_P = (i: number) => player(i === 0 ? "#F2B630" : "#D9453A", "#FFFFFF", SKIN[i % 5], ["#3B2A20", "#2C211D", "#5A3B28", "#A8642E"][i % 4]);
const BLUE_P = (i: number) => player(i === 0 ? "#7BC86C" : "#3F6FB0", "#FFFFFF", SKIN[(i + 2) % 5], ["#2C211D", "#5A3B28", "#3B2A20", "#D9B25A"][i % 4]);
const MOD: Outfit[] = [
  player("#2F8C86", "#2E3A55", SKIN[1], "#2C211D"),
  player("#D9693F", "#3A3F4A", SKIN[2], "#3B2A20", PAL.cream),
  player("#F2F0EA", "#2E3A55", SKIN[0], "#5A3B28", "#D9453A"),
  player("#E3A93B", "#2E3A55", SKIN[4], "#2C211D"),
  player("#6A5AA0", "#3A3F4A", SKIN[3], "#A8642E"),
  player("#C8E04A", "#2E3A55", SKIN[2], "#2C211D", "#2A2E36"),
  player("#3F6FB0", "#F2F0EA", SKIN[1], "#3B2A20"),
];

const Person: React.FC<{ o: Outfit; pose: BlockyPose; pos: V3; rot: number; scale?: number; rightHand?: React.ReactNode; leftHand?: React.ReactNode; noBlob?: boolean }> = ({ o, pose, pos, rot, scale = 0.8, rightHand, leftHand, noBlob }) => (
  <Blocky pose={pose} colors={o.colors} position={pos} rotationY={rot} scale={scale} trousers={o.trousers} skirt={o.skirt} sleeves={o.sleeves} chest={o.chest} headgear={o.headgear} rightHand={rightHand} leftHand={leftHand} noBlob={noBlob} />
);

// ---------------------------------------------------------------- the ball's path (beats 6-9)
type Hop = { t: number; x: number; z: number; h: number };
const makeHops = (B: MBeats): Hop[] => {
  const S6 = B.s[6];
  const D = B.s[7] - S6;
  const at = (u: number) => S6 + D * u;
  return [
    { t: S6, x: RISE[0], z: RISE[2], h: 0 },
    { t: at(0.12), x: O[0] + 4, z: O[2], h: 0 },
    { t: at(0.24), x: O[0] + 9, z: O[2], h: 2.2 },
    { t: at(0.34), x: O[0] + 13.5, z: O[2], h: 1.7 },
    { t: at(0.5), x: O[0] + 21, z: O[2], h: 3.4 }, // over the cart
    { t: at(0.6), x: O[0] + 26, z: O[2], h: 1.6 },
    { t: at(0.7), x: O[0] + 31, z: O[2], h: 1.3 },
    { t: at(0.79), x: O[0] + 36, z: O[2] + 0.2, h: 1.0 },
    { t: at(0.88), x: O[0] + 41, z: O[2] + 0.8, h: 0.7 },
    { t: at(1.0), x: REST[0], z: REST[2], h: 0 }, // rolls in
  ];
};
type BallState = { p: V3; spin: number; deflate: number; squash: number };
const ballAt = (f: number, B: MBeats, hops: Hop[], kingF: number): BallState => {
  const S = B.s;
  const freeze = kingF + 10;
  if (f < S[6]) {
    const up = easeOut(seg(f, S[5], S[5] + (S[6] - S[5]) * 0.62, (x) => x));
    const y = lerp(1.0, RISE[1], up) + Math.sin((f - S[5]) * 0.08) * 0.1 * up;
    return { p: [lerp(PILE[0], RISE[0], up), y, lerp(PILE[2], RISE[2], up)], spin: (f - S[5]) * 0.03, deflate: 0, squash: 1 };
  }
  if (f < S[7]) {
    let i = 0;
    while (i < hops.length - 2 && hops[i + 1].t <= f) i++;
    const a = hops[i];
    const b = hops[i + 1];
    const u = clamp((f - a.t) / (b.t - a.t));
    const x = lerp(a.x, b.x, u);
    const z = lerp(a.z, b.z, u);
    let y: number;
    if (i === 0) y = BALL_R + (RISE[1] - BALL_R) * (1 - u * u);
    else if (b.h === 0) y = BALL_R;
    else y = BALL_R + 4 * b.h * u * (1 - u);
    // squash on each landing
    const since = f - a.t;
    const sq = i > 0 && since < 6 ? 1 - 0.25 * Math.sin((since / 6) * Math.PI) * (a.h > 0 ? 1 : 0.4) : 1;
    return { p: [x, y, z], spin: (x - O[0]) * 1.6, deflate: 0, squash: sq };
  }
  const kick = S[8] + 4;
  if (f < kick) return { p: REST, spin: (REST[0] - O[0]) * 1.6, deflate: 0, squash: 1 };
  // kicked high toward the castle; at the freeze it drops onto the balcony beside the king and deflates there
  const tf = Math.min(f, freeze);
  const u = clamp((tf - kick) / Math.max(1, freeze - kick));
  const x = lerp(REST[0], BAL[0], u);
  const z = lerp(REST[2], BAL[1], u);
  const top = 7.4;
  const yArc = lerp(BALL_R, top, u) + 4 * 2.6 * u * (1 - u);
  if (f <= freeze) return { p: [x, yArc, z], spin: 30 + (tf - kick) * 0.25, deflate: 0, squash: 1 };
  const t = f - freeze;
  const floor = BALCONY_Y + BALL_R * 0.95;
  const g = 0.03;
  const fall = Math.max(floor, top - g * t * t);
  const tLand = Math.sqrt((top - floor) / g);
  const after = Math.max(0, t - tLand);
  const bounce = fall <= floor ? Math.abs(Math.sin(after * 0.45)) * 0.3 * Math.exp(-after / 4) : 0;
  return { p: [x, fall + bounce, z], spin: 30 + (freeze - kick) * 0.25, deflate: seg(after, 4, 22, easeInOut), squash: 1 };
};

// ---------------------------------------------------------------- environment (day, time-lapse, floodlit night)
type Env = { top: string; hor: string; hemiSky: string; hemiGround: string; hemiI: number; sunI: number; sunColor: string; fog: string; fogNear: number; fogFar: number; flood: number };
const C = (a: string) => new THREE.Color(a);
const mixC = (a: string, b: string, t: number) => C(a).lerp(C(b), clamp(t)).getStyle();
const DAY = { top: "#5DB3E0", hor: "#F6EBD6" };
const DUSK = { top: "#6F86C8", hor: "#F7A866" };
const NIGHT = { top: "#2E4C92", hor: "#7896D2" };
const DAWN = { top: "#7AA6DC", hor: "#F8C29A" };
/** beat-4 time-lapse: phase 0..1 over the beat (two full days), and the phase inside the current day (0 = day .. 1 = day) */
const lapse = (f: number, B: MBeats) => seg(f, B.s[3] + 16, B.s[4] - 6, (x) => x);
const dayPhase = (p: number) => (p <= 0 || p >= 1 ? 0 : (p * 2) % 1);
const envAt = (f: number, B: MBeats): Env => {
  const q = dayPhase(lapse(f, B));
  const dusk = seg(q, 0.02, 0.22) * (1 - seg(q, 0.24, 0.34));
  const night = seg(q, 0.24, 0.34) * (1 - seg(q, 0.64, 0.74));
  const dawn = seg(q, 0.62, 0.72) * (1 - seg(q, 0.8, 0.97));
  const fin = seg(f, B.mA, B.mB, easeInOut);
  let top = DAY.top;
  let hor = DAY.hor;
  top = mixC(top, DUSK.top, dusk);
  hor = mixC(hor, DUSK.hor, dusk);
  top = mixC(top, NIGHT.top, night);
  hor = mixC(hor, NIGHT.hor, night);
  top = mixC(top, DAWN.top, dawn);
  hor = mixC(hor, DAWN.hor, dawn);
  top = mixC(top, NIGHT.top, fin);
  hor = mixC(hor, NIGHT.hor, fin);
  const n = Math.max(night, fin);
  const hemiSky = mixC(mixC("#D6ECF6", "#FFD9B0", dusk + dawn * 0.7), "#B9C8F2", n);
  const hemiGround = mixC("#C9C08A", "#5E7A55", n);
  const sunColor = mixC(mixC("#FFE6C4", "#FFB77A", dusk + dawn), fin > 0.5 ? "#FFFFFF" : "#C9D6FF", n);
  // night stays readable: the light changes colour more than strength
  const sunI = lerp(lerp(2.4, 1.9, dusk + dawn), fin > 0 ? 2.5 : 1.35, n);
  const hemiI = lerp(1.65, fin > 0 ? 1.55 : 1.25, n);
  const wide = f < B.s[2] + 30;
  return { top, hor, hemiSky, hemiGround, hemiI, sunI, sunColor, fog: hor, fogNear: wide ? 90 : 55, fogFar: wide ? 360 : 230, flood: fin };
};

/** The sun (casts the shadows): follows the camera's look point, its shadow box grows with the camera height. */
const SunRig: React.FC<{ target: V3; dir: V3; intensity: number; color: string; half: number }> = ({ target, dir, intensity, color, half }) => {
  const { light, tgt } = useMemo(() => {
    const l = new THREE.DirectionalLight();
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.02;
    l.shadow.radius = 4;
    const t = new THREE.Object3D();
    l.target = t;
    return { light: l, tgt: t };
  }, []);
  const snap = (v: number) => Math.round(v / 0.5) * 0.5;
  const tp: V3 = [snap(target[0]), 0, snap(target[2])];
  tgt.position.set(...tp);
  light.position.set(tp[0] + dir[0], dir[1], tp[2] + dir[2]);
  light.intensity = intensity;
  light.color.set(color);
  const cam = light.shadow.camera;
  if (cam.right !== half) {
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = 220;
    cam.updateProjectionMatrix();
  }
  return (
    <>
      <primitive object={tgt} />
      <primitive object={light} />
    </>
  );
};

// ---------------------------------------------------------------- camera
const makeKeys = (B: MBeats, ballX: (f: number) => number): Key[] => {
  const S = B.s;
  const L = (i: number, u: number) => Math.round(lerp(S[i], S[i + 1], u));
  const k = (f: number, p: V3, l: V3, fov: number, still = false): Key => ({ f, p, l, fov, still });
  const creep = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const keys: Key[] = [
    // 1: a real 11-a-side match from a 3/4 view (nobody else), a slow push
    k(0, [0, 25, 29], [0, 0, 3.8], 42),
    k(Math.max(L(0, 0.85), 2), [0, 25.5, 29.6], [0, 0, 3.4], 42),
    // 2: the red village (left), full of people
    k(L(1, 0.2), [-9.0, 11.5, 0.5], [-22.5, 0, -5.0], 48),
    k(L(1, 0.33), [-9.3, 11.2, 0.2], [-22.2, 0, -5.0], 48),
    // over the pitch to the blue village (right)
    k(L(1, 0.47), [0, 19, 14], [0, 0, -5], 48),
    k(L(1, 0.62), [9.3, 11.2, 0.2], [22.2, 0, -5.0], 48),
    k(L(1, 0.74), [9.0, 12, 1.0], [21.6, 0, -5.0], 48),
    // both pour out and flood the pitch between them (wide)
    k(S[2] + 6, [2, 38, 31], [0, 0, -3], 46),
    k(S[2] + 18, [1, 37, 28], [0, 0, -6], 46),
    // 3: swoop down onto the road and fly to the far goal (nobody there yet)
    k(L(2, 0.52), [0, 9, -40], [0, 2.4, -88], 48),
    k(L(2, 0.8), [0, 6.2, -92], [0, 2.4, -142], 50),
    k(S[3] + 4, [-2.4, 4.2, O[2] + 21], [-0.5, -0.6, O[2] - 4], 50),
    // 4: the time-lapse (a slow drift)
    k(L(3, 0.55), [-3.0, 3.5, O[2] + 18], [-0.5, -1.0, O[2] - 2], 50),
    k(S[4] - 2, [-2.0, 3.5, O[2] + 15.5], [-0.3, -0.8, O[2] - 1], 50),
    // 5: dive into the scrum (seen from the field, the village street behind it)
    k(L(4, 0.78), [PILE[0] - 7.2, 3.4, PILE[2] + 2.6], [PILE[0], 0.1, PILE[2]], 50),
    // 6: lower and closer: the ball pops up toward us, the pig looks up at it
    k(L(5, 0.4), [PILE[0] - 10.5, 1.9, PILE[2] - 1.6], [PILE[0] - 2.2, 0.45, PILE[2] - 1.4], 50),
    k(S[6] - 2, [PILE[0] - 10.2, 2.0, PILE[2] - 1.2], [PILE[0] - 2.4, 0.6, PILE[2] - 1.0], 50),
  ];
  // 7: track the ball down the street from the garden side
  for (const u of [0.2, 0.45, 0.7, 0.9]) {
    const f = L(6, u);
    const tx = ballX(f) - 3.0; // between the ball and the crowd chasing it
    keys.push(k(f, [tx - 2.0, u < 0.3 ? 4.6 : 3.7, O[2] + 11.5], [tx + 1.0, 0.9, O[2] - 0.5], 56));
  }
  keys.push(
    // 8: the scroll, close
    k(S[7] + 8, [K[0] + 0.5, 1.65, K[2] + 6.6], [K[0], 0.75, K[2] + 0.7], 50, true),
    k(L(7, 0.85), [K[0] + 0.3, 1.6, K[2] + 6.0], [K[0], 0.75, K[2] + 0.7], 50),
    // 9: back and up: the castle, the king, the frozen crowd
    // (from behind the crowd, looking up: the king large in the upper part, the crowd's backs in the lower third)
    k(L(8, 0.12), [K[0] + 0.5, 4.3, K[2] + 5.0], [K[0] + 0.2, 3.6, K[2] - 11], 52),
    k(L(8, 0.32), [K[0] + 0.5, 3.2, K[2] + 1.5], [K[0] + 0.3, 5.1, K[2] - 11], 54),
    k(B.mA, [K[0] + 0.5, 3.2, K[2] + 1.8], [K[0] + 0.3, 5.1, K[2] - 11], 54),
    // 10-13: settle on the locked pitch framing, then only a slow creep
    k(S[9], FIN, FINL, 50, true),
    k(B.end, creep(FIN, FINL, 0.022), creep(FINL, FIN, -0.01), 50, true),
  );
  return monotone(keys);
};

const CameraRig: React.FC<{ frame: number; B: MBeats; keys: Key[] }> = ({ frame, B, keys }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const c = sampleTrack(keys, frame);
  // the ground shakes a little as the mob tramples the lines
  const sh = wobble(frame, B.w.not - 2, 0.16, 1.7, 7);
  camera.position.set(c.p[0] + sh * 0.6, c.p[1] + sh, c.p[2]);
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

// ---------------------------------------------------------------- 3D digits for "1314" (seven-segment, rounded bars)
const SEG7: Record<string, string> = { "1": "bc", "3": "abcdg", "4": "bcfg" };
const Digit7: React.FC<{ d: string; color?: string; paint?: boolean }> = ({ d, color = MPAL.gold, paint = false }) => {
  const W = 0.8;
  const H = 1.4;
  const t = paint ? 0.22 : 0.2;
  const dz = paint ? 0.02 : t;
  const s = SEG7[d] ?? "";
  const m = paint ? { rough: 0.95, shadow: false } : { rough: 0.35, emissive: MPAL.goldDark, emissiveIntensity: 0.45, shadow: false };
  const hz = (y: number) => <Part geo={rbox(W, t, dz, Math.min(t, dz) / 2.2)} color={color} {...m} position={[0, y, 0]} />;
  const vt = (x: number, y: number) => <Part geo={rbox(t, H / 2 + t * 0.2, dz, Math.min(t, dz) / 2.2)} color={color} {...m} position={[x, y, 0]} />;
  return (
    <group>
      {s.includes("a") && hz(H / 2)}
      {s.includes("g") && hz(0)}
      {s.includes("d") && hz(-H / 2)}
      {s.includes("b") && vt(W / 2, H / 4)}
      {s.includes("c") && vt(W / 2, -H / 4)}
      {s.includes("f") && vt(-W / 2, H / 4)}
      {s.includes("e") && vt(-W / 2, -H / 4)}
      {d === "1" && <Part geo={rbox(0.4, t, dz, Math.min(t, dz) / 2.2)} color={color} {...m} position={[W / 2 - 0.17, H / 2 - 0.12, 0]} rotation={[0, 0, -0.6]} />}
    </group>
  );
};

// ---------------------------------------------------------------- set dressing that never changes (memoised)
/** Six cottages in a ring around the square, leaving a gap (the lane) toward the pitch; doors face the square. */
const villageHouses = (c: [number, number], gd: number, seed: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const ga = gd > 0 ? 0 : Math.PI;
    const a = ga + ((50 + i * 52) * Math.PI) / 180;
    const r = 6.4 + hash(seed + i) * 0.6;
    const x = c[0] + Math.cos(a) * r;
    const z = c[1] + Math.sin(a) * r * 0.9;
    return { x, z, rot: Math.atan2(-Math.cos(a), -Math.sin(a)), seed: seed * 10 + i, door: [x - Math.cos(a) * 2.0, z - Math.sin(a) * 1.8] as [number, number] };
  });
const FOREST = (() => {
  const out: { x: number; z: number; pine: boolean; s: number; seed: number }[] = [];
  for (let gx = 0; gx < 16; gx++)
    for (let gz = 0; gz < 12; gz++) {
      const x = O[0] + 27 + gx * 2.9 + (hash(gx * 7.1 + gz) - 0.5) * 1.8;
      const z = K[2] - 26 + gz * 2.9 + (hash(gz * 5.3 + gx * 2) - 0.5) * 1.8;
      if (z > K[2] + 9) continue;
      if (x < K[0] - 11 && z > O[2] - 2.6) continue; // the street side stays open for the camera
      if (x > K[0] - 11 && x < K[0] + 11 && z > K[2] - 17) continue; // the clearing + the pitch later
      if (Math.abs(z - O[2]) < 2.4 && x < K[0]) continue; // the ball's corridor
      if (Math.abs(x - CASTLE[0]) < 11 && z > CASTLE[2] - 5) continue; // in front of / inside the castle
      if (hash(gx * 3.3 + gz * 9.1) < 0.18) continue;
      out.push({ x, z, pine: hash(gx + gz * 13) < 0.55, s: 0.9 + hash(gx * 2 + gz) * 0.5, seed: gx * 12 + gz });
    }
  return out;
})();

const World: React.FC<{ B: MBeats; keys: Key[]; hops: Hop[]; kingF: number }> = ({ B, keys, hops, kingF }) => {
  const f = useCurrentFrame();
  const S = B.s;
  const env = envAt(f, B);
  const cam = sampleTrack(keys, f);
  const freeze = kingF + 10;
  const items: CrowdItem[] = [];
  const nodes: React.ReactNode[] = [];

  // ================= beats 1-2: a real 11 v 11 match (beat 1, nobody else), then the two villages pour out and flood it (beat 2)
  const showPitch = f < S[3];
  const pourAt = [Math.round(lerp(S[1], S[2], 0.38)), Math.round(lerp(S[1], S[2], 0.66))]; // red village, blue village
  const RUN_V = 0.38;
  /** when the flood reaches (x, z) on the pitch */
  const floodAt = (x: number, z: number) => Math.min(pourAt[0] + Math.abs(x + 13.5) / RUN_V + 14, pourAt[1] + Math.abs(x - 13.5) / RUN_V + 14) + Math.abs(z) * 0.3;
  const trample = (x: number, z: number) => {
    const t = floodAt(x, z);
    return seg(f, t, t + 16);
  };
  if (showPitch) {
    const formation: [number, number][] = [
      [0, 12.6],
      [-6, 9],
      [-2, 9.4],
      [2, 9.4],
      [6, 9],
      [-6, 5.4],
      [-2, 5.8],
      [2, 5.8],
      [6, 5.4],
      [-2.4, 2.0],
      [2.4, 2.0],
    ];
    const stopF = B.w.not + 4;
    const fs = Math.min(f, stopF);
    /** a player's spot: home + the team's slow slide + a small personal jog */
    const spotOf = (team: number, i: number, t: number): [number, number] => {
      const [fx, fz] = formation[i];
      const hx = team < 0 ? fx : -fx;
      const hz = team < 0 ? -fz : fz;
      if (i === 0) return [hx + Math.sin(t * 0.05 + team) * 0.4, hz];
      const sx = Math.sin(t * 0.03) * 1.3 + Math.sin(t * 0.07 + i * 1.7 + team) * 0.35;
      const sz = Math.sin(t * 0.021 + 0.5) * 0.8 + Math.cos(t * 0.06 + i * 2.3 + team) * 0.3;
      return [hx + sx, hz + sz];
    };
    // kick-off just taken: short passes, then the ball stops when the rumble starts
    const passes: [number, number][] = [
      [-1, 9],
      [-1, 6],
      [-1, 2],
      [-1, 7],
      [-1, 10],
      [1, 6],
      [1, 2],
    ];
    const P = 17;
    const ballOn = (t: number): [number, number] => {
      const k = Math.floor((t + 9) / P);
      const local = (t + 9) - k * P;
      const from = k <= 0 ? ([0.3, 0.2] as [number, number]) : spotOf(passes[Math.min(k - 1, passes.length - 1)][0], passes[Math.min(k - 1, passes.length - 1)][1], t);
      const to = spotOf(passes[Math.min(Math.max(k, 0), passes.length - 1)][0], passes[Math.min(Math.max(k, 0), passes.length - 1)][1], t);
      const u = easeOut(clamp(local / 12));
      return [lerp(from[0], to[0] + 0.25, u), lerp(from[1], to[1] + 0.35, u)];
    };
    const bp = ballOn(fs);
    const ballRoll = f > stopF ? 0 : 1;
    nodes.push(<ModernBall key="b1ball" position={[bp[0], 0.3, bp[1]]} spin={fs * 0.4 * ballRoll} s={1} />);
    for (const team of [-1, 1]) {
      formation.forEach((_, i) => {
        const seed = i + (team > 0 ? 20 : 0);
        const [x0, z0] = spotOf(team, i, fs);
        const [xq, zq] = spotOf(team, i, fs - 2);
        const moving = f < stopF && Math.hypot(x0 - xq, z0 - zq) > 0.01;
        let pose = alive(restPose(), f, seed, 0.8);
        pose.armL = { sx: 0.05, sz: 0.18, twist: 0, elbow: -0.4 };
        pose.armR = { sx: 0.05, sz: 0.18, twist: 0, elbow: -0.4 };
        if (moving && i > 0) pose = lerpPose(pose, alive(runnerPose(f * 0.32 + seed, 0.38), f, seed, 0.4), 0.9);
        let rot = Math.atan2(bp[0] - x0, bp[1] - z0);
        // "not": a low rumble; they stop and look toward the two sides
        const look = seg(f, B.w.not + (seed % 5), B.w.not + 8 + (seed % 5));
        const side = x0 < -0.3 ? -1 : x0 > 0.3 ? 1 : hash(seed) < 0.5 ? -1 : 1;
        rot = angLerp(rot, side > 0 ? Math.PI / 2 : -Math.PI / 2, look * 0.75);
        pose.headYaw += look * 0.35 * (team < 0 ? -side : side) * 0;
        pose.eyeWide = lerp(1, 1.3, look);
        pose.browUp = look * 0.7;
        if (look > 0.5) {
          pose.mouth = "o";
          pose.mouthOpen = 0.25;
        }
        let pos: V3 = [x0, 0, z0];
        // beat 2: the flood reaches them, they scatter in little panicked loops (a few tumble)
        const tFlood = floodAt(x0, z0) - 4;
        const run = seg(f, tFlood, tFlood + 10);
        let tumble = 0;
        if (run > 0) {
          const dir = hash(seed * 3) < 0.5 ? 1 : -1;
          const ph = (f - tFlood) * 0.08 * dir + seed;
          const r = 1.3 * run;
          pos = [x0 + Math.cos(ph) * r - r, 0, z0 + Math.sin(ph) * r];
          const rp = runnerPose(f * 0.45 + seed, 0.9);
          rp.mouth = "o";
          rp.mouthOpen = 0.35;
          rp.eyeWide = 1.3;
          rp.browUp = 0.8;
          rp.brow = 1;
          pose = lerpPose(pose, rp, run);
          rot = angLerp(rot, ph + (dir > 0 ? 0 : Math.PI), run);
          if (seed % 6 === 2) tumble = seg(f, tFlood + 14, tFlood + 30, easeInOut) * Math.PI * 2;
        }
        nodes.push(
          <group key={`pl${team}${i}`} position={[pos[0], Math.sin(tumble) * 0.6, pos[2]]} rotation={[0, rot, 0]}>
            <group position={[0, 1.0, 0]} rotation={[tumble, 0, 0]}>
              <group position={[0, -1.0, 0]}>
                <Person o={team < 0 ? RED_P(i) : BLUE_P(i)} pose={pose} pos={[0, 0, 0]} rot={0} noBlob={tumble > 0.1} />
              </group>
            </group>
          </group>,
        );
      });
    }
    // a little dust on the horizon at the two sides (the villages are coming)
    for (const sd of [-1, 1])
      for (let q = 0; q < 4; q++) nodes.push(<Puff key={`hz${sd}${q}`} at={[sd * (11 + q * 1.3), 0.5 + q * 0.4, -14 - q * 2]} age={(f - B.w.not - q * 5) * 0.6} life={40} s={2.6} color="#E8D9B8" />);
  }
  if (f < S[3] + 6) {
    // the two villages: full of people (square, doorways), then they pour out of their lane and flood the pitch
    for (const sd of [-1, 1]) {
      const vc = sd < 0 ? VL : VR;
      const gd = -sd; // the lane opens toward the pitch
      const houses = villageHouses(vc, gd, sd < 0 ? 1.3 : 4.7);
      const pf = pourAt[sd < 0 ? 0 : 1];
      for (let i = 0; i < 30; i++) {
        const h = (k: number) => hash(i * 7.3 + k * 1.9 + sd * 31);
        let hx: number;
        let hz: number;
        if (i < 20) {
          const a = h(1) * Math.PI * 2;
          const r = 1.2 + h(2) * 3.2;
          hx = vc[0] + Math.cos(a) * r;
          hz = vc[1] + Math.sin(a) * r * 0.9;
        } else {
          const hs = houses[(i - 20) % houses.length];
          hx = hs.door[0] + (h(3) - 0.5) * 0.9;
          hz = hs.door[1] + (h(4) - 0.5) * 0.9;
        }
        const gateX = vc[0] + gd * 8.5;
        const t0 = pf + Math.round(Math.abs(hx - gateX) * 1.1 + h(5) * 8);
        const T: [number, number] = [-gd * (8.5 - h(7) * 10.5), -12 + h(8) * 24];
        const path: Path = [[hx, hz], [gateX, vc[1] + (h(6) - 0.5) * 3], T];
        const t = f - t0;
        let pose: MiniPose;
        let pos: V3 = [hx, 0, hz];
        let rot = Math.atan2(vc[0] - hx, vc[1] + 2 - hz) + (h(9) - 0.5) * 1.6;
        if (t < 0) {
          // village life: chatting, waving, a little hop
          pose = miniRest();
          const kind = i % 4;
          if (kind === 0) {
            pose.armR = -2.5 + Math.sin(f * 0.4 + i) * 0.35;
            pose.outR = 0.4;
            pose.mouth = 0.6;
          } else if (kind === 1) {
            pose.armR = -0.7 + Math.sin(f * 0.2 + i) * 0.3;
            pose.headTilt = Math.sin(f * 0.07 + i) * 0.15;
            pose.mouth = 0.4 + 0.3 * Math.sin(f * 0.5 + i);
          } else if (kind === 2) {
            pose.outL = 0.7;
            pose.outR = 0.7;
            pose.armL = 0.3;
            pose.armR = 0.3;
          } else {
            pose.lift = Math.abs(Math.sin(f * 0.2 + i)) * 0.15;
          }
          pose.bob = Math.sin(f * 0.11 + i) * 0.02;
        } else {
          const d = RUN_V * Math.max(0, t - 4 * (1 - Math.exp(-t / 4)));
          const a = along(path, d);
          pos = [a.x, 0, a.z];
          rot = a.heading;
          if (!a.done) pose = miniRun(d * 2.6 + i, 1);
          else {
            // on the pitch: milling chaos, arms flailing, a few cartwheels
            const lp = t * 0.11 + i;
            pos = [a.x + Math.cos(lp) * 0.8 - 0.8, 0, a.z + Math.sin(lp) * 0.8];
            rot = lp + Math.PI / 2;
            pose = i % 3 === 0 ? miniFlail(f, i) : miniRun(t * 0.5 + i, 0.8);
            if (i % 7 === 3) {
              const c = (t * 0.06) % (Math.PI * 2);
              pose.tumbleZ = c;
              pose.lift = Math.abs(Math.sin(c)) * 0.5;
            }
          }
        }
        items.push({ pos, rot, pose, look: lookFor(i, sd), scale: 1 });
      }
    }
  }

  // ================= beat 4: the crowd arrives at the far field chasing the ball, runs for two days; then it collapses into the scrum
  const conv = seg(f, S[4] - 16, S[4] + 4, easeIn);
  const orbit = (th: number, rr: number): [number, number] => [O[0] - 1 + Math.cos(th) * 6.2 * rr, O[2] + 0.5 + Math.sin(th) * 3.6 * rr];
  if (f >= S[3] - 8 && f < S[4] + 6) {
    const fast = f * 0.085;
    for (let i = 0; i < 34; i++) {
      const h = (k: number) => hash(i * 4.1 + k * 2.7 + 9);
      const tA = S[3] - 6 + i * 0.35;
      if (f < tA) continue;
      const th = fast - 0.35 - i * 0.11 - h(1) * 0.1;
      const rr = 1 + (h(2) - 0.5) * 0.35;
      const orb = orbit(th, rr);
      const P0: [number, number] = [O[0] - 13 - h(3) * 3, O[2] + 3 + (h(4) - 0.5) * 6];
      const e = seg(f, tA, tA + 18, (x) => x);
      let x = lerp(P0[0], orb[0], e);
      let z = lerp(P0[1], orb[1], e);
      x = lerp(x, PILE[0], conv);
      z = lerp(z, PILE[2], conv);
      if (conv > 0.85) continue;
      const pose = miniRun(f * 0.9 + i, 1);
      if (i % 9 === 4) pose.armL = -2.6;
      const rot = e < 1 ? Math.atan2(orb[0] - P0[0], orb[1] - P0[1]) : Math.atan2(-Math.sin(th) * 6.2, Math.cos(th) * 3.6);
      items.push({ pos: [x, 0, z], rot, pose, look: lookFor(i + 60, 0), scale: 1 });
    }
    // the ball leads them
    if (f < S[4] - 6) {
      const thb = fast + 0.25;
      const orb = orbit(thb, 1);
      const e = seg(f, S[3] - 8, S[3] + 8, (x) => x);
      const P0: [number, number] = [O[0] - 12, O[2] + 3];
      const bx = lerp(lerp(P0[0], orb[0], e), PILE[0], conv);
      const bz = lerp(lerp(P0[1], orb[1], e), PILE[2], conv);
      nodes.push(<BladderBall key="b4ball" position={[bx, BALL_R + Math.abs(Math.sin(f * 0.45)) * 0.7, bz]} spin={f * 0.3} s={1} />);
    }
  }
  // ================= the far goal + windmill
  if (f >= S[1] && f < S[7]) {
    nodes.push(<MillGoal key="goal" position={G} />);
    nodes.push(<Windmill key="mill" position={[G[0] - 9, 0, G[2] - 7]} angle={f * 0.05} />);
    nodes.push(<RoundTree key="gt1" position={[G[0] + 7, 0, G[2] - 4]} frame={f} seed={3} s={1.2} />);
    nodes.push(<RoundTree key="gt2" position={[G[0] - 15, 0, G[2] - 2]} frame={f} seed={5} />);
    // something small alive at the empty goal: sheep grazing
    nodes.push(<Sheep key="sh1" position={[G[0] + 3.5, 0, G[2] + 3.2]} rotationY={-0.6} graze={0.5 + 0.5 * Math.sin(f * 0.09)} />);
    nodes.push(<Sheep key="sh2" position={[G[0] + 5.6, 0, G[2] + 1.6]} rotationY={-1.4} graze={0.5 + 0.5 * Math.sin(f * 0.07 + 2)} s={0.85} />);
  }
  // the sleeper (asleep standing up, head nodding)
  if (f >= S[3] - 4 && f < S[4] + 10) {
    const p = alive(restPose(), f, 31, 0.5);
    p.eyeOpen = 0;
    p.mouth = "o";
    p.mouthOpen = 0.12 + 0.08 * Math.sin(f * 0.1);
    const nod = (f * 0.06) % 1;
    p.headPitch = 0.1 + 0.45 * easeIn(clamp(nod / 0.8)) - 0.45 * easeOut(clamp((nod - 0.8) / 0.2)) * 1;
    p.headTilt = 0.12;
    p.lean = 0.05 + p.headPitch * 0.1;
    p.armL = { sx: 0.05, sz: 0.05, twist: 0, elbow: -0.1 };
    p.armR = { sx: 0.05, sz: 0.05, twist: 0, elbow: -0.1 };
    const spot: V3 = [O[0] - 2.4, 0, O[2] + 7.0];
    const wIn = seg(f, S[3] - 4, S[3] + 12, (x) => x);
    if (wIn < 1) {
      const wp = alive(runnerPose(f * 0.4, 0.5), f, 31, 0.4);
      const from: V3 = [O[0] - 10, 0, O[2] + 7.5];
      nodes.push(<Person key="sleeper" o={SLEEPER} pose={wp} pos={[lerp(from[0], spot[0], wIn), 0, lerp(from[2], spot[2], wIn)]} rot={Math.PI / 2} scale={0.9} />);
    } else nodes.push(<Person key="sleeper" o={SLEEPER} pose={lerpPose(p, alive(restPose(), f, 31, 0.5), 1 - seg(f, S[3] + 12, S[3] + 18))} pos={spot} rot={angLerp(Math.PI / 2, 0.25, seg(f, S[3] + 12, S[3] + 18))} scale={0.9} />);
  }

  // ================= beats 5-6: the pile (dust cloud with limbs), the pig
  const tw = f < S[5] ? f : f < S[6] ? S[5] + (f - S[5]) * 0.35 : S[5] + (S[6] - S[5]) * 0.35 + (f - S[6]);
  const dust = seg(f, S[4] - 18, S[4] + 2) * (1 - seg(f, S[6] + 6, S[6] + 34)) * lerp(1, 0.6, seg(f, S[5] - 4, S[5] + 10));
  if (dust > 0.001) nodes.push(<DustCloud key="dust" frame={tw} at={[PILE[0], 0, PILE[2]]} r={lerp(2.3, 1.9, seg(f, S[5] - 4, S[5] + 10))} amount={dust} />);
  if (f >= S[4] - 8 && f < S[6] + 8) {
    const wave = (k: number) => Math.sin(tw * 0.55 + k * 1.7);
    const pile: { o: Outfit; at: V3; rot: [number, number, number]; pose: BlockyPose }[] = [];
    const base = (k: number) => {
      const p = restPose();
      p.legL = { hip: -0.6 + wave(k) * 0.6, sz: 0.2, knee: 0.4 };
      p.legR = { hip: -0.2 - wave(k + 1) * 0.6, sz: 0.2, knee: 0.5 };
      p.armL = { sx: -2.2 + wave(k + 2) * 0.6, sz: 0.6, twist: 0, elbow: -0.3 };
      p.armR = { sx: -2.0 - wave(k + 3) * 0.6, sz: 0.6, twist: 0, elbow: -0.3 };
      p.mouth = "grin";
      p.eyeWide = 1.2;
      p.browUp = 0.6;
      return p;
    };
    pile.push({ o: PILE_O[0], at: [-0.2, 0.45, 0.6], rot: [-Math.PI / 2, 0.3, 0], pose: base(0) }); // on the back, feet to us
    pile.push({ o: PILE_O[1], at: [0.9, 1.1, -0.2], rot: [Math.PI / 2 - 0.3, -1.4, 0], pose: base(1) }); // belly down across
    pile.push({ o: PILE_O[2], at: [-0.3, 3.1, -0.3], rot: [0, 0.4, Math.PI - 0.2], pose: base(2) }); // upside down, legs up
    pile.push({ o: PILE_O[3], at: [-1.3, 0, 0.2], rot: [0, 0.9, -0.5], pose: base(3) }); // leaning in from the left
    pile.push({ o: PILE_O[4], at: [1.4, 0, 0.6], rot: [0, -0.8, 0.45], pose: base(4) }); // leaning in from the right
    const shake = Math.sin(tw * 0.9) * 0.05;
    nodes.push(
      <group key="pile" position={[PILE[0], shake, PILE[2]]} rotation={[0, -Math.PI / 2, 0]} scale={nz(seg(f, S[4] - 8, S[4] + 2, easeOut))}>
        {pile.map((p, i) => (
          <group key={i} position={p.at} rotation={p.rot}>
            <Person o={p.o} pose={p.pose} pos={[0, 0, 0]} rot={0} scale={0.8} noBlob />
          </group>
        ))}
      </group>,
    );
    for (let i = 0; i < 6; i++) {
      const age = (tw + i * 7) % 22;
      const a = i * 1.1;
      nodes.push(<Puff key={`kp${i}`} at={[PILE[0] + 0.6 + Math.cos(a) * 2.4, 0.3, PILE[2] + Math.sin(a) * 2.0]} age={age} life={22} s={1.1} color="#EBDDBE" />);
    }
  }
  if (f >= S[4] - 4 && f < S[7]) {
    const watch = seg(f, S[5] - 4, S[5] + 8);
    const ball = ballAt(Math.max(f, S[5]), B, hops, kingF);
    const dx = ball.p[0] - PIG[0];
    const dz = ball.p[2] - PIG[2];
    const yaw = Math.atan2(dx, dz);
    const tilt = watch * (0.32 * Math.sin(Math.max(0, f - S[5]) * 0.05) + 0.1);
    const pitch = -watch * clamp((ball.p[1] - 1.0) / 2.4) * 0.75;
    const bl = (t: number) => (f >= t && f < t + 5 ? [0.5, 0.05, 0.1, 0.6, 0.9][f - t] : 1);
    const blink = Math.min(bl(S[5] + 18), bl(S[5] + 44), bl(S[6] - 8), bl(S[4] + 10));
    nodes.push(<Pig key="pig" position={PIG} rotationY={angLerp(0.9, yaw, watch)} tilt={tilt} pitch={pitch} blink={blink} earFlick={wobble(f, S[6] + 4, 0.4, 0.8, 5)} />);
  }

  // ================= the ball (beats 6-9)
  const ball = ballAt(f, B, hops, kingF);
  if (f >= S[5] && f < B.mA + 3) nodes.push(<BladderBall key="ball" position={ball.p} spin={ball.spin} s={1} deflate={ball.deflate} squash={ball.squash} />);
  nodes.push(<PuffRing key="ballgone" at={[ball.p[0], ball.p[1], ball.p[2]]} age={f - B.mA} n={5} r={0.4} s={1.1} life={12} />);
  if (f >= S[5] && f < S[5] + 24) nodes.push(<PuffRing key="ballpop" at={[PILE[0], 2.2, PILE[2]]} age={(f - S[5]) * 0.8} n={8} r={1.2} />);
  if (ball.deflate > 0 && ball.deflate < 1) {
    for (let i = 0; i < 3; i++) nodes.push(<Puff key={`air${i}`} at={[ball.p[0] + 0.3, 0.5, ball.p[2] + 0.2]} age={(f - freeze - 18 - i * 5) * 1.2} life={14} s={0.5} color="#FFFFFF" />);
  }

  // ================= beat 7: the village street, the cart, the garden fence; beats 7-10: the forest + the castle
  if (f >= S[3] && f < S[8]) {
    [8, 13.5, 19, 24.5].forEach((x, i) => nodes.push(<Cottage key={`st${i}`} position={[O[0] + x, 0, O[2] - 6.6]} seed={40 + i} />));
    // a dirt street
    nodes.push(<Part key="street" geo={box(36, 0.04, 4.4)} color={MPAL.road} position={[O[0] + 20, 0.025, O[2]]} shadow={false} />);
    // the garden side: a low wattle fence + cabbage rows
    for (let x = 5; x <= 29; x += 2) nodes.push(<Part key={`fp${x}`} geo={rbox(0.14, 0.8, 0.14, 0.04)} color={MPAL.timber} position={[O[0] + x, 0.4, O[2] + 3.4]} />);
    nodes.push(<Part key="fr1" geo={box(24, 0.1, 0.08)} color={PAL.wood} position={[O[0] + 17, 0.55, O[2] + 3.4]} />);
    nodes.push(<Part key="fr2" geo={box(24, 0.1, 0.08)} color={PAL.wood} position={[O[0] + 17, 0.3, O[2] + 3.4]} />);
    for (let x = 6; x <= 28; x += 1.6)
      for (const z of [4.6, 5.8])
        nodes.push(<Part key={`cb${x}${z}`} geo={circle(0.32, 8)} color={hash(x * z) < 0.5 ? "#7DBE4E" : "#5FA040"} rotation={[-Math.PI / 2, 0, 0]} position={[O[0] + x, 0.05, O[2] + z]} shadow={false} />);
    const jolt = wobble(f, hops[4].t - (hops[4].t - hops[3].t) / 2, 1, 0.9, 5);
    nodes.push(<VegCart key="cart" position={[O[0] + CART_X, 0, O[2] + 0.2]} jolt={jolt} />);
  }
  if (f >= S[5] - 20) {
    const sink = -26 * seg(f, B.mA + 1, B.mB - 7, easeInOut);
    if (f < B.mB) nodes.push(<group key="castle" position={[0, sink, 0]}><Castle position={CASTLE} frame={f} /></group>);
    FOREST.forEach((t, i) =>
      nodes.push(t.pine ? <PineTree key={`ft${i}`} position={[t.x, 0, t.z]} s={t.s} seed={t.seed} /> : <RoundTree key={`ft${i}`} position={[t.x, 0, t.z]} s={t.s} seed={t.seed} frame={f} />),
    );
  }

  // ================= beats 7-9: the chasing crowd (follows the ball's track, rests around the scroll, runs, freezes)
  if (f >= S[6] && f < B.mA + 24) {
    const fe = Math.min(f, freeze);
    const track = (t: number) => {
      if (t < S[6] + 6) return { x: PILE[0] + 1.8, z: PILE[2] };
      const b = ballAt(Math.max(S[6], Math.min(t, S[7] - 1)), B, hops, kingF);
      return { x: b.p[0], z: b.p[2] };
    };
    for (let i = 0; i < 18; i++) {
      const h = (k: number) => hash(i * 5.7 + k * 2.3 + 77);
      const delay = 3 + i * 0.7;
      const off: [number, number] = [-1.0 - (i % 4) * 0.7 - h(1) * 0.5, (h(2) - 0.5) * 3.0];
      const ang = Math.PI * (1.08 + (i / 17) * 0.84) + (h(3) - 0.5) * 0.15; // an arc behind the scroll guy
      const rest: [number, number] = [K[0] + Math.cos(ang) * (2.4 + h(4) * 2.4), K[2] + Math.sin(ang) * (2.0 + h(4) * 1.8) - 0.5];
      const posAt = (t: number): [number, number, number] => {
        const tr = track(t - delay);
        let x = tr.x + off[0];
        let z = tr.z + off[1];
        const rb = seg(t, S[7] - 16 + i * 0.6, S[7] + 18 + i * 0.6, easeInOut);
        x = lerp(x, rest[0], rb);
        z = lerp(z, rest[1], rb);
        // beat 9: they all run off toward the castle after the kicked ball
        const go = t - (S[8] + 5 + i * 0.7);
        if (go > 0) {
          const d = 0.2 * Math.max(0, go - 5 * (1 - Math.exp(-go / 5)));
          z -= d;
          x += (K[0] + (h(5) - 0.5) * 7 - x) * clamp(d / 12) * 0.6;
        }
        // hop the cart
        let lift = 0;
        if (Math.abs(x - (O[0] + CART_X)) < 1.8 && Math.abs(z - O[2]) < 1.6 && t < S[7]) lift = Math.sin(((x - (O[0] + CART_X) + 1.8) / 3.6) * Math.PI) * 1.5;
        return [x, lift, z];
      };
      const p = posAt(fe);
      const q = posAt(fe - 2);
      const sp = Math.hypot(p[0] - q[0], p[2] - q[2]) / 2;
      const moving = sp > 0.02;
      let rot = moving ? Math.atan2(p[0] - q[0], p[2] - q[2]) : Math.atan2(K[0] - p[0], K[2] + 1 - p[2]);
      if (!moving && fe > S[7] + 20) rot = angLerp(rot, Math.atan2(K[0] - p[0], K[2] + 3 - p[2]), 1);
      let pose: MiniPose;
      if (moving) {
        pose = miniRun(fe * 0.55 + i * 1.3, clamp(sp / 0.12, 0.4, 1));
        if (fe > S[8] + 5) pose.headPitch = -0.4; // running toward the castle, looking up at the king
        if (p[1] > 0.1) {
          pose.hipL = -0.9;
          pose.hipR = 0.6;
          pose.armL = -2.4;
          pose.armR = -2.2;
        }
      } else {
        pose = miniRest();
        pose.bob = Math.sin(fe * 0.12 + i) * 0.02;
        pose.headTilt = Math.sin(fe * 0.05 + i) * 0.1;
        pose.mouth = 0.3;
        // they cheer once the cross is stamped ("no rules!")
        const cheer = seg(fe, B.w.rule + 2 + (i % 5), B.w.rule + 8 + (i % 5)) * (1 - seg(fe, B.w.rule + 30, B.w.rule + 40));
        if (cheer > 0) pose = { ...miniFlail(fe, i, 1), lift: Math.abs(Math.sin(fe * 0.4 + i)) * 0.25 * cheer };
      }
      // the morph: each one vanishes inside a puff (never shrinks)
      const vf = B.mA + (i % 5);
      nodes.push(<PuffRing key={`cp${i}`} at={[p[0], 0.7, p[2]]} age={f - vf} n={5} r={0.45} s={1.25} life={12} />);
      nodes.push(<Puff key={`cq${i}`} at={[p[0], 1.1, p[2]]} age={f - vf} life={12} s={2.2} />);
      if (f >= vf + 3) continue;
      items.push({ pos: [p[0], p[1], p[2]], rot, pose, look: lookFor(i + 120, 0), scale: 1 });
      if (moving && p[1] < 0.05 && (Math.floor(fe * 0.55 + i * 1.3) % 6 === 0)) nodes.push(<Puff key={`dp${i}`} at={[q[0], 0.15, q[2]]} age={(fe * 0.55 * 3) % 18} life={18} s={0.5} color="#EBDDBE" />);
    }
  }

  // ================= beat 8: the scroll guy (also there for the end of beat 7, and frozen in beat 9)
  if (f >= S[6] && f < B.mA + 24) {
    const fe = Math.min(f, freeze);
    const un = seg(fe, S[7] + 6, S[7] + 38, (x) => x);
    let p = alive(restPose(), fe, 41, 0.6);
    const hold = seg(fe, S[7] - 6, S[7] + 6);
    p.armL = { sx: lerp(0, -1.25, hold), sz: lerp(0.08, 0.02, hold), twist: 0, elbow: lerp(-0.15, -0.5, hold) };
    p.armR = { ...p.armL };
    const look = seg(fe, S[7] + 30, S[7] + 40) * (1 - seg(fe, B.w.rule - 4, B.w.rule));
    p.headPitch = 0.35 * look;
    p.brow = 1 * look;
    p.mouth = look > 0.5 ? "wavy" : "smile";
    const stamped = fe >= B.w.rule;
    if (stamped) {
      p.mouth = "grin";
      p.browUp = 0.7;
      p.eyeWide = 1.25;
      p.headPitch = -0.1 + Math.max(0, Math.sin((fe - B.w.rule - 6) * 0.25)) * 0.2 * (fe < B.w.rule + 40 ? 1 : 0);
    }
    // beat 9: he lowers the scroll and turns to watch the run
    const turn = seg(fe, S[8] + 4, S[8] + 18);
    p = lerpPose(p, { ...p, armL: { sx: -0.6, sz: 0.1, twist: 0, elbow: -0.6 }, armR: { sx: -0.6, sz: 0.1, twist: 0, elbow: -0.6 } }, turn);
    const stamp = fe < B.w.rule ? 0 : 1 + 1.3 * Math.exp(-(fe - B.w.rule) / 2.2) * Math.cos((fe - B.w.rule) * 0.7);
    const kick = wobble(fe, B.w.rule, 0.06, 1.2, 5);
    // beat 9: he drops the scroll and runs after the others (frozen mid-run with them)
    const go = fe - (S[8] + 16);
    const runD = go > 0 ? 0.16 * Math.max(0, go - 5 * (1 - Math.exp(-go / 5))) : 0;
    const runK = seg(fe, S[8] + 12, S[8] + 20);
    if (runK > 0) p = lerpPose(p, runnerPose(fe * 0.42, 0.85), runK);
    const sc = 0.85;
    const vf = B.mA + 1;
    nodes.push(<PuffRing key="heraldgone" at={[K[0] - 0.6, 0.8, K[2] - runD]} age={f - vf} n={6} r={0.5} s={1.3} life={12} />);
    nodes.push(<Puff key="heraldgone2" at={[K[0] - 0.6, 1.2, K[2] - runD]} age={f - vf} life={12} s={2.6} />);
    if (f < vf + 3)
    nodes.push(
      <group key="scrollguy" position={[K[0] - 0.6 * runK, 0, K[2] - runD]} rotation={[0, angLerp(turn * 0.5, Math.PI, runK), 0]}>
        <Person o={SCROLL_GUY} pose={p} pos={[0, 0, 0]} rot={0} scale={sc} />
        {hold > 0.5 && turn < 0.5 && (
          <group position={[0, 1.22 + kick, 0.72]} rotation={[kick * 0.5, 0, 0]}>
            <Scroll unroll={un} drop={1.2} run={2.6} stamp={stamp} />
          </group>
        )}
      </group>,
    );
    if (fe >= B.w.rule && fe < B.w.rule + 18) nodes.push(<PuffRing key="stamp" at={[K[0] + 0.36, 0.85, K[2] + 0.85]} age={fe - B.w.rule} n={6} r={0.35} s={0.35} color="#FFF3D6" />);
  }

  // ================= beat 9: the king on the balcony; "1314"
  if (f >= S[7] && f < B.mB) {
    const sink = -26 * seg(f, B.mA + 1, B.mB - 7, easeInOut);
    const step = seg(f, S[8] + 2, kingF - 6, easeInOut);
    const raise = seg(f, kingF - 6, kingF + 6, easeOutBack);
    const p = alive(restPose(), f, 51, 0.5);
    p.armL = { sx: 0.25, sz: 0.55, twist: -1.2, elbow: -1.6 }; // hand on the hip
    p.armR = { sx: lerp(0.05, -0.15, raise), sz: lerp(0.1, 2.75, raise), twist: lerp(0, 1.57, raise), elbow: lerp(-0.2, -0.25, raise) };
    p.legL = { hip: Math.sin(step * Math.PI * 3) * 0.35 * (1 - step) , sz: 0.04, knee: 0.1 };
    p.legR = { hip: -Math.sin(step * Math.PI * 3) * 0.35 * (1 - step), sz: 0.04, knee: 0.1 };
    p.brow = -0.7 * raise;
    p.mouth = raise > 0.5 ? (f < kingF + 14 ? "o" : "flat") : "smile";
    p.mouthOpen = 0.35;
    p.headPitch = 0.12;
    const bz = CASTLE[2] + lerp(1.0, 2.15, step);
    nodes.push(<Person key="king" o={KING} pose={p} pos={[CASTLE[0], BALCONY_Y + sink, bz]} rot={0} scale={1.25} />);
    // "1314": a cloth banner unrolls from a rod above the keep, digits painted on it; at the morph it vanishes in a puff
    const gone = f >= B.mA + 3;
    const ban = seg(f, B.w.year - 12, B.w.year, easeOut);
    for (let q = 0; q < 5; q++) nodes.push(<Puff key={`bp${q}`} at={[CASTLE[0] - 2.0 + q * 1.0, 10.1 + (q % 2) * 0.4, CASTLE[2] + 1.8]} age={f - B.mA} life={13} s={2.8} color="#FFF6E6" />);
    if (ban > 0 && !gone) {
      const L = 1.75 * ban;
      nodes.push(
        <group key="banner" position={[CASTLE[0], 11.0, CASTLE[2] + 1.4]}>
          <Part geo={rbox(4.9, 0.16, 0.16, 0.06)} color={PAL.wood} />
          {[-1, 1].map((k2) => (
            <Part key={k2} geo={sphere(0.13, 10)} color={MPAL.gold} position={[k2 * 2.5, 0, 0]} />
          ))}
          <Part geo={box(4.3, L, 0.04)} color={MPAL.robe} position={[0, -L / 2, 0.02]} />
          <Part geo={box(4.3, Math.min(L, 0.1), 0.045)} color={MPAL.gold} position={[0, -0.12, 0.025]} />
          <Part geo={rbox(4.5, 0.14, 0.14, 0.06)} color={PAL.wood} position={[0, -L, 0.03]} />
          {ban >= 0.98 &&
            ["1", "3", "1", "4"].map((d, i) => (
              <group key={i} position={[(-1.5 + i * 1.0 + (d === "1" ? -0.25 : 0)) * 1.0, -0.92, 0.05]} scale={0.78 * popIn(f, B.w.year + i * 2)}>
                <Digit7 d={d} color="#FFF1D0" paint />
              </group>
            ))}
        </group>,
      );
    }
  }

  // ================= beats 10-13: the modern pitch (morphs in around the locked camera)
  const T9 = S[9];
  const mA = B.mA;
  const mB = B.mB;
  if (f >= mA) {
    const NX = 9;
    const NZ = 13;
    const x0 = K[0] - 9;
    const z0 = K[2] - 15;
    const w = 18 / NX;
    const d = 28.5 / NZ;
    for (let i = 0; i < NX; i++)
      for (let j = 0; j < NZ; j++) {
        const x = x0 + w * (i + 0.5);
        const z = z0 + d * (j + 0.5);
        // the turf rises out of the ground row by row, from the castle toward the camera (no flipping slabs)
        const t0 = lerp(mA + 4, mB - 4, j / (NZ - 1));
        const k = seg(f, t0, t0 + 3, easeOut);
        if (k <= 0) continue;
        nodes.push(<Part key={`tt${i}-${j}`} geo={box(w + 0.01, 0.08, d + 0.01)} color={j % 2 === 0 ? MPAL.turfA : MPAL.turfB} rough={0.9} position={[x, lerp(-0.1, 0.02, k), z]} />);
      }
    // white lines
    const ln = seg(f, mB - 7, mB, easeOut);
    if (ln > 0) {
      const lw = 0.12;
      const L = (key: string, cx: number, cz: number, sx: number, sz: number) => <Part key={key} geo={box(sx, 0.02, sz)} color="#FFFFFF" basic position={[cx, 0.075, cz]} scale={[ln, 1, ln]} shadow={false} />;
      nodes.push(L("l1", K[0] - 8.6, K[2] - 1, lw, 27.6));
      nodes.push(L("l2", K[0] + 8.6, K[2] - 1, lw, 27.6));
      nodes.push(L("l3", K[0], K[2] - 14.7, 17.3, lw));
      nodes.push(L("l4", K[0], CS[1], 17.3, lw));
      nodes.push(L("l5", K[0], K[2] - 11.2, 7, lw));
      nodes.push(L("l6", K[0] - 3.5, K[2] - 12.95, lw, 3.5));
      nodes.push(L("l7", K[0] + 3.5, K[2] - 12.95, lw, 3.5));
      nodes.push(<Part key="cc" geo={torusArc(2.2, 0.06, Math.PI * 2)} color="#FFFFFF" basic rotation={[-Math.PI / 2, 0, 0]} position={[CS[0], 0.075, CS[1]]} scale={[ln, ln, 1]} shadow={false} />);
      nodes.push(<Part key="cs" geo={circle(0.18, 14)} color="#FFFFFF" basic rotation={[-Math.PI / 2, 0, 0]} position={[CS[0], 0.08, CS[1]]} scale={ln} shadow={false} />);
    }
    // fence + floodlights + goal rise
    const rise = (k: number) => -5 * (1 - seg(f, mA + 4 + k, mA + 13 + k, (x) => easeOutBack(x, 1.1)));
    const fx = K[0] + 9.6;
    const fzB = K[2] - 15.6;
    const fence: React.ReactNode[] = [];
    for (let i = 0; i <= 12; i++) {
      const x = K[0] - 9.6 + i * 1.6;
      fence.push(<Part key={`fb${i}`} geo={rbox(0.12, 3.6, 0.12, 0.03)} color={MPAL.fence} position={[x, 1.8 + rise(Math.abs(i - 6) * 0.5), fzB]} />);
    }
    for (const sx of [-1, 1])
      for (let j = 0; j <= 18; j++) {
        const z = fzB + j * 1.6;
        fence.push(<Part key={`fs${sx}${j}`} geo={rbox(0.12, 3.6, 0.12, 0.03)} color={MPAL.fence} position={[K[0] + sx * 9.6, 1.8 + rise(j * 0.4), z]} />);
      }
    nodes.push(<group key="fence">{fence}</group>);
    for (const y of [0.9, 2.1, 3.5]) {
      nodes.push(<Part key={`rb${y}`} geo={box(19.3, 0.07, 0.07)} color={MPAL.fence} position={[K[0], y + rise(2), fzB]} shadow={false} />);
      for (const sx of [-1, 1]) nodes.push(<Part key={`rs${sx}${y}`} geo={box(0.07, 0.07, 30)} color={MPAL.fence} position={[fx * 0 + K[0] + sx * 9.6, y + rise(3), fzB + 15]} shadow={false} />);
    }
    nodes.push(<Part key="net" geo={box(19.3, 3.5, 0.02)} color={MPAL.fence} opacity={0.22} position={[K[0], 1.75 + rise(2), fzB]} shadow={false} />);
    const on = seg(f, mA + 10, mA + 14);
    for (const sx of [-1, 1]) nodes.push(<Floodlight key={`fl${sx}`} position={[K[0] + sx * 6.6, rise(4) * 2, K[2] - 17.2]} rotationY={-sx * 0.25} h={10} on={on} />);
    nodes.push(<group key="sgoal" scale={nz(seg(f, mA + 10, mA + 17, easeOutBack))} position={[K[0], 0, K[2] - 14.6]}><SmallGoal /></group>);
    // swap puffs where the old things vanish
    nodes.push(<PuffRing key="kpuff" at={[CASTLE[0], 1, CASTLE[2] + 3]} age={f - (mA + 3)} n={9} r={3} s={2} life={13} />);
  }

  // ---- the modern players: three wait (beat 11), the card (beat 12), four jog in (beat 13), alive hold at the end
  if (f >= mB - 16) {
    const S10 = S[10];
    const S11 = S[11];
    const passF = B.end - 44;
    for (let i = 0; i < 7; i++) {
      const o = MOD[i];
      const spot: V3 = [ROW_X[SLOT[i]], 0, ROW_Z + (i % 2) * 0.3];
      const seed = 60 + i * 3.3;
      let pos: V3 = [...spot];
      let rot = 0.05 - (spot[0] - FIN[0]) * 0.03;
      let pose = alive(restPose(), f, seed, 0.8);
      let scale = 0.9;
      let rightHand: React.ReactNode = undefined;
      let leftHand: React.ReactNode = undefined;
      if (i < 3) {
        // appears at full size inside a puff (never grows from a miniature); the puff is gone before beat 10
        const pf = mB - 15 + i * 2;
        nodes.push(<Puff key={`mp${i}`} at={[spot[0], 1.1, spot[2] + 0.3]} age={f - pf} life={11} s={2.4} />);
        nodes.push(<PuffRing key={`mq${i}`} at={[spot[0], 0.7, spot[2] + 0.3]} age={f - pf} n={5} r={0.45} s={1.2} life={10} />);
        if (f < pf + 3) continue;
        if (scale <= 0.001) continue;
        const act = seg(f, S10 - 6, S10 + 6);
        if (i === 0) {
          // checks his watch, then looks around
          leftHand = <Watch />;
          const chk = Math.max(0, Math.sin(((f - S10) / 46) * Math.PI)) * act;
          const look = (f - S10) % 92 > 46 ? 1 : 0;
          pose.armL = { sx: lerp(0.05, -1.45, chk), sz: lerp(0.1, -0.35, chk), twist: lerp(0, -0.6, chk), elbow: lerp(-0.2, -1.55, chk) };
          pose.headPitch = 0.38 * chk;
          pose.headYaw += -0.35 * chk + look * Math.sin(f * 0.05) * 0.4 * act;
          pose.brow = 0.8 * act;
          pose.mouth = chk > 0.4 ? "flat" : "smile";
        } else if (i === 1) {
          // keepy-uppy on his right foot
          const kp = act * (1 - seg(f, S[12] - 10, S[12]));
          const c = ((f - S10) * 0.075) % 1;
          const by = 0.35 + 1.5 * 4 * c * (1 - c) * kp;
          pose.legR = { hip: lerp(0, -0.75 * Math.max(0, 1 - c * 6) - 0.75 * Math.max(0, c * 6 - 5), kp), sz: 0.05, knee: 0.15 * kp };
          pose.headPitch = 0.25 * kp;
          pose.armL = { sx: -0.2, sz: 0.5 * kp, twist: 0, elbow: -0.4 };
          pose.armR = { sx: -0.2, sz: 0.5 * kp, twist: 0, elbow: -0.4 };
          // the ball: juggled, then under his foot, then passed once at the end
          const bx0 = spot[0] + 0.25;
          const bz0 = spot[2] + 0.55;
          let bp: V3 = [bx0, by * kp + 0.35 * (1 - kp), bz0];
          if (f >= passF) {
            const to: V3 = [ROW_X[5] + 0.2, 0.35, ROW_Z + 0.9];
            const u = seg(f, passF, passF + 24, easeOut);
            bp = [lerp(bx0, to[0], u), 0.35, lerp(bz0, to[2], u)];
            const kick = seg(f, passF - 6, passF, easeIn) * (1 - seg(f, passF + 2, passF + 10));
            pose.legR = { hip: lerp(0.4, -0.7, kick), sz: 0.25, knee: 0.3 };
            pose.twist = -0.3 * kick;
          }
          nodes.push(<ModernBall key="mball" position={bp} spin={f * 0.3} s={1} />);
        } else {
          // shrugs (where is everyone?)
          const sh = Math.max(0, Math.sin(((f - S10) / 40) * Math.PI)) * act;
          pose.shrug = sh;
          pose.armL = { sx: -0.35 * sh, sz: lerp(0.1, 0.75, sh), twist: lerp(0, -1.2, sh), elbow: lerp(-0.2, -1.4, sh) };
          pose.armR = { ...pose.armL };
          pose.headTilt += 0.25 * sh;
          pose.brow = sh;
          pose.mouth = sh > 0.4 ? "wavy" : "smile";
          pose.headYaw += Math.sin(f * 0.03) * 0.4 * act;
        }
        // beat 12: all three look up at the post
        const up = seg(f, S11 + 4, S11 + 14) * (1 - seg(f, S11 + 40, S11 + 52));
        pose.headPitch = lerp(pose.headPitch, -0.35, up);
        pose.browUp = Math.max(pose.browUp, up * 0.7);
      } else {
        // the joiners: jog in from the left edge behind the row, step into their spot
        const jf = B.joins[i - 3];
        const T = 44;
        const u = seg(f, jf - T, jf, (x) => x);
        if (u <= 0) continue;
        const path: Path = [
          [FIN[0] - 7.5, ROW_Z - 2.0],
          [spot[0] - 0.6, ROW_Z - 1.6],
          [spot[0], spot[2]],
        ];
        const total = Math.hypot(path[1][0] - path[0][0], path[1][1] - path[0][1]) + Math.hypot(path[2][0] - path[1][0], path[2][1] - path[1][1]);
        const e = u < 0.85 ? u / 0.85 * 0.92 : 0.92 + easeOut((u - 0.85) / 0.15) * 0.08;
        const a = along(path, e * total);
        pos = [a.x, 0, a.z];
        if (u < 1) {
          pose = lerpPose(alive(runnerPose((f - jf) * 0.42 + i, 0.6), f, seed, 0.4), pose, seg(u, 0.85, 1));
          rot = a.heading;
          pose.mouth = "grin";
        }
        const since = f - jf;
        if (since >= 0) {
          rot = angLerp(a.heading, 0.05 - (spot[0] - FIN[0]) * 0.03, seg(since, 0, 8));
          // arrival hop + wave
          pose.bob += Math.max(0, Math.sin((since / 10) * Math.PI)) * 0.12 * (since < 10 ? 1 : 0);
          const wv = since < 26 ? Math.sin((since / 26) * Math.PI) : 0;
          pose.armR = { sx: -0.1, sz: lerp(0.1, 2.5, wv), twist: 1.57 * wv, elbow: -0.5 + Math.sin(since * 0.6) * 0.3 * wv };
          pose.mouth = "grin";
        }
      }
      // the last ~1.5 s: everyone alive, bouncing on their toes, heads to the ball
      const idle = seg(f, B.end - 52, B.end - 40);
      if (idle > 0 && !(i === 1 && f >= passF - 6 && f < passF + 10)) {
        const b = Math.abs(Math.sin(f * 0.24 + i * 0.9));
        pose.bob += 0.05 * b * idle;
        pose.legL = { ...pose.legL, knee: pose.legL.knee + 0.12 * (1 - b) * idle };
        pose.legR = { ...pose.legR, knee: pose.legR.knee + 0.12 * (1 - b) * idle };
        pose.mouth = "grin";
      }
      nodes.push(<Person key={`mod${i}`} o={o} pose={pose} pos={pos} rot={rot} scale={scale} rightHand={rightHand} leftHand={leftHand} />);
    }
  }

  // ================= sky objects for the time-lapse (beat 4)
  const p4 = lapse(f, B);
  const q4 = dayPhase(p4);
  const sky: React.ReactNode[] = [];
  if (f >= S[3] - 4 && f < S[4] + 2 && p4 > 0 && p4 < 1) {
    // directions are relative to the camera's view yaw so they sit in the upper frame
    const c0 = sampleTrack(keys, S[3] + 30);
    const yaw0 = Math.atan2(c0.l[0] - c0.p[0], -(c0.l[2] - c0.p[2]));
    const dirAt = (az: number, el: number): V3 => {
      const a = yaw0 + (az * Math.PI) / 180;
      const e = (el * Math.PI) / 180;
      const R = 900;
      return [c0.p[0] + Math.sin(a) * Math.cos(e) * R, c0.p[1] + Math.sin(e) * R, c0.p[2] - Math.cos(a) * Math.cos(e) * R];
    };
    const sunSet = seg(q4, 0.0, 0.3, easeIn);
    if (sunSet < 1) sky.push(<SunDisc key="sun1" position={dirAt(lerp(5, 9, sunSet), lerp(10, -3, sunSet))} r={30} color={mixC("#FFE58A", "#FF9A4A", sunSet)} />);
    const mo = seg(q4, 0.26, 0.74, (x) => x);
    if (mo > 0 && mo < 1) sky.push(<Moon key="moon" position={dirAt(lerp(-11, 11, mo), -3 + Math.sin(mo * Math.PI) * 13)} r={22} />);
    const sunRise = seg(q4, 0.68, 1.0, easeOut);
    if (sunRise > 0) sky.push(<SunDisc key="sun2" position={dirAt(lerp(-9, -5, sunRise), lerp(-3, 10, sunRise))} r={30} color={mixC("#FF9A4A", "#FFE58A", sunRise)} />);
  }

  // ================= the land
  const land: React.ReactNode[] = [];
  land.push(<Part key="ground" geo={box(900, 0.2, 900)} color={MPAL.meadow} rough={0.95} position={[20, -0.1, -90]} />);
  if (showPitch) {
    // mowed stripes + white lines (trampled on "not": they shrink away and dirt patches appear)
    for (let j = 0; j < 8; j++) land.push(<Part key={`ps${j}`} geo={box(18, 0.02, 3.5)} color={j % 2 ? MPAL.pitchA : MPAL.pitchB} position={[0, 0.012, -14 + 3.5 * (j + 0.5)]} />);
    const segs: [number, number, number, number][] = [
      [0, -13.8, 17.8, 0.14],
      [0, 13.8, 17.8, 0.14],
      [0, 0, 17.8, 0.14],
      [-8.9, 0, 0.14, 27.6],
      [8.9, 0, 0.14, 27.6],
      [0, -10.5, 8, 0.14],
      [0, 10.5, 8, 0.14],
      [-4, -12.15, 0.14, 3.3],
      [4, -12.15, 0.14, 3.3],
      [-4, 12.15, 0.14, 3.3],
      [4, 12.15, 0.14, 3.3],
    ];
    segs.forEach(([x, z, sx, sz], i) => {
      const t = trample(x, z);
      if (t < 1) land.push(<Part key={`pl${i}`} geo={box(sx, 0.02, sz)} color="#FFFFFF" basic position={[x, 0.03, z]} scale={[sx > 1 ? 1 - t : 1, 1, sz > 1 ? 1 - t : 1]} shadow={false} opacity={1} />);
    });
    const tc = trample(0, 0);
    if (tc < 1) land.push(<Part key="pcc" geo={torusArc(2.6, 0.07, Math.PI * 2)} color="#FFFFFF" basic rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[1 - tc, 1 - tc, 1]} shadow={false} />);
    for (let i = 0; i < 14; i++) {
      const x = (hash(i * 3.1) - 0.5) * 16;
      const z = (hash(i * 5.7) - 0.5) * 26;
      const a = seg(f, floodAt(x, z) + 6, floodAt(x, z) + 16, easeOut);
      if (a > 0) land.push(<Part key={`dirt${i}`} geo={circle(1, 12)} color={MPAL.dirt} rotation={[-Math.PI / 2, 0, hash(i) * 3]} position={[x, 0.035, z]} scale={[a * (0.8 + hash(i * 2) * 0.8), a * (0.5 + hash(i * 9) * 0.5), 1]} shadow={false} />);
    }
    // two old-style goals at the ends (white posts)
    for (const s of [-1, 1])
      land.push(
        <group key={`og${s}`} position={[0, 0, s * 14]}>
          <Part geo={rbox(0.16, 2.3, 0.16, 0.04)} color="#FFFFFF" position={[-2.4, 1.15, 0]} />
          <Part geo={rbox(0.16, 2.3, 0.16, 0.04)} color="#FFFFFF" position={[2.4, 1.15, 0]} />
          <Part geo={rbox(4.96, 0.16, 0.16, 0.04)} color="#FFFFFF" position={[0, 2.3, 0]} />
        </group>,
      );
  }
  if (f < S[2] + 20) {
    // the near side of the pitch: a wooden rail, hay, trees (fills the lower frame of beat 1)
    for (let x = -13; x <= 13; x += 2.6) land.push(<Part key={`nr${x}`} geo={rbox(0.2, 1.1, 0.2, 0.05)} color={MPAL.timber} position={[x, 0.55, 17.5]} />);
    land.push(<Part key="nrr" geo={box(26.4, 0.16, 0.12)} color={PAL.wood} position={[0, 0.85, 17.5]} />);
    land.push(<Part key="nrr2" geo={box(26.4, 0.16, 0.12)} color={PAL.wood} position={[0, 0.45, 17.5]} />);
    [
      [-9, 21, 1.4],
      [-3.5, 24.5, 1.2],
      [4.5, 22, 1.5],
      [10, 25, 1.3],
      [-12, 27, 1.5],
      [0.5, 29, 1.6],
    ].forEach(([x, z, sc], i) => land.push(<RoundTree key={`nt${i}`} position={[x, 0, z]} frame={f} seed={i * 3 + 2} s={sc} />));
    land.push(<Haystack key="nh1" position={[-5.5, 0, 20]} s={1.1} />);
    land.push(<Haystack key="nh2" position={[7.5, 0, 19.5]} s={0.9} />);
    land.push(<Part key="npath" geo={box(3.4, 0.04, 30)} color={MPAL.road} position={[0, 0.02, 32]} shadow={false} />);
  }
  if (f < S[3] + 6) {
    for (const sd of [-1, 1]) {
      const vc = sd < 0 ? VL : VR;
      const gd = -sd;
      const seed = sd < 0 ? 1.3 : 4.7;
      villageHouses(vc, gd, seed).forEach((h, i) => land.push(<Cottage key={`v${seed}${i}`} position={[h.x, 0, h.z]} rotationY={h.rot} seed={h.seed} />));
      land.push(<Part key={`vg${seed}`} geo={circle(7.6, 28)} color={MPAL.road} rotation={[-Math.PI / 2, 0, 0]} position={[vc[0], 0.015, vc[1]]} shadow={false} />);
      land.push(<Part key={`vl${seed}`} geo={box(9, 0.03, 3.6)} color={MPAL.road} position={[vc[0] + gd * 9.5, 0.016, vc[1]]} shadow={false} />);
      // the well in the square
      land.push(
        <group key={`well${seed}`} position={[vc[0] - gd * 2.2, 0, vc[1] - 2.6]}>
          <Part geo={cyl(0.8, 0.85, 0.8, 14)} color={MPAL.stone} position={[0, 0.4, 0]} />
          <Part geo={rbox(0.12, 1.5, 0.12, 0.04)} color={MPAL.timber} position={[0.7, 1.15, 0]} />
          <Part geo={rbox(0.12, 1.5, 0.12, 0.04)} color={MPAL.timber} position={[-0.7, 1.15, 0]} />
          <group position={[0, 2.0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <Part geo={prismGeo(1.6, 0.6, 1.8)} color={MPAL.thatch} flat />
          </group>
        </group>,
      );
      land.push(<RoundTree key={`vt${seed}`} position={[vc[0] - gd * 9, 0, vc[1] - 6]} frame={f} seed={seed} s={1.3} />);
      land.push(<RoundTree key={`vt2${seed}`} position={[vc[0] - gd * 4, 0, vc[1] + 9]} frame={f} seed={seed + 2} s={1.1} />);
    }
  }
  if (f < S[5]) {
    // the road to the far goal, fields, trees along it
    land.push(<Part key="road" geo={box(3.4, 0.04, 140)} color={MPAL.road} position={[0, 0.025, -14 - 70 - 54]} shadow={false} />);
    land.push(<Fields key="fields" z0={-36} z1={-110} />);
    for (let z = -40; z > -112; z -= 13)
      for (const s of [-1, 1]) land.push(<RoundTree key={`rt${z}${s}`} position={[s * 4.4, 0, z + (s > 0 ? 6 : 0)]} frame={f} seed={z * s} s={1.0} />);
    land.push(<Haystack key="hs1" position={[-6, 0, -132]} />);
  }

  // ================= lights
  const lookP = cam.l;
  const camH = cam.p[1];
  const half = clamp(camH * 1.25, 16, 48);
  const sunDir: V3 = env.flood > 0.5 ? [-14, 46, 30] : [-30, 60, 40];

  return (
    <>
      <CameraRig frame={f} B={B} keys={keys} />
      <fog attach="fog" args={[env.fog, env.fogNear, env.fogFar]} />
      <hemisphereLight args={[env.hemiSky, env.hemiGround, env.hemiI]} />
      <SunRig target={lookP} dir={sunDir} intensity={env.sunI} color={env.sunColor} half={half} />
      {env.flood > 0.01 && <directionalLight position={[K[0] + 12, 14, K[2] - 18]} intensity={1.1 * env.flood} color="#FFF4DD" />}
      <GradientSky top={env.top} horizon={env.hor} />
      {sky}
      {land}
      {nodes}
      <Crowd items={items} cap={140} />
    </>
  );
};

// ---------------------------------------------------------------- 2D layers: the distance counter and the app post card
const DistanceCounter: React.FC<{ f: number; B: MBeats }> = ({ f, B }) => {
  const a = Math.min(B.w.five - 14, B.s[2] + 22);
  const show = seg(f, a, a + 6) * (1 - seg(f, B.s[3] - 4, B.s[3] + 4));
  if (show <= 0) return null;
  const v = 5 * easeOut(seg(f, a, B.w.five, (x) => x));
  const done = f >= B.w.five;
  const pulse = done ? 1 + 0.18 * Math.exp(-(f - B.w.five) / 4) * Math.cos((f - B.w.five) * 0.6) : 1;
  const txt = done ? "5" : Math.min(4.9, v).toFixed(1);
  return (
    <div style={{ position: "absolute", left: 0, top: 250, width: 1080, display: "flex", justifyContent: "center", opacity: show }}>
      <div
        dir="rtl"
        style={{
          fontFamily: "Changa",
          fontWeight: 800,
          fontSize: 168,
          lineHeight: 1,
          color: "#FFF6E6",
          padding: "18px 54px 26px",
          borderRadius: 48,
          background: "rgba(58,46,42,0.55)",
          textShadow: "0 8px 0 #B4502E, 0 16px 28px rgba(0,0,0,0.35)",
          transform: `scale(${pulse * lerp(0.85, 1, show)})`,
          display: "flex",
          gap: 28,
          alignItems: "baseline",
        }}
      >
        <span style={{ fontVariantNumeric: "tabular-nums", minWidth: done ? undefined : 230, textAlign: "center" }}>{txt}</span>
        <span>كم</span>
      </div>
    </div>
  );
};

/** "يوم 1" -> "يوم 2" during the beat-4 time-lapse (same look as the km counter). */
const DayCounter: React.FC<{ f: number; B: MBeats }> = ({ f, B }) => {
  const a = B.s[3] + 4;
  const show = seg(f, a, a + 6) * (1 - seg(f, B.s[4] - 6, B.s[4] + 2));
  if (show <= 0) return null;
  const day2 = Math.round(lerp(B.s[3] + 16, B.s[4] - 6, 0.5));
  const n = f >= day2 ? 2 : 1;
  const pulse = f >= day2 ? 1 + 0.18 * Math.exp(-(f - day2) / 4) * Math.cos((f - day2) * 0.6) : 1;
  return (
    <div style={{ position: "absolute", left: 0, top: 250, width: 1080, display: "flex", justifyContent: "center", opacity: show }}>
      <div
        dir="rtl"
        style={{
          fontFamily: "Changa",
          fontWeight: 800,
          fontSize: 150,
          lineHeight: 1,
          color: "#FFF6E6",
          padding: "18px 54px 26px",
          borderRadius: 48,
          background: "rgba(58,46,42,0.55)",
          textShadow: "0 8px 0 #B4502E, 0 16px 28px rgba(0,0,0,0.35)",
          transform: `scale(${pulse * lerp(0.85, 1, show)})`,
          display: "flex",
          gap: 28,
          alignItems: "baseline",
        }}
      >
        <span>يوم</span>
        <span>{n}</span>
      </div>
    </div>
  );
};

const PostCard: React.FC<{ f: number; B: MBeats; imgs: string[] }> = ({ f, B, imgs }) => {
  const t0 = B.s[11];
  if (f < t0 - 1) return null;
  const inS = clamp(springAt(f, t0, 0.42, 4.2), 0, 1.2);
  const op = seg(f, t0, t0 + 6);
  let active = 0;
  B.joins.forEach((j, i) => {
    if (f >= j) active = i + 1;
  });
  const lastJ = active > 0 ? B.joins[active - 1] : -999;
  const pulse = active > 0 ? 1 + 0.045 * Math.exp(-(f - lastJ) / 4) * Math.sin(((f - lastJ) / 8) * Math.PI) : 1;
  const s = lerp(0.72, 1, inS) * pulse;
  return (
    <div
      style={{
        position: "absolute",
        left: 110,
        top: 488,
        width: 860,
        transform: `translateY(-50%) scale(${s}) rotate(-2deg)`,
        transformOrigin: "50% 50%",
        opacity: op,
        filter: "drop-shadow(0 22px 30px rgba(0,0,0,0.45))",
      }}
    >
      {imgs.slice(0, 5).map((src, i) => {
        const prevJ = i === 0 ? -999 : B.joins[i - 1];
        const nextJ = i < 4 ? B.joins[i] : 1e9;
        const o = (i === 0 ? 1 : seg(f, prevJ, prevJ + 3)) * (1 - seg(f, nextJ + 2, nextJ + 3));
        return (
          <Img
            key={src + i}
            src={staticFile(src)}
            style={{ position: i === 0 ? "relative" : "absolute", left: 0, top: 0, width: 860, display: "block", opacity: o, borderRadius: 28 }}
          />
        );
      })}
    </div>
  );
};

const DebugOverlay: React.FC<{ info?: string }> = ({ info }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {info && <div style={{ position: "absolute", left: 20, top: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "26px monospace", padding: 8 }}>{info}</div>}
    <div style={{ position: "absolute", left: 520, top: 1250, width: 480, height: 550, border: "4px dashed #ff00aa" }} />
    <div style={{ position: "absolute", left: 110, top: 255, width: 860, height: 490, border: "3px dashed #ffee00" }} />
    <div style={{ position: "absolute", left: 0, top: 1100, width: 1080, height: 150, background: "rgba(0,170,255,0.12)", borderTop: "3px dashed #00aaff", borderBottom: "3px dashed #00aaff" }} />
  </AbsoluteFill>
);

export const FactMob: React.FC<FactMobProps> = ({ starts = MOB_STARTS, words = MOB_WORDS, durationSec = MOB_DURATION, postImgs = MOB_POST_IMGS, joins, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const B = useMemo(() => makeMobBeats(starts, words, joins, fps, durationSec), [starts, words, joins, fps, durationSec]);
  const kingF = useMemo(() => Math.round(lerp(B.s[8], B.s[9], 0.24)), [B]);
  const hops = useMemo(() => makeHops(B), [B]);
  const keys = useMemo(() => makeKeys(B, (f) => ballAt(f, B, hops, kingF).p[0]), [B, hops, kingF]);
  const frame = useCurrentFrame();
  const c = sampleTrack(keys, frame);
  return (
    <AbsoluteFill style={{ backgroundColor: DAY.top }}>
      <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 42, near: 0.1, far: 3000, position: [0, 21, 25] }} gl={{ antialias: true }}>
        <World B={B} keys={keys} hops={hops} kingF={kingF} />
      </ThreeCanvas>
      <DistanceCounter f={frame} B={B} />
      <DayCounter f={frame} B={B} />
      <PostCard f={frame} B={B} imgs={postImgs} />
      {debug && <DebugOverlay info={`f${frame} p ${c.p.map((v) => v.toFixed(1)).join(",")} l ${c.l.map((v) => v.toFixed(1)).join(",")}`} />}
    </AbsoluteFill>
  );
};
