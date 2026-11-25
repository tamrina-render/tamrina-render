import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { PAL } from "./fact3d/parts";
import { clamp, easeInOut, easeOut, lerp, seg } from "./fact3d/anim";
import { alive, lerpPose, walkPose } from "./fact3d/acting";
import { Moustache, GradientSky } from "./fact3d/titanic";
import { Key, sampleTrack } from "./fact3d/mob";
import { mixC, plankTex } from "./fact3d/zander";
import { AppPhone, AppPhoneSpec } from "./fact3d/AppPhone";
import { BED, BED_PTS, CampIsland, DECK_X, DOOR, HUT_WIN, HutShell, HutSkin, HutWindow, Morph, PPAL, Plant, RefBed, ROOM, Room, Spring, StudioBits, V3, asBed, asReformer } from "./fact3d/pilates";
import { FIN_FOV, FIN_L, FIN_P, PIL_DURATION, PIL_STARTS, PIL_WORDS, PilWords, R1, R2, pushPlan, refWorld, seatWorld, slideAt } from "./fact3d/pilatesTiming";
import { loadFonts } from "../lib/fonts";

loadFonts();

// The Pilates Reformer began as a hospital bed (Joseph Pilates, Knockaloe camp, Isle of Man, 1915). ONE camera journey:
//  L1 a bright studio, a Reformer sliding by itself; on «بسرير مستشفى» the colour drains and it becomes an iron bed (the hut rises)
//  L2 the ward; the man by the barred window; out through the bars: huts + wire fence, the island, England far away
//  L3 dive back in: he pulls coil springs from under the bed, ties them to the posts; a patient lying down pulls one with
//     his arm, works the other with his leg  L4 the door opens to light; the bed changes back piece by piece into the Reformer,
//     the hut sinks, the studio returns; the springs light up, the carriage slides. Camera locked from `lock` (<= 21.9 s).
//  L5-9 Mrs. Coin (drawn by the engine on top) rides carriage 1; the real app screens on a flat phone; carriage 2 for the friend.

export type FactPilatesProps = {
  starts?: number[];
  words?: Partial<PilWords>;
  durationSec?: number;
  phoneScreens?: [string, string];
  debug?: boolean;
};

type B = ReturnType<typeof makeBeats>;
const makeBeats = (starts: number[] | undefined, words: Partial<PilWords> | undefined, fps: number, durationSec: number) => {
  const sec = PIL_STARTS.map((d, i) => starts?.[i] ?? d);
  const ws = { ...PIL_WORDS, ...(words ?? {}) } as PilWords;
  const F = (t: number) => Math.round(t * fps);
  const w = Object.fromEntries(Object.entries(ws).map(([k, v]) => [k, F(v)])) as PilWords;
  const pushes = pushPlan(ws, durationSec);
  return {
    fps,
    s: sec.map(F),
    w,
    ws,
    pushes,
    end: F(durationSec),
    // L1 change: bed + drain + hut
    m1: w.bed,
    drainA: w.bed,
    drainB: w.bed + 16,
    hutA: w.bed + 4,
    hutB: w.n110 - 4,
    // L2 flight out / dive in
    out0: w.jailed - 3,
    diveA: F(sec[2]) - 2,
    diveB: w.untie - 7,
    // L3
    coil1: w.untie, // the first coil comes off on «فك»
    coil2: w.beds + 1,
    tieB: w.tie, // the foot post first («وربطها»), then the head post
    tieA: w.tie + 19,
    pullA: w.patients + 2,
    legA: w.lying - 4,
    // L4
    walkOut: w.patients + 2,
    door: w.out,
    flash: w.out + 5,
    m2: w.thebed + 1,
    hutDown: w.thebed + 6,
    glow: w.bysprings - 3,
    lock: Math.min(F(sec[4]) - 12, w.reformer + 30),
    ghostOut: F(sec[4]) + 9,
    // the phone
    phIn: w.wait - 3,
    phPush: w.wait + 8, // the push on «استني كده»
    ring1: w.girl - 1,
    ring2: w.same - 1,
    tap: w.sent,
    swap: w.accepted - 1, // «تمرينتكم اتأكدت!» on «ووافقت»
    phOut: w.accepted + 14,
  };
};

// ---------------------------------------------------------------- camera
const L1w = (lx: number, ly: number, lz: number) => refWorld(R1, lx, ly, lz);
const ln = Math.log;
const k = (f: number, p: V3, l: V3, fov = 40, still = false): Key => ({ f, p, l, fov, still });
const fixKeys = (keys: Key[]) => {
  for (let i = 1; i < keys.length; i++) if (keys[i].f <= keys[i - 1].f) keys[i] = { ...keys[i], f: keys[i - 1].f + 1 };
  return keys;
};
const MAN_SPOT: V3 = [-3.0, 0, 2.0]; // L2: he stands beside the barred window
const WIN_C: V3 = [(HUT_WIN.x0 + HUT_WIN.x1) / 2, (HUT_WIN.y0 + HUT_WIN.y1) / 2, ROOM.zb];

