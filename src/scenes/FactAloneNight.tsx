import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyPose, restPose } from "./fact3d/Blocky";
import { Part, box, circle, cyl, rbox, torusArc } from "./fact3d/parts";
import { clamp, easeIn, easeInOut, easeOut, hash, lerp, seg, springAt } from "./fact3d/anim";
import { alive, lerpPose, shyArms, walkPose } from "./fact3d/acting";
import { Bench, Dumbbell, Treadmill } from "./fact3d/props";
import { Building } from "./fact3d/waffarha";
import { mixC } from "./fact3d/zander";
import { GlowDumbbell, PercentTag, TPAL } from "./fact3d/tunnel";
import { Shot, ShotRig, birdsEye, mixShot, whipBlur, whipPan } from "./fact3d/cameraMoves";
import { AppPhone, AppPhoneSpec } from "./fact3d/AppPhone";
import { ABeats, ALONE_BEATS, ALONE_DURATION, AloneBeats, makeAloneBeats } from "./fact3d/aloneTiming";
import { BigClock, Cobwebs, Kind, Machine, PHONE, Person, PhoneInHand, SEAT_TOP, look, personPose, seated, talkMouth } from "./FactAlone";
import { LimeWave, NeonClock, Proj, projector } from "./fact3d/night";
import { loadFonts } from "../lib/fonts";

loadFonts();

// gym-alone v2 (owner 2026-11-20: v1's bright dollhouse "ما عجبنيش خالص", make it like the Waffarha tunnel): the SAME
// words + timing (fact3d/aloneTiming.ts, scripts/alone-props.mjs), a dark neon world, the camera always flying forward
// from place to place, no coin on screen. Colour story: cold BLUE while everyone is alone, LIME from «لحد ما جمعناهم».
//  1 a fast fly down a blue neon track, people training on both sides, each one inside his own glass booth (they flash
//    on «لوحدهم») -> brake at the neon «جيم» gate on the whispered «الجيم»
//  2 the gate opens into the hall, «40» + headphones that light in a wave -> whip pan to the machine (shy asks, cold
//    never looks up) -> fly to the end of the hall: the new guy under a spotlight by the door, his phone, the neon clock
//    runs 20 minutes while people rush past
//  3 crane up over the end wall, the next building: the neighbour on his balcony, same clock -> bird's eye over the
//    dark area: blue rings on roofs and streets go grey (dolly zoom on «محدش يعرف التاني»), our two stay lit
//  4 «جمعناهم»: everything turns lime, lines join the pairs -> down to the new guy, the real app -> the neighbour walks
//    in, +1 coins, lime % tags -> the cold one still on the machine in cobwebs -> the logo -> fly back into frame 0.

export type FactAloneNightProps = { beats?: Partial<AloneBeats>; durationSec?: number; debug?: boolean };
type V3 = [number, number, number];

const LIME = TPAL.lime;
const BLUE = "#3D8BFF";
const CYAN = "#5AD2FF";
const INK = "#0E0F12";
const AR = "Cairo";
const NPAL = { bg: "#05080F", fog: "#070C18", floor: "#0E1424", ribDark: "#111A2E", limeBg: "#07120B", limeFog: "#0A170E", limeFloor: "#122016" };

// ---------------------------------------------------------------- places (the track runs along -z)
const Z0 = 30; // camera z at frame 0
const ZG = -60; // the «جيم» gate
const ZE = -108; // the hall's end wall (door at x 0)
const RIB_W = 9.6;
const RIB_H = 6.2;
const MACH: V3 = [3.3, 0, -80];
const MACH_ROT = -Math.PI / 2 + 0.25; // faces the track
const SHY: V3 = [1.75, 0, -78.9];
const SHY_ROT = Math.PI / 2 + 0.35;
const NEW: V3 = [1.9, 0, ZE + 1.8];
const NEW_ROT = -0.55;
const CLOCK_HALL: V3 = [1.9, 4.3, ZE + 0.3];
const TOWER = { x: -6, z: -125, w: 8, d: 8, h: 15 };
const BALC_Y = 6.7;
const NB: V3 = [TOWER.x, BALC_Y, TOWER.z + 0.75];
const CLOCK_NB: V3 = [TOWER.x + 1.6, BALC_Y + 1.95, TOWER.z + 0.08];

// ---------------------------------------------------------------- people
const KINDS: Kind[] = ["run", "curl", "squat", "bench", "curl", "nod"];
const CUPS = ["#1C1F26", "#F6F6F6", "#3F8FD6", "#2B2F3A", "#E2574C"];
/** the opening track: 8 a side, the hall: 4 a side (the machine slot is left free) -> 24 + the cast */
const makePeople = (): Person[] => {
  const out: Person[] = [];
  let n = 0;
  for (let z = 24; z > ZG + 8; z -= 10)
    for (const side of [-1, 1]) {
      const zz = z - (side > 0 ? 5 : 0);
      out.push({ pos: [side * 3.3, 0, zz], rot: -side * 0.55, kind: KINDS[n % KINDS.length], c: look(n), seed: n, cup: CUPS[n % CUPS.length] });
      n++;
    }
  for (const z of [-66, -73, -87, -94])
    for (const side of [-1, 1]) {
      out.push({ pos: [side * 3.3, 0, z - (side > 0 ? 2 : 0)], rot: -side * 0.7, kind: KINDS[n % KINDS.length], c: look(n), seed: n, cup: CUPS[n % CUPS.length] });
      n++;
    }
  return out;
};

