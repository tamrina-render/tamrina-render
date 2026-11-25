// Mr. / Mrs. Coin in 3D (presenter { type: "coin", render: "3d" }).
// The Miss-Minutes approach: a real 3D body with cel (toon) shading + dark outline hulls, and the SAME 2D face drawn
// onto the coin (eyes, brows, mouth, moods). The body follows real coin anatomy (owner 2026-10-26: "a coin has
// thickness, edge in edge"): flat field, raised rim on both sides, straight reeded edge, denticles, raised "+1" / "$".
// All motion comes from coinPose() (shared with the 2D coin): moods, Rhubarb mouth shapes, squash on stressed words,
// gestures (point / thumbs up / hip / wave), flips. Seen at a slight angle so it always reads as 3D.
// Deterministic: everything is computed from the frame (no useFrame / clocks), as Remotion needs.
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile, useVideoConfig } from "remotion";
import * as THREE from "three";
import { FONT, loadFonts } from "../lib/fonts";
import { ACTION_CUES, cueAt, fxAt, GESTURE_CUES, KICK_CONTACT, type HandPose } from "../lib/speech";
import type { CastMember, Kit, KitSpec, Mood, PresenterConfig, RideCfg, Scene, Theme, Timeline } from "../lib/types";
import { coinPose, VARIANTS } from "./CoinPresenter";
import { noise } from "../lib/human";
import { mocapAt } from "../lib/mocap";
import { actingOf } from "../lib/acting";

const W = 1080, H = 1920;          // the stage canvas covers the whole frame, so a coin can stand anywhere
const UNIT = 130 * (619 / 380) * 0.82; // px per world unit at size 1 (= the brand coin at the bottom)
const FOV = 30;
const HALF = 0.13, LIP = 0.035, TOP = HALF + LIP, RIN = 0.86; // coin anatomy (radius 1): field at ±HALF, rim lip to ±TOP
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
// 2D design space (the approved SVG): coin centre (190, 222), radius 130 -> 1 world unit
const m = (x: number, y: number, z = 0) => new THREE.Vector3((x - 190) / 130, -(y - 222) / 130, z);
const rot = (x: number, y: number, cx: number, cy: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180, dx = x - cx, dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
};
const bezier = (p: number[][], n = 7) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1), u = 1 - t;
    return [0, 1].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]);
  });

/** Straight edge with 120 reeds (the grooves on a coin's side). */
const reededEdge = () => {
  const g = new THREE.CylinderGeometry(1, 1, 2 * TOP, 720, 1, true);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = 1 + 0.009 * Math.pow(0.5 + 0.5 * Math.cos(a * 120), 2);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  g.rotateX(Math.PI / 2);
  return g;
};

/** 3-step cel shading ramp. */
const toonRamp = () => {
  const t = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
};

/** A toon mesh + its outline (inverted hull). `hull` = geometry for the outline (default: the same one scaled). */
const Toon: React.FC<{ geo: THREE.BufferGeometry; hull?: THREE.BufferGeometry; color: string; line: string; ramp: THREE.Texture; grow?: number; side?: THREE.Side }> = ({ geo, hull, color, line, ramp, grow = 1.06, side }) => (
  <group>
    <mesh geometry={geo}>
      <meshToonMaterial color={color} gradientMap={ramp} side={side} />
    </mesh>
    {grow > 0 && (
      <mesh geometry={hull ?? geo} scale={hull ? 1 : grow}>
        <meshBasicMaterial color={line} side={THREE.BackSide} />
      </mesh>
    )}
  </group>
);

/** Rubber-hose limb: a tube through points, plus a slightly fatter dark tube as its outline. */
const Hose: React.FC<{ pts: THREE.Vector3[]; r: number; color: string; line: string; ramp: THREE.Texture }> = ({ pts, r, color, line, ramp }) => {
  const curve = new THREE.CatmullRomCurve3(pts);
  return <Toon geo={new THREE.TubeGeometry(curve, 28, r, 12, false)} hull={new THREE.TubeGeometry(curve, 28, r + 0.024, 12, false)} color={color} line={line} ramp={ramp} />;
};

// finger curls (radians, bend toward the viewer) per hand pose: [pinky side, middle, index]; thumb: [angle, lift]
const CURL: Record<HandPose, { f: number[]; thumb: number }> = {
  open: { f: [0, 0, 0], thumb: 0 },
  point: { f: [2.2, 2.2, 0], thumb: 1 },
  thumb: { f: [2.2, 2.2, 2.2], thumb: 2 },
  fist: { f: [2.2, 2.2, 2.2], thumb: 1 },
  count1: { f: [2.2, 2.2, 0], thumb: 1 },
  count2: { f: [2.2, 0, 0], thumb: 1 },
  count3: { f: [0, 0, 0], thumb: 1 },
};

/** Puffy cartoon glove: palm, 3 fat fingers + thumb, flared cuff. Fingers point to +y, palm toward the viewer. */
type Prop = "dumbbell" | "bottle" | "shawarma" | "shaker" | "lantern" | "phone" | "pompom" | "clipboard" | "clapper";
/** Gym props held in the palm (built from simple toon shapes with the same outline as the coin). */
const PropMesh: React.FC<{ kind: Prop; line: string; ramp: THREE.Texture; girly?: boolean }> = ({ kind, line, ramp, girly }) => {
  // Mrs. Coin's gym kit is girly: lavender dumbbells with a white grip, a pink bottle, a white shaker with a pink lid
  const C = girly
    ? { grip: "#F4F5F7", plate: "#B58CFF", bottle: "#FF8DC7", band: "#F4F5F7", shaker: "#F4F5F7", lid: "#FF5CA8" }
    : { grip: "#5A5F69", plate: "#24272E", bottle: "#7CC8FF", band: "#D6FF3C", shaker: "#0E0F12", lid: "#D6FF3C" };
  const g = useMemo(() => ({ cyl: new THREE.CylinderGeometry(1, 1, 1, 24), cone: new THREE.CylinderGeometry(1, 0.72, 1, 24), ball: new THREE.SphereGeometry(1, 16, 12), box: new THREE.BoxGeometry(1, 1, 1) }), []);
  const T = (geo: THREE.BufferGeometry, color: string, pos: [number, number, number], scl: [number, number, number], rotZ = 0, grow = 1.12) => (
    <group position={pos} rotation={[0, 0, rotZ]} scale={scl}><Toon geo={geo} color={color} line={line} ramp={ramp} grow={grow} /></group>
  );
  if (kind === "dumbbell") return (
    <group>
      {T(g.cyl, C.grip, [0, 0, 0], [0.028, 0.42, 0.028], Math.PI / 2, 1.3)}
      {T(g.cyl, C.plate, [-0.2, 0, 0], [0.1, 0.07, 0.1], Math.PI / 2)}
      {T(g.cyl, C.plate, [0.2, 0, 0], [0.1, 0.07, 0.1], Math.PI / 2)}
    </group>
  );
  if (kind === "bottle") return (
    <group position={[0, 0.06, 0]}>
      {T(g.cyl, C.bottle, [0, 0, 0], [0.075, 0.3, 0.075])}
      {T(g.cyl, C.band, [0, -0.02, 0], [0.078, 0.08, 0.078], 0, 1.02)}
      {T(g.cyl, "#F4F5F7", [0, 0.18, 0], [0.04, 0.06, 0.04])}
    </group>
  );
  if (kind === "shawarma") return (
    <group position={[0, 0.06, 0]}>
      {T(g.cone, "#E8C38A", [0, 0.04, 0], [0.075, 0.3, 0.075])}
      {T(g.cyl, "#F4F5F7", [0, -0.06, 0], [0.08, 0.16, 0.08], 0, 1.04)}
      {T(g.ball, "#8B5A2B", [0, 0.2, 0], [0.065, 0.04, 0.065])}
    </group>
  );
  if (kind === "phone") return (
    // we see its back (the screen faces the coin): a case in the coin's colour, a black camera lens, a white flash
    <group position={[0, 0.08, 0]}>
      {T(g.box, girly ? "#FF8DC7" : "#24272E", [0, 0, 0], [0.13, 0.24, 0.025], 0, 1.08)}
      <group position={[-0.03, 0.08, 0.016]} rotation={[Math.PI / 2, 0, 0]} scale={[0.024, 0.01, 0.024]}><Toon geo={g.cyl} color="#0E0F12" line={line} ramp={ramp} grow={1.3} /></group>
      <group position={[0.015, 0.09, 0.016]} rotation={[Math.PI / 2, 0, 0]} scale={[0.011, 0.01, 0.011]}><Toon geo={g.cyl} color="#F4F5F7" line={line} ramp={ramp} grow={0} /></group>
    </group>
  );
  if (kind === "clapper") return (
    // an ancient Egyptian ivory clapper: a slightly curved off-white stick ending in a small carved hand (outfit "clappers", one in each glove)
    <group position={[0, -0.06, 0]} rotation={[0, 0, 0.3]} scale={1.2}>
      {T(g.cyl, "#F1E6CC", [0, 0.1, 0], [0.026, 0.24, 0.026], 0, 1.25)}
      {T(g.cyl, "#F1E6CC", [0.022, 0.3, 0], [0.024, 0.2, 0.024], -0.22, 1.25)}
      {T(g.box, "#F8F0DC", [0.05, 0.44, 0], [0.085, 0.1, 0.03], -0.22, 1.12)}
      {[-0.028, 0, 0.028].map((x) => <group key={x} position={[0.062 + x * 0.95, 0.515 - x * 0.2, 0]} rotation={[0, 0, -0.22]} scale={[0.011, 0.07, 0.011]}><Toon geo={g.cyl} color="#F8F0DC" line={line} ramp={ramp} grow={1.3} /></group>)}
    </group>
  );
  if (kind === "clipboard") return (
    // a trainer's clipboard held by its edge: brown board, a white sheet with lines, a silver clip on top
    <group position={[0.02, 0.14, 0]} rotation={[0, 0, -0.25]}>
      {T(g.box, "#8B5A2B", [0, 0, 0], [0.2, 0.27, 0.018], 0, 1.08)}
      {T(g.box, "#F4F5F7", [0, -0.015, 0.012], [0.165, 0.21, 0.006], 0, 1.02)}
      {[0.04, 0, -0.04, -0.08].map((y) => <mesh key={y} geometry={g.box} position={[0, y, 0.017]} scale={[0.12, 0.008, 0.002]}><meshBasicMaterial color="#9AA0A8" /></mesh>)}
      {T(g.box, "#C9CED6", [0, 0.125, 0.016], [0.08, 0.035, 0.02], 0, 1.1)}
    </group>
  );
  if (kind === "pompom") return (
    // fluffy pom-pom: a ball of small balls, two colours mixed
    <group position={[0, 0.13, 0]}>
      {Array.from({ length: 13 }, (_, i) => {
        const a = i * 2.4, z = 1 - (2 * (i + 0.5)) / 13, rr = Math.sqrt(1 - z * z);
        return <group key={i} position={[Math.cos(a) * rr * 0.1, z * 0.1, Math.sin(a) * rr * 0.1]} scale={0.065}><Toon geo={g.ball} color={i % 3 === 0 ? "#F4F5F7" : girly ? "#FF5CA8" : "#D6FF3C"} line={line} ramp={ramp} grow={1.1} /></group>;
      })}
    </group>
  );
  if (kind === "lantern") return (
    <group position={[0, 0.16, 0]}>
      {T(g.cyl, "#F5B82E", [0, 0, 0], [0.11, 0.24, 0.11])}
      <mesh geometry={g.cyl} position={[0, 0, 0]} scale={[0.085, 0.2, 0.085]}><meshBasicMaterial color="#FFE48A" /></mesh>
      {T(g.cone, "#F5B82E", [0, 0.17, 0], [0.06, 0.12, 0.06])}
      {T(g.cyl, "#C98A12", [0, -0.14, 0], [0.13, 0.04, 0.13])}
      {T(g.ball, "#F5B82E", [0, 0.26, 0], [0.035, 0.035, 0.035])}
    </group>
  );
  return (
    <group position={[0, 0.04, 0]}>
      {T(g.cyl, C.shaker, [0, 0, 0], [0.08, 0.26, 0.08])}
      {T(g.cyl, C.lid, [0, 0.15, 0], [0.084, 0.05, 0.084], 0, 1.04)}
    </group>
  );
};

/** A barbell along x, centred (coin units: plates of radius 0.42 at ±1.3, about a coin and a half wide each side). */
const BarbellMesh: React.FC<{ line: string; ramp: THREE.Texture }> = ({ line, ramp }) => {
  const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 28), []);
  const T = (color: string, x: number, scl: [number, number, number], grow = 1.1) => (
    <group key={`${x}${color}`} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={scl}><Toon geo={cyl} color={color} line={line} ramp={ramp} grow={grow} /></group>
  );
  return (
    <group>
      {T("#9AA0A8", 0, [0.032, 3.25, 0.032], 1.35)}
      {[-1, 1].map((s) => [
        T("#24272E", s * 1.3, [0.42, 0.1, 0.42]),
        T("#24272E", s * 1.17, [0.33, 0.08, 0.33]),
        T("#D6FF3C", s * 1.36, [0.2, 0.025, 0.2], 1.02),
        T("#9AA0A8", s * 1.47, [0.06, 0.07, 0.06], 1.2),
      ])}
    </group>
  );
};

/** outfit "phone": the phone stands upright with its back to the camera whatever the wrist does (up / face = the world's up and +z seen from inside the glove) */
const phoneFront = (up: THREE.Vector3, face: THREE.Vector3) => {
  const y = up.clone().normalize(), z = face.clone().sub(y.clone().multiplyScalar(face.dot(y))).normalize(), x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
};
const Glove: React.FC<{ white: string; line: string; ramp: THREE.Texture; pose: HandPose; w: number; worldRz: number; prop?: Prop | null; level?: THREE.Vector3; up?: THREE.Vector3; girly?: boolean; propSize?: number; face?: THREE.Vector3 }> = ({ white, line, ramp, pose, w, worldRz, prop, level, up, girly, propSize, face }) => {
  const g = useMemo(() => ({
    palm: new THREE.SphereGeometry(0.14, 24, 16),
    finger: new THREE.CapsuleGeometry(0.052, 0.1, 6, 12),
    thumb: new THREE.CapsuleGeometry(0.05, 0.085, 6, 12),
    cuff: new THREE.CylinderGeometry(0.12, 0.165, 0.11, 28),
  }), []);
  const C = CURL[pose];
  const curl = (k: number) => C.f[k] * w;
  const xs = [-0.085, 0, 0.085];
  // thumb: open = out to the side; folded = across the palm; thumbs-up = straight up in WORLD space
  const thumbUp = C.thumb === 2 ? w : 0, thumbIn = C.thumb === 1 ? w : 0;
  const thumbRz = -0.95 * (1 - thumbIn - thumbUp) + 0.6 * thumbIn + (-worldRz) * thumbUp;
  return (
    <group position={[0, 0.2, 0]}>
      <group scale={[1.12, 1.02, 0.78]}><Toon geo={g.palm} color={white} line={line} ramp={ramp} grow={1.09} /></group>
      {xs.map((x, k) => (
        <group key={k} position={[x, 0.1, 0]} rotation={[curl(k), 0, -x * 1.2]}>
          <group position={[0, 0.085 - (k === 1 ? 0 : 0.01), 0]}><Toon geo={g.finger} color={white} line={line} ramp={ramp} grow={1.17} /></group>
        </group>
      ))}
      <group position={[0.12 - 0.05 * thumbIn, -0.01 + 0.08 * thumbUp, 0.03]} rotation={[thumbIn * 0.8, 0, thumbRz]}>
        <group position={[0, 0.07, 0]}><Toon geo={g.thumb} color={white} line={line} ramp={ramp} grow={1.18} /></group>
      </group>
      <group position={[0, -0.17, 0]}><Toon geo={g.cuff} color={white} line={line} ramp={ramp} grow={1.08} /></group>
      {prop && (
        <group position={[0, 0.02, 0.14]} quaternion={prop === "phone" && up && face ? phoneFront(up, face) : prop === "clapper" && up ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up.clone().normalize()) : prop === "dumbbell" && level ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), (level.x < 0 ? level.clone().negate() : level.clone()).normalize()) : undefined} scale={1.7 * (prop === "dumbbell" ? propSize ?? 1 : 1)}>
          <PropMesh kind={prop} line={line} ramp={ramp} girly={girly} />
        </group>
      )}
    </group>
  );
};

/** Draw the face (or the back) on a 512px canvas in the 2D design coordinates. */
const drawRelief = (g: CanvasRenderingContext2D, ink: string, draw: (fill: string) => void) => {
  g.save(); g.translate(1.8, 1.8); draw("rgba(0,0,0,0.28)"); g.restore();       // relief shadow
  g.save(); g.translate(-1.2, -1.2); draw("rgba(255,255,255,0.55)"); g.restore(); // relief highlight
  draw(ink);
};
const denticles = (g: CanvasRenderingContext2D) => {
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2, x = 190 + Math.cos(a) * 104, y = 222 + Math.sin(a) * 104;
    g.beginPath(); g.arc(x + 0.8, y + 0.8, 3.2, 0, Math.PI * 2); g.fillStyle = "rgba(0,0,0,0.3)"; g.fill();
    g.beginPath(); g.arc(x - 0.6, y - 0.6, 2.2, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,0.55)"; g.fill();
  }
};

// Where a coin can stand (coin centre in px on the 1080x1920 frame, size 1 = the usual bottom coin).
export const PLACES: Record<string, { x: number; y: number; s: number }> = {
  bottom: { x: 540, y: 1633, s: 1 },
  left: { x: 290, y: 1610, s: 0.85 }, right: { x: 790, y: 1610, s: 0.85 },
  center: { x: 540, y: 1080, s: 1.7 }, top: { x: 540, y: 640, s: 0.9 },
  bigLeft: { x: 300, y: 1180, s: 1.3 }, bigRight: { x: 780, y: 1180, s: 1.3 }, // duo intros: both big, side by side
  corner: { x: 905, y: 1735, s: 0.5 }, zoom: { x: 560, y: 1180, s: 2.7 },
  off: { x: 540, y: -700, s: 1 },
  // card interactions (the visual card sits around x 140..940, y 570..1170)
  cardRight: { x: 905, y: 1215, s: 0.78 }, cardLeft: { x: 175, y: 1215, s: 0.78 },
  cardTop: { x: 760, y: 470, s: 0.62 }, cardPeek: { x: 930, y: 860, s: 0.9 },
};
// where a scene wants him to look: "lookAt": "x,y" (reel px) or "camera", else the face found in its footage (make.mjs probe)
const lookTarget = (sc: Scene | undefined): { x: number; y: number } | null => {
  if (!sc || sc.lookAt === "camera") return null;
  if (sc.lookAt) { const [x, y] = sc.lookAt.split(",").map(Number); return { x, y }; }
  return sc.footage?.probe?.face ?? null;
};
// a preset name, or "x,y,size" for footage scenes (the spot where the real person looks)
// "x,y,size": px, or fractions of the frame when x and y are both <= 1 ("0.7,0.62,0.5"; no px place is ever that small)
const toPlace = (name: string) => PLACES[name] ?? (/^-?[\d.]/.test(name) ? (([x, y, s]) => (x <= 1 && y <= 1 ? { x: x * W, y: y * H, s: s || 0.6 } : { x, y, s: s || 0.6 }))(name.split(",").map(Number)) : PLACES.bottom);
const STATE_PLACE: Record<string, string> = { lean: "cardRight", push: "cardRight", sit: "cardTop", peek: "cardPeek" };
// ---- the cast of copies (presenter.cast with objects): one base coin, any number of copies with overrides ----
type Kind = "mr" | "mrs" | "plain";
const membersOf = (tl: Timeline): CastMember[] | null => {
  const c = tl.presenter?.cast;
  return c && c.some((m) => typeof m === "object") ? c.map((m) => (typeof m === "string" ? { id: m } : m)) : null;
};
/** a copy's own spot: its "place", else spread in a row along the bottom */
const memberPlace = (tl: Timeline, id: string) => {
  const ms = membersOf(tl) ?? [], i = Math.max(0, ms.findIndex((m) => m.id === id)), n = Math.max(1, ms.length);
  return ms[i]?.place ?? `${Math.round(((i + 1) / (n + 1)) * W)},1640,${n > 4 ? 0.42 : n > 2 ? 0.55 : 0.75}`;
};
/** every coin to draw: the legacy single coin / duo exactly as before, or the cast of copies (each with its own config) */
export const castOf = (tl: Timeline, cfg: PresenterConfig) => {
  const ms = membersOf(tl.presenter?.cast ? tl : { ...tl, presenter: cfg });
  if (!ms) {
    const ids: string[] = cfg.cast && cfg.cast.length ? (cfg.cast as string[]) : [cfg.name === "mrs" ? "mrs" : "mr"];
    const duo = ids.length > 1;
    return ids.map((who) => ({ who, duo, c: { ...cfg, name: who } as PresenterConfig, enterAt: duo && cfg.entrance !== "none" ? tl.scenes.find((sc) => sc.speaker === who)?.start ?? 0 : 0 })); // "none" (a loop): both are there from frame 0
  }
  const duo = ms.length > 1;
  return ms.map((M, i) => {
    const kind: Kind = M.from ?? (M.id === "mrs" ? "mrs" : M.id === "mr" ? "mr" : "plain");
    // de-twin: Mr. keeps seed 0, Mrs. 1 (as in the duo); every other copy its own phase, blink rhythm and glances
    const seed = M.id === "mr" ? 0 : M.id === "mrs" ? 1 : 2 + i * 0.618;
    const c: PresenterConfig = {
      ...cfg, cast: undefined, name: kind, kind, id: M.id, seed,
      colors: { ...(cfg.colors ?? {}), ...(M.color ? { coin: M.color } : {}) },
      scale: (cfg.scale ?? 0.82) * (M.scale ?? 1),
      outfit: M.outfit ?? cfg.outfit, kit: M.kit ?? cfg.kit, entrance: M.entrance ?? cfg.entrance,
      lashes: M.lashes, ponytail: M.ponytail, brows: M.brows, eyes: M.eyes, place: M.place, turn: M.turn,
      seated: M.seated ?? cfg.seated, dumbbell: M.dumbbell ?? cfg.dumbbell, press: M.press, dangle: M.dangle,
    };
    return { who: M.id, duo, c, enterAt: 0 }; // copies are all on stage from the start
  });
};
const legacyOf = (cfg?: PresenterConfig) => cfg?.id === undefined;
const kindFor = (who: string, cfg?: PresenterConfig): Kind => cfg?.kind ?? (who === "mrs" ? "mrs" : who === "mr" ? "mr" : "plain");
const seedFor = (who: string, cfg?: PresenterConfig) => cfg?.seed ?? (who === "mrs" ? 1 : 0);

const placeName = (sc: Scene | undefined, who: string, duo: boolean, full?: Timeline) => {
  const p = sc?.place;
  const def = full && membersOf(full) ? memberPlace(full, who) : duo ? (who === "mr" ? "left" : "right") : "bottom";
  if (!p) return def;
  if (typeof p === "string") return duo ? (sc?.speaker === who ? p : def) : p;
  return p[who] ?? def;
};

// ===================================================================================================================
// Per-character view of the timeline. `{cue}` names may target a coin: "mrs:eyeroll", "mr:jump", "both:highfive".
// In a duo, a coin sees its own scenes, LISTENS in the other's (no words, warm face, no gestures, muted mouth),
// and still plays cues addressed to it. Mood names in cues become that coin's moods.
// ===================================================================================================================
const MOOD_ALIASES: Record<string, Mood> = {
  sad: "sad", cry: "cry", crying: "cry", angry: "angry", mad: "angry", annoyed: "annoyed", smug: "smug", ehem: "smug",
  shocked: "shocked", love: "love", hearts: "love", starry: "starry", stars: "starry", sleepy: "sleepy", dizzy: "dizzy",
  shy: "shy", blush: "shy", nervous: "nervous", wink: "wink", happy: "happy", laugh: "laugh", excited: "excited",
  surprised: "surprised", curious: "curious", calm: "neutral", neutral: "neutral",
  disgusted: "disgusted", disgust: "disgusted", ew: "disgusted", zen: "zen", peek: "peek", resigned: "resigned", givesup: "resigned",
};
// Catchphrases from the bible fire their move by themselves (a writer gets the personality without remembering cues).
// Only when the scene has no move of its own; the move lands a beat before the phrase. Body + hands + that move's face.
const norm = (w: string) => w.replace(/[\u064B-\u0652\u0640]/g, "").replace(/[\p{P}*]/gu, "").replace(/[أإآ]/g, "ا");
const CATCHPHRASES: { re: RegExp; cue: string }[] = [
  { re: /جامد ده/, cue: "wow" },                       // Mr. Coin: "جامد ده!"
  { re: /(^| )(احم|قولتلكم|قلتلكم)( |$)/, cue: "toldyou" }, // Mrs. Coin: "إحم... قولتلكم!"
  { re: /لهوي/, cue: "drama" },                        // Mrs. Coin: "يا لهوي"
  { re: /الدايت من بكره|الدايت من بكرة/, cue: "hungry" }, // Mr. Coin's running gag
  { re: /هبقي وحش|هبقى وحش/, cue: "plan" },             // Mr. Coin every Monday
];
const catchphraseCue = (sc: Scene): { t: number; name: string } | null => {
  const ws = sc.words.map((w) => norm(w.w));
  for (const { re, cue } of CATCHPHRASES) for (let i = 0; i < ws.length; i++) {
    if (re.test(ws.slice(i, i + 4).join(" ")) && !re.test(ws.slice(i + 1, i + 4).join(" "))) return { t: Math.max(sc.start, sc.words[i].start - 0.15), name: cue };
  }
  return null;
};
const viewFor = (tl: Timeline, who: string, duo: boolean, kind: Kind = who === "mrs" ? "mrs" : "mr"): Timeline => {
  const mine = (t: number) => tl.scenes.some((sc) => (!duo || sc.speaker === who) && t >= sc.start && t < sc.end);
  const scenes = tl.scenes.map((sc) => {
    const speaking = !duo || !sc.speaker || sc.speaker === who;
    const cues: { t: number; name: string }[] = [];
    // a listener smiles by default, unless the script gives him his own face from the scene's start (it would be dropped: MIN_HOLD)
    const ownFace = (sc.cues ?? []).some((c) => { const [a, b] = c.name.split(":"); return (a === who || a === "both" || a === "all") && !!MOOD_ALIASES[b] && c.t - sc.start < 0.1; });
    const moods: { t: number; mood: Mood; temp?: boolean }[] = speaking ? [...(sc.moods ?? [])] : ownFace ? [] : [{ t: sc.start, mood: "happy" as Mood }];
    for (const c of sc.cues ?? []) {
      const [a, b] = c.name.includes(":") ? c.name.split(":") : [null, c.name];
      const forMe = a === null ? speaking : a === who || a === "both" || a === "all";
      if (!forMe) continue;
      if (MOOD_ALIASES[b]) moods.push({ t: c.t, mood: MOOD_ALIASES[b], temp: true }); else cues.push({ t: c.t, name: b });
    }
    moods.sort((x, y) => x.t - y.t);
    if (speaking && kind !== "plain" && !cues.some((c) => ACTION_CUES[c.name])) { const cp = catchphraseCue(sc); if (cp) cues.push(cp); }
    return speaking ? { ...sc, cues, moods } : { ...sc, words: [], moods, cues, gesture: "none" as const, pose: undefined };
  });
  if (!duo) return { ...tl, scenes };
  // human layer: where a listener nods = the other speaker's pauses (a gap >= 0.3 s inside his line, or his line's end
  // when the next line is not mine: I am about to speak there)
  const nods: number[] = [];
  tl.scenes.forEach((sc, i) => {
    if (!sc.speaker || sc.speaker === who || !sc.words.length) return;
    sc.words.forEach((w, k) => { if (k > 0 && w.start - sc.words[k - 1].end >= 0.3) nods.push(sc.words[k - 1].end); });
    if (tl.scenes[i + 1]?.speaker !== who) nods.push(sc.words[sc.words.length - 1].end);
  });
  return {
    ...tl, scenes, hear: { nods },
    pros: tl.pros ? { ...tl.pros, p: tl.pros.p.map((x, i) => (mine(i / tl.pros!.fps) ? x : 0)), acc: tl.pros.acc.filter((a) => mine(a.t)) } : tl.pros,
    mouth: tl.mouth?.filter((c) => mine(c.t)),
    env: tl.env ? { ...tl.env, v: tl.env.v.map((x, i) => (mine(i / tl.env!.fps) ? x : 0)) } : tl.env,
  };
};

// ===================================================================================================================
// Hands: each hand goes to a TARGET (svg design coords), the rubber-hose arm curves from the shoulder to it.
// a = direction the fingers point, degrees clockwise from up (svg). z = how far in front of the coin.
// ===================================================================================================================
type Hand = { x: number; y: number; a: number; z: number; pose: HandPose; curl: number };
type HandTargets = { L?: Partial<Hand>; R?: Partial<Hand>; lookX?: number; lookY?: number; shut?: number; lift?: number };
const SHOULDER_L: [number, number] = [62, 264], SHOULDER_R: [number, number] = [318, 264]; // on the rim: arms come out of the edge

/** Where the hands go for a gesture cue at local time lt. */
const gestureHands = (name: string, lt: number): HandTargets => {
  switch (name) {
    // knocking two held clappers (outfit "clappers") together twice, low in front of the tummy so the face stays clear
    case "clack": { const o = Math.abs(Math.sin(lt * 5.5)); return { L: { x: 150 - 26 * o, y: 345, a: 0, z: 0.6, pose: "fist" }, R: { x: 230 + 26 * o, y: 345, a: 0, z: 0.6, pose: "fist" } }; }
    case "clap": { const o = Math.abs(Math.sin(lt * 11)); return { L: { x: 172 - 16 * o, y: 290, a: 25, z: 0.5, pose: "open" }, R: { x: 208 + 16 * o, y: 290, a: -25, z: 0.5, pose: "open" } }; }
    case "cross": return { L: { x: 238, y: 318, a: 98, z: 0.46, pose: "fist" }, R: { x: 144, y: 322, a: -98, z: 0.52, pose: "fist" } };
    case "shrug": return { L: { x: 26, y: 206, a: -58, z: 0.15, pose: "open" }, R: { x: 354, y: 206, a: 58, z: 0.15, pose: "open" }, lift: 1 };
    case "facepalm": return { R: { x: 214, y: 206, a: -12, z: 0.58, pose: "open" }, shut: 1 };
    case "chin": case "think": return { R: { x: 206, y: 306, a: -24, z: 0.5, pose: "fist" }, lookX: -4, lookY: -7 };
    case "count": { const n = Math.min(3, 1 + Math.floor(lt / 0.55)); return { R: { x: 318, y: 166, a: 12, z: 0.26, pose: (`count${n}` as HandPose) } }; }
    case "wave": return { R: { x: 346 + Math.sin(lt * 14) * 12, y: 134, a: Math.sin(lt * 14) * 26 - 8, z: 0.26, pose: "open" } };
    case "point": return { R: { x: 332, y: 118, a: -32, z: 0.26, pose: "point" }, lookX: 4, lookY: -6 };
    case "you": return { R: { x: 286, y: 262, a: -10, z: 0.95, pose: "point" } }; // points at the camera (the viewer), the talking hand "you" held as a cue
    case "thumb": return { R: { x: 334, y: 178, a: 0, z: 0.3, pose: "thumb" } };
    case "hip": return { L: { x: 96, y: 302, a: 150, z: 0.25, pose: "fist" }, R: { x: 284, y: 302, a: -150, z: 0.25, pose: "fist" } };
    case "flex": return { R: { x: 300, y: 150, a: -60, z: 0.3, pose: "fist" }, L: { x: 96, y: 302, a: 150, z: 0.25, pose: "fist" } };
    case "watch": return { L: { x: 150, y: 288, a: 70, z: 0.5, pose: "fist" }, lookX: -6, lookY: 7 };
    default: return {};
  }
};


// ===================================================================================================================
// NATURAL HANDS (owner 2026-10-26: "not always one hand up and one on the hip; move like a person").
// A deterministic gesture plan built from the words: relaxed hands by the sides; while talking a gesture lands on
// stressed words (and at least every ~1.4 s): open palm, both hands explaining, hand on chest for "I/we", pointing
// at the viewer for "you", a small beat; never the same twice in a row. Listening / pauses: small idle moves.
// Moods then bend the hands (angry fists, sad hanging, shocked hands up, love at the chest, nervous fidget...).
// ===================================================================================================================
/**
 * Hand angles are measured from the one direction each hand never points to (into the body, down and across):
 * right hand in [-120°, 240°), left hand in [120°, 480°). A blend between two angles then always turns the same,
 * natural way (before: a ~180° turn picked the short way, and the short way flipped from one frame to the next).
 */