const makeKeys = (b: B) => {
  const W = b.w;
  // A: the studio, the bed, the ward, the man (normal space)
  const A = fixKeys([
    k(0, [-6.3, 4.2, 13.6], [-0.2, 0.7, 5.4], 46),
    k(b.m1 - 3, [-5.3, 3.5, 12.0], [-0.5, 0.8, 5.7], 44, true),
    k(W.n110 - 6, [-5.0, 3.4, 11.6], [-0.6, 0.85, 5.8], 44, true),
    // «من 110 سنة»: back and up, the ward (beds, patients)
    k(W.man - 6, [-4.6, 5.6, 14.2], [0.6, 0.8, 4.4], 44, true),
    // «واحد ألماني اسمه جوزيف بيلاتس»: across to him, beside the barred window
    k(W.man + 20, [-2.2, 2.9, 7.8], [-3.35, 2.1, 2.0], 40, true),
    k(b.out0, [-1.5, 2.85, 6.2], [WIN_C[0], 2.85, 1.2], 40, true),
  ]);
  // F: out through the bars, up over the camp, the island, England, the dive back in (p.y in log space)
  const C0p = L1w(-2.3, 1.3, -3.0);
  const C0l = L1w(-1.35, 0.85, 0.1);
  const Fk = fixKeys([
    k(b.out0, [-1.5, ln(2.85), 6.2], [WIN_C[0], 2.85, 1.2], 40, true),
    k(W.camp - 9, [WIN_C[0], ln(3.0), -0.8], [-1.4, 2.0, -14], 46),
    k(W.camp + 3, [-1.5, ln(40), -2.0], [-1.5, 0, -40], 50),
    k(W.camp + 14, [-2.0, ln(80), -4.0], [-3, 0, -30], 48),
    k(W.island, [-6, ln(250), 70], [-6, 0, -18], 42, true),
    k(W.england + 14, [70, ln(980), 300], [70, 0, -120], 44, true),
    k(b.diveA, [71, ln(985), 301], [71, 0, -121], 44, true),
    k(b.diveA + 18, [-2.4, ln(18), 9.2], [-1.3, 0.8, 6.6], 44, true),
    k(b.diveB, [C0p[0], ln(C0p[1]), C0p[2]], C0l, 42, true),
  ]);
  // C: L3 + L4 inside, then into the locked frame
  const C = fixKeys([
    k(b.diveB, C0p, C0l, 42, true),
    k(b.coil2 + 8, L1w(-2.25, 1.3, -2.85), L1w(-1.35, 0.85, 0.1), 42, true),
    // «وربطها»: beside the foot post, he hooks coil B on it (profile, nothing between him and the lens)
    k(b.tieB - 4, L1w(-2.4, 2.3, -3.4), L1w(-1.55, 1.5, 0.45), 42, true),
    k(b.tieB + 9, L1w(-2.3, 2.35, -3.45), L1w(-1.45, 1.5, 0.45), 42, true),
    // back to the whole bed: coil A on the head post, the arm pull, the leg
    k(b.pullA + 2, L1w(0.0, 3.3, -5.6), L1w(0.0, 1.35, 0.1), 44, true),
    k(b.legA - 6, L1w(-0.3, 3.1, -5.2), L1w(-0.45, 1.3, 0.1), 44, true),
    k(b.legA + 14, L1w(-0.35, 3.1, -5.25), L1w(-0.5, 1.3, 0.1), 44, true),
    // «ولما خرج»: the door (left) and the bed (right) in one frame
    k(W.out - 4, [4.6, 3.8, 14.6], [-3.0, 1.2, 6.0], 56, true),
    k(b.flash, [4.5, 3.8, 14.6], [-2.9, 1.2, 6.0], 56, true),
    // «السرير ده بقى الـ Reformer»: the bed centred and large, it changes on screen
    k(W.thebed + 2, [-0.9, 3.6, 13.6], [-0.85, 0.9, 6.0], 46, true),
    k(W.reformer + 2, [-0.95, 3.65, 13.7], [-0.82, 0.9, 6.0], 46, true),
    k(b.lock, FIN_P, FIN_L, FIN_FOV, true),
  ]);
  return { A, Fk, C };
};
type Keys = ReturnType<typeof makeKeys>;

const camRaw = (K: Keys, b: B, f: number): { p: V3; l: V3; fov: number } => {
  if (f >= b.lock) return { p: FIN_P, l: FIN_L, fov: FIN_FOV };
  if (f < b.out0) return sampleTrack(K.A, f);
  if (f < b.diveB) {
    const c = sampleTrack(K.Fk, f);
    return { p: [c.p[0], Math.exp(c.p[1]), c.p[2]], l: c.l, fov: c.fov };
  }
  return sampleTrack(K.C, f);
};
/**
 * The caption row (chunk captions, y ~1080-1340) must never sit on the subject in the history half: every key aims AT
 * its subject, and the camera is pitched down by a fixed share of its field of view (~380 px), so the subject rides in
 * y ~330-1050 and the row falls on floor / wall / sea. The tilt eases out during the move into the locked frame
 * (from «Reformer» to `lock`), so the locked camera itself is untouched.
 */
