import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { Treadmill } from "./fact3d/props";
import { Part, box, circle, cyl, rbox, torusArc } from "./fact3d/parts";
import { clamp, easeIn, easeInOut, easeOut, hash, lerp, mix3, seg, springAt, wobble } from "./fact3d/anim";
import { alive, lerpPose, runnerPose, walkPose, wavePose, tremble } from "./fact3d/acting";
import { Shot, ShotRig, dollyZoom, mixShot, orbit, whipBlur, whipPan } from "./fact3d/cameraMoves";
import { LimeWave, NBLUE, NCYAN, NPAL, NeonClock, projector } from "./fact3d/night";
import { TBeats, TREADMILL_BEATS, TREADMILL_DURATION, TreadmillBeats, makeTreadmillBeats } from "./fact3d/treadmillTiming";
import { loadFonts } from "../lib/fonts";

loadFonts();

// treadmill-prison (2026-11-24): «السير اللي بتجري عليه في الجيم كان عقاب للمساجين» (William Cubitt 1818).
// Night neon theme. ONE continuous camera journey, no cuts:
//  1 fly down a dark prison corridor toward a giant wooden treadwheel (prisoners walking) → «عقاب» prison bars slam
//  2 close on the treadwheel mechanism: Cubitt, prisoners, 6h clock, grain grinding → «طاقة» gears glow
//  3 «اتمنع» the prison breaks apart → whip pan to a bright modern gym, a person on a modern treadmill staring at a wall
//  4 Mr. Coin walks in (the last scene composites the coin on top), the lime wave, «ماتش كورة أو كلاس»
// From beat `coin` the lower right stays open floor for the mascot (composited later).

export type FactTreadmillProps = { beats?: Partial<TreadmillBeats>; durationSec?: number; debug?: boolean };
type V3 = [number, number, number];

const LIME = "#D6FF3C";
const BLUE = NBLUE;
const CYAN = NCYAN;
const RED = "#C82030";
const RUST = "#8B4B2E";
const WOOD = "#8A6540";
const WOOD_DARK = "#5E4228";
const IRON = "#4A5058";
const IRON_LIGHT = "#6A7080";
const INK = "#0E0F12";
const WARM = "#FFD58A";
const AR = "Cairo";

// ---------------------------------------------------------------- the Victorian treadwheel
// The treadwheel: a large wooden cylinder with steps on the outside, prisoners walk on top.
// The wheel is along z (axle along x), radius ~3, 24 steps around it.
const WHEEL_R = 3.0;
const WHEEL_W = 4.0; // width along x
const WHEEL_STEPS = 24;
const AXLE_Y = WHEEL_R + 0.4; // axle height above ground

/** A single step on the treadwheel */
const WheelStep: React.FC<{ angle: number; glow: number }> = ({ angle, glow }) => {
  const x = 0;
  const y = AXLE_Y + Math.sin(angle) * WHEEL_R;
  const z = Math.cos(angle) * WHEEL_R;
  const col = glow > 0.01 ? CYAN : WOOD;
  const ei = glow > 0.01 ? 0.8 * glow : 0;
  return (
    <group position={[x, y, z]} rotation={[angle, 0, 0]}>
      <Part geo={rbox(WHEEL_W - 0.4, 0.12, 0.65, 0.03)} color={col} emissive={glow > 0 ? CYAN : undefined} emissiveIntensity={ei} />
    </group>
  );
};

