import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { PAL } from "./fact3d/parts";
import { clamp, easeInOut, easeOut, lerp, seg, springAt } from "./fact3d/anim";
import { alive, lerpPose } from "./fact3d/acting";
import { GradientSky } from "./fact3d/titanic";
import { Key, V3, sampleTrack } from "./fact3d/mob";
import {
  Bob,
  Collar,
  DRESS_SHAPE,
  FIN_P,
  G1_POS,
  G1_ROT,
  G2_POS,
  G2_ROT,
  GIRL_S,
  Hall,
  IPAL,
  IvoryClapper,
  Outside,
  PaintPose,
  ROW_ROT,
  ROW_X,
  ROW_Z,
  Relief,
  SPEAKER_W,
  Speaker,
  makeIbaKeys,
} from "./fact3d/iba";
import { IBA_DURATION, IBA_STARTS, IBA_WORDS, IBeats, IbaWords, danceAt, makeIbaBeats } from "./fact3d/ibaTiming";
import { AppPhone, AppPhoneSpec } from "./fact3d/AppPhone";

// The Iba dance (Old Kingdom, Saqqara tomb walls) -> a modern speaker. ONE continuous camera journey, no cuts:
//  0 five girls in white dancing in unison in a torch-lit tomb-chapel hall · 1 ease back: the Step Pyramid through the door
//  2 pan across the empty corners (no speaker) · 3 searching left, right · 4 the two girls at the side clapping, the row steps on each clap
//  5 the hall dissolves into the painted wall (camera push + 10-frame crossfade) · 6 the painted row lights up and dances (diamond arms)
//  7 the painted clappers light up, the clapping goes 2/s -> 3/s · 8 back in 3D: she holds two ivory clappers, the camera moves in
//  9 two knocks, ease out, the camera LOCKS · 10-15 the coins' part: the clappers vanish, a speaker pops in, the row faces camera, one step.

export type FactIbaProps = {
  starts?: number[];
  words?: Partial<IbaWords>;
  durationSec?: number;
  /** seconds: the clappers vanish from her hands (default starts[10] + 0.5) */
  take?: number;
  /** seconds: the speaker pops in (default starts[11] + 0.3) */
  speaker?: number;
  /** seconds: the row's one step together (default starts[14] + 0.4) */
  step?: number;
  /** version B: the camera goes from the doorway straight to the painted wall (no beats 2-4 shots) */
  direct?: boolean;
  /** version C (all optional, seconds; no phoneIn = no phone, versions A / B unchanged): a phone with real app screens
   *  comes up above Mrs. Coin, pushes in to the top class card, the «يهمني» button is tapped (screen 1 -> 2), it leaves */
  phoneIn?: number;
  phonePush?: number;
  phoneTap?: number;
  phoneOut?: number;
  phoneScreens?: [string, string];
  debug?: boolean;
};

// version C phone: right half, above Mrs. Coin (750,1500) and the caption band (1100-1250); the left girl's face stays clear.
// classes-price-*.png are 1080 x 2400: top card (آيات الهادي · ZUMBA · time · 150 جنيه) x 52-1028 y 396-978, «يهمني» x 552-982 y 793-933
const IBA_PHONE: Omit<AppPhoneSpec, "screens"> = {
  img: { w: 1080, h: 2400 },
  rest: { x: 600, y: 105, w: 420 },
  focus: { x0: 52, y0: 396, x1: 1028, y1: 978 },
  to: { x: 590, y: 560 },
  zoom: 1.8,
  button: { x0: 552, y0: 793, x1: 982, y1: 933 },
  accent: "#FF5FA8",
};

// ---------------------------------------------------------------- the girls
const SKIN = ["#E2AE84", "#D9A27A", "#C98A63", "#EDBE97", "#D39A70", "#C88B62", "#E0A982"];
const BANDS = [IPAL.ochre, IPAL.blue, IPAL.green, IPAL.ochre, IPAL.blue, IPAL.green, IPAL.ochre];
const girlColors = (i: number): BlockyColors => ({ skin: SKIN[i], shirt: IPAL.dress, pants: IPAL.dress, shoes: "#B9805B", hair: IPAL.hair, face: PAL.ink });

