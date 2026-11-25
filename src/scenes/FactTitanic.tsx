import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { Bench, DumbbellRack, Dumbbell, Treadmill, WallClock } from "./fact3d/props";
import { PAL, Part, box, circle, rbox, sphere } from "./fact3d/parts";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, lerp, seg, springAt } from "./fact3d/anim";
import { alive, lerpPose, runnerPose, walkPose, wavePose } from "./fact3d/acting";
import { Phone } from "./fact3d/Phone";
import {
  Arch,
  ArchFrame,
  BIKE_CRANK,
  BIKE_SEAT,
  Boater,
  Bowler,
  Bun,
  CAMEL_SADDLE_Y,
  Chandelier,
  Dial,
  DressFront,
  FlatCap,
  GoldCoin,
  GradientSky,
  HORSE_SADDLE_Y,
  Iceberg,
  LadyHat,
  MapScreen,
  MechCamel,
  MechHorse,
  ModernBike,
  ModernWall,
  Moon,
  Moustache,
  OldBike,
  OldClock,
  PEDAL_R,
  Plaque1912,
  ROW_SEAT_Y,
  Rower,
  Sea,
  Ship,
  Stars,
  SuitFront,
  TPAL,
  archGeo,
  wallGeo,
} from "./fact3d/titanic";
import { TBeats, TITANIC_DURATION, TITANIC_STARTS, TITANIC_WORDS, TitanicWords, makeTitanicBeats } from "./fact3d/titanicTiming";

// The gym on the Titanic (1912). ONE continuous camera journey, no cuts:
//  0 the ship at night · 1 up to the boat deck and in through a lit window · 2 the cycling machine + its dial
//  3 the electric rower + the mechanical horse · 4 "1912" + racing clock · 5 the whole gym working (wide, drifting)
//  6 horse / rower / bike light up on their words · 7 the instructor explains · 8 the room tilts, passengers leave, he stays
//  9 the room turns into a bright modern gym · 10 a man shows a map of gyms on his phone · 11 a friend joins, two coins
// From beat 9 the lower right of the frame stays open floor for the mascot (composited later).

export type FactTitanicProps = {
  starts?: number[];
  words?: Partial<TitanicWords>;
  durationSec?: number;
  debug?: boolean;
};

type V3 = [number, number, number];

// ---------------------------------------------------------------- room layout (room-local = world; floor y 0)
const RX = 6.5; // half width (x)
const RZ = 5; // half depth (z); the windows we fly through are on +z
const RH = 6.2;
const FRONT_ARCHES: Arch[] = [
  { cx: -3.6, w: 2.4, yb: 1.2, ys: 3.7 },
  { cx: 0, w: 2.4, yb: 1.2, ys: 3.7 },
  { cx: 3.6, w: 2.4, yb: 1.2, ys: 3.7 },
];
const DOOR_X = 0.4;
const BACK_HOLES: Arch[] = [
  { cx: -4.3, w: 2.2, yb: 1.3, ys: 3.5 },
  { cx: 4.5, w: 2.2, yb: 1.3, ys: 3.5 },
  { cx: DOOR_X, w: 1.8, yb: 0, ys: 3.3, rect: true },
];
// side walls: local x = -worldZ
const LEFT_HOLES: Arch[] = [{ cx: -1.6, w: 2.2, yb: 1.3, ys: 3.5 }];
const RIGHT_HOLES: Arch[] = [
  { cx: 1.6, w: 2.2, yb: 1.3, ys: 3.5 },
  { cx: -2.2, w: 2.2, yb: 1.3, ys: 3.5 },
];
const WT = 0.16; // wall thickness
const FRONT_GEO = wallGeo(RX * 2, RH, FRONT_ARCHES, WT);
const FRONT_SKIN_GEO = wallGeo(RX * 2 + 0.3, RH + 0.4, FRONT_ARCHES.map((a) => ({ ...a, yb: a.yb + 0.4, ys: a.ys + 0.4 })), 0.12);
const BACK_GEO = wallGeo(RX * 2, RH, BACK_HOLES.map((a) => ({ ...a, cx: -a.cx })), WT); // mirrored: the mesh is turned to face -z
const LEFT_GEO = wallGeo(RZ * 2, RH, LEFT_HOLES, WT);
const RIGHT_GEO = wallGeo(RZ * 2, RH, RIGHT_HOLES, WT);
const GLOW_GEOS = FRONT_ARCHES.map((a) => archGeo(a));

const BIKE_AT: V3 = [-4.0, 0, -1.0];
const BIKE_ROT = 0.5;
const DIAL_AT: V3 = [-5.15, 0, 0.35];
const DIAL_ROT = 2.44; // faces the rider (two-faced: the camera sees the other face)
const ROWER_AT: V3 = [-1.6, 0, -2.4];
const ROWER_ROT = 0.55;
const HORSE_AT: V3 = [1.6, 0, -2.6];
const HORSE_ROT = -0.45;
const CAMEL_AT: V3 = [4.2, 0, -2.9];
const CAMEL_ROT = -0.6;
const INSTR_POST: V3 = [3.0, 0, -0.9];
const INSTR_START: V3 = [5.6, 0, 1.6];
const LADY2_SPOT: [number, number] = [1.45, -0.2];
const MAN3_SPOT: [number, number] = [4.35, -1.35];
const MAN3_START: [number, number] = [5.7, -0.9];
// the modern room is bigger (the old walls sink away and the camera pulls back through where the front wall was)
const MX = 10.5;
const MZB = -8.2;
const MZF = 14;
const MH = 8.6;
const CHANDELIERS: V3[] = [
  [-2.6, RH, 0.4],
  [2.6, RH, 0.4],
];
// modern ending: people left/centre, lower-right floor stays open
const A_SPOT: [number, number] = [-1.75, 0.15];
const B_SPOT: [number, number] = [-0.72, -0.55];

/** machine-local -> world */
const toWorld = (at: V3, rot: number, l: V3): V3 => [at[0] + Math.cos(rot) * l[0] + Math.sin(rot) * l[2], at[1] + l[1], at[2] - Math.sin(rot) * l[0] + Math.cos(rot) * l[2]];

// ---------------------------------------------------------------- characters
type Outfit = { colors: BlockyColors; trousers?: string; skirt?: string; sleeves?: string; chest?: React.ReactNode; headgear?: React.ReactNode };
const SKIN = ["#EDBE97", "#D9A27A", "#C98A63", "#F1C9A6", "#B9805B"];
const suit = (jacket: string, skin: string, hair: string, hat: React.ReactNode, tie?: string, moustache = false): Outfit => ({
  colors: { skin, shirt: jacket, pants: jacket, shoes: "#2A2420", hair, face: PAL.ink },
  trousers: jacket,
  sleeves: jacket,
  chest: <SuitFront jacket={jacket} tie={tie} />,
  headgear: (
    <>
      {hat}
      {moustache && <Moustache color={hair} />}
    </>
  ),
});
const dress = (col: string, skin: string, hair: string, hat: React.ReactNode): Outfit => ({
  colors: { skin, shirt: col, pants: col, shoes: "#4A2E22", hair, face: PAL.ink },
  trousers: col,
  skirt: col,
  sleeves: col,
  chest: <DressFront />,
  headgear: (
    <>
      <Bun color={hair} />
      {hat}
    </>
  ),
});
const BIKER = suit("#3E4660", SKIN[0], "#5A3B28", <Bowler />, "#B23A2E", true);
const ROWER_LADY = dress("#7B5AA0", SKIN[3], "#6B3E26", <LadyHat flower={PAL.blush} />);
const HORSE_MAN = suit("#8A6B4B", SKIN[1], "#3A2A20", <FlatCap color="#6E5B45" />, "#2F5F5B");
const CAMEL_MAN = suit("#2F3E66", SKIN[2], "#2C211D", <Boater ribbon="#B23A2E" />, "#E3A93B", true);
const LADY2 = dress("#5E9CC4", SKIN[4], "#2C211D", <LadyHat color="#FFF6E6" flower={PAL.mustard} />);
const MAN3 = suit("#4F6B4A", SKIN[0], "#8A5A30", <Bowler color="#3A3028" />, "#E3A93B");
const INSTRUCTOR: Outfit = {
  colors: { skin: SKIN[3], shirt: "#F7F3EA", pants: "#F7F3EA", shoes: "#FFFFFF", hair: "#3B2A20", face: PAL.ink },
  trousers: "#F1ECE0",
  sleeves: "#F7F3EA",
  chest: (
    <group position={[0, 0.66, 0.252]}>
      <Part geo={box(0.34, 0.1, 0.012)} color="#E9E2D2" position={[0, 0.09, 0]} shadow={false} />
      <Part geo={box(0.86, 0.1, 0.012)} color={TPAL.oakDark} position={[0, -0.6, 0]} shadow={false} />
    </group>
  ),
  headgear: <Moustache color="#3B2A20" />,
};
const MOD_A: Outfit = { colors: { skin: SKIN[1], shirt: PAL.teal, pants: "#2E3A55", shoes: "#FFFFFF", hair: "#2C211D", face: PAL.ink } };
const MOD_B: Outfit = { colors: { skin: SKIN[2], shirt: PAL.terracotta, pants: "#3A3F4A", shoes: PAL.cream, hair: "#3B2A20", face: PAL.ink } };

const Person: React.FC<{ o: Outfit; pose: BlockyPose; pos: V3; rot: number; noBlob?: boolean; rightHand?: React.ReactNode; leftHand?: React.ReactNode; scale?: number }> = ({ o, pose, pos, rot, noBlob, rightHand, leftHand, scale }) => (
  <Blocky pose={pose} colors={o.colors} position={pos} rotationY={rot} trousers={o.trousers} skirt={o.skirt} sleeves={o.sleeves} chest={o.chest} headgear={o.headgear} noBlob={noBlob} rightHand={rightHand} leftHand={leftHand} scale={scale} />
);

// ---------------------------------------------------------------- poses
const HIP_Y = 0.92;
const LEG_L = 0.42;
/** Two-bone leg IK in the sagittal plane: ankle target (y, z) relative to the hip joint. */
const legIK = (ty: number, tz: number) => {
  const d = clamp(Math.hypot(ty, tz), 0.15, LEG_L * 2 - 0.005);
  const a0 = Math.atan2(-tz, -ty);
  const b = Math.acos(d / (2 * LEG_L));
  return { hip: a0 - b, knee: 2 * b };
};

