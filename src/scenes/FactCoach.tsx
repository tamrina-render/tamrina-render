import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { Part, box, circle, cyl, rbox, sphere, torusArc } from "./fact3d/parts";
import { clamp, easeIn, easeInOut, easeOut, hash, lerp, seg, springAt, wobble } from "./fact3d/anim";
import { alive, clapPose, lerpPose, walkPose } from "./fact3d/acting";
import { Dumbbell } from "./fact3d/props";
import { Shot, ShotRig, mixShot } from "./fact3d/cameraMoves";
import { SuitBowTie } from "./fact3d/zander";
import { AppPhone, AppPhoneSpec } from "./fact3d/AppPhone";
import { COACH_AUDIO, COACH_DURATION, CoachProps, SHOTS, ShotName, T, WHIPS } from "./fact3d/coachTiming";
import { loadFonts } from "../lib/fonts";

loadFonts();

// «الجيم | الدحيح» intro (videos/da7ee7-gym-intro): the coach who cheers for everything, remade as a warm 3D toy film
// on the ORIGINAL sound (first second cut). Same shots and cuts as the original: the home gym (wide + close-ups),
// a whip pan to the office, a whip pan to the wedding, then a whip back to the gym where Mr. Coin walks in (drawn by
// the reel on top; the camera is still from there) with the app on a phone and the logo.
// Lips: the mouth opens on that character's words (diarized speech-to-text) by the loudness of each frame.

type V3 = [number, number, number];
const LIME = "#D6FF3C";
const INK = "#0E0F12";
const AR = "Cairo";
const FPS = 30;
const S = (sec: number) => Math.round(sec * FPS);

// ---------------------------------------------------------------- places
const OX = 40; // office room centre x
const WX = 80; // wedding hall centre x
const MOHAB_GYM: V3 = [0.85, 0, 0];
const MOHAB_GYM_ROT = -1.0;
const COACH_GYM: V3 = [-1.05, 0, 0.5];
const COACH_GYM_ROT = 0.85;
const DESK: V3 = [OX + 0.35, 0, 0.1];
const MOHAB_OFF: V3 = [OX + 0.45, 0, -0.75];
const COACH_OFF_FROM: V3 = [OX - 3.8, 0, 0.5];
const COACH_OFF: V3 = [OX - 1.9, 0, -0.15];
const THRONE: V3 = [WX + 0.55, 0, -0.7];
const THRONE_SEAT = 0.78;
const STOOL: V3 = [WX - 1.15, 0, -0.25];
const STOOL_SEAT = 0.62;

// ---------------------------------------------------------------- looks
const COACH_C: BlockyColors = { skin: "#D9A27A", shirt: "#2456A6", pants: "#1E3F7A", shoes: "#F2F2F2", hair: "#2C211D", face: "#2A1E1A" };
const MOHAB_GYM_C: BlockyColors = { skin: "#E8B48C", shirt: "#18181C", pants: "#232327", shoes: "#2B2B30", hair: "#151212", face: "#2A1E1A" };
const MOHAB_OFF_C: BlockyColors = { ...MOHAB_GYM_C, shirt: "#F4F4F2", pants: "#4A4F5A" };
const MOHAB_WED_C: BlockyColors = { ...MOHAB_GYM_C, shirt: "#17171B", pants: "#17171B", shoes: "#0E0E10" };

const Moustache: React.FC = () => (
  <group position={[0, 0.245, 0.4]}>
    <Part geo={rbox(0.34, 0.085, 0.07, 0.035)} color="#2A1A12" />
    {[-1, 1].map((k) => (
      <Part key={k} geo={rbox(0.14, 0.07, 0.06, 0.03)} color="#2A1A12" position={[k * 0.2, -0.035, -0.01]} rotation={[0, 0, k * 0.55]} />
    ))}
  </group>
);
const MessyHair: React.FC = () => (
  <group position={[0, 0.84, 0.02]}>
    {[-0.28, -0.08, 0.12, 0.3].map((x, i) => (
      <Part key={x} geo={sphere(0.15, 10)} color="#151212" position={[x, 0.02 + (i % 2) * 0.05, 0.16 - i * 0.03]} />
    ))}
  </group>
);
const Tie: React.FC = () => (
  <group position={[0, 0.58, 0.255]}>
    <Part geo={box(0.2, 0.16, 0.01)} color="#FFFFFF" position={[0, 0.12, 0]} shadow={false} />
    <Part geo={rbox(0.09, 0.07, 0.03, 0.01)} color="#3B4A8C" position={[0, 0.17, 0.01]} shadow={false} />
    <Part geo={box(0.1, 0.42, 0.015)} color="#3B4A8C" position={[0, -0.08, 0.01]} shadow={false} />
  </group>
);
const Stripe: React.FC = () => (
  // tracksuit: white zip line + collar
  <group position={[0, 0.45, 0.255]}>
    <Part geo={box(0.035, 0.75, 0.01)} color="#F2F2F2" shadow={false} />
    <Part geo={box(0.5, 0.06, 0.012)} color="#F2F2F2" position={[0, 0.36, 0]} shadow={false} />
  </group>
);
const Thumb: React.FC = () => <Part geo={rbox(0.09, 0.2, 0.09, 0.04)} color="#D9A27A" position={[0, 0.12, 0.08]} />;

// ---------------------------------------------------------------- lips
type Talk = { coach: [number, number][]; mohab: [number, number][] };
const talkingAt = (list: [number, number][], f: number) => list.some(([a, b]) => f >= a && f <= b);
const withMouth = (p: BlockyPose, list: [number, number][], loud: number[], f: number): BlockyPose => {
  if (!talkingAt(list, f)) return p;
  const l = loud[Math.min(loud.length - 1, Math.max(0, f))] ?? 0;
  const jitter = 0.12 * Math.abs(Math.sin(f * 0.9));
  return {
    ...p,
    mouth: "o",
    mouthOpen: clamp(0.12 + l * 0.85 + jitter * l, 0, 1),
    headPitch: p.headPitch + 0.08 * l * Math.sin(f * 0.7),
    headTilt: p.headTilt + 0.05 * l * Math.sin(f * 0.37 + 1),
    browUp: p.browUp + 0.35 * l,
  };
};

