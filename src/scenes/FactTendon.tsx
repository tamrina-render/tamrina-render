import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { SkyDome } from "./fact3d/props";
import { PAL, Part, box, circle, cyl, rbox, sphere } from "./fact3d/parts";
import { clamp, easeInOut, hash, lerp, seg } from "./fact3d/anim";
import { alive, runnerPose, lerpPose } from "./fact3d/acting";

// V8 tendon: the Achilles tendon is a spring (stretches and recoils). Lab treadmill -> 11 runners -> push-off close-up -> couch joke -> CTA.
// Source: Scientific Reports s41598-021-84847-w (11 participants, treadmill, Achilles force 2.7x body weight walking / 3.2-3.5x running, elastic recoil). No steel.

export type FactTendonProps = { starts?: number[]; durationSec?: number; debug?: boolean };

const DEFAULT_STARTS = [0, 4.557, 12.006, 18.287, 25.4];
const DEFAULT_DURATION = 32;

type V3 = [number, number, number];

const HERO: BlockyColors = { skin: "#E0A47A", shirt: PAL.teal, pants: "#2A2E36", shoes: "#F4F2EC", hair: "#3A2E22", face: PAL.ink };
const OTHERS: BlockyColors[] = [
  { skin: "#9A6444", shirt: PAL.terracotta, pants: "#3F4A5A", shoes: "#FFF", hair: "#2C211D", face: PAL.ink },
  { skin: "#EFC49A", shirt: "#7FA8C9", pants: "#333B48", shoes: "#FFF", hair: "#8A5A30", face: PAL.ink },
  { skin: "#E8B088", shirt: PAL.mustard, pants: "#2A2E36", shoes: "#FFF", hair: "#1E1A18", face: PAL.ink },
  { skin: "#C98C62", shirt: "#C9768A", pants: "#4A5A6A", shoes: "#FFF", hair: "#2C211D", face: PAL.ink },
];
const LIME = "#C9F03A";

// ---- the Achilles spring: a coil that stretches (foot pushing) and recoils ----
const Coil: React.FC<{ h: number; r?: number; tube?: number; turns?: number; glow?: number }> = ({ h, r = 0.1, tube = 0.045, turns = 6, glow = 0 }) => {
  const n = turns * 7;
  return (
    <group>
      {[...Array(n + 1)].map((_, i) => {
        const t = i / n;
        const a = t * turns * Math.PI * 2;
        return <Part key={i} geo={sphere(tube, 6)} color={glow > 0.5 ? "#F4FF9A" : LIME} basic position={[Math.cos(a) * r, t * h, Math.sin(a) * r]} shadow={false} />;
      })}
      <Part geo={cyl(r * 1.3, r * 1.3, 0.04, 10)} color="#F2E3C6" position={[0, -0.02, 0]} shadow={false} />
      <Part geo={cyl(r * 1.3, r * 1.3, 0.04, 10)} color="#F2E3C6" position={[0, h + 0.02, 0]} shadow={false} />
    </group>
  );
};

const stretchOf = (phase: number) => 0.5 + 0.5 * Math.sin(phase);

// hero runs in place; two coils sit behind his calves (character faces +z locally)
const RunnerHero: React.FC<{ f: number; phase: number; amp?: number; scale?: number; colors?: BlockyColors; withCoil?: boolean; coilR?: number }> = ({ f, phase, amp = 1, scale = 1, colors = HERO, withCoil = true, coilR = 0.15 }) => {
  const p = runnerPose(phase, amp);
  p.brow = 0.15;
  const sL = stretchOf(phase);
  const sR = stretchOf(phase + Math.PI);
  return (
    <group scale={scale}>
      <Blocky pose={alive(p, f, 3, 0.4)} colors={colors} headband="#D9473B" />
      {withCoil && (
        <>
          <group position={[0.19, 0.24 + 0.05 * (1 - sL), -0.27]}><Coil h={0.5 + 0.38 * sL} r={coilR * 1.15} tube={coilR * 0.3} turns={5} glow={sL < 0.18 ? 1 : 0} /></group>
          <group position={[-0.19, 0.24 + 0.05 * (1 - sR), -0.27]}><Coil h={0.5 + 0.38 * sR} r={coilR * 1.15} tube={coilR * 0.3} turns={5} glow={sR < 0.18 ? 1 : 0} /></group>
        </>
      )}
    </group>
  );
};

