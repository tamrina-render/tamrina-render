import React from "react";
import * as THREE from "three";
import { Part, box, circle, cyl, rbox, sphere, torusArc } from "./parts";
import { clamp, hash, lerp } from "./anim";
import { Key, V3 } from "./mob";
import { IBeats } from "./ibaTiming";

// Set pieces for FactIba (the Iba dance of Saqqara -> a modern speaker). Pure functions of their props.

export const IPAL = {
  wall: "#EED7A9",
  wallShade: "#D9BB84",
  floor: "#DDBF8C",
  floorLine: "#C9A672",
  ochre: "#B4502E",
  yellow: "#E8B53E",
  blue: "#2E6FA6",
  blueDark: "#21457E",
  green: "#3E8E6E",
  black: "#2B2522",
  cream: "#FBF3E2",
  dress: "#FAF6EC",
  hair: "#1E1A1C",
  ivory: "#F4EBD5",
  ivoryShade: "#D9C69E",
  sand: "#EBCB8E",
  sandDark: "#D9B477",
  pyramid: "#E2C48C",
  pyramidShade: "#C9A66C",
  flame: "#FF9A2E",
  flameCore: "#FFE58A",
  speaker: "#2A2F38",
  speakerCap: "#C8E04A",
  ring: "#C8F06A",
};

// ---------------------------------------------------------------- the stage (world units; a girl at scale 0.9 is ~2.4 tall)
export const HALL = { x0: -8, x1: 8, zb: -13, zf: 10, h: 7.5 };
export const DOOR = { cx: -4.4, w: 3.4, h: 5.6 };
export const GIRL_S = 0.9;
export const ROW_Z = -5.5;
export const ROW_X = [-1.6, -0.6, 0.4, 1.4, 2.4];
export const ROW_ROT = 0.55; // the row dances turned 3/4 to the right
export const G1_POS: V3 = [-2.6, 0, 0.9];
export const G1_ROT = 1.0;
/** the clapper girl (holds the ivory clappers from beat 8) */
export const G2_POS: V3 = [-0.7, 0, 3.15];
export const G2_ROT = 0.9;
export const PYRAMID: V3 = [-58, 0, -133];
/** final locked camera; her hands land at screen (330, 1380), the speaker at (470, 1560) */
export const FIN_P: V3 = [0.2, 2.3, 7.0];
export const FIN_L: V3 = [-0.3, 1.0, -2.0];
export const FIN_FOV = 50;
export const HANDS_W: V3 = [-0.39, 1.0, 3.4];
export const SPEAKER_W: V3 = [-0.23, 0, 1.96];

// ---------------------------------------------------------------- camera
const onRay = (t: number): { p: V3; l: V3 } => {
  const p: V3 = [lerp(FIN_P[0], HANDS_W[0], t), lerp(FIN_P[1], HANDS_W[1], t), lerp(FIN_P[2], HANDS_W[2], t)];
  return { p, l: [p[0] + FIN_L[0] - FIN_P[0], p[1] + FIN_L[1] - FIN_P[1], p[2] + FIN_L[2] - FIN_P[2]] };
};

/** One continuous camera journey. The last key is `still` at B.lock: nothing moves after it. */
export const makeIbaKeys = (B: IBeats, direct = false): Key[] => {
  const S = B.s;
  const L = (i: number, u: number) => Math.round(lerp(S[i], S[i + 1], u));
  const k = (f: number, p: V3, l: V3, fov: number, still = false): Key => ({ f, p, l, fov, still });
  const med = onRay(0.2);
  const close = onRay(0.45);
  const close2 = onRay(0.48);
  const keys: Key[] = [
    // 0: the row of five, 3/4 from the front right, a slow push
    k(0, [4.6, 2.45, 3.6], [0.3, 1.2, -5.5], 50),
    k(S[1] - 8, [4.25, 2.4, 2.9], [0.25, 1.2, -5.5], 50),
    // 1: ease back; the doorway with the Step Pyramid outside
    k(L(1, 0.7), [3.0, 1.7, 3.6], [-3.4, 1.9, -13], 50),
    k(S[2] - 6, [2.9, 1.7, 3.8], [-3.3, 1.9, -13], 50),
    // 2: pan across the empty back-right corner and the right wall
    k(L(2, 0.5), [1.2, 2.35, 2.4], [7.6, 0.9, -12.6], 50),
    k(S[3] - 6, [1.4, 2.35, 2.2], [7.8, 0.9, -7.0], 50),
    // 3: searching: swing left, then right
    k(L(3, 0.4), [2.4, 2.3, 2.0], [-7.0, 1.0, -12.0], 50),
    k(L(3, 0.9), [2.4, 2.3, 2.2], [5.0, 1.0, -12.0], 50),
    // 4: back and round to the two girls at the side, clapping (the row behind them)
    k(L(4, 0.38), [1.7, 3.0, 9.6], [-1.0, 1.05, 0.3], 56),
    k(B.rA - 14, [1.65, 2.95, 9.4], [-0.95, 1.07, 0.2], 56),
    // 5: sink and push toward the painted back wall, tilting up to it (the painted wall fades in on top)
    k(B.rB + 12, [2.0, 0.7, 6.6], [1.6, 3.4, -13], 50, true),
    // hidden behind the painted wall: wait on the beat-8 framing
    k(B.bA, med.p, med.l, FIN_FOV, true),
    // 8: in on the ivory clappers (along the final camera's ray through her hands)
    k(Math.round(lerp(B.bB, S[9], 0.62)), close.p, close.l, FIN_FOV, true),
    k(S[9], close2.p, close2.l, FIN_FOV, true),
    // 9: ease out to the final framing and lock
    k(B.lock, FIN_P, FIN_L, FIN_FOV, true),
  ];
  // `direct` (videos/iba-zumba-b): no corner pan / searching / clapping-girls shots; from the doorway straight into the push at the wall
  if (direct) keys.splice(4, 6);
  for (let i = 1; i < keys.length; i++) if (keys[i].f <= keys[i - 1].f) keys[i] = { ...keys[i], f: keys[i - 1].f + 1 };
  return keys;
};