// ---------------------------------------------------------------- poses
const bentPose = (u: number, effort: number): BlockyPose => {
  // deadlift: u 0 = bar at the shins, 1 = standing tall
  const lean = lerp(0.85, 0.03, u);
  return {
    ...restPose(),
    lean,
    bob: lerp(-0.25, 0, u),
    legL: { hip: lerp(-0.7, 0, u), sz: 0.12, knee: lerp(1.0, 0, u) },
    legR: { hip: lerp(-0.7, 0, u), sz: 0.12, knee: lerp(1.0, 0, u) },
    armL: { sx: -lean, sz: 0.2, twist: 0, elbow: 0 },
    armR: { sx: -lean, sz: 0.2, twist: 0, elbow: 0 },
    headPitch: lerp(-0.55, -0.05, u),
    brow: -0.4 - 0.5 * effort,
    eyeWide: 1 + 0.15 * effort,
    mouth: effort > 0.5 ? "flat" : "smile",
    blush: 0.7 * effort,
  };
};
/** where the hands are (Mohab-local) for a bentPose(u): the bar rides there */
const barAt = (u: number): [number, number] => {
  const lean = lerp(0.85, 0.03, u);
  const hip = 0.92 + lerp(-0.25, 0, u);
  const sh = 0.72;
  return [hip + sh * Math.cos(lean) - 0.84, sh * Math.sin(lean) + 0.05];
};
const handsOnKnees = (f: number): BlockyPose => {
  const pant = Math.sin(f * 0.45);
  return {
    ...restPose(),
    lean: 0.55,
    bob: -0.08,
    legL: { hip: -0.35, sz: 0.14, knee: 0.45 },
    legR: { hip: -0.35, sz: 0.14, knee: 0.45 },
    armL: { sx: -0.75, sz: 0.25, twist: 0, elbow: -0.15 },
    armR: { sx: -0.75, sz: 0.25, twist: 0, elbow: -0.15 },
    shrug: 0.4 + 0.3 * pant,
    headPitch: -0.25,
    eyeOpen: 0.75,
    brow: 0.6,
    mouth: "o",
    mouthOpen: 0.35 + 0.2 * pant,
    blush: 0.8,
  };
};
const hipsPose = (f: number): BlockyPose => {
  const pant = Math.sin(f * 0.4);
  return {
    ...restPose(),
    armL: { sx: 0.05, sz: 0.85, twist: -1.5, elbow: -1.75 },
    armR: { sx: 0.05, sz: 0.85, twist: -1.5, elbow: -1.75 },
    legL: { hip: -0.06, sz: 0.1, knee: 0.04 },
    legR: { hip: 0.04, sz: 0.1, knee: 0 },
    shrug: 0.25 + 0.2 * pant,
    headTilt: 0.06,
    eyeOpen: 1,
    brow: 0.5,
    browUp: 0.3,
    mouth: "smile",
    blush: 0.6,
  };
};
const pointPose = (): BlockyPose => ({
  ...restPose(),
  armR: { sx: -1.45, sz: 0.05, twist: 0, elbow: -0.1 },
  armL: { sx: -0.2, sz: 0.15, twist: 0, elbow: -0.5 },
  lean: 0.1,
  brow: -0.3,
  mouth: "flat",
});
const breathPose = (k: number): BlockyPose => ({
  ...restPose(),
  armL: { sx: -0.75 - 0.45 * k, sz: -0.15, twist: 0, elbow: -1.7 },
  armR: { sx: -0.75 - 0.45 * k, sz: -0.15, twist: 0, elbow: -1.7 },
  shrug: 0.7 * k,
  lean: -0.08 * k,
  browUp: 0.6 * k,
  eyeWide: 1 + 0.15 * k,
  mouth: "o",
  mouthOpen: 0.2,
});
const pumpPose = (f: number, hop = 0): BlockyPose => {
  const k = Math.abs(Math.sin(f * 0.42));
  return {
    ...restPose(),
    armR: { sx: -2.3 - 0.5 * k, sz: 0.25, twist: 0, elbow: -1.3 + 0.6 * k },
    armL: { sx: -0.9, sz: 0.2, twist: 0, elbow: -1.6 },
    bob: hop * 0.08 * k,
    legL: { hip: -0.05, sz: 0.12, knee: 0.1 * (1 - k) * hop },
    legR: { hip: 0.03, sz: 0.12, knee: 0.1 * (1 - k) * hop },
    headPitch: -0.12,
    eyeWide: 1.2,
    brow: -0.5,
    browUp: 0.3,
    mouth: "grin",
  };
};
const thumbsPose = (f: number): BlockyPose => ({
  ...restPose(),
  armL: { sx: -1.25, sz: 0.3, twist: 0, elbow: -1.1 },
  armR: { sx: -1.25, sz: 0.3, twist: 0, elbow: -1.1 },
  lean: -0.06,
  bob: 0.02 * Math.abs(Math.sin(f * 0.3)),
  headTilt: 0.1 * Math.sin(f * 0.15),
  eyeOpen: 1,
  browUp: 0.5,
  mouth: "grin",
});
const seatedBase = (): BlockyPose => ({
  ...restPose(),
  legL: { hip: -1.5, sz: 0.14, knee: 1.5 },
  legR: { hip: -1.5, sz: 0.14, knee: 1.5 },
});

// ---------------------------------------------------------------- the characters per room
type Actor = { pose: BlockyPose; pos: V3; rot: number; seatY?: number };

const coachGym = (f: number): Actor => {
  const t = f / FPS;
  let p: BlockyPose;
  if (t < 1.3) p = lerpPose(restPose(), pointPose(), seg(f, 0, 6));
  else if (t < 2.3) p = lerpPose(pointPose(), { ...restPose(), mouth: "smile" }, seg(f, S(1.3), S(1.6)));
  else if (t < 5.0) p = breathPose(0.5 + 0.5 * Math.sin((t - 2.3) * 2.4 - 1.57));
  else if (t < 7.6) p = pumpPose(f, 0.5);
  else if (t < 10.12) p = clapPose(f, 0.6, 1);
  else if (t < 11.12) p = { ...clapPose(f, 0.75, 2), eyeWide: 1.2 };
  else if (t < 13.3) p = pumpPose(f, 1);
  else if (t < 16.8) p = { ...clapPose(f, 0.65, 3), bob: 0.06 * Math.abs(Math.sin(f * 0.33)) };
  else p = thumbsPose(f);
  if (t >= 1.2 && t < 1.6) p = { ...p, headPitch: p.headPitch + 0.18 * Math.sin((t - 1.2) * 15) }; // «أيوة» nod
  return { pose: p, pos: COACH_GYM, rot: COACH_GYM_ROT };
};

