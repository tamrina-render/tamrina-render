import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { SkyDome } from "./fact3d/props";
import { PAL, Part, box, circle, cyl, rbox, sphere, torusArc } from "./fact3d/parts";
import { clamp, easeInOut, easeOut, hash, lerp, seg, wobble } from "./fact3d/anim";
import { alive, proudPose, runnerPose, walkPose, wavePose, tremble } from "./fact3d/acting";

// Tendon stronger than steel: gantry test (steel rod snaps, tendon rope holds) -> hero lifts -> couch joke.

export type FactTendonProps = {
  starts?: number[]; // 4 clause starts (s)
  durationSec?: number;
  debug?: boolean;
};

const DEFAULT_STARTS = [0, 2.951, 10.431, 17.011, 22.045];
const DEFAULT_DURATION = 29.1;

type V3 = [number, number, number];

const JONNY: BlockyColors = { skin: "#E0A47A", shirt: PAL.mustard, pants: "#2A2E36", shoes: "#F4F2EC", hair: "#3A2E22", face: PAL.ink };
const ALI: BlockyColors = { skin: "#E8B088", shirt: PAL.teal, pants: "#2A2E36", shoes: "#F4F2EC", hair: "#2C211D", face: PAL.ink };
const RACER1: BlockyColors = { skin: "#9A6444", shirt: PAL.terracotta, pants: "#3F4A5A", shoes: "#FFF", hair: "#2C211D", face: PAL.ink };
const RACER2: BlockyColors = { skin: "#EFC49A", shirt: "#7FA8C9", pants: "#333B48", shoes: "#FFF", hair: "#8A5A30", face: PAL.ink };
const OFFICIAL: BlockyColors = { skin: "#E0A47A", shirt: "#3A3F4A", pants: "#2A2E36", shoes: "#222", hair: "#3A2E22", face: PAL.ink };


const HERO: BlockyColors = { skin: "#E0A47A", shirt: PAL.teal, pants: "#2A2E36", shoes: "#F4F2EC", hair: "#3A2E22", face: PAL.ink };

const Plate: React.FC<{ y: number; c?: string }> = ({ y, c = "#3A3F4A" }) => (
  <Part geo={cyl(0.7, 0.7, 0.2, 18)} color={c} position={[0, y, 0]} />
);

const Gantry: React.FC<{ f: number; cuts: number[]; fps: number }> = ({ f, cuts, fps }) => {
  const t0 = cuts[1];
  const snapF = t0 + Math.round(3.6 * fps);
  const nPlates = (start: number) => Math.max(0, Math.min(7, Math.floor((f - start) / 14)));
  const steelN = f >= snapF ? 5 : nPlates(t0 + 6);
  const ropeN = nPlates(t0 + 6);
  const snapped = f >= snapF;
  const fall = snapped ? (f - snapF) : 0;
  const fy = Math.max(0, 2.6 - fall * fall * 0.012);
  const sway = Math.sin(f * 0.18) * (snapped ? 0 : 0.015 * steelN);
  const ropeShake = Math.sin(f * 0.5) * 0.012 * ropeN;
  const glow = f >= t0 + 20 ? 0.5 + 0.3 * Math.sin(f * 0.2) : 0;
  return (
    <group position={[-1.0, 0, -1]}>
      {[-2.4, 2.4].map((x) => (
        <Part key={x} geo={cyl(0.12, 0.14, 5.6, 10)} color={PAL.steel} position={[x, 2.8, 0]} />
      ))}
      <Part geo={rbox(5.4, 0.3, 0.4, 0.06)} color={PAL.steel} position={[0, 5.6, 0]} />
      {/* steel rod */}
      <group position={[-1.2, 0, 0]}>
        <Part geo={cyl(0.1, 0.1, snapped ? 0.9 : 3.0, 10)} color="#8A94A0" position={[0, snapped ? 5.0 : 4.0, 0]} />
        {!snapped && (
          <group position={[sway, 0, 0]}>
            <Part geo={cyl(0.1, 0.1, 0.1, 10)} color="#8A94A0" position={[0, 2.5, 0]} />
            {[...Array(steelN)].map((_, i) => <Plate key={i} y={2.1 - i * 0.22} />)}
          </group>
        )}
        {snapped && (
          <group position={[0, fy, 0]} rotation={[0, 0, Math.min(fall * 0.05, 0.4)]}>
            <Part geo={cyl(0.1, 0.1, 1.8, 10)} color="#8A94A0" position={[0, 2.8, 0]} rotation={[0, 0, 0.5]} />
            {[...Array(steelN)].map((_, i) => <Plate key={i} y={2.1 - i * 0.22} />)}
          </group>
        )}
        {snapped && fall < 10 && <Part geo={sphere(0.35 + fall * 0.05, 8)} color="#F5D76E" basic opacity={clamp(0.9 - fall * 0.08)} position={[0, 4.6, 0.2]} shadow={false} />}
      </group>
      {/* tendon rope (cream collagen strap) */}
      <group position={[1.2 + ropeShake, 0, 0]}>
        <Part geo={cyl(0.14, 0.14, 3.0, 10)} color="#F2E3C6" position={[0, 4.1, 0]} />
        <Part geo={cyl(0.19, 0.19, 0.2, 10)} color="#E8B088" position={[0, 2.55, 0]} />
        {[...Array(ropeN)].map((_, i) => <Plate key={i} y={2.2 - i * 0.22} c={i % 2 ? "#3A3F4A" : "#C2573F"} />)}
        {glow > 0 && <Part geo={sphere(0.9, 14)} color="#F5D76E" basic opacity={0.12 * glow} position={[0, 3.8, 0]} shadow={false} />}
      </group>
    </group>
  );
};

