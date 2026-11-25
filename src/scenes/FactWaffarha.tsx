import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Freeze, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { PAL, Part, box } from "./fact3d/parts";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, lerp, seg, springAt } from "./fact3d/anim";
import { alive, lerpPose, runnerPose, wavePose } from "./fact3d/acting";
import { GradientSky, Stars } from "./fact3d/titanic";
import { mixC } from "./fact3d/zander";
import { Building, COURT, Couch, KERB, PadelCourt, ROAD, Racket, Room, SpotRing, StreetLamp, Tree, V3, WPAL } from "./fact3d/waffarha";
import { WAFFARHA_APP, WAFFARHA_DURATION, WAFFARHA_FEED, WAFFARHA_LOGO, WAFFARHA_SCROLL, WAFFARHA_STARTS, WAFFARHA_WORDS, WBeats, WaffarhaWords, makeWaffarhaBeats } from "./fact3d/waffarhaTiming";
import { CairoMap, MARKS } from "./fact3d/cairoMap";
import { loadFonts } from "../lib/fonts";

loadFonts();

// «زي وفّرها بس للجيمات والملاعب» (videos/waffarha-story): ONE camera, no cuts, Mr. Coin composited on top by the engine.
//  1-2 a night room, camera locked: he sits on the couch scrolling his phone; a floating screen above him shows the app
//      (scrolls with his thumb), stops on the question, «؟»; then it clears and three small offer buildings pop on it,
//      the gym door opens on «أول حصة ببلاش»
//  3   «تمرينة»: the screen flips to lime + the logo, comes down and fills the frame, the room is swapped for a night
//      street under it (camera locked again, his feet on the street); the buildings light up one after another, the padel
//      court at the end too; a paper coupon flies by with a ✕
//  4   the camera travels to the court (he runs with it): 3 players + an empty lime spot, the 4th runs in; then sideways
//      to the gym door (he runs again), a friend walks in (overlay coin) and the real app screen pops next to him
//  5   the camera rises, the town becomes the map: Obour lime with a pin, the other districts dark with «؟».

export type FactWaffarhaProps = {
  starts?: number[];
  words?: Partial<WaffarhaWords>;
  /** start times (s) of Mr. Coin's {scroll} cues: the app on the floating screen steps up on each thumb flick */
  scroll?: number[];
  durationSec?: number;
  /** the app on the floating screen (a still for now; the owner's screen recording later) */
  appSrc?: string;
  /** the real Tamrina screen shown next to him on «هتلاقيهم» */
  feedSrc?: string;
  logoSrc?: string;
  debug?: boolean;
};

// ---------------------------------------------------------------- the shots (camera locked inside each, eased between)
type Shot = { p: V3; l: V3; fov: number };
const ROOM: Shot = { p: [0, 2.0, 13.5], l: [0, 4.6, 0], fov: 45 }; // seat front edge -> y ~1686 (his bottom when seated at 540,1556): a two-line caption clears his head
const STREET: Shot = { p: [0, 5.5, 15], l: [0, 1.87, -5], fov: 50 }; // ground (0,0,6.2) -> 540,1780 (his feet at 540,1500)
const SPOT_COURT: V3 = [0, 0, -4.8];
const SPOT_DOOR: V3 = [-7, 0, -4.8];
const shift = (s: Shot, d: V3): Shot => ({ p: [s.p[0] + d[0], s.p[1] + d[1], s.p[2] + d[2]], l: [s.l[0] + d[0], s.l[1] + d[1], s.l[2] + d[2]], fov: s.fov });
// higher and steeper than the street shot so the whole court sits above the caption band (players 560-820 px)
const COURT_SHOT: Shot = { p: [0, 7.5, 1.8], l: [0, -1.58, -16], fov: 50 }; // ground (0,0,-4.8) -> 540,1776
const DOOR_SHOT = shift(COURT_SHOT, [SPOT_DOOR[0], 0, 0]); // the same, trucked left: the gym door right above his head
const MAP: Shot = { p: [-2, 470, 61], l: [-2, 0, 56], fov: 50 }; // high and almost straight down: the town ends small at (540, 680) = Obour on the Cairo map
const COURT_Z = -19.5; // court centre (near glass at z -12.5)
const GYM2_Z = -11; // the gym at the end (facade facing +z, door at its centre)
const GYM2_X = -7.3;