const normA = (a: number, side: -1 | 1) => { const lo = side < 0 ? 120 : -120; return lo + ((((a - lo) % 360) + 360) % 360); };
const REST_L: Hand = { x: 34, y: 356, a: 196, z: 0.14, pose: "open", curl: 0.35 };
const REST_R: Hand = { x: 346, y: 356, a: 164, z: 0.14, pose: "open", curl: 0.35 };
type Plan = { t: number; dur: number; g: string; prep?: number }; // prep = s before the stroke (the acting director: the pose arrives on the stroke)
const hash = (n: number) => { const x = Math.sin(n * 91.345 + 47.853) * 43758.5453; return x - Math.floor(x); };
const SELF = /^(و?(أنا|انا|إنا)|و?(احنا|إحنا|احنا)|عندي|بتاعي)$/;
const YOU = /^(و?(انت|إنت|انتي|إنتي|انتو|إنتو|انتم)|ليك|ليكي|ليكو|ليكم|معاك|معاكي|معاكو|معاكم|بتاعك|بتاعتك)$/;
const planHands = (tl: Timeline): Plan[] => {
  const plan: Plan[] = [];
  let last = "", lastT = -9, n = 0;
  const last_i = tl.scenes.length - 1;
  tl.scenes.forEach((sc, i) => {
    if (!sc.words.length) return;
    if (i === 0) { plan.push({ t: sc.start + 0.1, dur: 1.0, g: "wave" }); last = "wave"; lastT = sc.start + 0.1; }
    sc.words.forEach((w, k) => {
      const word = w.w.replace(/[\p{P}*]/gu, "");
      const self = SELF.test(word), you = YOU.test(word);
      if (!(w.emph || self || you || w.start - lastT > 1.6)) return;
      if (w.start - lastT < 0.75 && !self && !you) return;
      let g: string;
      if (self) g = "self";
      else if (you) g = "you";
      else if (i === last_i && w.emph && !plan.some((p) => p.g === "thumb")) g = "thumb";
      else {
        const opts = ["presentR", "beatR", "both", "presentL", "beatL", "openR"];
        if (sc.visual?.type && sc.visual.type !== "none" && k < 3) opts.push("up");
        g = opts[Math.floor(hash(++n + i * 7) * opts.length)];
        if (g === last) g = opts[(opts.indexOf(g) + 1 + Math.floor(hash(n + 3) * (opts.length - 1))) % opts.length];
      }
      const next = sc.words.slice(k + 1).find((x) => x.emph)?.start ?? sc.end;
      plan.push({ t: w.start - 0.22, dur: Math.max(0.6, Math.min(1.3, next - w.start - 0.1)), g });
      last = g; lastT = w.start;
    });
  });
  return plan;
};
/** A pose mirrored to the other hand ("m:<name>": the acting director, when a friend stands on that side). */
const mirrorHT = (h: HandTargets): HandTargets => {
  const m = (x?: Partial<Hand>) => (x ? { ...x, x: x.x === undefined ? undefined : 380 - x.x, a: x.a === undefined ? undefined : -x.a } : undefined);
  return { ...h, L: m(h.R), R: m(h.L), lookX: h.lookX === undefined ? undefined : -h.lookX };
};
/** Palm targets for a planned / idle gesture at local time lt. */
const planTargets = (g: string, lt: number): HandTargets => {
  if (g.startsWith("m:")) return mirrorHT(planTargets(g.slice(2), lt));
  const beat = Math.sin(Math.min(1, lt / 0.35) * Math.PI) * 16;
  switch (g) {
    case "wave": return gestureHands("wave", lt);
    case "presentR": return { R: { x: 376, y: 266, a: 72, z: 0.34, pose: "open" } };
    case "presentL": return { L: { x: 4, y: 266, a: -72, z: 0.34, pose: "open" } };
    case "openR": return { R: { x: 360, y: 214, a: 40, z: 0.3, pose: "open" } };
    case "openL": return { L: { x: 20, y: 214, a: -40, z: 0.3, pose: "open" } }; // openR's mirror (the director uses it when a friend stands on his right)
    case "both": return { L: { x: 14, y: 282, a: -80, z: 0.36, pose: "open" }, R: { x: 366, y: 282, a: 80, z: 0.36, pose: "open" } };
    case "beatR": return { R: { x: 352, y: 286 + beat, a: 115, z: 0.3, pose: "open" } };
    case "beatL": return { L: { x: 28, y: 286 + beat, a: -115, z: 0.3, pose: "open" } };
    case "self": return { R: { x: 222, y: 302, a: -62, z: 0.6, pose: "open" } };
    case "you": return { R: { x: 286, y: 262, a: -10, z: 0.95, pose: "point" } };
    case "up": return gestureHands("point", lt);
    case "thumb": return gestureHands("thumb", lt);
    // idle (listening / pauses)
    case "hipL": return { L: { x: 96, y: 302, a: 150, z: 0.25, pose: "fist" } };
    case "hips": return gestureHands("hip", lt);
    case "scratch": return { R: { x: 300 + Math.sin(lt * 18) * 5, y: 104, a: -28, z: 0.12, pose: "open" } };
    case "chin": return gestureHands("chin", lt);
    case "hair": return { R: { x: 292 + Math.sin(lt * 7) * 7, y: 106, a: -24, z: 0.05, pose: "open" } };
    // iconic gestures (the acting director: the hands ACT the word, 2026-11-08)
    case "air": return { L: { x: 40, y: 112, a: -18, z: 0.25, pose: "open" }, R: { x: 340, y: 112, a: 18, z: 0.25, pose: "open" } }; // ارفعه في الهوا
    case "circle": { const w = lt * 9; return { R: { x: 214 + 30 * Math.cos(w), y: 306 + 22 * Math.sin(w), a: -70, z: 0.55, pose: "fist" }, L: { x: 166 + 30 * Math.cos(w + Math.PI), y: 306 + 22 * Math.sin(w + Math.PI), a: 70, z: 0.5, pose: "fist" } }; } // لفه
    case "throw": { const k = Math.max(0, Math.min(1, (lt - 0.2) / 0.12)), e = k * k * (3 - 2 * k); return { R: { x: 342 - 40 * e, y: 150 + 160 * e, a: -30 + 190 * e, z: 0.12 + 0.7 * e, pose: e > 0.5 ? "open" : "fist" } }; } // ارميه: wind up, then out
    case "come": return { R: { x: 300, y: 282, a: -55 + 32 * Math.sin(lt * 12), z: 0.6, pose: "open" } }; // تعالى
    case "small": return { L: { x: 168, y: 302, a: 62, z: 0.55, pose: "open" }, R: { x: 212, y: 302, a: -62, z: 0.55, pose: "open" } }; // حتة صغيرة
    case "stop": return { R: { x: 346, y: 236, a: 0, z: 0.9, pose: "open" } }; // استنى / اسكت
    case "down": return { R: { x: 336, y: 372, a: 172, z: 0.4, pose: "point" } }; // انزل / الأرض: points at the floor
    case "money": return { R: { x: 324, y: 236, a: 8 + 10 * Math.sin(lt * 16), z: 0.5, pose: "thumb" } }; // خصم / سعر: thumb rubbing the fingers
    case "phone": return { R: { x: 318, y: 178, a: 10, z: 0.34, pose: "fist" } }; // ألو: a hand at the ear
    default: return gestureHands(g, lt); // any named gesture (shrug, cross, count, thumb, think, watch...)
  }
};
/** The natural hands at time t for one coin view: rest + the current planned gesture (or an idle move when quiet). */
const naturalHands = (view: Timeline, plan: Plan[], t: number, F: ReturnType<typeof coinPose>["F"], who: string = "mr", cfg?: PresenterConfig): { L: Hand; R: Hand } => {
  const kind = kindFor(who, cfg), seed = seedFor(who, cfg);
  const ph = seed * 2.3; // coins never sway in sync (Mr. 0, Mrs. 2.3, copies their own)
  const human = cfg?.look?.human !== false;
  const directed = !!actingOf(view, cfg?.id ?? who); // the acting director plans this coin's gestures
  // the resting hands drift on seeded noise (each hand its own), not on sines
  let L = human ? { ...REST_L, x: REST_L.x + noise(t, seed + 21, 0.5) * 5, y: REST_L.y + noise(t, seed + 22, 0.45) * 4 }
    : { ...REST_L, x: REST_L.x + Math.sin(t * 1.3 + ph) * 4, y: REST_L.y + Math.sin(t * 1.1 + ph) * 3 };
  let R = human ? { ...REST_R, x: REST_R.x + noise(t, seed + 23, 0.5) * 5, y: REST_R.y + noise(t, seed + 24, 0.45) * 4 }
    : { ...REST_R, x: REST_R.x + Math.sin(t * 1.2 + 1 + ph) * 4, y: REST_R.y + Math.sin(t * 1.05 + 2 + ph) * 3 };
  const mix = (h: Hand, tg: Partial<Hand> | undefined, w: number, side: -1 | 1): Hand => {
    if (!tg || w <= 0) return h;
    const da = normA(tg.a ?? h.a, side) - normA(h.a, side);
    return { x: h.x + ((tg.x ?? h.x) - h.x) * w, y: h.y + ((tg.y ?? h.y) - h.y) * w, a: normA(h.a, side) + da * w, z: h.z + ((tg.z ?? h.z) - h.z) * w,
      pose: w > 0.4 && tg.pose ? tg.pose : h.pose, curl: w > 0.4 && tg.pose ? (tg.pose === "open" ? 0.15 : 1) : h.curl };
  };
  // every gesture still running (the next one starts while the last fades out) is layered in time order, so the
  // new gesture grows from where the hand IS (before: it snapped back to rest for one frame, then started)
  const active = plan.filter((p) => t >= p.t && t < p.t + p.dur + 0.4);
  let gwL = 0, gwR = 0; // how much each hand is in a planned gesture (the director: a gesture beats the mood's hand pose)
  if (active.length) {
    for (const cur of active) {
      const lt = t - cur.t;
      // director: in over the prep (0.3 s, the hand ARRIVES on the stroke), out over 0.5 s; the 2nd hand of a two-hand
      // pose arrives 3 frames later (anti-twinning: the two arms never move as one)
      const wt = (x: number) => (cur.prep ? Math.max(0, Math.min(1, x / cur.prep, (cur.dur + 0.4 - x) / 0.5)) : Math.max(0, Math.min(1, x / 0.22, (cur.dur + 0.4 - x) / 0.4)));
      const ez = (w: number) => (w < 0.5 ? 2 * w * w : 1 - Math.pow(-2 * w + 2, 2) / 2);
      const tg = planTargets(cur.g, cur.prep && cur.g.startsWith("beat") ? lt - cur.prep + 0.175 : lt);
      const lag = cur.prep && tg.L && tg.R ? 0.1 : 0;
      L = mix(L, tg.L, ez(wt(lt - lag)), -1); R = mix(R, tg.R, ez(wt(lt)), 1);
      if (tg.L) gwL = Math.max(gwL, ez(wt(lt - lag))); if (tg.R) gwR = Math.max(gwR, ez(wt(lt)));
    }
  } else {
    // quiet: an idle move every ~3.5 s (2.2 s long), chosen by the clock so it is the same every render.
    // It fades with the distance to the gestures around it (it popped in / out in one frame between two gestures)
    const lastEnd = Math.max(-9, ...plan.filter((p) => p.t + p.dur + 0.4 <= t).map((p) => p.t + p.dur + 0.4));
    const nextStart = Math.min(1e9, ...plan.filter((p) => p.t > t).map((p) => p.t));
    const quiet = Math.max(0, Math.min(1, (t - lastEnd) / 0.4, (nextStart - t) / 0.4));
    const slot = Math.floor(t / 3.5), lt = t - slot * 3.5;
    // Mrs. Coin fixes her ponytail (her quirk); Mr. Coin scratches his head / hand on chin
    // Mrs. fixes her ponytail, Mr. scratches his head; the plain base only has neutral habits
    const idles = kind === "mrs" ? ["rest", "hair", "hipL", "rest", "hips", "hair"] : kind === "mr" ? ["rest", "hipL", "scratch", "rest", "hips", "chin"] : ["rest", "hipL", "rest", "hips", "chin", "rest"];
    const idle = idles[Math.floor(hash(slot + 11 + 26 * seed) * 6)];
    if (idle !== "rest" && lt < 2.2) {
      const w = Math.max(0, Math.min(1, lt / 0.35, (2.2 - lt) / 0.45)) * quiet;
      const tg = planTargets(idle, lt);
      L = mix(L, tg.L, w, -1); R = mix(R, tg.R, w, 1);
    }
  }
  // moods bend the hands (with the director: only the hands that are not in a gesture; the mood owns the rest pose)
  const preL = L, preR = R;
  const angry = F.steam, sad = F.frown * (1 - F.steam), shocked = F.o * Math.max(0, Math.min(1, (F.eyeY - 1) * 4)), love = F.heart,
    nervous = F.sweat * (1 - shocked), sleepy = F.zzz, shy = F.blush * (1 - F.heart), smug = F.smirk * (1 - F.wink);
  const fid = Math.sin(t * 9) * 6;
  L = mix(L, { x: 52, y: 336, a: 200, z: 0.3, pose: "fist" }, angry * 0.9, -1); R = mix(R, { x: 328, y: 336, a: 160, z: 0.3, pose: "fist" }, angry * 0.9, 1);
  L = mix(L, { x: 40, y: 392, a: 186, z: 0.1, pose: "open" }, sad * 0.85, -1); R = mix(R, { x: 340, y: 392, a: 174, z: 0.1, pose: "open" }, sad * 0.85, 1);
  if (kind === "mrs") { // her own shocked (hands at the cheeks) and love (hands together by one cheek): never his twin
    L = mix(L, { x: 112, y: 262, a: 24, z: 0.55, pose: "open" }, shocked, -1); R = mix(R, { x: 268, y: 262, a: -24, z: 0.55, pose: "open" }, shocked, 1);
    L = mix(L, { x: 112, y: 306, a: 64, z: 0.6, pose: "fist" }, love * 0.9, -1); R = mix(R, { x: 146, y: 306, a: -64, z: 0.6, pose: "fist" }, love * 0.9, 1);
  } else {
    L = mix(L, { x: 96, y: 196, a: 20, z: 0.55, pose: "open" }, shocked, -1); R = mix(R, { x: 284, y: 196, a: -20, z: 0.55, pose: "open" }, shocked, 1);
    L = mix(L, { x: 176, y: 300, a: 70, z: 0.6, pose: "fist" }, love * 0.9, -1); R = mix(R, { x: 204, y: 300, a: -70, z: 0.6, pose: "fist" }, love * 0.9, 1);
  }
  L = mix(L, { x: 170 + fid, y: 338, a: 60, z: 0.55, pose: "open" }, nervous * 0.85, -1); R = mix(R, { x: 210 - fid, y: 338, a: -60, z: 0.55, pose: "open" }, nervous * 0.85, 1);
  L = mix(L, { x: 44, y: 400, a: 182, z: 0.08, pose: "open" }, sleepy * 0.9, -1); R = mix(R, { x: 336, y: 400, a: 178, z: 0.08, pose: "open" }, sleepy * 0.9, 1);
  if (kind === "mrs") L = mix(L, { x: 160, y: 304, a: 62, z: 0.55, pose: "open" }, shy * 0.8, -1); // shy: one hand at her mouth
  else { L = mix(L, { x: 168, y: 344, a: 80, z: 0.5, pose: "open" }, shy * 0.8, -1); R = mix(R, { x: 212, y: 344, a: -80, z: 0.5, pose: "open" }, shy * 0.8, 1); }
  const hip = gestureHands("hip", 0);
  L = mix(L, hip.L, smug * 0.8, -1); R = mix(R, hip.R, smug * 0.6, 1);
  if (directed) { L = mix(L, preL, gwL, -1); R = mix(R, preR, gwR, 1); }
  // mocap: the hands of the real person he copies win over all of the above (a {cue} / a move still wins after this)
  const mo = mocapAt(view, cfg?.id ?? who, t);
  if (mo) {
    const mh = (h: typeof mo.L): Partial<Hand> => ({ x: h.x, y: h.y, a: h.a, z: h.z, pose: h.fist > 0.5 ? "fist" : "open" });
    L = mix(L, mh(mo.L), mo.L.w, -1); R = mix(R, mh(mo.R), mo.R.w, 1);
  }
  return { L, R };
};

/** Final palm targets for one frame: natural hands -> walking swing -> gesture cue -> action, each blended by weight. */
const blendHand = (h: Hand, tg: Partial<Hand> | undefined, w: number, side: -1 | 1 = 1): Hand => {
  if (!tg || w <= 0) return h;
  const da = normA(tg.a ?? h.a, side) - normA(h.a, side);
  return {
    x: h.x + ((tg.x ?? h.x) - h.x) * w, y: h.y + ((tg.y ?? h.y) - h.y) * w, a: normA(h.a, side) + da * w, z: h.z + ((tg.z ?? h.z) - h.z) * w,
    pose: w > 0.35 && tg.pose ? tg.pose : h.pose, curl: w > 0.35 && tg.pose ? Math.min(1, (w - 0.35) / 0.4) : h.curl,
  };
};
const composeHands = (view: Timeline, plan: Plan[], t: number, F: ReturnType<typeof coinPose>["F"], who: string, S: RigS, cfg?: PresenterConfig): { L: Hand; R: Hand } => {
  const g = cueAt(view, t, GESTURE_CUES);
  const gt = g ? gestureHands(g.name, g.lt) : null;
  const nat = naturalHands(view, plan, t, F, who, cfg);
  let hL = nat.L, hR = nat.R;
  // walking: arms swing opposite to the legs (blended by walkW so they don't snap when the walk starts / stops)
  if (S.walk !== null && S.walkW > 0) {
    const sw = Math.sin(S.walk) * 26;
    hL = blendHand(hL, { x: 40 + sw, y: 344, a: 190 - sw * 0.6, z: 0.16 }, S.walkW, -1); hR = blendHand(hR, { x: 340 + sw, y: 344, a: 170 - sw * 0.6, z: 0.16 }, S.walkW);
  }
  const hw = ease(Math.max(0, Math.min(1, S.handsW)));
  hL = blendHand(blendHand(hL, gt?.L, g?.w ?? 0, -1), S.hands?.L, hw, -1);
  hR = blendHand(blendHand(hR, gt?.R, g?.w ?? 0), S.hands?.R, hw);
  if (S.holdL) hL = blendHand(hL, S.holdL, S.holdW, -1); // a hand that holds something all video (phonecall / phone) wins over every move
  // tucked limbs (rolling / spinning / tossing): hands pull in to the shoulders
  const tuckHand = (h: Hand, sh: [number, number]): Hand => ({ ...h, x: h.x + (sh[0] - h.x) * S.tuck, y: h.y + (sh[1] - h.y) * S.tuck });
  // overlap (life layer): the hands trail the body; less when they hold something, L and R by different amounts
  const dk = 1 - 0.6 * hw;
  const trail = (h: Hand, k: number): Hand => ({ ...h, x: h.x + S.drag.x * k * dk, y: h.y + S.drag.y * k * dk });
  return { L: trail(tuckHand(hL, SHOULDER_L), 1), R: trail(tuckHand(hR, SHOULDER_R), 0.8) };
};

// ===================================================================================================================
// Body: placement, entrance / exit, flights, and the {action} cues (jump, flip, toss, roll, spin, poof, walk, dance,
// high five). Shared by the 3D rig and the 2D FX layer, so the effects follow the coin.
// ===================================================================================================================
type FxSpot = { name: string; lt: number; x: number; y: number; w?: number };
/** the companion path at time t (interpolated between clip frames, so 60 fps finals stay smooth), + the jump's vertical speed */
const companionAt = (tl: Timeline, t: number) => {
  const list = tl.companions ?? (tl.companion ? [tl.companion] : []);
  // each path only rules the scenes that play its clip
  const c = list.find((q) => q.from === undefined || (t >= q.from && t < (q.to ?? Infinity)));
  if (!c) return null;
  const u = Math.min((t - c.t0) * c.fps, c.frames.length - 1), i = Math.floor(u), k = u - i; // after the clip: holds the last spot
  if (i < 0) return null;
  const A = c.frames[i], B = c.frames[Math.min(i + 1, c.frames.length - 1)];
  const L = (a: number, b: number) => a + (b - a) * k;
  return { x: L(A.x, B.x), y: L(A.y, B.y), s: L(A.s, B.s), vx: L(A.vx, B.vx), vy: L(A.vy, B.vy), air: L(A.air, B.air), airV: (B.air - A.air) * c.fps,
    walk: L(A.walk, B.walk), ww: L(A.ww, B.ww), run: L(A.run, B.run), mode: A.mode };
};
/** scene "ride" (RideCfg in types.ts): how far the tracked part moved from its first sample at t (px, interpolated) */
const rideShift = (tl: Timeline, rc: RideCfg, t: number) => {
  const tr = tl.rides?.[`${rc.track}#${rc.anchor}`];
  if (!tr) return { x: 0, y: 0 };
  const u = Math.max(0, Math.min((t - tr.t0) * tr.fps, tr.x.length - 1)), i = Math.floor(u), k = u - i, j = Math.min(i + 1, tr.x.length - 1);
  return { x: tr.x[i] + (tr.x[j] - tr.x[i]) * k - tr.x[0], y: tr.y[i] + (tr.y[j] - tr.y[i]) * k - tr.y[0] };
};
const rideOf = (tl: Timeline, i: number, who: string) => tl.scenes[i]?.ride?.[who] ?? null;
/** a riding coin at t in scene si: px offset from its place (+ the hop arc) and how far it sits (0 standing beside it .. 1 seated) */
const rideAt = (tl: Timeline, si: number, who: string, t: number) => {
  const rc = rideOf(tl, si, who);
  if (!rc) return null;
  const s = rideShift(tl, rc, t);
  if (rc.on === undefined) return { x: s.x, y: s.y, seat: 1 };
  const t0 = (tl.scenes[si]?.start ?? 0) + rc.on, q = Math.max(0, Math.min(1, (t - t0) / (rc.dur ?? 0.35))), e = q * q * (3 - 2 * q), fr = rc.from ?? [0, 0];
  return { x: fr[0] + (s.x - fr[0]) * e, y: fr[1] + (s.y - fr[1]) * e - (rc.height ?? 60) * Math.sin(Math.PI * q), seat: e };
};
// ===================================================================================================================
// The ball (one per video, tl.ball from scripts/timeline.mjs): legs between coins / spots with fixed times; here they
// become pixels from where the coins really are (their rig at that time: coinNow), in the floor perspective (a ball far away
// is as small as a coin far away). Pass = along the floor, slowing down; shot = fast low arc (to a coin's FACE when it is
// a hit); lob = high arc; rebound / settle = bounces to rest. A pure function of t (motion-check samples it).
// ===================================================================================================================
const BALL_K = 0.3; // ball radius in coin radii
// Where a cast coin really is at t: his rig (slides, walks, runs, flights, "off"), so the ball at his feet goes where he
// goes and a pass leaves from where the kicker actually stands. Cached per coin and time (many samples share a frame).
let aimOff = 0; // > 0 while the ball asks a rig where it is: that rig's gaze is skipped (it may be looking at this ball)
const nowCache = new WeakMap<Timeline, Map<string, { x: number; y: number; r: number; ground: number; feet: number }>>();
const viewCache = new WeakMap<Timeline, Map<string, Timeline>>();
const coinNow = (tl: Timeline, id: string, t: number) => {
  let cache = nowCache.get(tl);
  if (!cache) nowCache.set(tl, (cache = new Map()));
  const key = `${id}|${t.toFixed(4)}`, hit = cache.get(key);
  if (hit) return hit;
  const ms = castOf(tl, tl.presenter as PresenterConfig), m = ms.find((x) => x.who === id) ?? ms[0];
  let views = viewCache.get(tl);
  if (!views) viewCache.set(tl, (views = new Map()));
  let view = views.get(m.who);
  if (!view) views.set(m.who, (view = viewFor(tl, m.who, m.duo, kindFor(m.who, m.c))));
  aimOff++;
  try {
    const S = rigState(tl, view, t, m.who, m.duo, m.c, coinPose(view, t, tl.fps ?? 30, m.c), m.enterAt);
    // on the floor under him; in a flight it rides at his feet (and goes "off" and comes back with him)
    const out = { x: S.px, y: S.py, r: S.r, ground: S.groundY, feet: S.groundY - (S.groundY - (S.py + 1.55 * S.r)) * S.flying };
    if (cache.size > 6000) cache.clear();
    cache.set(key, out);
    return out;
  } finally { aimOff--; }
};
/** a ball location ("red5", "near:mr", a spot name / "x,y,size") -> where its centre sits on the floor + its radius */
const ballSpot = (tl: Timeline, where: string, t: number, face = false) => {
  const B = tl.ball!;
  if (where.startsWith("near:")) { const c = coinNow(tl, where.slice(5), t), side = c.x > 540 ? -1 : 1; const br = BALL_K * c.r; return { x: c.x + side * 1.35 * c.r, y: c.ground + 0.2 * c.r - br, r: br, ground: c.ground + 0.2 * c.r }; }
  const ids = castOf(tl, tl.presenter as PresenterConfig).map((m) => m.who);
  if (ids.includes(where)) {
    const c = coinNow(tl, where, t), br = BALL_K * c.r;
    return face ? { x: c.x, y: c.y - 0.05 * c.r, r: br, ground: c.ground } : { x: c.x + 0.36 * c.r, y: c.feet - br, r: br, ground: c.ground };
  }
  const p = toPlace(B.spots[where] ?? where), br = BALL_K * UNIT * p.s;
  return { x: p.x, y: p.y - br, r: br, ground: p.y };
};
export const ballAt = (tl: Timeline, t: number) => {
  const B = tl.ball;
  if (!B) return null;
  let leg = null as (typeof B.legs)[number] | null, where = B.start;
  for (const l of B.legs) { if (t >= l.t1) where = l.to; else if (t >= l.t0) { leg = l; break; } else break; }
  if (!leg) {
    const p = ballSpot(tl, where, t);
    // keepy-ups: the owner's {juggle} lifts the ball off his foot (low every 0.55 s, when the foot taps it)
    let air = 0;
    for (const sc of tl.scenes) for (const c of sc.cues ?? []) {
      const [a, b] = c.name.includes(":") ? c.name.split(":") : [sc.speaker ?? where, c.name];
      if (b !== "juggle" || a !== where) continue;
      const lt = t - c.t;
      if (lt >= 0 && lt <= ACTION_CUES.juggle) air = Math.max(air, Math.abs(Math.sin((Math.PI * lt) / 0.55)) * 2.4 * p.r * Math.min(1, lt / 0.25, (ACTION_CUES.juggle - lt) / 0.3));
    }
    return { x: p.x, y: p.y - air, r: p.r, ground: p.ground, air, spin: air / p.r };
  }
  const A = ballSpot(tl, leg.from, leg.t0, leg.kind === "rebound"), Z = ballSpot(tl, leg.to, leg.t1, leg.hit);
  if (leg.kind === "rebound") {
    const q = (t - leg.t0) / (leg.t1 - leg.t0), xq = 1 - (1 - q) * (1 - q);
    const x = A.x + (Z.x - A.x) * xq, r = A.r + (Z.r - A.r) * xq;
    let y: number;
    if (q < 0.55) { const u = q / 0.55; y = A.y + (Z.y - A.y) * u * u - 0.9 * A.r * 4 * u * (1 - u); } // off the face, a small hop, down to the floor
    else { const [s0, len, h] = q < 0.83 ? [0.55, 0.28, 1.4] : [0.83, 0.17, 0.5]; const u = (q - s0) / len; y = Z.y - h * Z.r * 4 * u * (1 - u); }
    const ground = A.ground + (Z.ground - A.ground) * xq;
    return { x, y, r, ground, air: Math.max(0, ground - r - y), spin: Math.hypot(Z.x - A.x, Z.y - A.y) * xq / Math.max(4, r) };
  }
  const q = (t - leg.t0) / (leg.t1 - leg.t0), d = Math.hypot(Z.x - A.x, Z.y - A.y);
  let e = q, air = 0;
  if (leg.kind === "pass") e = 1 - (1 - q) * (1 - q);
  else if (leg.kind === "shot") { e = 1 - Math.pow(1 - q, 1.3); air = Math.min(140, 0.14 * d) * Math.sin(Math.PI * q); }
  else if (leg.kind === "lob" || leg.kind === "bounce") air = (0.45 * d + 180) * 4 * q * (1 - q);
  else if (leg.kind === "rebound") {
    // off the face: up and out, then two smaller bounces (0.55 / 0.28 / 0.17 of the time)
    e = 1 - (1 - q) * (1 - q);
    const seg = q < 0.55 ? [0, 0.55, 1.6] : q < 0.83 ? [0.55, 0.28, 0.7] : [0.83, 0.17, 0.25];
    const u = (q - seg[0]) / seg[1];
    air = seg[2] * A.r * 4 * u * (1 - u) * 2.2;
    if (q < 0.55) air += (A.ground - A.r - A.y) * (1 - u); // starts at face height
  } else if (leg.kind === "settle") { const u = q < 0.62 ? q / 0.62 : (q - 0.62) / 0.38, h = q < 0.62 ? 0.9 : 0.35; air = h * A.r * 4 * u * (1 - u) * 2; }
  const r = A.r + (Z.r - A.r) * e;
  const x = A.x + (Z.x - A.x) * e, yb = A.y + (Z.y - A.y) * e, ground = A.ground + (Z.ground - A.ground) * e;
  return { x, y: yb - air, r, ground, air, spin: (d * e) / Math.max(4, r) };
};
// ===================================================================================================================
// A cast's gaze + the scene camera. Only a cast of copies reaches this code (membersOf), so the single coin and the
// duo render exactly as before.
// ===================================================================================================================
/** a cast coin's standing spot in a scene: centre + radius in px, null when it is off stage */
const spotIn = (tl: Timeline, sc: Scene | undefined, id: string) => {
  const ms = castOf(tl, tl.presenter as PresenterConfig), m = ms.find((x) => x.who === id);
  if (!m || !sc) return null;
  const name = placeName(sc, id, ms.length > 1, tl);
  if (name === "off") return null;
  const p = toPlace(name);
  return { x: p.x, y: p.y, r: UNIT * p.s * ((m.c.scale ?? 0.82) / 0.82) };
};
/** the same spot while it moves there from the last scene's (0.8 s, like the flight), so a gaze never jumps */
const spotAt = (tl: Timeline, si: number, id: string, t: number) => {
  const sc = tl.scenes[si], a = spotIn(tl, tl.scenes[si - 1], id), b = spotIn(tl, sc, id);
  if (!a || !b) return b ?? a;
  const k = ease(Math.min(1, Math.max(0, (t - sc.start) / 0.8)));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, r: a.r + (b.r - a.r) * k };
};
/** where scene si's coin is at time t (frame px: disc centre x,y + disc radius r), easing between places like spotAt:
 *  the scene's speaker, else the first coin. null = no coin on stage. Used by layers drawn around him (Edits.tsx) */
export const coinSpot = (tl: Timeline, si: number, t: number) => {
  const sc = tl.scenes[si];
  if (!sc || !tl.presenter || tl.presenter.type === "none") return null;
  const first = castOf(tl, tl.presenter as PresenterConfig)[0]?.who; // a speaker not on stage (the other pool's coin) -> the first coin
  return (sc.speaker ? spotAt(tl, si, sc.speaker, t) : null) ?? (first ? spotAt(tl, si, first, t) : null);
};
// where a coin looks, as keys in time. "front" = the speaker's own 3/4 view (as before), "camera" = straight out.
// Unset listeners react on their own: a delay of 0.1-0.5 s from the seed, then the speaker; in a scene long enough,
// some trade a glance with the nearest neighbour and come back. A coin never looks at itself.
type AimKey = { at: number; tgt: string };
const aimKeys = (tl: Timeline, sc: Scene, who: string, seed: number): AimKey[] => {
  const h = (k: number) => hash(seed * 13.7 + sc.index * 3.1 + k);
  const d = 0.1 + 0.4 * h(1), sp = sc.speaker;
  const ex = sc.gaze?.[who];
  if (ex) {
    const tgt = ex === "speaker" ? (sp && sp !== who ? sp : "front") : ex === who ? "front" : ex;
    return [{ at: sc.start + (who === sp ? 0 : d), tgt }];
  }
  if (!sp || sp === who) return [{ at: sc.start, tgt: "front" }];
  const keys = [{ at: sc.start + d, tgt: sp }];
  const len = sc.end - sc.start;
  if (len > 2 && h(2) < 0.4) {
    const me = spotIn(tl, sc, who);
    let near: string | null = null, best = 1e9;
    if (me) for (const m of castOf(tl, tl.presenter as PresenterConfig)) {
      if (m.who === who || m.who === sp) continue;
      const o = spotIn(tl, sc, m.who);
      if (o && Math.hypot(o.x - me.x, o.y - me.y) < best) { best = Math.hypot(o.x - me.x, o.y - me.y); near = m.who; }
    }
    const g0 = sc.start + d + 0.5 + 0.6 * h(3), g1 = g0 + 0.6 + 0.3 * h(4);
    if (near && g1 < sc.end - 0.35) keys.push({ at: g0, tgt: near }, { at: g1, tgt: sp });
  }
  return keys;
};
/** body turn + pupils toward a target, from where the coin stands now (me) */
type Aim = { yaw: number; gx: number; gy: number };
const aimValue = (tl: Timeline, si: number, tgt: string, t: number, me: { x: number; y: number; r: number }, dart: number): Aim => {
  const front = { yaw: 0.12 * Math.tanh((540 - me.x) / 120), gx: dart, gy: 0 }; // smooth when he runs across the middle
  if (tgt === "front") return front;
  if (tgt === "camera") return { yaw: 0, gx: 0, gy: 0 };
  let p: { x: number; y: number } | null = null;
  if (tgt === "ball") { const b = ballAt(tl, t); p = b ? { x: b.x, y: b.y } : null; }
  else if (/^-?[\d.]+,/.test(tgt)) { const [x, y] = tgt.split(",").map(Number); p = { x, y }; }
  else { const s = spotAt(tl, si, tgt, t); p = s ? { x: s.x, y: s.y - s.r * 0.3 } : null; }
  if (!p) return front;
  const dx = p.x - me.x, dy = p.y - (me.y - me.r * 0.3), cl = (v: number) => Math.max(-1, Math.min(1, v));
  // the body turns a little, the eyes go most of the way
  return { yaw: 0.42 * Math.tanh(dx / 300), gx: cl(dx / 260) * 7, gy: cl(dy / 360) * 7 };
};
/** a cast coin's gaze now: every key blends over the one before, eyes first (0.18 s), the body after (0.5 s) */
const castAim = (tl: Timeline, si: number, who: string, seed: number, t: number, me: { x: number; y: number; r: number }, dart: number): Aim => {
  const first = Math.max(0, si - 2);
  const keys: AimKey[] = first === 0 ? [{ at: -1, tgt: "front" }] : [];
  for (let i = first; i <= si; i++) keys.push(...aimKeys(tl, tl.scenes[i], who, seed));
  let v = aimValue(tl, si, keys[0].tgt, t, me, dart);
  for (let j = 1; j < keys.length; j++) {
    const a = t - keys[j].at;
    if (a <= 0) break;
    const n = aimValue(tl, si, keys[j].tgt, t, me, dart);
    const we = ease(Math.min(1, a / 0.18)), wb = ease(Math.min(1, Math.max(0, a - 0.08) / 0.5));
    v = { yaw: v.yaw + (n.yaw - v.yaw) * wb, gx: v.gx + (n.gx - v.gx) * we, gy: v.gy + (n.gy - v.gy) * we };
  }
  return v;
};