const liftPose = (f: number, t: number): BlockyPose => {
  const k = seg(f, t, t + 20, easeOut);
  const p = restPose();
  p.armL = { sx: lerp(-0.2, -2.95, k), sz: 0.15, twist: 0, elbow: lerp(-0.3, -0.1, k) };
  p.armR = { sx: lerp(-0.2, -2.95, k), sz: -0.15, twist: 0, elbow: lerp(-0.3, -0.1, k) };
  p.brow = 0.6 * k;
  p.mouth = k > 0.5 ? "grin" : "smile";
  p.lean = lerp(0, -0.06, k);
  return alive(p, f, 5, 0.6);
};

const Barbell: React.FC<{ y: number }> = ({ y }) => (
  <group position={[0, y, 0]}>
    <Part geo={cyl(0.06, 0.06, 3.2, 10)} color={PAL.steel} rotation={[0, 0, Math.PI / 2]} />
    {[-1.35, 1.35].map((x) => (
      <Part key={x} geo={cyl(0.55, 0.55, 0.2, 18)} color="#3A3F4A" position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
    ))}
  </group>
);

const TendonWorld: React.FC<{ f: number; cuts: number[]; fps: number }> = ({ f, cuts, fps }) => {
  let beat = cuts.length - 1;
  for (let k = 1; k < cuts.length; k++) if (f < cuts[k]) { beat = k - 1; break; }
  const t0 = cuts[1];
  const liftT = cuts[2] + 20;
  const standing = beat < 3;
  return (
    <group>
      {/* gym room */}
      <Part geo={circle(70, 48)} color="#D9B57E" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} />
      <Part geo={rbox(40, 9, 0.4, 0.05)} color="#E8DCC4" position={[0, 4.5, -5]} />
      {[-10, -5, 0, 5, 10].map((x) => (
        <Part key={x} geo={rbox(0.5, 9, 0.2, 0.04)} color="#C9B590" position={[x, 4.5, -4.75]} />
      ))}
      <Part geo={rbox(40, 0.15, 3, 0.04)} color="#7C8A97" position={[0, 0.08, -3]} />
      <Gantry f={f} cuts={cuts} fps={fps} />
      {/* hero */}
      {beat <= 1 && (
        <group position={[2.2, 0.02, 1.2]} rotation={[0, -0.45, 0]}>
          <Blocky pose={beat === 0 ? alive({ ...restPose(), armR: { sx: -1.4, sz: -0.5, twist: 0, elbow: -0.5 }, brow: 0.8, mouth: "o", mouthOpen: 0.3 }, f, 3, 0.8) : alive({ ...restPose(), armL: { sx: -0.6, sz: 0.8, twist: 0, elbow: -1.3 }, brow: f >= t0 + 108 ? 1 : 0.5, eyeWide: f >= t0 + 108 ? 1.3 : 1, mouth: f >= t0 + 108 ? "o" : "smile", mouthOpen: f >= t0 + 108 ? 0.5 : 0 }, f, 3, 0.8)} colors={HERO} scale={1} />
        </group>
      )}
      {beat === 2 && (
        <group position={[0.4, 0.02, 1.2]} rotation={[0, -0.1, 0]}>
          <Blocky pose={liftPose(f, cuts[2] + 20)} colors={HERO} scale={1} />
          <Barbell y={lerp(1.45, 3.05, seg(f, cuts[2] + 20, cuts[2] + 40, easeOut))} />
          {/* tendon glow on the calf */}
          <Part geo={rbox(0.3, 0.7, 0.3, 0.06)} color="#F5D76E" basic opacity={0.5 + 0.3 * Math.sin(f * 0.25)} position={[0.22, 0.45, 0.02]} shadow={false} />
        </group>
      )}
      {beat >= 3 && (
        <group position={[0.4, 0.02, 1.2]} rotation={[0, -0.1, 0]}>
          {/* couch */}
          <Part geo={rbox(3.4, 0.55, 1.3, 0.12)} color={PAL.teal} position={[0, 0.5, 0.4]} />
          <Part geo={rbox(3.4, 1.1, 0.4, 0.12)} color={PAL.tealDark} position={[0, 1.2, -0.15]} />
          <Part geo={rbox(0.45, 0.95, 1.3, 0.12)} color={PAL.tealDark} position={[-1.6, 0.85, 0.4]} />
          <Part geo={rbox(0.45, 0.95, 1.3, 0.12)} color={PAL.tealDark} position={[1.6, 0.85, 0.4]} />
          <group position={[0, 0.52, 0.5]}>
            <Blocky pose={alive({ ...restPose(), legL: { hip: -1.35, sz: 0.05, knee: 1.35 }, legR: { hip: -1.35, sz: 0.05, knee: 1.35 }, armR: { sx: -0.2, sz: -0.7, twist: 0, elbow: -1.0 }, armL: { sx: -1.2, sz: 0.3, twist: 0, elbow: -0.6 }, mouth: "flat", brow: 0.2, eyeOpen: 0.7, headTilt: 0.1 }, f, 7, 0.5)} colors={HERO} scale={0.95} noBlob />
          </group>
          {/* the idle dumbbell on the floor, judging him */}
          <group position={[2.6, 0.2, 1.2]}>
            <Part geo={cyl(0.07, 0.07, 0.9, 8)} color={PAL.steel} rotation={[0, 0, Math.PI / 2]} />
            {[-0.45, 0.45].map((x) => <Part key={x} geo={cyl(0.28, 0.28, 0.18, 14)} color="#3A3F4A" position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} />)}
          </group>
        </group>
      )}
    </group>
  );
};