const Headphones: React.FC<{ color: string; glow: number; tint: string }> = ({ color, glow, tint }) => (
  <group position={[0, 0.42, 0]}>
    <Part geo={torusArc(0.49, 0.05, Math.PI)} color="#2A2D34" />
    {[1, -1].map((k) => (
      <group key={k} position={[k * 0.49, -0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
        <Part geo={cyl(0.19, 0.19, 0.14, 18)} color={color} emissive={tint} emissiveIntensity={0.5 + 1.6 * glow} />
        <Part geo={cyl(0.12, 0.12, 0.16, 14)} color={tint} emissive={tint} emissiveIntensity={0.8 + 1.4 * glow} />
      </group>
    ))}
  </group>
);

/** a glass booth around one person: a glowing floor pad + thin neon edges + faint glass; flash 0..1 */
const Booth: React.FC<{ flash: number; op: number }> = ({ flash, op }) => {
  if (op <= 0.01) return null;
  const W = 2.3;
  const H = 3.3;
  const e = 0.45 + 1.8 * flash;
  return (
    <group>
      <Part geo={box(W, 0.04, W)} color={BLUE} emissive={BLUE} emissiveIntensity={0.25 + flash} opacity={0.55 * op} position={[0, 0.03, 0]} shadow={false} />
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, c], i) => (
        <Part key={i} geo={box(0.05, H, 0.05)} color={CYAN} emissive={CYAN} emissiveIntensity={e} opacity={op} position={[(a * W) / 2, H / 2, (c * W) / 2]} shadow={false} />
      ))}
      {[-1, 1].map((k) => (
        <React.Fragment key={k}>
          <Part geo={box(W, 0.05, 0.05)} color={CYAN} emissive={CYAN} emissiveIntensity={e} opacity={op} position={[0, H, (k * W) / 2]} shadow={false} />
          <Part geo={box(0.05, 0.05, W)} color={CYAN} emissive={CYAN} emissiveIntensity={e} opacity={op} position={[(k * W) / 2, H, 0]} shadow={false} />
        </React.Fragment>
      ))}
      {[-1, 1].map((k) => (
        <Part key={`g${k}`} geo={box(W, H, 0.02)} color="#9FD0FF" basic opacity={(0.05 + 0.22 * flash) * op} position={[0, H / 2, (k * W) / 2]} shadow={false} />
      ))}
      {[-1, 1].map((k) => (
        <Part key={`s${k}`} geo={box(0.02, H, W)} color="#9FD0FF" basic opacity={(0.05 + 0.22 * flash) * op} position={[(k * W) / 2, H / 2, 0]} shadow={false} />
      ))}
    </group>
  );
};

const NRib: React.FC<{ z: number; color: string; glow?: number }> = ({ z, color, glow = 1 }) => (
  <group position={[0, 0, z]}>
    {[-1, 1].map((k) => (
      <React.Fragment key={k}>
        <Part geo={box(0.3, RIB_H, 0.3)} color={NPAL.ribDark} position={[(k * RIB_W) / 2, RIB_H / 2, 0]} shadow={false} />
        <Part geo={box(0.08, RIB_H, 0.32)} color={color} emissive={color} emissiveIntensity={1.3 * glow} position={[k * (RIB_W / 2 - 0.16), RIB_H / 2, 0]} shadow={false} />
      </React.Fragment>
    ))}
    <Part geo={box(RIB_W + 0.3, 0.3, 0.3)} color={NPAL.ribDark} position={[0, RIB_H, 0]} shadow={false} />
    <Part geo={box(RIB_W, 0.08, 0.32)} color={color} emissive={color} emissiveIntensity={1.3 * glow} position={[0, RIB_H - 0.16, 0]} shadow={false} />
  </group>
);

const Floor: React.FC<{ z0: number; z1: number; color: string; edge: string; dash: string }> = ({ z0, z1, color, edge, dash }) => {
  const len = z0 - z1;
  const zc = (z0 + z1) / 2;
  const dashes: React.ReactNode[] = [];
  for (let z = z0 - 2; z > z1 + 1; z -= 4) dashes.push(<Part key={z} geo={box(0.14, 0.02, 1.6)} color={dash} basic position={[0, 0.02, z]} shadow={false} />);
  return (
    <group>
      <Part geo={box(RIB_W, 0.1, len)} color={color} position={[0, -0.05, zc]} shadow={false} />
      {[-1, 1].map((k) => (
        <Part key={k} geo={box(0.12, 0.05, len)} color={edge} emissive={edge} emissiveIntensity={1.4} position={[k * 1.5, 0.03, zc]} shadow={false} />
      ))}
      {dashes}
    </group>
  );
};

/** the neon «جيم» gate (facade at z 0): two glass leaves that swing in (open 0..1), a sign band with a dumbbell */
const NeonGate: React.FC<{ open: number; glow: number }> = ({ open, glow }) => {
  const W = 6.4;
  const H = 4.6;
  return (
    <group>
      {/* the wall around the door, both sides up to the ribs */}
      {[-1, 1].map((k) => (
        <Part key={`w${k}`} geo={box((RIB_W - W) / 2, RIB_H, 0.5)} color="#0B1120" position={[k * (W / 2 + (RIB_W - W) / 4), RIB_H / 2, -0.3]} shadow={false} />
      ))}
      <Part geo={box(RIB_W, RIB_H - H, 0.5)} color="#0B1120" position={[0, H + (RIB_H - H) / 2, -0.3]} shadow={false} />
      {[-1, 1].map((k) => (
        <group key={k} position={[(k * W) / 2, 0, 0]} rotation={[0, k * -1.45 * open, 0]}>
          <Part geo={box(W / 2 - 0.05, H - 0.1, 0.08)} color="#1A2A48" opacity={0.75} emissive={BLUE} emissiveIntensity={0.25} position={[(-k * W) / 4, H / 2, 0]} shadow={false} />
          <Part geo={box(0.07, H - 0.1, 0.1)} color={CYAN} emissive={CYAN} emissiveIntensity={1.4} position={[-k * (W / 2 - 0.05), H / 2, 0.02]} shadow={false} />
        </group>
      ))}
      {/* frame */}
      {[-1, 1].map((k) => (
        <Part key={`f${k}`} geo={box(0.14, H, 0.2)} color={BLUE} emissive={BLUE} emissiveIntensity={1.5 * glow} position={[k * (W / 2 + 0.07), H / 2, 0.05]} shadow={false} />
      ))}
      <Part geo={box(W + 0.28, 0.14, 0.2)} color={BLUE} emissive={BLUE} emissiveIntensity={1.5 * glow} position={[0, H, 0.05]} shadow={false} />
      {/* the sign */}
      <Part geo={rbox(5.2, 1.25, 0.2, 0.1)} color="#0E1A33" position={[0, H + 0.85, 0.15]} shadow={false} />
      <Part geo={rbox(5.3, 1.35, 0.12, 0.1)} color={BLUE} emissive={BLUE} emissiveIntensity={1.0 * glow} position={[0, H + 0.85, 0.05]} shadow={false} />
      <GlowDumbbell color={CYAN} glow={1.1 * glow} position={[-1.15, H + 0.85, 0.35]} s={0.9} />
    </group>
  );
};