const CAP_TILT = 0.2; // degrees of pitch per degree of vertical fov (0.2 * 1920 px ~ 384 px)
const camAt = (K: Keys, b: B, f: number): { p: V3; l: V3; fov: number } => {
  const c = camRaw(K, b, f);
  const k = f >= b.lock ? 0 : 1 - seg(f, b.w.reformer + 2, b.lock, easeInOut);
  if (k <= 0) return c;
  const d = [c.l[0] - c.p[0], c.l[1] - c.p[1], c.l[2] - c.p[2]];
  const h = Math.hypot(d[0], d[2]);
  if (h < 1e-3) return c;
  const len = Math.hypot(h, d[1]);
  const pitch = Math.atan2(d[1], h) - ((k * CAP_TILT * c.fov) / 180) * Math.PI;
  return { p: c.p, l: [c.p[0] + (d[0] / h) * Math.cos(pitch) * len, c.p[1] + Math.sin(pitch) * len, c.p[2] + (d[2] / h) * Math.cos(pitch) * len], fov: c.fov };
};

const CameraRig: React.FC<{ c: { p: V3; l: V3; fov: number } }> = ({ c }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(...c.p);
  camera.up.set(0, 1, 0);
  camera.lookAt(...c.l);
  const near = c.p[1] > 40 ? 1 : 0.05;
  if (camera.fov !== c.fov || camera.near !== near || camera.far !== 6000) {
    camera.fov = c.fov;
    camera.near = near;
    camera.far = 6000;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  return null;
};

/** Screen position (px) of a world point for a camera state. */
const projector = () => {
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.1, 3000);
  return (c: { p: V3; l: V3; fov: number }, w: V3) => {
    cam.fov = c.fov;
    cam.position.set(...c.p);
    cam.lookAt(...c.l);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const v = new THREE.Vector3(...w).project(cam);
    return { x: ((v.x + 1) / 2) * 1080, y: ((1 - v.y) / 2) * 1920 };
  };
};

// ---------------------------------------------------------------- people
type Outfit = { colors: BlockyColors; trousers?: string; sleeves?: string; headgear?: React.ReactNode };
const MAN: Outfit = {
  colors: { skin: "#E6B48C", shirt: "#F3F1EA", pants: "#2E2D33", shoes: "#1C1B1E", hair: "#5B3D27", face: PAL.ink },
  trousers: "#2E2D33",
  headgear: <Moustache color="#4A3020" />,
};
const PJ = ["#9BA6B2", "#A9A08F", "#8E9AA8", "#A3AC9A", "#9C98A6"];
const SKINS = ["#E2AE84", "#D9A27A", "#EDBE97", "#C98A63", "#E0A982"];
const patient = (i: number): Outfit => ({
  colors: { skin: SKINS[i % 5], shirt: PJ[i % 5], pants: PJ[i % 5], shoes: SKINS[i % 5], hair: ["#3B2A20", "#6B4A2E", "#2A2420", "#8A6A4A", "#4A3A2C"][i % 5], face: PAL.ink },
  trousers: PJ[i % 5],
  sleeves: PJ[i % 5],
});
const Person: React.FC<{ o: Outfit; pose: BlockyPose; pos: V3; rot: number; scale?: number; noBlob?: boolean; rightHand?: React.ReactNode; leftHand?: React.ReactNode }> = ({ o, pose, pos, rot, scale = 1, noBlob, rightHand, leftHand }) => (
  <Blocky pose={pose} colors={o.colors} position={pos} rotationY={rot} scale={scale} trousers={o.trousers} sleeves={o.sleeves} headgear={o.headgear} noBlob={noBlob} rightHand={rightHand} leftHand={leftHand} />
);