const Girl: React.FC<{ i: number; pose: BlockyPose; pos: V3; rot: number; rightHand?: React.ReactNode; leftHand?: React.ReactNode }> = ({ i, pose, pos, rot, rightHand, leftHand }) => (
  <Blocky
    pose={pose}
    colors={girlColors(i)}
    position={pos}
    rotationY={rot}
    scale={GIRL_S}
    sleeves={IPAL.dress}
    trousers={IPAL.dress}
    skirt={IPAL.dress}
    skirtShape={DRESS_SHAPE}
    chest={<Collar />}
    headgear={<Bob band={BANDS[i]} />}
    rightHand={rightHand}
    leftHand={leftHand}
  />
);

const angLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

/** Breathing only (the final hold): no sway, no head drift. */
const breathe = (p: BlockyPose, f: number, seed: number): BlockyPose => {
  const br = Math.sin(f * 0.11 + seed * 1.7);
  return { ...p, bob: p.bob + br * 0.012, shrug: p.shrug + (br * 0.5 + 0.5) * 0.05 };
};

/** Arms-up side-step (step-touch): every whole phase = feet together on the clap; arms in the Iba diamond above the head. */
const dance = (ph: number): { pose: BlockyPose; dx: number } => {
  const k = Math.floor(ph);
  const t = ph - k;
  const dir = ((k % 2) + 2) % 2 === 0 ? 1 : -1;
  const out = Math.sin(Math.PI * t);
  const p = restPose();
  p.legL = { hip: 0, sz: 0.04 + (dir > 0 ? 0.34 : 0.05) * out, knee: 0.12 * out };
  p.legR = { hip: 0, sz: 0.04 + (dir < 0 ? 0.34 : 0.05) * out, knee: 0.12 * out };
  p.bob = -0.07 * (1 - out);
  p.roll = -dir * 0.07 * out;
  const arm = { sx: 0.3, sz: 2.7 + 0.1 * out, twist: 0, elbow: -0.15 };
  p.armL = arm;
  p.armR = { ...arm };
  p.headTilt = dir * 0.08 * out;
  p.mouth = "grin";
  p.eyeWide = 1.05;
  return { pose: p, dx: lerp(-dir * 0.18, dir * 0.18, easeInOut(t)) };
};

/** Hand clapping in front of the chest; hands meet on every whole phase. */
const clap = (ph: number): BlockyPose => {
  const c = Math.pow(Math.abs(Math.sin(Math.PI * ph)), 0.7); // 0 = together
  return {
    ...restPose(),
    armL: { sx: -1.15, sz: lerp(-0.5, 0.12, c), twist: 0, elbow: -0.75 },
    armR: { sx: -1.15, sz: lerp(-0.5, 0.12, c), twist: 0, elbow: -0.75 },
    bob: -0.02 * (1 - c),
    headPitch: -0.06 + 0.06 * (1 - c),
    mouth: "grin",
    browUp: 0.4,
    eyeWide: 1.05,
  };
};

const HOLD_ARM = { sx: -0.25, sz: -0.45, twist: 0, elbow: -0.8 };
const PHI_REST = 0.0;
const PHI_HIT = 0.5;
/** the clappers' swing (wrist flick) around the two knocks: wind up, hit, rebound */
const flick = (f: number, B: IBeats) => {
  let phi = PHI_REST;
  let squash = 0;
  let spark = 0;
  for (const c of [B.clack, B.clack2]) {
    const d = f - c;
    if (d >= -5 && d < -2) phi = lerp(PHI_REST, PHI_REST - 0.12, easeOut((d + 5) / 3));
    else if (d >= -2 && d < 0) phi = lerp(PHI_REST - 0.12, PHI_HIT, (d + 2) / 2);
    else if (d >= 0 && d < 7) {
      phi = d === 0 ? PHI_HIT : lerp(PHI_HIT - 0.04, PHI_REST, easeOut((d - 1) / 6));
      squash = Math.max(squash, d < 3 ? 1 - d / 3 : 0);
      spark = Math.max(spark, 1 - d / 6);
    }
  }
  return { phi, squash, spark };
};

