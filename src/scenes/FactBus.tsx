import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { Part, box, circle, cyl, rbox, torusArc } from "./fact3d/parts";
import { clamp, easeInOut, easeOut, hash, lerp, seg, springAt } from "./fact3d/anim";
import { alive, lerpPose, runnerPose, walkPose, wavePose } from "./fact3d/acting";
import { Building, StreetLamp } from "./fact3d/waffarha";
import { mixC } from "./fact3d/zander";
import { TPAL } from "./fact3d/tunnel";
import { Shot, ShotRig, dollyZoom, mixShot, orbit, whipBlur, whipPan } from "./fact3d/cameraMoves";
import { LimeWave, NBLUE, NCYAN, NPAL, NeonClock, Proj, projector } from "./fact3d/night";
import { BBeats, BUS_BEATS, BUS_DURATION, BusBeats, makeBusBeats } from "./fact3d/busTiming";
import { look, seated, PhoneInHand } from "./FactAlone";
import { loadFonts } from "../lib/fonts";

loadFonts();

// bus-conductor (2026-11-21): «كمسري الأتوبيس قلبه أسلم من السواق» (Morris 1953). Night neon theme (as gym-alone v2).
// The bus stands still in world space and drives +x: the street (buildings, lamps, the stop) slides by -x and stops at
// the stop on «دكتور». The near side (+z) of the bus is a cutaway (neon red frame + faint glass) so we see the
// conductor on the stairs at the back and the driver in his cab at the front.
//  1 the conductor running up the stairs -> the driver -> back to the stairs (they light up)
//  2 rise, colour drains (1953), «+70» -> the stop and the doctor -> orbit, rings under both -> the two decks
//  3 the driver sits, the cab clock runs a shift -> whip to the conductor, tickets fly
//  4 dolly zoom on the bus, hearts: 4 over the driver, 2 over the conductor, «½»
//  5 the conductor, «0 جنيه» -> whip pan to a gym today: a stair machine, «اشتراك»
//  6 back at the stop (coin part, the camera holds still): the driver waves, the destination sign becomes the real
//    running post, the lime wave, two runners jog in (2/4, 3/4), the conductor waves them on, tickets burst.

export type FactBusProps = { beats?: Partial<BusBeats>; durationSec?: number; debug?: boolean };
type V3 = [number, number, number];

const LIME = TPAL.lime;
const RED = "#C8202B";
const REDN = "#FF3B47"; // neon red
const CREAM = "#F1E3C2";
const WARM = "#FFD58A";
const INK = "#0E0F12";
const AR = "Cairo";

// ---------------------------------------------------------------- the bus (centre at x 0, front +x, near side +z)
const BL = 13;
const BW = 3.4;
const LF = 0.75; // lower floor
const UF = 3.75; // upper floor
const ROOF = 6.6;
const STAIR = { x0: -6.0, x1: -3.4, z: -1.0, w: 1.1, n: 10 };
const DRIVER: V3 = [5.45, LF + 0.55 - 0.84, -0.7];
const SIGN = { x: BL / 2 + 0.06, y: 3.62, w: 2.4, h: 1.37 };
const STOP_X = 1.2; // the shelter's x once the bus stands
const DOC: V3 = [8.6, 0.14, 3.6];
const COND_STOP: V3 = [5.0, 0.14, 3.0]; // the conductor on the pavement in the coin part
const PAVE = { z0: 2.55, z1: 12 };

const condS = (f: number) => {
  // 0 bottom .. 1 top: up 40 frames, 8 at the top, down 34, 8 at the bottom
  const per = 90;
  const k = ((f % per) + per) % per;
  if (k < 40) return { s: easeInOut(k / 40), up: true, move: true };
  if (k < 48) return { s: 1, up: true, move: false };
  if (k < 82) return { s: 1 - easeInOut((k - 48) / 34), up: false, move: true };
  return { s: 0, up: false, move: false };
};
const condPos = (s: number): V3 => [lerp(STAIR.x0 + 0.1, STAIR.x1 - 0.1, s), LF + 3.0 * s + 0.02, STAIR.z];

const Wheel: React.FC<{ position: V3; spin: number }> = ({ position, spin }) => (
  <group position={position} rotation={[Math.PI / 2, spin, 0]}>
    <Part geo={cyl(0.66, 0.66, 0.42, 22)} color="#15161A" />
    <Part geo={cyl(0.36, 0.36, 0.44, 16)} color="#9AA0AA" />
    <Part geo={box(0.1, 0.46, 0.62)} color="#5A606A" />
  </group>
);

/** a row of bus seats along x (backs toward -x), top at y LF+0.5 */
const Seats: React.FC<{ y: number; xs: number[]; z: number }> = ({ y, xs, z }) => (
  <group>
    {xs.map((x, i) => (
      <group key={i} position={[x, y, z]}>
        <Part geo={box(0.55, 0.5, 1.1)} color="#7A2A30" position={[0, 0.25, 0]} />
        <Part geo={box(0.14, 0.75, 1.1)} color="#8E3038" position={[-0.32, 0.75, 0]} />
      </group>
    ))}
  </group>
);

