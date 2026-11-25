import React from "react";
import * as THREE from "three";
import { Part, box, circle, cyl, rbox, sphere } from "./parts";
import { clamp, hash, lerp } from "./anim";
import { mixC } from "./zander";
import { prismGeo } from "./mob";
import { REF } from "./pilatesTiming";

// Set pieces for FactPilates (videos/pilates-bed): a Reformer that turns into an old iron hospital bed and back,
// coil springs that stretch, the studio / hut room, the camp, the island. Pure functions of their props.

export type V3 = [number, number, number];

export const PPAL = {
  floor: "#E6CDA3",
  wall: "#F6F1E8",
  wallTrim: "#E4D9C8",
  glass: "#E2EEF8",
  winFrame: "#FFFFFF",
  maple: "#D8B888",
  mapleDark: "#B8945F",
  rail: "#BFC5CC",
  pad: "#4C5664",
  padTop: "#5A6676",
  chrome: "#D3D8DF",
  strap: "#2D2E33",
  springs: ["#E5544C", "#3F7FD8", "#3FA65B", "#EBC13C"],
  plank: "#8B6546",
  plankDark: "#6C4D35",
  iron: "#E9E6DD",
  ironShade: "#C9C5BA",
  mattress: "#DCD3C0",
  ticking: "#A7B3C1",
  pillow: "#F4F1EA",
  blanket: "#7E8794",
  bars: "#3B3A38",
  pot: "#E8E1D4",
  leaf: "#4F9B5C",
  leafDark: "#3A7C48",
  grass: "#7C8A68",
  mud: "#B9B2A0",
  hutWall: "#9E8B72",
  roof: "#77736C",
  sea: "#4C6472",
  sand: "#D8CDAE",
  land: "#A3AE86",
  post: "#5A4632",
  wire: "#4A4A4A",
  light: "#FFF8E6",
};

// ---------------------------------------------------------------- springs
const helixCache = new Map<string, THREE.BufferGeometry>();
/** A coil spring along +y from 0 to len (radius r, `turns` coils, hooks at both ends). Cached by rounded length. */
const helixGeo = (len: number, r: number, turns: number, tube: number) => {
  const L = Math.max(0.02, Math.round(len * 50) / 50);
  const k = `${L}:${r}:${turns}:${tube}`;
  let g = helixCache.get(k);
  if (!g) {
    const pts: THREE.Vector3[] = [];
    const hook = Math.min(0.08, L * 0.15);
    pts.push(new THREE.Vector3(0, 0, 0));
    const n = Math.max(24, Math.round(turns * 14));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const a = u * turns * Math.PI * 2;
      pts.push(new THREE.Vector3(r * Math.cos(a), hook + (L - 2 * hook) * u, r * Math.sin(a)));
    }
    pts.push(new THREE.Vector3(0, L, 0));
    g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n + 8, tube, 6, false);
    helixCache.set(k, g);
  }
  return g;
};
const UP = new THREE.Vector3(0, 1, 0);
/** A spring stretched between two points (its coils open up when it is pulled). */
export const Spring: React.FC<{ a: V3; b: V3; r?: number; turns?: number; tube?: number; color: string; glow?: number }> = ({ a, b, r = 0.055, turns = 12, tube = 0.014, color, glow = 0 }) => {
  const A = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(A);
  const len = d.length();
  if (len < 0.01) return null;
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  return (
    <group position={a} rotation={[e.x, e.y, e.z]}>
      <Part geo={helixGeo(len, r, turns, tube)} color={color} rough={0.35} emissive={glow > 0 ? "#FFF3B0" : undefined} emissiveIntensity={glow * 0.9} />
    </group>
  );
};

// ---------------------------------------------------------------- the Reformer <-> iron hospital bed
/** 0 = Reformer, 1 = bed, per piece (they change one after the other). */
export type Morph = { legs: number; mat: number; head: number; foot: number; springs: number; straps: number };
export const asReformer: Morph = { legs: 0, mat: 0, head: 0, foot: 0, springs: 0, straps: 0 };
export const asBed: Morph = { legs: 1, mat: 1, head: 1, foot: 1, springs: 1, straps: 1 };

export const BED = { L: 3.6, W: 1.2, top: 1.02, matT: 0.16, headH: 2.05, footH: 1.55 };
/** Mattress top height of a piece in the middle of the change. */
export const matTop = (m: Morph) => lerp(REF.carY + REF.carT, BED.top + BED.matT, m.mat);
/** World-space spring deck coil i (bed): local x, used for the coil that is pulled out. */
export const DECK_X = [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25];

const sq = (v: number) => Math.max(0.0001, v);