/** the hall's end wall with the lit door (door gap at x 0, 1.6 wide, 2.7 tall) */
const EndWall: React.FC<{ lime: number }> = ({ lime }) => {
  const dw = 1.6;
  const dh = 2.7;
  const side = (RIB_W - dw) / 2;
  const edge = mixC(BLUE, LIME, lime);
  return (
    <group position={[0, 0, ZE]}>
      {[-1, 1].map((k) => (
        <Part key={k} geo={box(side, RIB_H, 0.4)} color="#0C1222" position={[k * (dw / 2 + side / 2), RIB_H / 2, 0]} shadow={false} />
      ))}
      <Part geo={box(dw, RIB_H - dh, 0.4)} color="#0C1222" position={[0, dh + (RIB_H - dh) / 2, 0]} shadow={false} />
      {/* light pouring through the door */}
      <Part geo={box(dw, dh, 0.05)} color="#DDEBFF" basic opacity={0.9} position={[0, dh / 2, -0.25]} shadow={false} />
      {[-1, 1].map((k) => (
        <Part key={`e${k}`} geo={box(0.1, dh, 0.45)} color={edge} emissive={edge} emissiveIntensity={1.4} position={[k * (dw / 2 + 0.05), dh / 2, 0]} shadow={false} />
      ))}
      <Part geo={box(dw + 0.2, 0.1, 0.45)} color={edge} emissive={edge} emissiveIntensity={1.4} position={[0, dh, 0]} shadow={false} />
      {/* a light pool on the floor in front of the door */}
      <Part geo={circle(1.6, 28)} color="#BFD6FF" basic opacity={0.18} position={[0, 0.03, 1.4]} rotation={[-Math.PI / 2, 0, 0]} shadow={false} />
    </group>
  );
};

/** a spotlight cone from above (the lonely new guy) */
const SpotCone: React.FC<{ position: V3; op: number; color: string }> = ({ position, op, color }) =>
  op <= 0.01 ? null : (
    <group position={position}>
      <Part geo={cyl(0.25, 1.35, 4.6, 24)} color={color} basic opacity={0.1 * op} position={[0, 2.3, 0]} shadow={false} />
      <Part geo={circle(1.35, 28)} color={color} basic opacity={0.22 * op} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} shadow={false} />
    </group>
  );

// ---------------------------------------------------------------- the area around (bird's eye)
type Block = { x: number; z: number; w: number; d: number; h: number; floors: number };
const makeBlocks = (): Block[] => {
  const out: Block[] = [];
  for (let gx = -3; gx <= 3; gx++)
    for (let gz = -3; gz <= 3; gz++) {
      const x = gx * 17;
      const z = -112 + gz * 17;
      if (Math.abs(x) < 10 && z > -120) continue; // the track + the hall
      if (Math.abs(x - TOWER.x) < 9 && Math.abs(z - (TOWER.z - TOWER.d / 2)) < 9) continue; // the tower
      const k = gx * 13 + gz * 7;
      const h = 6 + Math.floor(hash(k * 1.9) * 5) * 2.2;
      out.push({ x: x + (hash(k) - 0.5) * 2, z: z + (hash(k * 2.3) - 0.5) * 2, w: 8 + hash(k * 3.1) * 4, d: 8 + hash(k * 4.1) * 4, h, floors: Math.max(2, Math.floor(h / 1.7)) });
    }
  return out;
};
type Dot = { p: V3 };
const makeDots = (B: Block[]): Dot[] => {
  const out: Dot[] = [{ p: NEW }, { p: [NB[0], NB[1], NB[2] + 0.4] }];
  B.forEach((b, i) => {
    if (i % 2) return;
    out.push({ p: [b.x + (hash(i * 3.3) - 0.5) * b.w * 0.4, b.h + 0.25, b.z - b.d / 2 + (hash(i * 4.4) - 0.5) * b.d * 0.4] });
  });
  const street: V3[] = [[-8.5, 0, -95], [8.5, 0, -138], [-25, 0, -146], [25, 0, -86], [-42, 0, -104], [42, 0, -122], [8.5, 0, -62], [-8.5, 0, -40]];
  street.forEach((p) => out.push({ p }));
  return out;
};

// ---------------------------------------------------------------- camera
const openZ = (f: number, b: ABeats) => {
  // decelerating run 0 -> «الجيم» (velocity 2D/T at frame 0, zero at the gate); negative f = the loop's last frames
  const D = Z0 - (ZG + 11);
  const T = Math.max(1, b.gym);
  if (f <= 0) return Z0 - ((2 * D) / T) * f;
  const u = clamp(f / T);
  return Z0 - D * (1 - (1 - u) * (1 - u));
};
const camOpen = (f: number, b: ABeats): Shot => {
  const z = openZ(f, b);
  const u = clamp(f / Math.max(1, b.gym));
  const sway = (1 - u) * 0.35 * Math.sin(f * 0.05);
  const ly = lerp(2.0, 3.6, easeInOut(seg(f, b.gym - 30, b.gym)));
  const lz = lerp(z - 14, ZG, easeInOut(seg(f, b.gym - 30, b.gym)));
  return { p: [sway, 2.0 + 0.1 * Math.sin(f * 0.07), z], l: [sway * 0.5, ly, lz], fov: lerp(64, 56, u) };
};
const GATE_STOP: Shot = { p: [0, 2.0, ZG + 11], l: [0, 3.4, ZG], fov: 56 };
const HALL: Shot = { p: [0, 2.3, -71], l: [0, 2.0, -86], fov: 60 };
const TALK: Shot = { p: [-1.9, 2.8, -87.0], l: [2.3, 1.35, -79.3], fov: 50 };
const TALK2: Shot = { p: [-1.5, 2.7, -86.3], l: [2.3, 1.35, -79.3], fov: 47 };
const NEWS: Shot = { p: [-0.8, 2.2, ZE + 8.6], l: [1.7, 1.7, ZE + 1.6], fov: 42 };
const NEWS2: Shot = { p: [-1.6, 2.6, ZE + 11], l: [0.9, 1.5, ZE + 1.6], fov: 46 };
const UPA: Shot = { p: [0.5, 11, ZE + 9], l: [0, 1, ZE - 6], fov: 54 };
const BALC: Shot = { p: [-3.4, 8.6, TOWER.z + 9.5], l: [TOWER.x + 0.2, 7.7, TOWER.z], fov: 42 };
const SEC: Shot = { p: [-1.6, 2.7, -86.6], l: [2.4, 1.4, -79.5], fov: 48 };
const TOP = { target: [-2, 0, -110] as V3, height: 92, fov: 50 };

const camAt = (b: ABeats, f: number): { c: Shot; blur: number } => {
  const loopA = b.end - 20;
  if (f >= loopA) {
    const from = camLate(b, loopA);
    return { c: mixShot(from, camOpen(f - b.end, b), seg(f, loopA, b.end - 1, easeInOut)), blur: 0.6 * Math.sin(Math.PI * seg(f, loopA, b.end - 1)) };
  }
  return { c: camLate(b, f), blur: f >= b.talk - 6 && f < b.talk + 10 ? whipBlur((f - (b.talk - 6)) / 16, 0.5, 0.8) : 0 };
};

