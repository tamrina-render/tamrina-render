import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Blocky, BlockyColors, BlockyPose, restPose } from "./fact3d/Blocky";
import { Cloud, OliveTree, SkyDome } from "./fact3d/props";
import { PAL, Part, box, circle, cyl, rbox, sphere, torusArc } from "./fact3d/parts";
import { clamp, easeInOut, easeOut, hash, lerp, seg, wobble } from "./fact3d/anim";
import { alive, proudPose, runnerPose, walkPose, wavePose, tremble, shyPose, lerpPose } from "./fact3d/acting";

// Shizo Kanakuri, Stockholm 1912: dizzy in the marathon -> garden juice + nap -> ship home ->
// "missing" for 54 years -> crosses the line in 1967. 4 clause starts drive every cut.

export type FactKanakuriProps = {
  starts?: number[]; // 4 clause starts (s): race+nap, ship, missing/1967, celebration
  durationSec?: number;
  debug?: boolean;
};

const DEFAULT_STARTS = [0, 3.9, 7.0, 13.01, 16.55];
const DEFAULT_DURATION = 36;

type V3 = [number, number, number];

const HERO: BlockyColors = { skin: "#E8B088", shirt: "#F4F2EC", pants: "#2E4A66", shoes: "#E8E4DA", hair: "#1E1A18", face: PAL.ink };
const HERO_OLD: BlockyColors = { ...HERO, hair: "#C9CDD4" };
const SWEDE: BlockyColors = { skin: "#EFC49A", shirt: "#7FA8C9", pants: "#5A4A3A", shoes: "#E8E4DA", hair: "#D9B36A", face: PAL.ink };
const SWEDE2: BlockyColors = { skin: "#EFC49A", shirt: "#C9768A", pants: "#4A5A6A", shoes: "#E8E4DA", hair: "#8A5A30", face: PAL.ink };
const RACER1: BlockyColors = { skin: "#9A6444", shirt: PAL.terracotta, pants: "#3F4A5A", shoes: "#FFF", hair: "#2C211D", face: PAL.ink };
const RACER2: BlockyColors = { skin: "#E0A47A", shirt: PAL.teal, pants: "#333B48", shoes: "#FFF", hair: "#4A2E22", face: PAL.ink };
const OFFICIAL: BlockyColors = { skin: "#E0A47A", shirt: "#3A3F4A", pants: "#2A2E36", shoes: "#222", hair: "#3A2E22", face: PAL.ink };

const Z = { road: 0, garden: -38, sea: -78, stadium: -122 };

// ---------- heat-dizzy stagger (clause 1) ----------
const dizzyPose = (f: number): BlockyPose => {
  const p = walkPose(f * 0.11, 0.55);
  p.lean = 0.2 + Math.sin(f * 0.06) * 0.06;
  p.roll = Math.sin(f * 0.09) * 0.16;
  p.headPitch = 0.05;
  p.headTilt = Math.sin(f * 0.07) * 0.14;
  p.eyeOpen = 0.55;
  p.brow = 0.8;
  p.mouth = "wavy";
  p.armL = { sx: -0.4, sz: 0.5, twist: 0, elbow: -1.1 };
  p.armR = { sx: -0.5, sz: 0.45, twist: 0, elbow: -1.2 };
  return tremble(p, f, 3, 0.6);
};

// ---------- drinking juice ----------
const drinkPose = (f: number, sipAt: number): BlockyPose => {
  const p = restPose();
  const k = seg(f, sipAt - 8, sipAt, easeOut) * (1 - seg(f, sipAt + 26, sipAt + 40));
  p.armR = { sx: lerp(-0.2, -2.5, k), sz: 0.25, twist: 0, elbow: lerp(-0.3, -2.2, k) };
  p.armL = { sx: -0.15, sz: 0.5, twist: 0, elbow: -0.9 };
  p.headPitch = lerp(0.05, -0.28, k);
  p.mouth = k > 0.7 ? "o" : "smile";
  p.mouthOpen = k > 0.7 ? 0.4 : 0;
  p.brow = 0.4 * k;
  return alive(p, f, 11, 0.7);
};

// ---------- asleep on the sofa: breathing ----------
const sleepPose = (f: number, lieAt: number): BlockyPose => {
  const p = restPose();
  const br = Math.sin(f * 0.09) * 0.5 + 0.5;
  p.squash = 1 + br * 0.03;
  p.eyeOpen = 0;
  p.mouth = "o";
  p.mouthOpen = 0.12 + br * 0.1;
  p.armL = { sx: -0.3, sz: 0.2, twist: 0, elbow: -1.9 };
  p.armR = { sx: -0.3, sz: 0.2, twist: 0, elbow: -1.9 };
  p.legL = { hip: 0.15, sz: 0.05, knee: 0.25 };
  p.legR = { hip: 0.1, sz: 0.05, knee: 0.2 };
  p.lean = -0.05;
  return p;
};