// ---------------------------------------------------------------- girls: hair, collar, dress
/** Black bob wig with a fringe and a coloured headband (head-local). */
export const Bob: React.FC<{ band: string }> = ({ band }) => (
  <>
    <Part geo={rbox(0.1, 0.6, 0.66, 0.04)} color={IPAL.hair} position={[0.46, 0.44, -0.06]} />
    <Part geo={rbox(0.1, 0.6, 0.66, 0.04)} color={IPAL.hair} position={[-0.46, 0.44, -0.06]} />
    <Part geo={rbox(0.92, 0.6, 0.22, 0.06)} color={IPAL.hair} position={[0, 0.38, -0.33]} />
    <Part geo={rbox(0.88, 0.13, 0.1, 0.04)} color={IPAL.hair} position={[0, 0.735, 0.36]} />
    <Part geo={rbox(0.95, 0.075, 0.82, 0.03)} color={band} position={[0, 0.68, -0.01]} />
  </>
);

/** Broad collar necklace (torso-local, chest front at z 0.25). */
export const Collar: React.FC = () => (
  <group position={[0, 0.8, 0.262]} rotation={[0, 0, Math.PI]}>
    <Part geo={torusArc(0.32, 0.035, Math.PI)} color={IPAL.green} shadow={false} />
    <Part geo={torusArc(0.255, 0.035, Math.PI)} color={IPAL.ochre} shadow={false} />
    <Part geo={torusArc(0.19, 0.035, Math.PI)} color={IPAL.blue} shadow={false} />
  </group>
);

export const DRESS_SHAPE: [number, number, number] = [0.47, 0.56, 0.62];

// ---------------------------------------------------------------- the ivory clappers
const gcache = new Map<string, THREE.BufferGeometry>();
const tusk = (side: number) => {
  const key = `tusk${side}`;
  let g = gcache.get(key);
  if (!g) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, -0.1), new THREE.Vector3(0, -0.03, 0.32), new THREE.Vector3(-side * 0.13, -0.05, 0.6));
    g = new THREE.TubeGeometry(curve, 18, 0.042, 9, false);
    gcache.set(key, g);
  }
  return g;
};
const ring = (r0: number, r1: number) => {
  const key = `ring${r0}:${r1}`;
  let g = gcache.get(key);
  if (!g) {
    g = new THREE.RingGeometry(r0, r1, 48);
    gcache.set(key, g);
  }
  return g;
};
export const CLAP_TIP: V3 = [0, -0.05, 0.6];

/**
 * One curved ivory clapper ending in a small carved hand, held in a Blocky hand (hand-local: the grip at the origin,
 * the stick along +z). side = the holding arm (1 = her left). turn > 0 swings the tip inward. squash 0..1 at a hit.
 */