// lying in a bed (bed-local): feet at x = LX, head toward the head end, face up, his right side toward the camera (-z)
const LS = 0.88;
const LX = -0.63;
const lyingY = () => BED.top + BED.matT + 0.25 * LS;
const Lying: React.FC<{ r: { p: V3; yaw: number }; o: Outfit; pose: BlockyPose; blanket?: boolean; sink?: number }> = ({ r, o, pose, blanket, sink = 0 }) => (
  <group position={[r.p[0], r.p[1] + sink, r.p[2]]} rotation={[0, r.yaw, 0]}>
    <group position={[LX, lyingY(), 0]} rotation={[0, -Math.PI / 2, 0]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Person o={o} pose={pose} pos={[0, 0, 0]} rot={0} scale={LS} noBlob />
      </group>
    </group>
    {blanket && <BlanketBox />}
  </group>
);
const BlanketBox: React.FC = () => {
  const g = useMemo(() => new THREE.BoxGeometry(2.0, 0.2, BED.W - 0.02), []);
  return (
    <mesh geometry={g} position={[-0.38, BED.top + BED.matT + 0.2, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={PPAL.blanket} roughness={0.9} />
    </mesh>
  );
};
/** bed-local hand / foot of the lying man (right side), for the springs */
const lyingHand = (sx: number): V3 => {
  const sh: V3 = [LX + 1.64 * LS, lyingY(), -0.53 * LS];
  const a = 0.82 * LS;
  return [sh[0] - a * Math.cos(sx), sh[1] - a * Math.sin(sx), sh[2]];
};
const lyingFoot = (hip: number, knee: number): V3 => {
  const hp: V3 = [LX + 0.92 * LS, lyingY(), -0.2 * LS];
  const t = 0.42 * LS;
  const s = 0.46 * LS;
  const kx = hp[0] - t * Math.cos(hip);
  const ky = hp[1] - t * Math.sin(hip);
  return [kx - s * Math.cos(hip + knee), ky - s * Math.sin(hip + knee), hp[2]];
};
const lyingRest = (f: number, seed: number): BlockyPose => {
  const p = alive(restPose(), f, seed, 0.4);
  p.armL = { sx: 0, sz: 0.12, twist: 0, elbow: -0.1 };
  p.armR = { sx: 0, sz: 0.12, twist: 0, elbow: -0.1 };
  p.legL = { hip: 0, sz: 0.04, knee: 0 };
  p.legR = { hip: 0, sz: 0.04, knee: 0 };
  p.bob = 0;
  return p;
};

// ---------------------------------------------------------------- the exercising patient (bed 1) and his two springs
const ARM_REST = -2.75; // right hand overhead, near the head post
const armSx = (f: number, b: B) => {
  const grab = seg(f, b.pullA - 6, b.pullA + 4, easeInOut); // the hand goes up to the loop
  const sx0 = lerp(0, ARM_REST, grab);
  if (f < b.pullA + 4) return sx0;
  // two pulls: down to above the hip and back up
  const u = (f - b.pullA - 4) / 16;
  const n = Math.floor(u);
  if (n >= 2) return ARM_REST + (0 - ARM_REST) * seg(f, b.pullA + 4 + 32, b.pullA + 4 + 42);
  return lerp(ARM_REST, -0.85, Math.pow(Math.sin((u - n) * Math.PI), 1.3));
};
const legAt = (f: number, b: B) => {
  const hook = seg(f, b.legA - 8, b.legA + 2, easeInOut);
  if (f < b.legA + 2) return { hip: lerp(0, -1.5, hook), knee: lerp(0, 2.0, hook) };
  const u = (f - b.legA - 2) / 14;
  const q = Math.pow(Math.sin(u * Math.PI), 2) * (f < b.flash ? 1 : 0);
  // bent (spring stretched) <-> pushed out straight
  return { hip: lerp(-1.5, -0.3, q), knee: lerp(2.0, 0.08, q) };
};

// ---------------------------------------------------------------- the man (Joseph Pilates)
/** where he is (world), facing, pose, and what is in his hands */
const manAt = (f: number, b: B): { pos: V3; rot: number; pose: BlockyPose; inR: boolean; inL: boolean } | null => {
  const W = b.w;
  let pose = alive(restPose(), f, 5, 0.7);
  pose.mouth = "flat";
  pose.brow = 0.2;
  if (f < b.diveA) {
    if (f < W.man - 10) return null;
    // beside the barred window, turned a little toward it; on «اتحبس» he looks out through the bars
    const look = seg(f, W.jailed - 4, W.jailed + 6, easeInOut);
    pose.headYaw += 0.55 * look;
    pose.headPitch = -0.1 * look;
    pose.armR = { sx: lerp(0, -1.9, look), sz: 0.15, twist: 0, elbow: lerp(-0.15, -0.9, look) };
    return { pos: MAN_SPOT, rot: lerp(0.25, 0.7, look), pose, inR: false, inL: false };
  }
  // L3 (bed-local): kneels at the FOOT END facing along the bed, reaches under its end for two coils (the camera sits low at
  // the near foot corner, in front of him at ~45 degrees: face, arms, hands and the coil, nothing between)
  const at = (lx: number, lz: number, lrot: number) => ({ pos: refWorld(R1, lx, 0, lz), rot: R1.yaw + lrot });
  const KX = -2.45;
  const KZ = 0.1;
  const ZS = 1.05;
  if (f < b.coil2 + 12) {
    const kp = at(KX, KZ, Math.PI / 2);
    pose.legL = { hip: -0.25, sz: 0.06, knee: 1.55 };
    pose.legR = { hip: -1.45, sz: 0.06, knee: 1.5 };
    pose.lean = 0.25;
    const lift = (a: number) => seg(f, a + 4, a + 10) * (1 - seg(f, a + 14, a + 22));
    pose.armR = { sx: -1.18 + 0.4 * lift(b.coil1), sz: 0.1, twist: 0, elbow: -0.05 - 0.7 * lift(b.coil1) };
    pose.armL = { sx: -1.18 + 0.4 * lift(b.coil2), sz: 0.1, twist: 0, elbow: -0.05 - 0.7 * lift(b.coil2) };
    pose.headPitch = 0.25;
    return { pos: [kp.pos[0], -0.42, kp.pos[2]], rot: kp.rot, pose, inR: f >= b.coil1 + 6, inL: f >= b.coil2 + 6 };
  }
  // stands; ties coil B on the foot post, coil A on the head post; then goes to the door (left wall)
  const standU = seg(f, b.coil2 + 12, b.coil2 + 20, easeOut);
  const FX = -2.2;
  const HX = 1.3;
  const toFoot = seg(f, b.coil2 + 18, b.tieB - 1, (x) => x);
  const toHead = seg(f, b.tieB + 9, b.tieA - 1, (x) => x);
  const outU = seg(f, b.walkOut, b.flash - 6, (x) => x);
  let lx = lerp(KX, FX, easeInOut(toFoot));
  let lz = lerp(KZ, 0.85, easeInOut(toFoot));
  let lrot = lerp(Math.PI / 2, 2.13, seg(f, b.coil2 + 14, b.tieB));
  let walking = toFoot > 0 && toFoot < 1;
  if (toHead > 0) {
    const e = easeInOut(toHead);
    lx = lerp(FX, HX, e);
    lz = lerp(0.85, ZS, Math.min(1, e * 3));
    walking = toHead < 1;
    lrot = walking ? Math.PI / 2 : 2.54;
  }
  let p = at(lx, lz, lrot);
  if (outU > 0) {
    // past the head end toward the door: he reaches it as it opens and walks into the light
    const A = refWorld(R1, HX, 0, ZS);
    const M: V3 = refWorld(R1, BED.L / 2 + 0.7, 0, ZS + 0.1);
    const D: V3 = [ROOM.x0 + 0.6, 0, (DOOR.z0 + DOOR.z1) / 2];
    const l1 = Math.hypot(M[0] - A[0], M[2] - A[2]);
    const l2 = Math.hypot(D[0] - M[0], D[2] - M[2]);
    const d = outU * (l1 + l2);
    const [P, Q, q] = d < l1 ? [A, M, d / l1] : [M, D, (d - l1) / l2];
    p = { pos: [lerp(P[0], Q[0], q), 0, lerp(P[2], Q[2], q)], rot: Math.atan2(Q[0] - P[0], Q[2] - P[2]) };
    walking = true;
  }
  pose.lean = 0;
  if (standU < 1) {
    pose.legL = { hip: lerp(-0.25, 0, standU), sz: 0.06, knee: lerp(1.55, 0, standU) };
    pose.legR = { hip: lerp(-1.45, 0, standU), sz: 0.06, knee: lerp(1.5, 0, standU) };
  }
  if (walking) pose = lerpPose(pose, walkPose(f * 0.42, 0.75), 0.85);
  // the ties: the right arm up to the post top, small wiggles
  const tie = (a: number, dur: number) => seg(f, a, a + 4, easeOut) * (1 - seg(f, a + dur, a + dur + 5, easeInOut));
  const tB = outU > 0 ? 0 : tie(b.tieB, 8);
  const tA = outU > 0 ? 0 : tie(b.tieA, 7);
  const up = Math.max(tA, tB);
  if (up > 0) pose.armR = { sx: lerp(0, tA > 0 ? -2.2 : -1.75, up) + Math.sin(f * 1.3) * 0.08 * up, sz: lerp(0.1, 0.15, up), twist: 0, elbow: lerp(-0.15, -0.45, up) };
  pose.headPitch = -0.12 * up;
  const y = lerp(-0.42, 0, standU);
  return { pos: [p.pos[0], y, p.pos[2]], rot: p.rot, pose, inR: f < b.tieB + 4, inL: f < b.tieA + 4 };
};

// ---------------------------------------------------------------- the world
const EXTRA_BEDS = [
  { p: [2.08, 0, 3.98] as V3, yaw: R1.yaw, o: 2 },
  { p: [3.97, 0, 8.28] as V3, yaw: R1.yaw, o: 3 },
];

const morphAt = (f: number, a: number, toBed: boolean): Morph => {
  const p = (d0: number, d1: number) => {
    const u = seg(f, a + d0, a + d1, easeInOut);
    return toBed ? u : 1 - u;
  };
  return toBed
    ? { legs: p(0, 10), mat: p(3, 12), straps: p(0, 7), head: p(4, 14), foot: p(6, 15), springs: p(3, 12) }
    : { legs: p(0, 9), mat: p(5, 14), head: p(10, 19), foot: p(15, 24), springs: p(19, 27), straps: p(22, 28) };
};
const mixMorph = (a: Morph, b: Morph, u: number): Morph => ({ legs: lerp(a.legs, b.legs, u), mat: lerp(a.mat, b.mat, u), head: lerp(a.head, b.head, u), foot: lerp(a.foot, b.foot, u), springs: lerp(a.springs, b.springs, u), straps: lerp(a.straps, b.straps, u) });
/** bed state of a Reformer spot: Reformer -> bed at L1, bed -> Reformer at L4 */
const bedState = (f: number, b: B, delay: number): Morph => (f < b.m2 + delay ? (f < b.m1 + delay ? asReformer : morphAt(f, b.m1 + delay, true)) : morphAt(f, b.m2 + delay, false));

const World: React.FC<{ b: B; K: Keys; floorTex: THREE.Texture }> = ({ b, K, floorTex }) => {
  const f = useCurrentFrame();
  const t = f / b.fps;
  const c = camAt(K, b, f);
  const nodes: React.ReactNode[] = [];
  const hutK = f < b.m2 ? seg(f, b.hutA, b.hutB, easeInOut) : 1 - seg(f, b.hutDown, b.hutDown + 30, easeInOut);
  const glass = 1 - clamp(hutK * 3);
  const outside = f >= b.out0 && f < b.diveB + 4;
  // how much the camera is outside the hut (behind the back wall or above the roof): every light / sky / fog value
  // blends with it, so leaving through the bars and diving back in never pops (it used to switch in one frame)
  const ow = f >= b.out0 && f < b.diveB + 30 ? clamp(Math.max((ROOM.zb - c.p[2]) / 2.2, (c.p[1] - 7) / 14)) : 0;
  const doorA = seg(f, b.door, b.door + 10, easeOut);

  // ---- the room, the hut skin, the outside
  nodes.push(<Room key="room" glass={glass} floorTex={floorTex} plankTexW={floorTex} />);
  nodes.push(<HutSkin key="hut" k={hutK} door={f < b.m2 ? doorA : 1} />);
  // the barred window stays on the studio wall as a ghost into L5, then fades
  if (f >= b.s[4] - 3 && f < b.ghostOut + 60) nodes.push(<HutWindow key="ghost" ghost={0.22 * seg(f, b.s[4] - 3, b.s[4] + 5) * (1 - seg(f, b.ghostOut, b.ghostOut + 55, easeInOut))} />);
  if (outside || (f >= b.w.man - 30 && f < b.diveB + 10) || hutK > 0.5) {
    nodes.push(<HutShell key="shell" roofUp={seg(f, b.diveA + 8, b.diveA + 20, easeInOut) * (f < b.diveB + 30 ? 1 : 0)} />);
    nodes.push(<CampIsland key="camp" frame={f} />);
  }
  // the light behind the door («خرج»)
  if (doorA > 0 && f < b.m2 + 6) nodes.push(<DoorLight key="dl" k={doorA * (1 - seg(f, b.flash, b.m2 + 4))} />);
  // studio dressing (sinks under the hut skin, comes back)
  const studio = 1 - clamp(hutK * 1.4);
  if (studio > 0.01) {
    nodes.push(<group key="plant" position={[0, -2.6 * (1 - studio), 0]}><Plant position={[-5.6, 0, 2.6]} s={1.25} frame={f} /><Plant position={[3.9, 0, 2.5]} s={1.15} frame={f + 40} /><StudioBits /></group>);
  }

  // ---- the two Reformers / beds
  const sl1 = slideAt(b.pushes.c1, t);
  const sl2 = slideAt(b.pushes.c2, t);
  const glow = f >= b.glow && f < b.glow + 26 ? Math.sin(((f - b.glow) / 26) * Math.PI) : 0;
  const pulled: number[] = [];
  if (f >= b.coil1 && f < b.flash) pulled.push(0);
  if (f >= b.coil2 && f < b.flash) pulled.push(10);
  const m1 = bedState(f, b, 0);
  const m2 = bedState(f, b, 3);
  nodes.push(
    <group key="r1" position={R1.p} rotation={[0, R1.yaw, 0]}>
      <RefBed m={m1} slide={sl1} glow={glow} pulled={pulled} />
    </group>,
  );
  nodes.push(
    <group key="r2" position={R2.p} rotation={[0, R2.yaw, 0]}>
      <RefBed m={m2} slide={sl2} glow={glow} />
    </group>,
  );
  // the rest of the ward: beds with patients rise out of the floor with the hut, gone in the light
  if (f >= b.hutA && f < b.flash) {
    EXTRA_BEDS.forEach((e, i) => {
      const y = -2.6 * (1 - seg(f, b.hutA + 4 + i * 3, b.hutB + i * 2, easeOut));
      if (y < -2.55) return;
      nodes.push(
        <group key={`xb${i}`} position={[e.p[0], y, e.p[2]]} rotation={[0, e.yaw, 0]}>
          <RefBed m={asBed} slide={0} />
        </group>,
      );
      nodes.push(<Lying key={`xp${i}`} r={{ p: e.p, yaw: e.yaw }} o={patient(e.o)} pose={lyingRest(f, 10 + i)} blanket sink={y} />);
    });
  }
  // the patients of beds 1 and 2 (they arrive while the camera is outside)
  if (f >= b.out0 + 20 && f < b.flash) {
    nodes.push(<Lying key="p2" r={R2} o={patient(4)} pose={lyingRest(f, 21)} blanket />);
    const p = lyingRest(f, 31);
    const sx = armSx(f, b);
    p.armR = { sx, sz: 0.06, twist: 0, elbow: 0 };
    const lg = legAt(f, b);
    p.legR = { hip: lg.hip, sz: 0.04, knee: lg.knee };
    p.mouth = f >= b.pullA ? "grin" : "smile";
    nodes.push(<Lying key="p1" r={R1} o={patient(0)} pose={p} />);
    // spring A: head post -> his hand (hangs before he takes it)
    const top = BED_PTS.headTop(BED.W / 2 - 0.05);
    if (f >= b.tieA + 2) {
      const hang: V3 = [top[0] - 0.12, top[1] - 0.55, 0.0];
      const hand = lyingHand(sx);
      const holding = f >= b.pullA - 2;
      const end = holding ? hand : hang;
      nodes.push(<group key="sA" position={R1.p} rotation={[0, R1.yaw, 0]}><Spring a={top} b={end} color={PPAL.ironShade} r={0.06} turns={9} tube={0.016} /></group>);
    }
    // spring B: foot post -> his foot
    const ftop = BED_PTS.footTop(BED.W / 2 - 0.05);
    if (f >= b.tieB + 2) {
      const hang: V3 = [ftop[0] + 0.12, ftop[1] - 0.5, 0.0];
      const foot = lyingFoot(lg.hip, lg.knee);
      const end = f >= b.legA - 2 ? foot : hang;
      nodes.push(<group key="sB" position={R1.p} rotation={[0, R1.yaw, 0]}><Spring a={ftop} b={end} color={PPAL.ironShade} r={0.06} turns={9} tube={0.016} /></group>);
    }
  }
  // the coils on their way from the deck to his hands
  for (const [i, f0] of [
    [0, b.coil1],
    [10, b.coil2],
  ] as const) {
    if (f >= f0 && f < f0 + 6) {
      const u = (f - f0) / 6;
      const a: V3 = [lerp(DECK_X[i % 10], -1.6, u), lerp(BED.top - 0.2, 0.66, u), lerp(i >= 10 ? 0.3 : -0.3, i >= 10 ? 0.22 : -0.02, u)];
      nodes.push(<group key={`fly${i}`} position={R1.p} rotation={[0, R1.yaw, 0]}><Spring a={a} b={[a[0], a[1] + 0.22, a[2]]} color={PPAL.ironShade} r={0.1} turns={4} /></group>);
    }
  }
  // ---- the man
  const man = f < b.flash ? manAt(f, b) : null;
  if (man) {
    const coil = <Spring a={[0, -0.04, 0]} b={[0, -0.36, 0]} color={PPAL.ironShade} r={0.11} turns={5} tube={0.02} />;
    nodes.push(<Person key="man" o={MAN} pose={man.pose} pos={man.pos} rot={man.rot} rightHand={man.inR ? coil : undefined} leftHand={man.inL ? coil : undefined} noBlob={man.pos[1] < -0.1} />);
  }

  // ---- light: a bright even studio; flat grey daylight outside
  const sky = mixC("#FFFFFF", "#ECEFF1", ow);
  return (
    <>
      <CameraRig c={c} />
      <hemisphereLight args={[sky, mixC("#D8C6AA", "#B4B2A6", ow), lerp(2.0, 2.3, ow)]} />
      <ambientLight intensity={0.35} />
      <Sun ow={ow} />
      <pointLight position={[0, 5.4, 6]} intensity={22 * (1 - ow)} distance={22} decay={1.4} color="#FFF6EA" />
      <GradientSky top={mixC("#EAF3FA", "#B7C0C6", ow)} horizon={mixC("#FFFFFF", "#DDE0E0", ow)} radius={5000} />
      <fog attach="fog" args={[mixC("#FFFFFF", "#CDD1D3", ow), lerp(400, 260, ow), lerp(900, 2600, ow)]} />
      {nodes}
    </>
  );
};


const Sun: React.FC<{ ow: number }> = ({ ow }) => {
  const { light, tgt } = useMemo(() => {
    const l = new THREE.DirectionalLight();
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.02;
    l.shadow.radius = 5;
    const c = l.shadow.camera;
    c.left = -14;
    c.right = 14;
    c.top = 14;
    c.bottom = -14;
    c.near = 1;
    c.far = 80;
    c.updateProjectionMatrix();
    const t = new THREE.Object3D();
    t.position.set(0, 0, 6);
    l.target = t;
    return { light: l, tgt: t };
  }, []);
  light.position.set(-9, 22, 18);
  light.intensity = lerp(1.6, 1.25, ow);
  light.color.set(mixC("#FFF4E2", "#F2F2EE", ow));
  return (
    <>
      <primitive object={tgt} />
      <primitive object={light} />
    </>
  );
};

const DoorLight: React.FC<{ k: number }> = ({ k }) => {
  const g = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  return (
    <>
      <mesh geometry={g} position={[ROOM.x0 - 0.5, DOOR.h / 2, (DOOR.z0 + DOOR.z1) / 2]} rotation={[0, Math.PI / 2, 0]} scale={[DOOR.z1 - DOOR.z0 + 0.2, DOOR.h + 0.1, 1]}>
        <meshBasicMaterial color={PPAL.light} toneMapped={false} />
      </mesh>
      <pointLight position={[ROOM.x0 + 0.8, 2.0, (DOOR.z0 + DOOR.z1) / 2]} intensity={60 * k} distance={14} decay={1.3} color="#FFF3D6" />
    </>
  );
};

// ---------------------------------------------------------------- 2D layers
/** the light flooding in when the door opens (the people of the hut are gone in it) */
const Flood: React.FC<{ f: number; b: B }> = ({ f, b }) => {
  const o = seg(f, b.door + 2, b.flash, easeInOut) * (1 - seg(f, b.flash + 1, b.flash + 7, easeInOut));
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: "radial-gradient(ellipse at 12% 44%, rgba(255,250,235,1) 0%, rgba(255,248,230,0.55) 30%, rgba(255,246,226,0) 62%)", opacity: o * 0.8 }} />;
};

// the real app screens (1080 x 2402): «فريدة» card; the ring on the person, then the time row; press «يلا تمرينة»
const PHONE: Omit<AppPhoneSpec, "screens"> = {
  img: { w: 1080, h: 2402 },
  rest: { x: 575, y: 96, w: 440 },
  focus: { x0: 52, y0: 400, x1: 1028, y1: 1950 },
  to: { x: 790, y: 590 },
  zoom: 1.14,
  button: { x0: 52, y0: 1800, x1: 1028, y1: 1944 },
  accent: "#FF5FA8",
};

/** Every moment that needs a sound (frames), for the debug overlay and the sound pass. */
export const pilatesCues = (b: B) => ({
  bed: b.m1,
  coil: [b.coil1, b.coil2],
  tie: [b.tieA, b.tieB],
  pull: [b.pullA + 4, b.pullA + 20],
  leg: [b.legA + 2, b.legA + 16],
  door: b.door,
  morph: [b.m2, b.m2 + 33],
  glow: b.glow,
  lock: b.lock,
  phone: [b.phIn, b.phPush, b.ring1, b.ring2, b.tap, b.swap, b.phOut],
});

export const FactPilates: React.FC<FactPilatesProps> = ({ starts = PIL_STARTS, words = PIL_WORDS, durationSec = PIL_DURATION, phoneScreens = ["footage/pilates-bed/app/card.png", "footage/pilates-bed/app/match.png"], debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const b = useMemo(() => makeBeats(starts, words, fps, durationSec), [starts, words, fps, durationSec]);
  const K = useMemo(() => makeKeys(b), [b]);
  const proj = useMemo(() => projector(), []);
  const floorTex = useMemo(() => plankTex(), []);
  const frame = useCurrentFrame();
  const t = frame / fps;
  // the old days: colour drains on «بسرير مستشفى», comes back on «Reformer»
  const drain = frame < b.m2 ? seg(frame, b.drainA, b.drainB, easeInOut) : 1 - seg(frame, b.m2 + 4, b.m2 + 34, easeInOut);
  const filter = drain > 0.001 ? `saturate(${1 - 0.86 * drain}) sepia(${0.32 * drain}) contrast(${1 + 0.06 * drain}) brightness(${1 - 0.06 * drain})` : undefined;
  const c = camAt(K, b, frame);
  return (
    <AbsoluteFill style={{ backgroundColor: "#F4EFE6" }}>
      <AbsoluteFill style={{ filter }}>
        <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 40, near: 0.05, far: 6000, position: [0, 3, 12] }} gl={{ antialias: true }}>
          <World b={b} K={K} floorTex={floorTex} />
        </ThreeCanvas>
      </AbsoluteFill>
      <Flood f={frame} b={b} />
      <AppPhone
        f={frame}
        spec={{ ...PHONE, screens: phoneScreens, rings: { rects: [{ x0: 470, y0: 430, x1: 1000, y1: 700 }, { x0: 92, y0: 790, x1: 990, y1: 944 }], on: [b.ring1, b.ring2], off: b.tap - 3, color: "#FF5FA8" } }}
        t={{ inF: b.phIn, pushF: b.phPush, tapF: b.tap, outF: b.phOut, swapF: b.swap }}
      />
      {debug && <DebugOverlay f={frame} t={t} b={b} c={c} proj={proj} />}
    </AbsoluteFill>
  );
};