const Treadmill: React.FC<{ f: number; speed?: number }> = ({ f, speed = 0.09 }) => (
  <group>
    <Part geo={rbox(1.5, 0.22, 3.6, 0.06)} color="#3A3F4A" position={[0, 0.11, 0]} />
    <Part geo={rbox(1.2, 0.04, 3.3, 0.02)} color="#2A2E36" position={[0, 0.24, 0]} />
    {[...Array(9)].map((_, i) => {
      const z = ((i * 0.4 + f * speed) % 3.6) - 1.8;
      return <Part key={i} geo={box(1.1, 0.02, 0.1)} color="#5A606C" position={[0, 0.265, z]} basic shadow={false} />;
    })}
    {[-0.72, 0.72].map((x) => <Part key={x} geo={rbox(0.1, 0.5, 3.6, 0.03)} color="#D9473B" position={[x, 0.35, 0]} />)}
    <Part geo={rbox(1.4, 0.12, 0.5, 0.04)} color="#2A2E36" position={[0, 1.65, -1.75]} />
    {[-0.6, 0.6].map((x) => <Part key={x} geo={cyl(0.04, 0.04, 1.5, 6)} color="#8A94A0" position={[x, 0.95, -1.75]} />)}
  </group>
);

const Lab: React.FC = () => (
  <group>
    <Part geo={circle(40, 40)} color="#EAD9B8" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -8]} />
    <Part geo={box(60, 9, 0.4)} color="#F3E6CC" position={[0, 4.5, -22]} />
    {[-14, -7, 0, 7, 14].map((x) => <Part key={x} geo={box(2.4, 2.8, 0.1)} color="#9FC6DA" position={[x, 4.6, -21.7]} basic shadow={false} />)}
  </group>
);

const Couch: React.FC = () => (
  <group>
    <Part geo={rbox(3.4, 0.55, 1.3, 0.12)} color={PAL.teal} position={[0, 0.5, 0.4]} />
    <Part geo={rbox(3.4, 1.1, 0.4, 0.12)} color={PAL.tealDark} position={[0, 1.2, -0.15]} />
    <Part geo={rbox(0.45, 0.95, 1.3, 0.12)} color={PAL.tealDark} position={[-1.6, 0.85, 0.4]} />
    <Part geo={rbox(0.45, 0.95, 1.3, 0.12)} color={PAL.tealDark} position={[1.6, 0.85, 0.4]} />
  </group>
);

const TendonWorld: React.FC<{ f: number; cuts: number[] }> = ({ f, cuts }) => {
  const labOn = f < cuts[3] + 4;
  const roomOn = f >= cuts[3] - 4;

  return (
    <group>
      {labOn && (
        <group>
          <Lab />
          {/* hero treadmill */}
          <group position={[0, 0, 0]}>
            <Treadmill f={f} />
            <group position={[0, 0.27, 0]} rotation={[0, 0.95, 0]}>
              <RunnerHero f={f} phase={f * (f >= cuts[2] ? 0.2 : 0.34)} amp={f >= cuts[2] ? 1.0 : 0.95} scale={f >= cuts[2] ? 1.25 : 1} coilR={f >= cuts[2] ? 0.15 : 0.15} />
            </group>
          </group>
          {/* the other ten: they appear as the camera pulls back (beat 1) and stay on */}
          {f >= cuts[1] - 40 && [...Array(10)].map((_, i) => {
            const row = i < 5 ? 0 : 1;
            const x = row === 0 ? -6 + (i % 5) * 3.0 : -4.5 + (i % 5) * 3.0;
            const z = row === 0 ? -5 : -9.5;
            const pop = seg(f, cuts[1] - 40 + i * 3, cuts[1] - 22 + i * 3);
            return (
              <group key={i} position={[x, 0, z]} scale={[1, pop, 1]}>
                <Treadmill f={f + i * 5} />
                <group position={[0, 0.27, 0]} rotation={[0, 0.95, 0]}>
                  <RunnerHero f={f} phase={f * 0.3 + hash(i + 1) * 6} amp={0.85} colors={OTHERS[i % 4]} withCoil={false} />
                </group>
              </group>
            );
          })}
        </group>
      )}
      {roomOn && <RoomBeats f={f} cuts={cuts} />}
      
    </group>
  );
};