export const IvoryClapper: React.FC<{ side: 1 | -1; turn: number; squash?: number; spark?: number }> = ({ side, turn, squash = 0, spark = 0 }) => {
  const tip: V3 = [-side * 0.13, -0.05, 0.6];
  const s = 1 - 0.28 * squash;
  return (
    <group rotation={[0, -side * turn, 0]}>
      <Part geo={tusk(side)} color={IPAL.ivory} rough={0.45} />
      {/* end caps */}
      <Part geo={sphere(0.042, 10)} color={IPAL.ivory} position={[0, 0, -0.1]} rough={0.45} />
      <group position={tip} rotation={[0, side * 0.2, 0]}>
        {/* carved bracelet */}
        <Part geo={torusArc(0.048, 0.014, Math.PI * 2)} color={IPAL.ivoryShade} position={[0, 0, -0.02]} />
        <group scale={[s, 1, 1 + 0.12 * squash]}>
          {/* palm faces inward (toward the other clapper) */}
          <Part geo={rbox(0.05, 0.12, 0.13, 0.02)} color={IPAL.ivory} position={[0, 0, 0.07]} rough={0.45} />
          {[-0.042, -0.014, 0.014, 0.042].map((y, i) => (
            <Part key={y} geo={rbox(0.042, 0.024, 0.085 + (i === 1 || i === 2 ? 0.012 : 0), 0.011)} color={IPAL.ivory} position={[0, y, 0.18]} rough={0.45} />
          ))}
          <Part geo={rbox(0.042, 0.024, 0.06, 0.011)} color={IPAL.ivory} position={[0, 0.07, 0.07]} rotation={[0.7, 0, 0]} rough={0.45} />
          {/* carved lines on the palm */}
          <Part geo={box(0.052, 0.008, 0.07)} color={IPAL.ivoryShade} position={[0, 0.02, 0.06]} shadow={false} />
          <Part geo={box(0.052, 0.008, 0.07)} color={IPAL.ivoryShade} position={[0, -0.02, 0.06]} shadow={false} />
        </group>
        {spark > 0.01 && (
          <group position={[-side * 0.05, 0, 0.12]} scale={0.6 + 0.6 * spark}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2 + 0.3;
              return (
                <Part
                  key={i}
                  geo={box(0.012, 0.012, 0.11)}
                  color="#FFFFFF"
                  basic
                  opacity={clamp(spark * 1.4)}
                  shadow={false}
                  position={[0, Math.sin(a) * 0.16, Math.cos(a) * 0.16]}
                  rotation={[-a, 0, 0]}
                />
              );
            })}
          </group>
        )}
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- the modern speaker
/** A small pill-shaped bluetooth speaker lying on the floor (origin on the floor), with a glowing ring that pulses on its beat. */
export const Speaker: React.FC<{ position: V3; scale: number; pulse: number; glow: number }> = ({ position, scale, pulse, glow }) => {
  if (scale <= 0.001) return null;
  const R = 0.2;
  return (
    <group position={position}>
      {/* the ring on the floor (not scaled with the pop) */}
      {glow > 0.01 && (
        <>
          <Part geo={ring(0.34, 0.4)} color={IPAL.ring} basic opacity={0.55 * glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} shadow={false} />
          <Part
            geo={ring(0.35, 0.4)}
            color={IPAL.ring}
            basic
            opacity={0.6 * glow * (1 - pulse)}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.014, 0]}
            scale={[1 + 0.7 * pulse, 1 + 0.7 * pulse, 1]}
            shadow={false}
          />
          <Part geo={circle(0.34, 40)} color={IPAL.ring} basic opacity={0.16 * glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} shadow={false} />
        </>
      )}
      <group scale={scale * 0.72} rotation={[0, -1.25, 0]}>
        <group position={[0, R + 0.02, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1 + 0.06 * pulse * glow]}>
          <Part geo={cyl(R, R, 0.6, 28)} color={IPAL.speaker} rough={0.9} />
          {/* grille band */}
          <Part geo={cyl(R + 0.004, R + 0.004, 0.44, 28)} color="#363C47" rough={1} />
          {[-1, 1].map((e) => (
            <group key={e} position={[0, e * 0.31, 0]}>
              <Part geo={cyl(R + 0.008, R + 0.008, 0.04, 28)} color={IPAL.speakerCap} rough={0.5} />
              <Part geo={cyl(R * 0.62, R * 0.62, 0.012, 24)} color={IPAL.speakerCap} emissive={IPAL.speakerCap} emissiveIntensity={0.35 + 0.65 * pulse * glow} position={[0, e * 0.022, 0]} />
            </group>
          ))}
        </group>
        {/* rubber foot */}
        <Part geo={rbox(0.36, 0.04, 0.12, 0.02)} color="#1B1E24" position={[0, 0.02, 0]} />
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- the hall
const Torch: React.FC<{ position: V3; rotY: number; frame: number; seed: number }> = ({ position, rotY, frame, seed }) => {
  const fl = 1 + 0.16 * Math.sin(frame * 0.9 + seed * 2.1) + 0.08 * Math.sin(frame * 1.7 + seed);
  const sway = 0.08 * Math.sin(frame * 0.6 + seed * 3);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Part geo={rbox(0.12, 0.5, 0.12, 0.03)} color="#6E4A30" position={[0, -0.25, -0.05]} />
      <Part geo={rbox(0.08, 0.08, 0.36, 0.02)} color="#6E4A30" position={[0, -0.4, 0.12]} />
      <Part geo={cyl(0.16, 0.08, 0.24, 12)} color="#8A5A32" position={[0, 0, 0.3]} />
      <group position={[0, 0.12, 0.3]} rotation={[sway, 0, sway * 0.5]}>
        <Part geo={cyl(0.001, 0.15, 0.5, 10)} color={IPAL.flame} basic position={[0, 0.25 * fl, 0]} scale={[1, fl, 1]} shadow={false} />
        <Part geo={cyl(0.001, 0.08, 0.3, 10)} color={IPAL.flameCore} basic position={[0, 0.15 * fl, 0.02]} scale={[1, fl, 1]} shadow={false} />
        <Part geo={sphere(0.42, 12)} color="#FFC56A" basic opacity={0.16} position={[0, 0.25, 0]} shadow={false} />
      </group>
    </group>
  );
};

const PapyrusColumn: React.FC<{ position: V3 }> = ({ position }) => (
  <group position={position}>
    <Part geo={cyl(0.64, 0.68, 0.25, 18)} color={IPAL.wallShade} position={[0, 0.125, 0]} />
    <Part geo={cyl(0.38, 0.45, 5.7, 18)} color="#EAD5A8" position={[0, 0.25 + 2.85, 0]} />
    {[
      [5.3, IPAL.blue],
      [5.45, IPAL.ochre],
      [5.6, IPAL.yellow],
      [1.0, IPAL.blue],
      [1.15, IPAL.ochre],
    ].map(([y, c]) => (
      <Part key={`${y}`} geo={cyl(0.405, 0.41, 0.12, 18)} color={c as string} position={[0, y as number, 0]} />
    ))}
    <Part geo={cyl(0.8, 0.4, 0.95, 18)} color={IPAL.green} position={[0, 6.4, 0]} />
    <Part geo={cyl(0.81, 0.81, 0.12, 18)} color={IPAL.yellow} position={[0, 6.86, 0]} />
    <Part geo={rbox(1.0, 0.45, 1.0, 0.04)} color={IPAL.wallShade} position={[0, 7.15, 0]} />
  </group>
);