const BIKER_Y = BIKE_SEAT[1] + 0.25 - HIP_Y; // rider origin height on the bike
/** Pedalling on a bike (bike-local frame: rider origin at BIKE_SEAT z). */
const pedalPose = (crank: number, effort: number): BlockyPose => {
  const hipY = BIKER_Y + HIP_Y;
  const leg = (c: number) => {
    const py = BIKE_CRANK[1] + PEDAL_R * Math.cos(c) + 0.1;
    const pz = BIKE_CRANK[2] + PEDAL_R * Math.sin(c) - 0.06;
    const k = legIK(py - hipY, pz - BIKE_SEAT[2]);
    return { hip: k.hip, sz: 0.04, knee: k.knee, toe: 0 };
  };
  const p = restPose();
  p.legL = leg(crank);
  p.legR = leg(crank + Math.PI);
  p.lean = 0.3 + effort * 0.06;
  p.armL = { sx: -1.12, sz: 0.04, twist: 0, elbow: -0.2 };
  p.armR = { sx: -1.12, sz: 0.04, twist: 0, elbow: -0.2 };
  p.twist = Math.sin(crank) * 0.05 * (0.5 + effort);
  p.roll = Math.sin(crank) * 0.03;
  p.bob = Math.abs(Math.sin(crank)) * 0.012;
  p.headPitch = -0.28;
  p.brow = -0.3 * effort;
  p.mouth = effort > 0.6 ? "grin" : "smile";
  p.blush = effort * 0.35;
  return p;
};

const ROWER_Y = ROW_SEAT_Y + 0.25 - HIP_Y;
const STRETCH_Z = 0.72;
/** Rowing stroke, t 0..1 (0 = catch). Returns pose + seat z + oar angle. */
const rowAt = (t: number) => {
  // drive 0..0.42 (legs, then back, then arms), recovery 0.42..1 (arms, back, legs)
  const legs = t < 0.42 ? easeOut(clamp(t / 0.3)) : 1 - easeInOut(clamp((t - 0.55) / 0.45));
  const back = t < 0.42 ? easeInOut(clamp((t - 0.1) / 0.25)) : 1 - easeInOut(clamp((t - 0.48) / 0.32));
  const arms = t < 0.42 ? easeInOut(clamp((t - 0.22) / 0.2)) : 1 - easeOut(clamp((t - 0.42) / 0.16));
  const seatZ = lerp(0.32, -0.22, legs);
  const hipY = ROWER_Y + HIP_Y;
  const foot = (x: number) => {
    const k = legIK(0.5 - hipY, STRETCH_Z - 0.08 - seatZ);
    return { hip: k.hip, sz: 0.08 + x, knee: k.knee, toe: 0 };
  };
  const p = restPose();
  p.legL = foot(0);
  p.legR = foot(0);
  p.lean = lerp(0.42, -0.28, back);
  const sx = lerp(-1.2, -0.42, arms) - p.lean * 0.4;
  const el = lerp(-0.08, -1.75, arms);
  p.armL = { sx, sz: 0.18, twist: 0, elbow: el };
  p.armR = { sx, sz: 0.18, twist: 0, elbow: el };
  p.headPitch = -p.lean * 0.6 - 0.05;
  p.mouth = back > 0.6 ? "grin" : "smile";
  p.brow = -0.25 * back;
  const oar = lerp(0.12, -0.72, legs * 0.55 + arms * 0.45);
  return { p, seatZ, oar };
};

/** Riding a mechanical horse / camel (straddling). */
const ridePose = (rock: number): BlockyPose => {
  const p = restPose();
  p.legL = { hip: -1.05, sz: 0.42, knee: 1.25, toe: -0.2 };
  p.legR = { hip: -1.05, sz: 0.42, knee: 1.25, toe: -0.2 };
  p.lean = -rock * 0.6 + 0.08;
  p.armL = { sx: -0.85, sz: 0.1, twist: 0, elbow: -0.85 };
  p.armR = { sx: -0.85, sz: 0.1, twist: 0, elbow: -0.85 };
  p.headPitch = rock * 0.4 - 0.08;
  p.mouth = "grin";
  p.browUp = 0.3;
  return p;
};

/** Standing with hands behind the back (calm, attentive). */
const postPose = (): BlockyPose => ({
  ...restPose(),
  armL: { sx: 0.35, sz: 0.12, twist: 0.4, elbow: -0.9 },
  armR: { sx: 0.35, sz: 0.12, twist: -0.4, elbow: -0.9 },
  legL: { hip: 0, sz: 0.07, knee: 0 },
  legR: { hip: 0, sz: 0.07, knee: 0 },
  lean: -0.03,
  headPitch: -0.05,
});

/** Explaining: the right arm points out to the side (`dir` -1..1 swings it), the left hand open. */
const explainPose = (f: number, dir: number, talk = 1): BlockyPose => {
  const p = postPose();
  p.armR = { sx: -0.55 - dir * 0.15, sz: 1.05 + Math.sin(f * 0.18) * 0.06, twist: 0, elbow: -0.35 };
  p.armL = { sx: -0.75, sz: 0.25, twist: -0.6, elbow: -1.05 + Math.sin(f * 0.21 + 1) * 0.15 * talk };
  p.twist = -dir * 0.22;
  p.headYaw = -dir * 0.35;
  p.mouth = Math.sin(f * 0.6) > 0.1 * (1 - talk) && talk > 0 ? "o" : "smile";
  p.mouthOpen = (0.15 + 0.15 * Math.abs(Math.sin(f * 0.47))) * talk;
  p.browUp = 0.3 + 0.2 * Math.sin(f * 0.13);
  p.lean = 0.03;
  return p;
};

// ---------------------------------------------------------------- walking
type Path = [number, number][];
const walkAt = (f: number, t0: number, path: Path, speed = 0.07) => {
  const t = Math.max(0, f - t0);
  const d = speed * Math.max(0, t - 6 * (1 - Math.exp(-t / 6)));
  let rest = d;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (rest <= L || i === path.length - 2) {
      const u = clamp(rest / L);
      // heading blends into the next leg near the corner
      let heading = Math.atan2(bx - ax, bz - az);
      if (i < path.length - 2 && rest > L - 0.4) {
        const [cx, cz] = path[i + 2];
        const h2 = Math.atan2(cx - bx, cz - bz);
        let dh = h2 - heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        heading += dh * clamp((rest - (L - 0.4)) / 0.8);
      }
      const total = path.reduce((s, _, k) => (k ? s + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]) : s), 0);
      return { x: lerp(ax, bx, u), z: lerp(az, bz, u), heading, phase: Math.min(d, total) * 5.6, moving: f >= t0 && d < total, done: d >= total, d, started: f >= t0, since: Math.max(0, (d - total) / speed) };
    }
    rest -= L;
  }
  const [x, z] = path[path.length - 1];
  return { x, z, heading: 0, phase: 0, moving: false, done: true, d, started: true, since: 0 };
};
const angLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

// ---------------------------------------------------------------- camera
type Key = { f: number; p: V3; l: V3; fov: number; still?: boolean };
/** Non-uniform Catmull-Rom (cubic Hermite with time-scaled tangents): velocity carries through every key, no cuts. */
const sampleTrack = (keys: Key[], f: number) => {
  const n = keys.length;
  if (f <= keys[0].f) {
    // before the first key: extrapolate along the first tangent (frame 0 is already moving)
    const a = keys[0];
    const b = keys[1];
    const t = (f - a.f) / (b.f - a.f);
    return { p: a.p.map((v, i) => v + (b.p[i] - v) * t) as V3, l: a.l.map((v, i) => v + (b.l[i] - v) * t) as V3, fov: a.fov };
  }
  if (f >= keys[n - 1].f) return { p: keys[n - 1].p, l: keys[n - 1].l, fov: keys[n - 1].fov };
  let i = 0;
  while (keys[i + 1].f < f) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(n - 1, i + 2)];
  const h = k2.f - k1.f;
  const t = (f - k1.f) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  const tan = (a: number, b: number, fa: number, fb: number) => (fb === fa ? 0 : (b - a) / (fb - fa));
  const comp = (get: (k: Key) => number) => {
    const m1 = k1.still ? 0 : i === 0 ? tan(get(k1), get(k2), k1.f, k2.f) : tan(get(k0), get(k2), k0.f, k2.f);
    const m2 = k2.still ? 0 : i + 2 >= n ? tan(get(k1), get(k2), k1.f, k2.f) : tan(get(k1), get(k3), k1.f, k3.f);
    return h00 * get(k1) + h10 * h * m1 + h01 * get(k2) + h11 * h * m2;
  };
  return {
    p: [0, 1, 2].map((j) => comp((k) => k.p[j])) as V3,
    l: [0, 1, 2].map((j) => comp((k) => k.l[j])) as V3,
    fov: comp((k) => k.fov),
  };
};

const tiltAt = (f: number, B: TBeats) => {
  const grow = seg(f, B.w.tilt, B.cut(9) + 4, (x) => Math.pow(x, 1.25)); // starts gently, keeps growing
  const level = seg(f, B.cut(9) + 2, B.cut(9) + 30, easeInOut); // the transformation rights the room
  return (10 * Math.PI) / 180 * grow * (1 - level);
};