/** The complete treadwheel with axle, frame, and steps */
const TreadWheel: React.FC<{ spin: number; glow: number; crack: number }> = ({ spin, glow, crack }) => {
  const steps = [];
  for (let i = 0; i < WHEEL_STEPS; i++) {
    const a = (i / WHEEL_STEPS) * Math.PI * 2 + spin;
    steps.push(<WheelStep key={i} angle={a} glow={glow} />);
  }
  const crackOff = crack * 2.5; // how far pieces fly
  return (
    <group position={[0, 0, 0]}>
      {/* axle */}
      <Part geo={cyl(0.18, 0.18, WHEEL_W + 1.2, 12)} color={IRON} rough={0.5} rotation={[0, 0, Math.PI / 2]} position={[0, AXLE_Y, 0]} />
      {/* side frames (A-frame wooden supports) */}
      {[-1, 1].map((k) => (
        <group key={k} position={[k * (WHEEL_W / 2 + 0.4), 0, 0]}>
          <Part geo={rbox(0.3, AXLE_Y + WHEEL_R + 0.6, 0.3, 0.05)} color={WOOD_DARK} position={[0, (AXLE_Y + WHEEL_R + 0.6) / 2 - crackOff * k * 0.3, -0.8 + crackOff * 0.2]} />
          <Part geo={rbox(0.3, AXLE_Y + WHEEL_R + 0.6, 0.3, 0.05)} color={WOOD_DARK} position={[0, (AXLE_Y + WHEEL_R + 0.6) / 2 - crackOff * k * 0.1, 0.8 - crackOff * 0.15]} />
          <Part geo={rbox(0.25, 0.25, 2.0, 0.04)} color={WOOD_DARK} position={[0, AXLE_Y + WHEEL_R + 0.4, 0]} />
        </group>
      ))}
      {/* the steps */}
      {steps}
      {/* side discs (the wheel ends) */}
      {[-1, 1].map((k) => (
        <Part key={`d${k}`} geo={cyl(WHEEL_R - 0.1, WHEEL_R - 0.1, 0.1, 24)} color={WOOD_DARK} opacity={0.6} rotation={[0, 0, Math.PI / 2]} position={[k * WHEEL_W / 2, AXLE_Y, 0]} />
      ))}
    </group>
  );
};

// ---------------------------------------------------------------- prison corridor
/** Prison bar gate */
const PrisonBars: React.FC<{ position: V3; open: number }> = ({ position, open }) => {
  const bars = [];
  const W = 5.0;
  const H = 5.5;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (i / (n - 1)) * W;
    const off = open * (i < n / 2 ? -3 : 3); // bars fly apart
    bars.push(
      <Part key={i} geo={cyl(0.08, 0.08, H, 8)} color={IRON} position={[x + off, H / 2, 0]} />,
    );
  }
  return (
    <group position={position}>
      {bars}
      <Part geo={rbox(W + 0.4, 0.3, 0.3, 0.05)} color={IRON_LIGHT} position={[0, H, 0]} />
      <Part geo={rbox(W + 0.4, 0.3, 0.3, 0.05)} color={IRON_LIGHT} position={[0, 0.15, 0]} />
    </group>
  );
};

/** Corridor wall segments along z, with neon ribs */
const CorridorWall: React.FC<{ side: number; zFrom: number; zTo: number }> = ({ side, zFrom, zTo }) => {
  const len = Math.abs(zTo - zFrom);
  const zMid = (zFrom + zTo) / 2;
  const H = 6.5;
  return (
    <group>
      <Part geo={box(0.3, H, len)} color="#0A0E18" position={[side * 3.2, H / 2, zMid]} />
      {/* neon rib along the top */}
      <Part geo={box(0.08, 0.08, len)} color={BLUE} emissive={BLUE} emissiveIntensity={1.2} position={[side * 3.0, H - 0.2, zMid]} shadow={false} />
      {/* neon rib along the bottom */}
      <Part geo={box(0.08, 0.08, len)} color={BLUE} emissive={BLUE} emissiveIntensity={0.6} position={[side * 3.0, 0.3, zMid]} shadow={false} />
    </group>
  );
};

