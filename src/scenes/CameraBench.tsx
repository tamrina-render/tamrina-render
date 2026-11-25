import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, restPose } from "./fact3d/Blocky";
import { Bench, Dumbbell, DumbbellRack, OliveTree, Pedestal, SkyDome, Column } from "./fact3d/props";
import { PAL, Part, box, circle } from "./fact3d/parts";
import { clamp, seg } from "./fact3d/anim";
import { RackFocus, Shot, ShotRig, birdsEye, dollyZoom, orbit, rackFocusDist, whipBlur, whipPan } from "./fact3d/cameraMoves";

// Bench for the five camera moves in fact3d/cameraMoves.ts: 5 segments x 3 s, one set, one hero.
const SEG = 90;
const NAMES = ["DOLLY ZOOM", "ORBIT", "RACK FOCUS", "WHIP PAN", "BIRD'S EYE"];
const HERO: V3 = [0, 0, 0];
type V3 = [number, number, number];
const HERO_COLORS: BlockyColors = { skin: "#E0A47A", shirt: PAL.terracotta, pants: PAL.teal, shoes: PAL.cream, hair: "#4A2E22", face: PAL.ink };

const NEAR_RACK: V3 = [1.4, 0, 4.6]; // rack-focus foreground (only while segment 3 is on)
const WHIP_AT: V3 = [7, 0, 3.5]; // the whip-pan destination

const shotAt = (f: number): Shot => {
  const k = Math.min(4, Math.floor(f / SEG));
  const t = clamp((f - k * SEG) / (SEG - 1));
  if (k === 0) return dollyZoom(t, { target: HERO, dir: [0.15, 0.1, 1], width: 5.6, fovFrom: 24, fovTo: 78, height: 1.2 });
  if (k === 1) return orbit(t, { target: [0, 1.1, 0], radius: 6, height: 1.9, fromDeg: -60, toDeg: 120, fov: 38 });
  if (k === 2) return { p: [2.6, 1.5, 8.5], l: [0, 1.1, 0], fov: 38 };
  if (k === 3) return whipPan(t, { from: { p: [0, 1.5, 6.5], l: [0, 1.1, 0], fov: 40 }, to: { p: [0, 1.5, 6.5], l: [WHIP_AT[0], 1.9, WHIP_AT[2]], fov: 40 }, turn: 0.2 });
  return birdsEye(t, { target: [0, 0, -10], height: 55, fov: 50, spinDeg: 35, from: { p: [0, 1.9, 7], l: [0, 1.1, 0], fov: 40 }, blend: 0.6 });
};

const Lights: React.FC = () => (
  <>
    <hemisphereLight args={["#D6ECF6", "#EBCB9C", 1.75]} />
    <directionalLight position={[8, 4, 6]} intensity={0.35} color="#9DBFE0" />
    <directionalLight position={[-3, 7, -12]} intensity={1.1} color="#D8E8FF" />
    <directionalLight
      position={[-7, 11, 8]}
      intensity={3.0}
      color="#FFE6C4"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-14}
      shadow-camera-right={14}
      shadow-camera-top={14}
      shadow-camera-bottom={-14}
      shadow-camera-near={1}
      shadow-camera-far={60}
      shadow-bias={-0.0005}
      shadow-normalBias={0.02}
    />
  </>
);

const SetPieces: React.FC<{ f: number; seg: number }> = ({ f, seg: k }) => (
  <>
    <Part geo={circle(220, 64)} color={PAL.sand} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -40]} />
    {/* the road strip with dashes (parallax cues) */}
    <Part geo={box(3.4, 0.04, 140)} color={PAL.sandDark} position={[0, 0.01, -50]} />
    {[...Array(26)].map((_, i) => (
      <Part key={i} geo={box(0.14, 0.05, 1.2)} color={PAL.cream} position={[0, 0.03, 8 - i * 3.4]} shadow={false} />
    ))}
    {/* two rows of columns down the road */}
    {[...Array(9)].map((_, i) => (
      <React.Fragment key={i}>
        <Column position={[-9, 0, -4 - i * 5.5]} h={4.2} />
        <Column position={[9, 0, -4 - i * 5.5]} h={4.2} />
      </React.Fragment>
    ))}
    <OliveTree position={[-7.5, 0, -3]} s={1.2} seed={3} frame={f} />
    <OliveTree position={[7.6, 0, -9]} s={1.3} seed={5} frame={f} />
    <OliveTree position={[-5.5, 0, -14]} s={1.2} seed={9} frame={f} />
    <OliveTree position={[5, 0, -21]} s={1.4} seed={12} frame={f} />
    <OliveTree position={[-6, 0, -28]} s={1.3} seed={15} frame={f} />
    <OliveTree position={[-8.5, 0, 6]} s={1.1} seed={21} frame={f} />
    <Bench position={[-4.8, 0, -6.5]} rotationY={0.5} />
    <DumbbellRack position={[4.6, 0, -7]} rotationY={-0.35} />
    <DumbbellRack position={[-3.2, 0, -17]} rotationY={0.2} />
    <Bench position={[3.5, 0, -24]} rotationY={-0.4} />
    {/* the hero: Mr. standing on the road with a dumbbell */}
    <Blocky pose={{ ...restPose(), bob: Math.sin(f * 0.12) * 0.015 }} colors={HERO_COLORS} position={HERO} rightHand={<Dumbbell s={1.5} rotation={[0, 0, Math.PI / 2]} />} />
    {/* rack focus: a foreground rack right on the camera line, only in its own segment */}
    {k === 2 && <DumbbellRack position={NEAR_RACK} rotationY={0.15} />}
    {/* whip pan: the thing it lands on */}
    <Pedestal position={WHIP_AT} />
    <Dumbbell s={3} color={PAL.mustard} position={[WHIP_AT[0], 1.1 + 0.4, WHIP_AT[2]]} />
  </>
);

const LABEL_FONT = '"Manrope", "Helvetica Neue", Arial, sans-serif';

export const CameraBench: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const k = Math.min(4, Math.floor(frame / SEG));
  const t = clamp((frame - k * SEG) / (SEG - 1));
  const shot = shotAt(frame);
  const blur = k === 3 ? whipBlur(t, 0.5, 0.2) * 3 : 0;
  const labelIn = seg(frame, k * SEG, k * SEG + 8);
  return (
    <AbsoluteFill style={{ backgroundColor: PAL.skyHorizon }}>
      <AbsoluteFill style={{ filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
        <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 40, near: 0.1, far: 1000, position: [0, 2, 8] }} gl={{ antialias: true }}>
          <ShotRig shot={shot} />
          <SkyDome />
          <fog attach="fog" args={["#F6E2C0", 60, 200]} />
          <Lights />
          <SetPieces f={frame} seg={k} />
          {k === 2 && <RackFocus focus={rackFocusDist(t, 4.3, 8.9)} aperture={0.005} maxblur={0.025} />}
        </ThreeCanvas>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute", top: 110, left: 0, right: 0, textAlign: "center", fontFamily: LABEL_FONT, fontWeight: 800, fontSize: 64,
          letterSpacing: 4, color: PAL.ink, opacity: labelIn, transform: `translateY(${(1 - labelIn) * -20}px)`, textShadow: "0 2px 0 rgba(255,246,230,0.8)",
        }}
      >
        {NAMES[k]}
      </div>
    </AbsoluteFill>
  );
};