const Bus: React.FC<{ f: number; X: number; b: BBeats; lime: number; stairGlow: number; deckGlow: number; signLime: number }> = ({ f, X, lime, stairGlow, deckGlow, signLime }) => {
  const zN = BW / 2;
  const zF = -BW / 2;
  const neon = mixC(REDN, LIME, lime * 0.0);
  const spin = -X / 0.66;
  const bands = [0.35, 1.6, 3.0, 4.2, 5.7, ROOF];
  const nodes: React.ReactNode[] = [];
  // far wall: red bands + warm windows
  const band = (y0: number, y1: number, col: string, key: string, z: number) =>
    nodes.push(<Part key={key} geo={box(BL, y1 - y0, 0.1)} color={col} position={[0, (y0 + y1) / 2, z]} />);
  band(0.35, 1.6, RED, "fr1", zF);
  band(3.0, 4.2, RED, "fr3", zF);
  band(5.7, ROOF, RED, "fr5", zF);
  nodes.push(<Part key="fw1" geo={box(BL, 1.4, 0.06)} color={WARM} emissive={WARM} emissiveIntensity={0.55} position={[0, 2.3, zF - 0.02]} shadow={false} />);
  nodes.push(<Part key="fw2" geo={box(BL, 1.5, 0.06)} color={WARM} emissive={WARM} emissiveIntensity={0.55} position={[0, 4.95, zF - 0.02]} shadow={false} />);
  for (let x = -BL / 2; x <= BL / 2 + 0.01; x += 1.625) {
    nodes.push(<Part key={`fp${x}`} geo={box(0.14, 1.4, 0.12)} color={RED} position={[x, 2.3, zF + 0.03]} />);
    nodes.push(<Part key={`fq${x}`} geo={box(0.14, 1.5, 0.12)} color={RED} position={[x, 4.95, zF + 0.03]} />);
  }
  nodes.push(<Part key="cream" geo={box(BL, 0.14, 0.12)} color={CREAM} position={[0, 3.05, zF + 0.04]} />);
  // roof
  nodes.push(<Part key="roof" geo={rbox(BL, 0.3, BW, 0.14)} color={RED} position={[0, ROOF + 0.05, 0]} />);
  // floors (upper floor leaves the stairwell open)
  nodes.push(<Part key="lf" geo={box(BL, 0.12, BW)} color="#3A2B26" position={[0, LF - 0.06, 0]} />);
  const sx0 = STAIR.x0 - 0.3;
  const sx1 = STAIR.x1 + 0.15;
  nodes.push(<Part key="uf1" geo={box(BL / 2 - sx1, 0.14, BW)} color="#3A2B26" position={[(sx1 + BL / 2) / 2, UF - 0.07, 0]} />);
  nodes.push(<Part key="uf2" geo={box(sx1 + BL / 2, 0.14, BW - (STAIR.w + 0.4))} color="#3A2B26" position={[(sx1 - BL / 2) / 2, UF - 0.07, (STAIR.z + STAIR.w / 2 + 0.2 + zN) / 2]} />);
  void sx0;
  // stairs at the back, along the far side
  const stepW = (STAIR.x1 - STAIR.x0) / STAIR.n;
  for (let i = 0; i < STAIR.n; i++) {
    const h = (3.0 / STAIR.n) * (i + 1);
    const wave = stairGlow * clamp(1 - Math.abs(i / STAIR.n - (1 - stairGlow)) * 2);
    nodes.push(<Part key={`st${i}`} geo={box(stepW, h, STAIR.w)} color="#2C2F38" position={[STAIR.x0 + stepW * (i + 0.5), LF + h / 2, STAIR.z]} />);
    nodes.push(<Part key={`se${i}`} geo={box(stepW, 0.05, STAIR.w + 0.02)} color={mixC(NCYAN, "#FFFFFF", wave)} emissive={NCYAN} emissiveIntensity={0.5 + 2.5 * stairGlow} position={[STAIR.x0 + stepW * (i + 0.5), LF + h + 0.02, STAIR.z]} shadow={false} />);
  }
  // seats + the cab partition
  nodes.push(<Seats key="sl" y={LF} xs={[-2.4, -0.8, 0.8, 2.4]} z={0.6} />);
  nodes.push(<Seats key="su" y={UF} xs={[-1.6, 0, 1.6, 3.2, 4.8]} z={0.6} />);
  nodes.push(<Seats key="su2" y={UF} xs={[-1.6, 0, 1.6, 3.2, 4.8]} z={-0.9} />);
  nodes.push(<Part key="cabw" geo={box(0.1, 2.2, BW)} color="#3A1A1E" opacity={0.5} position={[4.6, LF + 1.1, 0]} shadow={false} />);
  nodes.push(<Part key="seatD" geo={box(0.6, 0.5, 0.7)} color="#7A2A30" position={[DRIVER[0], LF + 0.25, DRIVER[2]]} />);
  nodes.push(
    <group key="wheel" position={[DRIVER[0] + 0.62, LF + 1.25, DRIVER[2]]} rotation={[0, 0, 1.0]}>
      <Part geo={torusArc(0.28, 0.04, Math.PI * 2)} color="#1A1B20" rotation={[0, Math.PI / 2, 0]} />
    </group>,
  );
  // front face (+x): red bands, windscreen, the destination sign, headlights
  const fx = BL / 2;
  const front = (y0: number, y1: number, key: string) => nodes.push(<Part key={key} geo={box(0.12, y1 - y0, BW)} color={RED} position={[fx, (y0 + y1) / 2, 0]} />);
  front(0.35, 1.6, "ff1");
  front(5.7, ROOF, "ff5");
  nodes.push(<Part key="ffm1" geo={box(0.12, 1.2, (BW - SIGN.w) / 2)} color={RED} position={[fx, 3.6, (SIGN.w / 2 + BW / 2) / 2]} />);
  nodes.push(<Part key="ffm2" geo={box(0.12, 1.2, (BW - SIGN.w) / 2)} color={RED} position={[fx, 3.6, -(SIGN.w / 2 + BW / 2) / 2]} />);
  nodes.push(<Part key="wsc" geo={box(0.06, 1.4, BW)} color="#9FD0FF" opacity={0.14} position={[fx + 0.02, 2.3, 0]} shadow={false} />);
  nodes.push(<Part key="wsu" geo={box(0.06, 1.5, BW)} color="#9FD0FF" opacity={0.14} position={[fx + 0.02, 4.95, 0]} shadow={false} />);
  nodes.push(<Part key="fpil" geo={box(0.16, 4.3, 0.14)} color={RED} position={[fx + 0.02, 3.6, 0]} />);
  const sc = mixC(mixC("#2A1A08", "#FFB23F", 0.7), LIME, signLime);
  nodes.push(<Part key="sign" geo={box(0.1, SIGN.h, SIGN.w)} color={sc} emissive={signLime > 0 ? LIME : "#FFB23F"} emissiveIntensity={0.7 + 0.8 * signLime} position={[fx + 0.04, SIGN.y, 0]} shadow={false} />);
  for (const k of [-1, 1]) nodes.push(<Part key={`hl${k}`} geo={cyl(0.22, 0.22, 0.1, 16)} color="#FFF4D0" emissive="#FFF4D0" emissiveIntensity={1.6} rotation={[0, 0, Math.PI / 2]} position={[fx + 0.08, 0.85, k * 1.2]} shadow={false} />);
  nodes.push(<Part key="grill" geo={box(0.1, 0.5, 1.4)} color="#2A2C33" position={[fx + 0.06, 0.85, 0]} />);
  // back face (-x): the open platform at the near corner
  nodes.push(<Part key="bk" geo={box(0.12, ROOF - 0.35, BW - 1.5)} color={RED} position={[-fx, (ROOF + 0.35) / 2, zF + (BW - 1.5) / 2]} />);
  nodes.push(<Part key="bk2" geo={box(0.12, ROOF - 3.0, 1.5)} color={RED} position={[-fx, (ROOF + 3.0) / 2, zN - 0.75]} />);
  nodes.push(<Part key="pole" geo={cyl(0.05, 0.05, 2.3, 8)} color="#E8E8E8" position={[-fx + 0.4, LF + 1.15, zN - 0.15]} />);
  // near side: the cutaway, a neon frame + faint glass + a low red skirt
  nodes.push(<Part key="skirt" geo={box(BL, 0.7, 0.1)} color={RED} position={[0, 0.7, zN]} />);
  bands.forEach((y, i) => nodes.push(<Part key={`nb${i}`} geo={box(BL, 0.08, 0.08)} color={neon} emissive={neon} emissiveIntensity={1.5 + (i === 2 || i === 3 ? 1.6 * deckGlow : 0)} position={[0, y, zN]} shadow={false} />));
  for (const x of [-BL / 2, BL / 2]) nodes.push(<Part key={`nv${x}`} geo={box(0.08, ROOF - 0.35, 0.08)} color={neon} emissive={neon} emissiveIntensity={1.5} position={[x, (ROOF + 0.35) / 2, zN]} shadow={false} />);
  for (let x = -BL / 2 + 1.625; x < BL / 2 - 0.1; x += 1.625) {
    nodes.push(<Part key={`np${x}`} geo={box(0.05, 1.4, 0.05)} color={neon} emissive={neon} emissiveIntensity={0.9} position={[x, 2.3, zN]} shadow={false} />);
    nodes.push(<Part key={`nq${x}`} geo={box(0.05, 1.5, 0.05)} color={neon} emissive={neon} emissiveIntensity={0.9} position={[x, 4.95, zN]} shadow={false} />);
  }
  nodes.push(<Part key="glass" geo={box(BL, ROOF - 1.6, 0.03)} color="#9FD0FF" basic opacity={0.05} position={[0, (ROOF + 1.6) / 2, zN + 0.02]} shadow={false} />);
  // the two decks light up on «أبو دورين»
  if (deckGlow > 0.01)
    [LF + 0.02, UF + 0.02].forEach((y, i) =>
      nodes.push(<Part key={`dk${i}`} geo={box(BL - 0.3, 0.04, BW - 0.3)} color={NCYAN} basic opacity={0.35 * deckGlow} position={[0, y + 0.03, 0]} shadow={false} />),
    );
  // wheels
  for (const x of [-4.2, 4.0]) for (const z of [-1.55, 1.55]) nodes.push(<Wheel key={`w${x}${z}`} position={[x, 0.66, z]} spin={spin} />);
  void f;
  return <group>{nodes}</group>;
};