// ---------- old-man trot (1967) ----------
const oldTrot = (f: number): BlockyPose => {
  const p = runnerPose(f * 0.16, 0.42);
  p.lean = 0.16;
  p.headPitch = 0.02;
  p.brow = 0.5;
  p.mouth = "smile";
  return p;
};

// ---------- props ----------
const House: React.FC<{ position?: V3 }> = ({ position }) => (
  <group position={position}>
    <Part geo={rbox(6.4, 4.2, 5, 0.15)} color="#E8D5B5" position={[0, 2.1, 0]} />
    <group position={[0, 4.9, 0]} rotation={[0, 0, 0]}>
      <Part geo={cyl(0.01, 4.6, 5.4, 4)} color={PAL.terraDark} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.78]} />
    </group>
    <Part geo={rbox(1.3, 2.4, 0.2, 0.06)} color={PAL.wood} position={[0.4, 1.2, 2.55]} />
    <Part geo={rbox(1.2, 1.1, 0.15, 0.05)} color="#BFE3F0" position={[-1.8, 2.4, 2.53]} />
    <Part geo={rbox(1.2, 1.1, 0.15, 0.05)} color="#BFE3F0" position={[2.1, 2.4, -2.53]} />
    <Part geo={cyl(0.5, 0.6, 0.5, 10)} color={PAL.terracotta} position={[2.3, 0.25, 2.9]} />
  </group>
);

const Sofa: React.FC<{ position?: V3; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <Part geo={rbox(3.4, 0.55, 1.3, 0.12)} color={PAL.teal} position={[0, 0.62, 0]} />
    <Part geo={rbox(3.4, 1.1, 0.4, 0.12)} color={PAL.tealDark} position={[0, 1.25, -0.55]} />
    <Part geo={rbox(0.45, 0.95, 1.3, 0.12)} color={PAL.tealDark} position={[-1.6, 0.95, 0]} />
    <Part geo={rbox(0.45, 0.95, 1.3, 0.12)} color={PAL.tealDark} position={[1.6, 0.95, 0]} />
    {[-1.4, 1.4].map((x) => (
      <Part key={x} geo={cyl(0.07, 0.07, 0.4, 8)} color={PAL.wood} position={[x, 0.2, 0.45]} />
    ))}
  </group>
);

const scratchPose = (lf: number): BlockyPose => {
  const p = shyPose();
  const w = Math.sin(lf * 0.5);
  p.armL = { sx: -2.5, sz: 0.5, twist: 0, elbow: -2.3 + w * 0.25 };
  p.armR = { sx: -0.15, sz: 0.3, twist: 0, elbow: -0.5 };
  p.shrug = 0.5; p.hunch = 0.2; p.blush = 1; p.headTilt = 0.15;
  return p;
};
const tiptoePose = (lf: number): BlockyPose => {
  const p = walkPose(lf * 0.12, 0.35);
  p.lean = 0.22; p.bob = -0.04;
  p.armL = { sx: -0.3, sz: 0.5, twist: 0, elbow: -0.7 };
  p.armR = { sx: 0.4, sz: 0.5, twist: 0, elbow: -0.7 };
  p.eyeX = Math.sin(lf * 0.1); p.brow = 0.5; p.mouth = "grin";
  return p;
};
const shhPose = (lf: number): BlockyPose => {
  const p = restPose();
  p.armR = { sx: -2.3, sz: 0.2, twist: 0, elbow: -2.35 };
  p.armL = { sx: -0.1, sz: 0.4, twist: 0, elbow: -0.5 };
  p.eyeX = 0.8 * Math.sin(lf * 0.12); p.brow = 0.4; p.browUp = 0.5; p.mouth = "flat"; p.headTilt = 0.1;
  return p;
};
// ship beat poses change every ~1.5-2s: wave, scratch (shy), tiptoe, shh, wave
const shipPose = (lf: number): BlockyPose => {
  const segs: [number, (l: number) => BlockyPose][] = [
    [0, (l) => wavePose(l, 5)],
    [40, scratchPose],
    [95, tiptoePose],
    [150, shhPose],
    [215, (l) => wavePose(l, 3)],
  ];
  let i = 0;
  for (let k = 1; k < segs.length; k++) if (lf >= segs[k][0]) i = k;
  const cur = segs[i][1](lf);
  if (i > 0) {
    const k = seg(lf, segs[i][0], segs[i][0] + 10);
    if (k < 1) return lerpPose(segs[i - 1][1](lf), cur, k);
  }
  return cur;
};

