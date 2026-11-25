import React, { useMemo } from "react";
import * as THREE from "three";
import { Part, box, circle, cyl, rbox, sphere, torusArc } from "./parts";
import { clamp } from "./anim";
import { mixC } from "./zander";

// Set pieces for FactWaffarha (videos/waffarha-story): a night living room with a couch, a small night street of offer
// buildings, a padel court, the Obour map. World units: a Blocky person is ~2.65 tall; Mr. Coin (overlay) reads ~2.

export type V3 = [number, number, number];

export const WPAL = {
  night: "#0E1220",
  wall: "#23293A",
  wallTrim: "#1A1F2C",
  floor: "#3A2C24",
  rug: "#2E3A55",
  couch: "#4A5370",
  couchDark: "#3A4259",
  cushion: "#56617F",
  wood: "#6B4A33",
  orange: "#FF7A1A",
  lime: "#D6FF3C",
  asphalt: "#22252C",
  walk: "#3A3E47",
  curb: "#575C66",
  lamp: "#FFC77A",
  dark: "#151821",
  winOff: "#1C2232",
  winOn: "#FFD58A",
  court: "#2F6FE0",
  courtOff: "#18305C",
  glass: "#BFE3FF",
  metal: "#2A2F38",
  mapDark: "#232A3B",
  mapEdge: "#4A5570",
};

// ---------------------------------------------------------------- the room (back wall at z -1.6, couch centred on x 0)
export const ROOM_ZB = -1.6;
/** the seat Mr. Coin sits on: top 0.5, front edge z 0.35 */
export const SEAT: V3 = [0, 0.5, 0.35];

export const Couch: React.FC<{ glow: string; g: number }> = ({ glow, g }) => {
  const W = 4.6;
  const col = mixC(WPAL.couch, glow, 0.12 * g);
  const cush = mixC(WPAL.cushion, glow, 0.16 * g);
  return (
    <group>
      {/* base, seat cushions (3), back cushions, arms, little feet */}
      <Part geo={rbox(W, 0.36, 1.2, 0.08)} color={WPAL.couchDark} position={[0, 0.24, -0.25]} />
      {[-1, 0, 1].map((k) => (
        <Part key={`s${k}`} geo={rbox(1.42, 0.2, 1.08, 0.08)} color={cush} position={[k * 1.46, 0.41, -0.2]} />
      ))}
      <Part geo={rbox(W, 1.35, 0.42, 0.12)} color={col} position={[0, 0.9, -0.95]} />
      {[-1, 0, 1].map((k) => (
        <Part key={`b${k}`} geo={rbox(1.4, 0.82, 0.26, 0.12)} color={cush} position={[k * 1.46, 1.05, -0.66]} rotation={[-0.12, 0, 0]} />
      ))}
      {[-1, 1].map((k) => (
        <Part key={`a${k}`} geo={rbox(0.42, 0.95, 1.36, 0.14)} color={col} position={[k * (W / 2 + 0.05), 0.5, -0.3]} />
      ))}
      {[-1, 1].map((kx) => [-1, 1].map((kz) => <Part key={`f${kx}${kz}`} geo={cyl(0.06, 0.05, 0.12, 8)} color={WPAL.wood} position={[kx * 2.3, 0.06, -0.3 + kz * 0.5]} />))}
      {/* a throw pillow on each end */}
      <Part geo={rbox(0.6, 0.55, 0.2, 0.1)} color="#C46A3A" position={[-1.75, 0.82, -0.55]} rotation={[-0.2, 0.25, 0.1]} />
      <Part geo={rbox(0.6, 0.55, 0.2, 0.1)} color="#3F7F7A" position={[1.75, 0.82, -0.55]} rotation={[-0.2, -0.25, -0.1]} />
    </group>
  );
};