// ---------------------------------------------------------------- people
const cColors: BlockyColors = { skin: "#E0B48C", shirt: "#2F4A7A", pants: "#232838", shoes: "#1C1C20", hair: "#3A2A20", face: "#2A1E1A" };
const dColors: BlockyColors = { skin: "#C99A70", shirt: "#3A4F7A", pants: "#232838", shoes: "#1C1C20", hair: "#2A221C", face: "#2A1E1A" };
const docColors: BlockyColors = { skin: "#E7C09A", shirt: "#F4F4F0", pants: "#3A3F4A", shoes: "#1C1C20", hair: "#9A9A9A", face: "#2A1E1A" };

const Cap: React.FC<{ color: string }> = ({ color }) => (
  <group position={[0, 0.82, 0]}>
    <Part geo={cyl(0.42, 0.44, 0.22, 18)} color={color} />
    <Part geo={box(0.5, 0.05, 0.3)} color="#15161A" position={[0, -0.09, 0.4]} />
  </group>
);
const TicketBox: React.FC = () => (
  <group position={[0.18, -0.25, 0.3]}>
    <Part geo={rbox(0.34, 0.3, 0.16, 0.04)} color="#B9BEC6" />
    <Part geo={box(0.2, 0.06, 0.02)} color="#2A2C33" position={[0, 0.06, 0.09]} />
  </group>
);
const Clipboard: React.FC = () => (
  <group position={[0, 0, 0.1]} rotation={[0.5, 0, 0]}>
    <Part geo={box(0.42, 0.56, 0.03)} color="#8A5A2B" />
    <Part geo={box(0.36, 0.44, 0.01)} color="#F6F3EA" position={[0, -0.03, 0.02]} />
  </group>
);

// ---------------------------------------------------------------- the street
type Item = { x: number; kind: "bld" | "lamp" | "lampF"; w?: number; h?: number; seed: number };
const PERIOD = 132;
const makeStreet = (): Item[] => {
  const out: Item[] = [];
  let x = -PERIOD / 2;
  let i = 0;
  while (x < PERIOD / 2) {
    const w = 7 + hash(i * 1.7) * 4;
    out.push({ x: x + w / 2, kind: "bld", w, h: 9 + Math.floor(hash(i * 3.1) * 4) * 2.4, seed: i });
    x += w + 0.6;
    i++;
  }
  for (let k = 0; k < PERIOD; k += 16.5) {
    out.push({ x: -PERIOD / 2 + k, kind: "lamp", seed: k });
    out.push({ x: -PERIOD / 2 + k + 8, kind: "lampF", seed: k + 1 });
  }
  return out;
};
const wrap = (x: number) => ((((x + PERIOD / 2) % PERIOD) + PERIOD) % PERIOD) - PERIOD / 2;

/** the distance the street has slid (the bus drives +x); stops on «دكتور» */
const scrollX = (f: number, b: BBeats) => {
  const v0 = 0.42;
  const a = b.years;
  const e = Math.max(a + 10, b.doctor + 6);
  if (f < a) return v0 * f;
  if (f < e) {
    const t = f - a;
    return v0 * a + v0 * t - (v0 * t * t) / (2 * (e - a));
  }
  return v0 * a + (v0 * (e - a)) / 2;
};