export const shipPos = (f: number, startF: number) => {
  const t = clamp((f - startF) / 190);
  return { x: lerp(-3.5, 8, easeInOut(t)), z: lerp(-3, -14, t), s: lerp(1.45, 1.15, t) };
};
const Ship: React.FC<{ f: number; startF: number }> = ({ f, startF }) => {
  const { x, z, s } = shipPos(f, startF);
  const bob = Math.sin(f * 0.09) * 0.12;
  const roll = Math.sin(f * 0.07) * 0.03;
  return (
    <group position={[x, 0.15 + bob, Z.sea + z]} rotation={[0, 0.5, roll]} scale={s}>
      {/* hull */}
      <Part geo={rbox(7.6, 1.5, 2.4, 0.3)} color="#3A4A5C" position={[0, 0.75, 0]} />
      <Part geo={rbox(6.6, 0.5, 2.0, 0.2)} color="#F2EFE6" position={[0, 1.7, 0]} />
      <Part geo={rbox(3.4, 0.9, 1.6, 0.15)} color="#F2EFE6" position={[-0.4, 2.35, 0]} />
      {/* funnel + smoke */}
      <Part geo={cyl(0.42, 0.5, 1.3, 12)} color={PAL.terracotta} position={[-0.4, 3.4, 0]} />
      {[0, 1, 2].map((i) => {
        const age = (f + i * 22) % 66;
        return <Part key={i} geo={sphere(0.4 + age * 0.014, 10)} color="#EDE8DF" basic opacity={clamp(0.75 - age * 0.011)} position={[-0.4 + age * 0.03, 4.2 + age * 0.05, 0]} shadow={false} />;
      })}
      {/* hero at the stern rail, waving goodbye */}
      <group position={[-3.1, 1.55 + Math.abs(Math.sin(f * 0.11)) * 0.06, 0.55]} rotation={[0, 0, Math.sin(f * 0.07) * 0.05]}>
        <Blocky pose={alive(shipPose(f - startF), f, 77, 0.8)} colors={HERO} scale={0.78} headband="#D9473B" rotationY={0.4 + Math.sin(f * 0.045) * 0.3} />
      </group>
    </group>
  );
};

const MissingBoard: React.FC<{ position?: V3; f: number; stampK: number }> = ({ position, f, stampK }) => (
  <group position={position}>
    <Part geo={rbox(3.6, 2.6, 0.18, 0.05)} color={PAL.wood} position={[0, 1.9, 0]} />
    {[-1.05, 0, 1.05].map((x, i) => (
      <group key={x} position={[x, 1.95 + (i === 1 ? 0.12 : 0), 0.12]} rotation={[0, 0, (i - 1) * 0.06]}>
        <Part geo={box(0.85, 1.15, 0.02)} color="#F6F1E4" />
        <Part geo={circle(0.17, 14)} color="#8A94A0" basic position={[0, 0.22, 0.015]} shadow={false} />
        <Part geo={rbox(0.5, 0.14, 0.01, 0.03)} color="#8A94A0" basic position={[0, -0.02, 0.015]} shadow={false} />
        <Part geo={rbox(0.55, 0.07, 0.01, 0.02)} color="#B9BFC7" basic position={[0, -0.28, 0.015]} shadow={false} />
        <Part geo={rbox(0.4, 0.07, 0.01, 0.02)} color="#B9BFC7" basic position={[0, -0.4, 0.015]} shadow={false} />
      </group>
    ))}
    {/* red question stamp slams on the middle poster */}
    <group position={[0, 2.07, 0.2]} rotation={[0, 0, -0.18 + wobble(f, 60, 0.06, 0.5, 4)]} scale={stampK}>
      <Part geo={torusArc(0.3, 0.05, Math.PI * 2)} color="#D9473B" basic shadow={false} />
      <Part geo={rbox(0.09, 0.34, 0.02, 0.02)} color="#D9473B" basic shadow={false} />
      <Part geo={sphere(0.055, 8)} color="#D9473B" basic position={[0, -0.27, 0]} shadow={false} />
    </group>
    {[-1.5, 1.5].map((x) => (
      <Part key={x} geo={cyl(0.09, 0.11, 1.6, 8)} color={PAL.wood} position={[x, 0.4, -0.05]} />
    ))}
  </group>
);