const mixShot = (a: Shot, b: Shot, u: number): Shot => ({
  p: [lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u)],
  l: [lerp(a.l[0], b.l[0], u), lerp(a.l[1], b.l[1], u), lerp(a.l[2], b.l[2], u)],
  fov: lerp(a.fov, b.fov, u),
});
/** Camera at frame f. Bit-identical inside every locked stretch (room, street, court, door, map). */
const camAt = (B: WBeats, f: number): Shot => {
  if (f < B.swap) return ROOM;
  if (f < B.t1A) return STREET;
  if (f < B.t1B) return mixShot(STREET, COURT_SHOT, seg(f, B.t1A, B.t1B, easeInOut));
  if (f < B.t2A) return COURT_SHOT;
  if (f < B.t2B) return mixShot(COURT_SHOT, DOOR_SHOT, seg(f, B.t2A, B.t2B, easeInOut));
  if (f < B.riseA) return DOOR_SHOT;
  if (f < B.riseB) {
    // up and back: the height leads, the look point follows (eased so the start and the landing are soft)
    const u = seg(f, B.riseA, B.riseB, easeInOut);
    const up = seg(f, B.riseA, B.riseB, (x) => 1 - Math.pow(1 - x, 2.2));
    return { p: [lerp(DOOR_SHOT.p[0], MAP.p[0], u), lerp(DOOR_SHOT.p[1], MAP.p[1], up), lerp(DOOR_SHOT.p[2], MAP.p[2], u)], l: [lerp(DOOR_SHOT.l[0], MAP.l[0], u), lerp(DOOR_SHOT.l[1], MAP.l[1], u), lerp(DOOR_SHOT.l[2], MAP.l[2], u)], fov: 50 };
  }
  return MAP;
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

/** Screen position (px) of a world point for a camera. */
const projector = () => {
  const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.1, 3000);
  return (c: Shot, w: V3) => {
    cam.fov = c.fov;
    cam.position.set(...c.p);
    cam.lookAt(...c.l);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const v = new THREE.Vector3(...w).project(cam);
    const d = new THREE.Vector3(...w).distanceTo(cam.position);
    return { x: ((v.x + 1) / 2) * 1080, y: ((1 - v.y) / 2) * 1920, behind: v.z > 1, d };
  };
};
type Proj = ReturnType<typeof projector>;

// ---------------------------------------------------------------- the street's buildings (lit in turn)
type Bld = { key: string; pos: V3; rot: number; w: number; d: number; h: number; color: string; sign: string; accent: string; name?: string; floors: number; lit: (B: WBeats) => number };
const BLD: Bld[] = [
  { key: "gym", pos: [-KERB, 0, 2.6], rot: Math.PI / 2, w: 4.4, d: 6, h: 4.8, color: "#3A3E4B", sign: WPAL.lime, accent: WPAL.lime, name: "جيم", floors: 2, lit: (B) => B.w.gyms3 },
  { key: "acad", pos: [KERB, 0, 1.4], rot: -Math.PI / 2, w: 6.0, d: 6, h: 6.2, color: "#433E50", sign: "#4FB3F0", accent: "#4FB3F0", name: "أكاديمية", floors: 3, lit: (B) => B.w.acad3 },
  { key: "studio", pos: [KERB, 0, -4.8], rot: -Math.PI / 2, w: 5.4, d: 6, h: 4.4, color: "#394848", sign: "#3FD0C0", accent: "#3FD0C0", name: "ستوديو", floors: 2, lit: (B) => B.w.acad3 + 8 },
  { key: "shop", pos: [KERB, 0, -9.9], rot: -Math.PI / 2, w: 3.8, d: 5, h: 5.4, color: "#3B3A42", sign: "#FFC77A", accent: "#FFC77A", floors: 3, lit: (B) => B.w.acad3 + 13 },
  { key: "gym2", pos: [GYM2_X, 0, GYM2_Z], rot: 0, w: 6.0, d: 6, h: 5.0, color: "#363A47", sign: WPAL.lime, accent: WPAL.lime, name: "جيم", floors: 2, lit: (B) => B.w.acad3 + 18 },
];
const litOf = (b: Bld, B: WBeats, f: number) => seg(f, b.lit(B) - 2, b.lit(B) + 6, easeOut);
/** world point of a building's sign band centre */
const signAt = (b: Bld): V3 => {
  const lz = 0.2;
  return [b.pos[0] + Math.sin(b.rot) * lz, 2.62, b.pos[2] + Math.cos(b.rot) * lz];
};

// ---------------------------------------------------------------- padel players
const SKIN = ["#EDBE97", "#C98E66", "#F1C9A6", "#B07A55"];
const PLAYERS: { pos: V3; rot: number; c: BlockyColors; racket: string }[] = [
  { pos: [-1.9, 0, COURT_Z + 3.6], rot: 0.25, c: { skin: SKIN[1], shirt: "#E8473C", pants: "#1E2230", shoes: "#F2F2F2", hair: "#2A1E18", face: PAL.ink }, racket: "#FFD23F" },
  { pos: [-1.8, 0, COURT_Z - 3.6], rot: 0.15, c: { skin: SKIN[0], shirt: "#F5C542", pants: "#2A2E3A", shoes: "#F2F2F2", hair: "#4A3222", face: PAL.ink }, racket: "#3FA7F0" },
  { pos: [1.8, 0, COURT_Z - 3.6], rot: -0.15, c: { skin: SKIN[3], shirt: "#2FB38C", pants: "#1E2230", shoes: "#F2F2F2", hair: "#1A1412", face: PAL.ink }, racket: "#FF5B5B" },
];
const SPOT: V3 = [1.7, 0, COURT_Z + 3.6];
const RUNNER_C: BlockyColors = { skin: SKIN[2], shirt: "#8C5CF0", pants: "#1E2230", shoes: "#F2F2F2", hair: "#3B2A20", face: PAL.ink };
const RUN_FROM: V3 = [5.6, 0, COURT_Z];

