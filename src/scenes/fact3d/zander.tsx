import React, { useMemo } from "react";
import * as THREE from "three";
import { PAL, Part, box, circle, cyl, rbox, sphere, torusArc } from "./parts";
import { clamp, lerp } from "./anim";
import { Flywheel } from "./titanic";

// Set pieces for FactZander (Gustav Zander's 1865 Stockholm gym -> a modern gym). Pure functions of their props.

export type V3 = [number, number, number];

export const ZPAL = {
  // the old hall
  floor: "#B07A45",
  wood: "#8A5A33",
  woodDark: "#6A4226",
  woodLight: "#C48A52",
  plaster: "#EAD9B8",
  beam: "#6E4529",
  glass: "#FFE6B0",
  frame: "#5A3A22",
  iron: "#2F2C2A",
  ironLight: "#4E4946",
  brass: "#C9A247",
  leather: "#7A3E22",
  // the modern gym
  floorM: "#3A4048",
  panelM: "#E6E9EC",
  panelFrameM: "#C9CFD6",
  plasterM: "#F4F6F8",
  glassM: "#D6F1FF",
  black: "#1E2228",
  steel: "#A9B1BA",
  lime: "#C6FF3D",
  // outside
  facade: "#D99A55",
  facadeDark: "#B97B3C",
  trim: "#EFE4CC",
  cobble: "#9A9083",
  pavement: "#BDB3A3",
  door: "#3F5A3A",
  doorDark: "#2C4229",
  plaque: "#2A2420",
  gold: "#F2C14A",
  goldDark: "#C68A12",
  skyTop: "#6FB2E2",
  skyHor: "#F4E6CF",
};

export const C = (a: string) => new THREE.Color(a);
export const mixC = (a: string, b: string, t: number) => C(a).lerp(C(b), clamp(t)).getStyle();

// ---------------------------------------------------------------- the hall (world units)
export const HALL = { x0: -8, x1: 8, zb: -38, zf: 6, h: 14 };
export const DOOR = { w: 2.5, h: 3.8 }; // centred on x 0 in the front wall
export const TRANSOM = { yb: 5.4, yt: 8.4, w: 2.2 }; // the tall window above the door (the camera leaves through it)
export const PANEL_TOP = 6.5; // the back wall is panelled up to here

// ---------------------------------------------------------------- canvas textures (greyscale patterns, tinted by the material colour)
const texCache = new Map<string, THREE.CanvasTexture>();
const canvasTex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, rx = 1, ry = 1) => {
  let t = texCache.get(key);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d") as CanvasRenderingContext2D);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 8;
    texCache.set(key, t);
  }
  return t;
};
/** Floor planks along z: light greys (multiplied by the floor colour). */
export const plankTex = () =>
  canvasTex(
    "planks",
    512,
    512,
    (g) => {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const v = 215 + Math.round(Math.sin(i * 12.9898) * 43758.5453 % 1 * 30);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect((i * 512) / n, 0, 512 / n, 512);
        g.fillStyle = "rgba(0,0,0,0.28)";
        g.fillRect((i * 512) / n, 0, 2, 512);
        // staggered butt joints
        const y = ((i * 197) % 512) | 0;
        g.fillRect((i * 512) / n, y, 512 / n, 2);
      }
    },
    4,
    10,
  );
/** Cobblestones: rounded light stones on dark joints. */
export const cobbleTex = () =>
  canvasTex(
    "cobble",
    512,
    512,
    (g) => {
      g.fillStyle = "rgb(120,120,120)";
      g.fillRect(0, 0, 512, 512);
      const rows = 12;
      for (let r = 0; r < rows; r++) {
        const h = 512 / rows;
        const off = r % 2 ? 21 : 0;
        for (let x = -42; x < 512; x += 42) {
          const v = 200 + ((r * 31 + x * 7) % 40);
          g.fillStyle = `rgb(${v},${v},${v})`;
          const rr = 9;
          const X = x + off + 3;
          const Y = r * h + 3;
          const W = 36;
          const H = h - 6;
          g.beginPath();
          g.moveTo(X + rr, Y);
          g.arcTo(X + W, Y, X + W, Y + H, rr);
          g.arcTo(X + W, Y + H, X, Y + H, rr);
          g.arcTo(X, Y + H, X, Y, rr);
          g.arcTo(X, Y, X + W, Y, rr);
          g.fill();
        }
      }
    },
    10,
    10,
  );

