import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { SkyDome } from "./fact3d/props";
import { PAL, Part, box, circle, cyl, rbox, sphere, torusArc } from "./fact3d/parts";
import { clamp, easeInOut, easeOut, hash, lerp, seg, wobble } from "./fact3d/anim";
import { alive, proudPose, runnerPose, walkPose, wavePose, tremble } from "./fact3d/acting";

// Brownlee brothers, Cozumel 2016: Jonny dizzy 700m from the line, Alistair shoulders him
// the last 100m and pushes him over. 4 clause starts drive every cut.

export type FactBrownleeProps = {
  starts?: number[]; // 4 clause starts (s): carry hook, dizzy 700m, support+push, partner joke/celebration
  durationSec?: number;
  debug?: boolean;
};

const DEFAULT_STARTS = [0, 3.781, 9.885, 14.68, 20.956];
const DEFAULT_DURATION = 27.3;

type V3 = [number, number, number];

const JONNY: BlockyColors = { skin: "#E0A47A", shirt: PAL.mustard, pants: "#2A2E36", shoes: "#F4F2EC", hair: "#3A2E22", face: PAL.ink };
const ALI: BlockyColors = { skin: "#E8B088", shirt: PAL.teal, pants: "#2A2E36", shoes: "#F4F2EC", hair: "#2C211D", face: PAL.ink };
const RACER1: BlockyColors = { skin: "#9A6444", shirt: PAL.terracotta, pants: "#3F4A5A", shoes: "#FFF", hair: "#2C211D", face: PAL.ink };
const RACER2: BlockyColors = { skin: "#EFC49A", shirt: "#7FA8C9", pants: "#333B48", shoes: "#FFF", hair: "#8A5A30", face: PAL.ink };
const OFFICIAL: BlockyColors = { skin: "#E0A47A", shirt: "#3A3F4A", pants: "#2A2E36", shoes: "#222", hair: "#3A2E22", face: PAL.ink };

// ---------- poses ----------
// Jonny out of it: limp, head hanging
const limpPose = (f: number): BlockyPose => {
  const p = restPose();
  p.lean = 0.4 + Math.sin(f * 0.05) * 0.05;
  p.headPitch = 0.55;
  p.headTilt = Math.sin(f * 0.04) * 0.1;
  p.eyeOpen = 0.3;
  p.brow = 0.9;
  p.mouth = "wavy";
  p.armL = { sx: -0.1, sz: 0.15, twist: 0, elbow: -0.4 };
  p.armR = { sx: -0.1, sz: 0.15, twist: 0, elbow: -0.4 };
  p.legL = { hip: 0.1, sz: 0.03, knee: 0.2 };
  p.legR = { hip: -0.05, sz: 0.03, knee: 0.25 };
  return p;
};

// heat-dizzy stagger (beat 1: alone, 700m out)
const dizzyWalk = (f: number): BlockyPose => {
  const p = walkPose(f * 0.1, 0.5);
  p.lean = 0.36 + Math.sin(f * 0.06) * 0.08;
  p.roll = Math.sin(f * 0.09) * 0.18;
  p.headPitch = 0.32;
  p.headTilt = Math.sin(f * 0.07) * 0.15;
  p.eyeOpen = 0.5;
  p.brow = 0.85;
  p.mouth = "wavy";
  p.armL = { sx: -0.4, sz: 0.5, twist: 0, elbow: -1.1 };
  p.armR = { sx: -0.5, sz: 0.45, twist: 0, elbow: -1.2 };
  return tremble(p, f, 3, 0.6);
};

// carrying Alistair: walking, arms up locking the legs on his shoulders
const carryPose = (f: number): BlockyPose => {
  const p = walkPose(f * 0.13, 0.62);
  p.armL = { sx: -2.5, sz: 0.55, twist: 0, elbow: -1.6 };
  p.armR = { sx: -2.5, sz: -0.55, twist: 0, elbow: -1.6 };
  p.headPitch = -0.12;
  p.brow = 0.7;
  p.mouth = "flat";
  p.lean = 0.12;
  return p;
};

// supported walk: Jonny upright-ish, leaning right onto Alistair
const leanedOn = (f: number): BlockyPose => {
  const p = walkPose(f * 0.12, 0.45);
  p.lean = 0.22;
  p.roll = -0.3;
  p.headPitch = 0.28;
  p.headTilt = -0.2;
  p.eyeOpen = 0.55;
  p.brow = 0.8;
  p.mouth = "wavy";
  p.armR = { sx: -2.2, sz: -0.4, twist: 0, elbow: -0.6 }; // over Alistair's shoulder
  p.armL = { sx: -0.2, sz: 0.3, twist: 0, elbow: -0.9 };
  return tremble(p, f, 5, 0.35);
};