const DebugOverlay: React.FC<{ f: number; t: number; b: B; c: { p: V3; l: V3; fov: number }; proj: ReturnType<typeof projector> }> = ({ f, t, b, c, proj }) => {
  const s1 = proj(c, seatWorld(R1, slideAt(b.pushes.c1, t)));
  const s2 = proj(c, seatWorld(R2, slideAt(b.pushes.c2, t)));
  const cues = pilatesCues(b);
  const sec = (v: number | readonly number[]) => (Array.isArray(v) ? (v as number[]).map((x) => (x / b.fps).toFixed(2)).join("-") : ((v as number) / b.fps).toFixed(2));
  const cross = (p: { x: number; y: number }, col: string) => (
    <>
      <div style={{ position: "absolute", left: p.x - 30, top: p.y - 2, width: 60, height: 4, background: col }} />
      <div style={{ position: "absolute", left: p.x - 2, top: p.y - 30, width: 4, height: 60, background: col }} />
    </>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 20, top: 20, right: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "22px monospace", padding: 8, whiteSpace: "pre-wrap" }}>
        {`f${f} ${t.toFixed(2)}s lock ${f >= b.lock ? "ON" : "off"} (${(b.lock / b.fps).toFixed(2)})\np ${c.p.map((v) => v.toFixed(2)).join(",")} l ${c.l.map((v) => v.toFixed(2)).join(",")} fov ${c.fov.toFixed(1)}\nseat1 ${s1.x.toFixed(0)},${s1.y.toFixed(0)} seat2 ${s2.x.toFixed(0)},${s2.y.toFixed(0)}\n${Object.entries(cues)
          .map(([k2, v]) => `${k2} ${sec(v)}`)
          .join(" · ")}`}
      </div>
      <div style={{ position: "absolute", left: 0, top: 1080, width: 1080, height: 260, background: "rgba(0,170,255,0.12)", borderTop: "3px dashed #00aaff", borderBottom: "3px dashed #00aaff" }} />
      {cross(s1, "#ff00aa")}
      {cross(s2, "#00e5ff")}
    </AbsoluteFill>
  );
};