const camLate = (b: ABeats, f: number): Shot => {
  if (f < b.gym) return camOpen(f, b);
  if (f < b.forty1) {
    const push = seg(f, b.gym, b.forty1, (x) => x);
    return { ...GATE_STOP, p: [0, 2.0, ZG + 11 - 0.6 * push] };
  }
  const GS: Shot = { ...GATE_STOP, p: [0, 2.0, ZG + 10.4] };
  if (f < b.talk - 6) return mixShot(GS, HALL, seg(f, b.forty1 + 4, b.talk - 6, easeInOut));
  if (f < b.talk + 10) return whipPan((f - (b.talk - 6)) / 16, { from: HALL, to: TALK, mid: 0.5, turn: 0.8 });
  if (f < b.newbie) return mixShot(TALK, TALK2, seg(f, b.talk + 10, b.newbie, (x) => x));
  if (f < b.twenty) return mixShot(TALK2, NEWS, seg(f, b.newbie, b.phone + 10, easeInOut));
  const NEWSP: Shot = { ...NEWS, fov: NEWS.fov - 5 };
  if (f < b.up1) return mixShot(NEWS, NEWSP, seg(f, b.twenty, b.up1, (x) => x));
  if (f < b.building) return mixShot(NEWSP, UPA, seg(f, b.up1, b.building, easeInOut));
  if (f < b.up2) return mixShot(UPA, BALC, seg(f, b.building, b.building + 40, easeInOut));
  const DESC = b.join + 36;
  if (f < DESC) return top(b, f);
  if (f < b.coins) return mixShot(top(b, DESC), NEWS, seg(f, DESC, b.app + 40, easeInOut));
  if (f < b.secret) return mixShot(NEWS, NEWS2, seg(f, b.coins - 6, b.coins + 20, easeInOut));
  if (f < b.hour) return mixShot(NEWS2, SEC, seg(f, b.secret, b.hour + 2, easeInOut));
  const SEC2: Shot = { ...SEC, p: [-1.0, 2.4, -85.6], fov: 40 };
  return mixShot(SEC, SEC2, seg(f, b.hour, b.end, (x) => x));
};

/** bird's eye over the area + the dolly zoom on «محدش يعرف التاني» (fov 50 -> 28, distance grows: the rings keep their
 *  size, the city around them stretches away), back on «جمعناهم» */
const top = (b: ABeats, f: number): Shot => {
  const sh = birdsEye(seg(f, b.up2, b.join + 36, (x) => x), { ...TOP, spinDeg: 16, from: BALC, blend: 0.25 });
  const k = seg(f, b.noone - 2, b.noone + 34, easeInOut) * (1 - seg(f, b.join, b.join + 20, easeInOut));
  if (k <= 0) return sh;
  const fov = lerp(sh.fov, 28, k);
  const r = Math.tan((sh.fov * Math.PI) / 360) / Math.tan((fov * Math.PI) / 360);
  return { ...sh, fov, p: [sh.l[0] + (sh.p[0] - sh.l[0]) * r, sh.l[1] + (sh.p[1] - sh.l[1]) * r, sh.l[2] + (sh.p[2] - sh.l[2]) * r] };
};

