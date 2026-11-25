import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Img, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { PAL, Part, box, circle, rbox, torusArc } from "./fact3d/parts";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, lerp, seg, springAt } from "./fact3d/anim";
import { alive, lerpPose, walkPose } from "./fact3d/acting";
import { Treadmill } from "./fact3d/props";
import { Bun, DressFront, GradientSky, ModernBike, Moustache, OldBike, SuitFront } from "./fact3d/titanic";
import { Key, sampleTrack } from "./fact3d/mob";
import {
  ARM_PIVOT,
  ARM_RH,
  ArmMachine,
  BenchMachine,
  CableMachine,
  DOOR,
  FrameMachine,
  FullBeard,
  GasLamp,
  HALL,
  JacketTails,
  PANEL_TOP,
  PhotoFrame,
  Plaque,
  SADDLE_Y,
  SaddleMachine,
  SideFlick,
  SkirtStripes,
  SquatRack,
  SuitBowTie,
  TRANSOM,
  TallWindow,
  TexPlane,
  TopHat,
  V3,
  ZPAL,
  armHandle,
  cobbleTex,
  frameSwing,
  mixC,
  plankTex,
  reach,
  toTorso,
} from "./fact3d/zander";
import { ZANDER_DURATION, ZANDER_STARTS, ZANDER_WORDS, ZBeats, ZanderWords, makeZanderBeats } from "./fact3d/zanderTiming";
import { loadFonts } from "../lib/fonts";

loadFonts();

// Gustav Zander's 1865 gym in Stockholm -> a modern gym + the Tamrina app. ONE continuous camera journey, no cuts:
//  1 a suited man pumps a lever machine (push-in to the bow tie), pan to a lady in a striped dress on the saddle machine
//  2 fast pull-back out through the tall window over the door: the street, the "1865" plaque, the bearded doctor opens the doors
//  3 fly in through the doors, rise: 27 machines, counted (lime floor discs + the 2D counter)
//  4 down to the empty panelled back wall; flash -> the real 1892 photos land in frames; push in on each, pull back
//  5 camera locked (18.2 s): open floor for the overlay coins; the man looks at the coin and fixes his bow tie
//  6 the hall turns modern in place; the man walks off; 7 the real app screens on a 2D phone; the logo.

export type FactZanderProps = {
  starts?: number[];
  words?: Partial<ZanderWords>;
  durationSec?: number;
  debug?: boolean;
};

// ---------------------------------------------------------------- the map (world units; Blocky at scale 1 is ~2.65 tall)
const ZB = HALL.zb; // back wall plane (-38)
const MAN_M: V3 = [-3.0, 0, -37.2]; // his lever machine (he stands in it, facing +z)
const MAN_STAND: V3 = [-1.75, 0, -35.3]; // where he stands from the lock (feet ~ y 1286 on screen)
const MID_M: V3 = [1.6, 0, -36.6]; // the old cycle -> the empty modern bike
const LADY_M: V3 = [3.9, 0, -36.8]; // her saddle machine (outside the locked frame)
const TREAD: V3 = [-0.2, 0, -36.6];
const RACK: V3 = [3.0, 0, -37.2];
const DOC0: V3 = [-0.95, 0, 7.3];
const PHOTO = [
  { src: "footage/zander-gym/photo-man.jpg", x: -1.3, w: 2.0, h: 2.0 * (717 / 960) },
  { src: "footage/zander-gym/photo-lady.jpg", x: 1.15, w: 1.684 * (500 / 690), h: 1.684 },
];
const PHOTO_CY = 4.4;
const PHOTO_Z = ZB + 0.08;
const frameTop = (i: number) => PHOTO_CY + (PHOTO[i].h + 0.24) / 2;
const frameBottom = (i: number) => PHOTO_CY - (PHOTO[i].h + 0.24) / 2;
// final, locked camera
const FIN_P: V3 = [0, 2.4, -24.5];
const FIN_L: V3 = [0, 1.57, -38];
const FIN_FOV = 50;
// the overlay coin's head, seen from the man (screen ~ 770,1500 -> floor x 0.6, z -29.6)
const COIN_HEAD: V3 = [0.6, 1.3, -29.6];

// the 27: 8 rows x 3 in the front of the hall + the back row (the man's, the empty cycle, the lady's)
type MType = "lever" | "bike" | "bench" | "frame" | "saddle";
const COLS = [-2.9, 0, 2.9];
const ROWS = [-4.5, -7.1, -9.7, -12.3, -14.9, -17.5, -20.1, -22.7];
const TYPES: MType[][] = [
  ["frame", "lever", "saddle"],
  ["bench", "bike", "bench"],
  ["saddle", "frame", "lever"],
  ["lever", "bench", "bike"],
  ["bike", "saddle", "frame"],
  ["frame", "lever", "bench"],
  ["bench", "bike", "saddle"],
  ["saddle", "bench", "bike"], // row 8 stays low: the camera skims over it on the way down
];
const MACHINES: { t: MType; p: V3 }[] = [
  ...ROWS.flatMap((z, r) => COLS.map((x, c) => ({ t: TYPES[r][c], p: [x, 0, z] as V3 }))),
  { t: "lever", p: MAN_M },
  { t: "bike", p: MID_M },
  { t: "saddle", p: LADY_M },
];

const SKIN = ["#EDBE97", "#D9A27A", "#F1C9A6"];