const World: React.FC<{ B: IBeats; keys: Key[]; hide3d: boolean }> = ({ B, keys, hide3d }) => {
  const f = useCurrentFrame();
  const S = B.s;
  const D = danceAt(f, B);
  const nodes: React.ReactNode[] = [];

  if (!hide3d) {
    // ================= the row of five
    const faceT = seg(f, S[14], S[14] + 12);
    const stepT1 = seg(f, B.step, B.step + 6);
    const stepT2 = seg(f, B.step + 5, B.step + 12);
    ROW_X.forEach((x, i) => {
      const seed = i * 3 + 1;
      const { pose: dp, dx } = dance(D.ph);
      let pose: BlockyPose = alive(restPose(), f, seed, 0.6);
      pose.mouth = "smile";
      // stopped (after the take): they look over at the girl whose clappers went
      if (f >= B.take) {
        const look = seg(f, B.take + 2, B.take + 10);
        pose.headYaw += -0.55 * look;
        pose.browUp = 0.6 * look;
        pose.brow = 0.5 * look;
        pose.mouth = look > 0.5 ? "o" : "smile";
        pose.mouthOpen = 0.15;
      }
      pose = lerpPose(pose, alive(dp, f, seed, 0.3), D.amt);
      const faceCam = Math.atan2(FIN_P[0] - x, FIN_P[2] - ROW_Z);
      let rot = angLerp(ROW_ROT, faceCam, faceT);
      let sx = dx * D.amt;
      if (f >= S[14]) {
        // facing the camera: one small step to their left and together, then settle
        const sideX = 0.24 * stepT1;
        pose = lerpPose(pose, restPose(), faceT);
        pose.legL = { hip: 0, sz: 0.03 + 0.28 * Math.sin(Math.PI * stepT1 * 0.5) * (1 - stepT2), knee: 0.1 * Math.sin(Math.PI * stepT1) };
        pose.legR = { hip: 0, sz: 0.03 + 0.2 * Math.sin(Math.PI * stepT2), knee: 0.1 * Math.sin(Math.PI * stepT2) };
        pose.bob = -0.05 * Math.sin(Math.PI * seg(f, B.step + 10, B.step + 18, (t) => t));
        pose.mouth = "grin";
        pose.eyeX = 0;
        sx = sideX; // the body ends one small step over
        rot = angLerp(ROW_ROT, faceCam, faceT);
        if (f >= S[15]) pose = breathe({ ...pose, roll: 0, twist: 0, headTilt: 0, headYaw: 0 }, f, seed);
        else pose = alive(pose, f, seed, 0.25);
      }
      const px = x + Math.cos(rot) * sx;
      const pz = ROW_Z - Math.sin(rot) * sx;
      nodes.push(<Girl key={`row${i}`} i={i} pose={pose} pos={[px, 0, pz]} rot={rot} />);
    });

    // ================= the two girls at the side
    const holding = f >= B.bA && f < B.take;
    // G1: claps the beat until the take
    {
      let pose = clap(D.ph);
      if (f >= B.take) {
        const t = seg(f, B.take, B.take + 6);
        const sur = { ...restPose(), headYaw: 0.5, eyeWide: 1.3, browUp: 1, mouth: "o" as const, mouthOpen: 0.3 };
        pose = lerpPose(pose, sur, t);
      }
      pose = alive(pose, f, 11, 0.4);
      if (f >= S[15]) pose = breathe({ ...restPose(), headYaw: -0.7, mouth: "smile" }, f, 11);
      nodes.push(<Girl key="g1" i={5} pose={pose} pos={G1_POS} rot={G1_ROT} />);
    }
    // G2: claps until the painted wall; holds the ivory clappers from beat 8 until the take
    {
      let pose: BlockyPose;
      let rot = G2_ROT;
      let left: React.ReactNode;
      let right: React.ReactNode;
      if (f < B.bA) pose = alive(clap(D.ph + 0.0), f, 12, 0.4);
      else if (holding) {
        const fl = flick(f, B);
        pose = alive({ ...restPose(), armL: HOLD_ARM, armR: { ...HOLD_ARM }, headPitch: 0, eyeY: -0.7, mouth: "smile" }, f, 12, 0.35);
        // the hands stay still (the clappers do the work)
        pose.armL = HOLD_ARM;
        pose.armR = { ...HOLD_ARM };
        pose.twist = 0;
        pose.roll = 0;
        // the coin walks in (beat 10): she notices her, head and eyes go to the right before the clappers are taken
        { const nt = seg(f, S[10] + 8, S[10] + 20); pose.headYaw = lerp(pose.headYaw ?? 0, 0.32, nt); pose.eyeX = lerp(pose.eyeX ?? 0, 1, nt); }
        left = <IvoryClapper side={1} turn={fl.phi} squash={fl.squash} spark={fl.spark} />;
        right = <IvoryClapper side={-1} turn={fl.phi} squash={fl.squash} />;
      } else {
        // the take: empty hands open, head turns right toward whoever took them, surprised
        const t = seg(f, B.take, B.take + 5, easeOut);
        const sur: BlockyPose = {
          ...restPose(),
          armL: { sx: -0.55, sz: 0.3, twist: 0, elbow: -0.9 },
          armR: { sx: -0.55, sz: 0.3, twist: 0, elbow: -0.9 },
          headYaw: 0.32,
          eyeX: 1,
          headPitch: 0.05,
          lean: -0.05,
          eyeWide: 1.35,
          browUp: 1,
          brow: 0.4,
          mouth: "o",
          mouthOpen: 0.35,
        };
        const from: BlockyPose = { ...restPose(), armL: HOLD_ARM, armR: { ...HOLD_ARM }, mouth: "smile" };
        pose = lerpPose(from, sur, t);
        pose = alive(pose, f, 12, 0.3);
        if (f >= S[15]) {
          const u = seg(f, S[15], S[15] + 10);
          rot = lerp(G2_ROT, 0.9, u);
          const look: BlockyPose = { ...sur, headYaw: -0.55, eyeX: -0.6, mouth: "smile", eyeWide: 1.05, browUp: 0.3, brow: 0, armL: { sx: -0.2, sz: 0.15, twist: 0, elbow: -0.5 }, armR: { sx: -0.2, sz: 0.15, twist: 0, elbow: -0.5 } };
          pose = breathe(lerpPose(sur, look, u), f, 12);
        }
      }
      nodes.push(<Girl key="g2" i={6} pose={pose} pos={G2_POS} rot={rot} leftHand={left} rightHand={right} />);
    }

    // ================= the speaker
    if (f >= B.speaker) {
      const sc = clamp(springAt(f, B.speaker, 0.5, 3.5), 0, 1.3);
      const go = B.speaker + 6;
      const beatPh = Math.max(0, (f - go) / (B.fps / 2));
      const pulse = f >= go ? Math.exp(-(beatPh - Math.floor(beatPh)) * 4) : 0;
      nodes.push(<Speaker key="spk" position={SPEAKER_W} scale={sc} pulse={pulse} glow={seg(f, go - 4, go + 4)} />);
    }
  }

  return (
    <>
      <CameraRig keys={keys} frame={f} />
      <fog attach="fog" args={["#F7E2BC", 120, 420]} />
      <hemisphereLight args={["#FFF3DE", "#D8AE78", 1.75]} />
      <ShadowSun />
      <directionalLight position={[-6, 9, 12]} intensity={0.55} color="#FFE9C8" />
      {!hide3d && (
        <>
          <GradientSky top="#6FB6E6" horizon="#FBE6BE" />
          <Hall frame={f} />
          <Outside />
          {nodes}
        </>
      )}
    </>
  );
};