/** A flat textured surface (plane facing +y unless rotated). */
export const TexPlane: React.FC<{ w: number; h: number; tex: THREE.Texture; color: string; position?: V3; rotation?: V3; rough?: number }> = ({ w, h, tex, color, position, rotation, rough = 0.85 }) => (
  <mesh position={position} rotation={rotation ?? [-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[w, h]} />
    <meshStandardMaterial map={tex} color={color} roughness={rough} metalness={0} />
  </mesh>
);

// ---------------------------------------------------------------- 2-link arm IK (Blocky arm in its swing plane)
const ARM_A = 0.4;
const ARM_B = 0.42;
/** Arm angles that put the hand at (dy, dz) from the shoulder (torso frame: y up, z forward). */
export const reach = (dy: number, dz: number) => {
  let D = Math.hypot(dy, dz);
  const k = Math.min(1, (ARM_A + ARM_B - 0.002) / Math.max(1e-4, D));
  const ty = dy * k;
  const tz = dz * k;
  D = Math.hypot(ty, tz);
  const beta = Math.atan2(tz, -ty); // from straight down toward forward
  const gamma = Math.acos(clamp((ARM_A * ARM_A + D * D - ARM_B * ARM_B) / (2 * ARM_A * D), -1, 1));
  const phi1 = beta - gamma;
  const ey = -Math.cos(phi1) * ARM_A;
  const ez = Math.sin(phi1) * ARM_A;
  const phi2 = Math.atan2(tz - ez, -(ty - ey));
  return { sx: -phi1, elbow: -(phi2 - phi1) };
};
/** World -> torso frame for a lean (rotation about x). */
export const toTorso = (dy: number, dz: number, lean: number) => ({ dy: dy * Math.cos(lean) + dz * Math.sin(lean), dz: -dy * Math.sin(lean) + dz * Math.cos(lean) });

// ---------------------------------------------------------------- the lever machine (weight balls on a lever arm; the user stands at the origin facing +z
// and pumps the grip up and down at chest height)
export const ARM_PIVOT: [number, number] = [1.2, 0.95]; // [y, z]
export const ARM_RH = 0.55;
export const ARM_RB = 0.8;
export const armHandle = (theta: number): [number, number] => [ARM_PIVOT[0] + ARM_RH * Math.sin(theta), ARM_PIVOT[1] - ARM_RH * Math.cos(theta)];

export const ArmMachine: React.FC<{ theta: number }> = ({ theta }) => {
  const [py, pz] = ARM_PIVOT;
  return (
    <group>
      {/* wooden base: two rails + cross pieces, a foot board */}
      {[-1, 1].map((k) => (
        <Part key={k} geo={rbox(0.14, 0.14, 2.3, 0.03)} color={ZPAL.wood} position={[k * 0.8, 0.07, 0.65]} />
      ))}
      <Part geo={rbox(1.74, 0.12, 0.14, 0.03)} color={ZPAL.wood} position={[0, 0.07, -0.45]} />
      <Part geo={rbox(1.74, 0.12, 0.14, 0.03)} color={ZPAL.wood} position={[0, 0.07, 1.75]} />
      <Part geo={rbox(1.0, 0.06, 0.8, 0.02)} color={ZPAL.woodLight} position={[0, 0.06, 0]} />
      {/* iron uprights to the pivot */}
      {[-1, 1].map((k) => (
        <group key={`u${k}`}>
          <Part geo={rbox(0.09, py, 0.09, 0.02)} color={ZPAL.iron} rough={0.4} position={[k * 0.8, py / 2, pz]} />
          <Part geo={sphere(0.07, 10)} color={ZPAL.brass} rough={0.3} position={[k * 0.86, py, pz]} />
        </group>
      ))}
      {/* the lever: two side bars (handle back toward the user, weight balls forward) */}
      <group position={[0, py, pz]} rotation={[theta, 0, 0]}>
        {[-1, 1].map((k) => (
          <group key={`v${k}`}>
            <Part geo={rbox(0.06, 0.06, ARM_RH + ARM_RB, 0.02)} color={ZPAL.iron} rough={0.4} position={[k * 0.8, 0, (ARM_RB - ARM_RH) / 2]} />
            <Part geo={sphere(0.17, 14)} color={ZPAL.iron} rough={0.35} position={[k * 0.8, 0, ARM_RB]} />
          </group>
        ))}
        <Part geo={cyl(0.045, 0.045, 1.66, 10)} color={ZPAL.woodLight} rotation={[0, 0, Math.PI / 2]} position={[0, 0, -ARM_RH]} />
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- the saddle machine (the "horse": a rocking saddle on an iron column + flywheel)
export const SADDLE_Y = 1.22;
export const SaddleMachine: React.FC<{ rock: number; bounce: number; wheel: number }> = ({ rock, bounce, wheel }) => (
  <group>
    <Part geo={rbox(1.1, 0.08, 1.3, 0.03)} color={ZPAL.iron} rough={0.4} position={[0.1, 0.04, 0]} />
    <Part geo={cyl(0.13, 0.17, 0.95, 14)} color={ZPAL.iron} rough={0.4} position={[0, 0.5, 0]} />
    <Part geo={cyl(0.2, 0.2, 0.12, 14)} color={ZPAL.brass} rough={0.3} position={[0, 0.98, 0]} />
    <group position={[0, 1.02 + bounce, 0]} rotation={[rock, 0, 0]}>
      <Part geo={rbox(0.5, 0.16, 0.74, 0.07)} color={ZPAL.leather} position={[0, 0.1, 0]} />
      <Part geo={rbox(0.3, 0.16, 0.12, 0.05)} color={ZPAL.leather} position={[0, 0.2, 0.32]} />
      <Part geo={rbox(0.56, 0.06, 0.2, 0.03)} color="#5A2A16" position={[0, 0.08, -0.32]} />
      {/* the scrolled iron neck + grip */}
      <Part geo={torusArc(0.36, 0.045, Math.PI * 0.9)} color={ZPAL.iron} rough={0.4} rotation={[0, Math.PI / 2, 0]} position={[0, 0.42, 0.42]} />
      <Part geo={rbox(0.07, 0.62, 0.07, 0.02)} color={ZPAL.iron} rough={0.4} position={[0, 0.42, 0.62]} rotation={[-0.25, 0, 0]} />
      <Part geo={cyl(0.04, 0.04, 0.62, 10)} color={ZPAL.woodLight} rotation={[0, 0, Math.PI / 2]} position={[0, 0.74, 0.7]} />
    </group>
    {/* flywheel on the side */}
    <Part geo={rbox(0.1, 0.6, 0.1, 0.02)} color={ZPAL.iron} position={[0.62, 0.3, 0]} />
    <group position={[0.7, 0.62, 0]}>
      <Flywheel r={0.45} angle={wheel} />
    </group>
  </group>
);

// ---------------------------------------------------------------- other old machines (grid)
/** A padded bench with a crank + flywheel at its foot (+z). */
export const BenchMachine: React.FC<{ wheel: number }> = ({ wheel }) => (
  <group>
    <Part geo={rbox(0.7, 0.16, 1.7, 0.05)} color={ZPAL.leather} position={[0, 0.62, -0.1]} />
    <Part geo={rbox(0.76, 0.1, 1.8, 0.03)} color={ZPAL.wood} position={[0, 0.5, -0.1]} />
    {[-1, 1].map((kx) =>
      [-1, 1].map((kz) => <Part key={`${kx}${kz}`} geo={rbox(0.1, 0.5, 0.1, 0.02)} color={ZPAL.wood} position={[kx * 0.3, 0.25, -0.1 + kz * 0.75]} />),
    )}
    <Part geo={rbox(0.12, 1.0, 0.12, 0.03)} color={ZPAL.iron} position={[0, 0.5, 0.95]} />
    <group position={[0.18, 0.95, 0.95]}>
      <Flywheel r={0.38} angle={wheel} />
    </group>
    <Part geo={cyl(0.03, 0.03, 0.5, 8)} color={ZPAL.brass} rotation={[0, 0, Math.PI / 2]} position={[-0.15, 0.95, 0.95]} />
  </group>
);
/** A tall wooden frame with two pulleys, ropes and T-handles, a bench between the posts. */
export const FrameMachine: React.FC<{ pull: number }> = ({ pull }) => (
  <group>
    {[-1, 1].map((k) => (
      <group key={k}>
        <Part geo={rbox(0.14, 2.4, 0.14, 0.03)} color={ZPAL.wood} position={[k * 0.8, 1.2, -0.2]} />
        <Part geo={rbox(0.14, 0.12, 1.0, 0.03)} color={ZPAL.wood} position={[k * 0.8, 0.06, -0.2]} />
        <Part geo={cyl(0.13, 0.13, 0.06, 14)} color={ZPAL.brass} rotation={[0, 0, Math.PI / 2]} position={[k * 0.55, 2.22, -0.2]} />
        <Part geo={box(0.02, 0.9 + pull * 0.3, 0.02)} color="#E9DCC0" position={[k * 0.55, 2.22 - (0.9 + pull * 0.3) / 2, -0.07]} shadow={false} />
        <Part geo={rbox(0.26, 0.05, 0.05, 0.02)} color={ZPAL.woodLight} position={[k * 0.55, 1.32 - pull * 0.3, -0.07]} />
      </group>
    ))}
    <Part geo={rbox(1.9, 0.16, 0.18, 0.04)} color={ZPAL.woodDark} position={[0, 2.38, -0.2]} />
    <Part geo={rbox(1.0, 0.1, 0.45, 0.03)} color={ZPAL.woodLight} position={[0, 0.5, 0.15]} />
    {[-1, 1].map((k) => (
      <Part key={`s${k}`} geo={rbox(0.08, 0.45, 0.08, 0.02)} color={ZPAL.wood} position={[k * 0.4, 0.23, 0.15]} />
    ))}
  </group>
);

// ---------------------------------------------------------------- modern machines (rise out of the floor at the morph)
export const CableMachine: React.FC<{ stack?: number }> = ({ stack = 0 }) => (
  <group>
    <Part geo={rbox(1.3, 0.1, 1.0, 0.03)} color={ZPAL.black} position={[0, 0.05, -0.1]} />
    {[-1, 1].map((k) => (
      <Part key={k} geo={rbox(0.12, 2.5, 0.12, 0.03)} color={ZPAL.black} position={[k * 0.55, 1.25, -0.3]} />
    ))}
    <Part geo={rbox(1.24, 0.14, 0.2, 0.03)} color={ZPAL.black} position={[0, 2.5, -0.3]} />
    {Array.from({ length: 8 }, (_, i) => (
      <Part key={`p${i}`} geo={rbox(0.7, 0.1, 0.32, 0.02)} color={i < 2 ? ZPAL.lime : ZPAL.steel} rough={0.35} position={[0, 0.25 + i * 0.12 + (i >= 6 ? stack * 0.25 : 0), -0.3]} />
    ))}
    <Part geo={cyl(0.12, 0.12, 0.08, 14)} color={ZPAL.steel} rotation={[0, 0, Math.PI / 2]} position={[0, 2.3, 0.0]} />
    <Part geo={box(0.02, 1.3, 0.02)} color="#222" position={[0, 1.65, 0.05]} shadow={false} />
    <Part geo={rbox(0.4, 0.05, 0.05, 0.02)} color={ZPAL.black} position={[0, 1.0, 0.05]} />
    <Part geo={rbox(0.7, 0.1, 0.5, 0.04)} color={ZPAL.black} position={[0, 0.5, 0.45]} />
    <Part geo={rbox(0.12, 0.45, 0.12, 0.03)} color={ZPAL.steel} position={[0, 0.25, 0.45]} />
  </group>
);
export const SquatRack: React.FC = () => (
  <group>
    <Part geo={rbox(1.6, 0.06, 1.2, 0.02)} color={ZPAL.black} position={[0, 0.03, 0]} />
    {[-1, 1].map((kx) =>
      [-1, 1].map((kz) => <Part key={`${kx}${kz}`} geo={rbox(0.1, 2.4, 0.1, 0.02)} color={ZPAL.black} position={[kx * 0.7, 1.2, kz * 0.5]} />),
    )}
    {[-1, 1].map((kx) => (
      <Part key={`t${kx}`} geo={rbox(0.1, 0.1, 1.1, 0.02)} color={ZPAL.black} position={[kx * 0.7, 2.38, 0]} />
    ))}
    <Part geo={cyl(0.03, 0.03, 2.1, 10)} color={ZPAL.steel} rough={0.3} rotation={[0, 0, Math.PI / 2]} position={[0, 1.45, 0.5]} />
    {[-1, 1].map((k) => (
      <group key={`pl${k}`}>
        <Part geo={cyl(0.32, 0.32, 0.07, 22)} color={ZPAL.black} rotation={[0, 0, Math.PI / 2]} position={[k * 0.88, 1.45, 0.5]} />
        <Part geo={cyl(0.24, 0.24, 0.06, 22)} color={ZPAL.lime} rotation={[0, 0, Math.PI / 2]} position={[k * 0.96, 1.45, 0.5]} />
      </group>
    ))}
  </group>
);

// ---------------------------------------------------------------- seven-segment digits (all ten) + the 1865 plaque
const SEG10: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abcdg", "4": "bcfg", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg" };
export const Digit7: React.FC<{ d: string; color?: string; t?: number }> = ({ d, color = ZPAL.gold, t = 0.1 }) => {
  const W = 0.4;
  const H = 0.7;
  const s = SEG10[d] ?? "";
  const m = { rough: 0.3, emissive: ZPAL.goldDark, emissiveIntensity: 0.35 };
  const hz = (y: number) => <Part geo={rbox(W, t, t * 0.6, t / 2.4)} color={color} {...m} position={[0, y, 0]} />;
  const vt = (x: number, y: number) => <Part geo={rbox(t, H / 2 + t * 0.2, t * 0.6, t / 2.4)} color={color} {...m} position={[x, y, 0]} />;
  return (
    <group>
      {s.includes("a") && hz(H / 2)}
      {s.includes("g") && hz(0)}
      {s.includes("d") && hz(-H / 2)}
      {s.includes("b") && vt(W / 2, H / 4)}
      {s.includes("c") && vt(W / 2, -H / 4)}
      {s.includes("f") && vt(-W / 2, H / 4)}
      {s.includes("e") && vt(-W / 2, -H / 4)}
    </group>
  );
};
export const Plaque: React.FC<{ text: string }> = ({ text }) => (
  <group>
    <Part geo={rbox(2.5, 1.1, 0.1, 0.04)} color={ZPAL.plaque} />
    <Part geo={rbox(2.62, 0.08, 0.13, 0.03)} color={ZPAL.brass} position={[0, 0.58, 0.01]} />
    <Part geo={rbox(2.62, 0.08, 0.13, 0.03)} color={ZPAL.brass} position={[0, -0.58, 0.01]} />
    {[-1, 1].map((k) => (
      <Part key={k} geo={rbox(0.08, 1.24, 0.13, 0.03)} color={ZPAL.brass} position={[k * 1.29, 0, 0.01]} />
    ))}
    {text.split("").map((d, i) => (
      <group key={i} position={[(i - (text.length - 1) / 2) * 0.56 + (d === "1" ? -0.08 : 0), 0, 0.07]}>
        <Digit7 d={d} />
      </group>
    ))}
  </group>
);

// ---------------------------------------------------------------- clothes (Blocky chest / hipwear / headgear nodes)
/** Black suit front: white shirt V, grey waistcoat with buttons, lapels, a bow tie (torso-local). `k` 0..1 shrinks it away. */
export const SuitBowTie: React.FC<{ jacket: string; k?: number }> = ({ jacket, k = 1 }) =>
  k <= 0.001 ? null : (
    <group position={[0, 0.6, 0.252]} scale={[1, k, 1]}>
      <Part geo={box(0.36, 0.42, 0.01)} color="#55565E" position={[0, -0.05, 0]} shadow={false} />
      <Part geo={box(0.2, 0.2, 0.012)} color="#FFFFFF" position={[0, 0.1, 0.002]} shadow={false} />
      {[0, 1, 2].map((i) => (
        <Part key={`b${i}`} geo={circle(0.022, 10)} color="#D8D2C2" basic position={[0, -0.04 - i * 0.09, 0.008]} shadow={false} />
      ))}
      {[-1, 1].map((s) => (
        <Part key={s} geo={box(0.13, 0.5, 0.016)} color={jacket} position={[s * 0.2, -0.02, 0.006]} rotation={[0, 0, s * 0.3]} shadow={false} />
      ))}
      {/* bow tie */}
      <group position={[0, 0.17, 0.016]}>
        {[-1, 1].map((s) => (
          <Part key={`w${s}`} geo={rbox(0.1, 0.09, 0.03, 0.02)} color="#141418" position={[s * 0.06, 0, 0]} rotation={[0, 0, s * 0.25]} shadow={false} />
        ))}
        <Part geo={rbox(0.045, 0.05, 0.04, 0.015)} color="#26262C" position={[0, 0, 0.006]} shadow={false} />
      </group>
    </group>
  );
/** Jacket tails hanging behind the hips (hip-local), swaying with `sway`. `k` shrinks them away. */
export const JacketTails: React.FC<{ color: string; sway?: number; k?: number }> = ({ color, sway = 0, k = 1 }) =>
  k <= 0.001 ? null : (
    <group position={[0, 0.02, -0.24]} rotation={[sway, 0, 0]} scale={[1, k, 1]}>
      {[-1, 1].map((s) => (
        <Part key={s} geo={rbox(0.38, 0.62, 0.06, 0.03)} color={color} position={[s * 0.2, -0.3, 0]} rotation={[0.1, 0, s * 0.06]} />
      ))}
    </group>
  );
/** Vertical stripes on a Blocky skirt frustum (hip-local, same maths as the Blocky skirt). */
export const SkirtStripes: React.FC<{ shape: [number, number, number]; color: string; n?: number }> = ({ shape, color, n = 14 }) => {
  const [rt, rb, L] = shape;
  const tilt = Math.atan2(rb - rt, L);
  const slant = Math.hypot(rb - rt, L);
  const rm = (rt + rb) / 2 + 0.012;
  return (
    <group position={[0, 0.01 - L / 2, 0]}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <Part geo={box(0.06, slant, 0.012)} color={color} position={[0, 0, rm]} rotation={[-tilt, 0, 0]} shadow={false} />
          </group>
        );
      })}
    </group>
  );
};
export const TopHat: React.FC<{ color?: string }> = ({ color = "#1C1A1E" }) => (
  <group position={[0, 0.86, -0.02]}>
    <Part geo={cyl(0.58, 0.58, 0.05, 24)} color={color} position={[0, 0.02, 0]} />
    <Part geo={cyl(0.38, 0.4, 0.62, 24)} color={color} position={[0, 0.33, 0]} />
    <Part geo={cyl(0.405, 0.405, 0.09, 24)} color="#4A2E2E" position={[0, 0.09, 0]} />
  </group>
);
/** A full dark beard + moustache (head-local). */
export const FullBeard: React.FC<{ color?: string }> = ({ color = "#4A3222" }) => (
  <group position={[0, 0.12, 0.33]}>
    <Part geo={rbox(0.8, 0.48, 0.2, 0.09)} color={color} position={[0, -0.04, 0]} />
    <Part geo={rbox(0.5, 0.26, 0.16, 0.08)} color={color} position={[0, -0.32, -0.02]} />
    <Part geo={rbox(0.4, 0.09, 0.08, 0.03)} color={color} position={[0, 0.17, 0.09]} />
    {[-1, 1].map((k) => (
      <Part key={k} geo={rbox(0.12, 0.36, 0.3, 0.05)} color={color} position={[k * 0.39, 0.12, -0.12]} />
    ))}
  </group>
);
/** Short side-parted hair top (head-local) so the suited man is not the same as the others. */
export const SideFlick: React.FC<{ color: string }> = ({ color }) => <Part geo={rbox(0.5, 0.12, 0.3, 0.05)} color={color} position={[0.16, 0.86, 0.22]} rotation={[0, 0, -0.18]} />;