// Alistair while supporting: walking, left arm around Jonny
const supporting = (f: number): BlockyPose => {
  const p = walkPose(f * 0.12 + Math.PI, 0.45);
  p.armL = { sx: -1.9, sz: 0.75, twist: 0, elbow: -1.1 };
  p.armR = { sx: -0.4, sz: -0.3, twist: 0, elbow: -1.2 };
  p.headPitch = 0.05;
  p.brow = 0.75;
  p.mouth = "flat";
  p.lean = 0.14;
  p.roll = 0.12;
  return p;
};

// ---------- props ----------
const FinishBanner: React.FC<{ position?: V3; f: number; crossF: number }> = ({ position, f, crossF }) => {
  const flap = Math.sin(f * 0.12) * 0.03;
  const lift = f >= crossF ? seg(f, crossF, crossF + 14, easeOut) : 0;
  return (
    <group position={position}>
      {[-2.6, 2.6].map((x) => (
        <Part key={x} geo={cyl(0.09, 0.12, 4.6, 10)} color={PAL.steel} position={[x, 2.3, 0]} />
      ))}
      <group rotation={[flap, 0, 0]}>
        <Part geo={box(5.6, 0.85, 0.05)} color="#F4F2EC" position={[0, 4.15, 0]} />
        {[-2.2, -1.1, 0, 1.1, 2.2].map((x, i) => (
          <Part key={x} geo={box(0.55, 0.85, 0.06)} color={i % 2 ? "#2E86C1" : "#F4F2EC"} basic position={[x + 0.28, 4.15, 0.005]} shadow={false} />
        ))}
      </group>
      <Part geo={rbox(4.4, 0.12, 0.03, 0.02)} color="#F5D76E" basic position={[0, 1.15 + lift * 0.7, 0]} rotation={[0, 0, lift * 0.35]} shadow={false} />
    </group>
  );
};

const Confetti: React.FC<{ f: number; startF: number }> = ({ f, startF }) => (
  <>
    {[...Array(26)].map((_, i) => {
      const age = f - startF - hash(i * 7.7) * 18;
      if (age < 0) return null;
      const x = (hash(i * 3.1) - 0.5) * 7;
      const y = 5.2 - age * 0.05 + hash(i) * 1.2;
      if (y < 0.1) return null;
      const z = (hash(i * 5.3) - 0.5) * 4;
      const c = ["#2E86C1", "#F5D76E", PAL.mustard, "#F4F2EC"][i % 4];
      return <Part key={i} geo={box(0.12, 0.05, 0.16)} color={c} basic position={[x, y, z]} rotation={[age * 0.1 + i, i * 0.7, age * 0.07]} shadow={false} />;
    })}
  </>
);

// distance marker flag (the "700m" idea, no text: a small course flag)
const CourseFlag: React.FC<{ position?: V3; f: number }> = ({ position, f }) => (
  <group position={position}>
    <Part geo={cyl(0.05, 0.06, 2.2, 8)} color={PAL.steel} position={[0, 1.1, 0]} />
    <Part geo={box(0.9, 0.55, 0.03)} color={PAL.terracotta} basic position={[0.48, 1.9, 0]} rotation={[0, 0, wobble(f, 70, 0.08, 0.4, 3)]} shadow={false} />
  </group>
);