const readyPose = (f: number, seed: number): BlockyPose => {
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

const PadelPeople: React.FC<{ f: number; B: WBeats }> = ({ f, B }) => {
  const nodes: React.ReactNode[] = [];
  PLAYERS.forEach((pl, i) => {
    let p = readyPose(f, 3 + i * 2);
    // the near player turns to us and waves "come" while the spot is empty
    if (i === 0) {
      const wv = seg(f, B.s[3] + 20, B.s[3] + 30) * (1 - seg(f, B.runB - 6, B.runB + 4));
      if (wv > 0) p = lerpPose(p, wavePose(f, 2), wv * 0.85);
    }
    const cheer = seg(f, B.runB, B.runB + 6) * (1 - seg(f, B.runB + 30, B.runB + 40));
    if (cheer > 0) {
      p.armL = { sx: lerp(p.armL.sx, -2.7, cheer), sz: 0.25, twist: 0, elbow: -0.2 };
      p.mouth = "grin";
    }
    nodes.push(<Blocky key={`pl${i}`} pose={p} colors={pl.c} position={pl.pos} rotationY={i === 0 ? lerp(pl.rot, 0.5, seg(f, B.s[3] + 16, B.s[3] + 26)) : pl.rot} scale={0.92} rightHand={<Racket color={pl.racket} />} />);
  });
  // the 4th: waits outside the court (off frame), runs into the lime spot, settles in the ready pose
  const u = seg(f, B.runA, B.runB, (x) => x);
  const pos: V3 = [lerp(RUN_FROM[0], SPOT[0], easeOut(u)), 0, lerp(RUN_FROM[2], SPOT[2], u)];
  const run = u > 0 && u < 1;
  let p = run ? runnerPose(f * 0.55, 0.9) : readyPose(f, 11);
  if (u >= 1) p = lerpPose(runnerPose(f * 0.55, 0.9), readyPose(f, 11), seg(f, B.runB, B.runB + 6));
  const head = Math.atan2(SPOT[0] - RUN_FROM[0], SPOT[2] - RUN_FROM[2]);
  nodes.push(<Blocky key="runner" pose={p} colors={RUNNER_C} position={pos} rotationY={u < 1 ? head : lerp(head, -0.2, seg(f, B.runB, B.runB + 8))} scale={0.92} rightHand={<Racket color="#F2F2F2" />} />);
  return <>{nodes}</>;
};

/** a slim court floodlight: pole + a head that glows when the court is lit */
const CourtLight: React.FC<{ position: V3; on: number }> = ({ position, on }) => (
  <group position={position}>
    <Part geo={box(0.12, 4.6, 0.12)} color={WPAL.metal} position={[0, 2.3, 0]} />
    <Part geo={box(0.8, 0.3, 0.22)} color="#3A404A" position={[0, 4.65, 0]} />
    <Part geo={box(0.7, 0.2, 0.05)} color={mixC("#5A606A", "#FFFFFF", on)} emissive="#FFFFFF" emissiveIntensity={1.2 * on} position={[0, 4.62, 0.12]} rotation={[0.5, 0, 0]} shadow={false} />
  </group>
);

// ---------------------------------------------------------------- the 3D world
const World: React.FC<{ B: WBeats; f: number; c: Shot }> = ({ B, f, c }) => {
  const room = f < B.swap;
  const glowK = seg(f, B.flip + 4, B.flip + 9);
  const glow = mixC(WPAL.orange, WPAL.lime, glowK);
  const mapShow = seg(f, B.riseA + 4, B.riseB - 4);
  const obour = seg(f, B.w.obour - 4, B.w.obour + 8);
  const court = seg(f, B.w.courts - 2, B.w.courts + 8, easeOut);
  const nodes: React.ReactNode[] = [];
  if (room) {
    // the screen's light breathes a little; it dims while the app pauses on the question
    const g = 1 + 0.06 * Math.sin(f * 0.13) - 0.15 * seg(f, B.w.ask, B.w.ask + 8) * (1 - seg(f, B.s[1], B.s[1] + 8));
    nodes.push(<Room key="room" glow={glow} g={g} frame={f} />);
    nodes.push(<Couch key="couch" glow={glow} g={g} />);
  } else {
    // ground: the town block on the map
    nodes.push(<Part key="town" geo={box(34, 0.1, 46)} color="#1D2029" position={[-2, -0.05, -8]} shadow={false} />);
    nodes.push(<Part key="road" geo={box(ROAD * 2, 0.02, 26)} color={WPAL.asphalt} position={[0, 0.01, 2]} shadow={false} />);
    for (let z = 13; z > -11; z -= 3) nodes.push(<Part key={`dash${z}`} geo={box(0.14, 0.022, 1.3)} color="#7C7F86" position={[0, 0.02, z]} shadow={false} />);
    for (const s of [-1, 1]) {
      nodes.push(<Part key={`walk${s}`} geo={box(KERB - ROAD, 0.14, 26)} color={WPAL.walk} position={[s * (ROAD + KERB) / 2, 0.07, 2]} shadow={false} />);
      nodes.push(<Part key={`curb${s}`} geo={box(0.1, 0.16, 26)} color={WPAL.curb} position={[s * ROAD, 0.08, 2]} shadow={false} />);
    }
    // the plaza on the left at the end (open floor for him at the gym door) + a tree, a bench
    nodes.push(<Part key="plaza" geo={box(12, 0.12, 12)} color="#2C3038" position={[-8.6, 0.06, -6]} shadow={false} />);
    nodes.push(<Tree key="tree" position={[-12.2, 0, -2.6]} s={1.1} />);
    nodes.push(<Part key="bench" geo={box(1.8, 0.12, 0.5)} color={WPAL.wood} position={[-3.95, 0.5, -6.2]} rotation={[0, Math.PI / 2, 0]} />);
    nodes.push(<StreetLamp key="l1" position={[-3.0, 0, 6.5]} side={1} />);
    nodes.push(<StreetLamp key="l2" position={[3.0, 0, -1.8]} side={-1} />);
    nodes.push(<StreetLamp key="l3" position={[-3.0, 0, -8.2]} side={1} />);
    BLD.forEach((b) =>
      nodes.push(
        <group key={b.key} position={b.pos} rotation={[0, b.rot, 0]}>
          <Building w={b.w} d={b.d} h={b.h} color={b.color} lit={litOf(b, B, f)} sign={b.sign} accent={b.accent} floors={b.floors} door={b.key === "gym2" ? 0.35 * seg(f, B.w.find - 6, B.w.find + 10) : 0} />
        </group>,
      ),
    );
    // the padel court + floodlights + people
    nodes.push(
      <group key="court" position={[0, 0, COURT_Z]}>
        <PadelCourt lit={court} />
        {[-1, 1].map((sx) => [-1, 1].map((sz) => <CourtLight key={`fl${sx}${sz}`} position={[sx * (COURT.w / 2 + 0.5), 0, sz * (COURT.l / 2 + 0.3)]} on={court} />))}
      </group>,
    );
    nodes.push(<SpotRing key="spot" position={[SPOT[0], 0.1, SPOT[2]]} op={court * (1 - seg(f, B.runB - 4, B.runB + 4))} pulse={0.5 + 0.5 * Math.sin(f * 0.25)} />);
    nodes.push(<PadelPeople key="people" f={f} B={B} />);
    // the rise: the town flattens and sinks under the map, so only the map is left (gone for good at riseB)
    const sink = seg(f, B.riseA + Math.round((B.riseB - B.riseA) * 0.4), B.riseB - 2, easeIn);
    const town = nodes.splice(0, nodes.length);
    if (f < B.riseB) nodes.push(<group key="townG" position={[0, -0.25 * sink, 0]} scale={[1, 1 - 0.99 * sink, 1]}>{town}</group>);
  }
  // light: a cool night + the screen's glow in the room / lamps and the court in the street
  const street = room ? 0 : 1;
  return (
    <>
      <CameraRig c={c} />
      <hemisphereLight args={[room ? "#5A6C9E" : "#4A5C8C", room ? "#1E1A1C" : "#181A22", room ? 1.25 : 1.15]} />
      <directionalLight position={[-10, 22, 14]} intensity={room ? 0.35 : 0.7} color="#AFC2FF" />
      <pointLight position={[0, 6.3, 1.4]} intensity={room ? 13 : 0} distance={14} decay={1.3} color={glow} />
      <pointLight position={[3.25, 2.7, -0.4]} intensity={room ? 5 : 0} distance={6} decay={1.5} color="#FFC77A" />
      <pointLight position={[0, 4.5, 4]} intensity={8 * street} distance={12} decay={1.4} color={WPAL.lamp} />
      <pointLight position={[-4, 4.5, -6]} intensity={8 * street} distance={12} decay={1.4} color={WPAL.lamp} />
      <pointLight position={[0, 7, COURT_Z]} intensity={50 * court * street} distance={20} decay={1.2} color="#EAF3FF" />
      <GradientSky top="#05070F" horizon={room ? "#10131C" : "#1C2540"} />
      {!room && <Stars frame={f} />}
      <Part geo={box(600, 0.2, 600)} color="#0D1018" position={[0, -0.3, 0]} shadow={false} />
      {nodes}
    </>
  );
};

// ---------------------------------------------------------------- 2D layers
const LIME = WPAL.lime;
const ORANGE = WPAL.orange;
const AR = "IBM Plex Sans Arabic";
const PANEL = { x: 150, y: 200, w: 780, h: 630, b: 8 };
const PIN = { w: PANEL.w - PANEL.b * 2, h: PANEL.h - PANEL.b * 2 };
// the placeholder (778 x 630 website shot) drawn 1375 px wide; the window's top-left per flick (logo -> headline -> phone mock)
const APP_W = 1375;
// the owner's screen recording (720 x 1486, portrait): line 1 shows it on a phone-shaped screen, then the panel widens
const REC = { w: 720, h: 1486, show: 3.2 }; // show: seconds of the recording played by «وسألت» (then it holds that frame)
const PORT = (() => { const w = 470, iw = w - PANEL.b * 2, ih = Math.round((iw * REC.h) / REC.w); return { x: 540 - w / 2, y: 92, w, h: ih + PANEL.b * 2, iw, ih }; })();
const WAFFARHA_CHIP = "footage/waffarha-story/waffarha-logo.png"; // cropped from the real logo in waffarha-placeholder.png
const APP_PATH: [number, number][] = [[560, 0], [540, 30], [440, 170], [330, 330], [300, 500]];

/** small flat buildings drawn on the screen (gym, academy, studio): each pops in, an offer tag on top */
const MiniBuilding: React.FC<{ x: number; w: number; h: number; color: string; name: string; tag: string; pop: number; door?: number; accent: string }> = ({ x, w, h, color, name, tag, pop, door = 0, accent }) => {
  if (pop <= 0.001) return null;
  const s = clamp(pop, 0, 1.3);
  const base = PIN.h - 70;
  return (
    <div style={{ position: "absolute", left: x, top: base - h, width: w, height: h, transform: `scale(${s})`, transformOrigin: "50% 100%" }}>
      <div style={{ position: "absolute", inset: 0, background: color, borderRadius: "10px 10px 0 0", boxShadow: `0 0 0 3px ${accent}66 inset` }} />
      {/* windows */}
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", left: 18 + i * ((w - 36) / 3), top: 22, width: (w - 36) / 3 - 10, height: 34, background: "#FFD58A", opacity: 0.85, borderRadius: 4 }} />
      ))}
      <div dir="rtl" style={{ position: "absolute", left: 10, right: 10, top: 70, height: 40, background: "#0E0F12", color: accent, fontFamily: AR, fontWeight: 700, fontSize: 26, lineHeight: "40px", textAlign: "center", borderRadius: 6 }}>{name}</div>
      {/* the door: two leaves that open */}
      <div style={{ position: "absolute", left: w / 2 - 34, bottom: 0, width: 68, height: 84, background: "#FFE9A8", boxShadow: door > 0 ? `0 0 ${30 * door}px #FFE9A8` : undefined }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 34, height: 84, background: "#2A3242", transform: `scaleX(${1 - 0.8 * door})`, transformOrigin: "0% 50%" }} />
        <div style={{ position: "absolute", right: 0, top: 0, width: 34, height: 84, background: "#2A3242", transform: `scaleX(${1 - 0.8 * door})`, transformOrigin: "100% 50%" }} />
      </div>
      {/* the offer tag («عرض» / «%» only, no invented numbers) */}
      <div dir="rtl" style={{ position: "absolute", left: w / 2 - 50, top: -58, width: 100, height: 46, background: ORANGE, color: "#fff", fontFamily: AR, fontWeight: 800, fontSize: tag === "%" ? 34 : 26, lineHeight: "46px", textAlign: "center", borderRadius: 23, boxShadow: "0 6px 14px rgba(0,0,0,0.35)" }}>{tag}</div>
    </div>
  );
};