const mohabGym = (f: number): { a: Actor; bar: { y: number; z: number; inHands: boolean } } => {
  const t = f / FPS;
  let p: BlockyPose;
  let u = 0;
  let effort = 0.2;
  if (t < T.lift0) {
    // reps: the first top lands on «واحد» (1.48 s), then one every 1.6 s, each a bit harder
    const t0 = 0.85;
    const c = 1.6;
    if (t >= t0) {
      const ph = ((t - t0) % c) / c;
      u = ph < 0.38 ? easeInOut(ph / 0.38) : ph < 0.5 ? 1 : ph < 0.88 ? 1 - easeInOut((ph - 0.5) / 0.38) : 0;
    }
    effort = 0.3 + 0.6 * clamp((t - 1) / 7.5) * (0.4 + 0.6 * u);
  } else if (t < T.liftTop) {
    // the last rep: slow and heavy
    u = seg(f, S(T.lift0), S(T.liftTop), (x) => x * x * (3 - 2 * x));
    effort = 0.8 + 0.2 * Math.min(1, (t - T.lift0) / 2);
  } else if (t < T.drop) {
    u = 1;
    effort = 1;
  }
  if (t < T.drop) {
    p = bentPose(u, effort);
    if (t > 9 && t < T.drop) p = { ...p, roll: Math.sin(f * 2.1) * 0.02 * effort, headTilt: Math.sin(f * 1.7) * 0.03 };
    const [by, bz] = barAt(u);
    return { a: { pose: p, pos: MOHAB_GYM, rot: MOHAB_GYM_ROT }, bar: { y: by, z: bz, inHands: true } };
  }
  // the drop: the bar falls to the floor and bounces; he folds, hands on knees, dizzy («دايرة دايرة»)
  const k = f - S(T.drop);
  const fall = Math.min(1, (k / 7) ** 2);
  const [ty, tz] = barAt(1);
  const floorY = 0.3;
  const bounce = k > 7 ? Math.abs(wobble(f, S(T.drop) + 7, 0.12, 0.7, 3)) : 0;
  const barY = lerp(ty, floorY, fall) + bounce;
  if (t < T.standUp - 2.4) {
    p = lerpPose(bentPose(1, 1), handsOnKnees(f), seg(f, S(T.drop), S(T.drop) + 8));
    if (t > 13.9 && t < 15.8) p = { ...p, headTilt: Math.sin(f * 0.35) * 0.18, roll: Math.sin(f * 0.35 + 1) * 0.06, eyeOpen: 0.5 };
  } else {
    p = hipsPose(f);
    if (t >= 18.2 && t < 20.6) {
      // «شكرًا يا كوتش، بجد أنا مش عارف من غير تشجيعك...»: hand on the chest, touched
      const k = seg(f, S(18.2), S(18.6)) * (1 - seg(f, S(20.3), S(20.6)));
      p = lerpPose(p, { ...p, armR: { sx: -0.9, sz: -0.35, twist: 0, elbow: -1.75 }, brow: 0.8, browUp: 0.5, headTilt: 0.14, blush: 0.9, mouth: "smile" }, k);
    } else if (t >= 20.6 && t < 22.9) {
      // «يا ريتك تشجعني في كل حاجة كده»: both hands open toward him
      const k = seg(f, S(20.6), S(21.0)) * (1 - seg(f, S(22.5), S(22.9)));
      p = lerpPose(p, { ...p, armL: { sx: -0.95, sz: 0.55, twist: 0, elbow: -0.6 }, armR: { sx: -0.95, sz: 0.55, twist: 0, elbow: -0.6 }, browUp: 0.8, eyeWide: 1.15, brow: 0.3 }, k);
    }
  }
  return { a: { pose: p, pos: MOHAB_GYM, rot: MOHAB_GYM_ROT }, bar: { y: barY, z: lerp(tz, 0.62, fall), inHands: false } };
};

const coachOffice = (f: number): Actor => {
  const t = f / FPS;
  if (t < T.coachIn) return { pose: restPose(), pos: COACH_OFF_FROM, rot: 1.57 };
  if (t < T.coachLean) {
    const u = seg(f, S(T.coachIn), S(T.coachLean), (x) => x);
    const pos: V3 = [lerp(COACH_OFF_FROM[0], COACH_OFF[0], u), 0, lerp(COACH_OFF_FROM[2], COACH_OFF[2], u)];
    return { pose: { ...walkPose(f * 0.32, 0.9), mouth: "grin" }, pos, rot: 1.45 };
  }
  // leaning over the desk corner toward Mohab: claps, points at the laptop, pumps
  const t2 = t - T.coachLean;
  let p: BlockyPose;
  const phase = Math.floor(t2 / 1.6) % 3;
  if (phase === 0) p = clapPose(f, 0.7, 4);
  else if (phase === 1) p = { ...pointPose(), armR: { sx: -1.25, sz: -0.1, twist: 0, elbow: -0.25 }, mouth: "grin" };
  else p = pumpPose(f, 0);
  p = { ...p, lean: p.lean + 0.28, headPitch: -0.1 };
  const enter = seg(f, S(T.coachLean), S(T.coachLean) + 8);
  return { pose: lerpPose(walkPose(0, 0), p, enter), pos: COACH_OFF, rot: lerp(1.45, 0.95, enter) };
};

const mohabOffice = (f: number): Actor => {
  const t = f / FPS;
  const speed = t < 27 ? 0.9 : 1.5; // he types faster once the coach starts
  const kL = Math.abs(Math.sin(f * speed));
  const kR = Math.abs(Math.sin(f * speed + 1.4));
  let p: BlockyPose = {
    ...seatedBase(),
    armL: { sx: -1.0 - 0.1 * kL, sz: -0.05, twist: 0, elbow: -0.75 + 0.1 * kL },
    armR: { sx: -1.0 - 0.1 * kR, sz: -0.05, twist: 0, elbow: -0.75 + 0.1 * kR },
    lean: 0.12,
    headPitch: 0.22,
    eyeY: -0.6,
    brow: t < 27 ? 0 : 0.5,
    mouth: t < 27 ? "flat" : "wavy",
    blush: t < 27 ? 0 : 0.35,
  };
  // the coach's first «عاش يا مهاب» (26.57 s): he jumps, hands off the keys, turns to him wide-eyed («إنت إيه اللي جابك؟»)
  const J = 26.55;
  const shocked: BlockyPose = {
    ...seatedBase(),
    armL: { sx: -1.5, sz: 0.35, twist: 0, elbow: -1.4 },
    armR: { sx: -1.5, sz: 0.35, twist: 0, elbow: -1.4 },
    lean: -0.12,
    headYaw: -0.75,
    headPitch: -0.05,
    eyeX: -0.8,
    eyeWide: 1.4,
    browUp: 1,
    brow: 0.4,
    mouth: "o",
    mouthOpen: 0.6,
    shrug: 0.6,
  };
  if (t >= J - 0.05 && t < 29.0) {
    const k = clamp(springAt(f, S(J) - 1, 0.7, 3), 0, 1.15) * (1 - seg(f, S(28.4), S(29.0)));
    p = lerpPose(p, shocked, clamp(k, 0, 1));
    p = { ...p, bob: p.bob + 0.12 * Math.max(0, Math.sin(clamp((f - S(J)) / 6) * Math.PI)) };
  } else if (t >= 29.0) {
    // back to typing, faster, stealing glances at the coach
    const g = Math.max(0, Math.sin((t - 29.0) * 1.15 - 0.6));
    const glance = g > 0.75 ? seg(g, 0.75, 0.85) : 0;
    p = { ...p, headYaw: -0.55 * glance, eyeX: -0.9 * glance, eyeY: lerp(-0.6, 0, glance), headPitch: lerp(0.22, 0.05, glance), brow: 0.7 };
  }
  return { pose: p, pos: MOHAB_OFF, rot: 0, seatY: 0.52 };
};