export const Room: React.FC<{ glow: string; g: number; frame: number }> = ({ glow, g, frame }) => {
  const zb = ROOM_ZB;
  const wall = mixC(WPAL.wall, glow, 0.1 * g);
  return (
    <group>
      {/* floor, rug, back wall, skirting */}
      <Part geo={box(16, 0.1, 12)} color={WPAL.floor} position={[0, -0.05, zb + 6]} shadow={false} />
      <Part geo={rbox(6.4, 0.03, 3.4, 0.01)} color={mixC(WPAL.rug, glow, 0.1 * g)} position={[0, 0.015, 1.3]} shadow={false} />
      <Part geo={box(16, 14, 0.2)} color={wall} position={[0, 7, zb - 0.1]} shadow={false} />
      <Part geo={box(16, 0.22, 0.06)} color={WPAL.wallTrim} position={[0, 0.11, zb + 0.03]} shadow={false} />
      {/* the halo the floating screen throws on the wall */}
      <Part geo={circle(3.4, 40)} color={glow} basic opacity={0.06 + 0.03 * g} position={[0, 6.93, zb + 0.02]} shadow={false} />
      <Part geo={circle(2.2, 40)} color={glow} basic opacity={0.07 + 0.03 * g} position={[0, 6.93, zb + 0.03]} shadow={false} />
      {/* a tall night window on the left: dark blue sky, a moon, far lit windows */}
      <group position={[-3.35, 2.4, zb + 0.05]}>
        <Part geo={box(1.5, 3.6, 0.06)} color="#141C33" basic position={[0, 1.8, 0]} shadow={false} />
        <Part geo={circle(0.2, 20)} color="#F4EBCF" basic position={[0.3, 3.0, 0.04]} shadow={false} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Part key={i} geo={box(0.09, 0.07, 0.01)} color={i % 3 === 0 ? "#FFD58A" : "#6C7BA8"} basic position={[-0.5 + (i % 3) * 0.42, 0.4 + Math.floor(i / 3) * 0.3, 0.04]} shadow={false} />
        ))}
        <Part geo={box(1.62, 0.1, 0.12)} color="#3A3F4D" position={[0, 0, 0.05]} />
        <Part geo={box(1.62, 0.1, 0.12)} color="#3A3F4D" position={[0, 3.6, 0.05]} />
        <Part geo={box(0.08, 3.6, 0.1)} color="#3A3F4D" position={[0, 1.8, 0.06]} />
        {[-1, 1].map((k) => (
          <Part key={k} geo={box(0.08, 3.7, 0.12)} color="#3A3F4D" position={[k * 0.78, 1.8, 0.05]} />
        ))}
        {/* curtain */}
        <Part geo={rbox(0.38, 4.2, 0.12, 0.05)} color="#5A3A4A" position={[-0.92, 1.85, 0.12]} />
      </group>
      {/* floor lamp on the right, a plant on the left */}
      <group position={[3.25, 0, -0.9]}>
        <Part geo={cyl(0.28, 0.32, 0.06, 18)} color="#2B2B30" position={[0, 0.03, 0]} />
        <Part geo={cyl(0.035, 0.035, 2.5, 8)} color="#2B2B30" position={[0, 1.28, 0]} />
        <Part geo={cyl(0.3, 0.42, 0.5, 18)} color="#F2D9AA" emissive="#FFC77A" emissiveIntensity={0.9} position={[0, 2.7, 0]} />
      </group>
      <group position={[-2.95, 0, -0.9]}>
        <Part geo={cyl(0.26, 0.2, 0.5, 14)} color="#7A4A34" position={[0, 0.25, 0]} />
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          return <Part key={i} geo={sphere(0.26, 10)} color={i % 2 ? "#2F6B4E" : "#3B7F5C"} position={[Math.cos(a) * 0.18, 0.75 + (i % 3) * 0.18, Math.sin(a) * 0.12]} scale={[0.8, 1.4, 0.8]} />;
        })}
      </group>
      {/* a low table in front with a mug (steam-free), between the couch and the camera, low in frame */}
      <group position={[1.7, 0, 1.75]}>
        <Part geo={rbox(1.3, 0.08, 0.7, 0.03)} color={WPAL.wood} position={[0, 0.42, 0]} />
        {[-1, 1].map((kx) => [-1, 1].map((kz) => <Part key={`${kx}${kz}`} geo={box(0.06, 0.4, 0.06)} color="#4A3424" position={[kx * 0.56, 0.2, kz * 0.28]} />))}
        <Part geo={cyl(0.09, 0.08, 0.18, 12)} color="#E9E3D6" position={[0.3, 0.55, 0.05]} />
      </group>
      {/* a soft pulse so the room is never dead still */}
      <Part geo={sphere(0.02, 4)} color={glow} basic opacity={0.01 + 0 * frame} position={[0, -1, 0]} shadow={false} />
    </group>
  );
};

// ---------------------------------------------------------------- the street (along -z, road x ±2.4, kerbs to ±3.4)
export const ROAD = 2.4;
export const KERB = 3.4;