// ---------------------------------------------------------------- the world
const World: React.FC<{ f: number; b: ABeats; c: Shot; P: Person[]; B: Block[]; D: Dot[] }> = ({ f, b, c, P, B, D }) => {
  const loop = f >= b.end - 20;
  const limeK = loop ? 0 : seg(f, b.join, b.join + 16);
  const lime = limeK > 0.5;
  const bg = mixC(NPAL.bg, NPAL.limeBg, limeK);
  const fog = mixC(NPAL.fog, NPAL.limeFog, limeK);
  const ribC = mixC(BLUE, LIME, limeK);
  const high = c.p[1] > 20;
  const nodes: React.ReactNode[] = [];
  const near = (z: number, ahead = 90, behind = 8) => high || (z < c.p[2] + behind && z > c.p[2] - ahead);

  // ground + track + ribs
  nodes.push(<Part key="ground" geo={box(400, 0.1, 400)} color={mixC("#070A12", "#08110B", limeK)} position={[0, -0.12, -100]} shadow={false} />);
  nodes.push(<Floor key="fl" z0={Z0 + 40} z1={ZE} color={mixC(NPAL.floor, NPAL.limeFloor, limeK)} edge={ribC} dash={mixC("#7FB2FF", "#B8E04A", limeK)} />);
  for (let z = Z0 + 34, i = 0; z > ZE + 2; z -= 7, i++) {
    if (Math.abs(z - ZG) < 2) continue;
    if (near(z)) nodes.push(<NRib key={`r${i}`} z={z} color={i % 3 === 0 ? mixC(CYAN, "#3FD0C0", limeK) : ribC} />);
  }
  // light streaks high on the sides (the speed lines of the opening)
  if (f < b.forty1 || loop)
    for (let i = 0; i < 40; i++) {
      const z = Z0 + 10 - i * 2.2;
      if (!near(z, 60, 4)) continue;
      const side = i % 2 ? 1 : -1;
      nodes.push(<Part key={`st${i}`} geo={box(0.035, 0.035, 3.0)} color={i % 3 ? BLUE : CYAN} basic position={[side * (2.9 + hash(i * 1.3) * 1.4), 4.0 + hash(i * 2.9) * 1.8, z]} shadow={false} />);
    }

  // the gate
  nodes.push(
    <group key="gate" position={[0, 0, ZG]}>
      <NeonGate open={loop ? 1 : seg(f, b.forty1 - 2, b.forty1 + 12, easeInOut)} glow={1 + 0.6 * Math.exp(-Math.abs(f - b.gym) / 8)} />
    </group>,
  );
  nodes.push(<EndWall key="end" lime={limeK} />);

  // people in booths; the headphones light in a wave down the hall on «سماعة»
  const flashAt = (z: number) => {
    const a = b.alone + 4 + Math.max(0, (Z0 - z) * 0.12);
    const k = f - a;
    return k < 0 ? 0 : Math.exp(-k / 9);
  };
  const glowFor = (z: number) => {
    const at = b.forty2 + 4 + Math.max(0, ZG - z) * 0.9;
    const k = f - at;
    return k < 0 ? 0 : Math.max(0.12 * (1 - seg(f, b.talk, b.talk + 10)), Math.exp(-k / 12));
  };
  const boothOp = 1 - limeK;
  P.forEach((p, i) => {
    if (!near(p.pos[2], 90, 6)) return;
    const y = p.kind === "run" ? 0.25 : p.kind === "bench" ? SEAT_TOP - 0.84 : 0;
    if (p.kind === "run") nodes.push(<Treadmill key={`t${i}`} position={p.pos} rotationY={p.rot} frame={f} />);
    if (p.kind === "bench") nodes.push(<Bench key={`b${i}`} position={[p.pos[0], 0, p.pos[2] - 0.35]} rotationY={p.rot} />);
    nodes.push(
      <group key={`p${i}`} position={[p.pos[0], y, p.pos[2]]} rotation={[0, p.rot, 0]}>
        <Blocky
          pose={personPose(p, f)}
          colors={p.c}
          scale={0.92}
          noBlob={p.kind === "bench"}
          headgear={<Headphones color={p.cup} glow={glowFor(p.pos[2])} tint={lime ? LIME : CYAN} />}
          rightHand={p.kind === "curl" ? <Dumbbell s={0.32} color="#5D6670" /> : undefined}
          leftHand={p.kind === "curl" ? <Dumbbell s={0.32} color="#5D6670" /> : undefined}
        />
      </group>,
    );
    nodes.push(
      <group key={`bo${i}`} position={[p.pos[0], 0, p.pos[2]]} rotation={[0, p.rot, 0]}>
        <Booth flash={flashAt(p.pos[2])} op={boothOp} />
      </group>,
    );
  });

  // the machine: the cold one (never looks up) + the shy one
  const coldP: BlockyPose = (() => {
    const q: BlockyPose = { ...seated(), armR: { sx: -1.0, sz: 0.1, twist: 0, elbow: -1.3 }, armL: { sx: -0.5, sz: 0.25, twist: 0, elbow: -0.6 } };
    q.headPitch = 0.42;
    q.mouth = "flat";
    q.eyeOpen = 0.7;
    q.brow = -0.2;
    const m = talkMouth(f, b.reply, b.newbie);
    if (m > 0) { q.mouth = "o"; q.mouthOpen = m * 0.7; }
    if (f >= b.hour) { q.headPitch = 0.22; q.eyeOpen = 0.5; q.headYaw = -0.15; }
    return alive(q, f, 77, 0.5);
  })();
  const web = seg(f, b.hour + 6, b.hour + 36);
  if (near(MACH[2]))
    nodes.push(
      <group key="mach" position={MACH} rotation={[0, MACH_ROT, 0]}>
        <Machine />
        <group position={[0, SEAT_TOP - 0.84, 0.08]}>
          <Blocky pose={coldP} colors={{ ...look(77), shirt: "#2B2F3A", pants: "#22262E" }} noBlob headgear={<Headphones color="#E2574C" glow={glowFor(MACH[2])} tint={f >= b.hour ? "#7A808C" : CYAN} />} rightHand={<PhoneInHand />} />
        </group>
        {web > 0 && <Cobwebs k={web} />}
        <Booth flash={0} op={f >= b.talk - 6 && f < b.newbie ? 0 : boothOp} />
      </group>,
    );
  const shyP: BlockyPose = (() => {
    let q: BlockyPose = { ...restPose(), ...shyArms(), hunch: 0.5, headPitch: 0.1, brow: 0.6, mouth: "smile", blush: 0.3 };
    const tap = f >= b.ask && f < b.ask + 26;
    if (f >= b.talk && f < b.newbie) {
      const reach = seg(f, b.ask - 6, b.ask + 4) * (1 - seg(f, b.ask + 22, b.ask + 32));
      q = lerpPose(q, { ...q, armR: { sx: -1.25, sz: -0.05, twist: 0, elbow: -0.35 - (tap ? 0.18 * Math.abs(Math.sin((f - b.ask) * 0.9)) : 0) }, lean: 0.1 }, reach);
      const m = talkMouth(f, b.ask, b.reply);
      if (m > 0) { q.mouth = "o"; q.mouthOpen = m * 0.6; }
      const deflate = seg(f, b.reply + 18, b.reply + 34);
      q.shrug += 0.4 * deflate;
      q.headPitch += 0.25 * deflate;
      q.mouth = deflate > 0.5 ? "wavy" : q.mouth;
    }
    if (f >= b.hour) {
      q = { ...restPose(), armL: { sx: 0.1, sz: 0.6, twist: 1.2, elbow: -1.6 }, armR: { sx: 0.1, sz: 0.6, twist: 1.2, elbow: -1.6 }, brow: -0.3, mouth: "flat", headPitch: 0.15 };
      q.legR = { hip: -0.05, sz: 0.05, knee: 0.1, toe: 0 };
      q.bob = 0.01 * Math.abs(Math.sin(f * 0.5));
    }
    return alive(q, f, 66, 0.7);
  })();
  if (near(SHY[2]))
    nodes.push(
      <group key="shy" position={SHY} rotation={[0, SHY_ROT, 0]}>
        <Blocky pose={shyP} colors={{ ...look(66), shirt: "#F1E1C2", pants: "#3C4A66" }} headgear={<Headphones color="#3F8FD6" glow={0} tint={lime ? LIME : CYAN} />} />
      </group>,
    );

  // the new guy by the door: spotlight, phone, clock; people rush past during «عشرين دقيقة»
  const newP: BlockyPose = (() => {
    let q: BlockyPose = { ...restPose(), ...shyArms(), hunch: 0.35, brow: 0.5, mouth: "flat", headPitch: 0.05 };
    q.eyeX = Math.sin(f * 0.07) * 0.8;
    q.headYaw = Math.sin(f * 0.045) * 0.25;
    const ph = seg(f, b.phone - 8, b.phone + 6);
    q = lerpPose(q, { ...restPose(), armR: { sx: -1.05, sz: 0.05, twist: 0, elbow: -1.25 }, armL: { sx: -0.9, sz: -0.15, twist: 0, elbow: -1.2 }, headPitch: 0.45, eyeY: -0.6, mouth: "flat", brow: 0.3 }, ph);
    const up = seg(f, b.coins - 4, b.coins + 10);
    if (up > 0) q = lerpPose(q, { ...restPose(), headYaw: 0.5, mouth: "grin", brow: -0.2, eyeX: 0.6 }, up);
    const hf = seg(f, b.coins + 46, b.coins + 54) * (1 - seg(f, b.coins + 64, b.coins + 76));
    if (hf > 0) q = lerpPose(q, { ...q, armR: { sx: -2.6, sz: 0.25, twist: 0, elbow: -0.2 } }, hf);
    return alive(q, f, 901, 0.8);
  })();
  if (near(NEW[2])) {
    nodes.push(
      <group key="new" position={NEW} rotation={[0, NEW_ROT, 0]}>
        <Blocky pose={newP} colors={{ ...look(901), shirt: "#3F8FD6", pants: "#2B2F3A" }} headgear={<Headphones color="#F6F6F6" glow={0} tint={lime ? LIME : CYAN} />} rightHand={f < b.coins + 30 ? <PhoneInHand /> : undefined} />
      </group>,
    );
    nodes.push(<SpotCone key="spot" position={NEW} op={lime ? 0.5 : 1} color={lime ? LIME : "#BFD6FF"} />);
    nodes.push(<NeonClock key="ck" position={CLOCK_HALL} minutes={20 * seg(f, b.twenty, b.twenty + 54, easeInOut)} color={lime ? LIME : CYAN} />);
    // the rush: people crossing fast in front of him while the clock runs
    if (f >= b.twenty - 4 && f < b.up1 + 10)
      for (let i = 0; i < 4; i++) {
        const per = 22;
        const ph = ((f - b.twenty + i * 6) % per) / per;
        const dir = i % 2 ? 1 : -1;
        const x = dir * lerp(-4.2, 4.2, ph);
        nodes.push(
          <group key={`rush${i}`} position={[x * 0.8, 0, ZE + 3.0 + i * 0.35]} rotation={[0, (dir * Math.PI) / 2, 0]}>
            <Blocky pose={walkPose(f * 1.4 + i, 1.2)} colors={look(300 + i)} scale={0.92} headgear={<Headphones color={CUPS[i]} glow={0.3} tint={CYAN} />} />
          </group>,
        );
      }
  }

  // the neighbour: on his balcony, then he walks in through the hall door on «سوا»
  const nbC = { ...look(902), shirt: "#E3A93B", pants: "#2B2F3A" };
  if (f < b.coins) {
    const bounce = Math.abs(Math.sin(f * 0.22));
    const q: BlockyPose = alive({ ...seated(), legL: { hip: -1.5, sz: 0.12, knee: 1.5 + 0.15 * bounce }, armR: { sx: -0.4, sz: 0.2, twist: 0, elbow: -1.6 }, headYaw: -0.35 + 0.25 * Math.sin(f * 0.03), brow: 0.4, mouth: "flat" }, f, 902, 0.8);
    nodes.push(
      <group key="nb" position={[NB[0], BALC_Y + 0.05 + 0.48 - 0.84, NB[2]]}>
        <Blocky pose={q} colors={nbC} noBlob />
        <Part geo={rbox(0.7, 0.1, 0.7, 0.04)} color="#D9693F" position={[0, 0.84 - 0.48 + 0.42, -0.05]} />
      </group>,
    );
  } else {
    const t = seg(f, b.coins + 2, b.coins + 44, (x) => x);
    const p = [lerp(0, 0.6, t), 0, lerp(ZE - 1.2, ZE + 2.6, t)] as V3;
    let q = t < 1 ? walkPose(f * 0.38, 1) : { ...restPose(), mouth: "grin" as const, brow: -0.2 };
    const hf = seg(f, b.coins + 46, b.coins + 54) * (1 - seg(f, b.coins + 64, b.coins + 76));
    if (hf > 0) q = lerpPose(q, { ...q, armL: { sx: -2.6, sz: 0.25, twist: 0, elbow: -0.2 } }, hf);
    q.mouth = "grin";
    nodes.push(
      <group key="nbw" position={p} rotation={[0, t < 1 ? 0.1 : 0.9, 0]}>
        <Blocky pose={alive(q, f, 902, 0.6)} colors={nbC} />
      </group>,
    );
  }

  // the tower, its balcony and clock; the rest of the area
  const lit = lerp(0.35, 0.6, limeK);
  nodes.push(
    <group key="tower" position={[TOWER.x, 0, TOWER.z]}>
      <Building w={TOWER.w} d={TOWER.d} h={TOWER.h} color="#1B2236" lit={lit} sign={ribC} accent={ribC} floors={8} />
    </group>,
  );
  nodes.push(
    <group key="balc" position={[TOWER.x, BALC_Y, TOWER.z + 0.75]}>
      <Part geo={box(3.6, 0.18, 1.5)} color="#2A3350" />
      <Part geo={box(3.6, 0.9, 0.08)} color="#9FD0FF" position={[0, 0.5, 0.72]} opacity={0.3} shadow={false} />
      <Part geo={box(3.6, 0.07, 0.12)} color={ribC} emissive={ribC} emissiveIntensity={1.2} position={[0, 0.98, 0.72]} shadow={false} />
      <Part geo={box(1.1, 2.1, 0.06)} color="#FFE8B0" emissive="#FFD58A" emissiveIntensity={0.8} position={[-1.0, 1.1, -0.72]} shadow={false} />
    </group>,
  );
  nodes.push(<NeonClock key="ck2" position={CLOCK_NB} minutes={20 * seg(f, b.twenty, b.twenty + 54, easeInOut)} color={lime ? LIME : CYAN} s={0.8} />);
  if (high || c.p[2] < -100)
    B.forEach((bl, i) =>
      nodes.push(
        <group key={`bl${i}`} position={[bl.x, 0, bl.z + bl.d / 2]}>
          <Building w={bl.w} d={bl.d} h={bl.h} color={mixC("#141A2A", "#16211A", limeK)} lit={lit * (0.6 + 0.6 * hash(i * 2.2))} sign={i % 3 ? ribC : "#FFB23F"} accent={ribC} floors={bl.floors} />
        </group>,
      ),
    );

  // rings under the people who want to train (the area beats)
  if (f >= b.up2 && f < b.join + 60) {
    D.forEach((d, i) => {
      const ours = i < 2;
      const pop = clamp(springAt(f, b.city + 2 + (ours ? 0 : 3 + (i % 9) * 3), 0.5, 4), 0, 1.15) * (1 - seg(f, b.join + 44, b.join + 58));
      if (f < b.city || pop <= 0.01) return;
      const greyK = ours ? 0 : seg(f, b.noone + (i % 9) * 3, b.noone + (i % 9) * 3 + 8);
      const limeR = seg(f, b.join + (ours ? 0 : 6 + (i % 7) * 3), b.join + (ours ? 6 : 14 + (i % 7) * 3));
      const pulse = ours && f >= b.exists && f < b.join ? 0.3 * (0.5 + 0.5 * Math.sin((f - b.exists) * 0.25)) : 0;
      const base = ours ? mixC(CYAN, "#FFFFFF", seg(f, b.exists, b.exists + 8) * 0.4) : CYAN;
      const col = mixC(mixC(base, "#4A505C", greyK), LIME, limeR);
      nodes.push(
        <group key={`ring${i}`} position={[d.p[0], d.p[1] + 0.15, d.p[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={pop * (1 + pulse) * (ours ? 1.25 : 1)}>
          <Part geo={circle(2.6, 32)} color={col} basic opacity={0.35} shadow={false} />
          <Part geo={torusArc(2.6, 0.38, Math.PI * 2)} color={col} basic shadow={false} />
        </group>,
      );
    });
  }

  // lime % tags on the ribs on «خصومات»
  if (f >= b.coins + 20 && f < b.hour + 30) {
    [-82, -88, -94, -100].forEach((z, i) => {
      const pop = clamp(springAt(f, b.coins + 30 + i * 4, 0.5, 4.5), 0, 1.25) * (1 - seg(f, b.hour, b.hour + 20));
      if (pop <= 0.01) return;
      nodes.push(<PercentTag key={`pt${i}`} position={[(i % 2 ? 1 : -1) * 3.6, RIB_H + 0.9, z]} s={1.8 * pop} spin={f * 0.1 + i} color={LIME} ink={INK} glow={0.8} />);
    });
  }

  return (
    <>
      <ShotRig shot={c} />
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[fog, 22 + Math.max(0, c.p[1] - 8), 80 + 1.8 * Math.max(0, c.p[1] - 8)]} />
      <hemisphereLight args={[lime ? "#9FB8A0" : "#8EA6D8", lime ? "#14201A" : "#0A1020", 1.15]} />
      <directionalLight position={[-6, 18, 10]} intensity={0.6} color={lime ? "#E8FFD0" : "#C8D8FF"} />
      <pointLight position={[c.p[0], c.p[1] + 1.2, c.p[2] - 1]} intensity={8} distance={18} decay={1.2} color={lime ? "#E8FFC8" : "#BFD6FF"} />
      <pointLight position={[0, 5, ZG + 3]} intensity={f < b.talk ? 26 : 0} distance={16} decay={1.2} color={BLUE} />
      <pointLight position={[NEW[0], 4.4, NEW[2] + 0.5]} intensity={22} distance={9} decay={1.4} color={lime ? LIME : "#DDE8FF"} />
      {nodes}
    </>
  );
};

void BigClock;

// ---------------------------------------------------------------- 2D layers
const GateLabel: React.FC<{ f: number; b: ABeats; c: Shot; proj: Proj }> = ({ f, b, c, proj }) => {
  if (f > b.talk - 6 || f >= b.end - 20) return null;
  const a = proj(c, [0.9, 4.6 + 0.85, ZG + 0.3]);
  const fs = 1.0 * a.ppu;
  if (a.behind || fs < 10 || a.y > 1000) return null;
  return (
    <div dir="rtl" style={{ position: "absolute", left: a.x - 600, top: a.y - fs * 0.62, width: 1200, textAlign: "center", fontFamily: AR, fontWeight: 900, fontSize: fs, lineHeight: 1.2, color: "#E8F2FF", textShadow: `0 0 ${fs * 0.25}px ${BLUE}, 0 0 ${fs * 0.08}px ${CYAN}` }}>
      جيم
    </div>
  );
};

const Forty: React.FC<{ f: number; b: ABeats }> = ({ f, b }) => {
  if (f < b.forty1 + 4 || f > b.talk + 2) return null;
  const s = clamp(springAt(f, b.forty1 + 4, 0.5, 4), 0, 1.2);
  const op = 1 - seg(f, b.talk - 8, b.talk + 2);
  const n = Math.round(40 * seg(f, b.forty1 + 4, b.forty1 + 26, easeOut));
  const hp = clamp(springAt(f, b.forty2 + 4, 0.5, 4), 0, 1.25);
  return (
    <div style={{ position: "absolute", left: 0, top: 230, width: 1080, display: "flex", justifyContent: "center", alignItems: "center", gap: 30, opacity: op, transform: `scale(${s})`, transformOrigin: "540px 360px" }}>
      <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 240, lineHeight: 1, color: "#FFFFFF", textShadow: `0 0 40px ${BLUE}, 0 0 12px ${CYAN}` }}>{n}</span>
      {f >= b.forty2 + 4 && (
        <svg width={210} height={210} viewBox="0 0 100 100" style={{ transform: `scale(${hp})`, filter: `drop-shadow(0 0 14px ${CYAN})` }}>
          <path d="M18 60 V50 A32 32 0 0 1 82 50 V60" fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" />
          <rect x={8} y={52} width={22} height={36} rx={9} fill={CYAN} />
          <rect x={70} y={52} width={22} height={36} rx={9} fill={CYAN} />
        </svg>
      )}
    </div>
  );
};