// ---------------------------------------------------------------- camera
const makeKeys = (B: ZBeats): Key[] => {
  const S = B.s;
  const W = B.w;
  const k = (f: number, p: V3, l: V3, fov = 46, still = false): Key => ({ f, p, l, fov, still });
  const T0 = B.cut(3);
  const keys: Key[] = [
    // 1: push in on the suited man pumping the lever
    k(0, [-2.7, 2.2, -28.4], [-3.0, 1.45, -37.2], 46),
    k(W.suits - 1, [-2.95, 1.62, -32.7], [-3.0, 1.62, -37.2], 46),
    k(W.dresses - 4, [-2.95, 1.62, -32.8], [-3.0, 1.62, -37.2], 46, true),
    // pan to the lady (one move)
    k(W.dresses + 11, [0.9, 2.2, -31.0], [LADY_M[0], 1.85, LADY_M[2]], 46, true),
    k(T0, [0.95, 2.2, -30.9], [LADY_M[0], 1.85, LADY_M[2]], 46),
    // 2: fast pull-back down the hall and out through the tall window over the door, then down into the street
    k(T0 + 3, [0.4, 3.0, -26], [0.6, 2.8, -40], 48),
    k(T0 + 7, [0, 5.4, -8], [0, 4.4, -30], 50),
    k(T0 + 10, [0, 6.7, 4.2], [0, 5.2, -16], 50),
    k(T0 + 13, [0, 6.0, 11.5], [0, 4.4, -4], 50),
    k(T0 + 21, [0, 2.3, 31], [0, 3.1, 6], 46, true),
    k(W.opened - 8, [0.15, 2.3, 16.0], [0, 2.55, 6], 46),
    k(B.cut(4), [0.25, 2.3, 13.8], [0.1, 2.4, 6], 46),
    // fly in through the open doors
    k(B.cut(4) + 12, [0.4, 2.4, 8.2], [0.35, 2.2, -2], 50),
    k(B.cut(4) + 20, [0.4, 2.6, 5.0], [0.3, 1.9, -8], 52),
    // 3: rise to see the whole hall (27)
    k(B.cut(5), [0.3, 3.8, 4.0], [0.1, 1.2, -10], 52),
    k(W.n27 + 6, [0.1, 10.2, 4.4], [0, 0, -15.5], 54),
    k(B.cB, [0, 12.4, 4.6], [0, 0, -16.5], 56, true),
    k(B.cut(6), [0, 12.5, 4.6], [0, 0, -16.7], 56),
    // 4: down along the hall to the empty back wall, a slight push
    k(B.cut(6) + 16, [0, 7.2, -10], [0, 2.3, -36], 52),
    k(S[7] - 4, [0, 2.8, -25.6], [0, 2.3, ZB], 50, true),
    k(W.man - 3, [0, 2.95, -28.0], [0, 2.6, ZB], 50),
    // the man's photo, big
    k(W.man + 16, [PHOTO[0].x, 3.6, ZB + 4.9], [PHOTO[0].x, 3.6, ZB], 50, true),
    k(W.lady - 8, [PHOTO[0].x + 0.02, 3.6, ZB + 4.8], [PHOTO[0].x + 0.02, 3.6, ZB], 50, true),
    // drift to the lady's photo
    k(W.lady + 9, [PHOTO[1].x, 3.6, ZB + 4.9], [PHOTO[1].x, 3.6, ZB], 50, true),
    k(Math.round(17.4 * B.fps), [PHOTO[1].x - 0.02, 3.6, ZB + 4.8], [PHOTO[1].x - 0.02, 3.6, ZB], 50, true),
    // 5: pull back to the locked frame
    k(B.lock, FIN_P, FIN_L, FIN_FOV, true),
    k(B.end, FIN_P, FIN_L, FIN_FOV, true),
  ];
  for (let i = 1; i < keys.length; i++) if (keys[i].f <= keys[i - 1].f) keys[i] = { ...keys[i], f: keys[i - 1].f + 1 };
  return keys;
};
/** Camera state; identical (bit for bit) from the lock to the end. */
const camAt = (keys: Key[], B: ZBeats, f: number) => (f >= B.lock ? { p: FIN_P, l: FIN_L, fov: FIN_FOV } : sampleTrack(keys, f));

const CameraRig: React.FC<{ frame: number; B: ZBeats; keys: Key[] }> = ({ frame, B, keys }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const c = camAt(keys, B, frame);
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

/** Screen position (px) of a world point for the camera at frame f. */
const projector = () => {
  const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.1, 3000);
  return (c: { p: V3; l: V3; fov: number }, w: V3) => {
    cam.fov = c.fov;
    cam.position.set(...c.p);
    cam.lookAt(...c.l);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const v = new THREE.Vector3(...w).project(cam);
    return { x: ((v.x + 1) / 2) * 1080, y: ((1 - v.y) / 2) * 1920, behind: v.z > 1 };
  };
};

// ---------------------------------------------------------------- light rig (shadows follow the look point)
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
    cam.far = 160;
    cam.updateProjectionMatrix();
  }
  return (
    <>
      <primitive object={tgt} />
      <primitive object={light} />
    </>
  );
};

// ---------------------------------------------------------------- the hall (colours lerp to modern with m 0..1; geometry never moves)
const Hall: React.FC<{ m: number; stripe: number; glow: number }> = ({ m, stripe, glow }) => {
  const floor = mixC(ZPAL.floor, ZPAL.floorM, m);
  const panel = mixC(ZPAL.wood, ZPAL.panelM, m);
  const pframe = mixC(ZPAL.woodDark, ZPAL.panelFrameM, m);
  const plaster = mixC(ZPAL.plaster, ZPAL.plasterM, m);
  const glass = mixC(ZPAL.glass, ZPAL.glassM, m);
  const wframe = mixC(ZPAL.frame, ZPAL.black, m);
  const { x0, x1, zb, zf, h } = HALL;
  const W = x1 - x0;
  const D = zf - zb;
  const zc = (zf + zb) / 2;
  const nodes: React.ReactNode[] = [];
  // floor + ceiling
  nodes.push(<TexPlane key="floor" w={W} h={D} tex={plankTex()} color={floor} position={[0, 0.005, zc]} rough={0.8} />);
  nodes.push(<Part key="ceil" geo={box(W, 0.3, D)} color={mixC("#5E3C24", "#E9ECEF", m)} position={[0, h + 0.15, zc]} shadow={false} />);
  for (let z = zb + 2; z < zf; z += 4) nodes.push(<Part key={`bm${z}`} geo={box(W, 0.5, 0.4)} color={mixC(ZPAL.beam, "#D5DADF", m)} position={[0, h - 0.25, z]} shadow={false} />);
  // back wall: plaster, the panelled stretch (x -4.6..4.6), two tall windows at the sides
  nodes.push(<Part key="bw" geo={box(W, h, 0.3)} color={plaster} position={[0, h / 2, zb - 0.15]} shadow={false} />);
  const PX = [-4.6, 4.6];
  const nP = 6;
  const pw = (PX[1] - PX[0]) / nP;
  nodes.push(<Part key="bwbase" geo={box(PX[1] - PX[0], PANEL_TOP, 0.06)} color={pframe} position={[0, PANEL_TOP / 2, zb + 0.03]} />);
  nodes.push(<Part key="bwrail" geo={rbox(PX[1] - PX[0] + 0.2, 0.2, 0.16, 0.04)} color={pframe} position={[0, PANEL_TOP + 0.05, zb + 0.08]} />);
  nodes.push(<Part key="bwskirt" geo={rbox(W, 0.28, 0.1, 0.03)} color={pframe} position={[0, 0.14, zb + 0.05]} />);
  for (let i = 0; i < nP; i++) {
    const cx = PX[0] + pw * (i + 0.5);
    nodes.push(<Part key={`pd${i}`} geo={rbox(pw - 0.22, 0.9, 0.05, 0.03)} color={panel} position={[cx, 0.85, zb + 0.08]} />);
    nodes.push(<Part key={`pt${i}`} geo={rbox(pw - 0.22, 4.55, 0.05, 0.03)} color={panel} position={[cx, 1.55 + 4.55 / 2, zb + 0.08]} />);
  }
  nodes.push(<Part key="bwdado" geo={box(PX[1] - PX[0], 0.1, 0.1)} color={pframe} position={[0, 1.42, zb + 0.08]} />);
  // the modern lime stripe grows along the back wall (geometry of the wall untouched)
  if (stripe > 0.001) nodes.push(<Part key="lime" geo={box(PX[1] - PX[0], 0.16, 0.04)} color={ZPAL.lime} basic position={[0, 1.42, zb + 0.15]} scale={[stripe, 1, 1]} shadow={false} />);
  for (const sx of [-1, 1])
    nodes.push(
      <group key={`bwin${sx}`} position={[sx * 6.0, 1.4, zb + 0.06]}>
        <TallWindow w={1.8} h={6.6} glass={glass} glow={glow} frame={wframe} />
      </group>,
    );
  // side walls with tall windows
  for (const sx of [-1, 1]) {
    const x = sx < 0 ? x0 : x1;
    nodes.push(<Part key={`sw${sx}`} geo={box(0.3, h, D)} color={plaster} position={[x + sx * 0.15, h / 2, zc]} shadow={false} />);
    nodes.push(<Part key={`sd${sx}`} geo={box(0.08, 2.2, D)} color={panel} position={[x - sx * 0.04, 1.1, zc]} />);
    nodes.push(<Part key={`sr${sx}`} geo={box(0.12, 0.14, D)} color={pframe} position={[x - sx * 0.06, 2.22, zc]} />);
    for (const z of [-31, -24, -17, -10, -3])
      nodes.push(
        <group key={`swin${sx}${z}`} position={[x - sx * 0.02, 2.6, z]} rotation={[0, -sx * Math.PI / 2, 0]}>
          <TallWindow w={2.4} h={7.0} glass={glass} glow={glow} frame={wframe} />
        </group>,
      );
  }
  return <>{nodes}</>;
};