/** A shop / gym / studio. Built with its facade facing +z at local z 0 (group at the facade centre on the ground). */
export const Building: React.FC<{
  w: number;
  d: number;
  h: number;
  color: string;
  lit: number;
  sign: string;
  accent: string;
  door?: number; // 0 closed .. 1 open (two glass leaves)
  floors?: number;
}> = ({ w, d, h, color, lit, sign, accent, door = 0, floors = 2 }) => {
  const winC = mixC(WPAL.winOff, WPAL.winOn, lit);
  const signC = mixC("#2A2E38", sign, lit);
  const cols = Math.max(2, Math.round(w / 1.3));
  const nodes: React.ReactNode[] = [];
  // upper windows
  for (let fl = 1; fl < floors; fl++)
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      const on = clamp(lit * 3 - ((c + fl) % 3) * 0.6);
      nodes.push(<Part key={`w${fl}${c}`} geo={box(0.62, 0.8, 0.05)} color={mixC(WPAL.winOff, WPAL.winOn, on)} emissive={WPAL.winOn} emissiveIntensity={0.9 * on} position={[x, 3.5 + (fl - 1) * 1.6, 0.03]} shadow={false} />);
    }
  // ground floor: a wide lit shop window each side of the door
  for (const k of [-1, 1]) nodes.push(<Part key={`sw${k}`} geo={box(w / 2 - 1.0, 1.6, 0.05)} color={winC} emissive={accent} emissiveIntensity={0.55 * lit} position={[k * (w / 4 + 0.45), 1.15, 0.03]} shadow={false} />);
  return (
    <group>
      <Part geo={box(w, h, d)} color={color} position={[0, h / 2, -d / 2]} />
      <Part geo={box(w + 0.1, 0.2, d + 0.1)} color={mixC(color, "#000000", 0.35)} position={[0, h + 0.1, -d / 2]} />
      {nodes}
      {/* the door: two leaves that swing in */}
      <Part geo={box(1.5, 2.3, 0.04)} color="#0C0E14" position={[0, 1.15, 0.01]} shadow={false} />
      {[-1, 1].map((k) => (
        <group key={`d${k}`} position={[k * 0.75, 0, 0.04]} rotation={[0, k * -1.4 * door, 0]}>
          <Part geo={box(0.72, 2.25, 0.05)} color={mixC("#26303F", "#9FD0FF", 0.25 + 0.35 * lit)} opacity={0.9} position={[-k * 0.37, 1.13, 0]} shadow={false} />
          <Part geo={box(0.04, 0.5, 0.06)} color="#C9CED6" position={[-k * 0.66, 1.15, 0.04]} />
        </group>
      ))}
      {/* the sign band over the ground floor + a varsity stripe under it */}
      <Part geo={box(w - 0.4, 0.62, 0.14)} color={signC} emissive={sign} emissiveIntensity={0.85 * lit} position={[0, 2.62, 0.08]} shadow={false} />
      <Part geo={box(w, 0.1, 0.06)} color={mixC("#3A3F4A", accent, lit)} emissive={accent} emissiveIntensity={0.6 * lit} position={[0, 2.22, 0.05]} shadow={false} />
    </group>
  );
};

export const StreetLamp: React.FC<{ position: V3; side: 1 | -1 }> = ({ position, side }) => (
  <group position={position}>
    <Part geo={cyl(0.07, 0.09, 4.2, 8)} color="#30343C" position={[0, 2.1, 0]} />
    <Part geo={box(0.9, 0.08, 0.08)} color="#30343C" position={[side * 0.42, 4.15, 0]} />
    <Part geo={rbox(0.42, 0.14, 0.24, 0.04)} color={WPAL.lamp} emissive={WPAL.lamp} emissiveIntensity={1.2} position={[side * 0.82, 4.06, 0]} />
  </group>
);

export const Tree: React.FC<{ position: V3; s?: number }> = ({ position, s = 1 }) => (
  <group position={position} scale={s}>
    <Part geo={cyl(0.12, 0.16, 1.4, 8)} color="#4A3527" position={[0, 0.7, 0]} />
    <Part geo={sphere(0.9, 12)} color="#24493A" position={[0, 2.0, 0]} />
    <Part geo={sphere(0.6, 10)} color="#2D5A47" position={[0.35, 2.5, 0.1]} />
  </group>
);

// ---------------------------------------------------------------- padel court (centre at its group origin, long side along z)
export const COURT = { w: 8, l: 14, glassH: 2.3 };

export const Racket: React.FC<{ color?: string }> = ({ color = "#FF5B5B" }) => (
  <group rotation={[0.3, 0, 0]}>
    <Part geo={cyl(0.035, 0.04, 0.32, 8)} color="#1E1E22" position={[0, -0.05, 0]} />
    <Part geo={rbox(0.36, 0.42, 0.06, 0.16)} color={color} position={[0, -0.38, 0]} />
    <Part geo={rbox(0.26, 0.3, 0.07, 0.12)} color="#F2F2F2" position={[0, -0.39, 0]} />
  </group>
);