const Shelter: React.FC<{ lime: number }> = ({ lime }) => {
  const c = mixC(NBLUE, LIME, lime);
  return (
    <group>
      <Part geo={box(3.6, 0.1, 1.6)} color="#1B2236" position={[0, 2.9, 0]} />
      <Part geo={box(3.6, 0.06, 0.06)} color={c} emissive={c} emissiveIntensity={1.4} position={[0, 2.84, 0.8]} shadow={false} />
      {[-1.7, 1.7].map((x) => (
        <Part key={x} geo={box(0.08, 2.9, 0.08)} color="#30343C" position={[x, 1.45, 0.7]} />
      ))}
      <Part geo={box(3.5, 2.2, 0.04)} color="#9FD0FF" opacity={0.12} position={[0, 1.6, -0.75]} shadow={false} />
      <Part geo={box(0.9, 1.6, 0.08)} color={c} emissive={c} emissiveIntensity={0.7} position={[-1.2, 1.6, -0.7]} shadow={false} />
      {/* the stop pole + round sign */}
      <group position={[2.4, 0, 0.6]}>
        <Part geo={cyl(0.05, 0.05, 3.2, 8)} color="#C9CED6" position={[0, 1.6, 0]} />
        <Part geo={cyl(0.42, 0.42, 0.06, 24)} color="#E8E8E8" rotation={[Math.PI / 2, 0, 0]} position={[0, 3.2, 0]} />
        <Part geo={torusArc(0.42, 0.07, Math.PI * 2)} color={RED} position={[0, 3.2, 0.04]} />
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- the gym today (behind the camera, +z)
const GYMZ = 50;
const StairMachine: React.FC<{ f: number; on: number }> = ({ f, on }) => {
  const nodes: React.ReactNode[] = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = (((i / n + f * 0.012 * on) % 1) + 1) % 1; // each step slides down the slope
    nodes.push(<Part key={i} geo={box(1.1, 0.08, 0.36)} color={i % 2 ? "#3A3F4A" : "#2C3038"} position={[0, 0.45 + 1.4 * (1 - t), -0.5 + 1.0 * t]} shadow={false} />);
  }
  return (
    <group>
      <Part geo={box(1.4, 0.3, 2.0)} color="#1C2030" position={[0, 0.15, 0]} />
      <Part geo={box(1.3, 1.9, 0.12)} color="#2A2F3C" position={[0, 1.2, -0.85]} rotation={[-0.62, 0, 0]} />
      {[-0.66, 0.66].map((x) => (
        <Part key={x} geo={box(0.08, 2.4, 0.08)} color={NCYAN} emissive={NCYAN} emissiveIntensity={1.2} position={[x, 1.6, -0.95]} shadow={false} />
      ))}
      <Part geo={box(1.4, 0.08, 0.08)} color={NCYAN} emissive={NCYAN} emissiveIntensity={1.2} position={[0, 2.8, -0.95]} shadow={false} />
      <Part geo={rbox(0.7, 0.45, 0.08, 0.04)} color="#0B1120" emissive={NBLUE} emissiveIntensity={0.6} position={[0, 2.5, -0.9]} rotation={[0.3, 0, 0]} shadow={false} />
      {nodes}
    </group>
  );
};

// ---------------------------------------------------------------- camera
const OPEN: Shot = { p: [-3.0, 3.4, 10.8], l: [-4.6, 3.2, 0], fov: 48 };
const CAB: Shot = { p: [3.5, 2.5, 7.2], l: [5.6, 2.0, -0.5], fov: 44 };
const WIDE: Shot = { p: [1.5, 8.5, 25], l: [0.8, 3.0, 0], fov: 46 };
const DOCS: Shot = { p: [4.4, 2.9, 12.5], l: [8.2, 2.1, 3.0], fov: 42 };
const CAB2: Shot = { p: [9.6, 3.0, 3.1], l: [5.4, 2.1, -0.7], fov: 40 };
const STAIR2: Shot = { p: [-3.0, 3.5, 8.0], l: [-4.8, 2.9, 0], fov: 46 };
const GYM: Shot = { p: [2.8, 3.1, GYMZ - 8.2], l: [0, 2.0, GYMZ], fov: 44 };
const COIN: Shot = { p: [14.6, 1.6, 8.0], l: [6.0, 2.2, 1.0], fov: 54 };
const DZ = { target: [5.45, 2.4, -0.7] as V3, dir: [4.2, 1.2, 3.8] as V3, width: 5.2, fovFrom: 52, fovTo: 32 };
const HCOND: Shot = { p: [-2.6, 3.6, 8.6], l: [-4.6, 3.4, 0], fov: 50 };

const camAt = (b: BBeats, f: number): { c: Shot; blur: number } => {
  const W = (a: number, from: Shot, to: Shot) => ({ c: whipPan((f - (a - 7)) / 14, { from, to, mid: 0.5, turn: 0.9 }), blur: whipBlur((f - (a - 7)) / 14, 0.5, 0.9) });
  const drift = (s: Shot, k: number): Shot => ({ ...s, p: [s.p[0] - 0.35 * k, s.p[1], s.p[2] - 0.6 * k] });
  if (f < b.driver - 4) return { c: drift(OPEN, seg(f, 0, b.driver, (x) => x)), blur: 0 };
  if (f < b.stairs - 7) return { c: mixShot(drift(OPEN, 1), CAB, seg(f, b.driver - 4, b.driver + 12, easeInOut)), blur: 0 };
  if (f < b.stairs + 7) return W(b.stairs, CAB, OPEN);
  if (f < b.years) return { c: drift(OPEN, seg(f, b.stairs + 7, b.years, (x) => x)), blur: 0 };
  if (f < b.doctor - 4) return { c: mixShot(drift(OPEN, 1), WIDE, seg(f, b.years, b.doctor - 6, easeInOut)), blur: 0 };
  if (f < b.compare) return { c: mixShot(WIDE, DOCS, seg(f, b.doctor - 4, b.doctor + 18, easeInOut)), blur: 0 };
  const ORB = (t: number) => orbit(t, { target: [0.8, 3.2, 0], radius: 15.5, height: 6.2, fromDeg: 30, toDeg: -20, fov: 48 });
  if (f < b.sit - 4) return { c: mixShot(DOCS, ORB(seg(f, b.compare, b.sit - 4, (x) => x)), seg(f, b.compare, b.compare + 16, easeInOut)), blur: 0 };
  if (f < b.climb - 7) return { c: mixShot(ORB(1), CAB2, seg(f, b.sit - 4, b.sit + 12, easeInOut)), blur: 0 };
  if (f < b.climb + 7) return W(b.climb, CAB2, STAIR2);
  if (f < b.result) return { c: drift(STAIR2, 0.6 * seg(f, b.climb + 7, b.result, (x) => x)), blur: 0 };
  const dz = (t: number) => dollyZoom(t, DZ);
  if (f < b.cond3 - 8) return { c: mixShot(drift(STAIR2, 0.6), dz(seg(f, b.result, b.attacks + 6, (x) => x)), seg(f, b.result - 2, b.result + 12, easeInOut)), blur: 0 };
  if (f < b.cond3 + 7) return W(b.cond3, dz(1), HCOND);
  if (f < b.us - 7) return { c: mixShot(HCOND, STAIR2, seg(f, b.free - 8, b.free + 8, easeInOut)), blur: 0 };
  if (f < b.us + 7) return W(b.us, STAIR2, GYM);
  if (f < b.coin - 7) return { c: { ...GYM, p: [GYM.p[0] - 0.4 * seg(f, b.us, b.coin, (x) => x), GYM.p[1], GYM.p[2] + 0.8 * seg(f, b.us, b.coin, (x) => x)] }, blur: 0 };
  if (f < b.coin + 7) return W(b.coin, { ...GYM, p: [GYM.p[0] - 0.4, GYM.p[1], GYM.p[2] + 0.8] }, COIN);
  return { c: COIN, blur: 0 };
};

// ---------------------------------------------------------------- the world
const World: React.FC<{ f: number; b: BBeats; c: Shot; S: Item[] }> = ({ f, b, c, S }) => {
  const X = scrollX(f, b);
  const Xs = scrollX(b.end + 100, b);
  const limeK = seg(f, b.app, b.app + 16);
  const lime = limeK > 0.5;
  const nodes: React.ReactNode[] = [];
  const edge = mixC(NBLUE, LIME, limeK);
  // ground: road, kerbs, pavements
  nodes.push(<Part key="ground" geo={box(600, 0.1, 300)} color="#070A12" position={[0, -0.06, 0]} shadow={false} />);
  nodes.push(<Part key="pave" geo={box(600, 0.14, PAVE.z1 - PAVE.z0)} color={mixC(NPAL.floor, NPAL.limeFloor, limeK)} position={[0, 0.07, (PAVE.z0 + PAVE.z1) / 2]} shadow={false} />);
  nodes.push(<Part key="paveF" geo={box(600, 0.14, 4)} color={NPAL.floor} position={[0, 0.07, -7.6]} shadow={false} />);
  nodes.push(<Part key="kerb" geo={box(600, 0.06, 0.12)} color={edge} emissive={edge} emissiveIntensity={1.4} position={[0, 0.15, PAVE.z0]} shadow={false} />);
  nodes.push(<Part key="kerbF" geo={box(600, 0.06, 0.12)} color={NBLUE} emissive={NBLUE} emissiveIntensity={1.2} position={[0, 0.15, -5.6]} shadow={false} />);
  for (let k = 0; k < 30; k++) {
    const x = wrap(-PERIOD / 2 + k * 4.4 - X);
    if (Math.abs(x - c.p[0]) > 70) continue;
    nodes.push(<Part key={`dash${k}`} geo={box(1.8, 0.02, 0.14)} color="#7FB2FF" basic position={[x, 0.01, -2.4]} shadow={false} />);
  }
  // buildings + lamps (wrapped)
  S.forEach((it, i) => {
    const x = wrap(it.x - X);
    if (Math.abs(x - c.p[0]) > 75 && c.p[2] < 30) return;
    if (it.kind === "bld") {
      const sign = i % 3 === 0 ? REDN : i % 3 === 1 ? NCYAN : "#FFB23F";
      nodes.push(
        <group key={`b${i}`} position={[x, 0, -9.6]}>
          <Building w={it.w!} d={8} h={it.h!} color={mixC("#141A2A", "#16211A", limeK)} lit={0.55 + 0.35 * hash(i * 2.2)} sign={sign} accent={edge} floors={Math.max(3, Math.floor(it.h! / 1.7))} />
        </group>,
      );
    } else if (it.kind === "lampF") nodes.push(<StreetLamp key={`lf${i}`} position={[x, 0.14, -6.2]} side={1} />);
  });
  // the stop (unique, arrives on «دكتور»)
  const stopX = STOP_X + Xs - X;
  if (Math.abs(stopX - c.p[0]) < 90)
    nodes.push(
      <group key="stop" position={[stopX, 0.14, PAVE.z0 + 1.9]}>
        <Shelter lime={limeK} />
      </group>,
    );
  // the bus
  const stairGlow = Math.exp(-Math.abs(f - (b.stairs + 4)) / 10) * (f > b.stairs - 6 ? 1 : 0);
  const deckGlow = seg(f, b.decks, b.decks + 8) * (1 - seg(f, b.sit - 8, b.sit));
  const signLime = seg(f, b.post, b.post + 8);
  const rock = f < b.doctor + 10 ? 0.03 * Math.sin(f * 0.9) : 0;
  nodes.push(
    <group key="bus" position={[0, rock, 0]}>
      <Bus f={f} X={X} b={b} lime={limeK} stairGlow={stairGlow} deckGlow={deckGlow} signLime={signLime} />
      <pointLight position={[0, 2.6, 0]} intensity={14} distance={10} decay={1.3} color={WARM} />
      <pointLight position={[0, 5.4, 0]} intensity={12} distance={10} decay={1.3} color={WARM} />
      <pointLight position={[-4.6, 3.6, 0.8]} intensity={10} distance={6} decay={1.3} color="#DDE8FF" />
    </group>,
  );
  // passengers
  const pass: [V3, number][] = [[[-2.4, LF + 0.5 - 0.84, 0.6], 3], [[0.8, LF + 0.5 - 0.84, 0.6], 4], [[0, UF + 0.5 - 0.84, 0.6], 5], [[3.2, UF + 0.5 - 0.84, -0.9], 6], [[-1.6, UF + 0.5 - 0.84, -0.9], 7]];
  pass.forEach(([p, s]) =>
    nodes.push(
      <group key={`ps${s}`} position={[p[0] + 0.05, p[1] + rock, p[2]]} rotation={[0, Math.PI / 2, 0]}>
        <Blocky pose={alive({ ...seated(), headYaw: 0.3 * Math.sin(f * 0.02 + s) }, f, s, 0.6)} colors={look(s + 20)} noBlob scale={0.95} />
      </group>,
    ),
  );
  // the driver
  const dP: BlockyPose = (() => {
    let q: BlockyPose = { ...seated(), armR: { sx: -1.2, sz: 0.15, twist: 0, elbow: -0.6 }, armL: { sx: -1.2, sz: 0.15, twist: 0, elbow: -0.6 }, mouth: "flat", headPitch: 0.05 };
    const tired = seg(f, b.shift, b.shift + 40);
    if (f < b.climb + 10) q = { ...q, hunch: 0.4 * tired, headPitch: 0.05 + 0.25 * tired, eyeOpen: 1 - 0.45 * tired, brow: 0.5 * tired };
    if (f >= b.coin) {
      const w = seg(f, b.likeDriver, b.likeDriver + 8) * (1 - seg(f, b.likeDriver + 46, b.likeDriver + 56));
      q = lerpPose({ ...q, headYaw: 0 }, { ...q, headYaw: -0.9, mouth: "grin", armL: { sx: -2.5, sz: 0.3 + 0.25 * Math.sin(f * 0.6), twist: 0, elbow: -0.4 } }, w);
    }
    return alive(q, f, 40, 0.6);
  })();
  nodes.push(
    <group key="drv" position={[DRIVER[0], DRIVER[1] + rock, DRIVER[2]]} rotation={[0, Math.PI / 2, 0]}>
      <Blocky pose={dP} colors={dColors} noBlob headgear={<Cap color="#1F2A44" />} />
    </group>,
  );
  // the cab clock runs a whole shift on «الوردية»
  nodes.push(<NeonClock key="cabclock" position={[5.3, 3.25, -1.6]} minutes={480 * seg(f, b.shift, b.shift + 40, easeInOut)} color={lime ? LIME : NCYAN} s={0.55} />);
  // the conductor: on the stairs until the coin part, then on the pavement
  if (f < b.coin) {
    const fast = f >= b.climb ? 1.5 : 1;
    const cf = f < b.climb ? f : b.climb + (f - b.climb) * fast;
    const { s, up, move } = condS(cf + 18);
    const p = condPos(s);
    let q: BlockyPose = move ? walkPose(cf * 0.42, 1.1) : { ...restPose(), mouth: "grin" };
    if (move && up) q = { ...q, lean: 0.2, legL: { ...q.legL, hip: q.legL.hip - 0.35, knee: q.legL.knee + 0.3 }, legR: { ...q.legR, hip: q.legR.hip - 0.35, knee: q.legR.knee + 0.3 } };
    // punching tickets on «يقطع تذاكر» and «ببلاش»
    const punch = (f >= b.tickets && f < b.tickets + 30) || (f >= b.free - 4 && f < b.free + 26);
    if (punch) q = { ...q, armR: { sx: -1.1, sz: 0.1, twist: 0, elbow: -1.4 - 0.3 * Math.abs(Math.sin(f * 0.8)) }, mouth: "grin" };
    q.mouth = q.mouth ?? "smile";
    nodes.push(
      <group key="cond" position={[p[0], p[1] + rock, p[2]]} rotation={[0, up ? Math.PI / 2 : -Math.PI / 2, 0]}>
        <Blocky pose={alive(q, f, 9, 0.5)} colors={cColors} scale={0.95} headgear={<Cap color="#1F2A44" />} chest={<TicketBox />} />
      </group>,
    );
  } else {
    let q: BlockyPose = { ...restPose(), mouth: "smile", headYaw: 0.4 };
    if (f >= b.yalla - 4) q = lerpPose(q, { ...wavePose(f, 3), mouth: "grin" }, seg(f, b.yalla - 4, b.yalla + 6));
    nodes.push(
      <group key="condS" position={COND_STOP} rotation={[0, 0.9, 0]}>
        <Blocky pose={alive(q, f, 9, 0.6)} colors={cColors} scale={0.95} headgear={<Cap color="#1F2A44" />} chest={<TicketBox />} />
      </group>,
    );
  }
  // the doctor at the stop (1953 only)
  if (f >= b.years && f < b.result) {
    const q: BlockyPose = alive({ ...restPose(), armR: { sx: -1.1, sz: 0.0, twist: 0, elbow: -1.3 }, armL: { sx: -0.6, sz: 0.1, twist: 0, elbow: -1.5 }, headPitch: f >= b.compare && f < b.compare + 40 ? 0.35 : 0, headYaw: 0.25 * Math.sin(f * 0.05), mouth: "flat", brow: 0.2 }, f, 12, 0.6);
    nodes.push(
      <group key="doc" position={[DOC[0] + (stopX - STOP_X), DOC[1], DOC[2]]} rotation={[0, -0.75, 0]}>
        <Blocky pose={q} colors={docColors} trousers="#3A3F4A" sleeves="#F4F4F0" leftHand={<Clipboard />} headgear={<group position={[0, 0.5, 0.36]}><Part geo={torusArc(0.12, 0.02, Math.PI * 2)} color="#2A2A2A" position={[-0.15, 0, 0]} /><Part geo={torusArc(0.12, 0.02, Math.PI * 2)} color="#2A2A2A" position={[0.15, 0, 0]} /></group>} />
      </group>,
    );
  }
  // rings under the driver and the conductor on «قارن»
  if (f >= b.compare && f < b.sit) {
    const op = seg(f, b.compare, b.compare + 8) * (1 - seg(f, b.sit - 10, b.sit));
    const cp = condPos(condS(f + 18).s);
    [[DRIVER[0], LF + 0.03, DRIVER[2] + 0.3], [cp[0], cp[1] + 0.03, cp[2] + 0.2]].forEach((p, i) =>
      nodes.push(
        <group key={`ring${i}`} position={p as V3} rotation={[-Math.PI / 2, 0, 0]} scale={clamp(springAt(f, b.compare + i * 6, 0.5, 4), 0, 1.2)}>
          <Part geo={torusArc(0.85, 0.08, Math.PI * 2)} color={NCYAN} basic opacity={op} shadow={false} />
          <Part geo={circle(0.85, 28)} color={NCYAN} basic opacity={0.25 * op} shadow={false} />
        </group>,
      ),
    );
  }
  // the gym today (behind the camera)
  if (c.p[2] > 25) {
    nodes.push(<Part key="gfloor" geo={box(14, 0.1, 14)} color={NPAL.floor} position={[0, 0.0, GYMZ]} shadow={false} />);
    [GYMZ - 2, GYMZ + 2, GYMZ + 6].forEach((z, i) =>
      nodes.push(
        <group key={`gr${i}`} position={[0, 0, z]}>
          {[-1, 1].map((k) => (
            <Part key={k} geo={box(0.08, 6, 0.3)} color={NBLUE} emissive={NBLUE} emissiveIntensity={1.3} position={[k * 4.6, 3, 0]} shadow={false} />
          ))}
          <Part geo={box(9.2, 0.08, 0.3)} color={NBLUE} emissive={NBLUE} emissiveIntensity={1.3} position={[0, 6, 0]} shadow={false} />
        </group>,
      ),
    );
    nodes.push(
      <group key="sm" position={[0, 0.05, GYMZ]} rotation={[0, Math.PI, 0]}>
        <StairMachine f={f} on={1} />
      </group>,
    );
    const ph = f * 0.32;
    const q: BlockyPose = { ...walkPose(ph, 0.9), lean: 0.25, mouth: "flat", brow: 0.5, armL: { sx: -0.9, sz: 0.15, twist: 0, elbow: -0.9 }, armR: { sx: -0.9, sz: 0.15, twist: 0, elbow: -0.9 } };
    nodes.push(
      <group key="gp" position={[0, 1.15 + 0.08 * Math.abs(Math.sin(ph)), GYMZ + 0.05]} rotation={[0, Math.PI, 0]}>
        <Blocky pose={alive(q, f, 31, 0.5)} colors={look(31)} />
      </group>,
    );
  }
  // runners jog in on «قريب» and «ينزل»
  const runner = (at: number, from: V3, to: V3, seed: number) => {
    if (f < at - 30) return;
    const t = seg(f, at - 30, at + 6, (x) => x);
    const p: V3 = [lerp(from[0], to[0], t), 0.14, lerp(from[2], to[2], t)];
    const yaw = Math.atan2(to[0] - from[0], to[2] - from[2]);
    let q = t < 1 ? runnerPose(f * 0.55 + seed, 1) : { ...restPose(), mouth: "grin" as const };
    if (t >= 1 && f >= b.tix) q = { ...wavePose(f, seed), mouth: "grin" };
    nodes.push(
      <group key={`run${seed}`} position={p} rotation={[0, t < 1 ? yaw : 0.75, 0]}>
        <Blocky pose={alive(q, f, seed, 0.6)} colors={{ ...look(seed), shirt: seed % 2 ? "#E3A93B" : "#3F8FD6" }} />
      </group>,
    );
  };
  if (f >= b.coin) {
    runner(b.near, [-4, 0, 4.4], [7.1, 0, 3.8], 51);
    runner(b.join, [-5, 0, 4.0], [8.3, 0, 3.0], 52);
  }
  return (
    <>
      <ShotRig shot={c} />
      <color attach="background" args={[mixC(NPAL.bg, NPAL.limeBg, limeK)]} />
      <fog attach="fog" args={[mixC(NPAL.fog, NPAL.limeFog, limeK), 30, 110]} />
      <hemisphereLight args={[lime ? "#9FB8A0" : "#8EA6D8", lime ? "#14201A" : "#0A1020", 1.2]} />
      <directionalLight position={[-6, 18, 14]} intensity={0.7} color={lime ? "#E8FFD0" : "#C8D8FF"} />
      <pointLight position={[c.p[0], c.p[1] + 1.2, c.p[2] - 1]} intensity={8} distance={18} decay={1.2} color={lime ? "#E8FFC8" : "#BFD6FF"} />
      <pointLight position={[stopX, 3.4, PAVE.z0 + 2.2]} intensity={12} distance={12} decay={1.3} color={lime ? LIME : "#BFD6FF"} />
      {nodes}
    </>
  );
};

// ---------------------------------------------------------------- 2D layers
const Heart: React.FC<{ s: number; cracked: boolean; glow: number }> = ({ s, cracked, glow }) => (
  <svg width={110 * s} height={100 * s} viewBox="0 0 110 100" style={{ filter: `drop-shadow(0 0 ${8 + 14 * glow}px rgba(255,59,71,0.9))` }}>
    <path d="M55 92 C20 66 4 48 4 28 C4 13 16 4 30 4 C42 4 50 11 55 19 C60 11 68 4 80 4 C94 4 106 13 106 28 C106 48 90 66 55 92 Z" fill="#FF3B47" stroke="#FFD0D3" strokeWidth={4} />
    {cracked && <path d="M57 20 L46 40 L60 50 L48 70" fill="none" stroke="#2A0A0E" strokeWidth={6} strokeLinejoin="round" />}
  </svg>
);

const Hearts: React.FC<{ f: number; b: BBeats; c: Shot; proj: Proj }> = ({ f, b, c, proj }) => {
  if (f < b.attacks || f >= b.free - 8) return null;
  const out = seg(f, b.free - 16, b.free - 8);
  const cp = condPos(condS(f + 18).s);
  const row = (head: V3, n: number, at: number, key: string, pulse: boolean) => {
    const a = proj(c, head);
    if (a.behind) return null;
    return (
      <div key={key} style={{ position: "absolute", left: clamp(a.x - (n * 100) / 2, 24, 1056 - n * 100), top: Math.max(120, a.y - 170), display: "flex", gap: 6, opacity: 1 - out }}>
        {Array.from({ length: n }, (_, i) => {
          const s = clamp(springAt(f, at + i * 5, 0.5, 4), 0, 1.25) * (pulse ? 1 + 0.12 * Math.max(0, Math.sin((f - b.half) * 0.35)) : 1);
          return f >= at + i * 5 ? <div key={i} style={{ transform: `scale(${s})` }}><Heart s={0.85} cracked glow={pulse ? 1 : 0} /></div> : <div key={i} style={{ width: 94 }} />;
        })}
      </div>
    );
  };
  const half = f >= b.half;
  const hs = clamp(springAt(f, b.half, 0.5, 4), 0, 1.2);
  return (
    <>
      {f < b.cond3 && row([DRIVER[0], 3.1, DRIVER[2]], 4, b.attacks + 4, "d", false)}
      {f >= b.cond3 && row([cp[0], cp[1] + 2.4, cp[2]], 2, b.cond3 + 4, "c", half)}
      {half && (
        <div style={{ position: "absolute", left: 0, top: 260, width: 1080, textAlign: "center", transform: `scale(${hs})`, opacity: 1 - out }}>
          <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 260, color: "#FFFFFF", textShadow: `0 0 40px ${REDN}, 0 0 12px #FFB0B6` }}>½</span>
        </div>
      )}
    </>
  );
};