const JoinLines: React.FC<{ f: number; b: ABeats; c: Shot; proj: Proj; D: Dot[] }> = ({ f, b, c, proj, D }) => {
  if (f < b.join || f > b.join + 56) return null;
  const fade = 1 - seg(f, b.join + 40, b.join + 54);
  const pairs: [number, number][] = [[0, 1]];
  for (let i = 2; i + 1 < D.length; i += 2) pairs.push([i, i + 1]);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, opacity: fade }}>
      <defs>
        <filter id="lg" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      {pairs.map(([i, j], k) => {
        const a = proj(c, D[i].p);
        const e = proj(c, D[j].p);
        if (a.behind || e.behind) return null;
        const t = seg(f, b.join + (k === 0 ? 0 : 6 + k * 2), b.join + (k === 0 ? 12 : 18 + k * 2), easeOut);
        if (t <= 0) return null;
        const x2 = lerp(a.x, e.x, t);
        const y2 = lerp(a.y, e.y, t);
        const mx = (a.x + x2) / 2;
        const my = (a.y + y2) / 2 - 0.25 * Math.hypot(x2 - a.x, y2 - a.y);
        const d = `M ${a.x} ${a.y} Q ${mx} ${my} ${x2} ${y2}`;
        const w = k === 0 ? 1.5 : 1;
        return (
          <g key={k}>
            <path d={d} stroke={LIME} strokeWidth={16 * w} fill="none" opacity={0.55} filter="url(#lg)" />
            <path d={d} stroke={LIME} strokeWidth={8 * w} strokeLinecap="round" strokeDasharray="18 14" strokeDashoffset={-f * 3} fill="none" />
          </g>
        );
      })}
    </svg>
  );
};