// ---- the scene camera: a crop window over the whole frame (background, footage, coins, ball); text stays on top ----
// Default in a cast: push in on the speaker as he starts talking (x1.3, his face at 42 % of the window height), hold
// still while he talks, reframe between speakers, wide for group moments (a silent scene, others walking in, an all: cue).
type Cam = { s: number; cx: number; cy: number };
const CAM_WIDE: Cam = { s: 1, cx: W / 2, cy: H / 2 };
const camWindow = (c: Cam) => {
  const w = W / c.s, h = H / c.s;
  return { s: c.s, u: Math.max(0, Math.min(W - w, c.cx - w / 2)), v: Math.max(0, Math.min(H - h, c.cy - h / 2)) };
};
const camShot = (tl: Timeline, sc: Scene): { cam: Cam; dur: number } => {
  const spec = sc.camera, o = typeof spec === "object" ? spec : null;
  let on: string = o ? o.on ?? "speaker" : (spec as string | undefined) ?? "speaker";
  if (on === "wide") return { cam: CAM_WIDE, dur: o?.dur ?? 0.6 };
  if (spec === undefined && (!sc.words.length || (sc.cues ?? []).some((c) => /^(all|both):/.test(c.name) || (c.name.endsWith(":walkIn") && !c.name.startsWith(`${sc.speaker}:`)))))
    return { cam: CAM_WIDE, dur: 0.6 };
  if (on === "speaker") on = sc.speaker ?? "";
  const me = spotIn(tl, sc, on);
  if (!me) return { cam: CAM_WIDE, dur: 0.6 };
  const others = castOf(tl, tl.presenter as PresenterConfig).filter((m) => m.who !== on).map((m) => spotIn(tl, sc, m.who)).filter(Boolean) as { x: number; y: number; r: number }[];
  const s0 = o?.zoom ?? 1.38;
  // never slice a head at the frame edge: each other coin's head is fully in or fully out; else shift, then zoom less.
  // When no zoom can do that (coins at both bottom corners), the cleanest frame wins: a head may only leave a sliver
  // (<= 25 % of it) at the edge, like a foreground player passing by. Nothing clean enough = stay wide.
  let best: { cam: Cam; pen: number } | null = null;
  for (let s = s0; s >= 1.08; s -= 0.04) {
    const w = W / s, h = H / s, ideal = camWindow({ s, cx: me.x, cy: me.y - me.r * 0.3 + (0.5 - 0.42) * h }), v = ideal.v;
    // every left edge the frame allows, nearest to the ideal first (8 px steps)
    const us: number[] = [];
    for (let u = 0; u <= W - w; u += 8) us.push(u);
    us.push(W - w);
    us.sort((a, b) => Math.abs(a - ideal.u) - Math.abs(b - ideal.u));
    for (const u of us) {
      const inside = (x0: number, x1: number, y0: number, y1: number) => x0 >= u && x1 <= u + w && y0 >= v && y1 <= v + h;
      const outside = (x0: number, x1: number, y0: number, y1: number) => x1 <= u || x0 >= u + w || y1 <= v || y0 >= v + h;
      if (!inside(me.x - 1.35 * me.r, me.x + 1.35 * me.r, me.y - 1.2 * me.r, me.y + 1.65 * me.r)) continue;
      // the head (the coin disc + its sway and edge when turned); a glove may be cut. pen = the visible share of a sliced head
      let pen = 0;
      for (const q of others) {
        const b = [q.x - 1.18 * q.r, q.x + 1.18 * q.r, q.y - 1.2 * q.r, q.y + 0.9 * q.r] as const;
        if (inside(...b) || outside(...b)) continue;
        const f = ((Math.min(b[1], u + w) - Math.max(b[0], u)) * (Math.min(b[3], v + h) - Math.max(b[2], v))) / ((b[1] - b[0]) * (b[3] - b[2]));
        pen = Math.max(pen, f <= 0.25 ? f : Infinity);
      }
      const cam = { s, cx: u + w / 2, cy: v + h / 2 };
      if (pen === 0) return { cam, dur: o?.dur ?? 0.65 };
      if (s >= 1.15 && pen < (best?.pen ?? Infinity)) best = { cam, pen };
    }
  }
  return best ? { cam: best.cam, dur: o?.dur ?? 0.65 } : { cam: CAM_WIDE, dur: 0.6 }; // nothing clean enough: stay wide
};
const easeCam = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // no overshoot, no wobble
/** the camera at time t: { s, u, v } (the window's zoom and top-left in frame px), or null = no camera (not a cast) */
export const cameraAt = (tl: Timeline, t: number) => {
  if (!membersOf(tl)) return null;
  let from = CAM_WIDE, to = CAM_WIDE, t0 = -1, dur = 1;
  const at = (tt: number): Cam => {
    const k = easeCam(Math.min(1, Math.max(0, (tt - t0) / dur)));
    return { s: from.s + (to.s - from.s) * k, cx: from.cx + (to.cx - from.cx) * k, cy: from.cy + (to.cy - from.cy) * k };
  };
  for (const sc of tl.scenes) {
    const { cam, dur: d } = camShot(tl, sc);
    // a push in from wide waits for his first word; a reframe or going wide starts with the scene; "seam": "cut" = a cut
    const ts = cam.s > 1 && to.s === 1 ? Math.max(sc.start, (sc.words[0]?.start ?? sc.start) - 0.1) : sc.start;
    if (ts > t) break;
    const cut = sc.seam === "cut" && sc.index > 0;
    from = cut ? cam : at(ts); to = cam; t0 = ts; dur = cut ? 1e-6 : d;
  }
  return camWindow(at(t));
};