/** share of the room's tilt the camera rolls with (the rest shows on screen as a tilted room) */
const CAM_TILT = 0.75;
const makeKeys = (B: TBeats): Key[] => {
  const S = B.s;
  const c = B.cut;
  const k = (f: number, p: V3, l: V3, fov: number, still = false): Key => ({ f, p, l, fov, still });
  // ending framing (two people upper-middle / left-centre, the lower right stays open floor) and the phone close-up
  const E: V3 = [1.4, 3.35, 7.5];
  const EL: V3 = [-0.4, 1.75, -0.8];
  const PC: V3 = [0.1, 2.75, 3.65];
  const PL: V3 = [-0.92, 1.72, 0.5];
  const toward = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  return [
    // 0: the ship at night from the bow quarter, already pushing in
    k(0, [150, 21, 128], [-4, 2, -8], 36),
    k(c(1), [84, 12, 98], [-3, 1.5, -3], 36),
    // 1: rise to the boat deck, line up with the left window, through it
    k(S[1] + 26, [16, 6.4, 46], [-3.8, 2.6, -2], 38),
    k(c(2) - 14, [-3.4, 2.95, 11], [-3.7, 2.45, -2.5], 42),
    k(c(2) - 4, [-3.55, 2.8, 5.9], [-3.8, 2.2, -2.2], 46),
    // 2: the bike + its dial, a small orbit
    k(c(2) + 8, [-3.4, 2.7, 4.2], [-4.4, 1.7, -1.2], 50),
    k(S[2] + 26, [-2.4, 2.75, 3.9], [-4.3, 1.7, -1.1], 50),
    // 3: glide from the rower to the horse
    k(c(3) + 6, [-1.5, 3.0, 4.3], [-1.3, 1.3, -2.1], 52),
    k(c(4) - 2, [0.9, 3.1, 4.4], [1.2, 1.45, -2.5], 52),
    // 4: up to "1912" on the back wall, a small push
    k(S[4] + 16, [0.55, 3.9, 4.3], [DOOR_X, 4.3, -5], 44),
    k(c(5), [DOOR_X, 4.05, 2.9], [DOOR_X, 4.3, -5], 44),
    // 5: pull back to the whole room from the right wall (the machines line up in depth), keep drifting
    // (first the right side: a passenger walks in and climbs on the horse; a sweep over the chandeliers to the left side;
    //  a low drift past the horse's gears)
    k(S[5] + 26, [-3.8, 5.4, 3.9], [2.3, 0.9, -2.7], 56),
    k(S[5] + 68, [-2.7, 5.1, 3.0], [1.9, 1.1, -2.7], 54),
    k(S[5] + 112, [5.6, 5.0, 2.9], [-1.8, 0.9, -2.0], 56),
    k(c(6) - 6, [4.0, 2.8, 1.5], [1.6, 1.2, -2.5], 50),
    // 6: horse -> rower -> bike, each on its word
    k(B.w.horse, [4.1, 3.4, 2.7], [1.5, 1.9, -2.6], 54),
    k(B.w.rower, [1.3, 3.2, 3.0], [-1.5, 1.2, -2.2], 52),
    k(B.w.bike, [-2.0, 3.2, 3.6], [-4.1, 1.6, -1.0], 52),
    k(c(7), [0.6, 3.3, 4.2], [1.2, 1.7, -1.0], 50),
    // 7: push in on the instructor
    k(S[7] + 14, [2.7, 3.2, 4.7], [3.0, 1.9, -0.9], 52),
    k(c(8), [2.9, 3.0, 4.0], [3.0, 1.9, -0.9], 50),
    // 8: back and up; the room tilts and the camera tilts with it
    k(B.w.tilt, [2.0, 2.05, 4.4], [2.4, 2.3, -1.4], 62),
    k(c(9), [1.4, 2.25, 4.6], [2.1, 2.4, -2.4], 66),
    // 9: pull back (the front wall has sunk) and settle on the ending by 23.3 s (soft ease-out)
    k(c(9) + 24, E, EL, 46, true),
    // a slow creep, then 10: a smooth push in on the phone, hold while the pins pop, ease back out for 11
    k(S[10] - 16, toward(E, PC, 0.04), toward(EL, PL, 0.04), 46, true),
    k(S[10] + 18, PC, PL, 46, true),
    k(S[11] - 24, toward(PC, E, -0.04), PL, 46, true),
    k(S[11] + 8, toward(E, PC, 0.06), toward(EL, PL, 0.06), 46, true),
    k(B.end, toward(E, PC, 0.11), toward(EL, PL, 0.1), 46),
  ];
};

const CameraRig: React.FC<{ frame: number; B: TBeats; keys: Key[] }> = ({ frame, B, keys }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const c = sampleTrack(keys, frame);
  camera.position.set(...c.p);
  camera.up.set(0, 1, 0);
  camera.lookAt(...c.l);
  camera.rotateZ(tiltAt(frame, B) * CAM_TILT);
  const near = frame < B.s[1] + 20 ? 1 : 0.05;
  if (camera.fov !== c.fov || camera.near !== near || camera.far !== 6000) {
    camera.fov = c.fov;
    camera.near = near;
    camera.far = 6000;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  return null;
};

// ---------------------------------------------------------------- small effects
const Puff: React.FC<{ at: V3; age: number; life?: number; s?: number; color?: string }> = ({ at: p0, age, life = 18, s = 1, color = "#FFFFFF" }) => {
  if (age < 0 || age > life) return null;
  const a = age / life;
  return <Part geo={sphere(0.25, 10)} color={color} rough={1} opacity={0.8 * (1 - a) * (1 - a)} position={[p0[0], p0[1] + a * 0.4, p0[2]]} scale={(0.6 + easeOut(a) * 1.6) * s} shadow={false} />;
};
const PuffRing: React.FC<{ at: V3; age: number; n?: number; r?: number; color?: string }> = ({ at: p0, age, n = 8, r = 0.9, color }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.5 + easeOut(clamp(age / 16)) * 0.8);
      return <Puff key={i} at={[p0[0] + Math.cos(a) * rr, p0[1] + (i % 2) * 0.3, p0[2] + Math.sin(a) * rr]} age={age - (i % 3)} s={0.9} color={color} />;
    })}
  </>
);
/** Warm glow disc on the floor + a soft column of light (machine lights up on its word). */
const FloorGlow: React.FC<{ at: V3; g: number; r?: number }> = ({ at: p0, g, r = 1.3 }) =>
  g > 0.01 ? (
    <>
      <Part geo={circle(r, 32)} color="#FFC766" basic opacity={0.45 * g} rotation={[-Math.PI / 2, 0, 0]} position={[p0[0], 0.03, p0[2]]} shadow={false} />
      <Part geo={circle(r * 1.5, 32)} color="#FFC766" basic opacity={0.18 * g} rotation={[-Math.PI / 2, 0, 0]} position={[p0[0], 0.025, p0[2]]} shadow={false} />
    </>
  ) : null;

/** 0 -> 1 pop with overshoot that settles (scale-pop in). */
const popIn = (f: number, t0: number) => (f < t0 ? 0 : clamp(springAt(f, t0, 0.55, 3.2), 0, 1.25));
/** 1 -> 0 with a small anticipation swell (scale-pop out). */
const popOut = (f: number, t0: number, dur = 9) => {
  if (f < t0) return 1;
  const t = (f - t0) / dur;
  if (t >= 1) return 0;
  return t < 0.3 ? 1 + 0.12 * Math.sin((t / 0.3) * Math.PI * 0.5) : 1.12 * (1 - easeIn((t - 0.3) / 0.7));
};
/** a little scale bounce after `wf` (lights-up beat) */
const bounceAt = (f: number, wf: number, amp = 0.13) => {
  const k = f - wf + 2;
  return k > 0 ? 1 + amp * Math.sin(k * 0.45) * Math.exp(-k / 7) : 1;
};
const glowAt = (f: number, wf: number, end: number) => seg(f, wf - 3, wf + 3, easeOut) * lerp(1, 0.35, seg(f, wf + 12, wf + 30)) * (1 - seg(f, end, end + 14));

// ---------------------------------------------------------------- the gym room (old + modern)
const FloorTiles: React.FC<{ f: number; B: TBeats }> = ({ f, B }) => {
  const NX = 10;
  const NZ = 8;
  const w = (RX * 2) / NX;
  const d = (RZ * 2) / NZ;
  const t0 = B.cut(9);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NZ; j++) {
      const x = -RX + w * (i + 0.5);
      const z = -RZ + d * (j + 0.5);
      const dist = Math.hypot(x - BIKE_AT[0], z - BIKE_AT[2]);
      const k = seg(f, t0 + dist * 0.85, t0 + dist * 0.85 + 10, easeInOut);
      const modern = k > 0.5;
      const alt = (i + j) % 2 === 0;
      const color = modern ? (alt ? TPAL.modernFloorA : TPAL.modernFloorB) : alt ? TPAL.floorA : TPAL.floorB;
      out.push(<Part key={`${i}-${j}`} geo={rbox(w - 0.03, 0.08, d - 0.03, 0.02)} color={color} rough={modern ? 0.8 : 0.28} position={[x, -0.04 + Math.sin(k * Math.PI) * 0.25, z]} rotation={[k * Math.PI, 0, 0]} />);
    }
  return <>{out}</>;
};

/** Raised oak panels with a gold rail (wainscot), on a wall's inner face; `segs` are [x0, x1] solid runs (wall-local x). */
const Panelling: React.FC<{ segs: [number, number][]; z: number; len: number }> = ({ segs, z, len }) => (
  <group>
    {segs.map(([a, b], i) => {
      const w = b - a;
      const n = Math.max(1, Math.round(w / 1.3));
      const pw = w / n;
      return (
        <group key={i}>
          {Array.from({ length: n }, (_, j) => (
            <React.Fragment key={j}>
              <Part geo={rbox(pw - 0.22, 0.85, 0.05, 0.03)} color={TPAL.oakLight} position={[a + pw * (j + 0.5), 0.6, z]} shadow={false} />
              <Part geo={rbox(pw - 0.22, 2.2, 0.05, 0.03)} color={TPAL.oakLight} position={[a + pw * (j + 0.5), 3.0, z]} shadow={false} />
            </React.Fragment>
          ))}
        </group>
      );
    })}
    <Part geo={box(len, 0.1, 0.07)} color={TPAL.brass} position={[0, 1.2, z + 0.01]} shadow={false} />
    <Part geo={box(len, 0.5, 0.06)} color={TPAL.plaster} position={[0, RH - 0.55, z]} shadow={false} />
    <Part geo={box(len, 0.12, 0.12)} color={TPAL.brass} position={[0, RH - 0.85, z + 0.02]} shadow={false} />
  </group>
);