const PlusOne: React.FC<{ f: number; b: ABeats; c: Shot; proj: Proj }> = ({ f, b, c, proj }) => {
  const a0 = b.coins + 50;
  if (f < a0 || f > b.secret + 6) return null;
  const heads: V3[] = [[NEW[0], 2.4, NEW[2]], [0.6, 2.4, ZE + 2.6]];
  const out = seg(f, b.secret - 6, b.secret + 6);
  return (
    <>
      {heads.map((h, i) => {
        const p = proj(c, h);
        if (p.behind) return null;
        const s = clamp(springAt(f, a0 + i * 4, 0.5, 4), 0, 1.25);
        const rise = 40 * seg(f, a0, a0 + 30, easeOut);
        return (
          <div key={i} style={{ position: "absolute", left: p.x - 70, top: Math.min(p.y - 120 - rise, 860), width: 140, height: 140, transform: `scale(${s})`, opacity: 1 - out }}>
            <div style={{ width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #FFE58A, #F2B632 60%, #C98A1E)", border: "6px solid #8C5A12", boxShadow: "0 0 30px rgba(242,182,50,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 60, color: "#5A3B10" }}>+1</div>
          </div>
        );
      })}
      {f >= a0 + 22 && (
        <div dir="rtl" style={{ position: "absolute", left: 140, top: 330, transform: `scale(${clamp(springAt(f, a0 + 22, 0.5, 4), 0, 1.2)}) rotate(-4deg)`, opacity: 1 - out }}>
          <div style={{ background: LIME, borderRadius: 28, padding: "12px 34px", fontFamily: AR, fontWeight: 900, fontSize: 70, color: INK, boxShadow: "0 0 40px rgba(214,255,60,0.55)" }}>خصومات %</div>
        </div>
      )}
    </>
  );
};

const Logo: React.FC<{ f: number; b: ABeats }> = ({ f, b }) => {
  const a = b.logo;
  if (f < a - 2) return null;
  const s = clamp(springAt(f, a - 2, 0.5, 5), 0, 1.2);
  const sweep = seg(f, a + 8, a + 30, easeInOut);
  const float = 8 * Math.sin((f - a) * 0.08);
  const out = seg(f, b.end - 18, b.end - 6);
  const src = staticFile("footage/gym-alone/logo.svg");
  return (
    <div style={{ position: "absolute", left: 540 - 230, top: 100 + float, width: 460, height: 420, transform: `scale(${0.78 * s * (1 - 0.3 * out)})`, transformOrigin: "50% 60%", opacity: 1 - out }}>
      <div style={{ position: "absolute", inset: -60, borderRadius: "50%", background: "radial-gradient(circle, rgba(214,255,60,0.5) 0%, rgba(214,255,60,0) 65%)" }} />
      <Img src={src} style={{ position: "absolute", left: 30, top: 0, width: 400, height: 362, filter: "drop-shadow(0 0 22px rgba(214,255,60,0.6))" }} />
      <div style={{ position: "absolute", left: 30, top: 0, width: 400, height: 362, overflow: "hidden", WebkitMaskImage: `url(${src})`, WebkitMaskSize: "100% 100%", maskImage: `url(${src})`, maskSize: "100% 100%" }}>
        <div style={{ position: "absolute", top: -100, left: lerp(-300, 520, sweep), width: 120, height: 600, background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.85), rgba(255,255,255,0))", transform: "rotate(20deg)" }} />
      </div>
      <div dir="rtl" style={{ position: "absolute", left: -100, top: 360, width: 660, textAlign: "center", fontFamily: AR, fontWeight: 900, fontSize: 76, color: LIME, textShadow: "0 0 24px rgba(214,255,60,0.7)", opacity: seg(f, a + 4, a + 12) }}>
        تمرينة
      </div>
    </div>
  );
};

/** whispered «الجيم» + the silent second before «لحد ما جمعناهم»: the edges go dark */
const Hush: React.FC<{ f: number; b: ABeats }> = ({ f, b }) => {
  const k = Math.max(seg(f, b.gym - 4, b.gym + 6) * (1 - seg(f, b.forty1 - 8, b.forty1 + 4)), seg(f, b.apart, b.apart + 10) * (1 - seg(f, b.join - 4, b.join + 2)));
  if (k <= 0) return null;
  return <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.7) 100%)", opacity: k }} />;
};

