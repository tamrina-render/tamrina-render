import React from "react";
import { PAL, Part, box, circle, cyl, rbox, sphere, torusArc } from "./parts";

/**
 * A blocky toy figure. Origin = between the feet on the ground; faces +z.
 * Angles are radians. Arm: sx swings forward (negative = forward/up), sz spreads out (positive = away
 * from the body), twist turns the upper arm so the elbow folds sideways, elbow folds the forearm
 * (negative = forward/up). Leg: hip (negative = forward), sz (positive = out), knee (positive = bends back).
 */
export type ArmPose = { sx: number; sz: number; twist: number; elbow: number };
export type LegPose = { hip: number; sz: number; knee: number; toe?: number }; // toe: turns the foot in (+)

export type BlockyColors = {
  skin: string;
  shirt: string; // torso (statue: same as skin)
  pants: string; // shorts / cloth
  shoes: string;
  hair: string;
  face: string; // eyes, brows, mouth
};

export type BlockyPose = {
  armL: ArmPose; // character's left = +x
  armR: ArmPose;
  legL: LegPose;
  legR: LegPose;
  lean: number; // torso pitch, positive = forward
  twist: number; // torso yaw
  roll: number; // torso side bend (weight shift)
  bob: number; // hips up/down
  shrug: number; // 0..1 shoulders up, head sinks
  hunch: number; // 0..1 shoulders roll forward (hugging, shy)
  headYaw: number;
  headPitch: number; // positive = looks down
  headTilt: number;
  eyeX: number; // -1..1 pupils left/right (screen-facing: + = character's left)
  eyeY: number;
  eyeOpen: number; // 0 = closed line, 1 = open
  eyeWide: number; // 1 normal, 1.4 shocked
  brow: number; // -1 angry, 0 neutral, 1 worried (inner ends up)
  browUp: number; // raise
  mouth: "smile" | "grin" | "o" | "wavy" | "flat";
  mouthOpen: number; // for "o"
  blush: number; // 0..1
  squash: number; // 1 = none, <1 squashed down
};

export const restPose = (): BlockyPose => ({
  armL: { sx: 0, sz: 0.08, twist: 0, elbow: -0.15 },
  armR: { sx: 0, sz: 0.08, twist: 0, elbow: -0.15 },
  legL: { hip: 0, sz: 0.03, knee: 0 },
  legR: { hip: 0, sz: 0.03, knee: 0 },
  lean: 0,
  twist: 0,
  roll: 0,
  bob: 0,
  shrug: 0,
  hunch: 0,
  headYaw: 0,
  headPitch: 0,
  headTilt: 0,
  eyeX: 0,
  eyeY: 0,
  eyeOpen: 1,
  eyeWide: 1,
  brow: 0,
  browUp: 0,
  mouth: "smile",
  mouthOpen: 0,
  blush: 0,
  squash: 1,
});

export type BlockyProps = {
  pose: BlockyPose;
  colors: BlockyColors;
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
  statue?: boolean; // marble cloth to the knee + curls
  headband?: string;
  rightHand?: React.ReactNode; // held in the right hand (hand-local, hand centre at origin)
  leftHand?: React.ReactNode;
  sleeves?: string; // long sleeves: forearm colour
  chest?: React.ReactNode; // rides on the torso (torso-local, chest front at z 0.25)
  trousers?: string; // long trousers / long dress: lower-leg colour (default: skin, shorts)
  skirt?: string; // a flared skirt from the waist (moves with the hips, not the legs)
  skirtShape?: [number, number, number]; // [top radius, hem radius, length]; default [0.47, 0.62, 0.62]
  headgear?: React.ReactNode; // head-local node (head centre y 0.41, face at z 0.38, crown at y 0.87): hats, moustaches
  noBlob?: boolean; // hide the blob contact shadow (seated on a machine)
  hipwear?: React.ReactNode; // hip-local node (moves with the hips like the skirt, not the torso): coat tails, dress stripes
};

// Proportions (toy: big head, short limbs)
const LEG_UP = 0.42;
const LEG_LO = 0.4;
const HIP_Y = LEG_UP + LEG_LO + 0.1;
const TORSO_H = 0.82;
const ARM_UP = 0.4;
const ARM_LO = 0.36;