// ---------- the track world ----------
const TrackWorld: React.FC<{ f: number; cuts: number[]; fps: number }> = ({ f, cuts, fps }) => {
  let beat = cuts.length - 1;
  for (let k = 1; k < cuts.length; k++) if (f < cuts[k]) { beat = k - 1; break; }
  const pushF = cuts[2] + Math.round(2.9 * fps); // the shove over the line, mid clause 3
  const crossed = f >= pushF;
  const celebrating = f >= cuts[3];

  // pair motion per beat
  // beat 0: carry at center-left; beat 1: Jonny alone staggering; beat 2: support walk -> push; beat 3+: celebrate
  const supportT = seg(f, cuts[2], pushF, easeInOut); // 0..1 over the support walk
  const pairX = beat === 0 ? lerp(-2.2, -0.6, clamp(f / Math.max(1, cuts[1]))) : beat === 1 ? -1.2 : lerp(-4.6, 0.45, supportT) + (crossed && !celebrating ? seg(f, pushF, pushF + 22, easeOut) * 1.3 : 0);
  const jonnyPush = crossed ? seg(f, pushF, pushF + 12, easeOut) : 0;

  return (
    <group>
      {/* track */}
      <Part geo={circle(70, 48)} color="#C98F57" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} />
      <Part geo={rbox(26, 0.1, 5.2, 0.04)} color="#C2573F" position={[0, 0.04, 0]} />
      {[-2.2, -0.7, 0.8, 2.3].map((z) => (
        <Part key={z} geo={box(26, 0.02, 0.12)} color="#F6E7CF" basic position={[0, 0.1, z]} shadow={false} />
      ))}
      {/* stands + crowd */}
      <group position={[0, 0, -7]}>
        {[0, 1].map((r) => (
          <Part key={r} geo={rbox(18, 0.7, 1.2, 0.08)} color="#B9BFC7" position={[0, 0.5 + r * 0.85, -r * 1.1]} />
        ))}
        {[...Array(10)].map((_, i) => {
          const r = i % 2;
          const x = -8 + (i % 5) * 3.8 + r * 1.7;
          const tones = ["#C9768A", "#7FA8C9", PAL.mustard, PAL.teal, PAL.terracotta];
          const col: BlockyColors = { skin: ["#E0A47A", "#9A6444", "#EFC49A"][i % 3], shirt: tones[i % 5], pants: "#3F4A5A", shoes: "#EEE", hair: ["#2C211D", "#4A2E22", "#8A5A30"][i % 3], face: PAL.ink };
          return <Blocky key={i} pose={celebrating || crossed ? wavePose(f, i * 7) : alive(restPose(), f, i * 3, 0.6)} colors={col} position={[x, 0.9 + r * 0.85, -6.9 - r * 1.1]} rotationY={0} scale={0.62} />;
        })}
      </group>
      {/* brutal Cozumel sun + heat waves */}
      <Part geo={sphere(4.2, 24)} color="#FFE9B0" basic position={[-18, 16, -24]} shadow={false} />
      <Part geo={sphere(6.0, 24)} color="#FFDF9E" basic opacity={0.35} position={[-18, 16, -25]} shadow={false} />
      {[0, 1, 2].map((i) => (
        <Part key={i} geo={torusArc(0.5 + i * 0.1, 0.03, Math.PI)} color="#FFFFFF" basic opacity={0.15} position={[-4 + i * 3.2, 0.6 + Math.sin(f * 0.1 + i) * 0.12, -2.2]} rotation={[0.2, 0, 0]} shadow={false} />
      ))}
      <CourseFlag position={[-3.4, 0, 2.6]} f={f} />
      <FinishBanner position={[0.9, 0, 0]} f={f} crossF={pushF} />
      {/* background racers streaming past (they finish while Jonny struggles) */}
      {(beat <= 1) && (
        <>
          <Blocky pose={runnerPose(f * 0.32, 1)} colors={RACER1} position={[-9 + ((f * 0.06) % 30), 0.16, -1.4]} rotationY={Math.PI / 2} scale={0.95} />
          <Blocky pose={runnerPose(f * 0.3 + 2, 1)} colors={RACER2} position={[-13 + ((f * 0.055 + 6) % 30), 0.16, 1.5]} rotationY={Math.PI / 2} scale={0.95} />
        </>
      )}

      {/* beat 1: Jonny alone, staggering */}
      {beat === 1 && (
        <group position={[pairX + Math.sin(f * 0.09) * 0.35, 0.14, 0.5]} rotation={[0, Math.PI / 2 - 0.5, 0]}>
          <Blocky pose={dizzyWalk(f)} colors={JONNY} scale={1} />
          {[0, 1].map((i) => {
            const age = (f + i * 14) % 28;
            return <Part key={i} geo={sphere(0.06, 6)} color="#BFE3F0" basic opacity={clamp(0.9 - age * 0.05)} position={[0.3, 1.9 - age * 0.03, 0.75]} shadow={false} />;
          })}
        </group>
      )}

      {/* beat 0: the carry hook / beats 2-3: support walk then push / celebration */}
      {beat !== 1 && !celebrating && (
        <>
          {/* Alistair underneath */}
          <group position={[pairX, 0.14, 0.45]} rotation={[0, Math.PI / 2 - 0.35, 0]}>
            <Blocky pose={beat === 0 ? carryPose(f) : supporting(f)} colors={ALI} scale={1} />
          </group>
          {/* Jonny: on the shoulders (beat 0) or leaning on the shoulder (beat 2+), lunges at the push */}
          {beat === 0 ? (
            <group position={[pairX, 2.15, 0.45]} rotation={[Math.PI / 2 - 0.15, Math.PI / 2 - 0.35, 0]}>
              <Blocky pose={limpPose(f)} colors={JONNY} scale={0.96} noBlob />
            </group>
          ) : (
            <group position={[pairX + 0.85 + jonnyPush * 1.15, 0.14, 0.75]} rotation={[0, Math.PI / 2 - 0.4 - jonnyPush * 0.3, jonnyPush * 0.18]}>
              <Blocky pose={crossed ? alive({ ...proudPose(), mouth: "o", mouthOpen: 0.4, brow: 1 }, f, 41) : leanedOn(f)} colors={JONNY} scale={0.98} />
            </group>
          )}
        </>
      )}

      {/* celebration: side by side, arms on shoulders, waving */}
      {celebrating && (
        <>
          <group position={[0.9, 0.14, 0.4]} rotation={[0, 0.35, 0]}>
            <Blocky pose={alive({ ...proudPose(), armR: { sx: -2.3, sz: -0.5, twist: 0, elbow: -0.5 }, mouth: "grin", brow: 0.5 }, f, 43)} colors={JONNY} scale={0.98} />
          </group>
          <group position={[-0.35, 0.14, 0.55]} rotation={[0, -0.3, 0]}>
            <Blocky pose={alive({ ...proudPose(), armL: { sx: -2.3, sz: 0.5, twist: 0, elbow: -0.5 }, mouth: "grin", brow: 0.5 }, f, 47)} colors={ALI} scale={1} />
          </group>
          <Confetti f={f} startF={cuts[3] + 6} />
        </>
      )}

      {/* official reacting at the line */}
      <Blocky pose={alive({ ...restPose(), armR: { sx: -1.9, sz: 0.2, twist: 0, elbow: -0.5 }, headPitch: 0.35, eyeY: 0.6, brow: crossed ? 1 : 0, eyeWide: crossed ? 1.35 : 1, mouth: crossed ? "o" : "flat", mouthOpen: crossed ? 0.5 : 0 }, f, 61)} colors={OFFICIAL} position={[3.4, 0.06, 1.6]} rotationY={-2.5} />
    </group>
  );
};