const coachWedding = (f: number): Actor => {
  const t = f / FPS;
  let p: BlockyPose;
  const phase = Math.floor((t - 35.25) / 1.8) % 3;
  if (phase === 0) p = { ...seatedBase(), ...armsOf(pumpPose(f, 0)), mouth: "grin", eyeWide: 1.2 };
  else if (phase === 1) p = { ...seatedBase(), ...armsOf(clapPose(f, 0.7, 5)), mouth: "grin" };
  else p = { ...seatedBase(), ...armsOf(thumbsPose(f)), mouth: "grin" };
  p = { ...p, lean: 0.08, headYaw: 0.25 };
  return { pose: p, pos: STOOL, rot: 0.55, seatY: STOOL_SEAT };
};
const armsOf = (p: BlockyPose) => ({ armL: p.armL, armR: p.armR });

const mohabWedding = (f: number): Actor => {
  const t = f / FPS;
  let p: BlockyPose = { ...seatedBase(), armL: { sx: -0.35, sz: 0.25, twist: 0, elbow: -0.9 }, armR: { sx: -0.35, sz: 0.25, twist: 0, elbow: -0.9 }, mouth: "grin", eyeOpen: 1 };
  if (t < 38.3) {
    // waving at the guests
    const w = Math.sin(f * 0.42);
    p = { ...p, armL: { sx: -0.1, sz: 2.3, twist: 1.57, elbow: -0.55 + w * 0.4 }, headYaw: -0.15 };
  } else if (t < 40.3) {
    // «يا حبيبي»: hand on the chest, head toward the coach
    p = { ...p, armR: { sx: -0.9, sz: -0.35, twist: 0, elbow: -1.7 }, headYaw: 0.45, headTilt: 0.12, eyeOpen: 0.2 };
  } else if (t < 42.2) p = { ...p, ...armsOf(clapPose(f, 0.6, 6)), headYaw: 0.1 };
  else if (t < 44.0) {
    // «وعقبال فرحك»: open hand toward the coach
    p = { ...p, armR: { sx: -1.2, sz: 0.55, twist: 0, elbow: -0.3 }, headYaw: 0.5, browUp: 0.4 };
  } else {
    const w = Math.sin(f * 0.5);
    p = { ...p, armL: { sx: -0.1, sz: 2.3, twist: 1.57, elbow: -0.55 + w * 0.4 }, armR: { sx: -0.1, sz: 2.3, twist: 1.57, elbow: -0.55 - w * 0.4 }, bob: 0.03 * Math.abs(w) };
  }
  return { pose: p, pos: THRONE, rot: 0, seatY: THRONE_SEAT };
};

// the end shot: back in the gym, a new rep starts (frame 0 again, the loop)
const endActors = (f: number) => {
  const t = f / FPS;
  const u = 0.15 + 0.12 * Math.sin((t - 47.8) * 1.3);
  const [by, bz] = barAt(Math.max(0, u - 0.15));
  return {
    coach: { pose: clapPose(f, 0.55, 7), pos: COACH_GYM, rot: COACH_GYM_ROT } as Actor,
    mohab: { pose: bentPose(Math.max(0, u - 0.15), 0.5), pos: MOHAB_GYM, rot: MOHAB_GYM_ROT } as Actor,
    bar: { y: by, z: bz },
  };
};

// ---------------------------------------------------------------- camera
const headOf = (pos: V3, rot: number, lean = 0, bob = 0, seatY?: number): V3 => {
  const hip = (seatY !== undefined ? seatY - 0.84 + 0.92 : 0.92) + bob;
  const up = 1.3;
  const fwd = up * Math.sin(lean);
  return [pos[0] + Math.sin(rot) * fwd, hip + up * Math.cos(lean), pos[2] + Math.cos(rot) * fwd];
};
const cu = (head: V3, dir: V3, dist: number, fov = 32, drop = 0.2): Shot => {
  const n = Math.hypot(dir[0], dir[1], dir[2]);
  return { p: [head[0] + (dir[0] / n) * dist, head[1] + (dir[1] / n) * dist, head[2] + (dir[2] / n) * dist], l: [head[0], head[1] - drop, head[2]], fov };
};
const GYM_WIDE: Shot = { p: [-0.05, 2.3, 8.9], l: [-0.05, 1.5, 0], fov: 40 };
const OFFICE_A: Shot = { p: [OX - 0.85, 2.8, 9.4], l: [OX - 0.85, 1.5, -0.3], fov: 40 };
const OFFICE_B: Shot = { p: [OX - 0.85, 2.65, 8.4], l: [OX - 0.85, 1.55, -0.3], fov: 40 };
const WED: Shot = { p: [WX - 0.25, 2.35, 9.0], l: [WX - 0.25, 1.55, -0.5], fov: 40 };
const END: Shot = { p: [0.55, 3.3, 12.0], l: [0.55, 1.75, 0], fov: 40 };

const shotIndexAt = (t: number) => {
  let i = 0;
  for (let k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k][0]) i = k;
  return i;
};

const baseShot = (name: ShotName, f: number, t0: number): Shot => {
  const t = f / FPS;
  const k = clamp((t - t0) / 4); // slow drift inside a shot
  if (name === "gymWide") return mixShot(GYM_WIDE, { ...GYM_WIDE, p: [GYM_WIDE.p[0], GYM_WIDE.p[1] - 0.1, GYM_WIDE.p[2] - 0.5] }, easeInOut(k));
  if (name === "coachCU") {
    const c = coachGym(f);
    const h = headOf(c.pos, c.rot, c.pose.lean, 0);
    return cu(h, [0.42, 0.05, 0.9], lerp(4.4, 4.1, k), 32, 0.5);
  }
  if (name === "mohabCU") {
    const m = mohabGym(f).a;
    const lean = t < 17 ? Math.min(m.pose.lean, 0.85) : 0;
    const h = headOf(m.pos, m.rot, lean, m.pose.bob);
    // the camera follows the head up the lift, softly
    return cu(h, [-0.45, t < 17 ? 0.15 : 0.05, 0.9], lerp(4.5, 4.2, k), 32, 0.5);
  }
  if (name === "office") return mixShot(OFFICE_A, OFFICE_B, easeOut(clamp((t - 23.9) / 10.8)));
  if (name === "wedding") return mixShot(WED, { ...WED, p: [WED.p[0] + 0.15, WED.p[1], WED.p[2] - 0.6] }, easeInOut(clamp((t - 35.25) / 12)));
  return END;
};