// ---------------------------------------------------------------- people (prisoners)
const prisonerColors: BlockyColors = { skin: "#D4A87A", shirt: "#4A4A4A", pants: "#3A3A3A", shoes: "#2A2A2A", hair: "#3A2820", face: "#2A1E1A" };
const prisoner2Colors: BlockyColors = { skin: "#C29060", shirt: "#505050", pants: "#404040", shoes: "#2A2A2A", hair: "#1A1510", face: "#2A1E1A" };
const prisoner3Colors: BlockyColors = { skin: "#E0B88A", shirt: "#484848", pants: "#383838", shoes: "#2A2A2A", hair: "#5A3A20", face: "#2A1E1A" };
const modernRunnerColors: BlockyColors = { skin: "#E0B48C", shirt: "#2F7ADA", pants: "#1A1A28", shoes: "#F0F0F0", hair: "#3A2A20", face: "#2A1E1A" };

/** A prisoner walking on the treadwheel: position is the step they're on. */
const PrisonerOnWheel: React.FC<{ spin: number; slot: number; colors: BlockyColors; seed: number; frame: number; exhausted: number }> = ({
  spin, slot, colors, seed, frame, exhausted,
}) => {
  const a = (slot / 6) * Math.PI * 2 + spin;
  // prisoners are on top of the wheel, within the top 60° arc
  const topAngle = Math.PI / 2; // top of the wheel
  // normalize angle to put them in a walking position on top
  const aMod = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  // only show if roughly on top (within about 90 degrees of the top)
  const distFromTop = Math.abs(aMod - topAngle);
  if (distFromTop > Math.PI / 2 && distFromTop < Math.PI * 1.5) return null;

  const stepY = AXLE_Y + Math.sin(a) * (WHEEL_R + 0.08);
  const stepZ = Math.cos(a) * (WHEEL_R + 0.08);
  const walkPhase = frame * 0.12 + seed * 2;
  const pose = exhausted > 0.5
    ? lerpPose(walkPose(walkPhase, 0.5), tremble(restPose(), frame, seed, 0.6), exhausted - 0.5)
    : alive(walkPose(walkPhase, 0.6), frame, seed, 0.4);
  return (
    <Blocky
      pose={pose}
      colors={colors}
      position={[0, stepY, stepZ]}
      rotationY={Math.PI}
      scale={0.9}
    />
  );
};

// ---------------------------------------------------------------- modern gym
const GymFloor: React.FC<{ lime: number }> = ({ lime }) => {
  const col = lime > 0.5 ? "#122016" : NPAL.floor;
  return (
    <group>
      <Part geo={box(20, 0.1, 20)} color={col} position={[0, -0.05, 0]} />
      {/* subtle grid */}
      {Array.from({ length: 11 }, (_, i) => (
        <React.Fragment key={i}>
          <Part geo={box(20, 0.005, 0.03)} color={BLUE} emissive={BLUE} emissiveIntensity={0.3 + lime * 0.5} position={[0, 0.01, -10 + i * 2]} shadow={false} />
          <Part geo={box(0.03, 0.005, 20)} color={BLUE} emissive={BLUE} emissiveIntensity={0.3 + lime * 0.5} position={[-10 + i * 2, 0.01, 0]} shadow={false} />
        </React.Fragment>
      ))}
    </group>
  );
};

const GymMirror: React.FC<{ position: V3; w: number; h: number }> = ({ position, w, h }) => (
  <group position={position}>
    <Part geo={rbox(w, h, 0.06, 0.03)} color="#8898AA" rough={0.1} opacity={0.3} />
    <Part geo={rbox(w + 0.1, h + 0.1, 0.03, 0.02)} color={IRON_LIGHT} />
  </group>
);

// ---------------------------------------------------------------- neon signs
const NeonText: React.FC<{ position: V3; text: string; color: string; size?: number; opacity?: number }> = ({
  position, text, color, size = 0.6, opacity = 1,
}) => {
  if (opacity < 0.01) return null;
  // Simple representation: a glowing box with the text as a texture would be ideal,
  // but for the 3D scene we use a flat glowing panel
  const w = text.length * size * 0.65;
  return (
    <group position={position}>
      <Part geo={rbox(w, size * 1.2, 0.04, 0.02)} color={color} basic emissive={color} emissiveIntensity={2.2} opacity={opacity} shadow={false} />
    </group>
  );
};