// ---------- camera ----------
const useCam = (frame: number, cuts: number[]) => {
  // beat 0 = the carry hook, 1 = dizzy alone, 2 = support walk + push, 3+ = celebration
  const beats: { eye: V3; look: V3 }[] = [
    { eye: [-0.8, 2.9, 12.8], look: [-1.4, 1.8, 0.4] },
    { eye: [-2.0, 2.8, 13.0], look: [-1.2, 1.3, 0.4] },
    { eye: [-1.5, 3.0, 14.0], look: [-1.5, 1.4, 0] },
    { eye: [0.3, 2.8, 12.4], look: [0.3, 1.5, 0.3] },
    { eye: [0.3, 2.8, 12.4], look: [0.3, 1.5, 0.3] },
  ];
  let i = 0;
  for (let k = 1; k < cuts.length; k++) if (frame >= cuts[k]) i = k;
  const local = frame - cuts[i];
  const next = cuts[i + 1] ?? cuts[i] + 200;
  const span = Math.max(1, next - cuts[i]);
  const drift = clamp(local / span);
  const b = beats[i];
  const eye: V3 = [b.eye[0] + drift * 0.7, b.eye[1] + drift * 0.2, b.eye[2] - drift * 0.9];
  let look = b.look;
  if (i === 2) {
    const pushF = cuts[2] + 87;
    const t = clamp((frame - cuts[2]) / Math.max(1, pushF - cuts[2]));
    look = [lerp(-3.4, 0.9, easeInOut(t)), 1.4, 0];
    eye[0] = look[0] + 1.0;
  }
  return { eye, look };
};

import { useThree } from "@react-three/fiber";

const Cam: React.FC<{ cuts: number[] }> = ({ cuts }) => {
  const frame = useCurrentFrame();
  const { camera } = useThree();
  const { eye, look } = useCam(frame, cuts);
  camera.position.set(...eye);
  camera.lookAt(...look);
  return null;
};

export const FactBrownlee: React.FC<FactBrownleeProps> = ({ starts = DEFAULT_STARTS, durationSec = DEFAULT_DURATION, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const cuts = useMemo(() => starts.map((t) => Math.round(t * fps)), [starts, fps]);
  void debug;
  return (
    <AbsoluteFill style={{ backgroundColor: "#FBE7C6" }}>
      <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 40, near: 0.1, far: 900, position: [0, 3, 10] }}>
        <Cam cuts={cuts} />
        <SkyDome top="#3E8FC4" horizon="#FBE7C6" />
        <fog attach="fog" args={["#F6E2C0", 55, 160]} />
        <hemisphereLight args={["#D6ECF6", "#EBCB9C", 1.7]} />
        <directionalLight position={[-3, 8, -10]} intensity={1.0} color="#D8E8FF" />
        <directionalLight position={[7, 12, 8]} intensity={2.7} color="#FFE7C0" castShadow shadow-mapSize={[1024, 1024]} />
        <Part geo={circle(320, 48)} color={PAL.sand} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, -60]} />
        <TrackWorld f={useCurrentFrame()} cuts={cuts} fps={fps} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