const yawShot = (s: Shot, a: number): Shot => {
  const d: V3 = [s.l[0] - s.p[0], s.l[1] - s.p[1], s.l[2] - s.p[2]];
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const r: V3 = [d[0] * c - d[2] * sn, d[1], d[0] * sn + d[2] * c];
  return { ...s, l: [s.p[0] + r[0], s.p[1] + r[1], s.p[2] + r[2]] };
};

const camAt = (f: number): { c: Shot; blur: number } => {
  const t = f / FPS;
  for (const [a, b] of WHIPS) {
    if (t >= a && t < b) {
      const u = (t - a) / (b - a);
      const before = SHOTS[shotIndexAt(a - 0.01)];
      const after = SHOTS[shotIndexAt(b)];
      const blur = Math.sin(Math.PI * u) ** 2;
      if (u < 0.5) return { c: yawShot(baseShot(before[1], S(a), before[0]), easeIn(u / 0.5) * 1.3), blur };
      return { c: yawShot(baseShot(after[1], S(b), after[0]), -(1 - easeOut((u - 0.5) / 0.5)) * 1.3), blur };
    }
  }
  const [t0, name] = SHOTS[shotIndexAt(t)];
  let c = baseShot(name, f, t0);
  // a small shake when the bar hits the floor
  const k = f - S(T.drop) - 7;
  if (k >= 0 && k < 14) {
    const a = 0.11 * Math.exp(-k / 4);
    c = { ...c, p: [c.p[0] + a * Math.sin(k * 2.3), c.p[1] + a * Math.cos(k * 2.9), c.p[2]] };
  }
  return { c, blur: 0 };
};

// ---------------------------------------------------------------- sets
const Room: React.FC<{ x: number; wall: string; floor: string; trim: string }> = ({ x, wall, floor, trim }) => (
  <group position={[x, 0, 0]}>
    <Part geo={box(11, 0.1, 15)} color={floor} position={[0, -0.05, 3.8]} />
    <Part geo={box(11, 5, 0.2)} color={wall} position={[0, 2.5, -3.6]} />
    <Part geo={box(0.2, 5, 15)} color={wall} position={[-5.5, 2.5, 3.8]} />
    <Part geo={box(0.2, 5, 15)} color={wall} position={[5.5, 2.5, 3.8]} />
    <Part geo={box(11, 0.22, 0.06)} color={trim} position={[0, 0.11, -3.47]} />
    <Part geo={box(11, 0.08, 0.05)} color={trim} position={[0, 1.2, -3.47]} />
  </group>
);

const Frame: React.FC<{ position: V3; w: number; h: number; color: string; inner: string }> = ({ position, w, h, color, inner }) => (
  <group position={position}>
    <Part geo={box(w, h, 0.05)} color={color} />
    <Part geo={box(w - 0.12, h - 0.12, 0.02)} color={inner} position={[0, 0, 0.03]} shadow={false} />
  </group>
);