/**
 * Local frame: x from the foot end (-L/2) to the head end (+L/2), y up, the camera-facing side is -z.
 * `slide` = carriage travel toward the head end. `glow` lights the Reformer springs («بسوست»).
 * `pulled` = deck coils already taken out (they are drawn by the scene where they are now).
 */
export const RefBed: React.FC<{ m: Morph; slide: number; glow?: number; pulled?: number[]; ghostStraps?: number }> = ({ m, slide, glow = 0, pulled = [] }) => {
  const L = lerp(REF.L, BED.L, m.legs);
  const W = lerp(REF.W, BED.W, m.legs);
  const railY = lerp(REF.railY, BED.top, m.legs);
  const frameC = mixC(PPAL.maple, PPAL.iron, m.legs);
  const railC = mixC(PPAL.rail, PPAL.iron, m.legs);
  const nodes: React.ReactNode[] = [];
  // legs (short wooden feet -> tall white iron legs with little casters)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const h = railY;
      nodes.push(<Part key={`lg${sx}${sz}`} geo={rbox(lerp(0.16, 0.07, m.legs), h, lerp(0.16, 0.07, m.legs), 0.02)} color={frameC} position={[sx * (L / 2 - 0.1), h / 2, sz * (W / 2 - 0.05)]} />);
      if (m.legs > 0.05) nodes.push(<Part key={`cs${sx}${sz}`} geo={sphere(0.06, 10)} color={PAL_DARK} position={[sx * (L / 2 - 0.1), 0.06, sz * (W / 2 - 0.05)]} scale={m.legs} />);
    }
  // side rails + end rails
  for (const sz of [-1, 1]) nodes.push(<Part key={`sr${sz}`} geo={rbox(L, lerp(0.14, 0.06, m.legs), lerp(0.12, 0.06, m.legs), 0.02)} color={sz < 0 ? frameC : frameC} position={[0, railY, sz * (W / 2 - 0.05)]} />);
  // Reformer: the metal tracks inside the wooden frame
  if (m.legs < 0.95) for (const sz of [-1, 1]) nodes.push(<Part key={`tr${sz}`} geo={box(L - 0.3, 0.05, 0.08)} color={railC} position={[0, railY + 0.07, sz * (W / 2 - 0.2)]} scale={[1, sq(1 - m.legs), 1]} />);
  for (const sx of [-1, 1]) nodes.push(<Part key={`er${sx}`} geo={rbox(lerp(0.12, 0.06, m.legs), lerp(0.14, 0.06, m.legs), W, 0.02)} color={frameC} position={[sx * (L / 2 - 0.05), railY, 0]} />);

  // carriage (dark padded, sliding) -> thin mattress
  const carX = lerp(REF.rest + slide, 0, m.mat);
  const carL = lerp(REF.carL, BED.L - 0.15, m.mat);
  const carW = lerp(0.98, BED.W - 0.08, m.mat);
  const carT = lerp(REF.carT, BED.matT, m.mat);
  const carY = lerp(REF.carY, BED.top, m.mat);
  nodes.push(<Part key="car" geo={rbox(carL, carT, carW, 0.06)} color={mixC(PPAL.pad, PPAL.mattress, m.mat)} position={[carX, carY + carT / 2, 0]} />);
  if (m.mat > 0.4) for (let i = 0; i < 5; i++) nodes.push(<Part key={`tk${i}`} geo={box(0.03, 0.005, carW - 0.04)} color={PPAL.ticking} position={[-1.3 + i * 0.6, carY + carT + 0.003, 0]} scale={[1, 1, clamp((m.mat - 0.4) / 0.6)]} shadow={false} />);
  // the carriage's wheels box under it (Reformer)
  if (m.mat < 0.95) nodes.push(<Part key="carb" geo={box(REF.carL - 0.2, 0.08, 0.8)} color={PPAL.strap} position={[REF.rest + slide, REF.carY - 0.03, 0]} scale={[1, 1, sq(1 - m.mat)]} />);
  // shoulder blocks + headrest at the head end of the carriage -> the pillow
  const hx = REF.rest + slide + REF.carL / 2;
  const sb = 1 - m.mat;
  if (sb > 0.02)
    for (const sz of [-1, 1]) nodes.push(<Part key={`sb${sz}`} geo={rbox(0.16, 0.3, 0.2, 0.06)} color={PPAL.padTop} position={[hx - 0.16, REF.carY + REF.carT + 0.15 * sb, sz * 0.2]} scale={[1, sq(sb), 1]} />);
  if (sb > 0.02) nodes.push(<Part key="hr" geo={rbox(0.12, 0.12, 0.3, 0.04)} color={PPAL.padTop} position={[hx - 0.02, REF.carY + REF.carT + 0.04, 0]} scale={sq(sb)} />);
  if (m.mat > 0.02) nodes.push(<Part key="pillow" geo={rbox(0.5, 0.14, 0.75, 0.07)} color={PPAL.pillow} position={[L / 2 - 0.45, BED.top + BED.matT + 0.06, 0]} scale={sq(m.mat)} />);

  // head end: two risers with pulleys and the straps (Reformer) -> the tall headboard with bars (bed)
  const postH = lerp(1.45, BED.headH, m.head);
  const postC = mixC(PPAL.maple, PPAL.iron, m.head);
  for (const sz of [-1, 1]) {
    nodes.push(<Part key={`hp${sz}`} geo={rbox(lerp(0.12, 0.08, m.head), postH, lerp(0.12, 0.08, m.head), 0.03)} color={postC} position={[L / 2 - 0.08, postH / 2, sz * (W / 2 - 0.05)]} />);
    nodes.push(<Part key={`hk${sz}`} geo={sphere(lerp(0.08, 0.07, m.head), 12)} color={m.head < 0.5 ? PPAL.chrome : PPAL.ironShade} position={[L / 2 - 0.08, postH + 0.02, sz * (W / 2 - 0.05)]} />);
  }
  if (m.head > 0.02) {
    const k = m.head;
    nodes.push(<Part key="htop" geo={rbox(0.07, 0.07, W, 0.03)} color={PPAL.iron} position={[L / 2 - 0.08, postH - 0.12, 0]} scale={[1, 1, sq(k)]} />);
    nodes.push(<Part key="hmid" geo={rbox(0.06, 0.06, W, 0.03)} color={PPAL.iron} position={[L / 2 - 0.08, BED.top + 0.35, 0]} scale={[1, 1, sq(k)]} />);
    for (let i = 0; i < 5; i++) {
      const z = (i - 2) * (W / 6);
      const h = postH - 0.12 - (BED.top + 0.35);
      nodes.push(<Part key={`hb${i}`} geo={cyl(0.025, 0.025, h, 8)} color={PPAL.iron} position={[L / 2 - 0.08, BED.top + 0.35 + (h * k) / 2, z]} scale={[1, sq(k), 1]} />);
    }
  }
  // straps: ropes from the pulleys to loops lying on the frame (Reformer only)
  const st = 1 - m.straps;
  if (st > 0.02)
    for (const sz of [-1, 1]) {
      const top: V3 = [L / 2 - 0.08, 1.42, sz * (W / 2 - 0.05)];
      const loop: V3 = [L / 2 - 1.05, railY + 0.16, sz * (W / 2 - 0.12)];
      const mid: V3 = [(top[0] + loop[0]) / 2, (top[1] + loop[1]) / 2, (top[2] + loop[2]) / 2];
      const len = Math.hypot(top[0] - loop[0], top[1] - loop[1]);
      const ang = Math.atan2(top[1] - loop[1], top[0] - loop[0]);
      nodes.push(<Part key={`rope${sz}`} geo={box(len, 0.025, 0.025)} color={PPAL.strap} position={mid} rotation={[0, 0, ang]} scale={[1, st, st]} />);
      nodes.push(<Part key={`loop${sz}`} geo={rbox(0.32, 0.05, 0.18, 0.02)} color={PPAL.strap} position={loop} scale={sq(st)} />);
    }

  // foot end: the chrome footbar + standing platform (Reformer) -> the lower footboard with bars (bed)
  const fb = 1 - m.foot;
  const fx = -L / 2;
  if (fb > 0.02) {
    // standing platform
    nodes.push(<Part key="plat" geo={rbox(0.5, 0.08, W - 0.1, 0.03)} color={PPAL.padTop} position={[fx + 0.3, railY + 0.08, 0]} scale={[1, 1, sq(fb)]} />);
    // the footbar: two uprights + the bar, leaning toward the carriage
    for (const sz of [-1, 1]) nodes.push(<Part key={`fu${sz}`} geo={cyl(0.03, 0.03, 0.6, 10)} color={PPAL.chrome} position={[fx + 0.62, railY + 0.3 * fb, sz * (W / 2 - 0.12)]} rotation={[0, 0, -0.35]} scale={[1, sq(fb), 1]} rough={0.3} />);
    nodes.push(<Part key="fbar" geo={cyl(0.045, 0.045, W - 0.2, 12)} color={PPAL.chrome} position={[fx + 0.72, railY + 0.57 * fb, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, sq(fb)]} rough={0.3} />);
    // spring bar under the platform
    nodes.push(<Part key="sbar" geo={cyl(0.03, 0.03, W - 0.3, 10)} color={PPAL.chrome} position={[fx + 0.45, railY + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} />);
  }
  const footH = lerp(railY + 0.05, BED.footH, m.foot);
  if (m.foot > 0.02) {
    const k = m.foot;
    for (const sz of [-1, 1]) {
      nodes.push(<Part key={`fp${sz}`} geo={rbox(0.08, footH, 0.08, 0.03)} color={PPAL.iron} position={[fx + 0.08, footH / 2, sz * (W / 2 - 0.05)]} scale={[1, sq(k), 1]} />);
      nodes.push(<Part key={`fk${sz}`} geo={sphere(0.065, 12)} color={PPAL.ironShade} position={[fx + 0.08, footH * k + 0.02, sz * (W / 2 - 0.05)]} scale={sq(k)} />);
    }
    nodes.push(<Part key="ftop" geo={rbox(0.07, 0.07, W, 0.03)} color={PPAL.iron} position={[fx + 0.08, footH * k - 0.1, 0]} scale={[1, 1, sq(k)]} />);
    for (let i = 0; i < 5; i++) {
      const z = (i - 2) * (W / 6);
      const h = footH - 0.1 - BED.top;
      nodes.push(<Part key={`fbb${i}`} geo={cyl(0.025, 0.025, h, 8)} color={PPAL.iron} position={[fx + 0.08, BED.top + (h * k) / 2, z]} scale={[1, sq(k), 1]} />);
    }
  }

  // springs: the four coloured Reformer springs (carriage -> spring bar) -> the bed's coil deck under the mattress
  const sp = 1 - m.springs;
  if (sp > 0.02) {
    const cx = REF.rest + slide - REF.carL / 2 + 0.05;
    PPAL.springs.forEach((c, i) => {
      const z = (i - 1.5) * 0.17;
      const a: V3 = [fx + 0.45, railY + 0.02, z];
      const b: V3 = [lerp(a[0] + 0.05, cx, sp), REF.carY - 0.02, z];
      nodes.push(<Spring key={`rs${i}`} a={a} b={b} color={c} r={0.05 * sp} tube={0.013} turns={14} glow={glow} />);
    });
  }
  if (m.springs > 0.02) {
    const k = m.springs;
    for (const sz of [-0.3, 0.3])
      DECK_X.forEach((x, i) => {
        if (pulled.includes(sz > 0 ? i + 10 : i)) return; // a pulled coil (far row = index + 10) is drawn where it is now
        nodes.push(<Spring key={`ds${sz}${i}`} a={[x, BED.top - 0.2 * k, sz]} b={[x, BED.top + 0.01, sz]} color={PPAL.ironShade} r={0.1 * k} tube={0.014} turns={4} />);
      });
    // the wire grid the coils hang from
    nodes.push(<Part key="grid" geo={box(BED.L - 0.3, 0.02, BED.W - 0.2)} color={PPAL.ironShade} position={[0, BED.top - 0.2 * k, 0]} scale={[1, 1, sq(k)]} opacity={0.6} shadow={false} />);
  }
  return <>{nodes}</>;
};
const PAL_DARK = "#2A2A2E";