export const PadelCourt: React.FC<{ lit: number }> = ({ lit }) => {
  const { w, l, glassH } = COURT;
  const floor = mixC(WPAL.courtOff, WPAL.court, lit);
  const line = mixC("#5A6A86", "#FFFFFF", lit);
  const nodes: React.ReactNode[] = [];
  // white lines: border, service lines 3 from the net... (simple set)
  const L = (x: number, z: number, lw: number, ll: number, k: string) => nodes.push(<Part key={k} geo={box(lw, 0.012, ll)} color={line} basic position={[x, 0.07, z]} shadow={false} />);
  L(0, 0, w, 0.08, "ln");
  for (const s of [-1, 1]) {
    L(0, s * 3.3, w, 0.08, `sv${s}`);
    L(0, s * 1.65, 0.08, 3.3, `c${s}`);
    L(s * (w / 2 - 0.05), 0, 0.08, l, `side${s}`);
    L(0, s * (l / 2 - 0.05), w, 0.08, `end${s}`);
  }
  // glass: both ends full, the sides glass for 2.4 from each end, mesh fence in the middle (lower)
  const glass = (x: number, z: number, gw: number, rotY: number, h: number, op: number, k: string) =>
    nodes.push(<Part key={k} geo={box(gw, h, 0.04)} color={WPAL.glass} opacity={op} emissive={WPAL.glass} emissiveIntensity={0.1 * lit} position={[x, h / 2 + 0.06, z]} rotation={[0, rotY, 0]} shadow={false} />);
  for (const s of [-1, 1]) {
    glass(0, s * (l / 2), w, 0, glassH, 0.16, `ge${s}`);
    for (const e of [-1, 1]) glass(s * (w / 2), e * (l / 2 - 1.2), 2.4, Math.PI / 2, glassH, 0.16, `gs${s}${e}`);
    glass(s * (w / 2), 0, l - 4.8, Math.PI / 2, 1.6, 0.08, `gm${s}`);
  }
  // posts + top rails
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 4; i++) nodes.push(<Part key={`pe${s}${i}`} geo={box(0.07, glassH + 0.1, 0.07)} color={WPAL.metal} position={[-w / 2 + (w / 4) * i, (glassH + 0.1) / 2, s * (l / 2)]} />);
    for (let i = 0; i <= 7; i++) nodes.push(<Part key={`ps${s}${i}`} geo={box(0.07, glassH + 0.1, 0.07)} color={WPAL.metal} position={[s * (w / 2), (glassH + 0.1) / 2, -l / 2 + (l / 7) * i]} />);
    nodes.push(<Part key={`re${s}`} geo={box(w, 0.07, 0.07)} color={WPAL.metal} position={[0, glassH + 0.1, s * (l / 2)]} />);
    nodes.push(<Part key={`rs${s}`} geo={box(0.07, 0.07, l)} color={WPAL.metal} position={[s * (w / 2), glassH + 0.1, 0]} />);
  }
  return (
    <group>
      <Part geo={box(w + 1.6, 0.05, l + 1.6)} color="#1C2029" position={[0, 0.025, 0]} shadow={false} />
      <Part geo={box(w, 0.06, l)} color={floor} emissive={WPAL.court} emissiveIntensity={0.25 * lit} position={[0, 0.06, 0]} shadow={false} />
      {nodes}
      {/* the net */}
      {[-1, 1].map((s) => (
        <Part key={`np${s}`} geo={cyl(0.04, 0.04, 0.95, 8)} color={WPAL.metal} position={[s * (w / 2 - 0.05), 0.5, 0]} />
      ))}
      <Part geo={box(w - 0.1, 0.8, 0.02)} color="#101216" opacity={0.6} position={[0, 0.5, 0]} shadow={false} />
      <Part geo={box(w - 0.1, 0.07, 0.04)} color="#F2F2F2" position={[0, 0.92, 0]} />
    </group>
  );
};

/** The lime ring that marks the free 4th spot on the court. */
export const SpotRing: React.FC<{ position: V3; op: number; pulse: number }> = ({ position, op, pulse }) =>
  op <= 0.001 ? null : (
    <group position={position} rotation={[-Math.PI / 2, 0, 0]} scale={1 + 0.08 * pulse}>
      <Part geo={circle(0.75, 32)} color={WPAL.lime} basic opacity={0.22 * op} shadow={false} />
      <Part geo={torusArc(0.75, 0.05, Math.PI * 2)} color={WPAL.lime} basic opacity={op} shadow={false} />
    </group>
  );