// ---------------------------------------------------------------- camera
const camAt = (b: TBeats, f: number): { c: Shot; blur: number } => {
  const { fps } = b;
  let blur = 0;

  // Phase 1 (scene 1): fly down the prison corridor toward the treadwheel
  // Start far back, fly forward toward the wheel at z = 0
  const corridorStart: Shot = { p: [0, 2.5, 25], l: [0, 3.2, 0], fov: 55 };
  const nearWheel: Shot = { p: [0, 3.5, 8], l: [0, 3.2, 0], fov: 48 };
  const closeWheel: Shot = { p: [-1.5, 4.0, 4], l: [0, 3.5, 0], fov: 42 };
  const punishShot: Shot = { p: [2, 2.0, 5], l: [0, 3.0, 0], fov: 50 };

  // Phase 2 (scene 2): close on the mechanism
  const engineerShot: Shot = { p: [3, 3.5, 3], l: [0, 3.0, 0], fov: 44 };
  const mechanismClose: Shot = { p: [1, 5.0, 2.5], l: [0, 4.0, 0], fov: 38 };
  const topView: Shot = { p: [0, 7.5, 1], l: [0, 3.5, 0], fov: 52, up: [0, 0, -1] };
  const energyShot: Shot = { p: [-2, 3.0, 4], l: [0, 3.5, -0.5], fov: 46 };

  // Phase 3 (scene 3): the ban, then whip to the modern gym
  const banShot: Shot = { p: [0, 3.0, 6], l: [0, 3.0, 0], fov: 50 };
  // modern gym is at z = -40 (a whole different area)
  const modernWide: Shot = { p: [3, 2.0, -35], l: [0, 1.2, -42], fov: 48 };
  const modernClose: Shot = { p: [1.5, 1.5, -38], l: [0, 1.0, -42], fov: 40 };
  const wallShot: Shot = { p: [0, 1.8, -44], l: [0, 1.5, -48], fov: 42 };

  // Phase 4 (scene 4): coin area, camera holds
  const coinShot: Shot = { p: [2, 2.0, -38], l: [0, 1.2, -42], fov: 46 };

  // ---- interpolate camera based on the beat
  if (f < b.gym) {
    // opening fly forward
    return { c: mixShot(corridorStart, nearWheel, seg(f, 0, b.gym)), blur: 0 };
  }
  if (f < b.not) {
    return { c: mixShot(nearWheel, closeWheel, seg(f, b.gym, b.not)), blur: 0 };
  }
  if (f < b.punish) {
    return { c: mixShot(closeWheel, punishShot, seg(f, b.not, b.punish)), blur: 0 };
  }
  if (f < b.engineer) {
    // slow push into the wheel
    return { c: mixShot(punishShot, engineerShot, seg(f, b.punish, b.engineer, easeOut)), blur: 0 };
  }
  if (f < b.walk) {
    return { c: mixShot(engineerShot, mechanismClose, seg(f, b.engineer, b.walk)), blur: 0 };
  }
  if (f < b.grind) {
    // rise over the wheel
    return { c: mixShot(mechanismClose, topView, seg(f, b.walk, b.grind, easeInOut)), blur: 0 };
  }
  if (f < b.torture) {
    return { c: mixShot(topView, energyShot, seg(f, b.grind, b.torture, easeOut)), blur: 0 };
  }
  if (f < b.harsh) {
    return { c: energyShot, blur: 0 };
  }
  if (f < b.banned) {
    return { c: mixShot(energyShot, banShot, seg(f, b.harsh, b.banned, easeInOut)), blur: 0 };
  }
  if (f < b.us) {
    // the ban + dolly zoom effect as the prison crumbles
    const dz = dollyZoom(seg(f, b.banned, b.us), {
      target: [0, 3.0, 0] as V3,
      dir: [0, 0, 1] as V3,
      width: 6,
      fovFrom: 50,
      fovTo: 28,
    });
    return { c: dz, blur: 0 };
  }
  // whip pan to the modern gym
  if (f < b.us + 8) {
    const t = seg(f, b.us, b.us + 8);
    const wp = whipPan(t, { from: banShot, to: modernWide });
    blur = whipBlur(t);
    return { c: wp, blur };
  }
  if (f < b.pay) {
    return { c: mixShot(modernWide, modernClose, seg(f, b.us + 8, b.pay, easeOut)), blur: 0 };
  }
  if (f < b.wall) {
    return { c: mixShot(modernClose, wallShot, seg(f, b.pay, b.wall, easeInOut)), blur: 0 };
  }
  if (f < b.coin) {
    return { c: mixShot(wallShot, coinShot, seg(f, b.wall, b.coin, easeOut)), blur: 0 };
  }
  // coin part: camera holds
  return { c: coinShot, blur: 0 };
};