const Barbell: React.FC<{ position: V3 }> = ({ position }) => (
  <group position={position}>
    <Part geo={cyl(0.035, 0.035, 2.3, 10)} color="#B9BEC6" rotation={[0, 0, Math.PI / 2]} rough={0.35} />
    {[-1, 1].map((k) => (
      <group key={k} position={[k * 0.82, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <Part geo={cyl(0.3, 0.3, 0.11, 24)} color="#D23B32" />
        <Part geo={cyl(0.24, 0.24, 0.09, 24)} color="#2F8C86" position={[0, k * 0.1, 0]} />
        <Part geo={cyl(0.07, 0.07, 0.14, 12)} color="#8E939B" position={[0, k * 0.18, 0]} />
      </group>
    ))}
  </group>
);

const GymSet: React.FC = () => (
  <group>
    <Room x={0} wall="#B7AE84" floor="#9C6B45" trim="#6E5A3C" />
    {/* rug */}
    <Part geo={box(4.6, 0.02, 3.2)} color="#9E3B2E" position={[0, 0.01, 0.3]} />
    <Part geo={box(4.2, 0.022, 2.8)} color="#C6893F" position={[0, 0.012, 0.3]} />
    <Part geo={box(3.8, 0.024, 2.4)} color="#7A2E25" position={[0, 0.014, 0.3]} />
    {/* fridge */}
    <group position={[3.7, 0, -2.75]}>
      <Part geo={rbox(1.15, 2.5, 0.9, 0.12)} color="#EFEDE4" position={[0, 1.25, 0]} />
      <Part geo={box(1.1, 0.03, 0.02)} color="#BDBAB0" position={[0, 1.75, 0.46]} />
      <Part geo={rbox(0.06, 0.4, 0.06, 0.02)} color="#9A988F" position={[-0.42, 2.1, 0.48]} />
      <Part geo={rbox(0.06, 0.5, 0.06, 0.02)} color="#9A988F" position={[-0.42, 1.3, 0.48]} />
    </group>
    {/* desk with an old TV and clutter */}
    <group position={[-2.9, 0, -2.85]}>
      <Part geo={rbox(2.4, 0.1, 0.9, 0.03)} color="#8A5B35" position={[0, 0.95, 0]} />
      {[-1.1, 1.1].map((x) => (
        <Part key={x} geo={box(0.1, 0.95, 0.8)} color="#6E4628" position={[x, 0.47, 0]} />
      ))}
      <Part geo={rbox(0.85, 0.7, 0.7, 0.06)} color="#5B5048" position={[-0.4, 1.36, 0]} />
      <Part geo={box(0.6, 0.48, 0.02)} color="#2E3A3A" position={[-0.45, 1.38, 0.36]} />
      <Part geo={rbox(0.5, 0.35, 0.4, 0.03)} color="#C9B27F" position={[0.55, 1.18, 0]} />
      <Part geo={rbox(0.3, 0.12, 0.3, 0.03)} color="#7FA6A2" position={[0.55, 1.42, 0]} />
    </group>
    {/* posters + a mirror */}
    <Frame position={[-2.6, 3.0, -3.48]} w={1.0} h={1.3} color="#5C3E26" inner="#E3C76E" />
    <Frame position={[-1.2, 3.2, -3.48]} w={0.9} h={0.9} color="#5C3E26" inner="#7FA6A2" />
    <Frame position={[0.3, 2.9, -3.48]} w={1.4} h={1.0} color="#3E2E22" inner="#D9693F" />
    <Frame position={[1.8, 3.3, -3.48]} w={0.8} h={1.1} color="#5C3E26" inner="#F1E1C2" />
    {/* plates stacked + dumbbells on the floor */}
    {[0, 1, 2].map((i) => (
      <Part key={i} geo={cyl(0.32 - i * 0.04, 0.32 - i * 0.04, 0.1, 22)} color={["#2F8C86", "#E3A93B", "#D23B32"][i]} position={[-4.3, 0.05 + i * 0.1, -1.2]} />
    ))}
    <Dumbbell position={[2.9, 0.12, 1.4]} rotation={[0, 0.6, 0]} s={0.45} color="#3F8FD6" />
    <Dumbbell position={[3.3, 0.12, 1.0]} rotation={[0, 0.2, 0]} s={0.45} color="#E3A93B" />
    {/* a hanging bulb */}
    <Part geo={cyl(0.01, 0.01, 1.2, 4)} color="#333" position={[0.4, 4.4, -1.0]} shadow={false} />
    <Part geo={sphere(0.13, 12)} color="#FFE7A8" emissive="#FFD27A" emissiveIntensity={1.4} position={[0.4, 3.75, -1.0]} shadow={false} />
  </group>
);

const OfficeSet: React.FC<{ f: number }> = ({ f }) => (
  <group>
    <Room x={OX} wall="#C9B98F" floor="#8C6A4A" trim="#5E4A35" />
    <Frame position={[OX - 2.3, 3.0, -3.48]} w={1.1} h={0.8} color="#4A3828" inner="#BFD3C8" />
    <Frame position={[OX + 2.4, 3.1, -3.48]} w={0.8} h={1.0} color="#4A3828" inner="#E8D9B0" />
    <Frame position={[OX + 0.1, 3.4, -3.48]} w={1.4} h={0.5} color="#4A3828" inner="#D9693F" />
    {/* shelf with files */}
    <Part geo={box(1.6, 0.08, 0.4)} color="#6E4628" position={[OX - 3.5, 2.0, -3.3]} />
    {[0, 1, 2, 3, 4].map((i) => (
      <Part key={i} geo={box(0.18, 0.5, 0.32)} color={["#2F8C86", "#D9693F", "#E3A93B", "#3F8FD6", "#8E6CC9"][i]} position={[OX - 4.1 + i * 0.25, 2.29, -3.3]} />
    ))}
    {/* plant */}
    <group position={[OX + 4.2, 0, -2.6]}>
      <Part geo={cyl(0.3, 0.24, 0.6, 14)} color="#B4502E" position={[0, 0.3, 0]} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Part key={i} geo={sphere(0.32, 8)} color={i % 2 ? "#5BA25B" : "#3E7D45"} flat position={[Math.sin(i * 1.05) * 0.25, 0.95 + (i % 3) * 0.25, Math.cos(i * 1.05) * 0.25]} />
      ))}
    </group>
    {/* desk */}
    <group position={DESK}>
      <Part geo={rbox(2.8, 0.1, 1.2, 0.03)} color="#A0693B" position={[0, 0.95, 0]} />
      <Part geo={box(2.7, 0.85, 0.06)} color="#87562F" position={[0, 0.47, 0.55]} />
      {[-1.33, 1.33].map((x) => (
        <Part key={x} geo={box(0.08, 0.92, 1.1)} color="#87562F" position={[x, 0.46, 0]} />
      ))}
      {/* pen cup, papers */}
      <Part geo={cyl(0.09, 0.08, 0.22, 12)} color="#5D6670" position={[-1.0, 1.11, 0.2]} />
      {[-0.05, 0.03, 0.08].map((x, i) => (
        <Part key={i} geo={cyl(0.012, 0.012, 0.28, 6)} color={["#D23B32", "#3F8FD6", "#E3A93B"][i]} position={[-1.0 + x, 1.25, 0.2 + x]} rotation={[0.1 * i, 0, x * 3]} />
      ))}
      <Part geo={box(0.5, 0.04, 0.38)} color="#F6F3EA" position={[1.0, 1.02, 0.15]} rotation={[0, 0.2, 0]} />
      <Part geo={box(0.5, 0.04, 0.38)} color="#ECE6D6" position={[1.02, 1.06, 0.13]} rotation={[0, -0.1, 0]} />
      {/* laptop: screen faces Mohab, its back to the camera */}
      <group position={[0.1, 1.0, -0.15]}>
        <Part geo={rbox(0.8, 0.04, 0.55, 0.02)} color="#2B2F3A" />
        <group position={[0, 0.02, 0.27]} rotation={[0.25, 0, 0]}>
          <Part geo={rbox(0.8, 0.55, 0.035, 0.02)} color="#2B2F3A" position={[0, 0.27, 0]} />
          <Part geo={box(0.72, 0.47, 0.005)} color="#BFE3FF" emissive="#9FD0FF" emissiveIntensity={0.7} position={[0, 0.27, -0.02]} shadow={false} />
          <Part geo={circle(0.04, 16)} color="#C8CCD4" basic position={[0, 0.3, 0.02]} shadow={false} />
        </group>
      </group>
    </group>
    {/* office chair */}
    <group position={[MOHAB_OFF[0], 0, MOHAB_OFF[2] - 0.35]}>
      <Part geo={rbox(0.85, 0.12, 0.8, 0.05)} color="#2B2F3A" position={[0, 0.5, 0.25]} />
      <Part geo={rbox(0.85, 1.0, 0.14, 0.06)} color="#2B2F3A" position={[0, 1.05, -0.12]} />
      <Part geo={cyl(0.05, 0.05, 0.45, 8)} color="#5D6670" position={[0, 0.22, 0.2]} />
    </group>
    {/* a wall clock that runs */}
    <group position={[OX + 1.2, 3.0, -3.45]}>
      <Part geo={cyl(0.38, 0.38, 0.06, 28)} color="#F6F3EA" rotation={[Math.PI / 2, 0, 0]} />
      <Part geo={box(0.03, 0.26, 0.02)} color={INK} position={[0, 0.1, 0.05]} rotation={[0, 0, -f * 0.05]} shadow={false} />
      <Part geo={box(0.04, 0.18, 0.02)} color={INK} position={[0, 0.06, 0.05]} rotation={[0, 0, -f * 0.004]} shadow={false} />
    </group>
  </group>
);