/** Front wall (inside: plaster + wood) and the street facade (outside), with the door and the tall window above it. */
const FrontWall: React.FC<{ door: number; m: number; glow: number }> = ({ door, m, glow }) => {
  const { x0, x1, zf, h } = HALL;
  const dw = DOOR.w / 2;
  const plaster = mixC(ZPAL.plaster, ZPAL.plasterM, m);
  const pieces = (z: number, t: number, col: string, X0: number, X1: number, H: number, key: string) => {
    const out: React.ReactNode[] = [];
    const add = (a: number, b: number, y0: number, y1: number, k2: string) => out.push(<Part key={key + k2} geo={box(b - a, y1 - y0, t)} color={col} position={[(a + b) / 2, (y0 + y1) / 2, z]} shadow={false} />);
    add(X0, -dw, 0, H, "l");
    add(dw, X1, 0, H, "r");
    add(-dw, dw, DOOR.h, TRANSOM.yb, "m");
    add(-dw, dw, TRANSOM.yt, H, "t");
    add(-dw, -TRANSOM.w / 2, TRANSOM.yb, TRANSOM.yt, "tl");
    add(TRANSOM.w / 2, dw, TRANSOM.yb, TRANSOM.yt, "tr");
    return out;
  };
  const leaf = (s: 1 | -1) => (
    <group key={`leaf${s}`} position={[-s * dw, 0, zf + 0.2]} rotation={[0, s * door, 0]}>
      <group position={[s * dw / 2, DOOR.h / 2, 0]}>
        <Part geo={rbox(dw - 0.02, DOOR.h - 0.02, 0.12, 0.03)} color={ZPAL.door} />
        {[0.9, -0.9].map((y) => [1, -1].map((zz) => <Part key={`${y}${zz}`} geo={rbox(dw - 0.4, 1.3, 0.04, 0.03)} color={ZPAL.doorDark} position={[0, y, zz * 0.07]} />))}
        <Part geo={rbox(0.06, 0.3, 0.12, 0.02)} color={ZPAL.brass} position={[-s * (dw / 2 - 0.15), 0, 0.12]} />
        <Part geo={rbox(0.06, 0.3, 0.12, 0.02)} color={ZPAL.brass} position={[-s * (dw / 2 - 0.15), 0, -0.12]} />
      </group>
    </group>
  );
  return (
    <>
      {/* inside skin */}
      {pieces(zf - 0.05, 0.1, plaster, x0, x1, h, "in")}
      {/* outside: the facade (wider and lower than the hall roof line) */}
      {pieces(zf + 0.22, 0.34, ZPAL.facade, -14, 14, 11, "out")}
      <Part geo={rbox(28.6, 0.5, 0.6, 0.08)} color={ZPAL.trim} position={[0, 11.0, zf + 0.5]} />
      <Part geo={box(28, 0.6, 0.3)} color={ZPAL.facadeDark} position={[0, 0.3, zf + 0.45]} />
      {/* door surround + transom frame (stone) */}
      <Part geo={rbox(0.36, DOOR.h + 0.3, 0.2, 0.05)} color={ZPAL.trim} position={[-dw - 0.18, (DOOR.h + 0.3) / 2, zf + 0.46]} />
      <Part geo={rbox(0.36, DOOR.h + 0.3, 0.2, 0.05)} color={ZPAL.trim} position={[dw + 0.18, (DOOR.h + 0.3) / 2, zf + 0.46]} />
      <Part geo={rbox(DOOR.w + 1.0, 0.34, 0.24, 0.05)} color={ZPAL.trim} position={[0, DOOR.h + 0.17, zf + 0.48]} />
      <group position={[0, TRANSOM.yb, zf + 0.25]}>
        <TallWindow w={TRANSOM.w} h={TRANSOM.yt - TRANSOM.yb} glass={ZPAL.glass} glow={0.2} frame={ZPAL.trim} clear />
      </group>
      {/* the 1865 plaque */}
      <group position={[0, 4.62, zf + 0.46]}>
        <Plaque text="1865" />
      </group>
      {/* facade windows */}
      {[-4.6, 4.6].map((x) =>
        [1.2, 6.0].map((y) => (
          <group key={`fw${x}${y}`} position={[x, y, zf + 0.4]}>
            <TallWindow w={1.7} h={y < 2 ? 2.8 : 3.0} glass="#3C5566" glow={0.05 + glow * 0} frame={ZPAL.trim} />
          </group>
        )),
      )}
      {leaf(1)}
      {leaf(-1)}
    </>
  );
};

const Street: React.FC = () => (
  <>
    <Part geo={box(60, 0.2, 2.8)} color={ZPAL.pavement} position={[0, 0.1, HALL.zf + 1.8]} />
    <TexPlane w={60} h={40} tex={cobbleTex()} color={ZPAL.cobble} position={[0, 0.01, HALL.zf + 23]} />
    <GasLamp position={[3.4, 0.2, HALL.zf + 2.6]} />
    <GasLamp position={[-3.4, 0.2, HALL.zf + 2.6]} />
  </>
);

// ---------------------------------------------------------------- people
type Outfit = { colors: BlockyColors; trousers?: string; skirt?: string; sleeves?: string; skirtShape?: [number, number, number]; chest?: React.ReactNode; headgear?: React.ReactNode; hipwear?: React.ReactNode };
const Person: React.FC<{ o: Outfit; pose: BlockyPose; pos: V3; rot: number; scale?: number; noBlob?: boolean }> = ({ o, pose, pos, rot, scale = 1, noBlob }) => (
  <Blocky pose={pose} colors={o.colors} position={pos} rotationY={rot} scale={scale} trousers={o.trousers} skirt={o.skirt} skirtShape={o.skirtShape} sleeves={o.sleeves} chest={o.chest} headgear={o.headgear} hipwear={o.hipwear} noBlob={noBlob} />
);