const Arm: React.FC<{ p: ArmPose; side: 1 | -1; c: BlockyColors; statue: boolean; hold?: React.ReactNode; sleeve?: string }> = ({ p, side, c, statue, hold, sleeve }) => (
  <group position={[side * 0.53, TORSO_H - 0.1, 0]} rotation={[p.sx, side * p.twist, side * p.sz, "XZY"]}>
    {/* shoulder cap + upper arm in shirt colour */}
    <Part geo={rbox(0.25, ARM_UP + 0.06, 0.25, 0.09)} color={statue ? c.skin : c.shirt} position={[0, -ARM_UP / 2 + 0.03, 0]} />
    <group position={[0, -ARM_UP, 0]} rotation={[p.elbow, 0, 0]}>
      <Part geo={rbox(0.22, ARM_LO, 0.22, 0.09)} color={sleeve ?? c.skin} position={[0, -ARM_LO / 2, 0]} />
      <group position={[0, -ARM_LO - 0.06, 0]}>
        <Part geo={rbox(0.24, 0.2, 0.24, 0.1)} color={c.skin} />
        {hold}
      </group>
    </group>
  </group>
);

const Leg: React.FC<{ p: LegPose; side: 1 | -1; c: BlockyColors; statue: boolean; lower?: string }> = ({ p, side, c, statue, lower }) => (
  <group position={[side * 0.2, 0, 0]} rotation={[p.hip, 0, side * p.sz]}>
    <Part geo={rbox(0.29, LEG_UP + 0.04, 0.3, 0.08)} color={statue ? c.skin : c.pants} position={[0, -LEG_UP / 2, 0]} />
    <group position={[0, -LEG_UP, 0]} rotation={[p.knee, 0, 0]}>
      <Part geo={rbox(0.27, LEG_LO, 0.28, 0.08)} color={lower ?? c.skin} position={[0, -LEG_LO / 2, 0]} />
      <group position={[0, -LEG_LO - 0.02, 0]} rotation={[0, -side * (p.toe ?? 0), 0]}>
        <Part geo={rbox(0.31, 0.15, 0.42, 0.06)} color={c.shoes} position={[0, 0, 0.06]} />
      </group>
    </group>
  </group>
);