const BLOCK_C = [IPAL.blue, IPAL.ochre, IPAL.green, IPAL.yellow];
/** A painted block border along a wall: blocks of colour with cream gaps (wall-local, along x). */
const BlockBand: React.FC<{ len: number; y: number; h?: number }> = ({ len, y, h = 0.3 }) => {
  const n = Math.floor(len / 0.5);
  return (
    <>
      <Part geo={box(len, h + 0.08, 0.02)} color={IPAL.black} position={[0, y, 0]} shadow={false} />
      {Array.from({ length: n }, (_, i) => (
        <Part key={i} geo={box(0.42, h, 0.03)} color={BLOCK_C[i % 4]} position={[-len / 2 + 0.25 + i * 0.5, y, 0.005]} shadow={false} />
      ))}
    </>
  );
};

/** One wall face with the dado, the top frieze and a painted band (wall-local: x along the wall, y up, +z into the room). */
const WallPaint: React.FC<{ len: number; h: number }> = ({ len, h }) => (
  <>
    <Part geo={box(len, 0.75, 0.02)} color={IPAL.ochre} position={[0, 0.375, 0]} shadow={false} />
    <Part geo={box(len, 0.08, 0.025)} color={IPAL.black} position={[0, 0.79, 0]} shadow={false} />
    <Part geo={box(len, 0.14, 0.025)} color={IPAL.yellow} position={[0, 0.9, 0]} shadow={false} />
    <BlockBand len={len} y={h - 0.75} />
    <Part geo={box(len, 0.35, 0.02)} color={IPAL.blue} position={[0, h - 0.3, 0]} shadow={false} />
  </>
);

/** The back wall's painted panel (right of the door): where the camera pushes in beat 5. */
const Panel: React.FC = () => (
  <group position={[2.3, 3.8, HALL.zb + 0.32]}>
    <Part geo={box(6.4, 5.2, 0.02)} color="#F2DDB2" shadow={false} />
    <group position={[0, 2.5, 0.01]}>
      <BlockBand len={6.4} y={0} h={0.2} />
    </group>
    <group position={[0, -2.5, 0.01]}>
      <BlockBand len={6.4} y={0} h={0.2} />
    </group>
    {[-3.15, 3.15].map((x) => (
      <Part key={x} geo={box(0.2, 5.2, 0.03)} color={IPAL.blue} position={[x, 0, 0.01]} shadow={false} />
    ))}
    {/* a faint register line and ground line */}
    <Part geo={box(6.0, 0.08, 0.03)} color={IPAL.ochre} position={[0, -0.1, 0.01]} shadow={false} />
    <Part geo={box(6.0, 0.6, 0.025)} color={IPAL.blueDark} position={[0, 0.25, 0.008]} shadow={false} />
  </group>
);

const STARS = Array.from({ length: 70 }, (_, i) => [lerp(HALL.x0 + 0.6, HALL.x1 - 0.6, hash(i * 3.7)), lerp(HALL.zb + 0.6, HALL.zf - 0.6, hash(i * 9.1 + 2))] as [number, number]);