const SUIT = "#1F1F26";
/** The suited man; `mod` 0..1 turns the suit into a long-sleeve top + joggers (colours lerp, the suit pieces fold away). */
const manOutfit = (mod: number, sway: number): Outfit => {
  const jacket = mixC(SUIT, "#2F8C86", mod);
  const legs = mixC(SUIT, "#2E3A55", mod);
  return {
    colors: { skin: SKIN[0], shirt: jacket, pants: legs, shoes: mixC("#121214", "#F2F0EA", mod), hair: "#3B2A20", face: PAL.ink },
    trousers: legs,
    sleeves: jacket,
    chest: <SuitBowTie jacket={SUIT} k={1 - seg(mod, 0, 0.7)} />,
    hipwear: <JacketTails color={SUIT} sway={sway} k={1 - seg(mod, 0.1, 0.8)} />,
    headgear: (
      <>
        <Moustache color="#3B2A20" />
        <SideFlick color="#3B2A20" />
      </>
    ),
  };
};
const DRESS: [number, number, number] = [0.47, 0.72, 0.98];
const LADY: Outfit = {
  colors: { skin: SKIN[2], shirt: "#3E4A6B", pants: "#3E4A6B", shoes: "#2A2020", hair: "#6B3E26", face: PAL.ink },
  trousers: "#3E4A6B",
  sleeves: "#3E4A6B",
  skirt: "#3E4A6B",
  skirtShape: DRESS,
  chest: <DressFront />,
  hipwear: <SkirtStripes shape={DRESS} color="#E9E1CF" />,
  headgear: <Bun color="#6B3E26" />,
};
const COAT = "#2B2730";
const DOCTOR: Outfit = {
  colors: { skin: SKIN[1], shirt: COAT, pants: "#3A3640", shoes: "#1A1416", hair: "#4A3222", face: PAL.ink },
  trousers: "#3A3640",
  sleeves: COAT,
  skirt: COAT,
  skirtShape: [0.47, 0.6, 0.72],
  chest: <SuitFront jacket={COAT} tie="#7A2430" />,
  headgear: (
    <>
      <FullBeard />
      <TopHat />
    </>
  ),
};

// ---------------------------------------------------------------- the world
const World: React.FC<{ B: ZBeats; keys: Key[]; tex: (THREE.Texture | null)[] }> = ({ B, keys, tex }) => {
  const f = useCurrentFrame();
  const S = B.s;
  const W = B.w;
  const cam = camAt(keys, B, f);
  const nodes: React.ReactNode[] = [];
  const T0 = B.cut(3);

  // where are we: 0 inside .. 1 out in the street
  const out = seg(f, T0 + 11, T0 + 15, (x) => x) * (1 - seg(f, B.cut(4) + 14, B.cut(4) + 17, (x) => x));
  // old -> modern
  const m = seg(f, B.mA, B.mA + 40, easeInOut);
  const stripe = seg(f, B.mA + 36, B.mB, easeInOut);

  // ================= the hall (always) + the front wall / street
  nodes.push(<Hall key="hall" m={m} stripe={stripe} glow={lerp(0.55, 0.35, m)} />);
  const doorA = 1.3 * seg(f, W.opened, W.opened + 16, (x) => easeOutBack(x, 1.2));
  nodes.push(<FrontWall key="front" door={doorA} m={m} glow={0.5} />);
  if (f >= T0 && f < B.cut(5) + 10) nodes.push(<Street key="street" />);

  // ================= machines
  const counted = (i: number) => B.cA + Math.round(((B.cB - B.cA) * i) / 26);
  const discOff = seg(f, B.cOut - 10, B.cOut, (x) => x);
  const sinkY = (a: number, b: number) => -2.8 * seg(f, a, b, easeIn);
  const riseY = (a: number, b: number) => -2.8 * (1 - seg(f, a, b, easeOut));
  MACHINES.forEach((mc, i) => {
    const back = i >= 24;
    if (!back && (f >= B.lock || f < T0)) return; // the grid is only ever seen from the door end
    if (i === 26 && f >= B.lock) return; // the lady's machine is outside the locked frame
    let y = 0;
    if (i === 24) y = sinkY(B.mA, B.mA + 18);
    if (i === 25) y = sinkY(B.mA + 6, B.mA + 24);
    if (y < -2.75) return;
    const ph = f * 0.05 + i;
    let node: React.ReactNode = null;
    if (mc.t === "lever") node = <ArmMachine theta={i === 24 ? manTheta(f, B) : 0.05} />;
    else if (mc.t === "bike") node = <OldBike crank={i === 25 ? f * 0.02 : 0} />;
    else if (mc.t === "bench") node = <BenchMachine wheel={ph * 0.2} />;
    else if (mc.t === "frame") node = <FrameMachine pull={0} />;
    else node = <SaddleMachine rock={i === 26 ? ladyRock(f) : 0} bounce={i === 26 ? ladyBounce(f) : 0} wheel={i === 26 ? f * 0.25 : ph * 0.1} />;
    nodes.push(
      <group key={`mc${i}`} position={[mc.p[0], y, mc.p[2]]}>
        {node}
      </group>,
    );
    // the count: a lime disc lands under each machine on its tick
    const tk = counted(i);
    if (f >= tk && discOff < 1) {
      const s = clamp(springAt(f, tk, 0.6, 3.5), 0, 1.25);
      nodes.push(
        <group key={`cd${i}`} position={[mc.p[0], 0.03, mc.p[2] + (mc.t === "lever" ? 0.6 : 0.2)]} rotation={[-Math.PI / 2, 0, 0]} scale={Math.max(0.001, s)}>
          <Part geo={circle(1.0, 32)} color={ZPAL.lime} basic opacity={0.42 * (1 - discOff)} shadow={false} />
          <Part geo={torusArc(1.0, 0.07, Math.PI * 2)} color={ZPAL.lime} basic opacity={1 - discOff} shadow={false} />
        </group>,
      );
    }
  });
  // modern machines rise where the old ones sank
  if (f >= B.mA) {
    const cy = riseY(B.mA + 14, B.mA + 34);
    if (cy > -2.75) nodes.push(<group key="cable" position={[MAN_M[0] - 0.1, cy, MAN_M[2] - 0.2]}><CableMachine /></group>);
    const by = riseY(B.mA + 20, B.mA + 40);
    if (by > -2.75) nodes.push(<group key="mbike" position={[MID_M[0], by, MID_M[2]]}><ModernBike crank={0} /></group>);
    const ty = riseY(B.mA + 24, B.mA + 46);
    if (ty > -2.75) nodes.push(<group key="tread" position={[TREAD[0], ty, TREAD[2]]}><Treadmill frame={f} /></group>);
    const ry = riseY(B.mA + 30, B.mA + 52);
    if (ry > -2.75) nodes.push(<group key="rack" position={[RACK[0], ry, RACK[2]]}><SquatRack /></group>);
  }

  // ================= the suited man
  nodes.push(<SuitedMan key="man" f={f} B={B} />);
  // ================= the lady on the saddle machine
  if (f < B.lock) {
    const p = alive(restPose(), f, 7, 0.5);
    const hipY = SADDLE_Y + 0.11 + ladyBounce(f);
    const sh = toTorso(LADY_M[1] + 1.02 + 0.74 - (hipY + 0.72), 0.7, 0.05);
    const a = reach(sh.dy, sh.dz);
    p.armL = { sx: a.sx, sz: 0.12, twist: 0, elbow: a.elbow };
    p.armR = { sx: a.sx, sz: 0.12, twist: 0, elbow: a.elbow };
    p.legL = { hip: -0.35, sz: 0.12, knee: 0.4 };
    p.legR = { hip: -0.35, sz: 0.12, knee: 0.4 };
    p.lean = 0.05 + ladyRock(f) * 0.6;
    p.mouth = "smile";
    p.headPitch = -0.05 + Math.sin(f * 0.25) * 0.03;
    // she gets down and walks off to the right wall with the man (out of the wall shot, 11.4-14 s)
    const offA = MAN_LETGO(B) + 2;
    if (f < offA) nodes.push(<Person key="lady" o={LADY} pose={p} pos={[LADY_M[0], hipY - 0.92, LADY_M[2]]} rot={0} noBlob />);
    else {
      const down = seg(f, offA, offA + 8, easeInOut);
      const u = seg(f, offA + 8, offA + 40, easeInOut);
      const x = lerp(LADY_M[0] + 0.9 * down, 7.0, u);
      const z = lerp(LADY_M[2] + 0.5 * down, -36.4, u);
      const y = lerp(hipY - 0.92, 0, down);
      let q = lerpPose(p, alive(restPose(), f, 7, 0.5), down);
      if (u > 0 && u < 1) q = lerpPose(q, walkPose(f * 0.4, 0.5), 0.85);
      q.mouth = "smile";
      nodes.push(<Person key="lady" o={LADY} pose={q} pos={[x, y, z]} rot={u > 0 && u < 1 ? Math.PI / 2 : lerp(0, Math.PI / 2, down)} noBlob={down < 0.9} />);
    }
  }

  // ================= the doctor (outside, opens the doors, walks in)
  if (f >= T0 && f < S[6]) nodes.push(<Doctor key="doc" f={f} B={B} />);

  // ================= the real photos on the back wall
  ([0, 1] as const).forEach((i) => {
    const t0 = i === 0 ? B.flash1 : B.flash2;
    nodes.push(
      <group key={`ph${i}`} position={[PHOTO[i].x, frameTop(i), PHOTO_Z]}>
        <PhotoFrame tex={f >= t0 ? tex[i] : null} w={PHOTO[i].w} h={PHOTO[i].h} swing={frameSwing(f, t0)} drop={0} />
      </group>,
    );
  });

  // ================= light: warm old hall / daylight street / bright cool modern gym
  const hemiSky = mixC(mixC("#FFE0B4", "#F2F7FF", m), "#DCEEFA", out);
  const hemiGround = mixC(mixC("#7A5235", "#86909B", m), "#B8A487", out);
  const hemiI = lerp(lerp(1.55, 2.0, m), 1.7, out);
  const sunC = mixC(mixC("#FFD39A", "#FFFFFF", m), "#FFF0D6", out);
  const sunI = lerp(lerp(2.1, 2.3, m), 2.6, out);
  const dir: V3 = out > 0.5 ? [-16, 26, 22] : [-22, 24, 8];
  return (
    <>
      <CameraRig frame={f} B={B} keys={keys} />
      <hemisphereLight args={[hemiSky, hemiGround, hemiI]} />
      <SunRig target={cam.l} dir={dir} intensity={sunI} color={sunC} half={out > 0.5 ? 18 : 26} />
      {m > 0.01 && <pointLight position={[0, 9, -30]} intensity={40 * m} distance={30} decay={1.6} color="#F4FAFF" />}
      <GradientSky top={ZPAL.skyTop} horizon={ZPAL.skyHor} />
      <Part geo={box(400, 0.2, 400)} color="#7E7468" position={[0, -0.12, 0]} shadow={false} />
      {nodes}
    </>
  );
};