const useCam = (frame: number, cuts: number[]) => {
  const beats: { eye: V3; look: V3 }[] = [
    { eye: [0.9, 3.0, 13.6], look: [0.6, 2.4, 0] },
    { eye: [-1.0, 3.1, 11.8], look: [-1.0, 2.7, -0.5] },
    { eye: [0.4, 2.9, 11.8], look: [0.4, 2.0, 1] },
    { eye: [0.4, 2.2, 11.4], look: [0.4, 1.3, 1] },
    { eye: [0.4, 2.2, 11.4], look: [0.4, 1.3, 1] },
  ];
  let i = 0;
  for (let k = 1; k < cuts.length; k++) if (frame >= cuts[k]) i = k;
  const next = cuts[i + 1] ?? cuts[i] + 200;
  const drift = clamp((frame - cuts[i]) / Math.max(1, next - cuts[i]));
  const b = beats[i];
  const eye: V3 = [b.eye[0] + drift * 0.6, b.eye[1] + drift * 0.15, b.eye[2] - drift * 0.8];
  return { eye, look: b.look };
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

export const FactTendon: React.FC<FactTendonProps> = ({ starts = DEFAULT_STARTS, durationSec = DEFAULT_DURATION, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const cuts = useMemo(() => starts.map((t) => Math.round(t * fps)), [starts, fps]);
  const frame = useCurrentFrame();
  void debug;
  return (
    <AbsoluteFill style={{ backgroundColor: "#FBE7C6" }}>
      <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 40, near: 0.1, far: 900, position: [0, 3, 10] }}>
        <Cam cuts={cuts} />
        <SkyDome top="#7FA8C9" horizon="#FBE7C6" />
        <fog attach="fog" args={["#F6E2C0", 55, 160]} />
        <hemisphereLight args={["#D6ECF6", "#EBCB9C", 1.7]} />
        <directionalLight position={[-3, 8, -10]} intensity={1.0} color="#D8E8FF" />
        <directionalLight position={[7, 12, 8]} intensity={2.7} color="#FFE7C0" castShadow shadow-mapSize={[1024, 1024]} />
        <TendonWorld f={frame} cuts={cuts} fps={fps} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