// ---- couch joke + CTA ----
const sitBase = (): BlockyPose => ({ ...restPose(), legL: { hip: -1.35, sz: 0.05, knee: 1.35 }, legR: { hip: -1.35, sz: 0.05, knee: 1.35 } });
const sitSlump = (): BlockyPose => ({ ...sitBase(), armR: { sx: -0.2, sz: -0.7, twist: 0, elbow: -1.0 }, armL: { sx: -1.2, sz: 0.3, twist: 0, elbow: -0.6 }, mouth: "flat", brow: 0.2, eyeOpen: 0.7, headTilt: 0.1 });
const sitScratch = (lf: number): BlockyPose => ({ ...sitBase(), armL: { sx: -2.5, sz: 0.5, twist: 0, elbow: -2.3 + Math.sin(lf * 0.5) * 0.25 }, armR: { sx: -0.2, sz: -0.7, twist: 0, elbow: -1.0 }, mouth: "wavy", brow: 0.8, eyeOpen: 1, headTilt: 0.15, eyeX: Math.sin(lf * 0.1) });
const sitShrug = (): BlockyPose => ({ ...sitBase(), armL: { sx: -0.5, sz: 1.0, twist: 0, elbow: -1.6 }, armR: { sx: -0.5, sz: 1.0, twist: 0, elbow: -1.6 }, shrug: 1, mouth: "grin", brow: 0.5, browUp: 0.6, eyeOpen: 1 });
const sitLaugh = (lf: number): BlockyPose => ({ ...sitBase(), armL: { sx: -0.8, sz: 0.4, twist: 0, elbow: -1.2 }, armR: { sx: -0.8, sz: 0.4, twist: 0, elbow: -1.2 }, mouth: "grin", eyeOpen: 0.2, headTilt: Math.sin(lf * 0.4) * 0.12, bob: Math.abs(Math.sin(lf * 0.4)) * 0.04 });

const timeline = (lf: number, items: [number, (l: number) => BlockyPose][]): BlockyPose => {
  let i = 0;
  for (let k = 1; k < items.length; k++) if (lf >= items[k][0]) i = k;
  const cur = items[i][1](lf);
  if (i > 0) {
    const k = seg(lf, items[i][0], items[i][0] + 9);
    if (k < 1) return lerpPose(items[i - 1][1](lf), cur, k);
  }
  return cur;
};