const Seventy: React.FC<{ f: number; b: BBeats }> = ({ f, b }) => {
  if (f < b.years || f > b.compare + 4) return null;
  const s = clamp(springAt(f, b.years, 0.5, 4), 0, 1.2);
  const op = 1 - seg(f, b.compare - 10, b.compare + 2);
  const n = Math.round(70 * seg(f, b.years, b.years + 22, easeOut));
  return (
    <div dir="rtl" style={{ position: "absolute", left: 0, top: 210, width: 1080, textAlign: "center", opacity: op, transform: `scale(${s})`, transformOrigin: "540px 330px" }}>
      <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 230, lineHeight: 1, color: "#FFFFFF", textShadow: `0 0 40px ${NBLUE}, 0 0 12px ${NCYAN}` }}>+{n}</div>
      <div style={{ fontFamily: AR, fontWeight: 900, fontSize: 80, color: NCYAN, marginTop: 6 }}>سنة</div>
    </div>
  );
};

const Tag: React.FC<{ f: number; at: number; until: number; x: number; y: number; text: string; bg: string; ink: string; rot?: number }> = ({ f, at, until, x, y, text, bg, ink, rot = -5 }) => {
  if (f < at || f > until) return null;
  const s = clamp(springAt(f, at, 0.5, 4), 0, 1.25);
  return (
    <div dir="rtl" style={{ position: "absolute", left: x - 300, top: y, width: 600, display: "flex", justifyContent: "center", opacity: 1 - seg(f, until - 6, until), transform: `scale(${s}) rotate(${rot}deg)` }}>
      <div style={{ background: bg, borderRadius: 30, padding: "14px 40px", fontFamily: AR, fontWeight: 900, fontSize: 84, color: ink, boxShadow: `0 0 40px ${bg}AA` }}>{text}</div>
    </div>
  );
};