/** Bed-local positions the scene needs. */
export const BED_PTS = {
  headTop: (z: number): V3 => [BED.L / 2 - 0.08, BED.headH - 0.12, z],
  footTop: (z: number): V3 => [-BED.L / 2 + 0.08, BED.footH - 0.1, z],
};

// ---------------------------------------------------------------- the room: studio walls with windows, the hut's plank skin
export const ROOM = { x0: -7, x1: 7, zb: 1.2, zf: 15, h: 6.2 };
/** The studio's two tall windows in the back wall (x ranges); the hut window sits inside the first one. */
export const WIN = [
  { x0: -3.6, x1: -0.2 },
  { x0: 0.8, x1: 4.2 },
];
export const WIN_Y = [0.9, 5.3];
export const HUT_WIN = { x0: -2.15, x1: -0.75, y0: 2.2, y1: 3.6 };
export const DOOR = { z0: 5.6, z1: 7.4, h: 3.4 }; // the hut door in the left wall (x = ROOM.x0)

/** Back wall (z = zb) with two window openings; `glass` 0..1 = the studio's bright panes. */
export const Room: React.FC<{ glass: number; floorTex: THREE.Texture; plankTexW: THREE.Texture }> = ({ glass, floorTex }) => {
  const { x0, x1, zb, zf, h } = ROOM;
  const nodes: React.ReactNode[] = [];
  const W = x1 - x0;
  const D = zf - zb;
  nodes.push(
    <mesh key="floor" position={[0, 0.003, (zb + zf) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[W, D]} />
      <meshStandardMaterial map={floorTex} color={PPAL.floor} roughness={0.75} metalness={0} />
    </mesh>,
  );
  // back wall pieces around the openings (outer face brown planks for the outside shots)
  const piece = (a: number, b: number, y0: number, y1: number, k: string) => {
    nodes.push(<Part key={`bw${k}`} geo={box(b - a, y1 - y0, 0.3)} color={PPAL.wall} position={[(a + b) / 2, (y0 + y1) / 2, zb - 0.15]} shadow={false} />);
    nodes.push(<Part key={`bo${k}`} geo={box(b - a, y1 - y0, 0.05)} color={PPAL.hutWall} position={[(a + b) / 2, (y0 + y1) / 2, zb - 0.33]} shadow={false} />);
  };
  piece(x0, WIN[0].x0, 0, h, "a");
  piece(WIN[0].x1, WIN[1].x0, 0, h, "b");
  piece(WIN[1].x1, x1, 0, h, "c");
  for (const [i, w] of WIN.entries()) {
    piece(w.x0, w.x1, 0, WIN_Y[0], `d${i}`);
    piece(w.x0, w.x1, WIN_Y[1], h, `u${i}`);
    // frame + mullions
    const cx = (w.x0 + w.x1) / 2;
    const ww = w.x1 - w.x0;
    const wh = WIN_Y[1] - WIN_Y[0];
    nodes.push(<Part key={`wf${i}t`} geo={box(ww, 0.12, 0.2)} color={PPAL.winFrame} position={[cx, WIN_Y[1], zb]} />);
    nodes.push(<Part key={`wf${i}b`} geo={box(ww + 0.1, 0.12, 0.34)} color={PPAL.winFrame} position={[cx, WIN_Y[0], zb + 0.05]} />);
    for (const x of [w.x0, w.x1, cx]) nodes.push(<Part key={`wm${i}${x}`} geo={box(0.1, wh, 0.16)} color={PPAL.winFrame} position={[x, (WIN_Y[0] + WIN_Y[1]) / 2, zb]} scale={[1, glass > 0.02 || x !== cx ? 1 : 0.001, 1]} />);
    nodes.push(<Part key={`wt${i}`} geo={box(ww, 0.08, 0.14)} color={PPAL.winFrame} position={[cx, WIN_Y[0] + wh * 0.68, zb]} scale={[1, glass > 0.02 ? 1 : 0.001, 1]} />);
    if (glass > 0.02) nodes.push(<Part key={`wg${i}`} geo={box(ww, wh, 0.02)} color={PPAL.glass} basic opacity={0.93 * glass} position={[cx, (WIN_Y[0] + WIN_Y[1]) / 2, zb - 0.06]} shadow={false} />);
  }
  // side walls (the left one has the hut door opening)
  for (const sx of [-1, 1]) {
    const x = sx < 0 ? x0 : x1;
    if (sx < 0) {
      nodes.push(<Part key="swl1" geo={box(0.3, h, DOOR.z0 - zb)} color={PPAL.wall} position={[x - 0.15, h / 2, (zb + DOOR.z0) / 2]} shadow={false} />);
      nodes.push(<Part key="swl2" geo={box(0.3, h, zf - DOOR.z1)} color={PPAL.wall} position={[x - 0.15, h / 2, (DOOR.z1 + zf) / 2]} shadow={false} />);
      nodes.push(<Part key="swl3" geo={box(0.3, h - DOOR.h, DOOR.z1 - DOOR.z0)} color={PPAL.wall} position={[x - 0.15, (h + DOOR.h) / 2, (DOOR.z0 + DOOR.z1) / 2]} shadow={false} />);
    } else nodes.push(<Part key="swr" geo={box(0.3, h, D)} color={PPAL.wall} position={[x + 0.15, h / 2, (zb + zf) / 2]} shadow={false} />);
    // skirting
    nodes.push(<Part key={`sk${sx}`} geo={box(0.06, 0.18, D)} color={PPAL.wallTrim} position={[x - sx * 0.03, 0.09, (zb + zf) / 2]} />);
  }
  nodes.push(<Part key="skb" geo={box(W, 0.18, 0.06)} color={PPAL.wallTrim} position={[0, 0.09, zb + 0.03]} />);
  return <>{nodes}</>;
};

/**
 * The hut's skin: vertical planks rise out of the floor over the studio walls (k 0..1, staggered), leaving the barred
 * window and the door. `door` 0..1 opens the door (swings out, bright light behind).
 */
export const HutSkin: React.FC<{ k: number; door: number; seed?: number }> = ({ k, door }) => {
  if (k <= 0.001) return null;
  const { x0, x1, zb, h } = ROOM;
  const nodes: React.ReactNode[] = [];
  const pw = 0.42;
  const stag = (i: number) => clamp(k * 1.6 - hash(i * 3.1) * 0.6);
  // back wall planks
  let i = 0;
  for (let x = x0 + pw / 2; x < x1; x += pw, i++) {
    const s = stag(i);
    if (s <= 0.001) continue;
    const c = i % 3 === 0 ? PPAL.plankDark : PPAL.plank;
    const inWin = x > HUT_WIN.x0 - pw / 2 && x < HUT_WIN.x1 + pw / 2;
    if (inWin) {
      nodes.push(<Part key={`pb${i}a`} geo={box(pw - 0.02, HUT_WIN.y0, 0.06)} color={c} position={[x, (HUT_WIN.y0 * s) / 2, zb + 0.04]} scale={[1, s, 1]} />);
      nodes.push(<Part key={`pb${i}b`} geo={box(pw - 0.02, h - HUT_WIN.y1, 0.06)} color={c} position={[x, HUT_WIN.y1 + ((h - HUT_WIN.y1) * s) / 2, zb + 0.04]} scale={[1, s, 1]} />);
    } else nodes.push(<Part key={`pb${i}`} geo={box(pw - 0.02, h, 0.06)} color={c} position={[x, (h * s) / 2, zb + 0.04]} scale={[1, s, 1]} />);
  }
  // left / right wall planks
  for (const sx of [-1, 1]) {
    const x = sx < 0 ? x0 + 0.04 : x1 - 0.04;
    let j = 0;
    for (let z = zb + pw / 2; z < ROOM.zf; z += pw, j++) {
      const s = stag(j + (sx < 0 ? 100 : 200));
      if (s <= 0.001) continue;
      const c = j % 3 === 1 ? PPAL.plankDark : PPAL.plank;
      const inDoor = sx < 0 && z > DOOR.z0 - 0.05 && z < DOOR.z1 + 0.05;
      if (inDoor) nodes.push(<Part key={`ps${sx}${j}`} geo={box(0.06, h - DOOR.h, pw - 0.02)} color={c} position={[x, DOOR.h + ((h - DOOR.h) * s) / 2, z]} scale={[1, s, 1]} />);
      else nodes.push(<Part key={`ps${sx}${j}`} geo={box(0.06, h, pw - 0.02)} color={c} position={[x, (h * s) / 2, z]} scale={[1, s, 1]} />);
    }
  }
  // the barred window (frame + bars) and the door
  const kk = clamp(k * 1.3 - 0.3);
  if (kk > 0) {
    nodes.push(<HutWindow key="hw" k={kk} />);
    const dw = DOOR.z1 - DOOR.z0;
    nodes.push(
      <group key="door" position={[x0 + 0.06, 0, DOOR.z0]} rotation={[0, -door * 1.7, 0]} scale={[1, kk, 1]}>
        <Part geo={box(0.1, DOOR.h - 0.05, dw - 0.04)} color={PPAL.plankDark} position={[0, DOOR.h / 2, dw / 2]} />
        <Part geo={box(0.14, 0.18, dw - 0.1)} color={PPAL.plank} position={[0.03, DOOR.h * 0.3, dw / 2]} />
        <Part geo={box(0.14, 0.18, dw - 0.1)} color={PPAL.plank} position={[0.03, DOOR.h * 0.75, dw / 2]} />
      </group>,
    );
  }
  return <>{nodes}</>;
};

/** The hut's barred window (also left as a fading ghost on the studio wall: `ghost` = opacity). */
export const HutWindow: React.FC<{ k?: number; ghost?: number }> = ({ k = 1, ghost }) => {
  const { x0, x1, y0, y1 } = HUT_WIN;
  const z = ROOM.zb + 0.1;
  const op = ghost ?? 1;
  const basic = ghost !== undefined;
  const c = basic ? "#7A6C60" : PPAL.plankDark;
  const nodes: React.ReactNode[] = [];
  const fw = 0.12;
  nodes.push(<Part key="t" geo={box(x1 - x0 + 2 * fw, fw, 0.12)} color={c} position={[(x0 + x1) / 2, y1 + fw / 2, z]} basic={basic} opacity={op} shadow={!basic} />);
  nodes.push(<Part key="b" geo={box(x1 - x0 + 2 * fw, fw, 0.16)} color={c} position={[(x0 + x1) / 2, y0 - fw / 2, z]} basic={basic} opacity={op} shadow={!basic} />);
  nodes.push(<Part key="l" geo={box(fw, y1 - y0, 0.12)} color={c} position={[x0 - fw / 2, (y0 + y1) / 2, z]} basic={basic} opacity={op} shadow={!basic} />);
  nodes.push(<Part key="r" geo={box(fw, y1 - y0, 0.12)} color={c} position={[x1 + fw / 2, (y0 + y1) / 2, z]} basic={basic} opacity={op} shadow={!basic} />);
  // bars: the gap between the 2nd and 3rd bar is where the camera flies through
  [0.2, 0.5, 0.9, 1.2].forEach((dx, i) => nodes.push(<Part key={`bar${i}`} geo={cyl(0.03, 0.03, y1 - y0, 8)} color={basic ? "#4A4440" : PPAL.bars} position={[x0 + dx, (y0 + y1) / 2, z]} basic={basic} opacity={op} shadow={!basic} />));
  return <group scale={[1, k, 1]} position={[0, (1 - k) * y0, 0]}>{nodes}</group>;
};

// ---------------------------------------------------------------- outside: the hut shell, the camp, the island, the sea, England
const Hut: React.FC<{ position: V3; w?: number; d?: number; rot?: number }> = ({ position, w = 6, d = 11, rot = 0 }) => (
  <group position={position} rotation={[0, rot, 0]}>
    <Part geo={box(w, 3.2, d)} color={PPAL.hutWall} position={[0, 1.6, 0]} />
    <Part geo={prismGeo(w + 0.6, 1.8, d + 0.6)} color={PPAL.roof} position={[0, 3.2, 0]} />
    {[-1, 1].map((s) => (
      <Part key={s} geo={box(0.05, 0.8, 1.0)} color="#2E2B28" position={[s * (w / 2 + 0.02), 1.9, d * 0.2]} />
    ))}
  </group>
);

/** Our hut's outside: plank shell + roof over the room (the roof lifts away when `roofUp` > 0 for the dive). */
export const HutShell: React.FC<{ roofUp: number }> = ({ roofUp }) => {
  const { x0, x1, zb, zf, h } = ROOM;
  const w = x1 - x0 + 0.7;
  const d = zf - zb + 0.7;
  return (
    <>
      {/* outer side walls + front wall (the back wall's outer face is part of Room) */}
      <Part geo={box(0.12, h, d)} color={PPAL.hutWall} position={[x0 - 0.36, h / 2, (zb + zf) / 2]} shadow={false} />
      <Part geo={box(0.12, h, d)} color={PPAL.hutWall} position={[x1 + 0.36, h / 2, (zb + zf) / 2]} shadow={false} />
      <Part geo={box(w, h, 0.3)} color={PPAL.hutWall} position={[0, h / 2, zf + 0.2]} shadow={false} />
      {roofUp < 0.999 && (
        <group position={[0, h + 30 * roofUp * roofUp, (zb + zf) / 2]} scale={1 - 0.3 * roofUp}>
          <Part geo={prismGeo(w + 0.8, 3.4, d + 0.6)} color={PPAL.roof} shadow={false} />
        </group>
      )}
    </>
  );
};

/** The camp: rows of huts behind a wire fence, a watchtower; the island; the grey sea; England's coast far away. */
export const CampIsland: React.FC<{ frame: number }> = ({ frame }) => {
  const nodes: React.ReactNode[] = [];
  // huts: 4 rows behind our hut (z < 0) + 2 columns at the sides
  let n = 0;
  // the rows leave a lane in front of our barred window (the camera rises along it)
  for (const z of [-9, -22, -35])
    for (const x of [-28, -19, -10, 8, 17, 26]) nodes.push(<Hut key={`h${n++}`} position={[x, 0, z]} />);
  for (const x of [-26, -17, 17, 26]) nodes.push(<Hut key={`h${n++}`} position={[x, 0, 7]} />);
  // the fence: posts + three wires, a rectangle round the camp, and a line just outside our window
  const fence = (ax: number, az: number, bx: number, bz: number, key: string) => {
    const L = Math.hypot(bx - ax, bz - az);
    const nP = Math.max(2, Math.round(L / 3));
    const ang = Math.atan2(bz - az, bx - ax);
    for (let i = 0; i <= nP; i++) {
      const u = i / nP;
      nodes.push(<Part key={`${key}p${i}`} geo={box(0.16, 2.6, 0.16)} color={PPAL.post} position={[lerp(ax, bx, u), 1.3, lerp(az, bz, u)]} />);
    }
    for (const y of [0.8, 1.5, 2.2]) nodes.push(<Part key={`${key}w${y}`} geo={box(L, 0.035, 0.035)} color={PPAL.wire} position={[(ax + bx) / 2, y, (az + bz) / 2]} rotation={[0, -ang, 0]} shadow={false} />);
  };
  fence(-33, -3.2, 33, -3.2, "fi");
  fence(-33, -44, 33, -44, "fb");
  fence(-33, -44, -33, 18, "fl");
  fence(33, -44, 33, 18, "fr");
  fence(-33, 18, 33, 18, "ff");
  // a watchtower in the corner
  nodes.push(
    <group key="tower" position={[30, 0, -41]}>
      {[-1, 1].map((sx) => [-1, 1].map((sz) => <Part key={`${sx}${sz}`} geo={box(0.2, 7, 0.2)} color={PPAL.post} position={[sx * 1.1, 3.5, sz * 1.1]} />))}
      <Part geo={box(3, 0.2, 3)} color={PPAL.post} position={[0, 7, 0]} />
      <Part geo={prismGeo(3.4, 1.2, 3.4)} color={PPAL.roof} position={[0, 8.6, 0]} />
    </group>,
  );
  // camp ground, island, beach, sea
  nodes.push(<Part key="camp" geo={box(70, 0.1, 66)} color={PPAL.mud} position={[0, -0.05, -13]} shadow={false} />);
  nodes.push(<IslandShape key="isl" r={95} cx={-6} cz={-14} y={-0.12} color={PPAL.land} seed={1} />);
  nodes.push(<IslandShape key="beach" r={100} cx={-6} cz={-14} y={-0.2} color={PPAL.sand} seed={1} />);
  nodes.push(<Part key="sea" geo={box(6000, 0.2, 6000)} color={PPAL.sea} position={[0, -0.45, 0]} shadow={false} />);
  // England: a long coast to the east (+x), far away
  nodes.push(<IslandShape key="eng" r={620} cx={940} cz={-260} y={-0.2} color={PPAL.land} seed={7} rough={0.12} />);
  // slow wave glints
  for (let i = 0; i < 18; i++) {
    const a = hash(i * 7.7) * Math.PI * 2;
    const r = 130 + hash(i * 3.3) * 160;
    const s = 0.5 + 0.5 * Math.sin(frame * 0.05 + i);
    nodes.push(<Part key={`gl${i}`} geo={box(9, 0.05, 0.8)} color="#9DB1BC" basic opacity={0.5 * s} position={[-6 + Math.cos(a) * r, -0.32, -14 + Math.sin(a) * r]} rotation={[0, a, 0]} shadow={false} />);
  }
  return <>{nodes}</>;
};

const shapeCache = new Map<string, THREE.BufferGeometry>();
const IslandShape: React.FC<{ r: number; cx: number; cz: number; y: number; color: string; seed: number; rough?: number }> = ({ r, cx, cz, y, color, seed, rough = 0.18 }) => {
  const k = `${r}:${seed}:${rough}`;
  let g = shapeCache.get(k);
  if (!g) {
    const s = new THREE.Shape();
    const n = 72;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (1 + rough * (Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 7 + seed * 2.1) * 0.3 + Math.sin(a * 13 + seed * 0.7) * 0.2));
      const px = Math.cos(a) * rr * 1.25;
      const pz = Math.sin(a) * rr;
      if (i === 0) s.moveTo(px, pz);
      else s.lineTo(px, pz);
    }
    g = new THREE.ShapeGeometry(s, 4);
    shapeCache.set(k, g);
  }
  return <Part geo={g} color={color} position={[cx, y, cz]} rotation={[Math.PI / 2, 0, 0]} shadow={false} side={THREE.DoubleSide} />;
};