const FinishBanner: React.FC<{ position?: V3; f: number; crossF: number }> = ({ position, f, crossF }) => {
  const flap = Math.sin(f * 0.12) * 0.03;
  const lift = f >= crossF ? seg(f, crossF, crossF + 14, easeOut) : 0;
  return (
    <group position={position}>
      {[-2.6, 2.6].map((x) => (
        <Part key={x} geo={cyl(0.09, 0.12, 4.6, 10)} color={PAL.steel} position={[x, 2.3, 0]} />
      ))}
      <group rotation={[flap, 0, 0]} position={[0, 0, 0]}>
        <Part geo={box(5.6, 0.85, 0.05)} color="#F4F2EC" position={[0, 4.15, 0]} />
        {[-2.2, -1.1, 0, 1.1, 2.2].map((x, i) => (
          <Part key={x} geo={box(0.55, 0.85, 0.06)} color={i % 2 ? "#D9473B" : "#F4F2EC"} basic position={[x + 0.28, 4.15, 0.005]} shadow={false} />
        ))}
      </group>
      {/* breakable tape lifts as he crosses */}
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
      const y = 5.2 - age * 0.055 + hash(i) * 1.2;
      if (y < 0.1) return null;
      const z = (hash(i * 5.3) - 0.5) * 4;
      const c = ["#D9473B", "#F5D76E", PAL.teal, "#F4F2EC"][i % 4];
      return <Part key={i} geo={box(0.12, 0.05, 0.16)} color={c} basic position={[x, y, z]} rotation={[age * 0.1 + i, i * 0.7, age * 0.07]} shadow={false} />;
    })}
  </>
);

// ---------- the worlds ----------
const RoadWorld: React.FC<{ f: number; hideF: number }> = ({ f, hideF }) => {
  // hero staggers toward the garden side (+x); two racers keep running off-frame
  const heroX = -1.1 + seg(f, 0, 70, easeInOut) * 3.0;
  return (
    <group position={[0, 0, Z.road]}>
      <Part geo={rbox(34, 0.16, 5.2, 0.05)} color="#D9B57E" position={[4, 0.02, 0]} />
      {[-6, 0, 6].map((x) => (
        <Part key={x} geo={box(1.6, 0.02, 0.18)} color="#F6E7CF" basic position={[x, 0.11, 0]} shadow={false} />
      ))}
      <Blocky pose={runnerPose(f * 0.32, 1)} colors={RACER1} position={[-7 + ((f * 0.055) % 26), 0.16, -1.1]} rotationY={Math.PI / 2} scale={0.95} />
      <Blocky pose={runnerPose(f * 0.3 + 2, 1)} colors={RACER2} position={[-11 + ((f * 0.05 + 6) % 26), 0.16, 1.2]} rotationY={Math.PI / 2} scale={0.95} />
      {f < hideF && (
        <group position={[heroX, 0.16, 0.4]} rotation={[0, 0.5, 0]}>
          <Blocky pose={dizzyPose(f)} colors={HERO} headband="#D9473B" scale={1.15} />
        </group>
      )}
      {/* sweat drops */}
      {[0, 1].map((i) => {
        const age = (f + i * 14) % 28;
        return <Part key={i} geo={sphere(0.06, 6)} color="#BFE3F0" basic opacity={clamp(0.9 - age * 0.05)} position={[heroX + 0.3, 1.9 - age * 0.03, 0.75]} shadow={false} />;
      })}
      {/* heat waves over the road */}
      {[0, 1, 2].map((i) => (
        <Part key={i} geo={torusArc(0.5 + i * 0.1, 0.03, Math.PI)} color="#FFFFFF" basic opacity={0.16} position={[2 + i * 2.4, 0.6 + Math.sin(f * 0.1 + i) * 0.12, -1.8]} rotation={[0.2, 0, 0]} shadow={false} />
      ))}
      {/* big brutal sun */}
      <Part geo={sphere(4.5, 24)} color="#FFE9B0" basic position={[-20, 17, -26]} shadow={false} />
      <Part geo={sphere(6.4, 24)} color="#FFDF9E" basic opacity={0.35} position={[-20, 17, -27]} shadow={false} />
    </group>
  );
};