const Hologram: React.FC<{ f: number; B: WBeats; appSrc: string; logoSrc: string }> = ({ f, B, appSrc, logoSrc }) => {
  if (f >= B.revealB) return null;
  // ---- the flip, the fall-and-grow, the fade into the street
  const fl = seg(f, B.flip, B.flip + 12, easeInOut);
  const lime = fl >= 0.5;
  const sx = Math.abs(Math.cos(fl * Math.PI));
  const grow = seg(f, B.growA, B.growB, easeIn);
  const cx = PANEL.x + PANEL.w / 2;
  const cy = PANEL.y + PANEL.h / 2;
  const sc = lerp(1, 3.4, grow);
  const ty = lerp(0, 960 - cy, grow);
  const fade = 1 - seg(f, B.swap, B.revealB, easeOut);
  const bobY = 6 * Math.sin(f * 0.07) * (1 - grow);
  const col = lime ? LIME : ORANGE;
  const rgb = lime ? "214,255,60" : "255,122,26";
  // ---- the app: steps up one card on each thumb flick, stops on the question
  const steps = B.flicks.reduce((a, t) => a + seg(f, t, t + 7, easeOut), 0);
  const isRec = appSrc.endsWith(".mp4");
  // the screen: a phone-shaped portrait for the recording, widening to the landscape panel when line 2 starts
  const wide = isRec ? seg(f, B.s[1], B.s[1] + 14, easeInOut) : 1;
  const R = { x: lerp(PORT.x, PANEL.x, wide), y: lerp(PORT.y, PANEL.y, wide), w: lerp(PORT.w, PANEL.w, wide), h: lerp(PORT.h, PANEL.h, wide) };
  const rate = Math.max(0.5, (REC.show * B.fps) / Math.max(1, B.w.ask));
  const appOp = 1 - seg(f, B.s[1], B.s[1] + 8);
  const ask = seg(f, B.w.ask, B.w.ask + 8);
  const q = (k: number) => springAt(f, B.w.qs + k * 5, 0.5, 4);
  // the still is shown big and panned: the orange logo + headline first, each flick moves on, ending on the phone mock
  const k = clamp(steps, 0, APP_PATH.length - 1);
  const k0 = Math.floor(k);
  const k1 = Math.min(APP_PATH.length - 1, k0 + 1);
  const pan = { x: lerp(APP_PATH[k0][0], APP_PATH[k1][0], k - k0), y: lerp(APP_PATH[k0][1], APP_PATH[k1][1], k - k0) };
  // ---- the offer buildings
  const pop = (t: number) => clamp(springAt(f, t, 0.55, 4.5), 0, 1.25) * (1 - seg(f, B.flip + 4, B.flip + 6));
  const door = seg(f, B.w.free - 4, B.w.free + 6, easeOut);
  const free = clamp(springAt(f, B.w.free + 2, 0.5, 4.5), 0, 1.2) * (1 - seg(f, B.flip + 4, B.flip + 6));
  const logo = clamp(springAt(f, B.flip + 7, 0.5, 4), 0, 1.2) * (1 - seg(f, B.growA + 4, B.growB));
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transform: `translateY(${ty + bobY}px) scale(${sc})`, transformOrigin: `${cx}px ${cy}px` }}>
        <div
          style={{
            position: "absolute",
            left: R.x,
            top: R.y,
            width: R.w,
            height: R.h,
            borderRadius: lerp(44, 30, wide),
            border: `${PANEL.b}px solid ${col}`,
            background: lime ? "#0E0F12" : "rgba(26,14,8,0.9)",
            boxShadow: `0 0 70px rgba(${rgb},0.65), 0 0 160px rgba(${rgb},0.35), inset 0 0 40px rgba(${rgb},0.35)`,
            overflow: "hidden",
            transform: `scaleX(${Math.max(0.02, sx)})`,
          }}
        >
          {!lime && (
            <>
              {appOp > 0 && (
                <div style={{ position: "absolute", left: 0, top: 0, width: isRec ? PORT.iw : PIN.w, height: isRec ? PORT.ih : PIN.h, overflow: "hidden", opacity: appOp }}>
                  {isRec ? (
                    // the owner's own scroll plays under «كنت بقلب… والمطاعم» and holds its frame from «وسألت نفسي»
                    <Freeze frame={B.w.ask} active={f >= B.w.ask}>
                      <OffthreadVideo src={staticFile(appSrc)} muted playbackRate={rate} style={{ position: "absolute", left: 0, top: 0, width: PORT.iw, height: PORT.ih }} />
                    </Freeze>
                  ) : (
                    <Img src={staticFile(appSrc)} style={{ position: "absolute", left: -pan.x, top: -pan.y, width: APP_W, height: APP_W * (630 / 778) }} />
                  )}
                  <div style={{ position: "absolute", inset: 0, background: `rgba(16,8,4,${0.55 * ask})` }} />
                  {/* the question: a dumbbell and a ball, each with «؟» */}
                  {[0, 1].map((k) => {
                    const s = clamp(q(k), 0, 1.25);
                    if (s <= 0) return null;
                    const x = isRec ? (k === 0 ? 70 : 244) : k === 0 ? 170 : 470;
                    return (
                      <div key={k} style={{ position: "absolute", left: x, top: isRec ? 360 : 180, width: 140, height: 220, transform: `scale(${s})`, transformOrigin: "50% 80%" }}>
                        {k === 0 ? (
                          <svg width={140} height={140} viewBox="0 0 140 140">
                            <rect x={8} y={50} width={22} height={40} rx={6} fill="#E8E8EC" />
                            <rect x={26} y={36} width={22} height={68} rx={6} fill="#E8E8EC" />
                            <rect x={46} y={62} width={48} height={16} rx={4} fill="#B9BEC8" />
                            <rect x={92} y={36} width={22} height={68} rx={6} fill="#E8E8EC" />
                            <rect x={110} y={50} width={22} height={40} rx={6} fill="#E8E8EC" />
                          </svg>
                        ) : (
                          <svg width={140} height={140} viewBox="0 0 140 140">
                            <circle cx={70} cy={70} r={56} fill="#F4F4F6" />
                            <polygon points="70,46 92,62 84,88 56,88 48,62" fill="#20232B" />
                            <path d="M70 14 L70 46 M48 62 L18 52 M92 62 L122 52 M56 88 L40 118 M84 88 L100 118" stroke="#20232B" strokeWidth={6} />
                          </svg>
                        )}
                        <div style={{ position: "absolute", left: 30, top: -96, width: 80, height: 80, borderRadius: 40, background: ORANGE, color: "#fff", fontFamily: AR, fontWeight: 800, fontSize: 60, lineHeight: "80px", textAlign: "center" }}>؟</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* a faint floor line the buildings stand on */}
              <div style={{ position: "absolute", left: 30, right: 30, top: PIN.h - 70, height: 3, background: ORANGE, opacity: 0.6 * (1 - appOp) }} />
              <MiniBuilding x={40} w={210} h={250} color="#3A3E4B" name="جيم" tag="عرض" pop={pop(B.w.gym2 - 3)} door={door} accent={LIME} />
              <MiniBuilding x={278} w={200} h={300} color="#433E50" name="أكاديمية" tag="%" pop={pop(B.w.acad2 - 3)} accent="#4FB3F0" />
              <MiniBuilding x={506} w={210} h={220} color="#394848" name="ستوديو" tag="عرض" pop={pop(B.w.acad2 + 6)} accent="#3FD0C0" />
              {free > 0 && (
                <div dir="rtl" style={{ position: "absolute", left: 30, top: 40, width: 300, padding: "10px 0", background: LIME, color: "#0E0F12", fontFamily: AR, fontWeight: 800, fontSize: 34, textAlign: "center", borderRadius: 18, transform: `scale(${free})`, transformOrigin: "50% 100%", boxShadow: "0 8px 22px rgba(0,0,0,0.4)" }}>
                  أول حصة ببلاش
                </div>
              )}
            </>
          )}
          {lime && (
            <>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 45%, rgba(214,255,60,${0.18 + 0.08 * grow}), rgba(14,15,18,0) 70%)` }} />
              {logo > 0 && <Img src={staticFile(logoSrc)} style={{ position: "absolute", left: PIN.w / 2 - 190, top: PIN.h / 2 - 190, width: 380, height: 380, transform: `scale(${logo})`, borderRadius: 60 }} />}
            </>
          )}
          {/* hologram scanlines */}
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)" }} />
        </div>
        {/* the real Waffarha logo on the screen's top edge (line 1 only; the recording itself shows no name) */}
        {isRec && appOp > 0 && (
          <div style={{ position: "absolute", left: R.x + R.w / 2 - 112, top: R.y - 34, width: 224, height: 68, borderRadius: 34, background: "#FFFFFF", boxShadow: "0 0 24px rgba(255,122,26,0.55), 0 6px 14px rgba(0,0,0,0.4)", opacity: appOp, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Img src={staticFile(WAFFARHA_CHIP)} style={{ width: 180, height: 50 }} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** sign names on the street's buildings («جيم» ...), riding the camera */
const StreetSigns: React.FC<{ f: number; B: WBeats; c: Shot; proj: Proj }> = ({ f, B, c, proj }) => {
  if (f < B.swap || f >= B.riseA + 10) return null;
  const off = 1 - seg(f, B.riseA, B.riseA + 10);
  return (
    <>
      {BLD.filter((b) => b.name).map((b) => {
        const lit = litOf(b, B, f);
        const a = proj(c, signAt(b));
        if (a.behind || lit <= 0) return null;
        const fs = clamp(1300 / a.d, 14, 52);
        // the sign band is seen at an angle on the side buildings: squeeze the text with the facade
        const toCam = Math.atan2(c.p[0] - signAt(b)[0], c.p[2] - signAt(b)[2]);
        const sq = clamp(Math.abs(Math.cos(toCam - b.rot)), 0.3, 1);
        return (
          <div key={b.key} dir="rtl" style={{ position: "absolute", left: a.x - 200, top: a.y - fs * 0.65, width: 400, textAlign: "center", fontFamily: AR, fontWeight: 800, fontSize: fs, lineHeight: 1.2, color: "#0E0F12", opacity: lit * off, transform: `scaleX(${sq})` }}>
            {b.name}
          </div>
        );
      })}
    </>
  );
};

/** a paper coupon flies across, gets a ✕ */
const Coupon: React.FC<{ f: number; B: WBeats }> = ({ f, B }) => {
  const a = B.w.coupon - 12;
  const b = B.w.coupon + 30;
  if (f < a || f > b) return null;
  const inU = seg(f, a, B.w.coupon, easeOut);
  const outU = seg(f, B.w.coupon + 16, b, easeIn);
  const x = lerp(1250, 540, inU) + lerp(0, -900, outU) - 30 * seg(f, B.w.coupon, B.w.coupon + 16);
  const y = 600 + 30 * Math.sin((f - a) * 0.18) + 120 * outU;
  const rot = -14 + 10 * Math.sin((f - a) * 0.14) - 30 * outU;
  const xo = clamp(springAt(f, B.w.coupon + 1, 0.55, 4), 0, 1.2);
  return (
    <div style={{ position: "absolute", left: x - 190, top: y - 95, width: 380, height: 190, transform: `rotate(${rot}deg)` }}>
      <div dir="rtl" style={{ position: "absolute", inset: 0, background: "#FFF1D2", borderRadius: 14, border: "4px dashed #C98A3A", boxShadow: "0 14px 30px rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", gap: 18, fontFamily: AR, fontWeight: 800, color: "#B4501E" }}>
        <span style={{ fontSize: 64 }}>%</span>
        <span style={{ fontSize: 52 }}>كوبون</span>
      </div>
      {[-1, 1].map((k) => (
        <div key={k} style={{ position: "absolute", top: 95 - 18, [k < 0 ? "left" : "right"]: -18, width: 36, height: 36, borderRadius: 18, background: "#1B1F2A" }} />
      ))}
      {xo > 0 &&
        [45, -45].map((r) => (
          <div key={r} style={{ position: "absolute", left: 190 - 130, top: 95 - 14, width: 260, height: 28, borderRadius: 14, background: "#FF3B3B", transform: `rotate(${r}deg) scale(${xo})`, boxShadow: "0 4px 10px rgba(0,0,0,0.35)" }} />
        ))}
    </div>
  );
};

// the real app screen next to him (top right; he stands at 540 under the gym door, his friend walks in on the left)
const CARD = { x: 620, y: 150, w: 390, pad: 12 };
const FeedCard: React.FC<{ f: number; B: WBeats; src: string }> = ({ f, B, src }) => {
  if (f < B.cardIn || f > B.cardOut + 12) return null;
  const inU = seg(f, B.cardIn, B.cardIn + 12, (x) => easeOutBack(x, 1.3));
  const outU = seg(f, B.cardOut, B.cardOut + 12, easeIn);
  const iw = CARD.w - CARD.pad * 2;
  const ih = iw * (2300 / 1080);
  return (
    <div style={{ position: "absolute", left: CARD.x, top: CARD.y, width: CARD.w, height: ih + CARD.pad * 2, transform: `translateY(${-900 * outU}px) scale(${lerp(0.6, 1, inU)}) rotate(${lerp(-6, -2, inU)}deg)`, transformOrigin: "50% 100%", opacity: clamp(inU * 1.5) }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 46, background: "#0C0D10", boxShadow: `0 0 0 3px #34363C inset, 0 0 40px rgba(214,255,60,0.35), 0 24px 50px rgba(0,0,0,0.55)` }} />
      <Img src={staticFile(src)} style={{ position: "absolute", left: CARD.pad, top: CARD.pad, width: iw, height: ih, borderRadius: 36 }} />
    </div>
  );
};

/** every moment that needs a sound (frames) */
export const waffarhaCues = (B: WBeats) => ({
  flicks: B.flicks,
  question: B.w.qs,
  pops: [B.w.gym2 - 3, B.w.acad2 - 3, B.w.acad2 + 6],
  door: B.w.free - 4,
  flip: B.flip,
  grow: [B.growA, B.revealB],
  lights: BLD.map((b) => b.lit(B)),
  court: B.w.courts,
  coupon: B.w.coupon,
  travel1: [B.t1A, B.t1B],
  runner: [B.runA, B.runB],
  travel2: [B.t2A, B.t2B],
  card: B.cardIn,
  rise: [B.riseA, B.riseB],
  pin: B.w.obour + 8,
  marks: MARKS.map((_, k) => B.w.now + k * 10),
});

const DebugOverlay: React.FC<{ info: string; f: number; B: WBeats; c: Shot; proj: Proj }> = ({ info, f, B, c, proj }) => {
  const seated = f < B.s[2];
  const coin = seated ? { x: 410, y: 1426, w: 260, h: 330 } : { x: 400, y: 1370, w: 280, h: 410 };
  const marks: [string, V3][] = [
    ["seat", [0, 0.5, 0.35]],
    ["street", [0, 0, 6.2]],
    ["court", SPOT_COURT],
    ["door", SPOT_DOOR],
    ["spot", SPOT],
    ["gym2door", [GYM2_X, 0, GYM2_Z]],
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 20, top: 20, right: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "20px monospace", padding: 8, whiteSpace: "pre-wrap" }}>{info}</div>
      <div style={{ position: "absolute", left: 0, top: 1100, width: 1080, height: 150, background: "rgba(0,170,255,0.12)", borderTop: "3px dashed #00aaff", borderBottom: "3px dashed #00aaff" }} />
      <div style={{ position: "absolute", left: coin.x, top: coin.y, width: coin.w, height: coin.h, border: "4px dashed #ff00aa" }} />
      {f >= B.s[3] && f < B.s[4] && <div style={{ position: "absolute", left: 250 - 125, top: 1400, width: 250, height: 380, border: "4px dashed #ff00aa" }} />}
      {marks.map(([k, w]) => {
        const a = proj(c, w);
        if (a.behind) return null;
        return (
          <div key={k} style={{ position: "absolute", left: a.x - 8, top: a.y - 8, width: 16, height: 16, borderRadius: 8, background: "#ffee00", color: "#ffee00", font: "18px monospace" }}>
            <span style={{ position: "absolute", left: 20, top: -4, whiteSpace: "nowrap" }}>{`${k} ${Math.round(a.x)},${Math.round(a.y)}`}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const FactWaffarha: React.FC<FactWaffarhaProps> = ({
  starts = WAFFARHA_STARTS,
  words = WAFFARHA_WORDS,
  scroll = WAFFARHA_SCROLL,
  durationSec = WAFFARHA_DURATION,
  appSrc = WAFFARHA_APP,
  feedSrc = WAFFARHA_FEED,
  logoSrc = WAFFARHA_LOGO,
  debug = false,
}) => {
  const { width, height, fps } = useVideoConfig();
  const B = useMemo(() => makeWaffarhaBeats(starts, words, scroll, fps, durationSec), [starts, words, scroll, fps, durationSec]);
  const proj = useMemo(() => projector(), []);
  const frame = useCurrentFrame();
  const c = camAt(B, frame);
  const cues = waffarhaCues(B);
  const sec = (v: number | number[]) => (Array.isArray(v) ? v.map((x) => (x / fps).toFixed(2)).join("/") : (v / fps).toFixed(2));
  return (
    <AbsoluteFill style={{ backgroundColor: WPAL.night }}>
      <ThreeCanvas width={width} height={height} flat camera={{ fov: 45, near: 0.1, far: 3000, position: [0, 2, 10] }} gl={{ antialias: true }}>
        <World B={B} f={frame} c={c} />
      </ThreeCanvas>
      <StreetSigns f={frame} B={B} c={c} proj={proj} />
      <Hologram f={frame} B={B} appSrc={appSrc} logoSrc={logoSrc} />
      <Coupon f={frame} B={B} />
      <FeedCard f={frame} B={B} src={feedSrc} />
      <CairoMap f={frame} show={seg(frame, B.riseB - 12, B.riseB, easeInOut)} obourAt={B.w.obour} marksAt={B.w.now} markStep={10} />
      {debug && (
        <DebugOverlay
          f={frame}
          B={B}
          c={c}
          proj={proj}
          info={`f${frame} ${(frame / fps).toFixed(2)}s  p ${c.p.map((v) => v.toFixed(1)).join(",")} l ${c.l.map((v) => v.toFixed(1)).join(",")}\n${Object.entries(cues)
            .map(([k, v]) => `${k} ${sec(v)}`)
            .join(" · ")}`}
        />
      )}
    </AbsoluteFill>
  );
};