// ---------------------------------------------------------------- the map (flat districts around the town)
export type District = { pts: [number, number][]; label: [number, number] };
/** Obour (the town sits inside it) and the dark districts around it (x, z) */
export const OBOUR: District = {
  pts: [
    [-26, 22], [-8, 26], [14, 22], [22, 4], [20, -24], [10, -42], [-8, -46], [-22, -36], [-28, -10],
  ],
  label: [-2, -36],
};
export const OTHERS: District[] = [
  { pts: [[-28, -10], [-22, -36], [-8, -46], [-14, -80], [-50, -74], [-56, -30], [-44, -6]], label: [-24, -56] },
  { pts: [[-8, -46], [10, -42], [20, -24], [40, -40], [36, -86], [-14, -80]], label: [8, -70] },
  { pts: [[20, -24], [22, 4], [48, 8], [62, -20], [40, -40]], label: [28, -48] },
  { pts: [[40, -40], [62, -20], [80, -60], [70, -110], [36, -86]], label: [38, -96] },
  { pts: [[-14, -80], [36, -86], [70, -110], [30, -140], [-30, -136], [-50, -74]], label: [2, -112] },
  { pts: [[-50, -74], [-30, -136], [-80, -120], [-90, -60], [-56, -30]], label: [-34, -102] },
  { pts: [[-28, -10], [-26, 22], [-50, 26], [-62, -4], [-44, -6], [-56, -30]], label: [-44, 6] },
  { pts: [[-26, 22], [-8, 26], [14, 22], [22, 4], [48, 8], [40, 50], [-40, 50], [-50, 26]], label: [0, 40] },
];

const shapeGeo = (pts: [number, number][], grow = 0) => {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const sh = new THREE.Shape();
  pts.forEach(([x, z], i) => {
    const gx = x + (x - cx) * grow;
    const gz = z + (z - cz) * grow;
    // the shape is drawn in (x, -z) and laid flat with rotation -90° about x, so world z = shape -y... use y = -z
    if (i === 0) sh.moveTo(gx, -gz);
    else sh.lineTo(gx, -gz);
  });
  sh.closePath();
  return new THREE.ShapeGeometry(sh);
};

export const MapDistricts: React.FC<{ show: number; obour: number }> = ({ show, obour }) => {
  const geos = useMemo(() => ({ ob: shapeGeo(OBOUR.pts), obIn: shapeGeo(OBOUR.pts, -0.02), others: OTHERS.map((d) => ({ out: shapeGeo(d.pts), inn: shapeGeo(d.pts, -0.04) })) }), []);
  if (show <= 0.001) return null;
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {geos.others.map((g, i) => (
        <group key={i}>
          <mesh geometry={g.out} position={[0, 0, -0.06]}>
            <meshBasicMaterial color={WPAL.mapEdge} transparent opacity={show} toneMapped={false} />
          </mesh>
          <mesh geometry={g.inn} position={[0, 0, -0.05]}>
            <meshBasicMaterial color={WPAL.mapDark} transparent opacity={show} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh geometry={geos.ob} position={[0, 0, -0.045]}>
        <meshBasicMaterial color={mixC(WPAL.mapEdge, WPAL.lime, obour)} transparent opacity={show} toneMapped={false} />
      </mesh>
      <mesh geometry={geos.obIn} position={[0, 0, -0.04]}>
        <meshBasicMaterial color={mixC("#232A3B", "#4F5E1C", obour)} transparent opacity={show} toneMapped={false} />
      </mesh>
    </group>
  );
};

/** The map pin: a lime head on a white stem, standing on (0,0,0) */
export const Pin: React.FC<{ drop: number; s?: number; pulse: number }> = ({ drop, s = 1, pulse }) => (
  <group scale={s}>
    <group position={[0, drop, 0]}>
      <Part geo={sphere(1.3, 24)} color={WPAL.lime} emissive={WPAL.lime} emissiveIntensity={0.5} position={[0, 4.2, 0]} />
      <Part geo={sphere(0.5, 16)} color="#0E0F12" position={[0, 4.25, 1.05]} scale={[1, 1, 0.4]} />
      <Part geo={cyl(1.05, 0.05, 3.2, 20)} color={WPAL.lime} emissive={WPAL.lime} emissiveIntensity={0.4} position={[0, 2.3, 0]} />
    </group>
    {drop < 0.5 && (
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} scale={1 + 1.6 * pulse}>
        <Part geo={torusArc(1.4, 0.12, Math.PI * 2)} color={WPAL.lime} basic opacity={clamp(1 - pulse)} shadow={false} />
      </group>
    )}
  </group>
);