const WeddingSet: React.FC<{ f: number }> = ({ f }) => (
  <group>
    <Room x={WX} wall="#5F6E4C" floor="#7A3F2E" trim="#C9A44A" />
    {/* wallpaper stripes */}
    {Array.from({ length: 14 }, (_, i) => (
      <Part key={i} geo={box(0.06, 5, 0.02)} color="#6D7D58" position={[WX - 5.2 + i * 0.8, 2.5, -3.49]} shadow={false} />
    ))}
    {/* a window with lace curtains */}
    <group position={[WX - 2.6, 2.6, -3.46]}>
      <Part geo={box(1.9, 2.4, 0.04)} color="#F6EBD0" emissive="#FFF4DA" emissiveIntensity={0.5} />
      {[-1, 1].map((k) => (
        <Part key={k} geo={box(0.8, 2.5, 0.05)} color="#FFFFFF" opacity={0.85} position={[k * 0.62, 0, 0.05]} />
      ))}
      <Part geo={box(2.2, 0.12, 0.1)} color="#C9A44A" position={[0, 1.3, 0.06]} />
    </group>
    {/* string lights */}
    {Array.from({ length: 18 }, (_, i) => {
      const x = WX - 4.5 + i * 0.55;
      const y = 4.3 - 0.35 * Math.sin((i / 17) * Math.PI);
      const on = 0.6 + 0.4 * Math.sin(f * 0.15 + i * 1.3);
      return <Part key={i} geo={sphere(0.06, 8)} color="#FFE7A8" emissive="#FFC94D" emissiveIntensity={1.2 * on} position={[x, y, -3.4]} shadow={false} />;
    })}
    {/* the throne */}
    <group position={THRONE}>
      <Part geo={rbox(1.5, 0.26, 1.1, 0.08)} color="#B4232F" position={[0, THRONE_SEAT - 0.13, 0.1]} />
      <Part geo={rbox(1.6, 2.6, 0.26, 0.12)} color="#C9A44A" position={[0, 1.6, -0.48]} />
      <Part geo={rbox(1.36, 2.3, 0.1, 0.1)} color="#B4232F" position={[0, 1.6, -0.33]} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => <Part key={`${r}${c}`} geo={sphere(0.04, 8)} color="#7E1720" position={[-0.4 + c * 0.4, 1.0 + r * 0.55, -0.27]} shadow={false} />),
      )}
      <Part geo={sphere(0.22, 12)} color="#C9A44A" position={[0, 2.95, -0.48]} />
      {[-1, 1].map((k) => (
        <group key={k}>
          <Part geo={rbox(0.2, 0.55, 1.0, 0.06)} color="#C9A44A" position={[k * 0.82, THRONE_SEAT + 0.15, 0.1]} />
          <Part geo={rbox(0.14, THRONE_SEAT - 0.2, 0.14, 0.04)} color="#9C7A2E" position={[k * 0.6, (THRONE_SEAT - 0.2) / 2, 0.5]} />
        </group>
      ))}
    </group>
    {/* the coach's stool */}
    <group position={STOOL}>
      <Part geo={cyl(0.38, 0.38, 0.1, 18)} color="#8A5B35" position={[0, STOOL_SEAT - 0.05, 0]} />
      {[0, 1, 2].map((i) => (
        <Part key={i} geo={cyl(0.04, 0.04, STOOL_SEAT - 0.1, 6)} color="#6E4628" position={[Math.sin(i * 2.1) * 0.25, (STOOL_SEAT - 0.1) / 2, Math.cos(i * 2.1) * 0.25]} />
      ))}
    </group>
    {/* floor lamp */}
    <group position={[WX + 2.3, 0, -1.6]}>
      <Part geo={cyl(0.25, 0.3, 0.06, 16)} color="#2B2B30" position={[0, 0.03, 0]} />
      <Part geo={cyl(0.03, 0.03, 2.2, 8)} color="#2B2B30" position={[0, 1.1, 0]} />
      <Part geo={cyl(0.3, 0.45, 0.5, 18)} color="#FFE08A" emissive="#FFC94D" emissiveIntensity={0.9} position={[0, 2.35, 0]} />
    </group>
    {/* a flower stand */}
    <group position={[WX - 3.9, 0, -2.4]}>
      <Part geo={cyl(0.18, 0.25, 1.0, 12)} color="#C9A44A" position={[0, 0.5, 0]} />
      {Array.from({ length: 7 }, (_, i) => (
        <Part key={i} geo={sphere(0.17, 8)} color={["#FFFFFF", "#F07E86", "#F6F3EA"][i % 3]} position={[Math.sin(i) * 0.25, 1.15 + (i % 3) * 0.12, Math.cos(i) * 0.25]} />
      ))}
    </group>
    {/* carpet runner */}
    <Part geo={box(2.0, 0.02, 6)} color="#A3262F" position={[WX + 0.55, 0.01, 1.5]} />
  </group>
);

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
    cam.left = -12; cam.right = 12; cam.top = 12; cam.bottom = -12; cam.near = 1; cam.far = 80;
    cam.updateProjectionMatrix();
    return { light: l, tgt: t };
  }, []);
  const roomX = target[0] < 20 ? 0 : target[0] < 60 ? OX : WX;
  tgt.position.set(roomX, 0, 0);
  light.position.set(roomX - 7, 14, 12);
  light.intensity = 2.0;
  light.color.set("#FFE9C8");
  return (
    <>
      <primitive object={tgt} />
      <primitive object={light} />
    </>
  );
};

// ---------------------------------------------------------------- the world
const Person: React.FC<{ a: Actor; colors: BlockyColors; extra?: Partial<React.ComponentProps<typeof Blocky>> }> = ({ a, colors, extra }) => {
  const y = a.seatY !== undefined ? a.seatY - 0.84 : 0;
  const z = a.seatY !== undefined ? 0.08 : 0;
  return (
    <group position={[a.pos[0], y, a.pos[2] + z]} rotation={[0, a.rot, 0]}>
      <Blocky pose={a.pose} colors={colors} noBlob={a.seatY !== undefined} {...extra} />
    </group>
  );
};