export const Hall: React.FC<{ frame: number }> = ({ frame }) => {
  const { x0, x1, zb, zf, h } = HALL;
  const W = x1 - x0;
  const D = zf - zb;
  const zc = (zb + zf) / 2;
  const dl = DOOR.cx - DOOR.w / 2;
  const dr = DOOR.cx + DOOR.w / 2;
  const lines: React.ReactNode[] = [];
  for (let x = x0 + 1.6; x < x1; x += 1.6) lines.push(<Part key={`fx${x}`} geo={box(0.035, 0.01, D)} color={IPAL.floorLine} basic position={[x, 0.006, zc]} shadow={false} />);
  for (let z = zb + 1.6; z < zf; z += 1.6) lines.push(<Part key={`fz${z}`} geo={box(W, 0.01, 0.035)} color={IPAL.floorLine} basic position={[0, 0.006, z]} shadow={false} />);
  return (
    <>
      {/* floor */}
      <mesh position={[0, -0.05, zc]} receiveShadow>
        <boxGeometry args={[W, 0.1, D]} />
        <meshStandardMaterial color={IPAL.floor} roughness={0.9} />
      </mesh>
      {lines}
      {/* back wall with the doorway */}
      <Part geo={box(dl - x0, h, 0.6)} color={IPAL.wall} position={[(x0 + dl) / 2, h / 2, zb]} shadow={false} />
      <Part geo={box(x1 - dr, h, 0.6)} color={IPAL.wall} position={[(dr + x1) / 2, h / 2, zb]} shadow={false} />
      <Part geo={box(DOOR.w, h - DOOR.h, 0.6)} color={IPAL.wall} position={[DOOR.cx, (h + DOOR.h) / 2, zb]} shadow={false} />
      {/* door frame: painted jambs and a lintel */}
      {[dl - 0.2, dr + 0.2].map((x) => (
        <Part key={x} geo={box(0.4, DOOR.h + 0.4, 0.7)} color={IPAL.yellow} position={[x, (DOOR.h + 0.4) / 2, zb]} shadow={false} />
      ))}
      <Part geo={box(DOOR.w + 1.2, 0.5, 0.8)} color={IPAL.blue} position={[DOOR.cx, DOOR.h + 0.45, zb]} shadow={false} />
      <Part geo={box(DOOR.w + 1.2, 0.14, 0.85)} color={IPAL.ochre} position={[DOOR.cx, DOOR.h + 0.13, zb]} shadow={false} />
      {/* back wall paint, each side of the door */}
      <group position={[(x0 + dl - 0.4) / 2, 0, zb + 0.31]}>
        <WallPaint len={dl - 0.4 - x0} h={h} />
      </group>
      <group position={[(dr + 0.4 + x1) / 2, 0, zb + 0.31]}>
        <WallPaint len={x1 - dr - 0.4} h={h} />
      </group>
      <Panel />
      {/* side walls */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Part geo={box(0.6, h, D)} color={IPAL.wall} position={[sd > 0 ? x1 : x0, h / 2, zc]} shadow={false} />
          <group position={[(sd > 0 ? x1 : x0) - sd * 0.31, 0, zc]} rotation={[0, sd > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
            <WallPaint len={D} h={h} />
          </group>
        </group>
      ))}
      {/* ceiling: blue with yellow stars */}
      <Part geo={box(W, 0.3, D)} color={IPAL.blueDark} position={[0, h + 0.15, zc]} shadow={false} />
      {STARS.map(([x, z], i) => (
        <Part key={i} geo={circle(0.09, 5)} color={IPAL.yellow} basic rotation={[Math.PI / 2, 0, i]} position={[x, h - 0.005, z]} shadow={false} />
      ))}
      {[-5.4, 5.4].map((x) => (
        <Part key={x} geo={box(1.0, 0.5, D)} color={IPAL.wallShade} position={[x, h - 0.25, zc]} shadow={false} />
      ))}
      {/* columns and torches */}
      {[-5.4, 5.4].map((x) =>
        [-10, -5, 0, 5].map((z) => (
          <React.Fragment key={`${x}${z}`}>
            <PapyrusColumn position={[x, 0, z]} />
            <Torch position={[x - Math.sign(x) * 0.5, 3.3, z]} rotY={x > 0 ? -Math.PI / 2 : Math.PI / 2} frame={frame} seed={x + z * 1.3} />
          </React.Fragment>
        )),
      )}
      {[-2.2, 7.0].map((x, i) => (
        <Torch key={`bt${i}`} position={[x, 3.3, zb + 0.35]} rotY={0} frame={frame} seed={20 + i} />
      ))}
    </>
  );
};

// ---------------------------------------------------------------- outside: desert and the Step Pyramid of Saqqara
export const Outside: React.FC = () => {
  const tiers = 6;
  const base = 38;
  const top = 15;
  const th = 3.6;
  return (
    <>
      <mesh position={[0, -0.08, HALL.zb - 300]} receiveShadow>
        <boxGeometry args={[900, 0.1, 600]} />
        <meshStandardMaterial color={IPAL.sand} roughness={1} />
      </mesh>
      <group position={PYRAMID} rotation={[0, 0.35, 0]}>
        {Array.from({ length: tiers }, (_, i) => {
          const w0 = lerp(base, top, i / (tiers - 1));
          const w1 = w0 - 1.3;
          const r0 = (w0 / 2) * Math.SQRT2;
          const r1 = (w1 / 2) * Math.SQRT2;
          return (
            <Part key={i} geo={cyl(r1, r0, th, 4)} color={i % 2 ? IPAL.pyramid : "#E8CC95"} flat rotation={[0, Math.PI / 4, 0]} position={[0, th / 2 + i * th, 0]} scale={[1, 1, 0.82]} />
          );
        })}
      </group>
      {/* low dunes */}
      {[
        [-90, -170, 40, 6],
        [-20, -190, 55, 7],
        [40, -160, 35, 5],
        [-130, -120, 30, 5],
      ].map(([x, z, r, hgt], i) => (
        <Part key={i} geo={sphere(1, 20)} color={IPAL.sandDark} scale={[r, hgt, r * 0.5]} position={[x, -1, z]} />
      ))}
    </>
  );
};

// ---------------------------------------------------------------- the painted wall (2D layer, 1080 x 1920)
const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(lerp(ch(pa, s), ch(pb, s), t));
  return `rgb(${m(16)},${m(8)},${m(0)})`;
};

export type PaintPose = { arms: "diamond" | "clap"; step: number; rise: number; tilt: number; open: number; lean: number };