// ---------------------------------------------------------------- studio dressing
export const Plant: React.FC<{ position: V3; s?: number; frame: number }> = ({ position, s = 1, frame }) => (
  <group position={position} scale={s}>
    <Part geo={cyl(0.42, 0.32, 0.8, 18)} color={PPAL.pot} position={[0, 0.4, 0]} />
    {Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2;
      const sway = Math.sin(frame * 0.04 + i) * 0.04;
      return (
        <group key={i} position={[0, 0.75, 0]} rotation={[0, a, 0.5 + 0.25 * hash(i) + sway]}>
          <Part geo={sphere(0.3, 10)} color={i % 2 ? PPAL.leaf : PPAL.leafDark} position={[0, 0.75 + hash(i + 3) * 0.4, 0]} scale={[0.55, 1.5, 0.22]} />
        </group>
      );
    })}
  </group>
);

/** A rolled mat + a wall shelf with balls: the studio's small things. */
export const StudioBits: React.FC = () => (
  <>
    <Part geo={cyl(0.22, 0.22, 1.1, 16)} color="#B9A7D6" position={[5.9, 0.22, 3.0]} rotation={[0, 0, Math.PI / 2]} />
    <Part geo={cyl(0.22, 0.22, 1.1, 16)} color="#9FCBC0" position={[5.9, 0.66, 3.0]} rotation={[0, 0, Math.PI / 2]} />
    <Part geo={box(2.2, 0.08, 0.4)} color={PPAL.maple} position={[5.2, 2.2, ROOM.zb + 0.22]} />
    <Part geo={sphere(0.3, 16)} color="#E8B4C8" position={[4.6, 2.55, ROOM.zb + 0.25]} />
    <Part geo={sphere(0.26, 16)} color="#A9C9E8" position={[5.3, 2.5, ROOM.zb + 0.25]} />
    <Part geo={sphere(0.22, 16)} color="#F2D27A" position={[5.9, 2.46, ROOM.zb + 0.25]} />
  </>
);

export const circleGeo = circle;