/** The main light (casts the girls' shadows on the floor): fixed over the hall. */
const ShadowSun: React.FC = () => {
  const { light, tgt } = useMemo(() => {
    const l = new THREE.DirectionalLight("#FFE6C2", 1.5);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.02;
    l.shadow.radius = 4;
    const c = l.shadow.camera;
    c.left = -14;
    c.right = 14;
    c.top = 16;
    c.bottom = -16;
    c.near = 1;
    c.far = 80;
    c.updateProjectionMatrix();
    const t = new THREE.Object3D();
    t.position.set(0, 0, -1);
    l.target = t;
    l.position.set(8, 30, 14);
    return { light: l, tgt: t };
  }, []);
  return (
    <>
      <primitive object={tgt} />
      <primitive object={light} />
    </>
  );
};

const CameraRig: React.FC<{ keys: Key[]; frame: number }> = ({ keys, frame }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const c = sampleTrack(keys, frame);
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

// ---------------------------------------------------------------- the painted wall layer
const reliefOpacity = (f: number, B: IBeats) => seg(f, B.rA, B.rB, (t) => t) * (1 - seg(f, B.bA, B.bB, (t) => t));

const PaintedWall: React.FC<{ f: number; B: IBeats }> = ({ f, B }) => {
  const op = reliefOpacity(f, B);
  if (op <= 0) return null;
  const D = danceAt(f, B);
  const zoom = f < B.rB ? lerp(0.94, 1, seg(f, B.rA, B.rB, easeOut)) : lerp(1, 1.06, seg(f, B.rB, B.bB, (t) => t));
  const rowMove = f >= B.cut(6);
  const clapMove = f >= B.cut(7);
  // stiff painted poses: snap to the next pose in the first 30% of each beat
  const k = Math.floor(D.ph);
  const t = easeOut(clamp((D.ph - k) / 0.3));
  const poseA: PaintPose = { arms: "diamond", step: 1, rise: 0, tilt: 2, open: 0, lean: 0.35 };
  const poseB: PaintPose = { arms: "diamond", step: 0, rise: 1, tilt: -2, open: 0, lean: -0.35 };
  const even = ((k % 2) + 2) % 2 === 0;
  const [from, to] = even ? [poseB, poseA] : [poseA, poseB];
  const mixP = (a: PaintPose, b: PaintPose, u: number): PaintPose => ({ arms: "diamond", step: lerp(a.step, b.step, u), rise: lerp(a.rise, b.rise, u), tilt: lerp(a.tilt, b.tilt, u), open: 0, lean: lerp(a.lean, b.lean, u) });
  const rowPose = rowMove ? mixP(from, to, t) : poseA;
  const open = clapMove ? Math.pow(Math.abs(Math.sin(Math.PI * D.ph)), 0.7) : 0.8;
  const clapPose: PaintPose = { arms: "clap", step: 0.35, rise: 0, tilt: 0, open, lean: 0 };
  const rowLit = [0, 1, 2, 3, 4].map((i) => seg(f, B.cut(6) + i * 3, B.cut(6) + i * 3 + 8));
  const clapLit = [0, 1].map((i) => seg(f, B.cut(7) + i * 4, B.cut(7) + i * 4 + 8));
  const pulse = rowMove ? Math.exp(-(D.ph - k) * 3.5) : 0;
  return (
    <AbsoluteFill style={{ opacity: op, transform: `scale(${zoom})`, transformOrigin: "50% 61%" }}>
      <Relief rowLit={rowLit} clapLit={clapLit} rowPose={rowPose} clapPose={clapPose} pulse={pulse} frame={f} />
    </AbsoluteFill>
  );
};

const DebugOverlay: React.FC<{ info?: string }> = ({ info }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {info && <div style={{ position: "absolute", left: 20, top: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "26px monospace", padding: 8 }}>{info}</div>}
    <div style={{ position: "absolute", left: 0, top: 1100, width: 1080, height: 150, background: "rgba(0,170,255,0.12)", borderTop: "3px dashed #00aaff", borderBottom: "3px dashed #00aaff" }} />
    {/* the two coins (330 px wide) and the speaker spot */}
    {[
      [700, 1500],
      [930, 1520],
    ].map(([x, y]) => (
      <div key={x} style={{ position: "absolute", left: x - 165, top: y - 200, width: 330, height: 400, border: "4px dashed #ff00aa", borderRadius: 160 }} />
    ))}
    <div style={{ position: "absolute", left: 470 - 12, top: 1560 - 12, width: 24, height: 24, background: "#ffee00" }} />
    <div style={{ position: "absolute", left: 330 - 12, top: 1380 - 12, width: 24, height: 24, border: "4px solid #ffee00" }} />
  </AbsoluteFill>
);

export const FactIba: React.FC<FactIbaProps> = ({ starts = IBA_STARTS, words = IBA_WORDS, durationSec = IBA_DURATION, take, speaker, step, direct = false, phoneIn, phonePush, phoneTap, phoneOut, phoneScreens, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const B = useMemo(() => makeIbaBeats(starts, words, take, speaker, step, fps, durationSec), [starts, words, take, speaker, step, fps, durationSec]);
  const keys = useMemo(() => makeIbaKeys(B, direct), [B, direct]);
  const frame = useCurrentFrame();
  const hide3d = reliefOpacity(frame, B) >= 1;
  const c = sampleTrack(keys, frame);
  return (
    <AbsoluteFill style={{ backgroundColor: IPAL.wall }}>
      <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 50, near: 0.1, far: 3000, position: [3, 2.2, 2] }} gl={{ antialias: true }}>
        <World B={B} keys={keys} hide3d={hide3d} />
      </ThreeCanvas>
      <PaintedWall f={frame} B={B} />
      {phoneIn != null && phoneScreens && (
        <AppPhone
          f={frame}
          spec={{ ...IBA_PHONE, screens: phoneScreens }}
          t={{ inF: Math.round(phoneIn * fps), pushF: Math.round((phonePush ?? 1e4) * fps), tapF: Math.round((phoneTap ?? 1e4) * fps), outF: Math.round((phoneOut ?? 1e4) * fps) }}
        />
      )}
      {debug && <DebugOverlay info={`f${frame} p ${c.p.map((v) => v.toFixed(2)).join(",")} l ${c.l.map((v) => v.toFixed(2)).join(",")}`} />}
    </AbsoluteFill>
  );
};