const GardenWorld: React.FC<{ f: number; sipF: number; lieF: number; enterF: number }> = ({ f, sipF, lieF, enterF }) => {
  const lying = f >= lieF;
  return (
    <group position={[0, 0, Z.garden]}>
      <Part geo={circle(16, 40)} color="#9DBE7A" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} />
      <House position={[-4.5, 0, -4]} />
      <OliveTree position={[4.6, 0, -2]} s={1.5} seed={21} frame={f} />
      <OliveTree position={[-8.5, 0, -1]} s={1.2} seed={22} frame={f} />
      <Sofa position={[2.2, 0, 1.6]} rotationY={-0.5} />
      {lying ? (
        <group position={[2.2, 0, 1.6]} rotation={[0, -0.5, 0]}>
          {/* on his side along the seat, head at the left arm, face to the camera */}
          <group position={[1.0, 1.42, 0.5]} rotation={[0, 0, Math.PI / 2]}>
            <Blocky pose={sleepPose(f, lieF)} colors={HERO} headband="#D9473B" scale={0.92} noBlob />
          </group>
        </group>
      ) : (
        <group position={[0.4 + seg(f, enterF, sipF - 14, easeInOut) * 1.6, 0.02, 2.6 - seg(f, enterF, sipF - 14, easeInOut) * 0.7]} rotation={[0, -1.4, 0]}>
          <Blocky pose={f < sipF - 14 ? walkPose(f * 0.16, 0.8) : drinkPose(f, sipF)} colors={HERO} headband="#D9473B" />
          {f >= sipF - 14 && (
            <group position={[0.32, 1.55 + seg(f, sipAt(sipF) - 8, sipF) * 0.28, 0.42]}>
              <Part geo={cyl(0.09, 0.07, 0.22, 10)} color="#F5B82E" />
            </group>
          )}
        </group>
      )}
      {/* Z z z */}
      {lying &&
        [0, 1, 2].map((i) => {
          const age = (f + i * 16) % 48;
          return (
            <group key={i} position={[1.6 + age * 0.012, 3.0 + age * 0.028, 2.2]} rotation={[0, -0.4, 0.2]} scale={0.4 + age * 0.008} >
              <Part geo={rbox(0.3, 0.07, 0.04, 0.02)} color="#8FB6D9" basic shadow={false} opacity={clamp(0.9 - age * 0.02)} />
              <Part geo={rbox(0.3, 0.07, 0.04, 0.02)} color="#8FB6D9" basic shadow={false} opacity={clamp(0.9 - age * 0.02)} rotation={[0, 0, -0.8]} />
              <Part geo={rbox(0.3, 0.07, 0.04, 0.02)} color="#8FB6D9" basic shadow={false} opacity={clamp(0.9 - age * 0.02)} />
            </group>
          );
        })}
      {/* the Swedish hosts, watching worried */}
      <Blocky pose={alive({ ...restPose(), brow: 0.9, mouth: "o", mouthOpen: 0.25, armL: { sx: -0.3, sz: 0.7, twist: 0, elbow: -1.4 }, headTilt: 0.12 }, f, 31)} colors={SWEDE} position={[-1.6, 0.02, 0.4]} rotationY={2.3} scale={0.97} />
      <Blocky pose={alive({ ...restPose(), brow: 0.9, eyeX: 0.5, armR: { sx: -0.9, sz: 0.6, twist: 0, elbow: -1.8 }, mouth: "wavy" }, f, 37)} colors={SWEDE2} position={[-2.8, 0.02, 1.7]} rotationY={2.0} scale={0.92} skirt={PAL.terraDark} />
    </group>
  );
};

const sipAt = (sipF: number) => sipF;

const SeaWorld: React.FC<{ f: number; startF: number }> = ({ f, startF }) => (
  <group position={[0, 0, 0]}>
    <Part geo={circle(150, 48)} color="#5FA8C9" rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, Z.sea - 16]} />
    {[0, 1, 2, 3].map((i) => (
      <Part key={i} geo={torusArc(6 + i * 2.2, 0.12, Math.PI * 0.7)} color="#DFF0F8" basic opacity={0.35} position={[-18 + i * 11, 0.06, Z.sea - 6 - i * 7]} rotation={[-Math.PI / 2 + 0.06, 0, hash(i) * 2]} shadow={false} />
    ))}
    <Ship f={f} startF={startF} />
    <Cloud position={[-14 + f * 0.015, 13, Z.sea - 30]} s={2.2} seed={41} />
    <Cloud position={[10 + f * 0.02, 16, Z.sea - 40]} s={2.8} seed={42} />
    {/* gulls */}
    {[0, 1, 2].map((i) => (
      <group key={i} position={[-12 + i * 7 + Math.sin(f * 0.05 + i) * 1.5, 9 + Math.sin(f * 0.08 + i * 2) * 0.6, Z.sea - 18 - i * 4]} rotation={[0, 0.6, 0]}>
        <Part geo={torusArc(0.4, 0.045, Math.PI * 0.85)} color="#FFFFFF" basic rotation={[0, 0, 0.2 + Math.sin(f * 0.3 + i) * 0.25]} shadow={false} />
        <Part geo={torusArc(0.4, 0.045, Math.PI * 0.85)} color="#FFFFFF" basic rotation={[0, Math.PI, -0.2 - Math.sin(f * 0.3 + i) * 0.25]} shadow={false} />
      </group>
    ))}
  </group>
);