// ---------------------------------------------------------------- 2D overlays
const YearSign: React.FC<{ f: number; at: number; text: string; color: string; until: number }> = ({ f, at, text, color, until }) => {
  const show = seg(f, at, at + 6);
  const hide = seg(f, until, until + 4);
  const op = show * (1 - hide);
  if (op < 0.01) return null;
  const scale = 0.6 + 0.4 * springAt(f, at, 0.4, 7);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 240,
          transform: `translate(-50%, -50%) scale(${scale})`,
          font: `bold 72px ${AR}`,
          color,
          textShadow: `0 0 40px ${color}, 0 0 80px ${color}`,
          opacity: op,
          letterSpacing: 6,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const Tag: React.FC<{ f: number; at: number; until: number; x: number; y: number; text: string; bg: string; ink: string; rot?: number }> = ({
  f, at, until, x, y, text, bg, ink, rot = 0,
}) => {
  const show = springAt(f, at, 0.5, 6);
  const hide = seg(f, until - 4, until);
  const op = show * (1 - hide);
  if (op < 0.01) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${0.8 + 0.2 * show})`,
          font: `bold 48px ${AR}`,
          color: ink,
          background: bg,
          padding: "12px 32px",
          borderRadius: 16,
          opacity: op,
          boxShadow: `0 0 30px ${bg}66`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const HoursCounter: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const p = seg(f, at, at + 20, easeOut);
  const h = Math.round(p * 6);
  if (p < 0.01) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 320,
          font: `bold 86px ${AR}`,
          color: CYAN,
          textShadow: `0 0 30px ${CYAN}`,
          opacity: Math.min(1, p * 3),
        }}
      >
        {h}h
      </div>
    </AbsoluteFill>
  );
};

const DebugOverlay: React.FC<{ info: string }> = ({ info }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 20, top: 20, right: 20, color: "#fff", background: "rgba(0,0,0,0.6)", font: "22px monospace", padding: 8, whiteSpace: "pre-wrap" }}>{info}</div>
    <div style={{ position: "absolute", left: 0, top: 1170, width: 1080, height: 0, borderTop: "3px dashed #ff00aa" }} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------- the 3D world
const World: React.FC<{ f: number; b: TBeats; c: Shot }> = ({ f, b, c }) => {
  const prisonVis = 1 - seg(f, b.us, b.us + 12); // prison fades out at the whip pan
  const modernVis = seg(f, b.us - 2, b.us + 10); // modern gym fades in
  const wheelSpin = -f * 0.025; // slow constant spin
  const energyGlow = seg(f, b.energy, b.energy + 15, easeOut) * (1 - seg(f, b.harsh, b.harsh + 10));
  const prisonCrack = seg(f, b.banned, b.us, easeIn);
  const limeK = seg(f, b.app, b.app + 15, easeOut);

  // floor colour transitions
  const fogCol = limeK > 0.5 ? NPAL.limeFog : NPAL.fog;
  const floorCol = limeK > 0.5 ? NPAL.limeFloor : NPAL.floor;

  return (
    <>
      <ShotRig shot={c} />
      <ambientLight intensity={0.15} />
      <pointLight position={[c.p[0], c.p[1] + 1, c.p[2]]} intensity={0.6} distance={30} color="#C8D4FF" />

      {/* fog */}
      <fog attach="fog" args={[fogCol, 3, 45]} />

      {/* prison area (z > -15) */}
      {prisonVis > 0.01 && (
        <group position={[0, 0, 0]} scale={[1, 1, 1]}>
          {/* corridor floor */}
          <Part geo={box(7, 0.1, 40)} color={NPAL.floor} position={[0, -0.05, 5]} />

          {/* corridor walls */}
          <CorridorWall side={-1} zFrom={-5} zTo={25} />
          <CorridorWall side={1} zFrom={-5} zTo={25} />

          {/* ceiling ribs */}
          {Array.from({ length: 8 }, (_, i) => (
            <Part key={`rib${i}`} geo={box(6.4, 0.12, 0.12)} color={BLUE} emissive={BLUE} emissiveIntensity={0.8} position={[0, 6.3, 22 - i * 3.5]} shadow={false} />
          ))}

          {/* the treadwheel */}
          <group position={[0, 0, 0]}>
            <TreadWheel spin={wheelSpin} glow={energyGlow} crack={prisonCrack} />

            {/* prisoners on the wheel */}
            {[0, 1, 2, 3, 4, 5].map((slot) => (
              <PrisonerOnWheel
                key={slot}
                spin={wheelSpin}
                slot={slot}
                colors={[prisonerColors, prisoner2Colors, prisoner3Colors][slot % 3]}
                seed={slot * 7 + 1}
                frame={f}
                exhausted={seg(f, b.harsh, b.harsh + 15)}
              />
            ))}
          </group>

          {/* prison bars (at the corridor entrance, behind the camera) */}
          <PrisonBars position={[0, 0, 20]} open={prisonCrack} />

          {/* chains hanging from the ceiling */}
          {[-2, 0.5, 2.5].map((x, i) => (
            <group key={`ch${i}`} position={[x, 5.8, 15 - i * 4]}>
              {Array.from({ length: 5 }, (_, j) => (
                <Part key={j} geo={torusArc(0.12, 0.03, Math.PI * 1.6)} color={IRON} position={[0, -j * 0.25, 0]} rotation={[j * 0.5, 0, 0]} />
              ))}
            </group>
          ))}

          {/* neon sign: 1818 */}
          <NeonText position={[0, 5.5, 5]} text="1818" color={RED} size={0.8} opacity={seg(f, b.year, b.year + 8) * (1 - seg(f, b.engineer, b.engineer + 6))} />
        </group>
      )}

      {/* modern gym area (z < -30) */}
      {modernVis > 0.01 && (
        <group position={[0, 0, -40]}>
          <GymFloor lime={limeK} />

          {/* walls */}
          <Part geo={box(16, 5, 0.2)} color="#0C1218" position={[0, 2.5, -6]} />
          <Part geo={box(0.2, 5, 14)} color="#0C1218" position={[-8, 2.5, 0]} />
          <Part geo={box(0.2, 5, 14)} color="#0C1218" position={[8, 2.5, 0]} />

          {/* neon ribs on walls */}
          <Part geo={box(16, 0.06, 0.06)} color={limeK > 0.5 ? LIME : BLUE} emissive={limeK > 0.5 ? LIME : BLUE} emissiveIntensity={1.0} position={[0, 4.8, -5.9]} shadow={false} />
          <Part geo={box(16, 0.06, 0.06)} color={limeK > 0.5 ? LIME : BLUE} emissive={limeK > 0.5 ? LIME : BLUE} emissiveIntensity={0.6} position={[0, 0.2, -5.9]} shadow={false} />

          {/* mirrors on the back wall */}
          <GymMirror position={[-3, 2.2, -5.8]} w={3} h={2.5} />
          <GymMirror position={[3, 2.2, -5.8]} w={3} h={2.5} />

          {/* a modern treadmill */}
          <Treadmill position={[0, 0, -2]} rotationY={Math.PI} frame={f} />

          {/* a runner on the treadmill */}
          <Blocky
            pose={alive(runnerPose(f * 0.18, 0.7), f, 42, 0.3)}
            colors={modernRunnerColors}
            position={[0, 0.24, -2]}
            rotationY={Math.PI}
            scale={1.0}
          />

          {/* other gym equipment in the background */}
          <Treadmill position={[-3, 0, -2]} rotationY={Math.PI} frame={f} />
          <Treadmill position={[3, 0, -2]} rotationY={Math.PI} frame={f} />

          {/* wall clock */}
          <NeonClock position={[0, 4.0, -5.85]} minutes={f * 0.1} color={limeK > 0.5 ? LIME : CYAN} s={0.8} />

          {/* neon sign: the year 1902 appears and shatters the prison */}
          {/* (shown as an overlay instead) */}
        </group>
      )}
    </>
  );
};

// ---------------------------------------------------------------- main composition
export const FactTreadmill: React.FC<FactTreadmillProps> = ({
  beats = TREADMILL_BEATS,
  durationSec = TREADMILL_DURATION,
  debug = false,
}) => {
  const { width, height, fps } = useVideoConfig();
  const b = useMemo(() => makeTreadmillBeats(beats, fps, durationSec), [beats, fps, durationSec]);
  const frame = useCurrentFrame();
  const { c, blur } = camAt(b, frame);
  const limeK = seg(frame, b.app, b.app + 15, easeOut);
  const filters = blur > 0.01 ? `blur(${(blur * 3).toFixed(2)}px)` : "";

  return (
    <AbsoluteFill style={{ backgroundColor: limeK > 0.5 ? NPAL.limeBg : NPAL.bg }}>
      <AbsoluteFill style={{ filter: filters || undefined }}>
        <ThreeCanvas
          width={width}
          height={height}
          flat
          camera={{ fov: 60, near: 0.1, far: 3000, position: [0, 2, 10] }}
          gl={{ antialias: true }}
        >
          <World f={frame} b={b} c={c} />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Year signs */}
      <YearSign f={frame} at={b.year} text="1818" color={RED} until={b.punish} />
      <YearSign f={frame} at={b.year2} text="1902" color={CYAN} until={b.us} />

      {/* Hours counter on scene 2 */}
      <HoursCounter f={frame} at={b.six} />

      {/* Tags */}
      <Tag f={frame} at={b.punish} until={b.engineer} x={540} y={1400} text="عقاب 🔗" bg={RED} ink="#FFF" rot={-3} />
      <Tag f={frame} at={b.torture} until={b.energy + 10} x={540} y={1400} text="تعذيب + طاقة ⚡" bg="#FF6B2B" ink="#FFF" rot={2} />
      <Tag f={frame} at={b.banned} until={b.year2} x={540} y={1400} text="ممنوع! ⛔" bg="#FFF" ink={RED} rot={-2} />
      <Tag f={frame} at={b.pay} until={b.wall} x={540} y={1400} text="💰 ندفع فلوس!" bg="#FFD700" ink={INK} rot={3} />

      {/* Lime wave */}
      <LimeWave f={frame} at={b.app} />

      {/* Debug */}
      {debug && (
        <DebugOverlay
          info={`f${frame} ${(frame / fps).toFixed(2)}s  p ${c.p.map((v) => v.toFixed(1)).join(",")} l ${c.l.map((v) => v.toFixed(1)).join(",")} fov ${c.fov.toFixed(0)}`}
        />
      )}
    </AbsoluteFill>
  );
};