/** paper tickets flying out of a screen point */
const Tickets: React.FC<{ f: number; at: number; from: { x: number; y: number }; n: number; spread: number; color: string }> = ({ f, at, from, n, spread, color }) => {
  if (f < at || f > at + 40) return null;
  const t = (f - at) / 40;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (hash(i * 3.7) - 0.5) * spread;
        const v = 420 + 380 * hash(i * 1.9);
        const x = from.x + Math.cos(a) * v * t;
        const y = from.y + Math.sin(a) * v * t + 520 * t * t;
        return <div key={i} style={{ position: "absolute", left: x - 30, top: y - 18, width: 60, height: 36, background: color, border: "3px solid #8C7A55", borderRadius: 4, transform: `rotate(${(hash(i) - 0.5) * 2 * 400 * t}deg)`, opacity: 1 - seg(f, at + 30, at + 40) }} />;
      })}
    </>
  );
};

/** the real running post: first on the destination sign (affine fit to the sign's corners), then it lifts to the top */
const PostCard: React.FC<{ f: number; b: BBeats; c: Shot; proj: Proj }> = ({ f, b, c, proj }) => {
  if (f < b.post + 2) return null;
  const n = f >= b.join + 2 ? 3 : f >= b.near + 2 ? 2 : 1;
  const W = 1007;
  const H = 574;
  const tl = proj(c, [SIGN.x + 0.03, SIGN.y + SIGN.h / 2, SIGN.w / 2]);
  const tr = proj(c, [SIGN.x + 0.03, SIGN.y + SIGN.h / 2, -SIGN.w / 2]);
  const bl = proj(c, [SIGN.x + 0.03, SIGN.y - SIGN.h / 2, SIGN.w / 2]);
  const onSign = { a: (tr.x - tl.x) / W, b: (tr.y - tl.y) / W, c: (bl.x - tl.x) / H, d: (bl.y - tl.y) / H, e: tl.x, f: tl.y };
  const big = 860 / W;
  const top = { a: big, b: 0, c: 0, d: big, e: 540 - (W * big) / 2, f: 170 };
  const k = seg(f, b.app - 2, b.app + 14, easeInOut);
  const m = (p: keyof typeof top) => lerp(onSign[p], top[p], k);
  const appear = seg(f, b.post + 2, b.post + 8);
  const pop = n > 1 ? 1 + 0.06 * Math.exp(-(f - (n === 2 ? b.near + 2 : b.join + 2)) / 4) : 1;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `matrix(${m("a") * pop},${m("b")},${m("c")},${m("d") * pop},${m("e")},${m("f")})`, opacity: appear, filter: `drop-shadow(0 0 ${30 * k}px rgba(214,255,60,0.55))` }}>
      <Img src={staticFile(`footage/bus-conductor/app/post-${n}.png`)} style={{ width: W, height: H, borderRadius: 34 }} />
    </div>
  );
};