// ---------------------------------------------------------------- acting
/** The man's lever angle: pumping until he lets go, then the lever settles. */
const MAN_LETGO = (B: ZBeats) => B.cut(6) - 12;
const manTheta = (f: number, B: ZBeats) => {
  const tl = MAN_LETGO(B);
  const pump = 0.1 + 0.4 * Math.sin(f * 0.2 + 0.6);
  if (f < tl) return pump;
  const frozen = 0.1 + 0.4 * Math.sin(tl * 0.2 + 0.6);
  return lerp(frozen, -0.3, seg(f, tl, tl + 10, easeOut)) + 0.04 * Math.exp(-(f - tl - 10) / 4) * Math.sin(Math.max(0, f - tl - 10) * 0.9) * (f > tl + 10 ? 1 : 0);
};
const ladyBounce = (f: number) => 0.05 * Math.abs(Math.sin(f * 0.16));
const ladyRock = (f: number) => 0.06 * Math.sin(f * 0.16);

const SuitedMan: React.FC<{ f: number; B: ZBeats }> = ({ f, B }) => {
  const tl = MAN_LETGO(B);
  const stepA = tl + 6;
  const stepB = B.lock - 4;
  const exitA = B.s[10] + 6;
  const exitB = B.phIn - 2;
  const mod = seg(f, B.mA + 8, B.mA + 38, easeInOut);
  let pose = alive(restPose(), f, 3, 0.7);
  let pos: V3 = [MAN_M[0], 0, MAN_M[2]];
  let rot = 0;
  let sway = 0;
  if (f < tl + 4) {
    // pumping: both hands on the lever's grip, a small lean into each push
    const th = manTheta(f, B);
    const [hy, hz] = armHandle(th);
    const lean = 0.06 - 0.07 * Math.sin(f * 0.2 + 0.6);
    const t = toTorso(hy - 1.64, hz, lean);
    const a = reach(t.dy, t.dz);
    pose.armL = { sx: a.sx, sz: 0.06, twist: 0, elbow: a.elbow };
    pose.armR = { sx: a.sx, sz: 0.06, twist: 0, elbow: a.elbow };
    pose.lean = lean;
    pose.bob += 0.03 * Math.sin(f * 0.2 + 0.6);
    pose.legL = { hip: 0.08, sz: 0.06, knee: 0.12 };
    pose.legR = { hip: -0.18, sz: 0.06, knee: 0.08 };
    pose.mouth = "smile";
    pose.brow = 0.2;
    pose.headPitch = 0.08;
    sway = 0.12 * Math.sin(f * 0.2 + 1.4);
  } else if (f < stepB) {
    // lets go and walks off to the left wall (out of the wall shot, 11.4-14 s); during the pull-back he walks back
    // to the open floor beside his machine, standing there before the camera locks
    const OFF: [number, number] = [-7.0, MAN_M[2] - 0.15];
    const outB = stepA + 30;
    const backA = B.w.lady + 10;
    const go = f < backA;
    const u = go ? seg(f, stepA, outB, (x) => x) : seg(f, backA, stepB, (x) => x);
    const path: [number, number][] = go
      ? [
          [MAN_M[0], MAN_M[2]],
          [MAN_M[0], MAN_M[2] - 0.55],
          [OFF[0] + 1.2, MAN_M[2] - 0.55],
          OFF,
        ]
      : [OFF, [-4.4, -34.9], [MAN_STAND[0], -34.9], [MAN_STAND[0], MAN_STAND[2]]];
    const seglen = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
    const total = seglen.reduce((x, y) => x + y, 0);
    let d = easeInOut(u) * total;
    let j = 0;
    while (j < seglen.length - 1 && d > seglen[j]) d -= seglen[j++];
    const q = clamp(d / seglen[j]);
    pos = [lerp(path[j][0], path[j + 1][0], q), 0, lerp(path[j][1], path[j + 1][1], q)];
    const heading = Math.atan2(path[j + 1][0] - path[j][0], path[j + 1][1] - path[j][1]);
    const walking = u > 0 && u < 1;
    if (walking) pose = lerpPose(pose, walkPose(f * 0.4, 0.6), 0.85);
    rot = walking && !(go && j === 0) ? heading : 0;
  } else if (f < exitA) {
    pos = MAN_STAND;
    rot = lerp(Math.PI / 2, 0, seg(f, stepB, stepB + 6, easeOut)) * 0;
    // 19.4 s: he turns to the coin, then fixes his bow tie
    const look = seg(f, B.w.look, B.w.look + 8, easeOut);
    const yaw = Math.atan2(COIN_HEAD[0] - MAN_STAND[0], COIN_HEAD[2] - MAN_STAND[2]);
    rot = yaw * 0.35 * look;
    pose.headYaw += yaw * 0.65 * look;
    pose.headPitch = 0.1 * look;
    pose.eyeX = 0.5 * look;
    pose.browUp = 0.5 * look;
    const fix = seg(f, B.w.look + 12, B.w.look + 20, easeInOut) * (1 - seg(f, B.w.look + 44, B.w.look + 54, easeInOut));
    if (fix > 0) {
      const wig = Math.sin((f - B.w.look - 12) * 0.9) * 0.08 * fix;
      pose.armR = { sx: lerp(0, -0.75, fix), sz: lerp(0.08, 0.12, fix), twist: lerp(0, -1.35 + wig, fix), elbow: lerp(-0.15, -2.45, fix) };
      pose.armL = { sx: lerp(0, -0.72, fix), sz: lerp(0.08, 0.12, fix), twist: lerp(0, -1.35 - wig, fix), elbow: lerp(-0.15, -2.5, fix) };
      pose.headPitch = lerp(0.1, -0.12, fix);
      pose.mouth = "smile";
    }
    // after the change: a pleased little stretch
    const st = seg(f, B.mA + 40, B.mA + 50) * (1 - seg(f, B.mA + 62, B.mA + 74));
    if (st > 0) {
      pose.armL = { sx: lerp(pose.armL.sx, -2.9, st), sz: lerp(pose.armL.sz, 0.2, st), twist: 0, elbow: lerp(pose.armL.elbow, -0.2, st) };
      pose.armR = { sx: lerp(pose.armR.sx, -2.9, st), sz: lerp(pose.armR.sz, 0.2, st), twist: 0, elbow: lerp(pose.armR.elbow, -0.2, st) };
      pose.mouth = "grin";
      pose.eyeOpen = lerp(1, 0.2, st);
    }
  } else {
    // walks off to the left (out of frame before the phone comes up)
    const u = seg(f, exitA, exitB, (x) => x);
    if (u >= 1) return null;
    pos = [lerp(MAN_STAND[0], MAN_STAND[0] - 3.6, u * u * (3 - 2 * u)), 0, MAN_STAND[2] - 0.3 * u];
    rot = lerp(0, -Math.PI / 2, seg(f, exitA, exitA + 6));
    pose = lerpPose(pose, walkPose(f * 0.42, 0.75), seg(f, exitA, exitA + 5));
    pose.mouth = "smile";
  }
  return <Person o={manOutfit(mod, sway)} pose={pose} pos={pos} rot={rot} />;
};