const ballTexture = () => {
  // white leather with black pentagons at the 12 icosahedron corners (equirectangular, wraps the sphere)
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#F7F7F2"; g.fillRect(0, 0, 512, 256);
  const f = (1 + Math.sqrt(5)) / 2;
  const vs = [[0, 1, f], [0, 1, -f], [0, -1, f], [0, -1, -f], [1, f, 0], [1, -f, 0], [-1, f, 0], [-1, -f, 0], [f, 0, 1], [f, 0, -1], [-f, 0, 1], [-f, 0, -1]];
  g.fillStyle = "#16171B";
  for (const [x, y, z] of vs) {
    const n = Math.hypot(x, y, z), lat = Math.asin(y / n), lon = Math.atan2(z, x);
    const cx = ((lon + Math.PI) / (2 * Math.PI)) * 512, cy = (0.5 - lat / Math.PI) * 256;
    g.beginPath();
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; g.lineTo(cx + (Math.cos(a) * 30) / Math.max(0.35, Math.cos(lat)), cy + Math.sin(a) * 28); }
    g.closePath(); g.fill();
    if (cx < 60) { g.save(); g.translate(512, 0); g.fill(); g.restore(); } // wrap at the seam
    if (cx > 452) { g.save(); g.translate(-512, 0); g.fill(); g.restore(); }
  }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
};
const BallMesh: React.FC<{ x: number; y: number; r: number; spin: number; ramp: THREE.Texture }> = ({ x, y, r, spin, ramp }) => {
  const tex = useMemo(ballTexture, []);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 28, 20), []);
  const k = r / UNIT;
  return (
    <group position={[(x - W / 2) / UNIT, -(y - H / 2) / UNIT, 0.9]} scale={k}>
      <group rotation={[spin * 0.6, 0, -spin]}>
        <mesh geometry={geo}><meshToonMaterial map={tex} gradientMap={ramp} /></mesh>
      </group>
      <mesh geometry={geo} scale={1.09}><meshBasicMaterial color="#0E0F12" side={THREE.BackSide} /></mesh>
    </group>
  );
};
type Hand0 = { x: number; y: number; a: number; z: number };
/** {faceplant} arms in the air: windmilling over the head, the two arms out of step (no twinning) */
const faceplantFlail = (lt: number): { L: Hand0 & { pose: HandPose }; R: Hand0 & { pose: HandPose } } => {
  const fl = (k: number) => Math.sin(lt * 15 + k);
  return { L: { x: 20 + 26 * fl(0), y: 70 + 30 * fl(1.3), a: -30 + 28 * fl(0.4), z: 0.3, pose: "open" }, R: { x: 360 - 26 * fl(2.1), y: 70 + 30 * fl(3.4), a: 30 - 28 * fl(2.6), z: 0.3, pose: "open" } };
};
const rigState = (full: Timeline, view: Timeline, t: number, who: string, duo: boolean, cfg: PresenterConfig, P: ReturnType<typeof coinPose>, enterAt: number) => {
  const D = full.durationSec;
  // look.weight (default since the owner picked it in a blind A/B, 2026-11-11; "look": {"weight": false} = the old movement): the body shows weight when he travels: wide steps with a real up / down, a
  // readable sit, a hop that crouches first, landings the legs absorb, a deeper squat, a walk that follows his mood.
  // The coin stays rigid: the legs and the tilt of the whole disc do the work (research: Williams, Lasseter, LEGO films).
  const W2 = cfg.look?.weight !== false;
  const te = t - enterAt;
  const drop = duo && legacyOf(cfg) && who === "mr" && cfg.entrance !== "none"; // the duo's Mr. Coin drops in from above
  const kind = kindFor(who, cfg), seed = seedFor(who, cfg);
  const inDur = drop ? 0.7 : 0.9;
  // "entrance": "none" (cast): already standing in his place at frame 0, facing the camera (no fly-in from the depth)
  const still = cfg.entrance === "none";
  const eIn = still ? 1 : 1 - Math.pow(1 - Math.min(1, Math.max(0, te) / inDur), 3);
  const land = !still && te > inDur && te < inDur + 0.35 ? Math.sin(((te - inDur) / 0.35) * Math.PI) : 0;
  const left = D - t;
  const eOut = cfg.exit !== false && left < 0.7 ? Math.pow(1 - Math.max(0, left) / 0.7, 2) : 0;
  const z0 = (drop ? 0 : -18 * (1 - eIn)) - 18 * eOut;
  const dropY = drop ? 9 * Math.pow(1 - Math.min(1, Math.max(0, te) / inDur), 2) : 0;
  const spin = (drop ? 0 : (1 - eIn) * Math.PI * 3) + eOut * Math.PI * 2;

  let act = cueAt(view, t, ACTION_CUES, 0.01, 0.01);
  let si = 0;
  full.scenes.forEach((sc, i) => { if (t >= sc.start) si = i; });
  const scNow = full.scenes[si];
  const stateOf = (i: number) => (view.scenes[i]?.cues ?? []).find((c) => STATE_PLACE[c.name])?.name;
  const placeOf = (i: number) => {
    const sc = full.scenes[i];
    const st = stateOf(i);
    return st && !(sc?.place && (typeof sc.place === "string" || sc.place[who])) ? STATE_PLACE[st] : placeName(sc, who, duo, full);
  };
  // before a walkIn / push the coin waits at the start of the move (off-frame for walkIn): a cue near the scene start,
  // or a later walkIn by a cast coin that was "off" in the previous scene (he must not stand there before he arrives)
  if (!act) view.scenes.forEach((sc, i) => { for (const c of sc.cues ?? [])
    if ((c.name === "walkIn" || c.name === "flyIn" || c.name === "push") && t >= sc.start - 0.001 && t < c.t && (c.t - sc.start < 0.3 || ((c.name === "walkIn" || c.name === "flyIn") && !legacyOf(cfg) && i > 0 && placeOf(i - 1) === "off"))) act = { name: c.name, lt: 0, dur: c.name === "push" ? sc.end - c.t : ACTION_CUES[c.name], p: 0, w: 0 }; });
  const to = toPlace(placeOf(si));
  // a cast coin that walks in from "off" starts at his new place (the walk brings him in from the side), never from the top
  const walksIn = !legacyOf(cfg) && (view.scenes[si]?.cues ?? []).some((c) => c.name === "walkIn" || c.name === "flyIn");
  // a cast coin back from "off" without a walk is a cut back to him: already standing in his place (no fall from the top)
  // a hard cut to another camera (scene "seam": "cut" / script "seam": false, and the footage changes) is a cut for the
  // cast too: everyone is already standing in his new place, nobody flies across the new shot
  const camCut = !legacyOf(cfg) && si > 0 && (scNow?.seam === "cut" || full.seam === false) && !!scNow?.footage?.src && scNow.footage.src !== full.scenes[si - 1]?.footage?.src;
  const from = (!legacyOf(cfg) || !!scNow?.behind) && (camCut || placeOf(si > 0 ? si - 1 : si) === "off") ? to : toPlace(placeOf(si > 0 ? si - 1 : si));
  // a cast coin whose place becomes "off" at a hard cut (scene "seam": "cut" / script "seam": false) is gone with the cut,
  // like the camera turning away (he flew up out of the frame before); the mirror of the cut back to him above
  const goneOff = !legacyOf(cfg) && si > 0 && placeOf(si) === "off" && placeOf(si - 1) !== "off" && (scNow?.seam === "cut" || full.seam === false);
  const flyCfg = typeof scNow?.fly === "object" ? scNow.fly : null;
  const mk = ease(Math.min(1, (t - (scNow?.start ?? 0)) / (flyCfg?.dur ?? 0.8)));
  const far = (Math.hypot(to.x - from.x, to.y - from.y) > 150 || Math.abs(to.s - from.s) > 0.4) && !(act?.name === "push");
  // {faceplant}: falls straight into the new place from the sky, no flight; hidden until the fall starts
  const fall = (view.scenes[si]?.cues ?? []).find((c) => c.name === "faceplant" || c.name === "crash");
  const waitFall = !!fall && t < fall.t;
  const pin = act?.name === "faceplant" || act?.name === "crash" || waitFall;
  // companion (scripts/companion.mjs): in a handheld clip his feet, size, steps and speed come from the planned path
  const comp = companionAt(full, t);
  const flyOn = far && scNow?.fly !== false && si > 0 && !pin && !comp;
  const flying = flyOn ? Math.sin(mk * Math.PI) : 0;
  const size = comp ? comp.s * ((cfg.scale ?? 0.82) / 0.82) : (pin ? to.s : from.s + (to.s - from.s) * mk) * ((cfg.scale ?? 0.82) / 0.82);
  // scene "ride": the place moves with a tracked part of the footage (a carriage), after an optional hop on (rideAt)
  const ride = comp ? null : rideAt(full, si, who, t);
  const px0 = (comp ? comp.x : pin ? to.x : from.x + (to.x - from.x) * mk) + (ride?.x ?? 0);
  const py0 = (comp ? comp.y - UNIT * size * 1.55 - comp.air : pin ? to.y : from.y + (to.y - from.y) * mk - (flyCfg?.arc ?? 160) * flying) + (ride?.y ?? 0);
  // scene "turn": degrees (+ = turns to the screen's right, 180 = back to the camera) so he can face a real person; default: 3/4 view alternating per scene
  const sideOf = (i: number) => {
    const tn = full.scenes[i]?.turn;
    if (typeof tn === "number") return (tn * Math.PI) / 180;
    const lt = lookTarget(full.scenes[i]); // turns his body toward the person he talks to
    if (lt) { const dx = lt.x - toPlace(placeOf(i)).x; return Math.sign(dx) * Math.min(0.7, 0.15 + (Math.abs(dx) / 500) * 0.8); }
    return (i % 2 === 0 ? 1 : -1) * 0.36;
  };
  const sk = ease(Math.min(1, (t - (scNow?.start ?? 0)) / 0.7));
  const duoYaw = (sc: Scene | undefined) => (sc?.speaker === who ? 0.12 : 0.62) * (who === "mr" ? 1 : -1);
  // a cast of copies: the speaker turns a little toward the middle, everyone else turns to look at the speaker
  const castYaw = (sc: Scene | undefined) => {
    if (typeof sc?.turn === "number") return (sc.turn * Math.PI) / 180; // scene "turn" wins (he looks back over his shoulder for one line)
    if (typeof cfg.turn === "number") return (cfg.turn * Math.PI) / 180;
    const me = toPlace(placeName(sc, who, duo, full)).x;
    if (!sc?.speaker || sc.speaker === who) return 0.12 * Math.sign(540 - me);
    const sp = toPlace(placeName(sc, sc.speaker, duo, full)).x;
    return 0.55 * Math.sign(sp - me);
  };
  // a cast coin's own gaze (scene "look" / its own reaction), unless the script fixed its turn
  const aim = !aimOff && !legacyOf(cfg) && typeof cfg.turn !== "number" && typeof scNow?.turn !== "number" ? castAim(full, si, who, seed, t, { x: px0, y: py0, r: UNIT * size }, P.dart) : null;
  const capYaw = (sc: Scene | undefined) => {
    const y = castYaw(sc);
    return W2 && sc && (sc.speaker ?? who) === who && (sc.words?.length ?? 0) > 0 && Math.abs(y) > 0.7 && Math.abs(y) < 1.6 ? Math.sign(y) * 0.7 : y;
  };
  const baseYaw = aim ? aim.yaw : !legacyOf(cfg)
    ? capYaw(full.scenes[si - 1] ?? scNow) + (capYaw(scNow) - capYaw(full.scenes[si - 1] ?? scNow)) * ease(Math.min(1, (t - (scNow?.start ?? 0)) / 0.5))
    : duo
    ? duoYaw(full.scenes[si - 1] ?? scNow) + (duoYaw(scNow) - duoYaw(full.scenes[si - 1] ?? scNow)) * ease(Math.min(1, (t - (scNow?.start ?? 0)) / 0.5))
    : sideOf(Math.max(0, si - 1)) + (sideOf(si) - sideOf(Math.max(0, si - 1))) * sk;

  // ---- {action} cues ----
  let dx = 0, dy = 0, rx = 0, ry = 0, rz = 0, asx = 1, asy = 1, vis = 1, tuck = 0, walk: number | null = null;
  let hands: HandTargets | null = null, handsW = 0, hf = 0;
  let crouch = 0, knee = 0, lift = 1, spread = 0, sit = 0, walkW = 1;
  let splash = 0; // {splash}: 0..1, the dangling feet kick fast (read in the seated legs)
  let stride = 1, sitWide = 0; // look.weight: how far the feet reach in a step / how far the knees open when he sits
  // look.weight: a walk in his current mood. The body is highest at the passing position and lowest at contact
  // (Williams: "the up and down is the key" to weight), the whole disc rocks over the planted foot. run = 1 for a jog.
  const gait = (ph: number, run: number) => {
    const m = P.curMood as string;
    const tired = ["sad", "cry", "sleepy", "bored", "disgusted", "annoyed"].includes(m), up = ["happy", "laugh", "excited", "love", "starry", "proud"].includes(m), hard = ["angry", "determined"].includes(m);
    const c = Math.abs(Math.cos(ph));
    const amp = (tired ? 0.1 : up ? 0.3 : hard ? 0.16 : 0.22) + 0.06 * run;
    return {
      dy: amp * (up ? 0.6 * c + 0.4 * Math.abs(Math.cos(2 * ph)) : c), // happy = a double bounce in every step
      rz: Math.sin(ph) * (tired ? 0.05 : hard ? 0.13 : 0.1),
      rx: (tired ? 0.14 : hard ? 0.2 : 0.05) + 0.12 * run,              // tired slumps, angry leans in, a jog leans forward
      crouch: tired ? 0.07 : 0,
    };
  };
  let peekClip: { edge: number; top: number; bottom: number } | null = null;
  let prop: { hands: ("L" | "R")[]; kind: Prop; axis?: [number, number, number] } | null = null;
  // leg poses (yoga etc.): knee + foot targets per leg, in the legs' space (ground = 0, hips at ~0.62), blended by legW
  type V3 = [number, number, number];
  let legs: Partial<Record<"L" | "R", { k: V3; f: V3 }>> | null = null, legW = 0;
  let glance: { x: number; y: number } | null = null; // the eyes' target when a move / the next flight asks for it
  const eye0 = aim ? { x: aim.gx, y: aim.gy } : { x: P.dart, y: 0 }; // where the eyes are when no move asks (a cast coin: its gaze)
  const fx: FxSpot[] = [];
  const r = UNIT * size;
  if (act) {
    const { name, p, lt } = act;
    const squash = (q: number, k: number) => { const s = Math.sin(q * Math.PI); asx = 1 + 0.13 * s * k; asy = 1 - 0.17 * s * k; };
    switch (name) {
      case "take": { // the cartoon take before a punchline: down (anticipation), a pop up, then the settle = the pose you read
        const a = 0.17, wOut = Math.min(1, (act.dur - lt) / 0.3);
        if (lt < a) { const q = 0.5 - 0.5 * Math.cos((lt / a) * Math.PI); crouch = 0.12 * q; asy = 1 - 0.1 * q; asx = 1 + 0.07 * q; glance = { x: eye0.x * (1 - q), y: eye0.y * (1 - q) + 7 * q }; }
        else {
          const u = lt - a, rel = 0.5 + 0.5 * Math.cos(Math.min(1, u / 0.12) * Math.PI), ring = Math.exp(-u * 6) * Math.cos(u * 14) * (1 - rel);
          crouch = 0.12 * rel; dy = (0.07 + 0.16 * Math.exp(-u * 5)) * (1 - rel) * wOut;
          asy = 1 - 0.1 * rel + 0.13 * ring; asx = 1 + 0.07 * rel - 0.08 * ring;
          glance = { x: eye0.x, y: eye0.y + 7 * rel - 3 * Math.exp(-u * 3) * (1 - rel) };
        }
        break;
      }
      case "doubletake": { // looks away, then snaps back to the camera: he just understood what he saw
        const side = Math.sign(baseYaw) || (px0 > W / 2 ? -1 : 1);
        const away = ease(Math.min(1, lt / 0.3)), back = ease(Math.min(1, Math.max(0, (lt - 0.6) / 0.12)));
        ry = side * 0.9 * away * (1 - back); rz = -side * 0.07 * away * (1 - back);
        glance = { x: eye0.x + (side * 7 - eye0.x) * away * (1 - back), y: eye0.y };
        if (lt > 0.6) { const u = lt - 0.6, on = Math.min(1, u / 0.1), ring = Math.exp(-u * 6) * Math.cos(u * 14) * on, wOut = Math.min(1, (act.dur - lt) / 0.3); asy = 1 + 0.1 * ring; asx = 1 - 0.06 * ring; dy = 0.1 * Math.exp(-u * 5) * on * wOut; }
        break;
      }
      case "hop":
        if (W2) { // crouches first, goes higher, and the legs take the landing
          const a0 = 0.2, a1 = 0.8;
          if (p < a0) { const q = 0.5 - 0.5 * Math.cos((p / a0) * Math.PI); crouch = 0.13 * q; asy = 1 - 0.06 * q; asx = 1 + 0.045 * q; }
          else if (p < a1) { const q = (p - a0) / (a1 - a0), up = 0.5 - 0.5 * Math.cos(2 * Math.PI * q) /* a smooth rise and fall: calm, no kick at take-off */, off = 0.5 + 0.5 * Math.cos(Math.min(1, q / 0.45) * Math.PI), on = 0.5 - 0.5 * Math.cos(Math.max(0, (q - 0.6) / 0.4) * Math.PI); dy = up * 0.56; crouch = 0.13 * off; asy = 1 - 0.06 * off + 0.05 * up - 0.03 * on; asx = 1 + 0.045 * off - 0.035 * up + 0.025 * on; }
          else { const q = (p - a1) / (1 - a1), k = 0.5 - 0.5 * Math.cos(q * 2 * Math.PI); crouch = 0.06 * k; asy = 1 - 0.03 * (1 - q) - 0.03 * k; asx = 1 + 0.025 * (1 - q) + 0.025 * k; }
        } else dy = Math.sin(Math.PI * p) * 0.4;
        break;
      case "jump": case "flip": {
        if (p < 0.16) squash(p / 0.32, 1);
        else if (p < 0.84) {
          const q = (p - 0.16) / 0.68;
          dy = Math.sin(Math.PI * q) * 1.7; asy = 1 + 0.1 * (1 - q); asx = 1 - 0.06 * (1 - q);
          if (name === "flip") { rx = -Math.PI * 2 * ease(q); tuck = Math.sin(Math.PI * q) * 0.7; }
        } else { squash((p - 0.84) / 0.16, 0.35); if (p < 0.9) fx.push({ name: "impact", lt: (p - 0.84) * act.dur, x: px0, y: py0 + r * 1.55 }); }
        break;
      }
      case "faceplant": { // drops from above the frame, lands face down tilted into the floor, lies there, gets up
        const tf = 0.45, up = act.dur - 0.6, sky = (py0 + 260) / (UNIT * Math.min(size, 1));
        if (lt < tf) {
          const q = lt / tf; dy = sky * (1 - q * q) - 1.1 * q * q; rx = 0.3 + 1.8 * q; rz = 0.18 * Math.sin(q * 8) * (1 - q); tuck = 0.15 * q;
          // panic in the air: both arms windmill up over the head, out of step with each other
          hands = faceplantFlail(lt);
          handsW = Math.min(1, lt / 0.2);
        }
        else if (lt < up) {
          const b = lt - tf;
          dy = -1.1 + (b < 0.25 ? 0.22 * Math.sin((b / 0.25) * Math.PI) : 0); rx = 2.1; tuck = 0.15;
          if (b > 1.2) rz = 0.05 * Math.sin(b * 8) * Math.max(0, 1 - (b - 1.2) / 0.5); // a little twitch
          // the hands land a few frames after the body (overlap), splayed flat on the floor, then go limp
          const slap = ease(Math.min(1, b / 0.22)), f0 = faceplantFlail(tf);
          const to2 = (h: Hand0, x: number, y: number, a: number) => ({ x: h.x + (x - h.x) * slap, y: h.y + (y - h.y) * slap, a: h.a + (a - h.a) * slap, z: h.z + (0.65 - h.z) * slap, pose: "open" as HandPose });
          hands = { L: to2(f0.L, -36, 236, -90), R: to2(f0.R, 416, 236, 90) };
          handsW = Math.max(0, 1 - Math.max(0, b - 0.9) / 0.4);
          if (b < 0.1) squash(b / 0.2, 0.6);
          if (b < 0.5) fx.push({ name: "impact", lt: b, x: px0, y: py0 + r * 1.2 });
          if (b < 0.6) fx.push({ name: "puff", lt: b, x: px0, y: py0 + r * 1.3 });
        } else { const q = ease((lt - up) / 0.6); dy = -1.1 * (1 - q) + 0.3 * Math.sin(q * Math.PI); rx = 2.1 * (1 - q); tuck = 0.15 * (1 - q); }
        break;
      }
      case "toss": {
        if (p < 0.1) squash(p / 0.2, 1);
        else if (p < 0.9) { const q = (p - 0.1) / 0.8; dy = Math.sin(Math.PI * q) * 2.6; rx = -Math.PI * 4 * q; tuck = Math.min(1, Math.sin(Math.PI * q) * 2.5); }
        else { squash((p - 0.9) / 0.1, 0.4); fx.push({ name: "impact", lt: (p - 0.9) * act.dur, x: px0, y: py0 + r * 1.55 }); }
        break;
      }
      case "roll": {
        const dir = px0 > 540 ? -1 : 1;
        const d = 1.6 * Math.sin(Math.PI * p) * dir;
        dx = d; rz = -d; tuck = Math.min(1, Math.sin(Math.PI * p) * 3); ry = -baseYaw * Math.min(1, Math.sin(Math.PI * p) * 3);
        break;
      }
      case "spin": {
        tuck = p < 0.85 ? Math.min(1, p * 6) : (1 - p) / 0.15;
        ry = 10 * Math.PI * (1 - Math.pow(1 - Math.min(1, p / 0.85), 2.2));
        rx = 0.5 * Math.pow(Math.min(1, p / 0.85), 1.6) * Math.sin(ry * 0.5);
        if (p > 0.85) dy = Math.sin(((p - 0.85) / 0.15) * Math.PI) * 0.3;
        break;
      }
      case "poof": {
        vis = p < 0.2 ? 1 - p / 0.2 : p < 0.55 ? 0 : Math.min(1, (p - 0.55) / 0.25) * (1 + 0.12 * Math.sin(((p - 0.55) / 0.45) * Math.PI));
        if (p < 0.45) fx.push({ name: "puff", lt: lt, x: px0, y: py0 + r * 0.2 });
        break;
      }
      case "walkIn": case "walkOut": {
        const side = px0 >= 540 ? 1 : -1;
        // constant pace (no ease) so the steps match the ground: one step per 0.34 units travelled
        const glide = (q: number) => (q - Math.max(0, q - 0.75) ** 2 / 0.5) / 0.875; // linear, then eases to a stop (0..1)
        const k = name === "walkIn" ? 1 - glide(Math.min(1, p / 0.88)) : 1 - glide(Math.min(1, Math.max(0, 1 - (p - 0.12) / 0.88)));
        // a cast coin walks from fully off-frame at the nearest side (a small coin far away would still be in the picture)
        const far = legacyOf(cfg) ? 4.2 : Math.max(4.2, ((side > 0 ? W - px0 : px0) + 1.5 * r) / (UNIT * Math.min(size, 1)));
        dx = side * far * k; walk = (far * (1 - k)) / (W2 ? 0.95 : 0.34) * Math.PI;
        // steps ease out on arrival / ease in on leaving (they stopped dead in one frame)
        walkW = name === "walkIn" ? Math.max(0, Math.min(1, (0.97 - p) / 0.12)) : Math.max(0, Math.min(1, (p - 0.03) / 0.12));
        const turn = name === "walkIn" ? 1 - ease(Math.max(0, (p - 0.8) / 0.2)) : ease(Math.min(1, p / 0.15));
        const facing = name === "walkIn" ? -side : side; // 3/4 toward where it walks, back to the camera when arrived
        ry = (facing * 0.75 - baseYaw * 0.4) * turn;
        if (W2) { const g = gait(walk, 0), gw = walkW * (name === "walkOut" ? Math.min(1, (1 - p) / 0.1) : 1); stride = 1.55; dy = g.dy * gw; rz = g.rz * gw; rx = g.rx * gw; crouch = g.crouch * gw; }
        else { dy = Math.abs(Math.sin(walk)) * (kind === "mrs" ? 0.11 : 0.09) * walkW; rz = Math.sin(walk) * (kind === "mrs" ? 0.1 : 0.05) * walkW; }
        break;
      }
      case "flyIn": {
        const side = px0 >= 540 ? 1 : -1;
        const k = 1 - ease(Math.min(1, p / 0.85));
        const far = Math.max(4.5, ((side > 0 ? W - px0 : px0) + 1.8 * r) / (UNIT * Math.min(size, 1)));
        dx = side * far * k;
        dy = -3.8 * k + Math.sin(Math.PI * Math.min(1, p / 0.85)) * 0.45;
        rz = side * 0.28 * k;
        const land = p > 0.8 ? Math.sin(((p - 0.8) / 0.2) * Math.PI) : 0;
        crouch = land * 0.22;
        dy -= land * 0.08;
        hands = { L: { x: 25, y: 150, a: 115, z: 0.1, pose: "open" }, R: { x: 355, y: 150, a: 245, z: 0.1, pose: "open" } };
        handsW = Math.max(0, Math.min(1, (0.85 - p) / 0.15));
        break;
      }
      case "dance": {
        const dw = Math.max(0, Math.min(1, lt / 0.2, (act.dur - lt) / 0.25));
        rz = Math.sin(lt * 7) * 0.16 * dw; dy = Math.abs(Math.sin(lt * 7)) * 0.18 * dw; ry = Math.sin(lt * 3.5) * 0.35 * dw;
        const u = 0.5 + 0.5 * Math.max(-1, Math.min(1, Math.sin(lt * 7) * 2.2)); // 1 = left hand up (a quick swing, then a hold)
        hands = { L: { x: 60 - 20 * u, y: 300 - 190 * u, a: 160 + 180 * u, z: 0.25, pose: "open" }, R: { x: 320 + 20 * (1 - u), y: 300 - 190 * (1 - u), a: 200 - 180 * (1 - u), z: 0.25, pose: "open" } };
        handsW = Math.min(1, lt / 0.2, (act.dur - lt) / 0.25);
        break;
      }
      // ---------------- card interactions (batch 3) ----------------
      case "lean": { // leans on the card's bottom corner, elbow / hand on its edge
        const w = Math.min(1, lt / 0.35, (act.dur - lt) / 0.3);
        rz = 0.2 * w; dy = -0.02 * w;
        hands = { L: { x: -34, y: 196, a: -112, z: 0.22, pose: "open" } }; handsW = w;
        break;
      }
      case "push": { // pushes the card in from the right (the Reel slides the card with him), then leans on it
        const k = 1 - ease(Math.min(1, lt / 1.0)), out = Math.max(0, Math.min(1, (act.dur - lt) / 0.3));
        dx = (k * 1150) / UNIT / Math.min(size, 1); walk = (1 - k) * 9; walkW = Math.min(1, k / 0.15);
        rz = 0.22 * Math.min(1, lt / 0.2) * out; ry = -0.5 * k;
        // both hands on the card while pushing; then the right one rests on it too (it vanished in one frame before)
        hands = { L: { x: -40, y: 236, a: -100, z: 0.25, pose: "open" }, R: { x: 120, y: 250, a: -95, z: 0.55, pose: "open" } };
        handsW = out;
        break;
      }
      case "sit": { // sits on the card's top edge, legs dangling over the front, hands resting on the edge
        sit = Math.max(0, Math.min(1, lt / 0.3, (act.dur - lt) / 0.3));
        hands = { L: { x: 40, y: 340, a: 185, z: 0.3, pose: "open" }, R: { x: 340, y: 340, a: 175, z: 0.3, pose: "open" } }; handsW = sit;
        break;
      }
      case "peek": {
        // 1) sneaks back behind the card's right edge (tiptoe steps), 2) both hands grab the edge, 3) half the head
        // leans out and looks. The stage hides the part of the coin that is behind the card (clip), not the hands.
        const edge = scNow?.peekEdge ?? 965; // scene "peekEdge": a logo's edge instead of a card's
        const back = ease(Math.min(1, lt / 0.7)), out = Math.max(0, Math.min(1, (act.dur - lt) / 0.3));
        const cx = px0 + (edge + r * 0.1 - px0) * back; // from where it landed to the middle of the coin on the edge
        dx = ((cx - px0) / UNIT / Math.min(size, 1)) * out;
        walk = lt * 9; walkW = Math.min(1, (1 - back) / 0.15, lt / 0.15); // eased in (it snapped the arms to the walk in one frame)
        const grab = ease(Math.min(1, Math.max(0, (lt - 0.55) / 0.35)));
        const look = ease(Math.min(1, Math.max(0, (lt - 0.8) / 0.4)));
        rz = -0.2 * look * out; dy = Math.sin(lt * 2.6) * 0.02 * look * out; ry = 0.15 * (1 - back);
        // hands: just outside the card's edge, fingers pointing at the card (they curl around it, behind it)
        const hx = 190 + ((edge - cx) / r) * 130 + 22;
        hands = { L: { x: hx, y: 150, a: -84, z: 0.3, pose: "fist" }, R: { x: hx + 6, y: 286, a: -96, z: 0.32, pose: "fist" } };
        handsW = grab * out;
        peekClip = { edge, top: 540, bottom: 1250 };
        break;
      }
      case "sign": { // holds a sign up over his head (the text = scene "sign")
        hands = { L: { x: 100, y: 70, a: 0, z: 0.46, pose: "fist" }, R: { x: 280, y: 70, a: 0, z: 0.46, pose: "fist" } };
        handsW = Math.max(0, Math.min(1, lt / 0.3, (act.dur - lt) / 0.3));
        break;
      }
      // ---------------- gym moves (batch 2) ----------------
      case "grab": { // takes a dumbbell from someone (the real person's hand): reaches up, the weight lands, drags him down
        const got = 0.5, heavy = Math.min(1, Math.max(0, (lt - got) / 0.35));
        if (lt < got) {
          const u = ease(Math.min(1, lt / 0.35));
          hands = { R: { x: 300 + 80 * u, y: 230 - 110 * u, a: 120 - 90 * u, z: 0.3 + 0.3 * u, pose: "open" }, L: { x: 120, y: 260, a: 150, z: 0.25, pose: "open" } };
        } else {
          const shake = Math.sin(lt * 38) * 4 * heavy;
          hands = { R: { x: 380 - 40 * heavy, y: 120 + 300 * heavy + shake, a: 30 + 140 * heavy, z: 0.6 - 0.3 * heavy, pose: "fist" }, L: { x: 120, y: 260 - 40 * heavy, a: 150, z: 0.25, pose: "open" } };
          prop = { hands: ["R"], kind: "dumbbell" };
          const up = Math.min(1, (act.dur - lt) / 0.3); // straightens up over the last 0.3 s (no one-frame snap when the move ends)
          crouch = 0.28 * heavy * up; rx = 0.22 * heavy * up; rz = (-0.12 * heavy + Math.sin(lt * 31) * 0.015 * heavy) * up;
          if (lt - got < 0.15) fx.push({ name: "impact", lt: lt - got, x: px0 + r * 0.9, y: py0 - r * 0.5 });
        }
        handsW = Math.min(1, lt / 0.2, (act.dur - lt) / 0.3);
        break;
      }
      case "curl": { // dumbbell curls, right arm
        const u = 0.5 - 0.5 * Math.cos(2 * Math.PI * Math.max(0, lt - 0.25) / 1.0);
        hands = { R: { x: 345 - 30 * u, y: 352 - 118 * u, a: 175 - 180 * u, z: 0.3 + 0.32 * u, pose: "fist" }, L: { x: 96, y: 302, a: 150, z: 0.25, pose: "fist" } };
        handsW = Math.min(1, lt / 0.25, (act.dur - lt) / 0.3); prop = { hands: ["R"], kind: "dumbbell" }; rx = -0.06 * u;
        break;
      }
      case "press": { // dumbbell shoulder press: both dumbbells from the shoulders up over the head and back (in the picture plane)
        const u = 0.5 - 0.5 * Math.cos(2 * Math.PI * Math.max(0, lt - 0.25) / 1.15);
        hands = { L: { x: 18 + 70 * u, y: 196 - 150 * u, a: -8 + 8 * u, z: 0.18, pose: "fist" }, R: { x: 362 - 70 * u, y: 196 - 150 * u, a: 8 - 8 * u, z: 0.18, pose: "fist" } };
        handsW = Math.min(1, lt / 0.25, (act.dur - lt) / 0.3); prop = { hands: ["L", "R"], kind: "dumbbell" }; dy = -0.03 * u;
        break;
      }
      case "raise": { // lateral raise: both arms out to the sides up to shoulder height, dumbbells pointing forward
        const u = 0.5 - 0.5 * Math.cos(2 * Math.PI * Math.max(0, lt - 0.25) / 1.2);
        hands = { L: { x: 40 - 100 * u, y: 352 - 112 * u, a: 190 + 80 * u, z: 0.16, pose: "fist" }, R: { x: 340 + 100 * u, y: 352 - 112 * u, a: 170 - 80 * u, z: 0.16, pose: "fist" } };
        handsW = Math.min(1, lt / 0.25, (act.dur - lt) / 0.3); prop = { hands: ["L", "R"], kind: "dumbbell", axis: [0, 0, 1] };
        break;
      }
      case "squat": { // body goes down, knees out, arms straight forward
        const u = 0.5 - 0.5 * Math.cos(2 * Math.PI * Math.max(0, lt - 0.2) / 1.2);
        crouch = (W2 ? 0.42 : 0.2) * u; knee = u; rx = (W2 ? 0.2 : 0.1) * u; if (W2) spread = 0.3 * u;
        hands = { L: { x: 150, y: 300, a: 0, z: 0.85, pose: "fist" }, R: { x: 230, y: 300, a: 0, z: 0.85, pose: "fist" } };
        handsW = Math.min(1, lt / 0.25, (act.dur - lt) / 0.3);
        break;
      }
      case "walkon": case "walkaway": { // walking in place while the footage's camera travels with him (a tracking shot):
        // walkon = 3/4 toward the screen's left, walkaway = turned away, into the picture (the turn takes 0.4 s each way)
        const w = Math.max(0, Math.min(1, lt / 0.25, (act.dur - lt) / 0.3));
        walk = (lt * 2.6) / (W2 ? 0.95 : 0.34) * Math.PI; walkW = w; stride = 1.55;
        const g = gait(walk, 0); dy = g.dy * w; rz = g.rz * w; rx = g.rx * w; crouch = g.crouch * w;
        const wt = Math.max(0, Math.min(1, lt / 0.4, (act.dur - lt) / 0.4));
        ry = name === "walkaway" ? (2.6 - baseYaw) * ease(wt) : (-0.75 - baseYaw * 0.4) * ease(w);
        break;
      }
      case "run": { // running in place: high knees, fists pumping
        walk = lt * 15; lift = 2.2; walkW = Math.max(0, Math.min(1, lt / 0.2, (act.dur - lt) / 0.25));
        // a runner leans forward, bounces twice per stride (lowest when a foot lands) and swings each arm against
        // the opposite leg: the left fist comes up and forward while the right knee is up, and the other way round
        dy = (0.04 + Math.abs(Math.sin(walk)) * 0.09) * walkW; rz = Math.sin(walk) * 0.045 * walkW; rx = 0.13 * walkW;
        const c1 = Math.cos(walk);
        hands = { L: { x: 92 - 14 * c1, y: 312 - 56 * c1, a: 150 - 22 * c1, z: 0.3 + 0.22 * (0.5 + 0.5 * c1), pose: "fist" }, R: { x: 288 - 14 * c1, y: 312 + 56 * c1, a: -150 - 22 * c1, z: 0.3 + 0.22 * (0.5 - 0.5 * c1), pose: "fist" } };
        handsW = Math.min(1, lt / 0.2, (act.dur - lt) / 0.25);
        break;
      }
      case "box": { // jabs toward the camera, alternating; the other hand guards the face
        const ph = (lt / 0.45) % 1, left = Math.floor(lt / 0.45) % 2 === 0;
        const ext = ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI / 2) : 1 - (ph - 0.35) / 0.65;
        const eL = left ? ext : 0, eR = left ? 0 : ext; // the jab comes back to the guard before the other hand goes
        hands = { L: { x: 120 + 40 * eL, y: 236, a: 30 - 30 * eL, z: 0.5 + 0.8 * eL, pose: "fist" }, R: { x: 260 - 40 * eR, y: 236, a: -30 + 30 * eR, z: 0.5 + 0.8 * eR, pose: "fist" } };
        handsW = Math.min(1, lt / 0.2, (act.dur - lt) / 0.25); ry = (left ? -1 : 1) * 0.22 * ext; dy = 0.04 * Math.abs(Math.sin(lt * 7));
        break;
      }
      case "jacks": { // jumping jacks: arms up over the head + feet apart, then back
        const u = 0.5 - 0.5 * Math.cos(2 * Math.PI * lt / 0.7);
        const w = Math.max(0, Math.min(1, lt / 0.2, (act.dur - lt) / 0.25));
        spread = u * w; dy = Math.sin(Math.PI * ((lt / 0.35) % 1)) * 0.12 * w;
        hands = { L: { x: 40 + 110 * u, y: 350 - 300 * u, a: 190 + 190 * u, z: 0.2, pose: "open" }, R: { x: 340 - 110 * u, y: 350 - 300 * u, a: 170 - 190 * u, z: 0.2, pose: "open" } };
        handsW = w;
        break;
      }
      case "drink": { // bottle up to the mouth, tilts, back down
        const up = Math.min(1, lt / 0.4, (act.dur - lt) / 0.4);
        hands = { R: { x: 340 - 110 * up, y: 340 - 80 * up, a: 170 - 270 * up, z: 0.25 + 0.45 * up, pose: "fist" } };
        handsW = Math.max(0, Math.min(1, lt / 0.2, (act.dur - lt) / 0.2)); prop = { hands: ["R"], kind: "bottle" }; rx = -0.12 * up;
        break;
      }
      case "eat": { // shawarma: three bites
        const up = Math.min(1, lt / 0.35, (act.dur - lt) / 0.35);
        hands = { R: { x: 330 - 100 * up, y: 330 - 52 * up, a: 160 - 220 * up, z: 0.25 + 0.4 * up, pose: "fist" } };
        handsW = Math.max(0, Math.min(1, lt / 0.2, (act.dur - lt) / 0.2)); prop = { hands: ["R"], kind: "shawarma" };
        break;
      }
      case "shaker": { // protein shaker, shaken fast by the shoulder
        hands = { R: { x: 322, y: 200 + Math.sin(lt * 26) * 26, a: 0, z: 0.4, pose: "fist" } };
        handsW = Math.min(1, lt / 0.2, (act.dur - lt) / 0.25); prop = { hands: ["R"], kind: "shaker" };
        break;
      }
      case "doubleflex": {
        hands = { L: { x: 56, y: 156, a: 60, z: 0.25, pose: "fist" }, R: { x: 324, y: 156, a: -60, z: 0.25, pose: "fist" } };
        handsW = Math.min(1, lt / 0.25, (act.dur - lt) / 0.3); dy = 0.04 * Math.sin(lt * 10);
        break;
      }
      // ---------------- Mrs. Coin's moves (batch 4, both coins can do them) ----------------
      case "tree": { // yoga tree pose: one foot on the other knee, hands joined over the head, balancing
        const w = ease(Math.min(1, lt / 0.6, (act.dur - lt) / 0.45));
        legs = { R: { k: [0.52, 0.38, 0.2], f: [-0.07, 0.42, 0.12] }, L: { k: [-0.2, 0.43, 0.02], f: [-0.17, 0.24, 0.04] } }; legW = w;
        hands = { L: { x: 179, y: 34, a: 14, z: 0.16, pose: "open" }, R: { x: 201, y: 34, a: -14, z: 0.16, pose: "open" } }; handsW = w;
        rz = Math.sin(lt * 2.3) * 0.035 * w; dx = -0.08 * w;
        break;
      }
      case "warrior": { // yoga warrior II: wide stance, front knee bent, arms stretched out flat, looking along the arm
        const w = ease(Math.min(1, lt / 0.6, (act.dur - lt) / 0.45));
        crouch = 0.1 * w;
        legs = { L: { k: [-0.62, 0.5, 0.14], f: [-0.82, 0.24, 0.1] }, R: { k: [0.46, 0.38, -0.02], f: [0.74, 0.24, -0.04] } }; legW = w;
        hands = { L: { x: -50, y: 236, a: -90, z: 0.08, pose: "open" }, R: { x: 430, y: 236, a: 90, z: 0.08, pose: "open" } }; handsW = w;
        ry = -0.18 * w;
        break;
      }
      case "lotus": { // sits cross-legged and meditates... then floats a little off the ground (calm rings around)
        const w = ease(Math.min(1, lt / 0.6, (act.dur - lt) / 0.5));
        const float = ease(Math.min(1, Math.max(0, lt - 0.9) / 0.8)) * Math.min(1, (act.dur - lt) / 0.6);
        crouch = 0.45 * w; dy = (0.3 + Math.sin(lt * 2.4) * 0.04) * float;
        legs = { L: { k: [-0.62, 0.21, 0.32], f: [0.2, 0.11, 0.5] }, R: { k: [0.62, 0.21, 0.32], f: [-0.2, 0.14, 0.55] } }; legW = w;
        hands = { L: { x: 92, y: 322, a: -70, z: 0.38, pose: "count2" }, R: { x: 288, y: 322, a: 70, z: 0.38, pose: "count2" } }; handsW = w;
        if (float > 0.01) fx.push({ name: "calm", w: float, lt: lt - 0.9, x: px0, y: py0 + r * 0.2 - dy * UNIT * Math.min(size, 1) });
        break;
      }
      case "yogasit": { // sits cross-legged on her mat, hands on the knees, breathing slowly; held: ONE cue at the start keeps her down until another move of hers starts (a repeated cue cuts the one before it and she bobs up at every cut)
        const w = Math.min(1, (act.dur - lt) / 0.4, t - lt < 0.1 ? 1 : lt / 0.4), br = Math.sin(t * 1.6 + seed); // already seated when the cue opens the video, else she sits down in 0.4 s
        crouch = 0.45 * w; dy = 0.012 * br * w;
        legs = { L: { k: [-0.62, 0.21, 0.32], f: [0.2, 0.11, 0.5] }, R: { k: [0.62, 0.21, 0.32], f: [-0.2, 0.14, 0.55] } }; legW = w;
        hands = { L: { x: 34, y: 318 - 3 * br, a: -58, z: 0.42, pose: "count3" }, R: { x: 346, y: 318 - 3 * br, a: 58, z: 0.42, pose: "count3" } }; handsW = w;
        break;
      }
      case "pilates": { // standing side leg lifts, one hand on the hip, the other arm stretched over the head
        const w = ease(Math.min(1, lt / 0.4, (act.dur - lt) / 0.4));
        const u = (0.5 - 0.5 * Math.cos(2 * Math.PI * Math.max(0, lt - 0.3) / 1.1)) * w;
        const f: V3 = [0.31 + 0.62 * u, 0.24 + 0.44 * u, 0.04];
        legs = { R: { k: [(0.2 + f[0]) / 2 + 0.02, (0.62 + f[1]) / 2, 0.03], f } }; legW = w;
        hands = { L: { x: 96, y: 302, a: 150, z: 0.25, pose: "fist" }, R: { x: 150 - 30 * u, y: -6, a: -60 - 20 * u, z: 0.1, pose: "open" } }; handsW = w;
        rz = 0.16 * u + 0.05 * w;
        break;
      }
      case "bellydance": { // hip shimmy (fast), side sway (slow), snake arms; a hip scarf with jingling coins
        const w = Math.min(1, lt / 0.3, (act.dur - lt) / 0.35);
        const sway = Math.sin(lt * 3.4), wave = Math.sin(lt * 5.2);
        rz = (Math.sin(lt * 26) * 0.03 + sway * 0.08) * w; dx = sway * 0.14 * w; dy = Math.abs(Math.sin(lt * 26)) * 0.015 * w;
        spread = 0.15 * w; knee = 0.15 * w;
        const swap = ease(Math.min(1, Math.max(0, (lt - act.dur / 2 + 0.25) / 0.5)));
        const up = { x: 70 + wave * 22, y: 30 + wave * 14, a: -25 + wave * 30, z: 0.18, pose: "open" as HandPose };
        const side = { x: 372 + wave * 10, y: 214 - wave * 22, a: 75 - wave * 25, z: 0.2, pose: "open" as HandPose };
        const sideL = { x: 8 - wave * 10, y: 214 + wave * 22, a: -75 - wave * 25, z: 0.2 }, upR = { x: 310 - wave * 22, y: 30 - wave * 14, a: 25 + wave * 30, z: 0.18 };
        const mix = (A: typeof up, B: { x: number; y: number; a: number; z: number }) => ({ x: A.x + (B.x - A.x) * swap, y: A.y + (B.y - A.y) * swap, a: A.a + (B.a - A.a) * swap, z: A.z + (B.z - A.z) * swap, pose: "open" as HandPose });
        hands = { L: mix(up, sideL), R: mix(side, upR) };
        handsW = w;
        break;
      }
      case "rope": { // skipping rope: the rope turns over the head and under the feet, she hops as it passes under
        const ph = (2 * Math.PI * lt) / 0.46;
        const w = Math.min(1, lt / 0.25, (act.dur - lt) / 0.3);
        dy = 0.2 * Math.pow(Math.max(0, -Math.cos(ph)), 1.4) * w;
        hands = { L: { x: 34 + Math.cos(ph) * 10, y: 330 + Math.sin(ph) * 10, a: 205, z: 0.32, pose: "fist" }, R: { x: 346 - Math.cos(ph) * 10, y: 330 + Math.sin(ph) * 10, a: 155, z: 0.32, pose: "fist" } };
        handsW = w;
        break;
      }
      case "hoop": { // hula hoop around the waist, hips circling, hands up
        const om = lt * 9, w = Math.min(1, lt / 0.3, (act.dur - lt) / 0.35);
        dx = Math.cos(om) * 0.05 * w; rz = Math.sin(om) * 0.05 * w;
        hands = { L: { x: 64, y: 34, a: -24, z: 0.2, pose: "open" }, R: { x: 316, y: 34, a: 24, z: 0.2, pose: "open" } }; handsW = w;
        break;
      }
      case "swim": { // front crawl toward the camera: windmill arms, body roll, water up to the chest with splashes
        const w = Math.min(1, lt / 0.3, (act.dur - lt) / 0.35);
        const ph = (2 * Math.PI * lt) / 1.1;
        const arm = (a: number, side: 1 | -1) => ({ x: 190 - side * (120 + 30 * Math.sin(a)), y: 222 - 250 * Math.cos(a), a: -side * 90 * (1 - Math.cos(a)), z: 0.2 + 0.7 * Math.max(0, Math.sin(a)), pose: "open" as HandPose });
        hands = { L: arm(ph, 1), R: arm(ph + Math.PI, -1) }; handsW = w;
        rz = Math.sin(ph) * 0.09 * w; rx = 0.12 * w; dy = Math.sin(2 * ph) * 0.025 * w;
        fx.push({ name: "water", w, lt, x: px0, y: py0 });
        break;
      }
      case "selfie": { // phone up at arm's length, peace sign, head tilt... flash!
        const w = ease(Math.min(1, lt / 0.4, (act.dur - lt) / 0.4));
        hands = { R: { x: 338, y: 74, a: -24, z: 0.75, pose: "fist" }, L: { x: 66, y: 150, a: -16, z: 0.4, pose: "count2" } }; handsW = w;
        prop = { hands: ["R"], kind: "phone" };
        rz = -0.12 * w; ry = 0.18 * w;
        if (lt > 1.3 && lt < 1.75) fx.push({ name: "flash", lt: lt - 1.3, x: px0 + ((338 - 190) / 130) * r, y: py0 + ((74 - 222) / 130) * r });
        break;
      }
      case "hearthands": { // both hands make a heart in front of the chest, a big heart pops above it
        const w = ease(Math.min(1, lt / 0.35, (act.dur - lt) / 0.35));
        hands = { L: { x: 168, y: 300, a: 48, z: 0.85, pose: "open" }, R: { x: 212, y: 300, a: -48, z: 0.85, pose: "open" } }; handsW = w;
        if (lt > 0.3) fx.push({ name: "heartpop", w: Math.min(1, (act.dur - lt) / 0.3), lt: lt - 0.3, x: px0, y: py0 - r * 0.15 });
        break;
      }
      case "kiss": { // flying kiss: fingers to the lips, then thrown to the camera, a heart flies out
        const toLips = ease(Math.min(1, lt / 0.35)), out = ease(Math.min(1, Math.max(0, lt - 0.75) / 0.3));
        const back = Math.min(1, (act.dur - lt) / 0.35);
        hands = { R: { x: 206 + 150 * out, y: 262 - 90 * out, a: -8 + 70 * out, z: 0.6 - 0.2 * out, pose: out > 0.3 ? "open" : "fist" } }; handsW = Math.min(toLips, back);
        rz = -0.06 * toLips * (1 - out);
        if (lt > 0.8) fx.push({ name: "kiss", lt: lt - 0.8, x: px0 + ((210 - 190) / 130) * r, y: py0 + ((262 - 222) / 130) * r });
        break;
      }
      case "cheer": { // pom-poms: arms up in a V, then down, shaking; small hops
        const w = Math.min(1, lt / 0.25, (act.dur - lt) / 0.3);
        const u = 0.5 - 0.5 * Math.cos(2 * Math.PI * lt / 0.8), sh = Math.sin(lt * 30) * 8;
        hands = { L: { x: 30 - 50 * u + sh, y: 330 - 300 * u, a: 200 + 200 * u, z: 0.3, pose: "fist" }, R: { x: 350 + 50 * u - sh, y: 330 - 300 * u, a: 160 - 200 * u, z: 0.3, pose: "fist" } };
        handsW = w; prop = { hands: ["L", "R"], kind: "pompom" };
        dy = 0.12 * Math.max(0, Math.sin(2 * Math.PI * lt / 0.8)) * w;
        break;
      }
      // ---------------- the angry trainer (videos/ndl) ----------------
      case "yell": { // "انزل!": leans in, jabs a finger down at the floor twice and stomps on the first jab (right knee up, down)
        const w = Math.min(1, lt / 0.2, (act.dur - lt) / 0.3);
        const jab = Math.max(0, Math.sin(Math.PI * Math.min(1, lt / 0.45))) + 0.7 * Math.max(0, Math.sin(Math.PI * Math.max(0, (lt - 0.55) / 0.4)));
        const kn = lt < 0.22 ? ease(lt / 0.22) : 1 - ease(Math.min(1, (lt - 0.22) / 0.14)); // up, then stamped down at 0.36 s
        hands = { R: { x: 312, y: 352 + 46 * jab, a: 196, z: 0.55 + 0.2 * jab, pose: "point" }, L: { x: 64, y: 330, a: 192, z: 0.24, pose: "fist" } }; handsW = w;
        legs = { R: { k: [0.34, 0.66, 0.34], f: [0.34, 0.34, 0.3] } }; legW = kn;
        rx = (0.16 + 0.06 * jab) * w; dy = -0.03 * kn;
        if (lt > 0.36 && lt < 0.7) fx.push({ name: "impact", lt: lt - 0.36, x: px0 + r * 0.45, y: py0 + r * 1.55 });
        break;
      }
      case "comeup": { // "ارجع": both palms up, lifting twice (come back up)
        const w = Math.min(1, lt / 0.2, (act.dur - lt) / 0.3);
        const u = (0.5 - 0.5 * Math.cos((2 * Math.PI * lt) / 0.6)) * w;
        hands = { L: { x: 84, y: 318 - 92 * u, a: -24, z: 0.45, pose: "open" }, R: { x: 296, y: 318 - 92 * u, a: 24, z: 0.45, pose: "open" } }; handsW = w;
        rx = 0.08 * w - 0.06 * u; dy = 0.03 * u;
        break;
      }
      case "shove": { // pushes whoever he faces: a little wind-up, both hands thrust out to that side, a lunge, back
        const side = Math.sign(baseYaw) || (px0 > W / 2 ? -1 : 1);
        const k = lt < 0.2 ? -0.3 * ease(lt / 0.2) : lt < 0.38 ? -0.3 + 1.3 * ease((lt - 0.2) / 0.18) : lt < 0.6 ? 1 : 1 - ease(Math.min(1, (lt - 0.6) / 0.3));
        dx = side * 0.32 * k; rz = -side * 0.14 * k;
        hands = { L: { x: 190 + side * 215 - 22, y: 196, a: side * 88, z: 0.5, pose: "open" }, R: { x: 190 + side * 215 + 22, y: 262, a: side * 96, z: 0.55, pose: "open" } };
        handsW = Math.min(1, lt / 0.15, (act.dur - lt) / 0.25);
        if (lt > 0.36 && lt < 0.8) fx.push({ name: "impact", lt: lt - 0.36, x: px0 + side * r * 1.5, y: py0 });
        break;
      }
      case "slap": { // "يلطشه بالقلم": the near hand winds up high behind his head, whips across the face of whoever he faces (lands at 0.34 s), follows through, comes back
        const side = Math.sign(baseYaw) || (px0 > W / 2 ? -1 : 1);
        const k = lt < 0.22 ? -ease(lt / 0.22) : lt < 0.34 ? -1 + 2 * ease((lt - 0.22) / 0.12) : lt < 0.5 ? 1 : 1 - 2 * ease(Math.min(1, (lt - 0.5) / 0.3)) * 0.5;
        const w = Math.min(1, lt / 0.12, (act.dur - lt) / 0.25), sw = Math.max(0, k), bk = Math.max(0, -k);
        const hand = { x: 190 + side * (40 * bk + 232 * sw), y: 196 - 96 * bk - 22 * sw, a: side * (30 + 70 * sw), z: 0.5 + 0.2 * sw, pose: "open" as const };
        hands = side > 0 ? { R: hand } : { L: hand }; handsW = w;
        dx = side * (0.22 * sw - 0.08 * bk) * w; ry = side * (0.35 * sw - 0.3 * bk) * w; rz = -side * 0.1 * sw * w;
        if (lt > 0.34 && lt < 0.74) fx.push({ name: "impact", lt: lt - 0.34, x: px0 + side * r * 1.45, y: py0 - r * 0.15 });
        break;
      }
      case "slapped": { // takes the slap: the face whips away from whoever he faces in 0.07 s, the body rocks away squashed, then wobbles back slowly
        const side = Math.sign(baseYaw) || (px0 > W / 2 ? -1 : 1);
        const k = lt < 0.07 ? ease(lt / 0.07) : Math.exp(-(lt - 0.07) * 1.7) * (0.86 + 0.14 * Math.cos((lt - 0.07) * 11));
        const o = Math.min(1, (act.dur - lt) / 0.25), kk = k * o;
        dx = -side * 0.3 * kk; ry = -side * 1.0 * kk; rz = side * 0.24 * kk; dy = 0.05 * kk; asx = 1 - 0.07 * kk; asy = 1 + 0.05 * kk;
        hands = { L: { x: 40 - side * 30, y: 300, a: 200, z: 0.3, pose: "open" }, R: { x: 340 - side * 30, y: 300, a: 160, z: 0.3, pose: "open" } }; handsW = Math.min(1, lt / 0.07) * o;
        glance = { x: -side * 6, y: -2 };
        break;
      }
      case "sideplank": { // pilates side plank with a leg lift (owner's photo): the disc tipped on its side, one hand planted on the floor, the other arm stretched past the head, the top leg lifted and shaking: she can barely hold it
        const w = Math.min(1, lt / 0.3, (act.dur - lt) / 0.35), tr = Math.sin(lt * 31 + seed) * Math.min(1, lt / 1.2), sag = 0.5 - 0.5 * Math.cos(lt * 2.6);
        rz = (-1.25 + 0.035 * tr + 0.07 * sag) * w; dy = (-0.42 - 0.03 * sag) * w; dx = 0.01 * tr * w;
        hands = { R: { x: 383, y: 179, a: 108, z: 0.3, pose: "open" }, L: { x: 150, y: 0 + 12 * sag, a: -8, z: 0.3, pose: "open" } }; handsW = w;
        legs = { L: { k: [-0.8, 0.62, 0.05], f: [-1.5, 0.92 - 0.22 * sag + 0.03 * tr, 0.05] }, R: { k: [-0.4, 0.15, 0.1], f: [-0.9, 0.0, 0.1] } }; legW = w;
        break;
      }
      case "daydream": { // lying on her tummy on the floor, chin in both hands, feet kicking slowly behind her, lost in a romantic thought (holds until another move starts)
        const w = Math.min(1, (act.dur - lt) / 0.4), sw = Math.sin(t * 2.3 + seed); // no fade-in: she is already lying there; one cue holds until another move of hers starts
        dy = -0.5 * w; rx = 0.1 * w; rz = 0.07 * sw * w;
        hands = { L: { x: 74, y: 262, a: -22, z: 0.6, pose: "open" }, R: { x: 306, y: 262, a: 22, z: 0.6, pose: "open" } }; handsW = w;
        legs = { L: { k: [-0.42, 0.5, -0.2], f: [-0.55, 1.36 + 0.16 * sw, -0.3] }, R: { k: [0.42, 0.5, -0.2], f: [0.55, 1.36 - 0.16 * sw, -0.3] } }; legW = w;
        glance = { x: 3, y: -6 };
        break;
      }
      case "scuffle": { // grabbing and pushing each other: leans in at whoever he faces, fists at the other's shoulder and chest, back and forth
        const side = Math.sign(baseYaw) || (px0 > W / 2 ? -1 : 1);
        const w = Math.min(1, lt / 0.3, (act.dur - lt) / 0.4), A = Math.sin(lt * 8 + seed * 2.1);
        dx = side * (0.2 + 0.1 * A) * w; rz = (-side * 0.12 + 0.06 * Math.sin(lt * 11 + seed)) * w; dy = Math.abs(Math.sin(lt * 8 + seed)) * 0.05 * w;
        hands = { L: { x: 190 + side * 190, y: 176 + 30 * A, a: side * 80, z: 0.5, pose: "fist" }, R: { x: 190 + side * 172, y: 272 - 30 * A, a: side * 100, z: 0.62, pose: "fist" } }; handsW = w;
        if (side > 0 && lt % 0.7 < 0.6) fx.push({ name: "puff", lt: lt % 0.7, x: px0 + r * 1.25, y: py0 - r * 0.2 });
        break;
      }
      case "hold": { // "ماسكه من كتافه": both fists on the shoulders of whoever he faces, for as long as the cue lasts, jolting him now and then
        const side = Math.sign(baseYaw) || (px0 > W / 2 ? -1 : 1);
        const w = Math.min(1, lt / 0.3, (act.dur - lt) / 0.4), J = Math.sin(lt * 7 + seed) * Math.max(0, Math.sin(lt * 1.3 + seed));
        dx = side * (0.1 + 0.05 * J) * w; rz = -side * (0.07 + 0.03 * J) * w; dy = Math.abs(J) * 0.02 * w;
        hands = { L: { x: 190 + side * 178, y: 160 + 8 * J, a: side * 86, z: 0.5, pose: "fist" }, R: { x: 190 + side * 170, y: 318 + 8 * J, a: side * 100, z: 0.62, pose: "fist" } }; handsW = w;
        break;
      }
      case "hang": { // "متعلق في الحبل": both fists up over his head gripping (a rope, a bar), the body swinging gently under them
        const w = Math.min(1, lt / 0.04, (act.dur - lt) / 0.04), sw = Math.sin(lt * 3.1 + seed);
        hands = { L: { x: 162, y: -46, a: -6, z: 0.42, pose: "fist" }, R: { x: 218, y: -46, a: 6, z: 0.42, pose: "fist" } }; handsW = w;
        rz = 0.06 * sw * w; dy = 0.02 * w;
        break;
      }
      case "whisper": { // "تعالوا أقولكم سر": leans into the lens, eyes on the viewer, one hand cupped beside the mouth, the other reaching out to hold the camera; held to the scene's end
        const w = Math.min(1, lt / 0.3, (act.dur - lt) / 0.3);
        hands = { R: { x: 266, y: 232, a: -8, z: 0.74, pose: "open" }, L: { x: 72, y: 128 + 5 * Math.sin(lt * 2.2 + seed), a: -22, z: 0.9, pose: "open" } }; handsW = w;
        rx = 0.22 * w; rz = 0.07 * w; ry = -0.12 * w; dy = -0.08 * w; // the mouth comes toward the lens
        break;
      }
      case "splash": { // "بتطرطش بالمية برجليها": seated with "dangle" at the water's edge, the feet kick in turn and drops fly up at each kick; held to the scene's end
        const w = Math.min(1, lt / 0.35, (act.dur - lt) / 0.35), c = lt % 0.45, sd = Math.floor(lt / 0.45) % 2 ? 1 : -1;
        splash = w; rz = 0.03 * Math.sin(lt * 7) * w;
        if (w >= 1) fx.push({ name: "splash", lt: c, x: px0 + sd * r * 0.42, y: py0 + r * 1.85 });
        break;
      }
      case "shoo": { // "يشوح": the right hand swats the air left and right, palm open, fed up (the body leans away from it)
        const w = Math.min(1, lt / 0.2, (act.dur - lt) / 0.3), sw = Math.sin(lt * 9 + seed);
        hands = { R: { x: 352 + 46 * sw, y: 250 - 20 * Math.abs(sw), a: 50 + 40 * sw, z: 0.5, pose: "open" } }; handsW = w;
        rz = 0.05 * sw * w; ry = -0.08 * sw * w;
        break;
      }
      case "scroll": { // scrolling his phone (outfit "phone"): head a little down, eyes on the phone; the thumb flicks are in the holdL block below
        const w = Math.min(1, lt / 0.2, (act.dur - lt) / 0.3);
        rx = 0.07 * w;
        glance = { x: 1.5 * w, y: 6.5 * w };
        break;
      }
      case "drop": break; // lets go of the barbell: the hands and the bar are in the barbell block below (they start from the bar)
      case "highfive": {
        const inward = kind !== "mrs" ? 1 : -1;
        const s = Math.sin(Math.PI * p);
        dx = inward * 0.45 * s; rz = -inward * 0.2 * s;
        hands = inward > 0 ? { R: { x: 392, y: 118, a: 28, z: 0.3, pose: "open" } } : { L: { x: -12, y: 118, a: -28, z: 0.3, pose: "open" } };
        handsW = Math.min(1, lt / 0.3, (act.dur - lt) / 0.3);
        hf = p; // the stage aims the hands at each other (see Coin3D)
        break;
      }
      // ---------------- football (the ball itself: ballAt below) ----------------
      case "kick": { // wind-up, the right foot meets the ball at KICK_CONTACT, follow-through, back to the stance
        const K: { at: number; k: V3; f: V3; rx: number }[] = [
          { at: 0, k: [0.31, 0.45, 0.08], f: [0.31, 0.24, 0.04], rx: 0 },
          { at: KICK_CONTACT - 0.12, k: [0.34, 0.5, -0.06], f: [0.32, 0.38, -0.32], rx: -0.06 },  // leg back, leaning back
          { at: KICK_CONTACT, k: [0.32, 0.46, 0.22], f: [0.3, 0.27, 0.42], rx: 0.05 },            // contact: foot on the ball
          { at: KICK_CONTACT + 0.15, k: [0.3, 0.6, 0.3], f: [0.26, 0.5, 0.5], rx: 0.1 },           // follow-through
          { at: act.dur - 0.05, k: [0.31, 0.45, 0.08], f: [0.31, 0.24, 0.04], rx: 0 },
        ];
        let j = 0; while (j < K.length - 2 && lt > K[j + 1].at) j++;
        const A = K[j], B = K[j + 1], u = ease(Math.max(0, Math.min(1, (lt - A.at) / (B.at - A.at))));
        const mix3 = (a: V3, b: V3): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
        legs = { R: { k: mix3(A.k, B.k), f: mix3(A.f, B.f) } }; legW = Math.min(1, lt / 0.1, (act.dur - lt) / 0.15);
        rx = A.rx + (B.rx - A.rx) * u;
        hands = { L: { x: -10, y: 230, a: -80, z: 0.2, pose: "open" } }; handsW = Math.min(1, lt / 0.2, (act.dur - lt) / 0.25); // arm out for balance
        break;
      }
      case "juggle": { // keepy-ups: the right foot taps the ball up every 0.55 s (the ball's height: ballAt)
        const w = Math.min(1, lt / 0.25, (act.dur - lt) / 0.3), tap = Math.pow(Math.max(0, Math.cos((Math.PI * lt) / 0.55)), 8);
        legs = { R: { k: [0.32, 0.5, 0.18], f: [0.3, 0.26 + 0.14 * tap, 0.28] } }; legW = w;
        hands = { L: { x: 10, y: 260, a: -70, z: 0.2, pose: "open" }, R: { x: 370, y: 260, a: 70, z: 0.2, pose: "open" } }; handsW = w;
        rx = 0.05 * w; dy = 0.02 * tap * w;
        break;
      }
      case "keeper": { // goalkeeper: knees bent, gloves open, small side steps (they fade out before whatever comes next)
        const w = Math.max(0, Math.min(1, lt / 0.3, (act.dur - lt) / 0.3));
        crouch = 0.14 * w; knee = 0.45 * w; spread = 0.25 * w;
        dx = Math.sin(lt * 2.6) * 0.16 * w; dy = Math.abs(Math.sin(lt * 5.2)) * 0.02 * w;
        hands = { L: { x: 20, y: 236, a: -60, z: 0.4, pose: "open" }, R: { x: 360, y: 236, a: 60, z: 0.4, pose: "open" } }; handsW = w;
        break;
      }
      case "dive": { // a goalkeeper's dive to the side (toward the middle of the frame), lands, gets back up
        const side = px0 > 540 ? -1 : 1, fly = ease(Math.min(1, lt / 0.45)), up = ease(Math.max(0, Math.min(1, (lt - (act.dur - 0.45)) / 0.45)));
        dx = side * 1.1 * fly * (1 - up); dy = Math.sin(Math.PI * Math.min(1, lt / 0.45)) * 0.45 - 0.55 * fly * (1 - up);
        rz = -side * 1.35 * fly * (1 - up);
        hands = { L: { x: 190 - side * 140, y: 20, a: -side * 20, z: 0.3, pose: "open" }, R: { x: 190 + side * 160, y: 30, a: side * 30, z: 0.3, pose: "open" } };
        handsW = Math.min(1, lt / 0.15, (act.dur - lt) / 0.3);
        if (lt > 0.45 && lt < 0.75) fx.push({ name: "puff", lt: lt - 0.45, x: px0 + side * r * 1.1, y: py0 + r * 1.2 });
        break;
      }
      case "crash": case "hit": { // the ball in the face: hard stop, the head snaps back, he falls flat on his back, lies there dizzy
        // {crash} = the same fall, after he comes flying in from the side he is on, tumbling (kicked into the room), for 0.28 s
        const inT = name === "crash" ? 0.28 : 0;
        if (lt < inT) { const q = lt / inT, side = px0 > W / 2 ? 1 : -1; dx = side * ((side > 0 ? W - px0 : px0) + 260) / (UNIT * Math.min(size, 1)) * (1 - q); dy = 0.5 * (1 - q); rz = -side * 5 * (1 - q); tuck = 0.5; hands = faceplantFlail(lt); handsW = 1; break; }
        const lh = lt - inT;
        const snap = Math.min(1, lh / 0.1), fall = Math.max(0, Math.min(1, (lh - 0.1) / 0.55)), g = fall * fall; // falls with gravity
        const getUp = ease(Math.max(0, Math.min(1, (lh - (act.dur - inT - 0.6)) / 0.6)));
        rx = (-0.35 * snap - 1.3 * g) * (1 - getUp); dy = -0.95 * g * (1 - getUp) + 0.3 * Math.sin(getUp * Math.PI);
        const limp = ease(Math.max(0, Math.min(1, (lh - 0.45) / 0.35))), lp = (a0: number, b0: number) => a0 + (b0 - a0) * limp;
        hands = { L: { x: lp(-30, -20), y: lp(150, 260), a: lp(-40, -100), z: lp(0.3, 0.2), pose: "open" }, R: { x: lp(410, 400), y: lp(150, 260), a: lp(40, 100), z: lp(0.3, 0.2), pose: "open" } };
        handsW = Math.min(1, lh / 0.25, (act.dur - inT - lh) / 0.4);
        if (lh < 0.3) fx.push({ name: "impact", lt: lh, x: px0, y: py0 - r * 0.1 });
        if (lh > 0.65 && lh < 1.2) fx.push({ name: "puff", lt: lh - 0.65, x: px0, y: py0 + r * 1.3 });
        if (lh > 0.65 && lh < 0.75) squash((lh - 0.65) / 0.2, 0.8);
        break;
      }
      // ---------------- personality kit (bible.md: "the move we'll build" per emotion; both coins can do all) ----------------
      // shakes / nods stay under 0.06 rad per frame (motion-check), faces live in the act block of Coin3D
      case "no": case "stubborn": { // head shake "no" (stubborn = arms crossed + the shake + an upside-down mouth)
        const w = Math.min(1, lt / 0.15, (act.dur - lt) / 0.25), s0 = name === "stubborn" ? 0.3 : 0;
        const sh = Math.max(0, Math.min(1, (lt - s0) / 0.12, (s0 + 1.0 - lt) / 0.2));
        ry = Math.sin((lt - s0) * 9) * 0.14 * sh * w;
        if (name === "stubborn") { hands = gestureHands("cross", lt); handsW = Math.min(1, lt / 0.3, (act.dur - lt) / 0.3); }
        break;
      }
      case "nod": case "serious": { // slow, sure nods (serious: stands still, hands on the hips)
        const w = Math.min(1, lt / 0.2, (act.dur - lt) / 0.3);
        rx = Math.max(0, Math.sin(lt * 6.5)) * 0.1 * w;
        if (name === "serious") { hands = gestureHands("hip", lt); handsW = Math.min(1, lt / 0.3, (act.dur - lt) / 0.3); }
        break;
      }
      case "drama": { // the drama queen: back of the hand to the forehead, head thrown back, the other arm out, a fake tear
        const w = ease(Math.min(1, lt / 0.35, (act.dur - lt) / 0.35));
        hands = { R: { x: 236, y: 132, a: -70, z: 0.62, pose: "open" }, L: { x: -6, y: 236, a: -70, z: 0.2, pose: "open" } }; handsW = w;
        rx = -0.12 * w; rz = 0.08 * w;
        break;
      }
      case "sulk": { // sulking: turns her back, waits, steals a side-eye over the shoulder, turns back
        const away = kind === "mrs" ? 1 : -1;
        const turn = ease(Math.min(1, lt / 0.45)), back = ease(Math.max(0, Math.min(1, (lt - (act.dur - 0.5)) / 0.5)));
        const pk = Math.sin(Math.max(0, Math.min(1, (p - 0.42) / 0.36)) * Math.PI);
        ry = away * (2.5 * turn - 1.35 * pk) * (1 - back);
        hands = gestureHands("cross", lt); handsW = Math.min(turn, 1 - back);
        break;
      }
      case "diva": { // pampered (praised / a good offer): head tilt, palm under the chin, a quick flutter of the lashes
        const w = ease(Math.min(1, lt / 0.5, (act.dur - lt) / 0.35)); // the hand turns a long way from rest: 0.5 s
        hands = { R: { x: 232, y: 300, a: -40, z: 0.66, pose: "open" } }; handsW = w;
        rz = 0.14 * w;
        break;
      }
      case "protect": { // protective: plants herself, serious, hand on the waist, one slow nod
        const w = Math.min(1, lt / 0.3, (act.dur - lt) / 0.3);
        hands = { L: { x: 96, y: 302, a: 150, z: 0.25, pose: "fist" } }; handsW = w;
        rx = 0.07 * Math.sin(Math.max(0, Math.min(1, (lt - 0.5) / 0.6)) * Math.PI);
        break;
      }
      case "cough": case "toldyou": { // "ehem... told you": a fist to the mouth, two little coughs, smug
        const w = Math.min(1, lt / 0.25, (act.dur - lt) / 0.3);
        hands = { R: { x: 204, y: 274, a: -12, z: 0.72, pose: "fist" } }; handsW = w;
        const cg = (c0: number) => { const d = lt - c0; return d > 0 && d < 0.18 ? Math.sin((d / 0.18) * Math.PI) : 0; };
        rx = 0.06 * (cg(0.25) + cg(0.5)); dy = -0.02 * (cg(0.25) + cg(0.5));
        break;
      }
      case "eyeroll": { // her quirk when Mr. Coin says something silly: eyes roll up and over (glance below), a little tilt
        rz = -0.05 * Math.sin(Math.min(1, lt / act.dur) * Math.PI);
        break;
      }
      case "wow": { // "gamed dah!": both hands up, a small hop, starry eyes
        const w = Math.min(1, lt / 0.2, (act.dur - lt) / 0.3);
        hands = { L: { x: 46, y: 70, a: -25, z: 0.25, pose: "open" }, R: { x: 334, y: 70, a: 25, z: 0.25, pose: "open" } }; handsW = w;
        dy = Math.sin(Math.PI * Math.min(1, lt / 0.45)) * 0.25;
        break;
      }
      case "plan": { // "from today I'll be a beast!": rubs his hands, then the hero fist goes up with a hop
        const o = Math.sin(lt * 16) * 10 * Math.max(0, Math.min(1, (1.0 - lt) / 0.15));
        const u = ease(Math.max(0, Math.min(1, (lt - 1.0) / 0.3)));
        const lerp = (a0: number, b0: number) => a0 + (b0 - a0) * u;
        hands = { L: { x: lerp(176 + o, 96), y: lerp(298, 302), a: lerp(70, 150), z: lerp(0.62, 0.25), pose: u > 0.5 ? "fist" : "open" },
          R: { x: lerp(204 - o, 300), y: lerp(300, 40), a: lerp(-70, -10), z: lerp(0.64, 0.22), pose: u > 0.3 ? "fist" : "open" } };
        handsW = Math.min(1, lt / 0.25, (act.dur - lt) / 0.3);
        dy = Math.sin(Math.PI * Math.max(0, Math.min(1, (lt - 1.0) / 0.4))) * 0.2;
        break;
      }
      case "tap": case "impatient": { // impatient: taps his foot, checks an imaginary watch, then crosses his arms
        const w = Math.min(1, lt / 0.2, (act.dur - lt) / 0.3);
        legs = { R: { k: [0.3, 0.42, 0.1], f: [0.33, 0.24 + 0.07 * Math.max(0, Math.sin(lt * 13)), 0.12] } }; legW = w;
        const u = ease(Math.max(0, Math.min(1, (lt - act.dur * 0.45) / 0.3)));
        const W0 = gestureHands("watch", lt), C = gestureHands("cross", lt);
        const R0: Hand0 = { x: 284, y: 302, a: -150, z: 0.25 };
        const mix = (A: Hand0, B: Hand0, pose: HandPose) => ({ x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u, a: A.a + (B.a - A.a) * u, z: A.z + (B.z - A.z) * u, pose });
        hands = { L: mix(W0.L as Hand0, C.L as Hand0, "fist"), R: mix(R0, C.R as Hand0, "fist") }; handsW = w;
        if (u < 0.5) glance = { x: -6 * w * (1 - 2 * u), y: 7 * w * (1 - 2 * u) };
        break;
      }
      case "oops": { // laughs and admits it: scratches his head, a drop of sweat
        const w = Math.min(1, lt / 0.25, (act.dur - lt) / 0.3);
        hands = { R: { x: 300 + Math.sin(lt * 18) * 5, y: 104, a: -28, z: 0.12, pose: "open" } }; handsW = w;
        rz = 0.06 * w; dy = Math.abs(Math.sin(lt * 9)) * 0.03 * w;
        break;
      }
      case "hungry": { // any word about food / the diet: heart eyes and a hand rubbing the belly
        const w = Math.min(1, lt / 0.3, (act.dur - lt) / 0.3);
        hands = { R: { x: 222 + 18 * Math.cos(lt * 6), y: 330 + 12 * Math.sin(lt * 6), a: -60, z: 0.62, pose: "open" } }; handsW = w;
        rz = Math.sin(lt * 2.4) * 0.05 * w;
        break;
      }
      case "yawn": { // sleepy: a big stretch with the arms up, the mouth wide, then he sags
        // (also eases out early when the next move cuts it short: the cue's dur is clipped to the next cue)
        const u = ease(Math.min(1, lt / 0.5)) * (1 - ease(Math.max(0, Math.min(1, (lt - 1.6) / 0.5)))) * Math.max(0, Math.min(1, (act.dur - lt) / 0.3));
        hands = { L: { x: 140, y: 14, a: 10, z: 0.15, pose: "open" }, R: { x: 240, y: 14, a: -10, z: 0.15, pose: "open" } }; handsW = u;
        asy *= 1 + 0.06 * u; asx *= 1 - 0.03 * u;
        rx = 0.06 * Math.max(0, Math.min(1, (lt - 1.6) / 0.4)) * Math.min(1, (act.dur - lt) / 0.3);
        break;
      }
      case "nudge": { // teasing encouragement: an elbow jab toward you (twice), a wink and a side smile
        const w = Math.min(1, lt / 0.2, (act.dur - lt) / 0.3);
        const jab = Math.pow(Math.max(0, Math.sin(lt * 9)), 2) * (lt < 1.05 ? 1 : 0);
        hands = { R: { x: 250, y: 250, a: -100, z: 0.15, pose: "fist" } }; handsW = w;
        ry = -0.2 * jab * w; rz = -0.04 * jab * w;
        break;
      }
      case "cower": { // {scared} held for 12 s with no gaps; the hands sit lower, in front of the chest, so the mouth stays seen while he talks
        const w = Math.min(1, lt / 0.2, (act.dur - lt) / 0.3);
        hands = { L: { x: 118, y: 335, a: 20, z: 0.6, pose: "open" }, R: { x: 262, y: 335, a: -20, z: 0.6, pose: "open" } }; handsW = w;
        rz = Math.sin(lt * 38) * 0.022 * w; crouch = 0.12 * w; rx = -0.06 * w;
        break;
      }
      case "scared": { // fear: hands up in front, a tremble, shrinks back a little
        const w = Math.min(1, lt / 0.2, (act.dur - lt) / 0.3);
        hands = { L: { x: 112, y: 270, a: 20, z: 0.6, pose: "open" }, R: { x: 268, y: 270, a: -20, z: 0.6, pose: "open" } }; handsW = w;
        rz = Math.sin(lt * 38) * 0.022 * w; crouch = 0.12 * w; rx = -0.06 * w;
        break;
      }
    }
  }
  // ---- barbell (outfit "barbell"): held in both hands in front of the thighs. Scene "hinge" (0..1, per coin) bends him over
  // with it (Romanian deadlift: hips back, chest toward the camera, the bar slides down the legs); a value is kept until a
  // later scene sets another and eases in over 0.7 s. {drop}: he lets go, the bar falls and stays on the floor at his feet ----
  const scOut = scNow?.outfit, outNow: string[] = (Array.isArray(scOut) ? scOut : scOut?.[who]) ?? cfg.outfit ?? [];
  let bar: { held: boolean; floor: { x: number; y: number } | null } | null = null;
  if (outNow.includes("barbell")) {
    const hv = (i: number) => { for (let j = i; j >= 0; j--) { const h = full.scenes[j]?.hinge, v = typeof h === "object" ? h[who] : h; if (typeof v === "number") return v; } return 0; };
    const h0 = si > 0 ? hv(si - 1) : hv(0);
    let h = h0 + (hv(si) - h0) * ease(Math.min(1, Math.max(0, (t - (scNow?.start ?? 0)) / 0.7)));
    const dc = view.scenes.flatMap((sc) => sc.cues ?? []).find((c) => c.name === "drop" && c.t <= t);
    if (dc) h *= 1 - ease(Math.min(1, Math.max(0, (t - dc.t - 0.2) / 0.6))); // stands up once the bar is gone
    rx += 0.55 * h; crouch += 0.1 * h; knee = Math.max(knee, 0.18 * h);
    if (!dc && !act) {
      hands = { L: { x: 95, y: 380 + 90 * h, a: 180, z: 0.35 + 0.4 * h, pose: "fist" }, R: { x: 285, y: 380 + 90 * h, a: 180, z: 0.35 + 0.4 * h, pose: "fist" } };
      handsW = 1;
    } else if (act?.name === "drop") {
      // {drop}: the hands spring open and up from where they held the bar, then go back to his own gestures
      const u = ease(Math.min(1, act.lt / 0.25));
      hands = { L: { x: 95 - 20 * u, y: 380 + 90 * h - 90 * u, a: 180 - 150 * u, z: 0.35 + 0.4 * h, pose: "open" }, R: { x: 285 + 20 * u, y: 380 + 90 * h - 90 * u, a: 180 + 150 * u, z: 0.35 + 0.4 * h, pose: "open" } };
      handsW = Math.min(1, (act.dur - act.lt) / 0.3);
    }
    let floor: { x: number; y: number } | null = null;
    if (dc) {
      // falls from the hands (about 1.2 coin radii under his centre) to resting on its plates, one small bounce
      const rest = (py0 + r * 1.55) - 0.42 * r, top = py0 + r * 1.4, q = (t - dc.t) / 0.3;
      const y = q < 1 ? top + (rest - top) * q * q : rest - Math.max(0, Math.sin(Math.min(1, (q - 1) / 0.7) * Math.PI)) * 0.12 * r;
      floor = { x: px0, y };
      if (q >= 1 && q < 1.5) fx.push({ name: "impact", lt: (q - 1) * 0.3, x: px0, y: py0 + r * 1.55 }), fx.push({ name: "puff", lt: (q - 1) * 0.3, x: px0 - r, y: py0 + r * 1.5 });
    }
    bar = { held: !dc, floor };
  }
  // outfit "phonecall": the left hand holds a phone to his ear the whole time (every move / gesture plays with the right hand)
  // outfit "phone" (2026-11-17): the left hand holds a phone in front of his tummy, its back to the camera; during {scroll}
  // the thumb flicks up every 0.48 s (the hand lifts a little, tips back, the thumb pose shows on the up-stroke)
  const flick = act?.name === "scroll" ? Math.min(1, act.lt / 0.2, (act.dur - act.lt) / 0.3) * Math.pow(Math.max(0, Math.sin((act.lt / 0.48) * Math.PI * 2)), 2) : 0;
  // when the next scene drops the phone, the hand lowers it over 0.4 s (holdW) and only then lets go
  const scPrevOut = si > 0 ? full.scenes[si - 1]?.outfit : undefined, outPrev: string[] = si > 0 ? ((Array.isArray(scPrevOut) ? scPrevOut : scPrevOut?.[who]) ?? cfg.outfit ?? []) : [];
  const phoneLeft = !outNow.includes("phone") && outPrev.includes("phone") ? Math.min(1, (t - (scNow?.start ?? 0)) / 0.4) : 1;
  const holdPhone = outNow.includes("phone") || phoneLeft < 1;
  const holdL: Partial<Hand> | null = outNow.includes("phonecall") ? { x: 58, y: 176, a: 10, z: 0.34, pose: "fist" }
    : holdPhone ? { x: 168, y: 336 - 10 * flick, a: 4 - 14 * flick, z: 0.86, pose: flick > 0.5 ? "thumb" : "fist" } : null;
  const holdW = holdPhone && !outNow.includes("phone") ? 1 - ease(phoneLeft) : 1;
  if (waitFall) { vis = 0; dy = (py0 + 260) / (UNIT * Math.min(size, 1)); } // hidden, already up in the sky where the fall starts
  // companion: walks / runs on his path (steps from his own speed), turns toward where he goes, leans in when running,
  // tucks his legs in a jump. Only when no move of his own is playing (a cue wins)
  if (comp) {
    // a move fades the walk out and back in (they snapped when a spin / dance started or ended)
    const aw = act ? Math.max(0, Math.min(1, act.lt / 0.25, (act.dur - act.lt) / 0.3)) : 0, k = 1 - aw;
    if (walk === null) { walk = comp.walk; walkW = comp.ww * k; } else walkW = Math.max(walkW, comp.ww * k);
    lift = Math.max(lift, 1 + 1.2 * comp.run * k);
    const face = Math.max(-1, Math.min(1, comp.vx / 280));
    ry += face * 0.75 * comp.ww * k;
    dy += Math.abs(Math.sin(comp.walk)) * (0.09 + 0.06 * comp.run) * comp.ww * k; rz += Math.sin(comp.walk) * 0.05 * comp.ww * k; rx += 0.13 * comp.run * k;
    if (comp.air > 1) tuck = Math.max(tuck, Math.min(0.6, comp.air / 500));
  }
  // a scene with "fly": false and a far place: he jogs there (steps from the ground covered, a forward lean, turned
  // toward where he goes) and the steps ease out as he arrives, so he stops on the spot. A move of his own wins
  if (far && scNow && scNow.fly === false && si > 0 && !pin && !comp && !act && mk < 1) {
    const ww = Math.max(0, Math.min(1, (t - scNow.start) / 0.12, (1 - mk) / 0.15));
    walk = ((Math.hypot(to.x - from.x, to.y - from.y) / UNIT) * mk) / (W2 ? 1.5 : 0.34) * Math.PI; walkW = ww; lift = Math.max(lift, 1.8);
    ry += Math.sign(to.x - from.x) * 0.6 * ww;
    if (W2) { const g = gait(walk, 1); stride = 1.9; dy += g.dy * ww; rz += g.rz * ww; rx += g.rx * ww; crouch += g.crouch * ww; }
    else { dy += Math.abs(Math.sin(walk)) * 0.12 * ww; rz += Math.sin(walk) * 0.05 * ww; rx += 0.12 * ww; }
  }
  // eyes first, then the body (Clawd: notice -> think -> act). Before a flight to a far place he looks where he is
  // going (last 0.4 s of the scene) and crouches for take-off (last 0.14 s). Before a jump he glances up.
  const nxt = full.scenes[si + 1];
  if (nxt && scNow && !pin) {
    const toN = toPlace(placeOf(si + 1)), leftS = scNow.end - t;
    const farN = Math.hypot(toN.x - to.x, toN.y - to.y) > 150 || Math.abs(toN.s - to.s) > 0.4;
    // no take-off crouch / look-ahead before a camera cut: he doesn't fly there, he is just there (or gone) after the cut
    const cutN = !legacyOf(cfg) && (nxt.seam === "cut" || full.seam === false) && (placeOf(si + 1) === "off" || (!!nxt.footage?.src && nxt.footage.src !== scNow.footage?.src));
    const fallN = (view.scenes[si + 1]?.cues ?? []).some((c) => c.name === "faceplant" || c.name === "crash");
    if (farN && !cutN && (nxt.fly !== false || W2) && !fallN && leftS < 0.4 && leftS > 0) {
      const g = ease(Math.min(1, (0.4 - leftS) / 0.15));
      glance = { x: eye0.x * (1 - g) + Math.sign(toN.x - to.x) * 7 * g, y: eye0.y * (1 - g) + Math.max(-7, Math.min(7, (toN.y - to.y) / 60)) * g };
      const cr = Math.max(0, 1 - leftS / 0.14);
      crouch += 0.1 * Math.sin(cr * Math.PI / 2); asy *= 1 - 0.08 * cr; asx *= 1 + 0.06 * cr;
    }
  }
  // ...springs up out of the crouch as the flight starts, and keeps looking that way, then lets go
  const jogOn = W2 && far && !!scNow && scNow.fly === false && si > 0 && !pin && !comp;
  if ((flyOn || jogOn) && scNow && t - scNow.start < 0.14) { const u = 1 - (t - scNow.start) / 0.14; crouch += 0.1 * u * u; asy *= 1 - 0.08 * u * u; asx *= 1 + 0.06 * u * u; }
  if (W2 && flyOn && scNow) {
    const la = t - scNow.start - (flyCfg?.dur ?? 0.8);
    if (la > -0.08 && la < 0.5) { const u = la < 0 ? (la + 0.08) / 0.08 : Math.exp(-la * 9) * Math.cos(la * 9); crouch += 0.2 * Math.max(0, u); asy *= 1 - 0.09 * u; asx *= 1 + 0.06 * u; }
  }
  if ((flyOn || jogOn) && scNow && t - scNow.start < 0.45) {
    const g = 1 - ease(Math.min(1, (t - scNow.start) / 0.45));
    glance = { x: eye0.x * (1 - g) + Math.sign(to.x - from.x) * 7 * g, y: eye0.y * (1 - g) + Math.max(-7, Math.min(7, (to.y - from.y) / 60)) * g };
  }
  // {eyeroll}: the pupils go up and across and come back
  if (act?.name === "eyeroll") {
    const a = Math.min(1, act.lt / 0.7) * Math.PI, w = Math.min(1, act.lt / 0.15, (act.dur - act.lt) / 0.3);
    glance = { x: eye0.x * (1 - w) - 8 * Math.cos(a) * w, y: eye0.y * (1 - w) - 9 * Math.sin(Math.min(1, act.lt / 0.35) * Math.PI / 2) * w };
  }
  for (const sc of view.scenes) for (const c of sc.cues ?? []) {
    const ahead = c.t - t;
    if (W2 && (c.name === "hop" || c.name === "squat") && ahead > 0 && ahead < 0.35) { const g = ease(Math.min(1, (0.35 - ahead) / 0.12)); glance = { x: eye0.x * (1 - g), y: eye0.y * (1 - g) + 6 * g }; }
    if (W2 && (c.name === "hop" || c.name === "squat") && ahead <= 0 && ahead > -0.25) { const g = 1 - ease(-ahead / 0.25); glance = { x: eye0.x * (1 - g), y: eye0.y * (1 - g) + 6 * g }; }
    if ((c.name === "jump" || c.name === "flip" || c.name === "toss") && ahead <= 0 && ahead > -0.35) { const g = 1 - ease(-ahead / 0.35); glance = { x: eye0.x * (1 - g), y: eye0.y * (1 - g) - 7 * g }; }
    if ((c.name === "jump" || c.name === "flip" || c.name === "toss") && ahead > 0 && ahead < 0.3) { const g = ease(Math.min(1, (0.3 - ahead) / 0.12)); glance = { x: eye0.x * (1 - g), y: eye0.y * (1 - g) - 7 * g }; }
  }
  const sx = (1 + (drop ? 0.18 : 0.1) * land) * P.tada * asx, sy = (1 - (drop ? 0.16 : 0.09) * land) * P.tada * asy;
  const yaw = baseYaw + Math.sin(t * 0.9 + 1.7 * seed) * 0.08 + (flyOn ? mk * Math.PI * 2 : 0) + spin + P.flipAngle + ry;
  // moves are in "coin sizes" but capped, so a big coin (center / zoom) stays on screen when it jumps or rolls
  const mv = Math.min(size, 1);
  // seated (cast "seated" / scene "seated"): he sits where he is, legs dangling, and every move / gesture plays on top
  // (unlike the {sit} cue, which ends when the next move starts). A scene can stand him up: "seated": {"mr": false}
  const seatedAt = (i: number) => { const v = full.scenes[i]?.seated; return !!((typeof v === "object" && v !== null ? v[who] : v) ?? cfg.seated); };
  // how far the body comes down in this seated run: only when he sat down in the place where he was standing. Seated
  // from the first scene, or after flying / a cut to the seat = he is placed on it already (older scripts), no drop
  const sitDrop = (last: number) => { let k = last; while (k > 0 && seatedAt(k - 1)) k--; return k > 0 && placeOf(k - 1) === placeOf(k) ? 0.26 : 0; };
  const seatSc = scNow?.seated, seatedNow = (typeof seatSc === "object" ? seatSc[who] : seatSc) ?? cfg.seated;
  if (ride) { // scene "ride": sits as it lands on the part (seat 0..1) and stays seated while it rides
    if (ride.seat > 0 && !flying) { sit = Math.max(sit, ride.seat); walk = null; }
  } else if (seatedNow && !flying) {
    // sitting down after standing (he just landed): settles in 0.3 s instead of snapping in one frame
    const seatPrev = si > 0 ? full.scenes[si - 1]?.seated : undefined, wasSeated = ((typeof seatPrev === "object" ? seatPrev?.[who] : seatPrev) ?? cfg.seated) || !!rideOf(full, si - 1, who);
    sit = Math.max(sit, wasSeated ? 1 : ease(Math.min(1, (t - (scNow?.start ?? 0)) / 0.3)));
    walk = null;
    if (W2 && !cfg.dangle) { // the knees open, he leans back a little; sitting down where he stood, the body comes down with one small bounce
      const q = wasSeated ? 1 : Math.min(1, (t - (scNow?.start ?? 0)) / 0.45), e = ease(q), D = sitDrop(si);
      dy -= D * e + (wasSeated || !D ? 0 : Math.sin(q * Math.PI) * 0.08); rx -= 0.1 * e; sitWide = e;
    }
  } else if (W2 && !cfg.dangle && si > 0 && !flying) { // getting up: the same way back, in 0.35 s
    if (seatedAt(si - 1) && !far) { const u = 1 - ease(Math.min(1, (t - (scNow?.start ?? 0)) / 0.35)); if (u > 0) { sit = Math.max(sit, u); dy -= sitDrop(si - 1) * u; rx -= 0.1 * u; sitWide = u; } }
  }
  const idle = !act && !flying ? P.shift : 0; // idle weight shift (coinPose), off during moves and flights
  // the leg press: "ride" goes up and down with the sled (his place = where he sits at its low end); "push" lies back, feet on the sled
  const press = cfg.press, sledNow = press ? sledAt(press, t) : null, low = press ? xy(press.low) : null;
  const rideX = press?.role === "ride" ? (sledNow!.x - low!.x) / UNIT : 0, rideY = press?.role === "ride" ? -(sledNow!.y - low!.y) / UNIT : 0;
  const X = (px0 - W / 2) / UNIT + dx * mv + idle * mv + rideX, Y = -(py0 - H / 2) / UNIT + dropY + dy * mv + rideY;
  let legRz = 0;
  if (press?.role === "push") {
    legRz = press.lean ?? PUSH_LEAN; rz += legRz;
    // the feet on the sled, in the legs' own space (origin = his ground point, turned with him, in his size)
    const c = Math.cos(-legRz), sn = Math.sin(-legRz), wx = ((sledNow!.x - W / 2) / UNIT - X) / size, wy = (-(sledNow!.y + 40 - H / 2) / UNIT - Y) / size;
    const fx0 = c * wx - sn * wy, fy0 = sn * wx + c * wy + PRESS_PIVOT, hipY = 0.62, dx2 = fx0, dy2 = fy0 - hipY, d = Math.hypot(dx2, dy2) || 1, leg = press.leg ?? 2.9;
    const bend = Math.sqrt(Math.max(0, (leg * leg - d * d) / 4)), nx = -dy2 / d, ny = dx2 / d; // the knees fold to one side
    const knee = (o: number): [number, number, number] => [dx2 / 2 + nx * bend + o, hipY + dy2 / 2 + ny * bend, 0.1];
    legs = { L: { k: knee(-0.14), f: [fx0 - 0.17, fy0, 0.04] }, R: { k: knee(0.14), f: [fx0 + 0.17, fy0, 0.1] } };
    legW = 1;
  }
  // contact shadow: the ground under him (without the flight arc) and how high above it he is
  const groundY = comp ? comp.y : (pin ? to.y : from.y + (to.y - from.y) * mk) + r * 1.55;
  // eyes on the person (lookTarget): pupils toward the point, up to ~7 px
  const tg = lookTarget(scNow);
  // scene "watch": ["x,y", ...] (reel px): while he is silent his eyes dart to one of these points, a new one every
  // ~1.6 s (a dart is 1-2 frames: still eyes read as dead, a slow drift reads as floaty)
  // timed points "x,y,t" (t = s from the scene start) win even while he talks: from t his eyes go there (x < 0 = back to the camera)
  const wTimed = scNow?.watch?.length && scNow.watch[0].split(",").length === 3 ? scNow.watch.map((s) => s.split(",").map(Number)).filter((p) => p[2] <= t - scNow.start).pop() ?? null : null;
  const wPts = scNow?.watch?.length && !P.speaking && !(scNow.watch[0].split(",").length === 3) ? scNow.watch : null;
  const wPick = wTimed ? (wTimed[0] < 0 ? null : wTimed) : wPts ? wPts[Math.floor(hash(Math.floor((t - scNow!.start) / 1.6 + 3.7 * seed) * 7 + 5) * wPts.length) % wPts.length].split(",").map(Number) : null;
  const gaze = glance ?? (wPick ? { x: Math.max(-1, Math.min(1, (wPick[0] - px0) / 260)) * 7, y: Math.max(-1, Math.min(1, (wPick[1] - (py0 - r * 0.3)) / 360)) * 7 } : aim ? { x: aim.gx, y: aim.gy } : tg ?{ x: Math.max(-1, Math.min(1, (tg.x - px0) / 260)) * 7, y: Math.max(-1, Math.min(1, (tg.y - (py0 - r * 0.3)) / 360)) * 7 } : null);
  // screen position of the coin's centre (for the FX layer)
  const px = W / 2 + X * UNIT, py = H / 2 - Y * UNIT;
  return { visible: te >= 0 && !goneOff, legRz, bar, holdL, holdW, holdPhone, cutAt: camCut ? scNow.start : -1, groundY, flying, gaze, X, Y, z: z0 + 2.5 * flying, size, sx, sy, vis, tuck, walk, yaw, rx, rz, eOut, px, py, r, fx, hands, handsW, hf, crouch, knee, lift, spread, sit, sitWide, splash, stride, peekClip, prop, legs, legW, walkW: walk === null ? 0 : walkW, act: act?.name ?? null, actLt: act?.lt ?? 0, actDur: act?.dur ?? 0, drag: { x: 0, y: 0 } as { x: number; y: number }, own: comp ? { vx: comp.vx / UNIT, vy: (-comp.vy + comp.airV) / UNIT } : null, sign: act?.name === "sign" ? full.scenes[si]?.sign ?? "" : null, signW: act?.name === "sign" ? Math.max(0, Math.min(1, act.lt / 0.3, (act.dur - act.lt) / 0.3)) : 0 };
};
type RigS = ReturnType<typeof rigState>;