/** Painted Egyptian girl in profile facing right; feet at (0, 0), y up in units u. lit 0..1 (dim paint -> full colour). */
const PaintedGirl: React.FC<{ x: number; y: number; u: number; pose: PaintPose; lit: number; skin: string; band: string }> = ({ x, y, u, pose, lit, skin, band }) => {
  const wallMix = 0.5 * (1 - lit);
  const C = (c: string) => mixHex(c, IPAL.wall, wallMix);
  const ink = C("#5B3A26");
  const sw = 0.13 * u;
  const p = (px: number, py: number) => `${(px * u).toFixed(1)},${(-py * u).toFixed(1)}`;
  const st = pose.step;
  const rise = pose.rise * 0.45;
  const foot = (dx: number, heel: number) =>
    `M${p(-0.7 + dx, heel)} L${p(-0.7 + dx, 0.6 + heel)} L${p(0.55 + dx, 0.65 + heel * 0.5)} L${p(1.45 + dx, 0.18)} L${p(1.5 + dx, 0)} L${p(-0.5 + dx, heel * 0.6)} Z`;
  const hemB = -1.65 - st * 0.15;
  const hemF = 2.0 + st * 0.55;
  const dress = `M${p(-0.55, 15.25)} L${p(-2.05, 14.65)} Q${p(-2.0, 12.2)} ${p(-1.3, 10.1)} Q${p(-1.85, 8.6)} ${p(-1.75, 6.5)} L${p(hemB, 0.85)} L${p(hemF, 0.85)} Q${p(1.65, 5.2)} ${p(1.55, 8.3)} Q${p(1.15, 9.6)} ${p(1.3, 10.4)} Q${p(1.95, 11.9)} ${p(1.75, 13.3)} L${p(2.05, 14.65)} L${p(0.65, 15.25)} Z`;
  const arm = (pts: [number, number][]) => `M${pts.map(([a, b]) => p(a, b)).join(" L")}`;
  let armBack: [number, number][];
  let armFront: [number, number][];
  let handB: [number, number];
  let handF: [number, number];
  if (pose.arms === "diamond") {
    const t = pose.lean;
    armBack = [
      [-1.75, 14.3],
      [-2.85 + t * 0.3, 17.6],
      [0.15 + t, 21.0],
    ];
    armFront = [
      [1.85, 14.3],
      [3.0 + t * 0.3, 17.6],
      [0.45 + t, 21.0],
    ];
    handB = [0.05 + t, 21.35];
    handF = [0.55 + t, 21.35];
  } else {
    const o = pose.open;
    armBack = [
      [-0.4, 14.2],
      [1.0, 12.5],
      [2.55, 15.0],
    ];
    armFront = [
      [0.6, 14.2],
      [2.1, 12.3],
      [3.1 + o * 0.9, 15.15],
    ];
    handB = [2.55, 15.45];
    handF = [3.1 + o * 0.9, 15.6];
  }
  const sleeve = (d: string, k: string) => (
    <React.Fragment key={k}>
      <path d={d} stroke={ink} strokeWidth={1.05 * u} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={d} stroke={C(IPAL.dress)} strokeWidth={0.8 * u} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </React.Fragment>
  );
  const hand = ([hx, hy]: [number, number], k: string, rot: number) => (
    <ellipse key={k} cx={hx * u} cy={-hy * u} rx={0.34 * u} ry={0.55 * u} fill={C(skin)} stroke={ink} strokeWidth={sw} transform={`rotate(${rot} ${hx * u} ${-hy * u})`} />
  );
  const backHandRot = pose.arms === "diamond" ? -20 : -10;
  const frontHandRot = pose.arms === "diamond" ? 20 : 8;
  return (
    <g transform={`translate(${x} ${y - rise * u}) rotate(${pose.tilt} 0 0)`}>
      {/* back arm (behind the body) */}
      {sleeve(arm(armBack), "ab")}
      {hand(handB, "hb", backHandRot)}
      {/* feet */}
      <path d={foot(-st * 0.5, pose.rise * 0.5)} fill={C(skin)} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      <path d={foot(st * 1.25, pose.rise * 0.5)} fill={C(skin)} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      {/* dress */}
      <path d={dress} fill={C(IPAL.dress)} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      <path d={`M${p(-1.4, 9.95)} Q${p(0, 9.6)} ${p(1.25, 10.1)}`} stroke={C(band)} strokeWidth={0.32 * u} fill="none" />
      {/* collar */}
      <ellipse cx={0.05 * u} cy={-14.95 * u} rx={2.0 * u} ry={1.3 * u} fill={C(IPAL.green)} stroke={ink} strokeWidth={sw} />
      <ellipse cx={0.05 * u} cy={-15.05 * u} rx={1.55 * u} ry={1.0 * u} fill={C(IPAL.ochre)} />
      <ellipse cx={0.05 * u} cy={-15.15 * u} rx={1.1 * u} ry={0.7 * u} fill={C(IPAL.blue)} />
      {/* neck */}
      <rect x={-0.45 * u} y={-16.4 * u} width={1.0 * u} height={1.3 * u} fill={C(skin)} />
      {/* wig (back) */}
      <path
        d={`M${p(-0.3, 19.5)} Q${p(-2.4, 19.4)} ${p(-2.2, 17.0)} L${p(-2.1, 15.4)} Q${p(-1.1, 15.0)} ${p(-0.1, 15.5)} L${p(0.2, 17.3)} Z`}
        fill={C(IPAL.hair)}
        stroke={ink}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* face */}
      <path
        d={`M${p(0.2, 18.6)} Q${p(1.0, 18.7)} ${p(1.15, 18.0)} L${p(1.75, 17.15)} L${p(1.3, 16.95)} L${p(1.45, 16.6)} L${p(1.3, 16.45)} Q${p(1.25, 16.0)} ${p(0.85, 15.95)} Q${p(0.1, 15.85)} ${p(-0.1, 16.3)} L${p(-0.15, 17.5)} Z`}
        fill={C(skin)}
        stroke={ink}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* fringe + top of the wig */}
      <path d={`M${p(-0.6, 19.6)} Q${p(0.6, 19.8)} ${p(1.2, 18.75)} L${p(1.15, 18.35)} Q${p(0.4, 18.2)} ${p(-0.2, 18.4)} Z`} fill={C(IPAL.hair)} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      {/* headband */}
      <path d={`M${p(-2.25, 18.4)} Q${p(-0.6, 19.0)} ${p(1.12, 18.7)}`} stroke={C(band)} strokeWidth={0.3 * u} fill="none" />
      <circle cx={-2.15 * u} cy={-18.3 * u} r={0.42 * u} fill={C(band)} stroke={ink} strokeWidth={sw} />
      {/* eye, brow, mouth, earring */}
      <path d={`M${p(0.35, 17.55)} Q${p(0.8, 17.85)} ${p(1.15, 17.55)} Q${p(0.8, 17.3)} ${p(0.35, 17.55)} Z`} fill="#FFFFFF" stroke={C(IPAL.black)} strokeWidth={0.1 * u} />
      <circle cx={0.86 * u} cy={-17.56 * u} r={0.13 * u} fill={C(IPAL.black)} />
      <path d={`M${p(0.35, 17.55)} L${p(-0.15, 17.45)}`} stroke={C(IPAL.black)} strokeWidth={0.1 * u} />
      <path d={`M${p(0.3, 18.0)} Q${p(0.8, 18.2)} ${p(1.15, 17.95)}`} stroke={C(IPAL.black)} strokeWidth={0.11 * u} fill="none" />
      <path d={`M${p(1.18, 16.68)} L${p(1.42, 16.66)}`} stroke={C("#9C3A2A")} strokeWidth={0.12 * u} strokeLinecap="round" />
      <circle cx={-0.15 * u} cy={-16.55 * u} r={0.32 * u} fill={C(IPAL.yellow)} stroke={ink} strokeWidth={sw} />
      {/* front arm (over the body) */}
      {sleeve(arm(armFront), "af")}
      {hand(handF, "hf", frontHandRot)}
    </g>
  );
};