const Face: React.FC<{ pose: BlockyPose; c: BlockyColors; statue: boolean }> = ({ pose, c, statue }) => {
  const z = 0.38;
  const open = Math.max(0.0, pose.eyeOpen);
  const ew = pose.eyeWide;
  const eyes = [1, -1].map((s) => {
    const ex = s * 0.17;
    return (
      <group key={s} position={[ex, 0.41, z]}>
        {open > 0.05 ? (
          <>
            <Part geo={circle(0.1)} color="#FFFFFF" basic scale={[ew, ew * open, 1]} position={[0, 0, 0.002]} shadow={false} />
            <Part
              geo={circle(0.062)}
              color={c.face}
              basic
              scale={[1, open, 1]}
              position={[pose.eyeX * 0.035 * ew, pose.eyeY * 0.03 * ew, 0.006]}
              shadow={false}
            />
            <Part
              geo={circle(0.02)}
              color="#FFFFFF"
              basic
              position={[pose.eyeX * 0.035 * ew + 0.02, pose.eyeY * 0.03 * ew + 0.022 * open, 0.009]}
              shadow={false}
            />
          </>
        ) : (
          // closed: a calm downward arc (stone eyes)
          <Part geo={torusArc(0.07, 0.014, Math.PI)} color={c.face} basic rotation={[0, 0, Math.PI]} position={[0, 0.03, 0.004]} shadow={false} />
        )}
        {/* brow */}
        <Part
          geo={box(0.17, 0.035, 0.01)}
          color={c.face}
          basic
          shadow={false}
          position={[0, 0.15 + pose.browUp * 0.05 + (ew - 1) * 0.08, 0.004]}
          rotation={[0, 0, -s * pose.brow * 0.35]}
        />
      </group>
    );
  });

  let mouth: React.ReactNode = null;
  if (pose.mouth === "smile")
    mouth = <Part geo={torusArc(0.08, 0.017, Math.PI)} color={c.face} basic rotation={[0, 0, Math.PI]} position={[0, 0.2, z + 0.004]} shadow={false} />;
  else if (pose.mouth === "grin")
    mouth = (
      <group position={[0, 0.18, z + 0.003]}>
        <Part geo={circle(0.1, 20)} color={c.face} basic scale={[1, 0.55, 1]} shadow={false} />
        <Part geo={box(0.14, 0.03, 0.01)} color="#FFFFFF" basic position={[0, 0.02, 0.003]} shadow={false} />
      </group>
    );
  else if (pose.mouth === "o")
    mouth = <Part geo={circle(0.05, 20)} color={c.face} basic scale={[0.8, 0.5 + pose.mouthOpen, 1]} position={[0, 0.17, z + 0.004]} shadow={false} />;
  else if (pose.mouth === "wavy")
    mouth = (
      <group position={[0, 0.18, z + 0.004]}>
        {[-1, 0, 1].map((i) => (
          <Part
            key={i}
            geo={torusArc(0.03, 0.012, Math.PI)}
            color={c.face}
            basic
            rotation={[0, 0, i % 2 === 0 ? 0 : Math.PI]}
            position={[i * 0.055, i % 2 === 0 ? -0.012 : 0.012, 0]}
            shadow={false}
          />
        ))}
      </group>
    );
  else mouth = <Part geo={box(0.12, 0.028, 0.01)} color={c.face} basic position={[0, 0.19, z + 0.004]} shadow={false} />;

  return (
    <>
      {eyes}
      {mouth}
      {/* nose */}
      <Part geo={rbox(0.09, 0.11, 0.08, 0.03)} color={c.skin} position={[0, 0.3, z + 0.02]} />
      {/* blush */}
      {pose.blush > 0.01 &&
        [1, -1].map((s) => (
          <Part
            key={s}
            geo={circle(0.085, 20)}
            color={PAL.blush}
            basic
            opacity={Math.min(1, pose.blush) * (statue ? 0.95 : 0.8)}
            scale={[1.05, 0.72, 1]}
            position={[s * 0.25, 0.27, z + 0.003]}
            shadow={false}
          />
        ))}
    </>
  );
};