const Doctor: React.FC<{ f: number; B: ZBeats }> = ({ f, B }) => {
  const Wo = B.w.opened;
  let pose = alive(restPose(), f, 11, 0.7);
  let pos: V3 = [...DOC0];
  let rot = 0;
  // proud: thumb in the waistcoat, a little bow on his name
  pose.armR = { sx: -0.35, sz: -0.25, twist: 0.4, elbow: -1.7 };
  pose.mouth = "smile";
  const bow = Math.max(0, Math.sin(((f - (B.s[3] + 16)) / 16) * Math.PI)) * (f > B.s[3] + 16 && f < B.s[3] + 32 ? 1 : 0);
  pose.lean = 0.08 * bow;
  pose.headPitch = 0.25 * bow;
  const turnA = Wo - 14;
  const atDoor: V3 = [0, 0, HALL.zf + 0.95];
  if (f >= turnA) {
    const u = seg(f, turnA, Wo - 2, easeInOut);
    pos = [lerp(DOC0[0], atDoor[0], u), 0, lerp(DOC0[2], atDoor[2], u)];
    rot = lerp(0, Math.PI, seg(f, turnA, turnA + 8, easeInOut));
    if (u > 0 && u < 1) pose = lerpPose(pose, walkPose(f * 0.4, 0.5), 0.8);
    // both hands on the doors, push
    const push = seg(f, Wo - 4, Wo + 2, easeOut) * (1 - seg(f, Wo + 10, Wo + 16));
    if (push > 0) {
      pose.armL = { sx: lerp(0, -1.45, push), sz: 0.25, twist: 0, elbow: -0.25 };
      pose.armR = { sx: lerp(0, -1.45, push), sz: 0.25, twist: 0, elbow: -0.25 };
      pose.lean = 0.18 * push;
    }
  }
  const inA = Wo + 8;
  if (f >= inA) {
    const path: [number, number][] = [
      [atDoor[0], atDoor[2]],
      [0, HALL.zf - 1.1],
      [-2.3, HALL.zf - 2.2],
    ];
    const u = seg(f, inA, inA + 26, (x) => x);
    const L1 = Math.hypot(path[1][0] - path[0][0], path[1][1] - path[0][1]);
    const L2 = Math.hypot(path[2][0] - path[1][0], path[2][1] - path[1][1]);
    const d = u * (L1 + L2);
    const [a, b, q] = d < L1 ? [path[0], path[1], d / L1] : [path[1], path[2], (d - L1) / L2];
    pos = [lerp(a[0], b[0], q), 0, lerp(a[1], b[1], q)];
    rot = Math.atan2(b[0] - a[0], b[1] - a[1]);
    if (u < 1) pose = lerpPose(alive(restPose(), f, 11, 0.5), walkPose(f * 0.42, 0.6), 0.9);
    else rot = Math.PI * 0.75;
  }
  return <Person o={DOCTOR} pose={pose} pos={pos} rot={rot} />;
};