const celebratePose = (f: number, t0: number): BlockyPose => {
  const k = f - t0;
  const p = restPose();
  const cyc = Math.floor(k / 60) % 3; // 0 both arms up, 1 wave to the crowd, 2 fist pumps
  const w = Math.sin(k * 0.35);
  if (cyc === 0) {
    p.armL = { sx: -2.8 + w * 0.15, sz: 0.5, twist: 0, elbow: -0.2 };
    p.armR = { sx: -2.8 - w * 0.15, sz: -0.5, twist: 0, elbow: -0.2 };
  } else if (cyc === 1) {
    p.armR = { sx: -2.6, sz: -0.3 + w * 0.5, twist: 0, elbow: -0.4 };
    p.armL = { sx: -0.3, sz: 0.4, twist: 0, elbow: -0.9 };
  } else {
    p.armL = { sx: -2.0 + Math.abs(w) * 0.8, sz: 0.4, twist: 0, elbow: -1.6 };
    p.armR = { sx: -2.0 + Math.abs(Math.sin(k * 0.35 + 1.5)) * 0.8, sz: -0.4, twist: 0, elbow: -1.6 };
  }
  p.mouth = "smile";
  p.brow = -0.15;
  p.eyeOpen = 0.8;
  p.eyeWide = 0.9;
  p.legL = { hip: -Math.abs(Math.sin(k * 0.18)) * 0.5, sz: 0.05, knee: Math.abs(Math.sin(k * 0.18)) * 0.8 };
  p.legR = { hip: -Math.abs(Math.sin(k * 0.18)) * 0.5, sz: 0.05, knee: Math.abs(Math.sin(k * 0.18)) * 0.8 };
  return alive(p, f, 51, 0.5);
};

const standWorry = (f: number): BlockyPose => {
  const p = restPose();
  p.armL = { sx: -0.3, sz: 0.6, twist: 0, elbow: -1.2 };
  p.armR = { sx: -0.2, sz: -0.5, twist: 0, elbow: -1.0 };
  p.headPitch = -0.1;
  p.brow = 0.8;
  p.mouth = "wavy";
  p.eyeOpen = 1;
  p.headTilt = Math.sin(f * 0.05) * 0.1;
  return alive(p, f, 52, 0.8);
};

const StadiumWorld: React.FC<{ f: number; crossF: number; startF: number; runF: number }> = ({ f, crossF, startF, runF }) => {
  // the old man waits by the missing board, then trots to the tape, breaks it and celebrates for the rest of the reel
  const runT = seg(f, runF + 4, crossF, easeInOut);
  const afterX = f > crossF ? seg(f, crossF, crossF + 30, easeOut) * 1.4 : 0;
  const waitK = f >= startF && f < runF + 4 ? 1 - seg(f, runF - 26, runF + 4) : 0;
  const paceX = (Math.sin((f - startF) * 0.05) + 1) * 0.3 * waitK;
  const heroX = lerp(-4.4, 0.6, runT) + afterX + paceX;
  const running = f >= runF + 4 && f < crossF + 6;
  const celebrating = f >= crossF + 6;
  const hop = celebrating ? Math.abs(Math.sin((f - crossF) * 0.18)) * 0.35 : 0;
  const waitPose = (() => {
    const p = standWorry(f);
    const w = walkPose(f * 0.13, 0.4);
    p.legL = w.legL;
    p.legR = w.legR;
    return p;
  })();
  const pose = celebrating ? celebratePose(f, crossF + 6) : running ? oldTrot(f) : waitPose;
  const faceYaw = celebrating ? 0.35 + Math.sin((f - crossF) * 0.03) * 0.25 : f < runF + 4 ? 0.9 + Math.cos((f - startF) * 0.05) * 0.4 * waitK : Math.PI / 2 - 0.85;
  return (
    <group position={[0, 0, Z.stadium]}>
      <Part geo={circle(60, 48)} color="#C98F57" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} />
      <Part geo={rbox(22, 0.1, 4.6, 0.04)} color="#D99A6C" position={[0, 0.04, 0]} />
      {[-2, 0, 2].map((x) => (
        <Part key={x} geo={box(9, 0.02, 0.14)} color="#F6E7CF" basic position={[x * 2.4, 0.1, 0]} shadow={false} />
      ))}
      <group position={[0, 0, -7]}>
        {[0, 1].map((r) => (
          <Part key={r} geo={rbox(16, 0.7, 1.2, 0.08)} color="#B9BFC7" position={[0, 0.5 + r * 0.85, -r * 1.1]} />
        ))}
        {[...Array(10)].map((_, i) => {
          const r = i % 2;
          const x = -7 + (i % 5) * 3.5 + r * 1.6;
          const tones = ["#C9768A", "#7FA8C9", PAL.mustard, PAL.teal, PAL.terracotta];
          const col: BlockyColors = { skin: ["#E0A47A", "#9A6444", "#EFC49A"][i % 3], shirt: tones[i % 5], pants: "#3F4A5A", shoes: "#EEE", hair: ["#2C211D", "#4A2E22", "#8A5A30"][i % 3], face: PAL.ink };
          return <Blocky key={i} pose={celebrating ? wavePose(f, i * 7) : alive(restPose(), f, i * 3, 0.6)} colors={col} position={[x, 0.9 + r * 0.85, -6.9 - r * 1.1]} rotationY={0} scale={0.62} />;
        })}
      </group>
      <FinishBanner position={[0.9, 0, 0]} f={f} crossF={crossF} />
      <Blocky pose={alive({ ...restPose(), armR: { sx: -1.9, sz: 0.2, twist: 0, elbow: -0.5 }, headPitch: 0.35, eyeY: 0.6, brow: celebrating ? 1 : 0, eyeWide: celebrating ? 1.35 : 1, mouth: celebrating ? "o" : "flat", mouthOpen: celebrating ? 0.5 : 0 }, f, 61)} colors={OFFICIAL} position={[6.2, 0.06, -0.6]} rotationY={-2.5} />
      <Blocky pose={alive({ ...restPose(), armL: { sx: -0.5, sz: 0.8, twist: 0, elbow: -1.2 }, mouth: "o", mouthOpen: celebrating ? 0.4 : 0.15, brow: 0.8 }, f, 67)} colors={{ ...OFFICIAL, shirt: "#5A4A3A" }} position={[7.4, 0.06, -1.2]} rotationY={-2.9} scale={0.95} />
      <group position={[heroX, 0.1 + hop, 0.2]} rotation={[0, faceYaw, 0]}>
        <Blocky pose={pose} colors={HERO_OLD} headband="#D9473B" scale={0.98} />
      </group>
      {celebrating && <Confetti f={f} startF={crossF + 4} />}
      <MissingBoard position={[-6.6, 0, 1.0]} f={f} stampK={seg(f, startF + 14, startF + 28, easeOut)} />
    </group>
  );
};