const OldWalls: React.FC<{ sink: (wall: number) => number; glow: number }> = ({ sink, glow }) => {
  const oak = { color: TPAL.oak, rough: 0.5 };
  const yb = sink(0);
  const yl = sink(1);
  const yr = sink(2);
  return (
    <group>
      <group position={[0, sink(3), 0]}>
      {/* front wall (we fly in through its left window) + its white outside skin + the warm glow seen from the sea */}
      <mesh geometry={FRONT_GEO} position={[0, 0, RZ - WT]}>
        <meshStandardMaterial color={oak.color} roughness={0.5} />
      </mesh>
      <mesh geometry={FRONT_SKIN_GEO} position={[0, -0.4, RZ]}>
        <meshStandardMaterial color={TPAL.white} roughness={0.6} />
      </mesh>
      {FRONT_ARCHES.map((a, i) => (
        <React.Fragment key={i}>
          <ArchFrame a={a} z={RZ - WT / 2} />
          {glow > 0.01 && (
            <mesh geometry={GLOW_GEOS[i]} position={[0, 0, RZ + 0.14]}>
              <meshBasicMaterial color="#FFD27A" transparent opacity={glow} depthWrite={false} toneMapped={false} />
            </mesh>
          )}
        </React.Fragment>
      ))}
      </group>
      {/* back wall: two arched windows, the door, the 1912 plaque and the clock are mounted on it */}
      <group position={[0, yb, 0]}>
        <mesh geometry={BACK_GEO} position={[0, 0, -RZ]} rotation={[0, Math.PI, 0]}>
          <meshStandardMaterial color={oak.color} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        <Panelling
          len={RX * 2}
          z={-RZ + 0.03}
          segs={[
            [-RX, -5.4],
            [-3.2, DOOR_X - 0.9 - 0.15],
            [DOOR_X + 0.9 + 0.15, 3.4],
            [5.6, RX],
          ]}
        />
        {BACK_HOLES.filter((a) => !a.rect).map((a, i) => (
          <ArchFrame key={i} a={a} z={-RZ + 0.08} />
        ))}
        {/* door frame + a dark corridor behind it */}
        <Part geo={rbox(0.18, 3.45, 0.24, 0.04)} color={TPAL.brass} position={[DOOR_X - 0.98, 1.7, -RZ + 0.05]} shadow={false} />
        <Part geo={rbox(0.18, 3.45, 0.24, 0.04)} color={TPAL.brass} position={[DOOR_X + 0.98, 1.7, -RZ + 0.05]} shadow={false} />
        <Part geo={rbox(2.2, 0.2, 0.26, 0.04)} color={TPAL.brass} position={[DOOR_X, 3.4, -RZ + 0.05]} shadow={false} />
        <Part geo={box(2.0, 3.4, 0.05)} color="#3A2618" position={[DOOR_X, 1.7, -RZ - 2.6]} shadow={false} />
        {[-1, 1].map((k) => (
          <Part key={k} geo={box(0.05, 3.4, 2.6)} color="#4A3020" position={[DOOR_X + k * 1.0, 1.7, -RZ - 1.3]} shadow={false} />
        ))}
        <Part geo={box(2.0, 0.05, 2.6)} color="#2E1E14" position={[DOOR_X, 3.4, -RZ - 1.3]} shadow={false} />
        <Part geo={box(2.0, 0.05, 2.6)} color="#5A3A24" position={[DOOR_X, 0.0, -RZ - 1.3]} shadow={false} />
        {/* the open door leaf */}
        <Part geo={rbox(0.1, 3.2, 1.7, 0.03)} color={TPAL.oakDark} position={[DOOR_X + 0.92, 1.62, -RZ + 0.9]} shadow={false} />
      </group>
      {/* left + right walls */}
      <group position={[0, yl, 0]}>
        <mesh geometry={LEFT_GEO} position={[-RX - WT, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <meshStandardMaterial color={oak.color} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        <group position={[-RX + 0.03, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <Panelling
            len={RZ * 2}
            z={0}
            segs={[
              [-RZ, -2.9],
              [-0.3, RZ],
            ]}
          />
          {LEFT_HOLES.map((a, i) => (
            <ArchFrame key={i} a={a} z={0.05} />
          ))}
        </group>
      </group>
      <group position={[0, yr, 0]}>
        <mesh geometry={RIGHT_GEO} position={[RX, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <meshStandardMaterial color={oak.color} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        <group position={[RX - 0.03, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <Panelling
            len={RZ * 2}
            z={0}
            segs={[
              [-RZ, -2.9],
              [-0.5, 0.5],
              [3.3, RZ],
            ]}
          />
          {RIGHT_HOLES.map((a, i) => (
            <ArchFrame key={i} a={{ ...a, cx: -a.cx }} z={0.05} />
          ))}
        </group>
      </group>
    </group>
  );
};

const ModernWalls: React.FC<{ f: number; rise: (wall: number) => number }> = ({ f, rise }) => (
  <group>
    <group position={[0, rise(0), MZB - 0.1]}>
      <ModernWall w={MX * 2 + 0.4} h={MH} windows={[{ cx: -5.2, w: 3.2 }, { cx: 0.2, w: 3.2 }, { cx: 5.6, w: 3.2 }]} frame={f} />
    </group>
    <group position={[-MX - 0.1, rise(1), (MZF + MZB) / 2]} rotation={[0, Math.PI / 2, 0]}>
      <ModernWall w={MZF - MZB + 0.4} h={MH} windows={[{ cx: 3.5, w: 3.4 }, { cx: -3.5, w: 3.4 }]} frame={f} />
    </group>
    <group position={[MX + 0.1, rise(2), (MZF + MZB) / 2]} rotation={[0, -Math.PI / 2, 0]}>
      <ModernWall w={MZF - MZB + 0.4} h={MH} windows={[{ cx: -3.5, w: 3.4 }, { cx: 3.5, w: 3.4 }]} frame={f} />
    </group>
    <group position={[0, rise(2), MZF + 0.1]} rotation={[0, Math.PI, 0]}>
      <ModernWall w={MX * 2 + 0.4} h={MH} windows={[]} frame={f} />
    </group>
  </group>
);

// ---------------------------------------------------------------- world
/** First frame (from the transformation on) after which the instructor's post stays outside the camera frame. */
const instructorOutFrame = (B: TBeats, keys: Key[]) => {
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 100);
  const pts = [0, 1.4, 2.8].flatMap((y) => [-0.6, 0.6].map((dx) => new THREE.Vector3(INSTR_POST[0] + dx, y, INSTR_POST[2])));
  const visible = (f: number) => {
    const c = sampleTrack(keys, f);
    cam.position.set(...c.p);
    cam.up.set(0, 1, 0);
    cam.lookAt(...c.l);
    cam.rotateZ(tiltAt(f, B) * CAM_TILT);
    cam.fov = c.fov;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    return pts.some((p) => {
      const q = p.clone().project(cam);
      return Math.abs(q.x) < 1.04 && Math.abs(q.y) < 1.04 && q.z < 1;
    });
  };
  let last = B.cut(9);
  for (let f = B.cut(9); f < B.cut(9) + 90; f++) if (visible(f)) last = f + 1;
  return last;
};

const World: React.FC<{ B: TBeats; keys: Key[] }> = ({ B, keys }) => {
  const instrOut = useMemo(() => instructorOutFrame(B, keys), [B, keys]);
  const f = useCurrentFrame();
  const S = B.s;
  const T9 = B.cut(9);
  const tilt = tiltAt(f, B);
  const inside = seg(f, S[1] + 18, B.cut(2) - 2, easeInOut);
  const day = seg(f, T9 + 2, T9 + 36, easeInOut);
  const modernOn = f >= T9;

  // ---------- lighting (a pure function of the frame)
  const hemiSky = new THREE.Color("#9FB3E6").lerp(new THREE.Color("#FFE8C6"), inside).lerp(new THREE.Color("#EAF5FF"), day);
  const hemiGround = new THREE.Color("#26335E").lerp(new THREE.Color("#8A5A3A"), inside).lerp(new THREE.Color("#E7D4AE"), day);
  const hemiI = lerp(1.55, 1.3, inside) + day * 0.55;
  const skyTop = new THREE.Color(TPAL.nightTop).lerp(new THREE.Color(TPAL.dayTop), day).getStyle();
  const skyHor = new THREE.Color(TPAL.nightHorizon).lerp(new THREE.Color(TPAL.dayHorizon), day).getStyle();

  // ---------- machines
  let crank = 0;
  {
    // integrate the crank so speed changes never jump the pedals
    const stopAt = S[7] + 6;
    const sp = (ff: number) => (ff < B.cut(2) ? 0.2 : ff < S[3] ? 0.3 : ff < stopAt ? 0.24 : 0.24 * Math.exp(-(ff - stopAt) / 18));
    for (let i = 0; i < f; i++) crank += sp(i);
  }
  const bikerOn = f < S[7] + 8;
  const dialAngle = crank * 0.06 + seg(f, B.cut(2), S[3], easeInOut) * 1.2;
  const rowT = ((f + 12) % 44) / 44;
  const rowingOn = f < B.w.bike - 4;
  const row = rowAt(rowingOn ? rowT : 0.0);
  const rowWheel = (rowingOn ? f : B.w.bike - 4) * 0.25;
  const gearA = f * 0.07;

  // horse: rocks by itself from the start, eases still for the mount, rocks with the rider, still once he is gone
  const HMOUNT = S[5] + 68;
  const HDIS = B.w.rower + 12;
  const horseAmp = (() => {
    const pre = 1 - seg(f, HMOUNT - 14, HMOUNT - 4);
    const post = seg(f, HMOUNT + 12, HMOUNT + 22) * (1 - seg(f, HDIS - 10, HDIS));
    const after = seg(f, HDIS + 16, HDIS + 40) * 0.35;
    return Math.max(pre, post, after);
  })();
  const horseRock = Math.sin(f * 0.16) * 0.13 * horseAmp;
  const horseBounce = Math.abs(Math.sin(f * 0.16)) * 0.05 * horseAmp;
  const CDIS = B.w.horse + 22;
  const camelAmp = 1 - seg(f, CDIS - 10, CDIS);
  const camelRock = Math.sin(f * 0.12 + 1) * 0.1 * camelAmp;
  const camelBounce = Math.abs(Math.sin(f * 0.12 + 1)) * 0.06 * camelAmp;

  // lights up on the words (beat 6)
  const g6end = B.cut(7) + 6;
  const gH = glowAt(f, B.w.horse, g6end);
  const gR = glowAt(f, B.w.rower, g6end);
  const gB = glowAt(f, B.w.bike, g6end);
  const bH = bounceAt(f, B.w.horse);
  const bR = bounceAt(f, B.w.rower);
  const bB = bounceAt(f, B.w.bike);

  // the clock races during beat 4
  let minute = 0.4;
  for (let i = 0; i < f; i++) minute += 0.004 + 0.55 * seg(i, B.cut(4), S[4] + 14, easeIn) * (1 - seg(i, B.cut(5) - 6, B.cut(5) + 16, easeOut));
  const hour = 2.1 + minute / 12;
  const clockBlur = 0.6 * seg(f, S[4] + 4, S[4] + 14) * (1 - seg(f, B.cut(5) - 6, B.cut(5) + 6));
  const pops = [0, 1, 2, 3].map((i) => popIn(f, B.cut(4) + 2 + i * 4));

  // ---------- transformation (beat 9)
  // walls: 0 back, 1 left, 2 right, 3 front (the front one goes first: the camera pulls back through it)
  const sinkOld = (w: number) => (w === 3 ? -6.8 * seg(f, T9 - 16, T9 + 2, easeIn) : -6.8 * seg(f, T9 + 22 + w * 4, T9 + 42 + w * 4, easeIn));
  const riseNew = (w: number) => -(MH + 0.4) * (1 - seg(f, T9 + 4 + w * 4, T9 + 30 + w * 4, (x) => easeOutBack(x, 1.1)));
  const chandUp = seg(f, T9 + 2, T9 + 20, easeIn) * 6;
  const pendants = popIn(f, T9 + 26);
  const oldBikeS = popOut(f, T9 + 8, 10);
  const newBikeS = popIn(f, T9 + 16);
  const oldOut = (i: number) => popOut(f, T9 + 4 + i * 3, 9);
  const newIn = (i: number) => popIn(f, T9 + 22 + i * 4);

  // ---------- people
  const people: React.ReactNode[] = [];
  const DOOR_IN: Path = [
    [DOOR_X, -6.6],
    [DOOR_X, -3.7],
  ];
  const exitPath = (x: number, z: number, via?: [number, number]): Path => [[x, z], ...(via ? [via] : []), [DOOR_X, -3.6], [DOOR_X, -6.8]];
  const gone = (z: number) => z < -6.0;

  // the cyclist (bowler hat): pedals beats 0-7, gets off and leaves early in beat 7
  {
    const e = f >= B.cut(2) && f < S[3] + 10 ? 1 : 0.55;
    const seatW: V3 = toWorld(BIKE_AT, BIKE_ROT, [0, BIKER_Y, BIKE_SEAT[2]]);
    const DIS = S[7] + 8;
    if (bikerOn || f < DIS + 12) {
      let pose = alive(pedalPose(crank, e), f, 1.1, 0.35);
      // looks at his dial in beat 2, proud brows
      const lookDial = seg(f, B.cut(2) + 10, B.cut(2) + 18) * (1 - seg(f, S[3] - 6, S[3] + 2));
      pose.headYaw = lerp(pose.headYaw, 0.55, lookDial);
      pose.eyeX = lerp(pose.eyeX, 1, lookDial);
      pose.browUp = lookDial * 0.7;
      pose.headPitch = lerp(pose.headPitch, -0.15, lookDial);
      let pos = seatW;
      let rot = BIKE_ROT;
      if (f >= DIS) {
        const k = seg(f, DIS, DIS + 12, easeInOut);
        const stand = toWorld(BIKE_AT, BIKE_ROT, [0.9, 0, 0.3]);
        pos = [lerp(seatW[0], stand[0], k), lerp(seatW[1], 0, k) + Math.sin(k * Math.PI) * 0.35, lerp(seatW[2], stand[2], k)];
        pose = lerpPose(pose, alive(restPose(), f, 1.1), k);
        rot = angLerp(BIKE_ROT, 1.2, k);
      }
      people.push(<Person key="biker" o={BIKER} pose={pose} pos={pos} rot={rot} noBlob={f < DIS + 8} />);
    } else {
      const stand = toWorld(BIKE_AT, BIKE_ROT, [0.9, 0, 0.3]);
      const w = walkAt(f, DIS + 12, exitPath(stand[0], stand[2], [-1.2, -0.2]), 0.085);
      if (!gone(w.z)) people.push(<Person key="biker" o={BIKER} pose={alive(walkPose(w.phase, 1), f, 1.1, 0.4)} pos={[w.x, 0, w.z]} rot={w.heading} />);
    }
  }
  // the rowing lady: rows beats 0-6, gets off once the camera has moved on to the bike
  {
    const DIS = B.w.bike - 4;
    const seat = (sz: number) => toWorld(ROWER_AT, ROWER_ROT, [0, ROWER_Y, sz]);
    if (f < DIS + 12) {
      let pose = alive(row.p, f, 2.2, 0.3);
      let pos = seat(row.seatZ);
      let rot = ROWER_ROT;
      // she glances at the horse that rocks by itself (beat 3)
      const glance = seg(f, S[3] + 8, S[3] + 14) * (1 - seg(f, S[3] + 30, S[3] + 36));
      pose.headYaw += glance * -0.5;
      pose.eyeX = lerp(pose.eyeX, -1, glance);
      pose.browUp = Math.max(pose.browUp, glance * 0.8);
      if (f >= DIS) {
        const k = seg(f, DIS, DIS + 12, easeInOut);
        const st = toWorld(ROWER_AT, ROWER_ROT, [0.8, 0, 0.2]);
        const s0 = seat(row.seatZ);
        pos = [lerp(s0[0], st[0], k), lerp(s0[1], 0, k) + Math.sin(k * Math.PI) * 0.3, lerp(s0[2], st[2], k)];
        pose = lerpPose(pose, alive(restPose(), f, 2.2), k);
        rot = angLerp(ROWER_ROT, 2.6, k);
      }
      people.push(<Person key="rower" o={ROWER_LADY} pose={pose} pos={pos} rot={rot} noBlob={f < DIS + 8} />);
    } else {
      const st = toWorld(ROWER_AT, ROWER_ROT, [0.8, 0, 0.2]);
      const w = walkAt(f, DIS + 12, exitPath(st[0], st[2]), 0.075);
      if (!gone(w.z)) people.push(<Person key="rower" o={ROWER_LADY} pose={alive(walkPose(w.phase, 0.8), f, 2.2, 0.4)} pos={[w.x, 0, w.z]} rot={w.heading} />);
    }
  }
  // the camel rider: rides beats 0-7
  const camelRider: React.ReactNode = (() => {
    if (f < CDIS) {
      const p = alive(ridePose(camelRock), f, 3.3, 0.35);
      p.headYaw += Math.sin(f * 0.03) * 0.2;
      return <Blocky pose={p} colors={CAMEL_MAN.colors} position={[0, CAMEL_SADDLE_Y - 1.6 + 0.25 - HIP_Y, 0.22]} trousers={CAMEL_MAN.trousers} sleeves={CAMEL_MAN.sleeves} chest={CAMEL_MAN.chest} headgear={CAMEL_MAN.headgear} noBlob />;
    }
    return null;
  })();
  {
    const st = toWorld(CAMEL_AT, CAMEL_ROT, [-0.95, 0, 0.3]);
    if (f >= CDIS && f < CDIS + 14) {
      const k = seg(f, CDIS, CDIS + 14, easeInOut);
      const s0 = toWorld(CAMEL_AT, CAMEL_ROT, [0, 1.6 + CAMEL_SADDLE_Y - 1.6 + 0.25 - HIP_Y, 0.22]);
      const pos: V3 = [lerp(s0[0], st[0], k), lerp(s0[1], 0, k) + Math.sin(k * Math.PI) * 0.4, lerp(s0[2], st[2], k)];
      people.push(<Person key="camel" o={CAMEL_MAN} pose={lerpPose(ridePose(0), restPose(), k)} pos={pos} rot={angLerp(CAMEL_ROT, -2.4, k)} noBlob={k < 0.7} />);
    } else if (f >= CDIS + 14) {
      const w = walkAt(f, CDIS + 14, exitPath(st[0], st[2]), 0.09);
      if (!gone(w.z)) people.push(<Person key="camel" o={CAMEL_MAN} pose={alive(walkPose(w.phase, 1), f, 3.3, 0.4)} pos={[w.x, 0, w.z]} rot={w.heading} />);
    }
  }
  // the horse man: walks in during beat 5, mounts, rides, leaves in beat 7
  let horseRider: React.ReactNode = null;
  {
    const IN = S[5] + 18;
    const side: V3 = toWorld(HORSE_AT, HORSE_ROT, [-1.0, 0, 0.1]);
    const path: Path = [...DOOR_IN, [side[0] + 0.3, -2.9], [side[0], side[2]]];
    const saddleW = toWorld(HORSE_AT, HORSE_ROT, [0, 1.3 + HORSE_SADDLE_Y - 1.3 + 0.25 - HIP_Y, -0.05]);
    if (f >= IN && f < HMOUNT) {
      const w = walkAt(f, IN, path, 0.07);
      let pose = alive(walkPose(w.phase, w.done ? 0 : 1), f, 4.4, 0.5);
      let rot = w.heading;
      if (w.done) {
        rot = HORSE_ROT + Math.PI / 2;
        pose.headYaw = -0.3;
        pose.browUp = 0.5;
        pose.mouth = "grin";
      }
      // anticipation crouch before the hop
      const crouch = seg(f, HMOUNT - 8, HMOUNT, easeOut);
      pose.legL = { ...pose.legL, hip: pose.legL.hip - crouch * 0.4, knee: pose.legL.knee + crouch * 0.8 };
      pose.legR = { ...pose.legR, hip: pose.legR.hip - crouch * 0.4, knee: pose.legR.knee + crouch * 0.8 };
      pose.bob -= crouch * 0.15;
      pose.armL = { ...pose.armL, sx: -crouch * 0.5 };
      pose.armR = { ...pose.armR, sx: -crouch * 0.5 };
      people.push(<Person key="horse" o={HORSE_MAN} pose={pose} pos={[w.x, 0, w.z]} rot={rot} />);
    } else if (f >= HMOUNT && f < HMOUNT + 12) {
      const k = seg(f, HMOUNT, HMOUNT + 12, easeOut);
      const pos: V3 = [lerp(side[0], saddleW[0], k), lerp(0, saddleW[1], k) + Math.sin(k * Math.PI) * 0.6, lerp(side[2], saddleW[2], k)];
      people.push(<Person key="horse" o={HORSE_MAN} pose={lerpPose(restPose(), ridePose(0), k)} pos={pos} rot={angLerp(HORSE_ROT + Math.PI / 2, HORSE_ROT, k)} noBlob />);
    } else if (f >= HMOUNT + 12 && f < HDIS) {
      const p = alive(ridePose(horseRock), f, 4.4, 0.35);
      p.squash = 1 + Math.sin(f * 0.32) * 0.015;
      horseRider = <Blocky pose={p} colors={HORSE_MAN.colors} position={[0, HORSE_SADDLE_Y - 1.3 + 0.25 - HIP_Y, -0.05]} trousers={HORSE_MAN.trousers} sleeves={HORSE_MAN.sleeves} chest={HORSE_MAN.chest} headgear={HORSE_MAN.headgear} noBlob />;
    } else if (f >= HDIS && f < HDIS + 12) {
      const k = seg(f, HDIS, HDIS + 12, easeInOut);
      const pos: V3 = [lerp(saddleW[0], side[0], k), lerp(saddleW[1], 0, k) + Math.sin(k * Math.PI) * 0.4, lerp(saddleW[2], side[2], k)];
      people.push(<Person key="horse" o={HORSE_MAN} pose={lerpPose(ridePose(0), restPose(), k)} pos={pos} rot={angLerp(HORSE_ROT, HORSE_ROT + 2.6, k)} noBlob={k < 0.7} />);
    } else if (f >= HDIS + 12) {
      const w = walkAt(f, HDIS + 12, exitPath(side[0], side[2]), 0.08);
      if (!gone(w.z)) people.push(<Person key="horse" o={HORSE_MAN} pose={alive(walkPose(w.phase, 1), f, 4.4, 0.4)} pos={[w.x, 0, w.z]} rot={w.heading} />);
    }
  }
  // the instructor (white flannels): watches from the right, walks to his post in beat 6, explains, stays
  const instructorGone = f >= instrOut;
  const instrAt: { pos: V3; rot: number } = { pos: INSTR_START, rot: -2.3 };
  if (!instructorGone) {
    const WALK = B.w.rower - 6;
    const w = walkAt(f, WALK, [
      [INSTR_START[0], INSTR_START[2]],
      [INSTR_POST[0], INSTR_POST[2]],
    ], 0.1);
    let pose = alive(postPose(), f, 5.5, 0.6);
    let pos: V3 = INSTR_START;
    let rot = -2.3 + Math.sin(f * 0.02) * 0.25;
    if (f < WALK) {
      pose.headYaw = Math.sin(f * 0.025) * 0.3;
    } else if (!w.done) {
      pose = alive(walkPose(w.phase, 0.9), f, 5.5, 0.4);
      pos = [w.x, 0, w.z];
      rot = w.heading;
    } else {
      pos = INSTR_POST;
      const t = w.since;
      rot = angLerp(w.heading, 0.15, seg(t, 0, 10));
      // explaining: points to the horse, then the rower, then the bike (beats 7-8)
      const dir = f < S[8] ? Math.sin((f - S[7]) * 0.05) : Math.sin((f - S[8]) * 0.04 + 1.2);
      const talk = 1 - seg(f, B.w.tilt + 40, B.w.tilt + 60);
      const ex = explainPose(f, dir, talk);
      const k = seg(t, 2, 12) * (1 - seg(f, B.w.tilt + 44, B.w.tilt + 64) * 0.85);
      pose = alive(lerpPose(postPose(), ex, k), f, 5.5, 0.5);
      // once the room is empty: calm, a slow look around, a small nod
      const calm = seg(f, B.w.tilt + 44, B.w.tilt + 64);
      pose.headYaw = lerp(pose.headYaw, Math.sin((f - B.w.tilt) * 0.05) * 0.35, calm);
      pose.headPitch += Math.max(0, Math.sin(clamp((f - (B.w.tilt + 70)) / 14) * Math.PI)) * 0.18;
      pose.mouth = calm > 0.5 ? "smile" : pose.mouth;
      pose.brow = calm * 0.25;
      pose.roll += tilt * 0.6; // keeps standing upright against the tilt
    }
    instrAt.pos = pos;
    instrAt.rot = rot;
    people.push(<Person key="instr" o={INSTRUCTOR} pose={pose} pos={pos} rot={rot} />);
  }
  // listeners: the lady walks in (beat 5), the man in green is there from the start; both leave after the tilt
  const listener = (key: string, o: Outfit, seed: number, inAt: number, fromDoor: boolean, spot: [number, number], start: [number, number], leaveAt: number, via: [number, number]) => {
    const spotPos: V3 = [spot[0], 0, spot[1]];
    const faceInstr = Math.atan2(INSTR_POST[0] - spot[0], INSTR_POST[2] - spot[1]);
    if (fromDoor && f < inAt) return;
    if (!fromDoor && f < inAt) {
      // waits by the camel, watching it, then strolls over
      const p = alive({ ...restPose(), armL: { sx: 0.35, sz: 0.12, twist: 0.4, elbow: -0.9 }, armR: { sx: 0.35, sz: 0.12, twist: -0.4, elbow: -0.9 } }, f, seed, 0.7);
      p.headPitch = -0.1;
      p.mouth = "smile";
      people.push(<Person key={key} o={o} pose={p} pos={[start[0], 0, start[1]]} rot={-2.4} />);
      return;
    }
    if (f < leaveAt) {
      {
        const w = walkAt(f, inAt, fromDoor ? [...DOOR_IN, [start[0], start[1]], spot] : [start, spot], 0.075);
        if (!w.done) {
          people.push(<Person key={key} o={o} pose={alive(walkPose(w.phase, 0.9), f, seed, 0.4)} pos={[w.x, 0, w.z]} rot={w.heading} />);
          return;
        }
      }
      // standing: watches the machines, then turns to the instructor and nods along
      const toInstr = seg(f, B.cut(7) - 10, B.cut(7) + 6);
      const rot = lerp(lerp(-0.4 + seed * 0.1, 0.3, 0.5), faceInstr, toInstr);
      const p = alive({ ...restPose(), armL: { sx: -0.3, sz: 0.1, twist: -0.8, elbow: -1.2 }, armR: { sx: -0.3, sz: 0.1, twist: 0.8, elbow: -1.2 } }, f, seed, 0.6);
      p.headPitch += Math.max(0, Math.sin((f - seed * 10) * 0.12)) * 0.1 * toInstr;
      p.mouth = toInstr > 0.5 ? "o" : "smile";
      p.mouthOpen = 0.1;
      p.browUp = 0.4 * toInstr;
      people.push(<Person key={key} o={o} pose={p} pos={spotPos} rot={rot} />);
      return;
    }
    const w = walkAt(f, leaveAt, exitPath(spot[0], spot[1], via), 0.12);
    if (gone(w.z)) return;
    const p = alive(walkPose(w.phase, 1), f, seed, 0.4);
    p.headYaw = 0.25; // one last look back at him
    people.push(<Person key={key} o={o} pose={p} pos={[w.x, 0, w.z]} rot={w.heading} />);
  };
  listener("lady2", LADY2, 6.6, B.w.rower - 4, true, LADY2_SPOT, [0.9, -1.2], B.w.tilt - 14, [0.7, -1.6]);
  listener("man3", MAN3, 7.7, B.w.bike - 4, false, MAN3_SPOT, MAN3_START, B.w.tilt + 2, [1.1, -1.5]);

  // the dumbbell that slides across the floor once the room tilts
  const slide = (() => {
    const t = Math.max(0, f - (B.w.tilt + 6));
    const x = -0.9 + Math.min(2.4, 0.0009 * t * t);
    return { x, roll: (x + 0.9) / 0.13 };
  })();

  // modern people (beats 9-11)
  const modern: React.ReactNode[] = [];
  let coins: { at: V3; s: number; spin: number }[] = [];
  if (modernOn) {
    const S10 = S[10];
    const S11 = S[11];
    // A walks in from the left, looks around, shows the phone, greets B, jumping jacks
    const wa = walkAt(f, T9 + 22, [
      [-4.6, 3.6],
      [A_SPOT[0], A_SPOT[1]],
    ], 0.068);
    if (wa.started) {
      let p = alive(walkPose(wa.phase, wa.done ? 0 : 1), f, 8.1, 0.5);
      let rot = wa.heading;
      let phone: React.ReactNode = null;
      if (wa.done) {
        const arrive = wa.since;
        rot = angLerp(wa.heading, 0.42, seg(arrive, 0, 10));
        p = alive(restPose(), f, 8.1, 0.7);
        // impressed look around the new gym
        p.headYaw = Math.sin(arrive * 0.07) * 0.4 * (1 - seg(f, S10 - 6, S10));
        p.mouth = "o";
        p.mouthOpen = 0.2;
        p.browUp = 0.7;
        // beat 10: phone up (anticipation dip, overshoot), shows us the map
        const up = clamp(springAt(f, S10 - 2, 0.5, 3.4), 0, 1.12) * (1 - seg(f, S11 + 4, S11 + 14));
        const dip = seg(f, S10 - 8, S10 - 2) * (1 - seg(f, S10 - 2, S10 + 4));
        p.bob -= dip * 0.06;
        p.armL = { sx: lerp(0, -2.0, up), sz: lerp(0.08, 0.12, up), twist: 0, elbow: lerp(-0.15, -0.3, up) };
        const showing = seg(f, S10, S10 + 8);
        p.mouth = showing > 0.5 ? "grin" : p.mouth;
        p.headYaw = lerp(p.headYaw, -0.25 + Math.sin(f * 0.09) * 0.12, showing);
        p.eyeX = lerp(0, -0.5 + 0.5 * Math.sign(Math.sin(f * 0.09)), showing);
        p.browUp = lerp(p.browUp, 0.5, showing);
        p.squash = 1 + 0.025 * Math.max(0, Math.sin((f - S10) * 0.3)) * showing;
        p.bob += 0.04 * Math.max(0, Math.sin((f - S10) * 0.3)) * showing * (1 - seg(f, S11, S11 + 6));
        if (up > 0.02) {
          const ang = -(p.armL.sx + p.armL.elbow);
          const pins = [0, 1, 2].map((i) => popIn(f, S10 + 16 + i * 8));
          phone = (
            <group position={[0, -0.04, 0.02]} rotation={[ang, 0, 0]} scale={0.42 * clamp(up, 0, 1.1)}>
              <group position={[0, -1.05, 0.7]}>
                <Phone screen={<MapScreen pins={pins} frame={f} />} />
              </group>
            </group>
          );
        }
        // beat 11: turns to B, fist bump, then jumping jacks side by side
        const toB = seg(f, S11 + 10, S11 + 20) * (1 - seg(f, S11 + 44, S11 + 52));
        rot = angLerp(rot, Math.atan2(B_SPOT[0] - A_SPOT[0], B_SPOT[1] - A_SPOT[1]), toB);
        const bump = seg(f, S11 + 22, S11 + 30, easeOutBack) * (1 - seg(f, S11 + 38, S11 + 46));
        p.armR = { sx: lerp(p.armR.sx, -1.45, bump), sz: lerp(p.armR.sz, -0.1, bump), twist: 0, elbow: lerp(p.armR.elbow, -0.15, bump) };
        if (toB > 0.3) {
          p.mouth = "grin";
          p.eyeX = 0;
        }
        const jj = seg(f, S11 + 46, S11 + 54);
        if (jj > 0) {
          const c = 0.5 - 0.5 * Math.cos((f - (S11 + 46)) * 0.32);
          const jack: BlockyPose = {
            ...restPose(),
            armL: { sx: 0, sz: lerp(0.2, 2.7, c), twist: 1.57, elbow: -0.25 },
            armR: { sx: 0, sz: lerp(0.2, 2.7, c), twist: 1.57, elbow: -0.25 },
            legL: { hip: 0, sz: lerp(0.04, 0.32, c), knee: 0.05 },
            legR: { hip: 0, sz: lerp(0.04, 0.32, c), knee: 0.05 },
            bob: 0.12 * Math.abs(Math.sin((f - (S11 + 46)) * 0.32)),
            mouth: "grin",
            browUp: 0.3,
          };
          p = lerpPose(p, alive(jack, f, 8.1, 0.3), jj);
        }
        if (f >= S11 + 28) coins.push({ at: [A_SPOT[0], 3.35, A_SPOT[1]], s: popIn(f, S11 + 28), spin: (f - S11) * 0.13 });
      }
      modern.push(<Person key="A" o={MOD_A} pose={p} pos={[wa.x, 0, wa.z]} rot={rot} leftHand={phone} />);
    }
    // B walks in (beat 11) from the left, fist bump, jumping jacks
    const wb = walkAt(f, S11 - 30, [
      [-5.6, -1.3],
      [-2.4, -1.3],
      [B_SPOT[0], B_SPOT[1]],
    ], 0.095);
    if (wb.started) {
      let p = alive(walkPose(wb.phase, wb.done ? 0 : 1), f, 9.3, 0.5);
      let rot = wb.heading;
      if (wb.done) {
        rot = Math.atan2(A_SPOT[0] - B_SPOT[0], A_SPOT[1] - B_SPOT[1]);
        p = alive(wavePose(f, 0.4), f, 9.3, 0.4);
        const bump = seg(f, S11 + 22, S11 + 30, easeOutBack) * (1 - seg(f, S11 + 38, S11 + 46));
        p.armL = { sx: lerp(p.armL.sx, -1.45, bump), sz: lerp(p.armL.sz, -0.1, bump), twist: 0, elbow: lerp(p.armL.elbow, -0.15, bump) };
        p.armR = lerpPose(p, { ...p, armR: restPose().armR }, bump).armR;
        const face = seg(f, S11 + 44, S11 + 52);
        rot = angLerp(rot, 0.3, face);
        const jj = seg(f, S11 + 46, S11 + 54);
        if (jj > 0) {
          const c = 0.5 - 0.5 * Math.cos((f - (S11 + 46)) * 0.32);
          const jack: BlockyPose = {
            ...restPose(),
            armL: { sx: 0, sz: lerp(0.2, 2.7, c), twist: 1.57, elbow: -0.25 },
            armR: { sx: 0, sz: lerp(0.2, 2.7, c), twist: 1.57, elbow: -0.25 },
            legL: { hip: 0, sz: lerp(0.04, 0.32, c), knee: 0.05 },
            legR: { hip: 0, sz: lerp(0.04, 0.32, c), knee: 0.05 },
            bob: 0.12 * Math.abs(Math.sin((f - (S11 + 46)) * 0.32)),
            mouth: "grin",
            browUp: 0.3,
          };
          p = lerpPose(p, alive(jack, f, 9.3, 0.3), jj);
        }
        if (f >= S11 + 28) coins.push({ at: [B_SPOT[0], 3.35, B_SPOT[1]], s: popIn(f, S11 + 31), spin: (f - S11) * 0.13 + 1.2 });
      }
      modern.push(<Person key="B" o={MOD_B} pose={p} pos={[wb.x, 0, wb.z]} rot={rot} />);
    }
  }
  if (!modernOn) coins = [];

  // ---------- render
  const outsideVisible = f < T9 + 40;
  const exteriorVisible = f < B.cut(2) + 4;
  const glowPane = 0.85 * (1 - seg(f, S[1] + 6, S[1] + 40));
  const keyI = lerp(0, 2.2, inside) + day * 0.6;
  const keyColor = new THREE.Color("#FFE0B0").lerp(new THREE.Color("#FFF6E8"), day).getStyle();
  const chandLit = 1 - seg(f, T9 + 4, T9 + 14);
  const bikeGroupS = Math.max(0.0001, oldBikeS) * bB;

  return (
    <>
      <CameraRig frame={f} B={B} keys={keys} />
      <fog attach="fog" args={[TPAL.nightHorizon, 420, 2600]} />
      <hemisphereLight args={[hemiSky.getStyle(), hemiGround.getStyle(), hemiI]} />
      {/* moonlight on the ship's side */}
      <directionalLight position={[80, 110, 160]} intensity={2.3 * (1 - inside)} color="#D6E2FF" />
      <directionalLight position={[-120, 40, -60]} intensity={0.8 * (1 - inside)} color="#8FA6E0" />
      {/* the room's warm key (casts the interior shadows) */}
      <RoomKey intensity={keyI} color={keyColor} />
      {CHANDELIERS.map((c, i) => (
        <pointLight key={i} position={[c[0], c[1] - 1.6 + chandUp, c[2]]} intensity={9 * inside * chandLit} distance={0} decay={1.4} color="#FFC877" />
      ))}
      {day > 0 && <pointLight position={[-1.5, 5.2, 1.5]} intensity={6 * day} decay={1.2} color="#FFFFFF" />}

      {/* the outside world: tilts around the room in beat 8 */}
      {outsideVisible && (
        <group rotation={[0, 0, tilt]}>
          <GradientSky top={skyTop} horizon={skyHor} />
          {day < 1 && <Stars frame={f} />}
          <Moon position={[-1330, 330, -980]} r={48} />
          <Sea frame={f} />
          <Iceberg position={[-700, -18, -575]} s={3.2} />
          {exteriorVisible && <Ship frame={f} />}
        </group>
      )}
      {!outsideVisible && <GradientSky top={skyTop} horizon={skyHor} />}

      {/* ---- the gym room ---- */}
      <Part geo={box(RX * 2 + 0.4, 0.4, RZ * 2 + 0.4)} color={TPAL.oakDark} position={[0, -0.28, 0]} shadow={false} />
      <FloorTiles f={f} B={B} />
      {f < T9 + 60 && <OldWalls sink={sinkOld} glow={glowPane} />}
      {f >= T9 && <ModernWalls f={f} rise={riseNew} />}
      {/* ceiling */}
      {chandUp < 5.9 && (
        <group position={[0, chandUp, 0]}>
          <Part geo={box(RX * 2 + 0.4, 0.25, RZ * 2 + 0.4)} color={TPAL.plaster} position={[0, RH + 0.12, 0]} shadow={false} />
          {[-2.6, 0, 2.6].map((z) => (
            <Part key={z} geo={box(RX * 2, 0.3, 0.35)} color={TPAL.oakLight} position={[0, RH - 0.12, z]} shadow={false} />
          ))}
        </group>
      )}
      {f >= T9 && (
        <>
          <Part geo={box(MX * 2 + 1, 0.3, MZF - MZB + 1)} color="#FFFFFF" position={[0, MH + 0.15, (MZF + MZB) / 2]} shadow={false} />
          <Part geo={box(MX * 2 + 1, 0.1, MZF - MZB + 1)} color={TPAL.modernFloorB} rough={0.85} position={[0, -0.06, (MZF + MZB) / 2]} shadow={false} />
        </>
      )}
      {chandUp < 5.9 &&
        CHANDELIERS.map((c, i) => {
          const swing = tilt + Math.sin((f - B.w.tilt) * 0.11 + i) * 0.06 * seg(f, B.w.tilt, B.w.tilt + 30) + Math.sin(f * 0.05 + i * 2) * 0.012;
          return (
            <group key={i} position={[c[0], c[1] + chandUp, c[2]]}>
              <Chandelier swing={swing} swingX={Math.sin(f * 0.04 + i) * 0.01} lit={chandLit} />
            </group>
          );
        })}
      {/* modern pendant lamps */}
      {pendants > 0 &&
        [-4, 0, 4].map((x) => (
          <group key={x} position={[x, MH, 0.6]} scale={[1, Math.max(0.001, pendants), 1]}>
            <Part geo={box(0.03, 1.6, 0.03)} color={PAL.ink} position={[0, -0.8, 0]} shadow={false} />
            <Part geo={rbox(0.9, 0.3, 0.9, 0.12)} color={PAL.teal} position={[0, -1.7, 0]} shadow={false} />
            <Part geo={circle(0.32, 20)} color="#FFF8E8" basic rotation={[Math.PI / 2, 0, 0]} position={[0, -1.86, 0]} shadow={false} />
          </group>
        ))}

      {/* ---- 1912 furniture (pops out in beat 9) ---- */}
      {f < T9 + 40 && (
        <>
          <group position={[DOOR_X, 4.55 + sinkOld(0), -RZ + 0.12]} scale={0.85}>
            <Plaque1912 pops={pops} />
          </group>
          <OldClock position={[-2.3, 4.45 + sinkOld(0), -RZ + 0.1]} hour={hour} minute={minute} blur={clockBlur} />
          {/* old bike + rider spot glow */}
          <FloorGlow at={BIKE_AT} g={gB} />
          <group position={BIKE_AT} rotation={[0, BIKE_ROT, 0]} scale={bikeGroupS}>
            <OldBike crank={crank} glow={gB} />
          </group>
          <group position={DIAL_AT} rotation={[0, DIAL_ROT, 0]} scale={Math.max(0.0001, oldOut(0))}>
            <Dial angle={dialAngle} glow={gB} />
          </group>
          <FloorGlow at={ROWER_AT} g={gR} r={1.6} />
          <group position={ROWER_AT} rotation={[0, ROWER_ROT, 0]} scale={Math.max(0.0001, oldOut(1)) * bR}>
            <Rower seatZ={row.seatZ} oar={row.oar} wheel={rowWheel} glow={gR} />
          </group>
          <FloorGlow at={HORSE_AT} g={gH} r={1.5} />
          <group position={HORSE_AT} rotation={[0, HORSE_ROT, 0]} scale={Math.max(0.0001, oldOut(2)) * bH}>
            <MechHorse rock={horseRock} bounce={horseBounce} gear={gearA * (0.3 + horseAmp)} glow={gH}>
              {horseRider}
            </MechHorse>
          </group>
          <group position={CAMEL_AT} rotation={[0, CAMEL_ROT, 0]} scale={Math.max(0.0001, oldOut(3))}>
            <MechCamel rock={camelRock} bounce={camelBounce} gear={gearA * (0.3 + camelAmp)}>
              {camelRider}
            </MechCamel>
          </group>
          {/* a loose dumbbell and a pair of Indian clubs by the wall */}
          <group position={[slide.x, 0.12, -0.2]} rotation={[0, 0.3, -slide.roll]} scale={Math.max(0.0001, oldOut(1))}>
            <Dumbbell color={TPAL.iron} s={0.95} />
          </group>
          {[0, 1].map((i) => (
            <group key={i} position={[-5.9 + i * 0.35, 0, -3.9]} rotation={[0.1, 0, i ? -0.12 : 0.12]} scale={Math.max(0.0001, oldOut(2))}>
              <Part geo={sphere(0.17, 12)} color={TPAL.oakLight} position={[0, 0.25, 0]} scale={[1, 1.8, 1]} />
              <Part geo={rbox(0.08, 0.5, 0.08, 0.03)} color={TPAL.oakDark} position={[0, 0.75, 0]} />
            </group>
          ))}
          {/* palm in a brass pot */}
          <group position={[-5.6, 0, 3.8]} scale={Math.max(0.0001, oldOut(3))}>
            <Part geo={cyl0} color={TPAL.brass} position={[0, 0.35, 0]} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Part key={i} geo={rbox(0.16, 1.2, 0.05, 0.03)} color={PAL.oliveDark} position={[Math.sin(i) * 0.25, 1.25, Math.cos(i) * 0.2]} rotation={[Math.cos(i * 1.1) * 0.6, 0, Math.sin(i * 1.1) * 0.7 + Math.sin(f * 0.05 + i) * 0.03]} />
            ))}
          </group>
        </>
      )}
      {/* the swap puff where the old bike becomes the new one */}
      <PuffRing at={[BIKE_AT[0], 0.6, BIKE_AT[2]]} age={f - (T9 + 12)} />
      {f >= T9 && (
        <>
          <group position={BIKE_AT} rotation={[0, 1.25, 0]} scale={Math.max(0.0001, newBikeS)}>
            <ModernBike crank={f * 0.18} />
          </group>
          {[
            [1.5, -5.6],
            [-4.3, -5.2],
          ].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]} rotation={[0, Math.PI + 0.3, 0]} scale={Math.max(0.0001, newIn(i))}>
              <Treadmill frame={f + i * 7} />
              {/* a runner in the background (faces the camera: the console is on our side) */}
              {i === 0 && (
                <Blocky
                  pose={(() => {
                    const r = alive(runnerPose(f * 0.36, 0.55), f, 12.5, 0.5);
                    r.mouth = "smile";
                    r.brow = 0;
                    return r;
                  })()}
                  colors={{ skin: SKIN[4], shirt: PAL.mustard, pants: "#3F4A5A", shoes: "#FFFFFF", hair: "#2C211D", face: PAL.ink }}
                  position={[0, 0.245, 0.15]}
                  rotationY={Math.PI}
                  headband={PAL.terracotta}
                />
              )}
            </group>
          ))}
          <group position={[6.6, 0, -5.4]} scale={Math.max(0.0001, newIn(3))}>
            <Bench rotationY={-0.3} />
          </group>
          {/* colour blocks between the back windows */}
          {[
            [-2.6, 2.0, PAL.teal],
            [2.9, 2.0, PAL.mustard],
            [-8.4, 2.6, PAL.terracotta],
            [8.6, 2.4, PAL.teal],
          ].map(([x, w, col], i) => (
            <Part key={`cb${i}`} geo={box(w as number, 3.2, 0.05)} color={col as string} position={[x as number, 3.6 + riseNew(0), MZB + 0.04]} shadow={false} />
          ))}
          {/* squat rack */}
          <group position={[-6.3, 0, -6.7]} scale={Math.max(0.0001, newIn(1))}>
            {[-0.8, 0.8].map((x) => (
              <Part key={x} geo={rbox(0.14, 2.8, 0.14, 0.03)} color={PAL.ink} position={[x, 1.4, 0]} />
            ))}
            <Part geo={rbox(1.9, 0.12, 0.14, 0.03)} color={PAL.ink} position={[0, 2.8, 0]} />
            <group position={[0, 1.75, 0.12]}>
              <Part geo={cyl0b} color={PAL.steel} rough={0.4} rotation={[0, 0, Math.PI / 2]} />
              {[1, -1].map((k2) => (
                <Part key={k2} geo={plate} color={k2 > 0 ? PAL.terracotta : PAL.terracotta} rotation={[0, 0, Math.PI / 2]} position={[k2 * 1.05, 0, 0]} />
              ))}
            </group>
          </group>
          {/* modern rower */}
          <group position={[3.6, 0, -6.2]} rotation={[0, -1.2, 0]} scale={Math.max(0.0001, newIn(2))}>
            <Part geo={rbox(0.3, 0.12, 2.6, 0.04)} color={PAL.steel} position={[0, 0.35, 0]} />
            <Part geo={rbox(0.5, 0.12, 0.5, 0.05)} color={PAL.ink} position={[0, 0.48, -0.3 + Math.sin(f * 0.15) * 0.25]} />
            <Part geo={cylFly} color={PAL.teal} rotation={[0, 0, Math.PI / 2]} position={[0, 0.55, 1.2]} />
          </group>
          {/* medicine balls */}
          {[0, 1, 2].map((i) => (
            <Part key={`mb${i}`} geo={sphere(0.28, 16)} color={[PAL.mustard, PAL.teal, PAL.terracotta][i]} position={[-4.2 + i * 0.62, 0.28, MZB + 1.0]} scale={Math.max(0.0001, newIn(3))} />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <group key={`kb${i}`} position={[-0.6 + i * 0.6, 0, MZB + 1.3]} scale={Math.max(0.0001, newIn(2)) * (0.8 + i * 0.08)}>
              <Part geo={sphere(0.2, 16)} color={[PAL.terracotta, PAL.mustard, PAL.teal, PAL.ink, PAL.terracotta][i]} position={[0, 0.2, 0]} />
              <Part geo={rbox(0.26, 0.08, 0.05, 0.02)} color={PAL.ink} position={[0, 0.45, 0]} />
            </group>
          ))}
          <group position={[1.4, 0, MZB + 0.55]} scale={Math.max(0.0001, newIn(1))}>
            <DumbbellRack />
          </group>
          <group position={[4.2, 0, -2.4]} scale={Math.max(0.0001, newIn(2))}>
            <Bench rotationY={-0.6} />
          </group>
          <group position={[-2.6, 5.9 + riseNew(0), MZB + 0.15]} scale={Math.max(0.0001, newIn(1))}>
            <WallClock frame={f} />
          </group>
          {/* mats under the two of them */}
          <Part geo={rbox(3.6, 0.05, 1.9, 0.03)} color={PAL.teal} position={[(A_SPOT[0] + B_SPOT[0]) / 2, 0.025, (A_SPOT[1] + B_SPOT[1]) / 2 - 0.05]} rotation={[0, 0.3, 0]} scale={[Math.max(0.0001, newIn(3)), 1, Math.max(0.0001, newIn(3))]} />
          {/* plants */}
          {[
            [-7.6, -6.6],
            [5.2, -6.8],
            [-8.6, 1.5],
            [-1.0, -7.3],
            [7.6, -6.9],
          ].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]} scale={Math.max(0.0001, newIn(2 + i))}>
              <Part geo={rbox(0.6, 0.6, 0.6, 0.08)} color={PAL.terracotta} position={[0, 0.3, 0]} />
              {[0, 1, 2, 3, 4].map((j) => (
                <Part key={j} geo={rbox(0.14, 0.9, 0.06, 0.03)} color={PAL.olive} position={[Math.sin(j * 1.3) * 0.15, 0.95, Math.cos(j * 1.3) * 0.1]} rotation={[Math.cos(j * 1.3) * 0.4, 0, Math.sin(j * 1.3) * 0.5 + Math.sin(f * 0.07 + j) * 0.04]} />
              ))}
            </group>
          ))}
          {modern}
          {coins.map((c, i) => (
            <group key={i} position={[c.at[0], c.at[1] + Math.sin(f * 0.12 + i) * 0.06, c.at[2]]}>
              <GoldCoin spin={c.spin} s={0.85 * c.s} />
              {c.s > 0 && <Part geo={sphere(0.6, 16)} color="#FFE07A" basic opacity={0.16 * Math.min(1, c.s)} shadow={false} />}
              {/* sparkles on the pop */}
              {[0, 1, 2, 3, 4, 5].map((q) => {
                const age = f - (B.s[11] + 28 + i * 3);
                if (age < 0 || age > 14) return null;
                const a = (q / 6) * Math.PI * 2;
                const r = 0.35 + easeOut(age / 14) * 0.6;
                return <Part key={q} geo={rbox(0.05, 0.18, 0.03, 0.02)} color="#FFE07A" basic opacity={1 - age / 14} position={[Math.cos(a) * r, Math.sin(a) * r, 0.1]} rotation={[0, 0, a - Math.PI / 2]} shadow={false} />;
              })}
            </group>
          ))}
        </>
      )}
      {people}
    </>
  );
};