// ---------------------------------------------------------------- the photo frame (hangs from its nail at the top centre)
export const PhotoFrame: React.FC<{ tex: THREE.Texture | null; w: number; h: number; swing: number; drop: number }> = ({ tex, w, h, swing, drop }) => {
  const b = 0.12;
  const W = w + b * 2;
  const H = h + b * 2;
  return (
    <group position={[0, drop, 0]}>
      <Part geo={sphere(0.04, 8)} color={ZPAL.brass} position={[0, 0.25, 0.02]} />
      <group rotation={[0, 0, swing]}>
        {/* wire to the nail */}
        {[-1, 1].map((k) => (
          <Part key={`wi${k}`} geo={box(0.012, 0.4, 0.012)} color="#3A3A3A" position={[k * 0.18, 0.1, 0.03]} rotation={[0, 0, -k * 0.95]} shadow={false} />
        ))}
        <group position={[0, -H / 2, 0]}>
          <Part geo={rbox(W, b, 0.1, 0.03)} color={ZPAL.woodDark} position={[0, H / 2 - b / 2, 0.05]} />
          <Part geo={rbox(W, b, 0.1, 0.03)} color={ZPAL.woodDark} position={[0, -H / 2 + b / 2, 0.05]} />
          <Part geo={rbox(b, H, 0.1, 0.03)} color={ZPAL.woodDark} position={[-W / 2 + b / 2, 0, 0.05]} />
          <Part geo={rbox(b, H, 0.1, 0.03)} color={ZPAL.woodDark} position={[W / 2 - b / 2, 0, 0.05]} />
          <Part geo={box(w + 0.02, h + 0.02, 0.02)} color="#E6D7B5" position={[0, 0, 0.02]} shadow={false} />
          {tex && (
            <mesh position={[0, 0, 0.035]}>
              <planeGeometry args={[w, h]} />
              <meshBasicMaterial map={tex} toneMapped={false} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
};

/** Damped swing of a frame on its nail after it lands (radians). */
export const frameSwing = (f: number, t0: number) => {
  const t = f - t0;
  if (t < 0) return 0;
  return 0.11 * Math.exp(-t / 9) * Math.cos(t * 0.42);
};
/** Lands from a little above (the first frames are under the flash). */
export const frameDrop = (f: number, t0: number) => {
  const t = f - t0;
  if (t < 0) return 0.3;
  if (t > 6) return 0;
  return 0.3 * Math.pow(1 - t / 6, 2) - 0.03 * Math.sin((t / 6) * Math.PI);
};

// ---------------------------------------------------------------- the street lamp
export const GasLamp: React.FC<{ position?: V3 }> = ({ position }) => (
  <group position={position}>
    <Part geo={cyl(0.18, 0.24, 0.3, 12)} color={ZPAL.iron} position={[0, 0.15, 0]} />
    <Part geo={cyl(0.07, 0.09, 3.4, 10)} color={ZPAL.iron} position={[0, 1.9, 0]} />
    <Part geo={rbox(0.42, 0.55, 0.42, 0.05)} color="#FFE7A6" emissive="#FFC860" emissiveIntensity={0.6} position={[0, 3.85, 0]} />
    <Part geo={cyl(0.02, 0.32, 0.22, 4)} color={ZPAL.iron} position={[0, 4.24, 0]} rotation={[0, Math.PI / 4, 0]} />
  </group>
);

/** Tall window (face +z): frame, glass (emissive glow) and glazing bars. Local origin at the sill centre. */
export const TallWindow: React.FC<{ w: number; h: number; glass: string; glow: number; frame?: string; clear?: boolean }> = ({ w, h, glass, glow, frame = ZPAL.frame, clear }) => (
  <group>
    <Part geo={rbox(w + 0.24, 0.16, 0.24, 0.04)} color={frame} position={[0, -0.04, 0.06]} />
    <Part geo={rbox(w + 0.24, 0.16, 0.2, 0.04)} color={frame} position={[0, h + 0.04, 0.04]} />
    {[-1, 1].map((k) => (
      <Part key={k} geo={rbox(0.14, h, 0.2, 0.03)} color={frame} position={[k * (w / 2 + 0.05), h / 2, 0.04]} />
    ))}
    <Part geo={box(w, h, 0.02)} color={glass} emissive={glass} emissiveIntensity={glow} opacity={clear ? 0.25 : 1} position={[0, h / 2, 0]} shadow={false} />
    <Part geo={box(0.05, h, 0.04)} color={frame} position={[0, h / 2, 0.02]} shadow={false} />
    {Array.from({ length: Math.max(1, Math.round(h / 1.1) - 1) }, (_, i) => (
      <Part key={`h${i}`} geo={box(w, 0.05, 0.04)} color={frame} position={[0, ((i + 1) * h) / Math.round(h / 1.1), 0.02]} shadow={false} />
    ))}
  </group>
);

export const useFrozen = <T,>(make: () => T) => useMemo(make, []); // eslint-disable-line react-hooks/exhaustive-deps
export { lerp };