/** One band of the block border (horizontal), clipped to [x0, x1). */
const SvgBlocks: React.FC<{ x0: number; x1: number; y: number; h: number; vertical?: boolean }> = ({ x0, x1, y, h, vertical }) => {
  const out: React.ReactNode[] = [];
  const step = 32;
  for (let i = 0, a = x0; a < x1; i++, a += step) {
    const len = Math.min(step - 5, x1 - a);
    out.push(
      vertical ? (
        <rect key={i} x={y} y={a} width={h} height={len} fill={BLOCK_C[i % 4]} />
      ) : (
        <rect key={i} x={a} y={y} width={len} height={h} fill={BLOCK_C[i % 4]} />
      ),
    );
  }
  return (
    <>
      {vertical ? <rect x={y - 4} y={x0} width={h + 8} height={x1 - x0} fill={IPAL.black} /> : <rect x={x0} y={y - 4} width={x1 - x0} height={h + 8} fill={IPAL.black} />}
      {out}
    </>
  );
};

const Star: React.FC<{ x: number; y: number; r: number }> = ({ x, y, r }) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    pts.push(`${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`);
  }
  return <polygon points={pts.join(" ")} fill={IPAL.yellow} />;
};

/** screen layout of the painted wall */
export const RELIEF = {
  rowY: 1040,
  rowU: 31,
  rowX: [140, 340, 540, 740, 940],
  clapY: 1772,
  clapU: 26.5,
  clapX: [360, 700],
};
const SKINS = ["#DDA36E", "#D99A64", "#E2AE7A", "#D6955E", "#DFA772", "#DB9F69", "#E0A874"];
const BANDS = [IPAL.ochre, IPAL.blue, IPAL.green, IPAL.ochre, IPAL.blue, IPAL.green, IPAL.ochre];
const SPECK = Array.from({ length: 260 }, (_, i) => ({ x: hash(i * 1.37) * 1080, y: hash(i * 7.91 + 3) * 1920, r: 1.5 + hash(i * 3.3) * 3.5, d: hash(i * 5.5) < 0.6 }));

export type ReliefState = {
  /** 0..1 per painted dancer / clapper */
  rowLit: number[];
  clapLit: number[];
  rowPose: PaintPose;
  clapPose: PaintPose;
  /** glow pulse on the beat 0..1 */
  pulse: number;
  frame: number;
};