const RoomBeats: React.FC<{ f: number; cuts: number[] }> = ({ f, cuts }) => {
  const lf = f - cuts[3];
  const cta = f >= cuts[4];
  const lc = f - cuts[4];
  // spring on the floor keeps working on its own: bounces by itself
  const b = 0.5 + 0.5 * Math.sin(f * 0.25);
  const sit: [number, (l: number) => BlockyPose][] = [
    [0, sitSlump],
    [42, sitScratch],
    [96, sitShrug],
    [150, sitLaugh],
  ];
  return (
    <group>
      <Part geo={circle(40, 40)} color="#EAD9B8" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -8]} />
      <Part geo={box(60, 9, 0.4)} color="#F3E6CC" position={[0, 4.5, -6]} />
      <Part geo={box(5, 3, 0.1)} color="#9FC6DA" position={[-3.5, 4.2, -5.7]} basic shadow={false} />
      <group position={[0.4, 0.02, 1.0]} rotation={[0, -0.1, 0]}>
        <Couch />
        {!cta && (
          <group position={[0, 0.52, 0.5]} rotation={[0, 0.25, 0]}>
            <Blocky pose={alive(timeline(lf, sit), f, 7, 0.5)} colors={HERO} scale={0.95} noBlob headband="#D9473B" />
          </group>
        )}
      </group>
      {!cta && (
        <group position={[3.0, 0.0, 1.6]} scale={[1, 0.8 + 0.3 * b, 1]}>
          <Coil h={1.5} r={0.34} tube={0.075} turns={6} glow={b > 0.9 ? 1 : 0} />
        </group>
      )}
      {cta && (
        <group position={[0.2 + Math.min(1, lc / 14) * 0.2, 0.02, 4.2]} rotation={[0, 0.25 + Math.sin(lc * 0.05) * 0.2, 0]}>
          <RunnerHero f={f} phase={f * 0.26} amp={lc < 80 ? 0.7 : 0.35} scale={1} />
          
        </group>
      )}
    </group>
  );
};

const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const beatCam = (frame: number, cuts: number[], i: number) => {
  const next = cuts[i + 1] ?? cuts[i] + 300;
  const d = clamp((frame - cuts[i]) / Math.max(1, next - cuts[i]));
  switch (i) {
    case 0: return { eye: [2.2 - d * 0.5, 1.7, 7.8 - d * 1.0] as V3, look: [0, 1.15, 0] as V3 };
    case 1: return { eye: [1.8 - d * 1.2, 4.6 + d * 0.5, 14.5 + d * 0.8] as V3, look: [0.2, 1.5, -4.2] as V3 };
    case 2: return { eye: [2.6 - d * 0.6, 1.9 + d * 0.1, 9.4 - d * 0.7] as V3, look: [0.1, 1.35, 0] as V3 };
    case 3: return { eye: [0.4 + d * 0.9, 2.6, 11.6 - d * 0.9] as V3, look: [1.2, 1.5, 1.2] as V3 };
    default: return { eye: [1.0 - d * 0.5, 2.4, 12.4 - d * 0.7] as V3, look: [0.5, 1.35, 3.6] as V3 };
  }
};

const useCam = (frame: number, cuts: number[]) => {
  let i = 0;
  for (let k = 1; k < cuts.length; k++) if (frame >= cuts[k]) i = k;
  // continuous camera in the lab (beats 0,1,2) and in the room (3,4): blend over 24 frames
  const BL = 24;
  if (i > 0 && i !== 3 && frame < cuts[i] + BL) {
    const t = easeInOut((frame - cuts[i]) / BL);
    const a = beatCam(frame, cuts, i - 1), b = beatCam(frame, cuts, i);
    return { eye: lerp3(a.eye, b.eye, t), look: lerp3(a.look, b.look, t) };
  }
  return beatCam(frame, cuts, i);
};

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
  void debug; void durationSec;
  return (
    <AbsoluteFill style={{ backgroundColor: "#FBE7C6" }}>
      <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 40, near: 0.1, far: 900, position: [0, 3, 10] }}>
        <Cam cuts={cuts} />
        <SkyDome top="#7FA8C9" horizon="#FBE7C6" />
        <fog attach="fog" args={["#F6E2C0", 45, 140]} />
        <hemisphereLight args={["#D6ECF6", "#EBCB9C", 1.7]} />
        <directionalLight position={[-3, 8, -10]} intensity={1.0} color="#D8E8FF" />
        <directionalLight position={[7, 12, 8]} intensity={2.7} color="#FFE7C0" castShadow shadow-mapSize={[1024, 1024]} />
        <TendonWorld f={frame} cuts={cuts} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