export const Blocky: React.FC<BlockyProps> = ({ pose, colors: c, position, rotationY = 0, scale = 1, statue = false, headband, rightHand, leftHand, sleeves, chest, trousers, skirt, skirtShape = [0.47, 0.62, 0.62], headgear, noBlob, hipwear }) => {
  const sq = pose.squash;
  const sx = 1 / Math.sqrt(Math.max(0.5, sq));
  const shrugY = pose.shrug * 0.12;
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <group scale={[sx, sq, sx]}>
        {/* blob contact shadow keeps feet grounded even when the shadow map is soft */}
        {!noBlob && <Part geo={circle(0.55, 28)} color="#000000" basic opacity={0.14} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} scale={[1, 0.8, 1]} shadow={false} />}
        <group position={[0, HIP_Y + pose.bob, 0]}>
          <Leg p={pose.legL} side={1} c={c} statue={statue} lower={trousers} />
          <Leg p={pose.legR} side={-1} c={c} statue={statue} lower={trousers} />
          {skirt && (
            <group rotation={[0, pose.twist * 0.5, 0]}>
              <Part geo={cyl(skirtShape[0], skirtShape[1], skirtShape[2], 14)} color={skirt} position={[0, 0.01 - skirtShape[2] / 2, 0]} />
              <Part geo={cyl(0.48, 0.48, 0.12, 14)} color={skirt} position={[0, 0.04, 0]} />
            </group>
          )}
          {hipwear && <group rotation={[0, pose.twist * 0.5, 0]}>{hipwear}</group>}
          {statue ? (
            // marble cloth, waist to knee, faceted folds
            <group rotation={[0, pose.twist * 0.5, 0]}>
              <Part geo={cyl(0.47, 0.52, 0.5, 11)} color={c.pants} flat position={[0, -0.16, 0]} />
              <Part geo={cyl(0.5, 0.5, 0.1, 11)} color={c.pants} flat position={[0, 0.06, 0]} />
            </group>
          ) : (
            <Part geo={rbox(0.82, 0.34, 0.52, 0.1)} color={c.pants} position={[0, -0.08, 0]} />
          )}
          <group rotation={[pose.lean, pose.twist, pose.roll]}>
            <Part geo={rbox(0.84, TORSO_H, 0.5, 0.14)} color={c.shirt} position={[0, TORSO_H / 2, 0]} />
            {statue && pose.hunch < 0.05 && (
              // carved chest lines (lit, so they shade with the marble; gone as soon as the arms start to close)
              <>
                <Part geo={box(0.02, 0.2, 0.01)} color={PAL.marbleShade} position={[0, TORSO_H * 0.62, 0.252]} shadow={false} />
                <Part geo={torusArc(0.13, 0.012, Math.PI * 0.7)} color={PAL.marbleShade} position={[0.15, TORSO_H * 0.68, 0.252]} rotation={[0, 0, Math.PI * 1.15]} shadow={false} />
                <Part geo={torusArc(0.13, 0.012, Math.PI * 0.7)} color={PAL.marbleShade} position={[-0.15, TORSO_H * 0.68, 0.252]} rotation={[0, 0, Math.PI * 1.15]} shadow={false} />
              </>
            )}
            {chest}
            <group position={[0, shrugY, pose.hunch * 0.13]}>
              <Arm p={pose.armL} side={1} c={c} statue={statue} hold={leftHand} sleeve={sleeves} />
              <Arm p={pose.armR} side={-1} c={c} statue={statue} hold={rightHand} sleeve={sleeves} />
            </group>
            {/* neck + head (sinks into the shoulders on a shrug) */}
            <group position={[0, TORSO_H + 0.04 - pose.shrug * 0.1, 0]}>
              <Part geo={cyl(0.13, 0.15, 0.14, 12)} color={c.skin} position={[0, 0.03, 0]} />
              <group rotation={[pose.headPitch, pose.headYaw, pose.headTilt, "YXZ"]}>
                <Part geo={rbox(0.84, 0.78, 0.74, 0.1)} color={c.skin} position={[0, 0.41, 0]} />
                {/* ears */}
                <Part geo={rbox(0.08, 0.17, 0.12, 0.04)} color={c.skin} position={[0.44, 0.38, 0]} />
                <Part geo={rbox(0.08, 0.17, 0.12, 0.04)} color={c.skin} position={[-0.44, 0.38, 0]} />
                {statue ? (
                  // marble curls
                  <group position={[0, 0.78, -0.04]}>
                    {[-0.3, -0.1, 0.1, 0.3].map((x, i) => (
                      <React.Fragment key={x}>
                        <Part geo={sphere(0.14, 12)} color={c.hair} position={[x, 0.02 + (i % 2) * 0.03, 0.22]} />
                        <Part geo={sphere(0.15, 12)} color={c.hair} position={[x, 0.04, -0.05]} />
                        <Part geo={sphere(0.13, 12)} color={c.hair} position={[x * 1.05, -0.1, -0.3]} />
                      </React.Fragment>
                    ))}
                    {headband && (
                      // laurel wreath
                      <group position={[0, -0.12, -0.04]}>
                        <Part geo={rbox(0.92, 0.07, 0.82, 0.03)} color={headband} />
                        {[-0.36, -0.2, 0.2, 0.36].map((x) => (
                          <Part key={x} geo={sphere(0.07, 6)} color={headband} flat scale={[1, 0.6, 1.4]} position={[x, 0.05, 0.4]} rotation={[0, 0, x * 2]} />
                        ))}
                      </group>
                    )}
                  </group>
                ) : (
                  <>
                    <Part geo={rbox(0.88, 0.22, 0.78, 0.1)} color={c.hair} position={[0, 0.76, -0.02]} />
                    <Part geo={rbox(0.88, 0.4, 0.2, 0.08)} color={c.hair} position={[0, 0.55, -0.3]} />
                    {headband && <Part geo={rbox(0.9, 0.1, 0.8, 0.05)} color={headband} position={[0, 0.66, -0.01]} />}
                  </>
                )}
                <Face pose={pose} c={c} statue={statue} />
                {headgear}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