// ---------- camera ----------
const CameraRig: React.FC<{ frame: number; cuts: number[] }> = ({ frame, cuts }) => {
  const { camera } = { camera: null as unknown as THREE.Camera };
  void camera;
  return null;
};
void CameraRig;

const beatCam = (frame: number, cuts: number[], fps: number, i: number) => {
  // beat 0 = the race, 1 = the garden nap, 2 = the ship, 3 = the missing board (hero beside it), 4 = the finish + long celebration
  const local = frame - cuts[i];
  const next = cuts[i + 1] ?? cuts[i] + 400;
  const drift = clamp(local / Math.max(1, next - cuts[i]));
  if (i === 0) {
    const hx = -1.1 + seg(frame, 0, 70, easeInOut) * 3.0;
    return { eye: [hx * 0.8 + 0.1 + drift * 0.3, 2.9, 12.4 - drift * 0.8] as V3, look: [hx * 0.8 + 0.5, 1.2, Z.road] as V3 };
  }
  if (i === 1) return { eye: [1.2 + drift * 0.6, 2.9, Z.garden + 10.6 - drift * 0.8] as V3, look: [1.8, 1.7, Z.garden + 1.6] as V3 };
  if (i === 2) {
    const sp = shipPos(frame, cuts[2]);
    // look at the stern rail where he waves: ship rotated 0.5 about y
    const lx = -3.1 * Math.cos(0.5) + 0.55 * Math.sin(0.5), lz = 3.1 * Math.sin(0.5) + 0.55 * Math.cos(0.5);
    const look: V3 = [sp.x + lx * sp.s, 3.0, Z.sea + sp.z + lz * sp.s];
    return { eye: [look[0] + 0.3 + Math.sin(frame * 0.03) * 0.3, 3.4 + Math.sin(frame * 0.021) * 0.2, look[2] + 11.5 - drift * 0.8] as V3, look: [look[0] + 0.45, 3.1, look[2]] as V3 };
  }
  const crossF = cuts[4] + Math.round(2.1 * fps);
  if (i === 3) {
    const wk = frame < cuts[4] + 4 ? 1 - seg(frame, cuts[4] - 26, cuts[4] + 4) : 0;
    const px = (Math.sin((frame - cuts[3]) * 0.05) + 1) * 0.3 * wk;
    return { eye: [-4.4 + px - 0.3, 2.7, Z.stadium + 9.6 - drift * 0.9] as V3, look: [-4.4 + px - 0.1, 1.6, Z.stadium + 1.0] as V3 };
  }
  const runT = seg(frame, cuts[4] + 4, crossF, easeInOut);
  const heroX = lerp(-4.4, 0.6, runT) + (frame > crossF ? seg(frame, crossF, crossF + 30, easeOut) * 1.4 : 0);
  if (frame < crossF + 8) return { eye: [heroX * 0.8 - 0.3, 2.6, Z.stadium + 9.6] as V3, look: [heroX * 0.8 + 0.3, 1.5, Z.stadium + 0.2] as V3 };
  const t = Math.min(1, (frame - crossF - 8) / 600);
  const eyes: V3[] = [[heroX + 1.0 - t * 0.2, 2.5, Z.stadium + 8.4 + Math.sin(frame * 0.02) * 0.15]];
  const c = 0;
  return { eye: eyes[c], look: [heroX + 0.2, 1.45, Z.stadium + 0.3] as V3 };
};