const DebugOverlay: React.FC<{ info: string }> = ({ info }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 20, top: 20, right: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "22px monospace", padding: 8, whiteSpace: "pre-wrap" }}>{info}</div>
    <div style={{ position: "absolute", left: 0, top: 1000, width: 1080, height: 0, borderTop: "3px dashed #ff00aa" }} />
  </AbsoluteFill>
);

export const FactAloneNight: React.FC<FactAloneNightProps> = ({ beats = ALONE_BEATS, durationSec = ALONE_DURATION, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const b = useMemo(() => makeAloneBeats(beats, fps, durationSec), [beats, fps, durationSec]);
  const proj = useMemo(() => projector(), []);
  const P = useMemo(() => makePeople(), []);
  const B = useMemo(() => makeBlocks(), []);
  const D = useMemo(() => makeDots(B), [B]);
  const frame = useCurrentFrame();
  const { c, blur } = camAt(b, frame);
  const tap = Math.round(lerp(b.app, b.coins, 0.72));
  const phoneT = { inF: b.app + 18, pushF: b.app + 34, tapF: tap, outF: b.coins + 4 };
  const phoneSpec: AppPhoneSpec = { ...PHONE, rings: { ...PHONE.rings!, on: [b.app + 40, b.app + 70], off: tap - 3 } };
  return (
    <AbsoluteFill style={{ backgroundColor: NPAL.bg }}>
      <AbsoluteFill style={{ filter: blur > 0.01 ? `blur(${(blur * 3).toFixed(2)}px)` : undefined }}>
        <ThreeCanvas width={width} height={height} flat camera={{ fov: 60, near: 0.1, far: 3000, position: [0, 2, 10] }} gl={{ antialias: true }}>
          <World f={frame} b={b} c={c} P={P} B={B} D={D} />
        </ThreeCanvas>
      </AbsoluteFill>
      <GateLabel f={frame} b={b} c={c} proj={proj} />
      <Hush f={frame} b={b} />
      <Forty f={frame} b={b} />
      <LimeWave f={frame} at={b.join} />
      <JoinLines f={frame} b={b} c={c} proj={proj} D={D} />
      <AppPhone f={frame} t={phoneT} spec={phoneSpec} />
      <PlusOne f={frame} b={b} c={c} proj={proj} />
      <Logo f={frame} b={b} />
      {debug && <DebugOverlay info={`f${frame} ${(frame / fps).toFixed(2)}s  p ${c.p.map((v) => v.toFixed(1)).join(",")} l ${c.l.map((v) => v.toFixed(1)).join(",")} fov ${c.fov.toFixed(0)}`} />}
    </AbsoluteFill>
  );
};
void easeIn;