export const Relief: React.FC<ReliefState> = ({ rowLit, clapLit, rowPose, clapPose, pulse, frame }) => {
  const R = RELIEF;
  const fl = 0.5 + 0.5 * Math.sin(frame * 0.21) * Math.sin(frame * 0.07 + 1);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <radialGradient id="ibaGlow">
          <stop offset="0%" stopColor="#FFF0B8" stopOpacity={0.95} />
          <stop offset="55%" stopColor="#FFD77A" stopOpacity={0.45} />
          <stop offset="100%" stopColor="#FFD77A" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="ibaTorch" cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor="#FFF4DC" stopOpacity={0.22} />
          <stop offset="70%" stopColor="#FFF4DC" stopOpacity={0} />
          <stop offset="100%" stopColor="#5A3A1E" stopOpacity={0.28} />
        </radialGradient>
      </defs>
      {/* sandstone wall: courses, joints, speckle */}
      <rect x={0} y={0} width={1080} height={1920} fill={IPAL.wall} />
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={`c${i}`} x={0} y={i * 124 + 60} width={1080} height={3} fill={IPAL.wallShade} opacity={0.55} />
      ))}
      {Array.from({ length: 16 }, (_, i) =>
        [0, 1, 2, 3, 4].map((j) => <rect key={`j${i}${j}`} x={(j * 270 + (i % 2) * 135 + 60) % 1080} y={i * 124 + 60} width={3} height={124} fill={IPAL.wallShade} opacity={0.45} />),
      )}
      {SPECK.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.d ? "#C9A56C" : "#FAEBCB"} opacity={0.45} />
      ))}
      {/* top frieze */}
      <SvgBlocks x0={0} x1={1080} y={20} h={26} />
      {Array.from({ length: 30 }, (_, i) => {
        const cx = 18 + i * 36;
        const c = [IPAL.green, IPAL.ochre, IPAL.blue][i % 3];
        return (
          <g key={`k${i}`}>
            <rect x={cx - 10} y={92} width={20} height={92} rx={6} fill={c} stroke={IPAL.black} strokeWidth={2.5} />
            <circle cx={cx} cy={86} r={11} fill={c} stroke={IPAL.black} strokeWidth={2.5} />
            <rect x={cx - 12} y={122} width={24} height={9} fill={IPAL.yellow} stroke={IPAL.black} strokeWidth={2} />
          </g>
        );
      })}
      <rect x={0} y={196} width={1080} height={10} fill={IPAL.black} />
      <rect x={0} y={206} width={1080} height={18} fill={IPAL.yellow} />
      {/* side borders */}
      <SvgBlocks x0={224} x1={1800} y={10} h={24} vertical />
      <SvgBlocks x0={224} x1={1800} y={1046} h={24} vertical />
      {/* upper register: ground line */}
      <rect x={34} y={R.rowY} width={1012} height={20} fill={IPAL.ochre} />
      {/* the band between the registers: blue with yellow stars */}
      <rect x={0} y={1060} width={1080} height={14} fill={IPAL.black} />
      <rect x={0} y={1074} width={1080} height={22} fill={IPAL.yellow} />
      <rect x={0} y={1096} width={1080} height={160} fill={IPAL.blueDark} />
      {Array.from({ length: 2 }, (_, r) =>
        Array.from({ length: 12 }, (_, i) => <Star key={`s${r}${i}`} x={45 + i * 90 + (r % 2) * 45} y={1136 + r * 80} r={17} />),
      )}
      <rect x={0} y={1256} width={1080} height={22} fill={IPAL.yellow} />
      <rect x={0} y={1278} width={1080} height={14} fill={IPAL.black} />
      {/* lower register ground line + bottom border */}
      <rect x={34} y={R.clapY} width={1012} height={20} fill={IPAL.ochre} />
      <rect x={0} y={1800} width={1080} height={12} fill={IPAL.black} />
      <SvgBlocks x0={0} x1={1080} y={1830} h={30} />
      <rect x={0} y={1880} width={1080} height={40} fill={IPAL.ochre} />
      {/* glows behind lit figures */}
      {R.rowX.map((x, i) =>
        rowLit[i] > 0.01 ? (
          <ellipse key={`gr${i}`} cx={x + 10} cy={R.rowY - 11 * R.rowU} rx={130 + 14 * pulse} ry={400 + 20 * pulse} fill="url(#ibaGlow)" opacity={rowLit[i] * (0.55 + 0.25 * pulse)} />
        ) : null,
      )}
      {R.clapX.map((x, i) =>
        clapLit[i] > 0.01 ? (
          <ellipse key={`gc${i}`} cx={x + 20} cy={R.clapY - 10 * R.clapU} rx={150 + 14 * pulse} ry={290 + 16 * pulse} fill="url(#ibaGlow)" opacity={clapLit[i] * (0.55 + 0.25 * pulse)} />
        ) : null,
      )}
      {/* the painted dancers (upper) and the two clapping girls (lower) */}
      {R.rowX.map((x, i) => (
        <PaintedGirl key={`r${i}`} x={x} y={R.rowY} u={R.rowU} pose={rowPose} lit={rowLit[i]} skin={SKINS[i]} band={BANDS[i]} />
      ))}
      {R.clapX.map((x, i) => (
        <PaintedGirl key={`c${i}`} x={x} y={R.clapY} u={R.clapU} pose={clapPose} lit={clapLit[i]} skin={SKINS[5 + i]} band={BANDS[5 + i]} />
      ))}
      {/* torchlight on the wall */}
      <rect x={0} y={0} width={1080} height={1920} fill="url(#ibaTorch)" opacity={0.85 + 0.15 * fl} />
    </svg>
  );
};

/** faces of the painted figures (screen y range at zoom 1) for the caption-band check */
export const reliefFaceBands = () => [
  ...RELIEF.rowX.map(() => [RELIEF.rowY - 19.6 * RELIEF.rowU, RELIEF.rowY - 15.8 * RELIEF.rowU]),
  ...RELIEF.clapX.map(() => [RELIEF.clapY - 19.6 * RELIEF.clapU, RELIEF.clapY - 15.8 * RELIEF.clapU]),
];