// ---- the leg press (cast "press"): a sled on a slanted rail; the "push" coin lies on the bench with his feet on it, the "ride" coin sits on it
const xy = (v: string) => { const [x, y] = v.split(",").map(Number); return { x, y }; };
const sledAt = (p: NonNullable<CastMember["press"]>, t: number) => {
  const a = xy(p.low), b = xy(p.high), q = (1 - Math.cos((t * 2 * Math.PI) / (p.period ?? 3.4))) / 2;
  return { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q };
};
const PRESS_PIVOT = 1.6; // the legs turn around his centre, this far above their ground
const PUSH_LEAN = -1.12; // the lying coin: radians, his head toward the right of the frame
const LegPress: React.FC<{ p: NonNullable<CastMember["press"]>; t: number; ramp: THREE.Texture }> = ({ p, t, ramp }) => {
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const line = "#0E0F12", steel = "#8A9099", dark = "#24272E", toW = (v: { x: number; y: number }) => [(v.x - W / 2) / UNIT, -(v.y - H / 2) / UNIT] as const;
  // a bar between two points of the frame (px), at depth z
  const bar = (key: string, from: { x: number; y: number }, to: { x: number; y: number }, th: number, z: number, color: string, depth = th) => {
    const [x0, y0] = toW(from), [x1, y1] = toW(to), len = Math.hypot(x1 - x0, y1 - y0);
    return <group key={key} position={[(x0 + x1) / 2, (y0 + y1) / 2, z]} rotation={[0, 0, Math.atan2(y1 - y0, x1 - x0)]} scale={[len, th, depth]}><Toon geo={box} color={color} line={line} ramp={ramp} grow={1.06} /></group>;
  };
  const a = xy(p.low), b = xy(p.high), n = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / n, uy = (b.y - a.y) / n;
  const along = (o: { x: number; y: number }, d: number) => ({ x: o.x + ux * d, y: o.y + uy * d });
  const sled = sledAt(p, t), bn = xy(p.bench), floorY = p.floor ?? 1700, top = along(a, 520), end = along(a, -370);
  return (
    <group>
      {bar("r1", top, end, 0.17, -0.75, steel)}
      {bar("r2", top, end, 0.17, -0.35, steel)}
      {bar("p1", end, { x: end.x, y: floorY }, 0.22, -0.55, dark, 0.5)}
      {bar("p2", top, { x: top.x, y: floorY }, 0.22, -0.55, dark, 0.5)}
      {/* the sled: rides the rail; a plate across it takes the feet below and the rider above */}
      {bar("s1", along(sled, -90), along(sled, 90), 0.16, -0.2, "#D6FF3C", 0.7)}
      {bar("s2", { x: sled.x - 130, y: sled.y + 44 }, { x: sled.x + 130, y: sled.y - 44 }, 0.12, -0.1, dark, 0.9)}
      {/* the bench */}
      {bar("b1", { x: bn.x - 40, y: bn.y + 60 }, { x: bn.x + 500, y: bn.y - 110 }, 0.34, -0.5, dark, 0.9)}
      {bar("b2", { x: bn.x + 60, y: bn.y + 60 }, { x: bn.x + 60, y: floorY }, 0.18, -0.55, steel, 0.4)}
      {bar("b3", { x: bn.x + 400, y: bn.y - 60 }, { x: bn.x + 400, y: floorY }, 0.18, -0.55, steel, 0.4)}
    </group>
  );
};