// ---------------------------------------------------------------- 2D layers
const LIME = "#C6FF3D";
const Counter: React.FC<{ f: number; B: ZBeats }> = ({ f, B }) => {
  const show = seg(f, B.cA - 4, B.cA + 2) * (1 - seg(f, B.cOut - 8, B.cOut));
  if (show <= 0) return null;
  let n = 0;
  for (let i = 0; i < 27; i++) if (f >= B.cA + Math.round(((B.cB - B.cA) * i) / 26)) n = i + 1;
  const pulse = f >= B.cB ? 1 + 0.2 * Math.exp(-(f - B.cB) / 4) * Math.cos((f - B.cB) * 0.6) : 1 + 0.03 * ((f - B.cA) % 2);
  return (
    <div style={{ position: "absolute", left: 0, top: 120, width: 1080, display: "flex", justifyContent: "center", opacity: show }}>
      <div
        style={{
          fontFamily: "Changa",
          fontWeight: 800,
          fontSize: 176,
          lineHeight: 1,
          color: LIME,
          padding: "14px 60px 28px",
          borderRadius: 48,
          background: "rgba(14,16,20,0.82)",
          textShadow: "0 0 28px rgba(198,255,61,0.45)",
          transform: `scale(${pulse * lerp(0.85, 1, show)})`,
          fontVariantNumeric: "tabular-nums",
          minWidth: 260,
          textAlign: "center",
        }}
      >
        {n}
      </div>
    </div>
  );
};

const PhotoLabels: React.FC<{ f: number; B: ZBeats; keys: Key[]; proj: ReturnType<typeof projector> }> = ({ f, B, keys, proj }) => {
  const c = camAt(keys, B, f);
  const off = seg(f, Math.round(17.4 * B.fps), Math.round(17.4 * B.fps) + 8);
  return (
    <>
      {([0, 1] as const).map((i) => {
        const t0 = i === 0 ? B.flash1 : B.flash2;
        const op = seg(f, t0 + 4, t0 + 10) * (1 - off);
        if (op <= 0) return null;
        const a = proj(c, [PHOTO[i].x, frameBottom(i), PHOTO_Z]);
        const l = proj(c, [PHOTO[i].x - 1, frameBottom(i), PHOTO_Z]);
        const ppu = Math.abs(a.x - l.x); // px per world unit at the wall
        const fs = clamp(ppu * 0.075, 16, 40);
        if (a.behind) return null;
        return (
          <div
            key={i}
            dir="rtl"
            style={{
              position: "absolute",
              left: a.x - 300,
              top: a.y + fs * 0.35,
              width: 600,
              textAlign: "center",
              opacity: op,
              fontFamily: "IBM Plex Sans Arabic",
              fontWeight: 600,
              fontSize: fs,
              lineHeight: 1.2,
              color: "#FFF6E6",
            }}
          >
            <span style={{ background: "rgba(20,16,12,0.72)", padding: `${fs * 0.18}px ${fs * 0.55}px`, borderRadius: fs * 0.5 }}>صورة حقيقية · 1892</span>
          </div>
        );
      })}
    </>
  );
};

const Flash: React.FC<{ f: number; B: ZBeats }> = ({ f, B }) => {
  const k = (t0: number) => (f >= t0 && f < t0 + 3 ? [1, 0.82, 0.38][f - t0] : 0);
  const o = Math.max(k(B.flash1), k(B.flash2));
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: "#FFFFFF", opacity: o }} />;
};

// the phone: outer box x 70..520, y 110..1070; screen inset 14 px; app images are 1080 x 2402
const PH = { x: 70, y: 110, w: 450, h: 960, pad: 14 };
const SC = (PH.w - PH.pad * 2) / 1080; // image px -> screen px
const imgRect = (x0: number, y0: number, x1: number, y1: number) => ({ x: PH.x + PH.pad + x0 * SC, y: PH.y + PH.pad + y0 * SC, w: (x1 - x0) * SC, h: (y1 - y0) * SC });
const R_NAME = imgRect(560, 428, 996, 704); // the avatar + «عمر»
const R_TIME = imgRect(96, 792, 986, 940); // «الساعة · بالليل»
const R_BTN = imgRect(52, 1800, 1028, 1944); // «يلا تمرينة 💪»