const cyl0b = new THREE.CylinderGeometry(0.035, 0.035, 2.4, 10);
const plate = new THREE.CylinderGeometry(0.34, 0.34, 0.1, 20);
const cylFly = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 20);
const cyl0 = (() => {
  // brass pot (cached once)
  return new THREE.CylinderGeometry(0.35, 0.28, 0.7, 16);
})();

const RoomKey: React.FC<{ intensity: number; color: string }> = ({ intensity, color }) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(0, 0, -1);
  return (
    <>
      <primitive object={target} />
      <directionalLight
        position={[3.5, 14, 9]}
        target={target}
        color={color}
        intensity={intensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
    </>
  );
};

const dbgInfo = (f: number, keys: Key[]) => {
  const c = sampleTrack(keys, f);
  return `f${f} p ${c.p.map((v) => v.toFixed(2)).join(",")} l ${c.l.map((v) => v.toFixed(2)).join(",")} fov ${c.fov.toFixed(0)}`;
};
/** Debug overlay: the mascot's box (centre 770,1500; 300x420) and the caption band (y 1170 +-80). */
const DebugOverlay: React.FC<{ info?: string }> = ({ info }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {info && <div style={{ position: "absolute", left: 20, top: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "28px monospace", padding: 8 }}>{info}</div>}
    <div style={{ position: "absolute", left: 620, top: 1290, width: 300, height: 420, border: "4px dashed #ff00aa" }} />
    <div style={{ position: "absolute", left: 750, top: 1480, width: 40, height: 40, borderRadius: 20, background: "#ff00aa" }} />
    <div style={{ position: "absolute", left: 0, top: 1090, width: 1080, height: 160, background: "rgba(0,170,255,0.12)", borderTop: "3px dashed #00aaff", borderBottom: "3px dashed #00aaff" }} />
    <div style={{ position: "absolute", left: 0, top: 1170, width: 1080, height: 0, borderTop: "2px solid #00aaff" }} />
  </AbsoluteFill>
);

export const FactTitanic: React.FC<FactTitanicProps> = ({ starts = TITANIC_STARTS, words = TITANIC_WORDS, durationSec = TITANIC_DURATION, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const B = useMemo(() => makeTitanicBeats(starts, words, fps, durationSec), [starts, words, fps, durationSec]);
  const keys = useMemo(() => makeKeys(B), [B]);
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: TPAL.nightTop }}>
      <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 36, near: 1, far: 6000, position: [128, 30, 205] }} gl={{ antialias: true }}>
        <World B={B} keys={keys} />
      </ThreeCanvas>
      {debug && <DebugOverlay info={dbgInfo(frame, keys)} />}
    </AbsoluteFill>
  );
};