/** the 1953 part: the colour drains (CSS filter on the canvas) */
const oldK = (f: number, b: BBeats) => seg(f, b.years, b.years + 14) * (1 - seg(f, b.us - 6, b.us + 4));

const DebugOverlay: React.FC<{ info: string }> = ({ info }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 20, top: 20, right: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "22px monospace", padding: 8, whiteSpace: "pre-wrap" }}>{info}</div>
    <div style={{ position: "absolute", left: 0, top: 1170, width: 1080, height: 0, borderTop: "3px dashed #ff00aa" }} />
  </AbsoluteFill>
);

export const FactBus: React.FC<FactBusProps> = ({ beats = BUS_BEATS, durationSec = BUS_DURATION, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const b = useMemo(() => makeBusBeats(beats, fps, durationSec), [beats, fps, durationSec]);
  const proj = useMemo(() => projector(), []);
  const S = useMemo(() => makeStreet(), []);
  const frame = useCurrentFrame();
  const { c, blur } = camAt(b, frame);
  const ok = oldK(frame, b);
  const filters = [blur > 0.01 ? `blur(${(blur * 3).toFixed(2)}px)` : "", ok > 0.01 ? `saturate(${(1 - 0.7 * ok).toFixed(3)}) sepia(${(0.35 * ok).toFixed(3)})` : ""].filter(Boolean).join(" ");
  const condScreen = proj(c, (() => { const p = condPos(condS(frame + 18).s); return [p[0], p[1] + 1.6, p[2]] as V3; })());
  const condStop = proj(c, [COND_STOP[0], 1.7, COND_STOP[2]]);
  return (
    <AbsoluteFill style={{ backgroundColor: NPAL.bg }}>
      <AbsoluteFill style={{ filter: filters || undefined }}>
        <ThreeCanvas width={width} height={height} flat camera={{ fov: 60, near: 0.1, far: 3000, position: [0, 2, 10] }} gl={{ antialias: true }}>
          <World f={frame} b={b} c={c} S={S} />
        </ThreeCanvas>
      </AbsoluteFill>
      <Seventy f={frame} b={b} />
      <Tickets f={frame} at={b.tickets + 2} from={condScreen} n={8} spread={1.6} color="#F6F0DC" />
      <Hearts f={frame} b={b} c={c} proj={proj} />
      <Tag f={frame} at={b.free - 2} until={b.us - 6} x={540} y={300} text="ببلاش" bg="#F2B632" ink={INK} />
      <Tag f={frame} at={b.pay - 2} until={b.coin - 10} x={540} y={300} text="اشتراك 💳" bg="#FFFFFF" ink={INK} rot={4} />
      <LimeWave f={frame} at={b.app} />
      <PostCard f={frame} b={b} c={c} proj={proj} />
      <Tickets f={frame} at={b.tix} from={condStop} n={16} spread={2.4} color={LIME} />
      {debug && <DebugOverlay info={`f${frame} ${(frame / fps).toFixed(2)}s  p ${c.p.map((v) => v.toFixed(1)).join(",")} l ${c.l.map((v) => v.toFixed(1)).join(",")} fov ${c.fov.toFixed(0)}`} />}
    </AbsoluteFill>
  );
};
void PhoneInHand;