const PhoneLayer: React.FC<{ f: number; B: ZBeats }> = ({ f, B }) => {
  if (f < B.phIn - 1 || f >= B.phGone) return null;
  const inU = seg(f, B.phIn, B.phIn + 14, (x) => easeOutBack(x, 1.05));
  const outU = seg(f, B.phOut, B.phGone, easeIn);
  const ty = lerp(1150, 0, inU) - 1250 * outU;
  const sc = lerp(1, 0.55, outU);
  const swapU = seg(f, B.swap, B.swap + 5, (x) => x);
  const pop = f >= B.swap ? 1 - 0.035 * Math.exp(-(f - B.swap) / 3) * Math.cos((f - B.swap) * 0.7) : 1;
  // the ring: name -> time row
  const mv = seg(f, B.ring2, B.ring2 + 8, easeInOut);
  const r = { x: lerp(R_NAME.x, R_TIME.x, mv), y: lerp(R_NAME.y, R_TIME.y, mv), w: lerp(R_NAME.w, R_TIME.w, mv), h: lerp(R_NAME.h, R_TIME.h, mv) };
  const ringOp = seg(f, B.ring1, B.ring1 + 5) * (1 - seg(f, B.press - 8, B.press - 2));
  const pulseT = f >= B.ring2 + 6 ? f - B.ring2 - 6 : f - B.ring1;
  const ringPulse = pulseT >= 0 && pulseT < 22 ? Math.sin((pulseT / 22) * Math.PI) : 0;
  const pad = 6 + 8 * ringPulse;
  // the press
  const pr = f - B.press;
  const dip = pr >= 0 && pr < 10 ? 1 - 0.07 * Math.sin((pr / 10) * Math.PI) : 1;
  const rip = pr >= 0 && pr < 18 ? pr / 18 : -1;
  const sx = PH.x + PH.pad;
  const sy = PH.y + PH.pad;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transform: `translateY(${ty}px)` }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${sc * pop})`, transformOrigin: `${PH.x + PH.w / 2}px ${PH.y + PH.h / 2}px` }}>
        <div style={{ position: "absolute", left: PH.x, top: PH.y, width: PH.w, height: PH.h, borderRadius: 62, background: "#0C0D10", boxShadow: "0 26px 50px rgba(0,0,0,0.5), inset 0 0 0 3px #34363C" }} />
        <div style={{ position: "absolute", left: sx, top: sy, width: PH.w - PH.pad * 2, height: PH.h - PH.pad * 2, borderRadius: 50, overflow: "hidden", background: "#0E0F12" }}>
          <Img src={staticFile("footage/zander-gym/app/card.png")} style={{ position: "absolute", left: 0, top: 0, width: PH.w - PH.pad * 2, display: "block", opacity: 1 - swapU }} />
          {swapU > 0 && <Img src={staticFile("footage/zander-gym/app/match.png")} style={{ position: "absolute", left: 0, top: 0, width: PH.w - PH.pad * 2, display: "block", opacity: swapU }} />}
          {/* the button, cut out of the same screenshot, dips when pressed */}
          {pr >= 0 && pr < 10 && swapU <= 0 && (
            <div
              style={{
                position: "absolute",
                left: R_BTN.x - sx,
                top: R_BTN.y - sy,
                width: R_BTN.w,
                height: R_BTN.h,
                backgroundImage: `url(${staticFile("footage/zander-gym/app/card.png")})`,
                backgroundSize: `${1080 * SC}px ${2402 * SC}px`,
                backgroundPosition: `${-(R_BTN.x - sx)}px ${-(R_BTN.y - sy)}px`,
                transform: `scale(${dip})`,
                boxShadow: `0 0 0 ${R_BTN.h}px rgba(14,15,18,0)`,
              }}
            />
          )}
          {rip >= 0 && swapU <= 0 && (
            <div style={{ position: "absolute", left: R_BTN.x - sx, top: R_BTN.y - sy, width: R_BTN.w, height: R_BTN.h, overflow: "hidden", borderRadius: 18 }}>
              <div
                style={{
                  position: "absolute",
                  left: R_BTN.w * 0.52 - 220 * rip,
                  top: R_BTN.h / 2 - 220 * rip,
                  width: 440 * rip,
                  height: 440 * rip,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.55)",
                  opacity: 1 - rip,
                }}
              />
            </div>
          )}
        </div>
        {ringOp > 0 && (
          <div
            style={{
              position: "absolute",
              left: r.x - pad,
              top: r.y - pad,
              width: r.w + pad * 2,
              height: r.h + pad * 2,
              borderRadius: 22,
              border: `5px solid ${LIME}`,
              boxShadow: `0 0 ${18 + 26 * ringPulse}px rgba(198,255,61,${0.55 + 0.35 * ringPulse})`,
              opacity: ringOp,
            }}
          />
        )}
      </div>
    </div>
  );
};

const Logo: React.FC<{ f: number; B: ZBeats }> = ({ f, B }) => {
  if (f < B.logo) return null;
  const u = seg(f, B.logo, B.logo + 9, (x) => easeOutBack(x, 1.4));
  return <Img src={staticFile("footage/zander-gym/logo.png")} style={{ position: "absolute", left: 540 - 75, top: 170 - 75, width: 150, height: 150, opacity: clamp(u * 1.4), transform: `scale(${lerp(0.7, 1, u)})` }} />;
};

/** Every moment that needs a sound (frames), for the debug overlay and the sound pass. */
export const zanderCues = (B: ZBeats) => ({
  travel: B.cut(3),
  doorPush: B.w.opened - 4,
  doorOpen: B.w.opened,
  flyIn: B.cut(4),
  count: [B.cA, B.cB],
  flash1: B.flash1,
  frame1: B.flash1,
  flash2: B.flash2,
  frame2: B.flash2,
  morph: [B.mA, B.mB],
  phoneIn: B.phIn,
  ring1: B.ring1,
  ring2: B.ring2,
  press: B.press,
  swap: B.swap,
  phoneOut: [B.phOut, B.phGone],
  logo: B.logo,
});

const DebugOverlay: React.FC<{ info: string }> = ({ info }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 20, top: 20, right: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "22px monospace", padding: 8, whiteSpace: "pre-wrap" }}>{info}</div>
    <div style={{ position: "absolute", left: 560, top: 1220, width: 420, height: 560, border: "4px dashed #ff00aa" }} />
    <div style={{ position: "absolute", left: 100, top: 1220, width: 420, height: 560, border: "4px dashed #ff00aa" }} />
    <div style={{ position: "absolute", left: 0, top: 1780, width: 1080, height: 2, background: "#ff00aa" }} />
    <div style={{ position: "absolute", left: PH.x, top: PH.y, width: PH.w, height: PH.h, border: "3px dashed #ffee00" }} />
    <div style={{ position: "absolute", left: 0, top: 1100, width: 1080, height: 150, background: "rgba(0,170,255,0.12)", borderTop: "3px dashed #00aaff", borderBottom: "3px dashed #00aaff" }} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------- the photos load before the 3D canvas mounts (so no frame is drawn without them)
const usePhotoTextures = () => {
  const [tex, setTex] = useState<(THREE.Texture | null)[] | null>(null);
  const [handle] = useState(() => delayRender("FactZander photos"));
  useEffect(() => {
    let live = true;
    Promise.all(
      PHOTO.map(
        (p) =>
          new Promise<THREE.Texture>((res, rej) =>
            new THREE.TextureLoader().load(
              staticFile(p.src),
              (t) => {
                t.colorSpace = THREE.SRGBColorSpace;
                t.anisotropy = 8;
                res(t);
              },
              undefined,
              rej,
            ),
          ),
      ),
    )
      .then((ts) => live && setTex(ts))
      .catch((e) => cancelRender(e));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (tex) continueRender(handle);
  }, [tex, handle]);
  return tex;
};

export const FactZander: React.FC<FactZanderProps> = ({ starts = ZANDER_STARTS, words = ZANDER_WORDS, durationSec = ZANDER_DURATION, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const B = useMemo(() => makeZanderBeats(starts, words, fps, durationSec), [starts, words, fps, durationSec]);
  const keys = useMemo(() => makeKeys(B), [B]);
  const proj = useMemo(() => projector(), []);
  const tex = usePhotoTextures();
  const frame = useCurrentFrame();
  const c = camAt(keys, B, frame);
  const cues = zanderCues(B);
  const sec = (v: number | number[]) => (Array.isArray(v) ? v.map((x) => (x / fps).toFixed(2)).join("-") : (v / fps).toFixed(2));
  return (
    <AbsoluteFill style={{ backgroundColor: "#2A1E16" }}>
      {tex && (
        <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 46, near: 0.1, far: 3000, position: [0, 2, 0] }} gl={{ antialias: true }}>
          <World B={B} keys={keys} tex={tex} />
        </ThreeCanvas>
      )}
      <PhotoLabels f={frame} B={B} keys={keys} proj={proj} />
      <Counter f={frame} B={B} />
      <PhoneLayer f={frame} B={B} />
      <Logo f={frame} B={B} />
      <Flash f={frame} B={B} />
      {debug && (
        <DebugOverlay
          info={`f${frame} ${(frame / fps).toFixed(2)}s lock ${frame >= B.lock ? "ON" : "off"}\np ${c.p.map((v) => v.toFixed(2)).join(",")} l ${c.l.map((v) => v.toFixed(2)).join(",")} fov ${c.fov.toFixed(1)}\n${Object.entries(cues)
            .map(([k, v]) => `${k} ${sec(v)}`)
            .join(" · ")}`}
        />
      )}
    </AbsoluteFill>
  );
};