// scene "sign" can be a picture (a path under public/, 1024x440): loaded once, before the first frame
const SIGN_IMAGES = new Map<string, HTMLImageElement>();
const loadSignImage = (src?: string) => new Promise<void>((done) => {
  if (!src || !/\.(png|jpe?g|webp)$/i.test(src) || SIGN_IMAGES.has(src)) return done();
  const im = new Image();
  im.onload = () => { SIGN_IMAGES.set(src, im); done(); };
  im.onerror = () => { console.warn("sign image not found: " + src); done(); };
  im.src = staticFile(src);
});

// ===================================================================================================================
// One coin (3D)
// ===================================================================================================================
const CoinRig: React.FC<{ t: number; cfg: PresenterConfig; who: string; P: ReturnType<typeof coinPose>; S: RigS; view: Timeline; duo: boolean; full: Timeline }> = ({ t, cfg, who, P, S, view, duo, full }) => {
  const variant = kindFor(who, cfg);
  const V = { ...VARIANTS[variant], ...(cfg.lashes !== undefined ? { lashes: cfg.lashes } : {}), ...(cfg.ponytail !== undefined ? { ponytail: cfg.ponytail } : {}) };
  const eyeK = cfg.eyes ?? 1;
  const coin = cfg.colors?.coin ?? V.coin;
  const ink = cfg.colors?.ink ?? "#0E0F12";
  const white = cfg.colors?.glove ?? "#F4F5F7";
  const line = ink; // dark cartoon outline, like the rubber-hose classics
  const rimColor = useMemo(() => "#" + new THREE.Color(coin).lerp(new THREE.Color("#ffffff"), 0.18).getHexString(), [coin]);
  const rimStyle = cfg.rim ?? "line";
  const darkRim = "#24272E";
  const lidColor = useMemo(() => "#" + new THREE.Color(coin).lerp(new THREE.Color("#000000"), 0.14).getHexString(), [coin]);
  const { F } = P;
  // duo: the listener looks at the one who speaks
  const curScene = full.scenes.find((sc) => t >= sc.start && t < sc.end);
  const listening = duo && !!curScene?.speaker && curScene.speaker !== who;
  // (a cast coin's eyes come from its own gaze in rigState: S.gaze)
  const listenLook = !listening ? 0 : legacyOf(cfg) ? (who === "mr" ? 7 : -7) : typeof cfg.turn === "number"
    ? 7 * Math.sign(toPlace(placeName(curScene, curScene!.speaker!, duo, full)).x - toPlace(placeName(curScene, who, duo, full)).x) : 0;
  // gesture cue (clap, cross, shrug...) on top of the automatic gestures; actions (dance, high five) on top of both
  const g = cueAt(view, t, GESTURE_CUES);
  const scOutfit = curScene?.outfit;
  const outfit: string[] = (Array.isArray(scOutfit) ? scOutfit : scOutfit?.[who]) ?? cfg.outfit ?? [];
  const wear = (k: string) => outfit.includes(k);
  // the "jersey" outfit's kit: scene kit > presenter kit, each either one kit or one per coin ({ mr: {...}, captain: {...} })
  const kitOf = (k?: KitSpec): Kit | undefined => (!k ? undefined : "color" in k || "number" in k || "captain" in k ? (k as Kit) : (k as Record<string, Kit>)[who]);
  const kit: Kit = { color: "#F4F5F7", ...(kitOf(cfg.kit) ?? {}), ...(kitOf(curScene?.kit) ?? {}) };
  // "muscles" outfit: a six-pack in place of the "+1", thicker arms and legs, bigger gloves (the ghashim gym friend)
  const buff = wear("muscles") ? 1 : 0;
  // dumbbell size: scene "dumbbell" (per coin or one number) > cast "dumbbell" > 1
  const dbSc = curScene?.dumbbell, dbSize = (typeof dbSc === "object" ? dbSc[who] : dbSc) ?? cfg.dumbbell ?? 1;
  // outfit item "dumbbell": carried in the left hand while idle / walking / talking. Handed over the moment another coin's
  // {grab} takes it (its weight lands 0.5 s after the cue): from then on this coin's hand is empty
  const handed = full.scenes.some((sc) => (sc.cues ?? []).some((c) => {
    const [a, b] = c.name.includes(":") ? c.name.split(":") : [sc.speaker ?? "mr", c.name];
    return b === "grab" && a !== who && t >= c.t + 0.5;
  }));
  const carry = wear("dumbbell") && !handed;
  const gt = g ? gestureHands(g.name, g.lt) : null;

  const [fontsReady, setFontsReady] = useState(false);
  const [handle] = useState(() => delayRender("coin3d fonts"));
  useEffect(() => { Promise.all([loadFonts(), ...full.scenes.map((sc) => loadSignImage(sc.sign))]).then(() => setFontsReady(true)); }, [handle, full]);
  // the canvas draws only when the frame changes: draw once more with the fonts + sign pictures, then let Remotion take the frame
  const advance = useThree((st) => st.advance);
  useEffect(() => { if (fontsReady) { advance(performance.now()); continueRender(handle); } }, [fontsReady, advance, handle]);
  const ramp = useMemo(toonRamp, []);
  const geo = useMemo(() => {
    const lip = new THREE.CylinderGeometry(RIN, RIN, LIP, 96, 1, true); lip.rotateX(Math.PI / 2);
    const hull = new THREE.CylinderGeometry(1.02, 1.02, 2 * TOP, 96); hull.rotateX(Math.PI / 2);
    return {
      edge: reededEdge(), hull, lip,
      rim: new THREE.RingGeometry(RIN, 1, 96),
      field: new THREE.CircleGeometry(RIN, 96),
      shoe: new THREE.SphereGeometry(1, 20, 14),
      sole: new THREE.CylinderGeometry(1, 1, 1, 24),
      ball: new THREE.SphereGeometry(0.12, 16, 12),
    };
  }, []);

  const outfitGeo = useMemo(() => ({
    hoopA: new THREE.TorusGeometry(1.18, 0.055, 10, 60, Math.PI), hoopHull: new THREE.TorusGeometry(1.18, 0.08, 10, 120),
    band: new THREE.TorusGeometry(1.02, 0.085, 12, 64, Math.PI * 0.84),
    bandHull: new THREE.TorusGeometry(1.02, 0.11, 12, 64, Math.PI * 0.84),
    stripe: new THREE.TorusGeometry(1.02, 0.088, 12, 64, Math.PI * 0.84).scale(1, 1, 0.3),
    dome: new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    disc: new THREE.CylinderGeometry(1, 1, 1, 28),
    ball: new THREE.SphereGeometry(1, 12, 8),
    board: new THREE.PlaneGeometry(1, 1),
    box: new THREE.BoxGeometry(1, 1, 1),
  }), []);
  // ---- football jersey: the lower part of the coin's own outline (front, back and edge in one slab, a bit bigger
  // than the coin), cut by a scoop neck that is high at the sides where the arms come out and low in the middle,
  // under the mouth, so the face stays free. Collar line along the neck, sleeve caps on the shoulders. ----
  const jerseyGeo = useMemo(() => {
    const R = 1.04, D = TOP + 0.012, NECK = (x: number) => -0.66 + 0.362 * x * x; // meets the outline at y = -0.3
    const xe = Math.sqrt(R * R - 0.09), a0 = Math.atan2(-0.3, xe);
    const sh = new THREE.Shape();
    for (let i = 0; i <= 24; i++) { const x = -xe + (2 * xe * i) / 24; i ? sh.lineTo(x, NECK(x)) : sh.moveTo(x, NECK(x)); }
    sh.absarc(0, 0, R, a0, -Math.PI - a0, true);
    sh.closePath();
    const body = new THREE.ExtrudeGeometry(sh, { depth: 2 * D, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 2, curveSegments: 48 });
    body.translate(0, 0, -D);
    const zf = D + 0.018;
    const neck = (z: number) => Array.from({ length: 13 }, (_, i) => { const x = -xe * 0.97 + (2 * xe * 0.97 * i) / 12; return new THREE.Vector3(x, NECK(x) + 0.012, z); });
    return { body, zf, collarF: neck(zf + 0.012), collarB: neck(-zf - 0.012), plane: new THREE.PlaneGeometry(2, 2) };
  }, []);
  // the number, front and back: big, bold, white on a dark shirt / ink on a light one, always outlined in ink
  const kitNum = kit.number === undefined || kit.number === "" ? "" : String(kit.number).slice(0, 2);
  const kitLight = useMemo(() => { const c = new THREE.Color(kit.color ?? "#F4F5F7"); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.55; }, [kit.color]);
  const kitTrim = kitLight ? ink : "#F4F5F7";
  const numTex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d")!, k = 512 / 260; // canvas = the coin's 2 x 2 units = 260 face px
    if (kitNum) {
      g.setTransform(k, 0, 0, k, 256 - 190 * k, 256 - 222 * k);
      g.font = `900 ${kitNum.length > 1 ? 50 : 54}px ${fontsReady ? FONT.brand : "sans-serif"}`;
      g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
      g.lineWidth = 7; g.strokeStyle = ink; g.strokeText(kitNum, 190, 335);
      g.fillStyle = kitLight ? ink : "#FFFFFF"; g.fillText(kitNum, 190, 335);
    }
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    return tx;
  }, [kitNum, kitLight, fontsReady, ink]);
  const signTex = useMemo(() => { const c = document.createElement("canvas"); c.width = 1024; c.height = 440; const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return { c, tx }; }, []);
  if (S.sign !== null) {
    const sg = signTex.c.getContext("2d")!;
    sg.fillStyle = coin; sg.fillRect(0, 0, 1024, 440);
    sg.fillStyle = ink; sg.textAlign = "center"; sg.textBaseline = "middle";
    const txt = S.sign || "TAMRINA";
    const signImg = SIGN_IMAGES.get(S.sign ?? "");
    if (signImg?.naturalWidth) { sg.drawImage(signImg, 0, 0, 1024, 440); signTex.tx.needsUpdate = true; } else {
    let fs = 150; sg.font = `800 ${fs}px ${fontsReady ? FONT.arabicEmph : "sans-serif"}`;
    while (sg.measureText(txt).width > 920 && fs > 50) { fs -= 8; sg.font = `800 ${fs}px ${fontsReady ? FONT.arabicEmph : "sans-serif"}`; }
    sg.direction = /[\u0600-\u06FF]/.test(txt) ? "rtl" : "ltr";
    sg.fillText(txt, 512, 230);
    signTex.tx.needsUpdate = true;
    }
  }
  // ---- the face (front) and the "$" (back), redrawn every frame onto canvas textures ----
  const front = useMemo(() => { const c = document.createElement("canvas"); c.width = c.height = 512; const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return { c, tx }; }, []);
  const back = useMemo(() => { const c = document.createElement("canvas"); c.width = c.height = 512; const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return { c, tx }; }, []);
  {
    const k = 512 / 224, ox = 256 - 190 * k, oy = 256 - 222 * k, brand = fontsReady ? FONT.brand : "sans-serif";
    const c = front.c.getContext("2d")!;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 512, 512);
    c.setTransform(k, 0, 0, k, ox, oy);
    c.lineCap = "round"; c.lineJoin = "round";
    // colour batch 3: volume on the flat face without changing its colour. A warm light from the key side (top-left),
    // a cool green shade toward the bottom-right and a soft occlusion inside the rim (shadows go cooler, not muddy)
    if (cfg.look?.volume !== false) {
      const lit = c.createRadialGradient(148, 162, 4, 148, 162, 92);
      lit.addColorStop(0, "rgba(255,255,236,0.13)"); lit.addColorStop(1, "rgba(255,255,236,0)"); // a hint: the lime must not wash out in a close-up
      const shade = c.createRadialGradient(236, 292, 6, 236, 292, 150);
      const sh = variant === "mrs" ? "92,30,120" : "16,74,58"; // lime shades toward teal, pink toward violet
      shade.addColorStop(0, `rgba(${sh},0.17)`); shade.addColorStop(1, `rgba(${sh},0)`);
      const ao = c.createRadialGradient(190, 222, 88, 190, 222, 113);
      ao.addColorStop(0, "rgba(10,40,34,0)"); ao.addColorStop(1, "rgba(10,40,34,0.16)");
      for (const g of [lit, shade, ao]) { c.fillStyle = g; c.beginPath(); c.arc(190, 222, 113, 0, Math.PI * 2); c.fill(); }
      // a faint warmth in the cheeks all the time (alive, not painted): the mood blush adds on top
      c.fillStyle = "rgba(255,120,120,0.09)"; [128, 252].forEach((x) => { c.beginPath(); c.ellipse(x, 252, 20, 11, 0, 0, Math.PI * 2); c.fill(); });
    }
    denticles(c);
    c.font = `800 30px ${brand}`; c.textAlign = "center";
    if (wear("muscles")) drawRelief(c, ink, (fill) => { // a six-pack (3 x 2 embossed blocks) in place of the "+1"
      c.strokeStyle = fill; c.lineWidth = 3.4;
      for (let row = 0; row < 3; row++) for (const sx of [-1, 1]) {
        const w = 24 - row * 2, h = 15, x = 190 + sx * 14 - (sx > 0 ? 0 : w), y = 284 + row * 18;
        c.beginPath(); c.roundRect(x, y, w, h, 6); c.stroke();
      }
    });
    else if (!wear("jersey")) drawRelief(c, ink, (fill) => { c.fillStyle = fill; c.fillText("+1", 190, 314); }); // the kit number replaces the "+1"
    const face = (cfg.brows ?? variant) === "mrs"
      ? { brows: [[136, 166, 178, 166], [202, 166, 244, 166]], bw: 7, mouth: "M142 250 Q190 308 238 250 Z" }
      : { brows: [[134, 170, 176, 170], [204, 170, 246, 170]], bw: 8, mouth: "M140 250 Q190 310 240 250 Z" };
    // puffed cheeks (holding the breath)
    if (F.puff > 0.01) {
      [[112, -1], [268, 1]].forEach(([x, d]) => {
        c.fillStyle = `rgba(255,120,150,${0.35 * F.puff})`; c.beginPath(); c.arc(x, 262, 24 * F.puff, 0, Math.PI * 2); c.fill();
        c.strokeStyle = ink; c.lineWidth = 3.5; c.beginPath(); c.arc(x - d * 4, 262, 24 * F.puff, d > 0 ? -0.9 : Math.PI - 0.6, d > 0 ? 0.6 : Math.PI + 0.9); c.stroke();
      });
    }
    // blush under the eyes
    if (F.blush > 0.01) { c.fillStyle = `rgba(255,105,140,${0.5 * F.blush})`; [128, 252].forEach((x) => { c.beginPath(); c.ellipse(x, 250, 17, 9, 0, 0, Math.PI * 2); c.fill(); }); }
    const lookX = (S.gaze ? S.gaze.x : P.dart) + P.lookX + listenLook + (gt?.lookX ?? 0) * (g?.w ?? 0), lookY = P.lookY + F.down + (S.gaze?.y ?? 0) + (gt?.lookY ?? 0) * (g?.w ?? 0);
    const shut = (gt?.shut ?? 0) * (g?.w ?? 0);
    [158, 222].forEach((cx, i) => {
      const happyEye = Math.max(F.happy, i === 1 ? F.wink : 0);
      c.save();
      c.globalAlpha = 1 - happyEye;
      c.translate(cx, 206); c.scale(F.eye * eyeK, F.eyeY * eyeK); c.translate(-cx, -206);
      const eye = new Path2D(); eye.ellipse(cx, 206, 22, 27, 0, 0, Math.PI * 2);
      c.fillStyle = white; c.fill(eye);
      c.save(); c.clip(eye);
      const px = cx + lookX, py = 210 + lookY;
      if (F.heart > 0.5) {
        c.fillStyle = "#E8354A"; c.beginPath();
        const hs = 1 + 0.18 * Math.abs(Math.sin(t * 6)); // heart beat
        c.translate(px, py); c.scale(hs, hs); c.translate(-px, -py);
        c.moveTo(px, py + 9); c.bezierCurveTo(px - 16, py - 2, px - 9, py - 15, px, py - 6); c.bezierCurveTo(px + 9, py - 15, px + 16, py - 2, px, py + 9); c.fill();
      } else if (F.star > 0.5) {
        c.fillStyle = "#F5B82E"; c.beginPath();
        for (let s = 0; s < 10; s++) { const a = -Math.PI / 2 + (s * Math.PI) / 5, rr = s % 2 ? 5 : 13; c.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); }
        c.closePath(); c.fill();
      } else if (F.spiral > 0.5) {
        c.strokeStyle = ink; c.lineWidth = 3; c.beginPath();
        for (let s = 0; s < 40; s++) { const a = s * 0.45 + t * 6, rr = s * 0.42; c.lineTo(cx + Math.cos(a) * rr, 208 + Math.sin(a) * rr); }
        c.stroke();
      } else {
        c.beginPath(); c.arc(px, py, F.pupil, 0, Math.PI * 2); c.fillStyle = ink; c.fill();
        c.beginPath(); c.arc(px - 4, py - 5, 3.5, 0, Math.PI * 2); c.fillStyle = white; c.fill();
        // a second, smaller catch-light low on the other side: eyes look wet / alive instead of painted
        c.beginPath(); c.arc(px + 4, py + 4, 1.6 + 0.8 * F.sparkle, 0, Math.PI * 2); c.globalAlpha *= 0.85; c.fill(); c.globalAlpha /= 0.85;
      }
      // eyelid comes DOWN (blink, sleepy, smug, sad...) instead of squashing the eye
      const lid = Math.max(P.blink, 0.12 * F.rest, F.lid, shut);
      if (lid > 0.01) {
        const ly = 177 + 58 * lid;
        c.fillStyle = lidColor;
        c.beginPath(); c.moveTo(cx - 26, ly - 2); c.quadraticCurveTo(cx, ly + 7, cx + 26, ly - 2); c.lineTo(cx + 26, 170); c.lineTo(cx - 26, 170); c.fill();
        c.strokeStyle = ink; c.lineWidth = 4; c.beginPath(); c.moveTo(cx - 26, ly - 2); c.quadraticCurveTo(cx, ly + 7, cx + 26, ly - 2); c.stroke();
      }
      // smiling eyes: the cheek pushes the lower lid up
      if (F.cheek > 0.01) {
        const cy = 236 - 16 * F.cheek;
        c.fillStyle = lidColor;
        c.beginPath(); c.moveTo(cx - 26, cy + 4); c.quadraticCurveTo(cx, cy - 6, cx + 26, cy + 4); c.lineTo(cx + 26, 240); c.lineTo(cx - 26, 240); c.fill();
        c.strokeStyle = ink; c.lineWidth = 3.5; c.beginPath(); c.moveTo(cx - 24, cy + 4); c.quadraticCurveTo(cx, cy - 6, cx + 24, cy + 4); c.stroke();
      }
      c.restore();
      c.lineWidth = 4; c.strokeStyle = ink; c.stroke(eye);
      if (V.lashes) { c.lineWidth = 4; c.stroke(new Path2D(i === 0 ? "M138 186 L127 178 M142 179 L133 169 M149 174 L144 162" : "M242 186 L253 178 M238 179 L247 169 M231 174 L236 162")); }
      c.restore();
      if (happyEye > 0.01) {
        c.save(); c.globalAlpha = happyEye; c.strokeStyle = ink; c.lineWidth = 8;
        c.stroke(new Path2D(`M${cx - 21} 216 Q${cx} 186 ${cx + 21} 216`));
        if (V.lashes) { c.lineWidth = 4; c.stroke(new Path2D(i === 0 ? "M139 205 L128 199" : "M241 205 L252 199")); }
        c.restore();
      }
      // tears (cry)
      if (F.tears > 0.01) {
        for (let d = 0; d < 2; d++) {
          const ph = (t * 1.3 + i * 0.37 + d * 0.5) % 1;
          c.fillStyle = `rgba(124,200,255,${F.tears * (1 - ph * 0.6)})`;
          c.beginPath(); c.ellipse(cx + (i ? 12 : -12), 236 + ph * 92, 5, 8, 0, 0, Math.PI * 2); c.fill();
        }
      }
    });
    if (wear("sunglasses") && variant === "mrs") {
      // heart-shaped shades, dark pink, with a shine
      [158, 222].forEach((x) => {
        const hp = new Path2D(); const y = 206, s2 = 1.25;
        hp.moveTo(x, y + 22 * s2); hp.bezierCurveTo(x - 30 * s2, y + 2, x - 22 * s2, y - 24 * s2, x, y - 10 * s2); hp.bezierCurveTo(x + 22 * s2, y - 24 * s2, x + 30 * s2, y + 2, x, y + 22 * s2);
        c.fillStyle = "#3A0A22"; c.fill(hp); c.strokeStyle = "#FF8DC7"; c.lineWidth = 4; c.stroke(hp);
        c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 16, 198); c.lineTo(x - 8, 208); c.stroke();
      });
      c.fillStyle = "#FF8DC7"; c.fillRect(186, 196, 8, 5);
    } else if (wear("sunglasses")) {
      c.fillStyle = "#0E0F12";
      [158, 222].forEach((x) => { const gl = new Path2D(); gl.roundRect(x - 30, 186, 60, 42, [8, 8, 20, 20]); c.fill(gl); });
      c.fillRect(186, 194, 8, 6);
      c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 4;
      [158, 222].forEach((x) => { c.beginPath(); c.moveTo(x - 18, 196); c.lineTo(x - 6, 208); c.stroke(); });
    }
    // brows: lifted on stress, tilted by the mood (inner ends up = sad / worried, down = angry)
    c.strokeStyle = ink; c.lineWidth = face.bw;
    face.brows.forEach(([x1, y1, x2, y2], i) => {
      const dy = -P.browLift - F.brow - (i === 0 ? F.browTilt : 0) - (gt?.lift ?? 0) * (g?.w ?? 0) * 8;
      const inner = -F.browIn * 9, outer = F.browIn * 3;
      const [d1, d2] = i === 0 ? [outer, inner] : [inner, outer];
      // a real brow is an arch, not a ruler line: it rounds up when he is open / surprised, flattens when he
      // frowns, and the two never match exactly (the right one lifts a touch more when he stresses a word)
      const arch = 4 + 0.22 * Math.max(0, F.brow + P.browLift) - 3.5 * Math.max(0, -F.browIn) - 1.5 * Math.max(0, F.browIn);
      const asym = i === 1 ? -1.5 * P.browLift / 7 : 0;
      c.beginPath(); c.moveTo(x1, y1 + dy + d1 + asym); c.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + dy + (d1 + d2) / 2 - arch * 2 + asym, x2, y2 + dy + d2 + asym); c.stroke();
    });
    // cartoon mouth: dark inside, tongue, top teeth when it opens wide; frown and side smile for the moods
    const inside = (shape: Path2D, teethY: number, tongueY: number) => {
      c.fillStyle = "#2A0B10"; c.fill(shape);
      c.save(); c.clip(shape);
      c.fillStyle = "#E8566C"; c.beginPath(); c.ellipse(190, tongueY + 10 * F.tongue, 30, 16 + 8 * F.tongue, 0, 0, Math.PI * 2); c.fill();
      if (P.mouthRaw > 0.3) { c.globalAlpha *= Math.min(1, (P.mouthRaw - 0.3) / 0.2); c.fillStyle = white; c.fillRect(140, teethY, 100, 9); }
      c.restore();
    };
    c.save();
    if (F.smirk > 0.01) { c.translate(190, 262); c.transform(1, -0.2 * F.smirk, 0, 1, 10 * F.smirk, 0); c.translate(-190, -262); }
    if (F.puff > 0.5 && P.oMouth < 0.5) {
      // lips pressed, holding the breath
      c.fillStyle = "#2A0B10"; c.beginPath(); c.ellipse(190, 262, 11, 6, 0, 0, Math.PI * 2); c.fill();
    } else if (F.grit > 0.5 && P.oMouth < 0.5) {
      // gritted teeth (angry / nervous): a wide flat mouth full of teeth, opening a little with the voice
      const hgt = 16 + 14 * P.mouthRaw, wdt = 92 * F.mouthW;
      const gm = new Path2D(); gm.roundRect(190 - wdt / 2, 256 - hgt / 2, wdt, hgt, 9);
      c.fillStyle = "#2A0B10"; c.fill(gm);
      c.save(); c.clip(gm);
      c.fillStyle = white; c.fillRect(190 - wdt / 2, 256 - hgt / 2, wdt, hgt * 0.42); c.fillRect(190 - wdt / 2, 256 + hgt * 0.08, wdt, hgt * 0.42);
      c.strokeStyle = "#2A0B10"; c.lineWidth = 2.5;
      for (let x = 190 - wdt / 2 + wdt / 6; x < 190 + wdt / 2 - 2; x += wdt / 6) { c.beginPath(); c.moveTo(x, 256 - hgt / 2); c.lineTo(x, 256 + hgt / 2); c.stroke(); }
      c.restore();
      c.strokeStyle = ink; c.lineWidth = 4; c.stroke(gm);
    } else if (P.oMouth >= 0.5) {
      const o = new Path2D(); o.ellipse(190, 266, 19 * P.mouthWV, 10 + 16 * P.mouthRaw, 0, 0, Math.PI * 2);
      inside(o, 254, 280);
    } else if (F.frown > 0.5) {
      c.translate(190, 272); c.scale(F.mouthW * 0.8 * P.mouthWV, -Math.max(0.22, P.mouth * 0.75)); c.translate(-190, -250);
      inside(new Path2D(face.mouth), 249, 284);
    } else {
      c.translate(190, 250); c.scale(F.mouthW * P.mouthWV * (1 - 0.15 * F.smirk), Math.max(0.03, P.mouth)); c.translate(-190, -250);
      inside(new Path2D(face.mouth), 249, 284);
    }
    c.restore();
    front.tx.needsUpdate = true;

    const b = back.c.getContext("2d")!;
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, 512, 512);
    b.setTransform(k, 0, 0, k, ox, oy);
    denticles(b);
    b.font = `800 175px ${brand}`; b.textAlign = "center";
    drawRelief(b, ink, (fill) => { b.fillStyle = fill; b.fillText("$", 190, 282); });
    back.tx.needsUpdate = true;
  }

  // ---- hands: base (idle / auto gestures) -> gesture cue -> action, each blended by its weight ----
  const plan = useMemo(() => (actingOf(view, cfg.id ?? who)?.gestures as Plan[] | undefined) ?? planHands(view), [view, cfg, who]);
  const { L: hL, R: hR } = composeHands(view, plan, t, F, who, S, cfg);
  /**
   * The rubber hose: leaves the RIM sideways (out), curves around the edge toward the front, and enters the cuff
   * along the hand's direction (so arm + glove read as one piece). Hands are palm centres; the wrist is 26 units back.
   */
  const armGeo = (s0: [number, number], h: Hand, out: -1 | 1) => {
    let ux = Math.sin((h.a * Math.PI) / 180), uy = -Math.cos((h.a * Math.PI) / 180);
    const wx0 = h.x - ux * 26, wy0 = h.y - uy * 26;
    const reach = Math.hypot(wx0 - s0[0], wy0 - s0[1]) || 1;
    const dx0 = (wx0 - s0[0]) / reach, dy0 = (wy0 - s0[1]) / reach;
    // a hand never folds back onto its own arm (that read as a broken wrist): keep it within ~100° of the arm direction
    const d = ux * dx0 + uy * dy0;
    if (d < -0.15) { const k = (-0.15 - d) / 0.85; ux = ux * (1 - k) + dx0 * k; uy = uy * (1 - k) + dy0 * k; const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n; }
    const wx = h.x - ux * 26, wy = h.y - uy * 26, wz = h.z;
    // ONE smooth bow from the rim to the wrist (no S-bends): the first handle goes toward the wrist with a small
    // outward bulge, the second comes into the cuff along the hand's direction
    const c1 = [s0[0] + dx0 * reach * 0.33 + out * (8 + reach * 0.12), s0[1] + dy0 * reach * 0.33, Math.max(0.04, wz * 0.45)];
    const c2 = [wx - ux * reach * 0.3, wy - uy * reach * 0.3, wz * 0.85];
    const pts = Array.from({ length: 13 }, (_, i) => {
      const q = i / 12, u = 1 - q;
      const b = (a0: number, a1: number, a2: number, a3: number) => u * u * u * a0 + 3 * u * u * q * a1 + 3 * u * q * q * a2 + q * q * q * a3;
      return m(b(s0[0], c1[0], c2[0], wx), b(s0[1], c1[1], c2[1], wy), b(0, c1[2], c2[2], wz));
    });
    // glove orientation with a FIXED roll: fingers along the arm's end, palm toward the coin's front (+z), so the
    // hand never twists sideways / backwards
    const yAx = pts[12].clone().sub(pts[11]).normalize();
    // palm reference = front and a bit down: never parallel to the fingers in any pose, so the roll can't flip
    // (a pure "front" reference flipped when the hand pointed at the camera: the dumbbell glitch)
    const ref = new THREE.Vector3(0, -0.5, 1).normalize();
    const zAx = ref.sub(yAx.clone().multiplyScalar(ref.dot(yAx))).normalize();
    const xAx = new THREE.Vector3().crossVectors(yAx, zAx);
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, zAx));
    // the body's horizontal axis seen from inside the glove: a dumbbell stays level along it whatever the wrist does
    const level = new THREE.Vector3(1, 0, 0).applyQuaternion(quat.clone().invert());
    return { pts, wrist: pts[12], quat, level };
  };
  const aL = armGeo(SHOULDER_L, hL, -1), aR = armGeo(SHOULDER_R, hR, 1);
  const gloveScale = (1 - S.tuck * 0.6) * (1 + 0.15 * buff);
  /** the prop's world axis seen from inside a glove (mirrored for the right glove) */
  // the world's up seen from inside the glove: a clapper stands upright whatever the wrist does
  const propUp = (q: THREE.Quaternion, mirror: boolean) => { const v = new THREE.Vector3(0, 1, 0).applyQuaternion(q.clone().invert()); if (mirror) v.x = -v.x; return v; };
  const propLevel = (q: THREE.Quaternion, mirror: boolean) => {
    const v = new THREE.Vector3(...(S.prop?.axis ?? [1, 0, 0])).applyQuaternion(q.clone().invert());
    if (mirror) v.x = -v.x;
    return v;
  };

  // ---- legs: feet planted on the ground (walk = steps); tucked while rolling / spinning / flying ----
  const feet = -1.6;
  const bodyDrop = (P.bobY + P.hopY) / 130;
  const legPts = (side: -1 | 1) => {
    const hip = new THREE.Vector3(side * 0.2, -feet - bodyDrop - 0.985 - S.crouch, -0.02);
    const ph = S.walk === null ? 0 : S.walk + (side > 0 ? 0 : Math.PI);
    // walking: feet swing front/back (along the way he faces), the swinging foot lifts and its knee bends
    const swing = S.walk === null ? 0 : Math.sin(ph) * S.walkW, lift = S.walk === null ? 0 : Math.max(0, Math.cos(ph)) * S.walkW;
    const foot = new THREE.Vector3(side * (0.31 + 0.32 * S.spread), 0.24 + lift * 0.16 * S.lift, 0.04 + swing * (S.stride > 1 ? 0.3 * S.stride : S.lift > 1 ? 0.12 : 0.3));
    foot.lerp(hip, S.tuck * 0.7);
    const tuckOut = Math.max(S.eOut, S.tuck);
    // straight legs (owner: no knee bend) except while walking and when tucked / flying away
    const knee = hip.clone().lerp(foot, 0.5).add(new THREE.Vector3(side * (0.3 * tuckOut + 0.62 * S.knee), 0.12 * tuckOut + 0.1 * S.knee, 0.04 * tuckOut + lift * 0.16 * S.lift + 0.3 * S.knee));
    const lp = S.legs?.[side < 0 ? "L" : "R"];
    if (lp && S.legW > 0) {
      knee.lerp(new THREE.Vector3(...lp.k), S.legW); foot.lerp(new THREE.Vector3(...lp.f), S.legW);
    }
    if (S.sit > 0) {
      const sw = Math.sin(t * 3 + (side > 0 ? 0 : 1.6)) * 0.08;
      const sHip = new THREE.Vector3(side * 0.22, -feet - 0.95, 0.05);
      const sKnee = new THREE.Vector3(side * (0.26 + 0.24 * S.sitWide), -feet - 1.02 + 0.06 * S.sitWide, 0.5);
      const sFoot = new THREE.Vector3(side * (0.28 + 0.3 * S.sitWide), -feet - 1.45 + 0.1 * S.sitWide, 0.62 + sw + 0.16 * S.sitWide);
      if (cfg.dangle) { // sitting on something high, the legs hang free and swing in turn, like a kid on a swing
        const fw = Math.sin(t * 2.6 + (side > 0 ? 0 : Math.PI)) * (1 - S.splash) + Math.sin(t * 7 + (side > 0 ? 0 : Math.PI)) * 1.35 * S.splash; // {splash}: faster, bigger kicks
        sKnee.set(side * 0.34, -feet - 1.05, 0.34);
        sFoot.set(side * (0.32 + 0.17 * fw), -feet - 1.98 + 0.3 * Math.max(0, fw), 0.46 + 0.28 * fw);
      }
      return [hip.lerp(sHip, S.sit), knee.lerp(sKnee, S.sit), foot.lerp(sFoot, S.sit)];
    }
    return [hip, knee, foot];
  };
  const tail = P.sway * 1.8 + P.hopY * 0.6;
  // body language: sad / sleepy slump forward and sink, angry leans in and trembles, shocked recoils back,
  // shy turns away, love sways, smug leans back
  const shockW = F.o * Math.max(0, Math.min(1, (F.eyeY - 1) * 4));
  const sadW = F.frown * (1 - F.steam);
  const bl = {
    pitch: 0.26 * sadW + 0.2 * F.zzz + 0.12 * F.steam - 0.24 * shockW - 0.1 * F.smirk,
    roll: Math.sin(t * 3) * 0.09 * F.heart + (variant !== "mrs" ? -1 : 1) * 0.14 * F.blush * (1 - F.heart) + Math.sin(t * 38) * 0.012 * F.steam,
    yaw: (variant !== "mrs" ? -1 : 1) * 0.45 * F.blush * (1 - F.heart),
    sink: Math.max(sadW, F.zzz * 0.7),
  };
  if (!S.visible) return null;

  return (
    <group>
      {S.bar?.floor && (
        // the dropped barbell: on the floor where he stood, resting on its plates, in front of his feet
        <group position={[(S.bar.floor.x - W / 2) / UNIT, -(S.bar.floor.y - H / 2) / UNIT, S.z + 0.35 * S.size]} scale={S.size}>
          <BarbellMesh line={line} ramp={ramp} />
        </group>
      )}
      <group position={[S.X, S.Y + feet * S.size, S.z]} scale={[S.sx * S.size * S.vis, S.sy * S.size * S.vis, S.size * S.vis]}>
        {/* legs + cartoon shoes, turning with the body but standing on the ground ({faceplant}: they tip over with him and kick) */}
        <group position={[0, -feet, 0]} rotation={[S.act === "hit" || S.act === "crash" ? S.rx * 0.9 : S.act === "faceplant" ? S.rx + 0.18 * Math.sin(S.actLt * 13) * Math.min(1, Math.max(0, S.actLt - 0.5) / 0.3) * Math.max(0, Math.min(1, (S.actDur - 0.6 - S.actLt) / 0.2)) : 0, 0, S.legRz]}><group position={[0, feet, 0]}>
        <group rotation={[0, S.yaw, 0]}>
          {([-1, 1] as const).map((side) => {
            const pts = legPts(side);
            const f = pts[2];
            return (
              <group key={side}>
                <Hose pts={pts} r={0.065 * (1 + 0.45 * buff)} color={coin} line={line} ramp={ramp} />
                <group position={[f.x + side * 0.05, f.y - 0.1, f.z + 0.06]} scale={1 - S.tuck * 0.5}>
                  <group scale={[0.27, 0.13, 0.21]}><Toon geo={geo.shoe} color={white} line={line} ramp={ramp} grow={1.1} /></group>
                  <mesh geometry={geo.sole} position={[0, -0.1, 0]} scale={[0.27, 0.035, 0.21]}><meshToonMaterial color={line} gradientMap={ramp} /></mesh>
                </group>
              </group>
            );
          })}
        </group>
        </group></group>
        <group position={[0, -feet - (P.bobY + P.hopY) / 130 - 0.08 * bl.sink - S.crouch, 0]} rotation={[-0.14 + P.nod * 0.07 + S.rx + bl.pitch, S.yaw + bl.yaw + P.hYaw, (-(P.bobR + F.tilt) * Math.PI) / 180 + S.rz + bl.roll]} scale={[P.talkSX * (2 - P.breath), P.talkSY * (1 - 0.05 * bl.sink) * P.breath, 1]}>
          {V.ponytail && (
            <group position={m(285, 121, -0.12)} rotation={[0, 0, (-tail * Math.PI) / 180]}>
              <group position={m(285, 121).multiplyScalar(-1)}>
                <Hose pts={[m(282, 112, -0.12), m(322, 84, -0.15), m(352, 104, -0.15)]} r={0.15} color={coin} line={line} ramp={ramp} />
                <Hose pts={[m(350, 100, -0.15), m(364, 132, -0.15), m(354, 164, -0.13), m(332, 186, -0.1)]} r={0.11} color={coin} line={line} ramp={ramp} />
              </group>
              <mesh geometry={geo.ball} scale={[0.9, 1.1, 0.9]}><meshToonMaterial color={ink} gradientMap={ramp} /></mesh>
            </group>
          )}
          {wear("headband") && (
            // a wide sweatband wrapped over the top of the rim, so it shows on the face side too
            <group rotation={[0, 0, Math.PI / 2 - (Math.PI * 0.42)]} scale={[1, 1, 2.6]}>
              <mesh geometry={outfitGeo.band}><meshToonMaterial color="#F4F5F7" gradientMap={ramp} /></mesh>
              <mesh geometry={outfitGeo.bandHull}><meshBasicMaterial color={line} side={THREE.BackSide} /></mesh>
              <mesh geometry={outfitGeo.stripe}><meshToonMaterial color={who === "mrs" ? "#E0368A" : "#FF5CA8"} gradientMap={ramp} /></mesh>
            </group>
          )}
          {wear("cap") && (
            <group position={[0, 0.9, 0]} rotation={[-0.1, 0, -0.08]}>
              <group scale={[0.62, 0.42, 0.5]}><Toon geo={outfitGeo.dome} color={who === "mrs" ? "#F4F5F7" : "#0E0F12"} line={line} ramp={ramp} grow={1.06} /></group>
              <group position={[0, 0.02, 0.34]} scale={[0.5, 0.035, 0.36]}><Toon geo={outfitGeo.disc} color={who === "mrs" ? "#F4F5F7" : "#0E0F12"} line={line} ramp={ramp} grow={1.1} /></group>
              <mesh geometry={outfitGeo.ball} position={[0, 0.42, 0]} scale={0.06}><meshToonMaterial color={coin} gradientMap={ramp} /></mesh>
            </group>
          )}
          {/* towel over the left shoulder: from behind, over the rim, hanging down the front */}
          {/* towel thrown over the left shoulder (where the arm comes out of the rim): from behind, over it, down the front */}
          {wear("towel") && (
            <group>
              <Hose pts={[m(62, 318, -0.3), m(44, 280, -0.16), m(44, 248, 0.04), m(60, 254, 0.24), m(70, 300, 0.32), m(72, 352, 0.32)]} r={0.105} color="#F4F5F7" line={line} ramp={ramp} />
              <Hose pts={[m(71.5, 330, 0.35), m(71.8, 342, 0.355)]} r={0.108} color={coin} line={line} ramp={ramp} />
            </group>
          )}
          {wear("bow") && (
            <group position={who === "mrs" ? m(296, 104, 0.14) : m(258, 104, 0.05)} rotation={[0, 0, -0.35]} scale={1.45}>
              {[-1, 1].map((sd) => (
                <group key={sd} position={[sd * 0.17, 0, 0]} rotation={[0, 0, sd * 0.35]} scale={[0.17, 0.11, 0.08]}>
                  <Toon geo={outfitGeo.ball} color={who === "mrs" ? "#B58CFF" : "#FF5CA8"} line={line} ramp={ramp} grow={1.12} />
                </group>
              ))}
              {[-1, 1].map((sd) => (
                <group key={`t${sd}`} position={[sd * 0.08, -0.15, 0]} rotation={[0, 0, sd * 0.25]} scale={[0.05, 0.12, 0.04]}>
                  <Toon geo={outfitGeo.ball} color={who === "mrs" ? "#B58CFF" : "#FF5CA8"} line={line} ramp={ramp} grow={1.15} />
                </group>
              ))}
              <group scale={[0.065, 0.065, 0.06]}><Toon geo={outfitGeo.ball} color={who === "mrs" ? "#F4F5F7" : "#D6FF3C"} line={line} ramp={ramp} grow={1.15} /></group>
            </group>
          )}
          {(wear("hipscarf") || S.act === "bellydance") && (() => {
            // hip scarf low on the front, tied on her right, a row of little silver coins that jingle with the shimmy
            const jig = S.act === "bellydance" ? Math.sin(t * 40) * 3 : 0;
            return (
              <group>
                <Hose pts={[m(92, 318, 0.02), m(128, 338, 0.2), m(190, 347, 0.23), m(252, 338, 0.2), m(288, 318, 0.02)]} r={0.055} color={who === "mrs" ? "#B58CFF" : "#FF5CA8"} line={line} ramp={ramp} />
                <group position={m(262, 334, 0.24)} scale={[0.09, 0.07, 0.06]}><Toon geo={outfitGeo.ball} color={who === "mrs" ? "#B58CFF" : "#FF5CA8"} line={line} ramp={ramp} grow={1.15} /></group>
                {[124, 146, 168, 190, 212, 234].map((x, i) => (
                  <group key={x} position={m(x + jig * (i % 2 ? 1 : -1), 357 - Math.abs(x - 190) * 0.12, 0.25)} rotation={[Math.PI / 2, 0, 0]} scale={[0.05, 0.012, 0.05]}>
                    <Toon geo={outfitGeo.disc} color="#E9ECF1" line={line} ramp={ramp} grow={1.25} />
                  </group>
                ))}
              </group>
            );
          })()}
          {wear("jersey") && (
            <group>
              <Toon geo={jerseyGeo.body} color={kit.color ?? "#F4F5F7"} line={line} ramp={ramp} grow={1.035} />
              <Hose pts={jerseyGeo.collarF} r={0.024} color={kitTrim} line={line} ramp={ramp} />
              <Hose pts={jerseyGeo.collarB} r={0.024} color={kitTrim} line={line} ramp={ramp} />
              {[SHOULDER_L, SHOULDER_R].map(([x, y]) => (
                <group key={x} position={m(x, y + 6, 0)} scale={[0.14, 0.13, 0.215]}><Toon geo={outfitGeo.ball} color={kit.color ?? "#F4F5F7"} line={line} ramp={ramp} grow={1.12} /></group>
              ))}
              {kitNum && [1, -1].map((s) => (
                <mesh key={s} geometry={jerseyGeo.plane} position={[0, 0, s * (jerseyGeo.zf + 0.004)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                  <meshBasicMaterial map={numTex} transparent alphaTest={0.2} />
                </mesh>
              ))}
              {kit.captain && (() => {
                // captain's armband on his own left arm (screen right), a little below the shoulder
                const cv = new THREE.CatmullRomCurve3(aR.pts);
                // (below the sleeve cap, which hid it when the arm hangs down)
                return <Hose pts={[cv.getPoint(0.4), cv.getPoint(0.47), cv.getPoint(0.54), cv.getPoint(0.6)]} r={0.112} color="#F4F5F7" line={line} ramp={ramp} />;
              })()}
            </group>
          )}
          {S.act === "rope" && (() => {
            // the rope: from wrist to wrist, its middle turning on a circle (over the head, in front, under the feet, behind)
            const ph = (2 * Math.PI * S.actLt) / 0.46;
            const M = new THREE.Vector3(0, -0.25 + 1.5 * Math.cos(ph), 1.5 * Math.sin(ph) * 0.8);
            const a = aL.wrist, b = aR.wrist, mid = a.clone().add(b).multiplyScalar(0.5);
            const pts = Array.from({ length: 11 }, (_, i) => {
              const q = i / 10, bell = Math.sin(Math.PI * q);
              return a.clone().lerp(b, q).add(M.clone().sub(mid).multiplyScalar(bell)).add(new THREE.Vector3((q - 0.5) * 0.5 * bell, 0, 0));
            });
            return <Hose pts={pts} r={0.026} color={who === "mrs" ? "#B58CFF" : "#D6FF3C"} line={line} ramp={ramp} />;
          })()}
          {S.act === "hoop" && (() => {
            const om = S.actLt * 9, w = Math.min(1, S.actLt / 0.3, (ACTION_CUES.hoop - S.actLt) / 0.35);
            return (
              <group position={[Math.cos(om) * 0.16, -0.62, Math.sin(om) * 0.16]} rotation={[Math.PI / 2 - 0.38 + Math.sin(om) * 0.12, Math.cos(om) * 0.14, 0]} scale={w}>
                <group rotation={[0, 0, om * 1.3]}>
                  <mesh geometry={outfitGeo.hoopA}><meshToonMaterial color={who === "mrs" ? "#B58CFF" : "#D6FF3C"} gradientMap={ramp} /></mesh>
                  <mesh geometry={outfitGeo.hoopA} rotation={[0, 0, Math.PI]}><meshToonMaterial color="#F4F5F7" gradientMap={ramp} /></mesh>
                  <mesh geometry={outfitGeo.hoopHull}><meshBasicMaterial color={line} side={THREE.BackSide} /></mesh>
                </group>
              </group>
            );
          })()}
          {S.sign !== null && S.signW > 0.02 && (
            <group position={m(190, 2, 0.32)} scale={S.signW}>
              <mesh geometry={outfitGeo.board} scale={[2.06, 0.94, 1]} position={[0, 0, -0.01]}><meshBasicMaterial color={line} /></mesh>
              <mesh geometry={outfitGeo.board} scale={[1.96, 0.84, 1]}><meshBasicMaterial map={signTex.tx} /></mesh>
            </group>
          )}
          {S.bar?.held && (() => {
            // the barbell through both fists (palm centres), plates out past the hands
            const palm = (a: typeof aL) => new THREE.Vector3(0, 0.2, 0.06).applyQuaternion(a.quat).multiplyScalar(gloveScale).add(a.wrist);
            const pl = palm(aL), pr = palm(aR), d = pr.clone().sub(pl).normalize();
            return (
              <group position={pl.clone().add(pr).multiplyScalar(0.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d)}>
                <BarbellMesh line={line} ramp={ramp} />
              </group>
            );
          })()}
          <Hose pts={aL.pts} r={0.07 * (1 + 0.8 * buff)} color={coin} line={line} ramp={ramp} />
          <Hose pts={aR.pts} r={0.07 * (1 + 0.8 * buff)} color={coin} line={line} ramp={ramp} />
          {/* gloves sit ON the wrist, pointing along the arm. Left: thumb toward the body (+x); right mirrored */}
          <group position={aL.wrist} quaternion={aL.quat} scale={gloveScale}>
            <Glove white={white} line={line} ramp={ramp} pose={hL.pose} w={hL.curl} worldRz={(-hL.a * Math.PI) / 180} prop={S.prop?.hands.includes("L") ? S.prop.kind : S.holdL ? "phone" : wear("lantern") ? "lantern" : carry ? "dumbbell" : wear("clipboard") ? "clipboard" : wear("clappers") ? "clapper" : null} level={propLevel(aL.quat, false)} up={propUp(aL.quat, false)} girly={who === "mrs"} face={S.holdL && S.holdPhone && !S.prop?.hands.includes("L") ? new THREE.Vector3(0, 0, 1).applyQuaternion(aL.quat.clone().invert()) : undefined} propSize={dbSize} />
          </group>
          <group position={aR.wrist} quaternion={aR.quat} scale={gloveScale}>
            <group scale={[-1, 1, 1]}><Glove white={white} line={line} ramp={ramp} pose={hR.pose} w={hR.curl} worldRz={(hR.a * Math.PI) / 180} prop={S.prop?.hands.includes("R") ? S.prop.kind : wear("clappers") ? "clapper" : null} level={propLevel(aR.quat, true)} up={propUp(aR.quat, true)} girly={who === "mrs"} propSize={dbSize} /></group>
          </group>
          {/* body: reeded edge, raised rims (a bit lighter, polished), flat fields with the face / "$" */}
          <Toon geo={geo.edge} hull={geo.hull} color={rimStyle === "dark" ? darkRim : coin} line={line} ramp={ramp} />
          {[1, -1].map((s) => (
            <group key={s} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
              <mesh geometry={geo.rim} position={[0, 0, TOP]}><meshToonMaterial color={rimStyle === "dark" ? darkRim : rimColor} gradientMap={ramp} /></mesh>
              <mesh geometry={geo.lip} position={[0, 0, HALF + LIP / 2]}><meshToonMaterial color={rimStyle === "light" ? coin : ink} gradientMap={ramp} side={THREE.DoubleSide} /></mesh>
              <mesh geometry={geo.field} position={[0, 0, HALF]}><meshToonMaterial color={coin} gradientMap={ramp} /></mesh>
              <mesh geometry={geo.field} position={[0, 0, HALF + 0.002]}><meshBasicMaterial map={s > 0 ? front.tx : back.tx} transparent /></mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
};

// ===================================================================================================================
// Cartoon FX around the coins (2D, screen space): mood FX (steam, sweat, Zzz, hearts, sparkles, dizzy stars),
// {fx} cues (confetti, bulb, ?, !, sparkle, hearts...) and action FX (impact, puff).
// ===================================================================================================================
const star4 = (x: number, y: number, r: number) => `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;
const heartPath = (x: number, y: number, r: number) => `M${x} ${y + r * 0.9} C${x - r * 1.6} ${y - r * 0.2} ${x - r * 0.9} ${y - r * 1.5} ${x} ${y - r * 0.55} C${x + r * 0.9} ${y - r * 1.5} ${x + r * 1.6} ${y - r * 0.2} ${x} ${y + r * 0.9} Z`;
const rand = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const CoinFX: React.FC<{ t: number; rigs: { P: ReturnType<typeof coinPose>; S: RigS; view: Timeline; accent: string }[] }> = ({ t, rigs }) => {
  const els: React.ReactNode[] = [];
  let key = 0;
  const k = () => key++;
  rigs.forEach(({ P, S, view, accent }) => {
    if (!S.visible || S.vis < 0.5) return;
    const { F } = P;
    const { px, py, r } = S;
    const top = py - r;
    const cues = fxAt(view, t);
    const has = (n: string) => cues.find((c) => c.name === n);
    const w = (n: string, mood: number) => Math.max(mood, has(n) ? Math.min(1, has(n)!.lt / 0.15, (has(n)!.dur - has(n)!.lt) / 0.3) : 0);
    const steam = w("steam", F.steam), sweat = w("sweat", F.sweat), zzz = w("zzz", F.zzz), hearts = w("hearts", F.heart), sparkle = w("sparkle", Math.max(F.star, F.sparkle > 0.9 ? 0.6 : 0));
    for (let i = 0; i < 2 && steam > 0.01; i++) {
      const ph = (t * 1.3 + i * 0.5) % 1;
      els.push(<circle key={k()} cx={px + (i ? 0.62 : -0.62) * r + (i ? 1 : -1) * ph * 0.2 * r} cy={top + 0.1 * r - ph * 0.7 * r} r={(0.1 + ph * 0.16) * r} fill="#D7DBE2" opacity={(1 - ph) * steam * 0.85} />);
    }
    if (sweat > 0.01) {
      const ph = (t * 0.9) % 1, x = px + 0.82 * r, y = py - 0.55 * r + ph * 0.35 * r, s = 0.11 * r;
      els.push(<path key={k()} d={`M${x} ${y - s * 1.6} Q${x + s} ${y} ${x} ${y + s} Q${x - s} ${y} ${x} ${y - s * 1.6} Z`} fill="#7CC8FF" stroke="#0E0F12" strokeWidth={3} opacity={sweat * (1 - ph * 0.5)} />);
    }
    for (let i = 0; i < 3 && zzz > 0.01; i++) {
      const ph = (t * 0.55 + i / 3) % 1;
      els.push(<text key={k()} x={px + 0.55 * r + ph * 0.55 * r} y={top + 0.1 * r - ph * 0.75 * r} fontFamily={FONT.brand} fontWeight={800} fontSize={(0.16 + ph * 0.14) * r} fill="#F4F5F7" opacity={Math.sin(Math.PI * ph) * zzz}>Z</text>);
    }
    for (let i = 0; i < 3 && hearts > 0.01; i++) {
      const ph = (t * 0.7 + i / 3) % 1;
      els.push(<path key={k()} d={heartPath(px + (i - 1) * 0.6 * r, top + 0.15 * r - ph * 0.8 * r, (0.09 + ph * 0.05) * r)} fill="#FF4D6D" opacity={Math.sin(Math.PI * ph) * hearts} />);
    }
    for (let i = 0; i < 4 && sparkle > 0.01; i++) {
      const a = i * 1.57 + 0.6, tw = 0.5 + 0.5 * Math.sin(t * 9 + i * 2);
      els.push(<path key={k()} d={star4(px + Math.cos(a) * 1.25 * r, py + Math.sin(a) * 1.1 * r - 0.2 * r, (0.07 + 0.06 * tw) * r)} fill="#F5B82E" opacity={sparkle * (0.4 + 0.6 * tw)} />);
    }
    if (F.spiral > 0.01) for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * 2.09;
      els.push(<path key={k()} d={star4(px + Math.cos(a) * 0.75 * r, top + 0.05 * r + Math.sin(a) * 0.16 * r, 0.09 * r)} fill="#F5B82E" opacity={F.spiral} />);
    }
    for (const c of cues) {
      const pop = Math.min(1, c.lt / 0.18) * (1 + 0.15 * Math.sin(Math.min(1, c.lt / 0.3) * Math.PI)), out = Math.min(1, (c.dur - c.lt) / 0.25);
      if (c.name === "bulb") {
        const x = px, y = top - 0.45 * r, s = 0.24 * r * pop;
        els.push(<g key={k()} opacity={out}><circle cx={x} cy={y} r={s * 1.7} fill="#F5B82E" opacity={0.25} /><circle cx={x} cy={y} r={s} fill="#F5B82E" stroke="#0E0F12" strokeWidth={4} /><rect x={x - s * 0.45} y={y + s * 0.85} width={s * 0.9} height={s * 0.5} rx={3} fill="#A6ABB5" stroke="#0E0F12" strokeWidth={3} /></g>);
      }
      if (c.name === "question" || c.name === "exclaim") {
        els.push(<text key={k()} x={px + 0.15 * r} y={top - 0.15 * r} textAnchor="middle" fontFamily={FONT.brand} fontWeight={800} fontSize={0.55 * r * pop} fill={accent} stroke="#0E0F12" strokeWidth={4} paintOrder="stroke" opacity={out}>{c.name === "question" ? "?" : "!"}</text>);
      }
      if (c.name === "confetti") {
        const cols = ["#D6FF3C", "#FF5CA8", "#F5B82E", "#F4F5F7"];
        for (let i = 0; i < 70; i++) {
          const x = W * rand(i), vy = 500 + rand(i + 99) * 700, y = -40 + vy * c.lt + 300 * c.lt * c.lt, rot = (rand(i + 7) * 2 - 1) * 720 * c.lt;
          if (y > H + 40) continue;
          els.push(<rect key={k()} x={x + Math.sin(c.lt * 6 + i) * 30} y={y} width={14} height={22} fill={cols[i % 4]} transform={`rotate(${rot} ${x} ${y})`} opacity={out} />);
        }
      }
    }
    for (const f of S.fx) {
      if (f.name === "impact") {
        const p = Math.min(1, f.lt / 0.3);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          els.push(<path key={k()} d={star4(f.x + Math.cos(a) * (0.3 + p * 0.5) * r, f.y + Math.sin(a) * (0.15 + p * 0.25) * r, 0.08 * r)} fill="#F5B82E" opacity={1 - p} />);
        }
      }
      if (f.name === "calm") {
        for (let i = 0; i < 3; i++) {
          const ph = (f.lt * 0.5 + i / 3) % 1;
          els.push(<ellipse key={k()} cx={f.x} cy={f.y} rx={(0.9 + ph * 0.9) * r} ry={(0.3 + ph * 0.3) * r} fill="none" stroke={accent} strokeWidth={5} opacity={Math.sin(Math.PI * ph) * 0.55 * (f.w ?? 1)} />);
        }
        for (let i = 0; i < 3; i++) {
          const ph = (f.lt * 0.4 + i / 3) % 1;
          els.push(<path key={k()} d={star4(f.x + (i - 1) * 0.9 * r, f.y - 0.6 * r - ph * 0.9 * r, 0.07 * r)} fill="#F4F5F7" opacity={Math.sin(Math.PI * ph) * 0.8 * (f.w ?? 1)} />);
        }
      }
      if (f.name === "water") { // pool water in front of the lower body: wavy surface, foam line, splashes where the hands go in
        const o = f.w ?? 1, sy = f.y + 0.32 * r, x0 = f.x - 1.7 * r, x1 = f.x + 1.7 * r;
        const wave = (x: number, k: number) => sy + Math.sin(x / (0.35 * r) + f.lt * 5 + k) * 0.05 * r;
        let d = `M${x0} ${f.y + 1.6 * r}`;
        for (let i = 0; i <= 24; i++) { const x = x0 + ((x1 - x0) * i) / 24; d += ` L${x} ${wave(x, 0)}`; }
        d += ` L${x1} ${f.y + 1.6 * r} Z`;
        els.push(<defs key={k()}><linearGradient id="poolFade" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#2FA8E8" stopOpacity={0} /><stop offset="0.2" stopColor="#2FA8E8" /><stop offset="0.8" stopColor="#2FA8E8" /><stop offset="1" stopColor="#2FA8E8" stopOpacity={0} /></linearGradient>
          <linearGradient id="foamFade" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#E6F7FF" stopOpacity={0} /><stop offset="0.2" stopColor="#E6F7FF" /><stop offset="0.8" stopColor="#E6F7FF" /><stop offset="1" stopColor="#E6F7FF" stopOpacity={0} /></linearGradient></defs>);
        els.push(<path key={k()} d={d} fill="url(#poolFade)" opacity={0.86 * o} />);
        for (let j = 0; j < 2; j++) {
          let line = "";
          for (let i = 0; i <= 24; i++) { const x = x0 + ((x1 - x0) * i) / 24; line += `${i ? " L" : "M"}${x} ${wave(x, j * 2.2) + j * 0.28 * r}`; }
          els.push(<path key={k()} d={line} fill="none" stroke="url(#foamFade)" strokeWidth={j ? 4 : 8} strokeLinecap="round" opacity={(j ? 0.45 : 0.95) * o} />);
        }
        for (const side of [1, -1]) { // a splash each time a hand comes down into the water
          const ph = ((f.lt / 1.1 + (side === 1 ? 0.25 : 0.75)) % 1) * 4;
          if (ph > 1) continue;
          const cx = f.x - side * 1.05 * r;
          for (let i = 0; i < 6; i++) {
            const a = -Math.PI / 2 + (i - 2.5) * 0.35;
            els.push(<circle key={k()} cx={cx + Math.cos(a) * ph * 0.5 * r} cy={sy + Math.sin(a) * ph * 0.45 * r + ph * ph * 0.3 * r} r={0.045 * r * (1 - ph * 0.5)} fill="#E6F7FF" opacity={(1 - ph) * o} />);
          }
        }
      }
      if (f.name === "flash") {
        const p = Math.min(1, f.lt / 0.45);
        els.push(<rect key={k()} x={0} y={0} width={W} height={H} fill="#FFFFFF" opacity={0.75 * Math.pow(1 - p, 2)} />);
        els.push(<path key={k()} d={star4(f.x, f.y, (0.25 + 0.3 * p) * r)} fill="#FFFFFF" opacity={1 - p} />);
      }
      if (f.name === "kiss") {
        const p = Math.min(1, f.lt / 0.9);
        els.push(<path key={k()} d={heartPath(f.x + p * 1.5 * r, f.y - p * 0.9 * r + Math.sin(p * 9) * 0.06 * r, (0.08 + 0.22 * p) * r)} fill="#FF4D6D" stroke="#0E0F12" strokeWidth={4} opacity={Math.min(1, (1 - p) * 3)} />);
      }
      if (f.name === "heartpop") {
        const pop = Math.min(1, f.lt / 0.25) * (1 + 0.08 * Math.sin(f.lt * 14));
        els.push(<path key={k()} d={heartPath(f.x, f.y - 1.35 * r, 0.32 * r * pop)} fill="#FF4D6D" stroke="#0E0F12" strokeWidth={5} opacity={f.w ?? 1} />);
      }
      if (f.name === "splash") { // water drops thrown up by a kicking foot: up and out, then falling back
        const p = Math.min(1, f.lt / 0.42);
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (i - 2.5) * 0.36, v = 0.9 + 0.25 * (i % 3);
          els.push(<circle key={k()} cx={f.x + Math.cos(a) * v * p * 0.75 * r} cy={f.y + (Math.sin(a) * v * p * 0.9 + 0.9 * p * p) * r} r={(0.075 - 0.03 * p) * r} fill="#E4F6FF" stroke="#6FBDF0" strokeWidth={0.014 * r} opacity={1 - p * p} />);
        }
      }
      if (f.name === "puff") {
        const p = Math.min(1, f.lt / 0.45);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          els.push(<circle key={k()} cx={f.x + Math.cos(a) * p * 0.9 * r} cy={f.y + Math.sin(a) * p * 0.7 * r} r={(0.25 + p * 0.2) * r} fill="#E9ECF1" opacity={(1 - p) * 0.95} />);
        }
      }
    }
  });
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>{els}</svg>;
};

/** The stage: one camera over the whole frame; one coin, or both (presenter.cast) in a duo; FX on top. */
// ===================================================================================================================
// Life layer (render look batch 3, 2026-10-28). Reads the coin's own motion (the rig sampled at earlier moments, so it
// stays a pure function of t) and adds what a body does with it. Rules from the Clawd animation guide (MIT), the
// HyperFrames motion doctrine (Apache-2.0) and onetake's numbers (ideas only, own code):
//  - stretch along a fast vertical move, lean into a sideways one (he leans forward into a walk / flight)
//  - overlap: the hands trail the body by a few frames (they arrive last), never in sync (L and R differ)
//  - landing = a damped ring-out (squash e^-7a cos 22a) sized by the impact speed, instead of one sine bump
//  - eyes first: he glances where he is about to go (flights, jumps) before the body moves
//  - effort: after an exercise / a jump he breathes harder and sweats for a few seconds, then calms down
// Velocities are per second (dt fixed), so 30 fps drafts and 60 fps finals look the same.
// ===================================================================================================================
const LIFE_DT = 1 / 30;
const EXERT: Record<string, number> = { run: 1, jacks: 0.9, squat: 0.8, press: 0.7, curl: 0.6, raise: 0.6, box: 0.9, rope: 0.9, cheer: 0.6, swim: 0.8, jump: 0.35, flip: 0.45, toss: 0.3, dance: 0.4, faceplant: 0.3 };
type Live = { P: ReturnType<typeof coinPose>; S: RigS };
const liveRig = (tl: Timeline, view: Timeline, t: number, who: string, duo: boolean, c: PresenterConfig, fps: number, enterAt: number): Live => {
  const at = (tt: number) => { const P = coinPose(view, tt, fps, c); return { P, S: rigState(tl, view, tt, who, duo, c, P, enterAt) }; };
  const { P, S } = at(t);
  S.drag = { x: 0, y: 0 };
  if (!S.visible || S.vis < 0.5 || c.look?.life === false) return { P, S };
  // ---- velocity history (world units / s), 12 frames back; a hidden / not yet entered frame breaks the chain ----
  const N = 12, xs = [S.X], ys = [S.Y], ok = [true], own = [S.own];
  for (let k = 1; k <= N + 1; k++) {
    const tt = t - k * LIFE_DT;
    // before a camera cut he was somewhere else in another shot: no speed across the cut (he leaned from the jump)
    if (tt < 0 || tt < S.cutAt) { ok.push(false); xs.push(0); ys.push(0); own.push(null); continue; }
    const s = at(tt).S;
    ok.push(s.visible && s.vis > 0.5); xs.push(s.X); ys.push(s.Y); own.push(s.own);
  }
  const vel = (k: number): [number, number] => {
    if (!ok[k] || !ok[k + 1]) return [0, 0];
    const o = own[k]; if (o) return [o.vx, o.vy]; // in a handheld clip: his own motion, not the camera's
    const vx = (xs[k] - xs[k + 1]) / LIFE_DT, vy = (ys[k] - ys[k + 1]) / LIFE_DT;
    return Math.hypot(vx, vy) > 150 ? [0, 0] : [vx, vy]; // a teleport, not a move
  };
  // a short weighted look back (missing frames count as still), so nothing jumps when the history starts
  let vx = 0, vy = 0;
  for (const [k, w] of [[0, 0.4], [1, 0.3], [2, 0.2], [3, 0.1]]) { const [a, b] = vel(k); vx += a * w; vy += b * w; }
  const clamp = (v: number, a: number) => Math.max(-a, Math.min(a, v));
  // the layer fades in over his entrance (he arrives fast: the drop / fly-in would saturate it in one frame)
  const inW = Math.max(0, Math.min(1, (t - enterAt) / 0.35));
  // stretch with vertical speed (a coin stays a coin: max 14 %), lean into sideways motion
  const st = Math.min(0.14, Math.abs(vy) * 0.018) * (1 - S.tuck) * inW;
  S.sy *= 1 + st; S.sx *= 1 - st * 0.55;
  S.rz += clamp(-vx * 0.028, 0.2) * (1 - S.tuck) * inW;
  // overlap: hands trail by ~2 frames, opposite to the motion (face px: x right, y down)
  // (a weighted look back over 6 frames = a soft spring: the trail builds and settles instead of jumping)
  let dxs = 0, dys = 0, wsum = 0;
  for (let k = 1; k <= 6; k++) { const w = Math.exp(-(k - 1) / 2), [a, b] = vel(k); dxs += a * w; dys += b * w; wsum += w; }
  S.drag = { x: clamp((-dxs / wsum) * 5, 26) * inW, y: clamp((dys / wsum) * 5, 26) * inW };
  // landing ring-out: the most recent frame where a fast fall stopped
  for (let k = 0; k < N; k++) {
    const vNow = vel(k)[1], vBefore = vel(k + 1)[1];
    if (vBefore < -3 && vNow > vBefore * 0.35) {
      const a = k * LIFE_DT, amp = Math.min(0.2, 0.04 + -vBefore * 0.012);
      const ring = amp * Math.exp(-7 * a) * Math.cos(22 * a);
      S.sy *= 1 - ring; S.sx *= 1 + ring * 0.8;
      break;
    }
  }
  // ---- effort after exercise: harder breathing, sweat, a small slump, mouth open while silent ----
  let eff = 0;
  for (const sc of view.scenes) for (const cu of sc.cues ?? []) {
    const name = cu.name.includes(":") ? cu.name.split(":")[1] : cu.name, k = EXERT[name];
    if (!k) continue;
    const end = cu.t + (ACTION_CUES[name] ?? 1), a = t - end;
    if (a >= 0 && a < 3) eff = Math.max(eff, k * Math.exp(-a / 1.1) * Math.min(1, a / 0.35));
  }
  if (eff > 0.02 && S.act === null) {
    const F = { ...P.F, brow: P.F.brow + 2 * eff };
    const pant = Math.abs(Math.sin(t * 6.5));
    const silent = !P.speaking;
    Object.assign(P, {
      F,
      breath: 1 + 0.014 * Math.sin((t * Math.PI * 2) / 3.3) * (1 - eff) + 0.035 * eff * Math.sin(t * 6.5 * 2),
      ...(silent ? { mouthRaw: Math.max(P.mouthRaw, 0.35 * eff * pant), mouth: Math.max(P.mouth, F.rest + (1 - F.rest) * 0.35 * eff * pant) } : {}),
    });
    S.rx += 0.07 * eff; S.crouch += 0.03 * eff;
  }
  return { P, S };
};

export const Coin3D: React.FC<{ tl: Timeline; theme: Theme; t: number; cfg: PresenterConfig }> = ({ tl, t, cfg }) => {
  const { fps } = useVideoConfig();
  const members = useMemo(() => castOf(tl, cfg), [tl, cfg]);
  const duo = members.length > 1;
  const views = useMemo(() => members.map((m) => viewFor(tl, m.who, m.duo, kindFor(m.who, m.c))), [tl, members]);
  const dist = H / UNIT / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
  const rigs = members.map(({ who, c, enterAt }, i) => {
    const { P: P0, S } = liveRig(tl, views[i], t, who, duo, c, fps, enterAt);
    // gym moves change the face (owner: not the same gritted teeth everywhere): every exercise breathes its own way
    let P = P0;
    if (S.act) {
      const lt = S.actLt, F = { ...P0.F, grit: 0, happy: 0 };
      const sweat = Math.min(1, Math.max(0, (lt - 1.1) / 0.4));
      const rep = (start: number, period: number) => { const ph = Math.max(0, lt - start) / period; return { u: 0.5 - 0.5 * Math.cos(2 * Math.PI * ph), lifting: Math.sin(2 * Math.PI * ph) >= 0 }; };
      let mouth: Partial<typeof P0> = {};
      if (S.act === "curl" || S.act === "squat" || S.act === "press" || S.act === "raise") {
        // effort = hold the breath (puffed cheeks, eyes squeezed); release = "huff" (O mouth)
        const { u, lifting } = S.act === "curl" ? rep(0.25, 1.0) : S.act === "press" ? rep(0.25, 1.15) : S.act === "raise" ? rep(0.25, 1.2) : rep(0.2, 1.2);
        const effort = lifting ? u : 0, release = lifting ? 0 : u;
        F.puff = effort; F.lid = Math.max(F.lid, 0.35 * effort); F.browIn = -0.35 * effort + 0.3 * release; F.brow = 6 * release;
        F.sweat = Math.max(F.sweat, sweat);
        mouth = release > 0.25 ? { oMouth: 1, mouthRaw: 0.3 + 0.4 * release } : { oMouth: 0, mouthRaw: 0, mouth: 0.05 };
      } else if (S.act === "run") {
        // panting: mouth open, tongue out a little, fast breath
        const pant = 0.45 + 0.35 * Math.abs(Math.sin(lt * 15));
        F.brow = 4; F.tongue = Math.min(1, lt / 0.8); F.sweat = Math.max(F.sweat, sweat);
        mouth = { oMouth: 0, mouthRaw: pant, mouth: F.rest + (1 - F.rest) * pant };
      } else if (S.act === "box") {
        // focused, then "ha!" on every punch
        const ph = (lt / 0.45) % 1, ext = ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI / 2) : 1 - (ph - 0.35) / 0.65;
        F.browIn = -0.8; F.lid = Math.max(F.lid, 0.28); F.smirk = 0.25 * (1 - ext);
        mouth = ext > 0.6 ? { oMouth: 1, mouthRaw: 0.7 } : { oMouth: 0, mouthRaw: 0.1, mouth: 0.15 };
      } else if (S.act === "jacks") {
        // enjoying it: big smile, smiling eyes, quick breaths
        const br = 0.35 + 0.3 * Math.abs(Math.sin(lt * 9));
        F.cheek = 0.55; F.brow = 7; F.rest = 0.66;
        mouth = { oMouth: 0, mouthRaw: br, mouth: 0.66 + 0.34 * br };
      } else if (S.act === "grab") { // surprise, then straining under the weight
        const heavy = Math.min(1, Math.max(0, (lt - 0.5) / 0.35));
        F.brow = 6 * (1 - heavy); F.puff = 0.85 * heavy; F.lid = Math.max(F.lid, 0.4 * heavy); F.browIn = -0.7 * heavy; F.sweat = Math.max(F.sweat, heavy);
        mouth = heavy > 0.3 ? { oMouth: 0, mouthRaw: 0, mouth: 0.05 } : { oMouth: 1, mouthRaw: 0.3 };
      } else if (S.act === "doubleflex") { F.smirk = 1; F.cheek = 0.4; F.sparkle = 1; F.happy = 0; }
      else if (S.act === "lotus") { F.happy = 1; F.browIn = 0.15; F.brow = 3; F.rest = 0.6; F.cheek = 0.3; }
      else if (S.act === "tree") { F.happy = 1; F.cheek = 0.3; F.rest = 0.6; }
      else if (S.act === "swim") { // holds her breath (puffed cheeks), then a quick breath every stroke
        const breathe = (lt / 1.1) % 1 > 0.62 && (lt / 1.1) % 1 < 0.88;
        F.puff = breathe ? 0 : 0.8; F.lid = Math.max(F.lid, breathe ? 0 : 0.3); F.brow = 4;
        mouth = breathe ? { oMouth: 1, mouthRaw: 0.6 } : { oMouth: 0, mouthRaw: 0, mouth: 0.05 };
      }
      else if (S.act === "pilates") { F.lid = Math.max(F.lid, 0.2); F.cheek = 0.4; F.rest = 0.6; }
      else if (S.act === "warrior") { F.browIn = -0.45; F.lid = Math.max(F.lid, 0.22); F.rest = 0.5; F.smirk = 0.4; }
      else if (S.act === "bellydance") { F.smirk = 0.55; F.cheek = 0.5; F.brow = 5; F.wink = lt > ACTION_CUES.bellydance - 0.9 ? 1 : 0; }
      else if (S.act === "rope" || S.act === "hoop" || S.act === "cheer") {
        const br = 0.35 + 0.3 * Math.abs(Math.sin(lt * 9));
        F.cheek = 0.55; F.brow = 7; F.rest = 0.66;
        mouth = { oMouth: 0, mouthRaw: br, mouth: 0.66 + 0.34 * br };
      } else if (S.act === "selfie") { F.wink = 1; F.cheek = 0.6; mouth = lt < 1.4 ? { oMouth: 1, mouthRaw: 0.14 } : {}; }
      else if (S.act === "hearthands") { F.heart = Math.min(1, lt / 0.4); F.blush = 0.7; F.cheek = 0.5; F.rest = 0.7; }
      else if (S.act === "kiss") { F.wink = 1; F.blush = 0.6; mouth = lt < 0.9 ? { oMouth: 1, mouthRaw: 0.12 } : {}; }
      else if (S.act === "drink") { F.happy = Math.min(1, lt / 0.4) * 0.9; mouth = { oMouth: 1, mouthRaw: 0.35 }; }
      else if (S.act === "eat") { const bite = Math.abs(Math.sin(lt * 9)); F.cheek = 0.5; if (lt > 0.35) mouth = { oMouth: 0, mouthRaw: bite * 0.9, mouth: F.rest + (1 - F.rest) * bite * 0.9 }; }
      // ---- football faces ----
      else if (S.act === "kick" || S.act === "keeper") { F.browIn = -0.6; F.lid = Math.max(F.lid, 0.22); F.rest = 0.3; F.cheek = 0; }
      else if (S.act === "juggle") { F.down = 5; F.tongue = 0.5; F.rest = 0.45; F.browIn = 0.2; }
      else if (S.act === "dive") { F.eye = 1.1; F.eyeY = 1.1; F.o = 1; F.brow = 10; }
      else if (S.act === "hit" || S.act === "crash") {
        // eyes squeezed at the impact, then dizzy (spiral eyes + stars) while he lies there
        const dz = Math.min(1, Math.max(0, (lt - 0.6) / 0.3));
        F.lid = lt < 0.6 ? 1 : 0; F.spiral = dz; F.brow = 4; F.cheek = 0; F.happy = 0;
        mouth = lt < 0.6 ? { oMouth: 1, mouthRaw: 0.6 } : { oMouth: 0, mouthRaw: 0.15, mouth: 0.3 };
      }
      // ---- personality kit faces (bible.md) ----
      else if (S.act === "no" || S.act === "stubborn") { F.frown = 0.8; F.browIn = -0.6; F.lid = Math.max(F.lid, 0.3); F.rest = 0.25; F.mouthW = 0.75; F.cheek = 0; }
      else if (S.act === "nod" || S.act === "serious" || S.act === "protect") { F.browIn = -0.7; F.brow = -1; F.lid = Math.max(F.lid, 0.22); F.rest = 0.3; F.mouthW = 0.9; F.cheek = 0; F.smirk = 0; }
      else if (S.act === "drama") { F.lid = 1; F.browIn = 1.4; F.brow = 4; F.tears = 1; F.cheek = 0; mouth = { oMouth: 1, mouthRaw: 0.35 }; }
      else if (S.act === "sulk") { F.lid = Math.max(F.lid, 0.5); F.smirk = 0.6; F.browIn = -0.4; F.look = 8; F.cheek = 0; F.rest = 0.3; }
      else if (S.act === "diva") {
        // three quick flutters of the lashes, a pleased little smile, rosy
        const fl = lt > 0.2 && lt < 0.85 ? Math.abs(Math.sin((lt - 0.2) * 14.5)) : 0;
        F.blush = 0.7; F.cheek = 0.6; F.rest = 0.66; F.brow = 7; F.smirk = 0.3; F.look = -3;
        mouth = { blink: Math.max(P0.blink, fl) };
      }
      else if (S.act === "cough" || S.act === "toldyou") { F.lid = Math.max(F.lid, 0.5); F.smirk = 1.1; F.browTilt = 10; F.cheek = 0.35; F.happy = 0; mouth = { oMouth: 0, mouthRaw: 0, mouth: 0.08 }; }
      else if (S.act === "eyeroll") { F.lid = Math.max(F.lid, 0.4); F.smirk = 0.5; F.rest = 0.3; F.cheek = 0; }
      else if (S.act === "wow") { F.star = 1; F.sparkle = 1; F.eye = 1.12; F.eyeY = 1.12; F.brow = 10; F.rest = 0.75; F.cheek = 0.3; }
      else if (S.act === "plan") { F.brow = 8; F.rest = 0.7; F.cheek = 0.5; F.sparkle = lt > 1.0 ? 1 : 0.3; F.browIn = -0.3; }
      else if (S.act === "tap" || S.act === "impatient") { F.browIn = -0.6; F.lid = Math.max(F.lid, 0.4); F.rest = 0.25; F.mouthW = 0.7; F.frown = 0.35; F.smirk = 0.35; F.cheek = 0; }
      else if (S.act === "oops") { F.happy = 1; F.rest = 0.8; F.sweat = Math.max(F.sweat, 0.7); F.brow = 6; F.browIn = 0.5; F.cheek = 0.5; }
      else if (S.act === "hungry") { F.heart = 1; F.tongue = 0.6; F.rest = 0.7; F.cheek = 0.4; F.brow = 6; }
      else if (S.act === "yawn") {
        const u = Math.min(1, lt / 0.5) * (1 - Math.max(0, Math.min(1, (lt - 1.6) / 0.5))) * Math.max(0, Math.min(1, (S.actDur - lt) / 0.3));
        F.lid = Math.max(u, lt > 1.6 ? 0.5 : 0); F.brow = 6 * u; F.cheek = 0;
        mouth = { oMouth: u, mouthRaw: u, mouth: F.rest + (1 - F.rest) * u };
      }
      else if (S.act === "nudge") { F.wink = 1; F.smirk = 0.8; F.cheek = 0.4; F.brow = 5; }
      else if (S.act === "scared") { F.eye = 0.92; F.pupil = 5; F.eyeY = 1.1; F.browIn = 1.3; F.brow = 6; F.sweat = Math.max(F.sweat, 1); F.grit = 0.6; F.cheek = 0; F.rest = 0.3; }
      else { F.grit = P0.F.grit; F.happy = P0.F.happy; }
      const fw = Math.max(0, Math.min(1, lt / 0.25, (S.actDur - lt) / 0.25));
      const Fb = { ...P0.F };
      for (const key of Object.keys(F) as (keyof typeof F)[]) Fb[key] = P0.F[key] + (F[key] - P0.F[key]) * fw;
      const mb: Record<string, number> = {};
      for (const [key, v] of Object.entries(mouth)) { const v0 = (P0 as unknown as Record<string, number>)[key]; mb[key] = v0 + ((v as number) - v0) * fw; }
      P = { ...P0, F: Fb, ...mb };
    }
    return { who, c, P, S, view: views[i], accent: c.colors?.coin ?? VARIANTS[kindFor(who, c)].coin };
  });
  // high five: aim each inner hand at the midpoint between the two coins (inverse of the coin's yaw), so they touch
  if (duo && rigs.length === 2 && legacyOf(rigs[0].c) && rigs.every((r) => r.S.visible) && rigs.some((r) => r.S.hf)) {
    const [A, B] = rigs;
    const mx = (A.S.px + B.S.px) / 2, my = Math.min(A.S.py - A.S.r * 0.95, B.S.py - B.S.r * 0.95);
    for (const R of rigs) {
      if (!R.S.hf) continue;
      const k = UNIT * R.S.size, z = 0.32;
      const dxw = (mx - R.S.px) / k, dyw = -(my - R.S.py) / k;
      const cy = Math.cos(R.S.yaw), sy = Math.sin(R.S.yaw);
      const xl = Math.abs(cy) > 0.2 ? (dxw - z * sy) / cy : dxw;
      const target = { x: 190 + xl * 130, y: 222 - dyw * 130, a: R.who === "mr" ? 30 : -30, z, pose: "open" as HandPose };
      R.S.hands = R.who === "mr" ? { R: target } : { L: target };
      if (R.who === "mr" && R.S.hf > 0.45 && R.S.hf < 0.7) R.S.fx.push({ name: "impact", lt: (R.S.hf - 0.45) * ACTION_CUES.highfive, x: mx, y: my });
    }
  }
  // ---- the render "look" (batch 1, on by default; presenter.look.<key> = false turns one off) ----
  const look = { shadow: true, blur: true, rim: true, ...(cfg.look ?? {}) };
  // motion blur: the coin's screen speed since the last frame -> a directional (x/y) blur, only when he moves fast
  let mbx = 0, mby = 0;
  if (look.blur) for (let i = 0; i < rigs.length; i++) {
    const R = rigs[i], dt = 1 / fps;
    if (!R.S.visible || t < dt) continue;
    const Sp = rigState(tl, views[i], t - dt, R.who, duo, R.c, coinPose(views[i], t - dt, fps, R.c), members[i].enterAt);
    // light: a hint of speed, never a smear (owner 2026-10-28: the old 14 px blur was too heavy on the eyes)
    const k = 30 / fps * 0.14; // same blur at 30 and 60 fps
    mbx = Math.max(mbx, Math.min(4.5, Math.abs(R.S.px - Sp.px) * k)); mby = Math.max(mby, Math.min(4.5, Math.abs(R.S.py - Sp.py) * k));
  }
  const blurOn = mbx + mby > 0.8;
  // batch 2: on footage the key light comes from the brighter side, tinted and as bright as the room (make.mjs probe)
  const scNowT = tl.scenes.find((sc) => t >= sc.start && t < sc.end);
  const pl = look.light !== false && scNowT?.footage?.light !== false ? scNowT?.footage?.probe?.light : undefined;
  const tint = pl ? "#" + new THREE.Color("#ffffff").lerp(new THREE.Color(pl.color), 0.55).getHexString() : "#ffffff";
  const keyPos: [number, number, number] = pl ? [pl.x * 5 + (pl.x === 0 ? -4 : 0), 5, 4] : [-4, 5, 4];
  const lvl = pl ? 0.75 + 0.5 * Math.min(1, pl.level / 0.45) : 1;
  const glow = rigs[0]?.accent ?? "#D6FF3C";
  // the ball (only when the video has one): crisp (the coins' motion blur is not fed by it), spin + its shadow sell the flight
  const ball = ballAt(tl, t);
  const ballRamp = useMemo(toonRamp, []);
  // look.match (opt-in, 2026-11-11): on footage he comes a little toward the picture he stands in: less saturated in a
  // grey room, a touch darker in a dark one, edges as soft as the photo's (measured by make.mjs: footage.probe.plate)
  const pm = look.match === true && scNowT?.footage?.light !== false ? scNowT?.footage?.probe?.plate : undefined;
  const c01 = (x: number) => Math.max(0, Math.min(1, x));
  const matchF = pm ? `saturate(${(1 - 0.28 * c01((0.4 - pm.sat) / 0.4)).toFixed(3)}) brightness(${(1 - 0.12 * c01((0.5 - pm.lum) / 0.5)).toFixed(3)}) blur(${(0.9 * c01((90 - pm.sharp) / 60)).toFixed(2)}px)` : "";
  const filters = [matchF, blurOn ? "url(#coin-mb)" : "", look.rim ? `drop-shadow(0 0 16px ${glow}2a)` : ""].filter(Boolean).join(" ");
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, pointerEvents: "none" }}>
      {/* contact shadows on the ground (paper stage or real floor), smaller and lighter the higher he is */}
      {look.shadow && scNowT?.floor !== false && rigs.map((R) => {
        if (!R.S.visible || R.S.vis < 0.05) return null;
        const lift = Math.max(0, R.S.groundY - R.S.r * 1.55 - R.S.py), h = Math.min(1, lift / (R.S.r * 3.5));
        const w = R.S.r * 2.1 * (1 - 0.45 * h), o = 0.75 * (1 - h) * (1 - R.S.flying) * (1 - R.S.eOut);
        if (o < 0.02) return null;
        return <div key={`sh-${R.who}`} style={{ position: "absolute", left: R.S.px - w / 2, top: R.S.groundY - w * 0.08, width: w, height: w * 0.16, borderRadius: "50%", background: "#000", opacity: o * 0.55, filter: `blur(${(4 + 10 * h).toFixed(1)}px)` }} />;
      })}
      {ball && (() => {
        const h = Math.min(1, ball.air / (ball.r * 8)), w = ball.r * 2.2 * (1 - 0.5 * h);
        return <div style={{ position: "absolute", left: ball.x - w / 2, top: ball.ground - w * 0.1, width: w, height: w * 0.2, borderRadius: "50%", background: "#000", opacity: 0.45 * (1 - 0.7 * h), filter: `blur(${(2 + 5 * h).toFixed(1)}px)` }} />;
      })()}
      {/* batch 2: he gives off a little light of his own on the real floor (the Miss Minutes trick) */}
      {scNowT?.footage && scNowT?.floor !== false && look.emit !== false && rigs.map((R) => R.S.visible && R.S.vis > 0.05 ? (
        <div key={`em-${R.who}`} style={{ position: "absolute", left: R.S.px - R.S.r * 1.8, top: R.S.groundY - R.S.r * 0.6, width: R.S.r * 3.6, height: R.S.r * 1.2, borderRadius: "50%", background: `radial-gradient(closest-side, ${R.accent}33, ${R.accent}00)`, opacity: (1 - R.S.flying) * (1 - R.S.eOut) }} />
      ) : null)}
      {blurOn && <svg width={0} height={0} style={{ position: "absolute" }}><filter id="coin-mb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={`${mbx.toFixed(2)} ${mby.toFixed(2)}`} /></filter></svg>}
      <div style={{ position: "absolute", inset: 0, filter: filters || undefined }}>
      <ThreeCanvas width={W} height={H} camera={{ fov: FOV, position: [0, 0, dist], near: 0.1, far: 200 }} gl={{ alpha: true, antialias: true }} flat>
        {/* sky / ground light: the undersides (legs, lower rim) take a cool tone instead of a darker copy of the same hue */}
        {look.volume !== false
          ? <hemisphereLight intensity={0.95 * (pl ? 0.85 + 0.25 * (lvl - 0.75) : 1)} color={tint} groundColor="#8FA7B8" />
          : <ambientLight intensity={0.9 * (pl ? 0.85 + 0.25 * (lvl - 0.75) : 1)} color={tint} />}
        <directionalLight position={keyPos} intensity={2.1 * lvl} color={tint} />
        <directionalLight position={[5, -2, 2]} intensity={0.35} />
        {look.rim && <directionalLight position={[3, 4, -6]} intensity={1.6} />}
        {rigs.map((r) => <CoinRig key={r.who} t={t} cfg={r.c} who={r.who} P={r.P} S={r.S} view={r.view} duo={duo} full={tl} />)}
        {rigs.find((r) => r.c.press?.role === "push" && r.c.press.mesh !== false) && <LegPress p={rigs.find((r) => r.c.press?.role === "push")!.c.press!} t={t} ramp={ballRamp} />}
        {ball && <BallMesh x={ball.x} y={ball.y} r={ball.r} spin={ball.spin} ramp={ballRamp} />}
      </ThreeCanvas>
      </div>
      <CoinFX t={t} rigs={rigs} />
    </div>
  );
};

/** test hook: the pure motion functions, so scripts/motion-check can sample them frame by frame */
export const __probe = { rigState, liveRig, composeHands, naturalHands, planHands, viewFor, castOf, kindFor, ballAt, cameraAt, ACTION_CUES };