const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (t: number) => t * t * (3 - 2 * t);
// v1e: only 2 hard cuts (garden->ship, ship->stadium). road->garden is a flying camera, board->finish is a glide.
export const FLY_A = 22; // frames of fly before the garden beat starts
export const FLY_B = 18; // frames of fly after
const useCam = (frame: number, cuts: number[], fps: number) => {
  let i = 0;
  for (let k = 1; k < cuts.length; k++) if (frame >= cuts[k]) i = k;
  const f0 = cuts[1] - FLY_A, f1 = cuts[1] + FLY_B;
  if (frame >= f0 && frame < f1 && i <= 1) {
    const a = beatCam(f0, cuts, fps, 0), b = beatCam(f1, cuts, fps, 1);
    const t = smooth((frame - f0) / (f1 - f0));
    return { eye: lerp3(a.eye, b.eye, t), look: lerp3(a.look, b.look, t) };
  }
  if (i === 0 || (i === 1 && frame < f0)) return beatCam(frame, cuts, fps, 0);
  const g0 = cuts[4] - 20, g1 = cuts[4] + 30;
  if (frame >= g0 && frame < g1) {
    const a = beatCam(frame, cuts, fps, 3), b = beatCam(frame, cuts, fps, 4);
    const t = smooth((frame - g0) / (g1 - g0));
    return { eye: lerp3(a.eye, b.eye, t), look: lerp3(a.look, b.look, t) };
  }
  return beatCam(frame, cuts, fps, i);
};

// ---------- composition ----------
const World: React.FC<{ cuts: number[]; fps: number }> = ({ cuts, fps }) => {
  const frame = useCurrentFrame();
  const sipF = cuts[1] + 24;
  const lieF = cuts[1] + 53;
  const crossF = cuts[4] + Math.round(2.1 * fps); // the old man breaks the tape on 'وقطع خط النهاية'
  return (
    <>
      <Cam cuts={cuts} />
      <SkyDome top="#4A98C4" horizon="#FBE7C6" />
      <fog attach="fog" args={["#F6E2C0", 48, 150]} />
      <hemisphereLight args={["#D6ECF6", "#EBCB9C", 1.7]} />
      <directionalLight position={[-3, 8, -10]} intensity={1.0} color="#D8E8FF" />
      <directionalLight position={[7, 12, 8]} intensity={2.7} color="#FFE7C0" castShadow shadow-mapSize={[1024, 1024]} />
      {/* one warm floor far under everything */}
      <Part geo={circle(320, 48)} color={PAL.sand} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, -60]} />
      {frame < cuts[1] + FLY_B + 4 && <RoadWorld f={frame} hideF={cuts[1] - FLY_A + 8} />}
      {frame >= cuts[1] - FLY_A - 6 && frame < cuts[2] + 6 && <GardenWorld f={frame} sipF={sipF} lieF={lieF} enterF={cuts[1] - 26} />}
      {frame >= cuts[2] - 2 && frame < cuts[3] + 8 && <SeaWorld f={frame} startF={cuts[2]} />}
      {frame >= cuts[3] - 30 && <StadiumWorld f={frame} crossF={crossF} startF={cuts[3]} runF={cuts[4]} />}
    </>
  );
};

import { useThree } from "@react-three/fiber";

const Cam: React.FC<{ cuts: number[] }> = ({ cuts }) => {
  const frame = useCurrentFrame();
  const { camera } = useThree();
  const { eye, look } = useCam(frame, cuts, 30);
  camera.position.set(...eye);
  camera.lookAt(...look);
  return null;
};

export const FactKanakuri: React.FC<FactKanakuriProps> = ({ starts = DEFAULT_STARTS, durationSec = DEFAULT_DURATION, debug = false }) => {
  const { width, height, fps } = useVideoConfig();
  const cuts = useMemo(() => starts.map((t) => Math.round(t * fps)), [starts, fps]);
  void debug;
  return (
    <AbsoluteFill style={{ backgroundColor: "#FBE7C6" }}>
      <ThreeCanvas width={width} height={height} shadows="soft" flat camera={{ fov: 40, near: 0.1, far: 900, position: [0, 3, 10] }}>
        <World cuts={cuts} fps={fps} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