const World: React.FC<{ f: number; c: Shot; talk: Talk; loud: number[] }> = ({ f, c, talk, loud }) => {
  const t = f / FPS;
  const inGym = t < 23.65 || t >= 47.55;
  const inOffice = t >= 23.65 && t < 35.0;
  const inWed = t >= 35.0 && t < 47.55;
  const coachExtra = { headband: "#D42A2A", sleeves: "#2456A6", trousers: "#1E3F7A", chest: <Stripe />, headgear: <Moustache /> };
  const speak = (who: "coach" | "mohab", p: BlockyPose, seed: number) => withMouth(alive(p, f, seed, 0.6), talk[who], loud, f);
  const nodes: React.ReactNode[] = [];
  if (inGym) {
    if (t < 47.55) {
      const co = coachGym(f);
      const mo = mohabGym(f);
      nodes.push(<Person key="c" a={{ ...co, pose: speak("coach", co.pose, 11) }} colors={COACH_C} extra={{ ...coachExtra, rightHand: t >= 16.8 ? <Thumb /> : undefined, leftHand: t >= 16.8 ? <Thumb /> : undefined }} />);
      nodes.push(
        <group key="m">
          <Person a={{ ...mo.a, pose: speak("mohab", mo.a.pose, 23) }} colors={MOHAB_GYM_C} extra={{ headgear: <MessyHair /> }} />
          <group position={mo.a.pos} rotation={[0, mo.a.rot, 0]}>
            <Barbell position={[0, mo.bar.y, mo.bar.z]} />
          </group>
        </group>,
      );
    } else {
      const e = endActors(f);
      nodes.push(<Person key="c" a={{ ...e.coach, pose: alive(e.coach.pose, f, 11, 0.6) }} colors={COACH_C} extra={coachExtra} />);
      nodes.push(
        <group key="m">
          <Person a={{ ...e.mohab, pose: alive(e.mohab.pose, f, 23, 0.4) }} colors={MOHAB_GYM_C} extra={{ headgear: <MessyHair /> }} />
          <group position={e.mohab.pos} rotation={[0, e.mohab.rot, 0]}>
            <Barbell position={[0, e.bar.y, e.bar.z]} />
          </group>
        </group>,
      );
    }
  }
  if (inOffice) {
    const co = coachOffice(f);
    const mo = mohabOffice(f);
    nodes.push(<Person key="oc" a={{ ...co, pose: speak("coach", co.pose, 12) }} colors={COACH_C} extra={coachExtra} />);
    nodes.push(<Person key="om" a={{ ...mo, pose: speak("mohab", mo.pose, 24) }} colors={MOHAB_OFF_C} extra={{ headgear: <MessyHair />, sleeves: "#F4F4F2", trousers: "#4A4F5A", chest: <Tie /> }} />);
  }
  if (inWed) {
    const co = coachWedding(f);
    const mo = mohabWedding(f);
    nodes.push(<Person key="wc" a={{ ...co, pose: speak("coach", co.pose, 13) }} colors={COACH_C} extra={{ ...coachExtra, rightHand: co.pose.armR.sx < -1.2 && co.pose.armR.sx > -1.3 ? <Thumb /> : undefined }} />);
    nodes.push(<Person key="wm" a={{ ...mo, pose: speak("mohab", mo.pose, 25) }} colors={MOHAB_WED_C} extra={{ headgear: <MessyHair />, sleeves: "#17171B", trousers: "#17171B", chest: <SuitBowTie jacket="#17171B" /> }} />);
  }
  return (
    <>
      <color attach="background" args={["#E9D3AE"]} />
      <hemisphereLight args={["#FFF4E2", "#8A6A4E", 1.5]} />
      <ambientLight intensity={0.25} />
      <SunRig target={c.l} />
      <ShotRig shot={c} />
      <Part geo={box(200, 0.05, 60)} color="#D9BE90" position={[40, -0.12, 0]} shadow={false} />
      <GymSet />
      <OfficeSet f={f} />
      <WeddingSet f={f} />
      {nodes}
    </>
  );
};

// ---------------------------------------------------------------- the ending overlays
const PHONE: AppPhoneSpec = {
  screens: ["footage/da7ee7-gym-intro/app/card.png", "footage/da7ee7-gym-intro/app/match.png"],
  img: { w: 1080, h: 2402 },
  rest: { x: 640, y: 110, w: 360 },
  focus: { x0: 98, y0: 795, x1: 984, y1: 1105 },
  to: { x: 780, y: 560 },
  zoom: 1.3,
  button: { x0: 52, y0: 1800, x1: 1028, y1: 1944 },
  accent: LIME,
};

const Logo: React.FC<{ f: number; end: number }> = ({ f, end }) => {
  const a = S(T.logo);
  if (f < a - 2) return null;
  const s = clamp(springAt(f, a - 2, 0.5, 5), 0, 1.2);
  const sweep = seg(f, a + 8, a + 30, easeInOut);
  const float = 8 * Math.sin((f - a) * 0.08);
  const src = staticFile("footage/da7ee7-gym-intro/logo.svg");
  return (
    <div style={{ position: "absolute", left: 70, top: 90 + float, width: 400, height: 380, transform: `scale(${0.75 * s})`, transformOrigin: "50% 50%" }}>
      <div style={{ position: "absolute", inset: -40, borderRadius: "50%", background: "radial-gradient(circle, rgba(214,255,60,0.45) 0%, rgba(214,255,60,0) 65%)" }} />
      <Img src={src} style={{ position: "absolute", left: 0, top: 0, width: 400, height: 362, filter: "drop-shadow(0 16px 26px rgba(0,0,0,0.35))" }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: 400, height: 362, overflow: "hidden", WebkitMaskImage: `url(${src})`, WebkitMaskSize: "100% 100%", maskImage: `url(${src})`, maskSize: "100% 100%" }}>
        <div style={{ position: "absolute", top: -100, left: lerp(-300, 520, sweep), width: 120, height: 600, background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.85), rgba(255,255,255,0))", transform: "rotate(20deg)" }} />
      </div>
      <div dir="rtl" style={{ position: "absolute", left: -130, top: 360, width: 660, textAlign: "center", fontFamily: AR, fontWeight: 900, fontSize: 76, color: INK, textShadow: "0 0 20px rgba(255,255,255,0.9)", opacity: seg(f, a + 4, a + 12) }}>
        تمرينة
      </div>
    </div>
  );
};

const DebugOverlay: React.FC<{ info: string }> = ({ info }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 20, top: 20, right: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "22px monospace", padding: 8, whiteSpace: "pre-wrap" }}>{info}</div>
  </AbsoluteFill>
);

export const FactCoach: React.FC<CoachProps> = ({ durationSec = COACH_DURATION, talk = { coach: [], mohab: [] }, loud = [], debug = false }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const { c, blur } = camAt(frame);
  const end = Math.ceil(durationSec * FPS);
  void COACH_AUDIO;
  void hash;
  void torusArc;
  return (
    <AbsoluteFill style={{ backgroundColor: "#E9D3AE" }}>
      <AbsoluteFill style={{ filter: blur > 0.01 ? `blur(${(blur * 7).toFixed(2)}px)` : undefined }}>
        <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 40, near: 0.1, far: 400, position: [0, 2, 9] }} gl={{ antialias: true }}>
          <World f={frame} c={c} talk={talk} loud={loud} />
        </ThreeCanvas>
      </AbsoluteFill>
      <AppPhone f={frame} t={{ inF: S(T.phoneIn), pushF: S(T.phoneIn) + 12, tapF: S(T.phoneTap), outF: end + 30 }} spec={PHONE} />
      <Logo f={frame} end={end} />
      {debug && <DebugOverlay info={`f${frame} ${(frame / FPS).toFixed(2)}s  p ${c.p.map((v) => v.toFixed(2)).join(",")} l ${c.l.map((v) => v.toFixed(2)).join(",")}`} />}
    </AbsoluteFill>
  );
};
