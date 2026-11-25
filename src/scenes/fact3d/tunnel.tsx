import React from "react";
import { Part, box, circle, cyl, rbox, sphere, torusArc } from "./parts";
import { clamp, hash } from "./anim";
import { mixC } from "./zander";
import { WPAL } from "./waffarha";

// Set pieces for FactTunnel (videos/waffarha-tunnel): the warm offer tunnel (food, delivery, outings with % tags), the
// locked gym gate (chains, padlocks, a dumbbell sign), open shops vs dark locked venues, the lime gym front the shards
// build, venue gates that open, a five-a-side pitch. World: the track runs along -z, a Blocky person is ~2.65 tall.

export type V3 = [number, number, number];

export const TPAL = {
  warmBg: "#1C0A08",
  warmFog: "#22100B",
  rib: "#FF6A1A",
  ribDark: "#5A2412",
  red: "#E8332A",
  amber: "#FFB23F",
  floor: "#2A1712",
  limeBg: "#08130E",
  limeFog: "#0C1A12",
  lime: WPAL.lime,
  limeDark: "#2E3A12",
  limeFloor: "#14201A",
  steel: "#3B3F48",
  steelLight: "#6A707C",
  brass: "#E2B341",
  grey: "#3A3B42",
  greyDark: "#26272D",
  ink: "#0E0F12",
};

// ---------------------------------------------------------------- the «%» tag (geometry, not text)
export const PercentTag: React.FC<{ color?: string; ink?: string; s?: number; spin?: number; position?: V3; glow?: number }> = ({ color = TPAL.red, ink = "#FFFFFF", s = 1, spin = 0, position, glow = 0.5 }) => (
  <group position={position} rotation={[0, spin, 0]} scale={s}>
    <Part geo={cyl(0.36, 0.36, 0.08, 28)} color={color} emissive={color} emissiveIntensity={glow} rotation={[Math.PI / 2, 0, 0]} shadow={false} />
    {[1, -1].map((side) => (
      <group key={side} position={[0, 0, side * 0.046]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
        <Part geo={torusArc(0.07, 0.028, Math.PI * 2)} color={ink} basic position={[-0.12, 0.12, 0]} shadow={false} />
        <Part geo={torusArc(0.07, 0.028, Math.PI * 2)} color={ink} basic position={[0.12, -0.12, 0]} shadow={false} />
        <Part geo={box(0.055, 0.46, 0.02)} color={ink} basic rotation={[0, 0, -Math.PI / 4]} shadow={false} />
      </group>
    ))}
  </group>
);

// ---------------------------------------------------------------- the offers that fly past (each ~0.8 across)
export type ItemKind = 0 | 1 | 2 | 3 | 4; // burger, coffee, delivery bag, cinema ticket, pizza box
export const Burger: React.FC = () => (
  <group>
    <Part geo={sphere(0.36, 16)} color="#D9913F" position={[0, 0.1, 0]} scale={[1, 0.55, 1]} />
    <Part geo={cyl(0.38, 0.38, 0.06, 18)} color="#5BB04A" position={[0, -0.02, 0]} />
    <Part geo={cyl(0.36, 0.36, 0.13, 18)} color="#6A3A22" position={[0, -0.11, 0]} />
    <Part geo={cyl(0.39, 0.37, 0.04, 18)} color="#FFC93A" position={[0, -0.04, 0]} />
    <Part geo={cyl(0.35, 0.33, 0.12, 18)} color="#D9913F" position={[0, -0.24, 0]} />
  </group>
);
export const Coffee: React.FC = () => (
  <group>
    <Part geo={cyl(0.24, 0.17, 0.62, 18)} color="#F4EDE2" />
    <Part geo={cyl(0.25, 0.25, 0.2, 18)} color="#8A4F2A" position={[0, 0.02, 0]} />
    <Part geo={cyl(0.27, 0.26, 0.07, 18)} color="#3A2A22" position={[0, 0.34, 0]} />
  </group>
);
export const Bag: React.FC = () => (
  <group>
    <Part geo={rbox(0.62, 0.62, 0.42, 0.06)} color={TPAL.rib} />
    <Part geo={rbox(0.5, 0.16, 0.44, 0.03)} color="#FFE2C4" position={[0, 0.05, 0]} />
    <Part geo={torusArc(0.15, 0.03, Math.PI)} color="#2A1A12" position={[0, 0.31, 0]} />
  </group>
);
export const Ticket: React.FC = () => (
  <group>
    <Part geo={rbox(0.8, 0.42, 0.05, 0.03)} color="#F7C23A" />
    <Part geo={box(0.04, 0.38, 0.06)} color="#B4501E" position={[0.2, 0, 0]} />
    <Part geo={box(0.32, 0.06, 0.06)} color="#B4501E" position={[-0.12, 0.08, 0]} />
    <Part geo={box(0.32, 0.06, 0.06)} color="#B4501E" position={[-0.12, -0.06, 0]} />
  </group>
);
export const PizzaBox: React.FC = () => (
  <group>
    <Part geo={box(0.8, 0.12, 0.8)} color="#E9D2A6" />
    <Part geo={circle(0.24, 18)} color="#D9332A" basic position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]} shadow={false} />
    <Part geo={box(0.5, 0.01, 0.06)} color="#FFF4DD" basic position={[0, 0.064, 0]} rotation={[0, 0.6, 0]} shadow={false} />
  </group>
);
export const Item: React.FC<{ kind: number }> = ({ kind }) => {
  const k = ((kind % 5) + 5) % 5;
  return k === 0 ? <Burger /> : k === 1 ? <Coffee /> : k === 2 ? <Bag /> : k === 3 ? <Ticket /> : <PizzaBox />;
};

/** an offer flying by: the item tumbling slowly + its spinning «%» tag */
export const FlyItem: React.FC<{ kind: number; position: V3; t: number; seed: number; s?: number; tag?: string; tagInk?: string }> = ({ kind, position, t, seed, s = 1, tag = TPAL.red, tagInk }) => (
  <group position={position} scale={s}>
    <group rotation={[0.4 * Math.sin(t * 1.3 + seed), t * (0.8 + hash(seed) * 0.8) + seed, 0.3 * Math.cos(t * 1.1 + seed)]}>
      <Item kind={kind} />
    </group>
    <PercentTag position={[0.5, 0.55, 0]} s={0.75} spin={t * 4 + seed} color={tag} ink={tagInk} />
  </group>
);

// ---------------------------------------------------------------- the track (a road + glowing ribs, open sides)
export const Rib: React.FC<{ color: string; dark: string; z: number; w?: number; h?: number; glow?: number }> = ({ color, dark, z, w = 9, h = 6.2, glow = 1 }) => (
  <group position={[0, 0, z]}>
    {[-1, 1].map((k) => (
      <React.Fragment key={k}>
        <Part geo={box(0.32, h, 0.32)} color={dark} position={[k * w / 2, h / 2, 0]} shadow={false} />
        <Part geo={box(0.08, h, 0.34)} color={color} emissive={color} emissiveIntensity={1.2 * glow} position={[k * (w / 2 - 0.17), h / 2, 0]} shadow={false} />
      </React.Fragment>
    ))}
    <Part geo={box(w + 0.32, 0.32, 0.32)} color={dark} position={[0, h, 0]} shadow={false} />
    <Part geo={box(w, 0.08, 0.34)} color={color} emissive={color} emissiveIntensity={1.2 * glow} position={[0, h - 0.17, 0]} shadow={false} />
  </group>
);

export const TrackFloor: React.FC<{ z0: number; z1: number; color: string; edge: string; dash: string }> = ({ z0, z1, color, edge, dash }) => {
  const len = z0 - z1;
  const zc = (z0 + z1) / 2;
  const dashes: React.ReactNode[] = [];
  for (let z = z0 - 2; z > z1 + 1; z -= 4) dashes.push(<Part key={z} geo={box(0.16, 0.02, 1.6)} color={dash} basic position={[0, 0.02, z]} shadow={false} />);
  return (
    <group>
      <Part geo={box(6, 0.1, len)} color={color} position={[0, -0.05, zc]} shadow={false} />
      {[-1, 1].map((k) => (
        <Part key={k} geo={box(0.14, 0.06, len)} color={edge} emissive={edge} emissiveIntensity={1.4} position={[k * 3, 0.03, zc]} shadow={false} />
      ))}
      {dashes}
    </group>
  );
};

/** a discount gate across the track: two panels with a big «%» slide apart (open 0..1) */
export const DiscountGate: React.FC<{ z: number; open: number; color?: string }> = ({ z, open, color = TPAL.red }) => {
  const W = 7.2;
  const H = 5.6;
  return (
    <group position={[0, 0, z]}>
      {[-1, 1].map((k) => (
        <React.Fragment key={k}>
          <Part geo={box(0.4, H, 0.4)} color={TPAL.ribDark} position={[k * (W / 2 + 0.2), H / 2, 0]} shadow={false} />
          <group position={[k * (W / 4 + open * (W / 2 + 0.6)), H / 2 + 0.1, 0]}>
            <Part geo={box(W / 2 - 0.05, H - 0.3, 0.12)} color={color} emissive={color} emissiveIntensity={0.35} opacity={0.92} shadow={false} />
            <PercentTag position={[0, 0.2, 0.1]} s={2.4} color={TPAL.amber} ink={TPAL.ink} glow={0.6} />
          </group>
        </React.Fragment>
      ))}
      <Part geo={box(W + 1.2, 0.5, 0.45)} color={TPAL.ribDark} position={[0, H + 0.25, 0]} shadow={false} />
      <Part geo={box(W + 0.8, 0.12, 0.48)} color={TPAL.amber} emissive={TPAL.amber} emissiveIntensity={1.2} position={[0, H + 0.1, 0]} shadow={false} />
    </group>
  );
};

// ---------------------------------------------------------------- the locked gym gate (facade at local z 0, facing +z)
export const GATE = { w: 4.0, doorH: 4.4, signY: 5.95 };

const Chain: React.FC<{ a: [number, number]; b: [number, number]; z: number; color?: string }> = ({ a, b, z, color = "#9AA0AA" }) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const n = Math.floor(len / 0.15);
  return (
    <group position={[a[0], a[1], z]} rotation={[0, 0, Math.atan2(dy, dx)]}>
      {Array.from({ length: n }, (_, i) => (
        <Part key={i} geo={torusArc(0.085, 0.026, Math.PI * 2)} color={color} rough={0.35} position={[i * 0.15 + 0.07, 0, 0]} rotation={[i % 2 ? Math.PI / 2 : 0, 0, 0]} scale={[1.3, 1, 1]} shadow={false} />
      ))}
    </group>
  );
};

/** a padlock hanging from its shackle top (the group origin); swing = radians */
export const Padlock: React.FC<{ position?: V3; swing?: number; s?: number; color?: string; lime?: number }> = ({ position, swing = 0, s = 1, color = TPAL.brass, lime = 0 }) => (
  <group position={position} rotation={[0, 0, swing]} scale={s}>
    <Part geo={torusArc(0.15, 0.045, Math.PI)} color="#C9CED6" rough={0.3} position={[0, -0.16, 0]} />
    {[-1, 1].map((k) => (
      <Part key={k} geo={cyl(0.045, 0.045, 0.12, 8)} color="#C9CED6" position={[k * 0.15, -0.22, 0]} />
    ))}
    <Part geo={rbox(0.5, 0.44, 0.2, 0.06)} color={mixC(color, TPAL.lime, lime)} emissive={TPAL.lime} emissiveIntensity={lime} rough={0.4} position={[0, -0.5, 0]} />
    <Part geo={cyl(0.05, 0.05, 0.03, 10)} color={TPAL.ink} position={[0, -0.5, 0.11]} rotation={[Math.PI / 2, 0, 0]} />
    <Part geo={box(0.03, 0.1, 0.03)} color={TPAL.ink} position={[0, -0.57, 0.11]} />
  </group>
);

/** a big dumbbell icon (lying along x), glowing */
export const GlowDumbbell: React.FC<{ color: string; glow: number; position?: V3; s?: number }> = ({ color, glow, position, s = 1 }) => (
  <group position={position} scale={s}>
    <Part geo={cyl(0.07, 0.07, 1.6, 12)} color="#C9CED6" rotation={[0, 0, Math.PI / 2]} />
    {[1, -1].map((k) => (
      <React.Fragment key={k}>
        <Part geo={cyl(0.36, 0.36, 0.22, 20)} color={color} emissive={color} emissiveIntensity={glow} rotation={[0, 0, Math.PI / 2]} position={[k * 0.55, 0, 0]} />
        <Part geo={cyl(0.27, 0.27, 0.16, 20)} color={color} emissive={color} emissiveIntensity={glow} rotation={[0, 0, Math.PI / 2]} position={[k * 0.75, 0, 0]} />
      </React.Fragment>
    ))}
  </group>
);

/** a turnstile (waist-high post + three arms), facing +z */
export const Turnstile: React.FC<{ position?: V3; color?: string; spin?: number }> = ({ position, color = TPAL.steelLight, spin = 0 }) => (
  <group position={position}>
    <Part geo={rbox(0.5, 1.1, 0.5, 0.08)} color={TPAL.steel} position={[0, 0.55, 0]} />
    <group position={[0, 1.0, 0.28]} rotation={[0, 0, spin]}>
      {[0, 1, 2].map((i) => (
        <Part key={i} geo={cyl(0.04, 0.04, 0.8, 8)} color={color} rough={0.3} rotation={[0, 0, (i * Math.PI * 2) / 3]} position={[Math.sin((i * Math.PI * 2) / 3) * -0.4, Math.cos((i * Math.PI * 2) / 3) * 0.4, 0]} />
      ))}
    </group>
  </group>
);

/** The gym, locked: a dark block, two steel doors, chains in an X, padlocks, a turnstile, a dumbbell sign.
 *  lime 0..1: the lime wave lights it just before it breaks. */
export const GymGate: React.FC<{ f: number; lime: number; sway: number }> = ({ f, lime, sway }) => {
  const { w, doorH, signY } = GATE;
  const doorC = mixC("#4A4E58", "#6F8A2A", lime);
  return (
    <group>
      <Part geo={box(6.6, 7.4, 4)} color={mixC("#2B1C19", "#20280F", lime)} position={[0, 3.7, -2.05]} />
      {/* frame */}
      {[-1, 1].map((k) => (
        <Part key={`p${k}`} geo={box(0.38, doorH + 0.3, 0.42)} color={TPAL.steel} position={[k * (w / 2 + 0.19), (doorH + 0.3) / 2, 0.05]} />
      ))}
      <Part geo={box(w + 0.76, 0.38, 0.42)} color={TPAL.steel} position={[0, doorH + 0.15, 0.05]} />
      {/* the doors: steel with horizontal rails */}
      {[-1, 1].map((k) => (
        <group key={`d${k}`} position={[k * (w / 4 + 0.01), doorH / 2, 0.05]}>
          <Part geo={box(w / 2 - 0.04, doorH - 0.02, 0.14)} color={doorC} emissive={TPAL.lime} emissiveIntensity={0.5 * lime} rough={0.55} />
          {[-1.4, -0.45, 0.5, 1.45].map((y) => (
            <Part key={y} geo={box(w / 2 - 0.3, 0.14, 0.06)} color={TPAL.steelLight} position={[0, y, 0.09]} />
          ))}
          <Part geo={box(0.08, 0.7, 0.1)} color="#C9CED6" position={[-k * 0.75, 0.05, 0.12]} />
        </group>
      ))}
      {/* chains in an X + padlocks */}
      <Chain a={[-1.75, 4.15]} b={[1.75, 0.55]} z={0.24} />
      <Chain a={[1.75, 4.15]} b={[-1.75, 0.55]} z={0.3} />
      <Padlock position={[0, 2.5, 0.42]} s={1.6} swing={0.12 * sway} lime={lime} />
      <Padlock position={[-1.25, 1.2, 0.36]} s={1.0} swing={0.2 * Math.sin(f * 0.09 + 1)} lime={lime} />
      <Padlock position={[1.25, 1.2, 0.36]} s={1.0} swing={0.2 * Math.sin(f * 0.08 + 2.5)} lime={lime} />
      {/* turnstiles either side, outside the door */}
      <Turnstile position={[-2.75, 0, 0.9]} />
      <Turnstile position={[2.75, 0, 0.9]} />
      {/* the sign: a dark band with a big dumbbell (the name is drawn as a DOM label on top) */}
      <Part geo={rbox(5.4, 1.6, 0.3, 0.1)} color={mixC("#3A1610", "#1A220A", lime)} position={[0, signY, 0.12]} />
      <Part geo={rbox(5.5, 1.7, 0.2, 0.1)} color={mixC(TPAL.rib, TPAL.lime, lime)} emissive={mixC(TPAL.rib, TPAL.lime, lime)} emissiveIntensity={0.9} position={[0, signY, 0.02]} />
      <GlowDumbbell color={mixC(TPAL.amber, TPAL.lime, lime)} glow={0.9} position={[-1.05, signY, 0.35]} s={1.05} />
    </group>
  );
};

// ---------------------------------------------------------------- the lime gym front the shards build (facade at z 0)
export const FRONT = { w: 7, h: 6.6, doorW: 3.0, doorH: 3.8 };
/** shard targets on the front (cell centres, door left open) and the cell size */
export const frontCells = () => {
  const cols = 9;
  const rows = 10;
  const cw = FRONT.w / cols;
  const ch = FRONT.h / rows;
  const out: V3[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = -FRONT.w / 2 + cw * (c + 0.5);
      const y = ch * (r + 0.5);
      if (Math.abs(x) < FRONT.doorW / 2 && y < FRONT.doorH) continue;
      out.push([x, y, 0.15]);
    }
  return { cells: out, cw, ch };
};
/** the gate's face cut into the same number of cells (start positions of the shards) */
export const gateCells = (n: number) => {
  const cols = 6;
  const rows = Math.ceil(n / cols);
  const cw = 4.6 / cols;
  const ch = 6.8 / rows;
  return Array.from({ length: n }, (_, i): V3 => [-2.3 + cw * ((i % cols) + 0.5), ch * (Math.floor(i / cols) + 0.5), 0.3]);
};

export const GymFront: React.FC<{ op: number; glow: number; door?: number }> = ({ op, glow, door = 0 }) => {
  if (op <= 0.001) return null;
  const { w, h, doorW, doorH } = FRONT;
  const side = (w - doorW) / 2;
  const wall = "#2C3A16";
  return (
    <group>
      {[-1, 1].map((k) => (
        <React.Fragment key={k}>
          <Part geo={box(side, doorH, 0.4)} color={wall} opacity={op} position={[k * (doorW / 2 + side / 2), doorH / 2, 0]} />
          {/* lit windows on each pillar */}
          <Part geo={box(side - 0.6, 1.6, 0.05)} color={WPAL.winOn} emissive={TPAL.lime} emissiveIntensity={0.6 * glow} opacity={op} position={[k * (doorW / 2 + side / 2), 2.0, 0.22]} shadow={false} />
        </React.Fragment>
      ))}
      <Part geo={box(w, h - doorH, 0.4)} color={wall} opacity={op} position={[0, doorH + (h - doorH) / 2, 0]} />
      {/* the sign band: lime with a dark dumbbell */}
      <Part geo={rbox(w - 0.6, 1.5, 0.2, 0.1)} color={TPAL.lime} emissive={TPAL.lime} emissiveIntensity={0.8 * glow} opacity={op} position={[0, 5.55, 0.25]} shadow={false} />
      {op > 0.5 && <GlowDumbbell color={TPAL.ink} glow={0} position={[-1.2, 5.55, 0.45]} s={1.0} />}
      {/* the door frame glows lime; light spills out of the open door */}
      <Part geo={box(doorW + 0.2, 0.14, 0.45)} color={TPAL.lime} emissive={TPAL.lime} emissiveIntensity={1.2 * glow} opacity={op} position={[0, doorH, 0.05]} shadow={false} />
      {[-1, 1].map((k) => (
        <Part key={`f${k}`} geo={box(0.14, doorH, 0.45)} color={TPAL.lime} emissive={TPAL.lime} emissiveIntensity={1.2 * glow} opacity={op} position={[k * (doorW / 2 + 0.07), doorH / 2, 0.05]} shadow={false} />
      ))}
      {door < 1 &&
        [-1, 1].map((k) => (
          <group key={`d${k}`} position={[k * (doorW / 2), 0, 0]} rotation={[0, k * -1.5 * door, 0]}>
            <Part geo={box(doorW / 2, doorH - 0.05, 0.06)} color="#9FD0FF" opacity={0.45 * op} position={[-k * (doorW / 4), doorH / 2, 0]} shadow={false} />
          </group>
        ))}
    </group>
  );
};

// ---------------------------------------------------------------- an open, lit shop / a dark, locked venue
export const ShopFront: React.FC<{ w: number; h: number; color: string; sign: string; lit: number; awning?: string; children?: React.ReactNode }> = ({ w, h, color, sign, lit, awning, children }) => {
  const d = 3;
  const glass = mixC("#1A1C22", "#FFD58A", lit);
  return (
    <group>
      <Part geo={box(w, h, d)} color={color} position={[0, h / 2, -d / 2]} />
      <Part geo={box(w + 0.1, 0.2, d + 0.1)} color={mixC(color, "#000000", 0.35)} position={[0, h + 0.1, -d / 2]} />
      {/* a wide open front, lit inside */}
      <Part geo={box(w - 0.5, 1.9, 0.05)} color={glass} emissive={WPAL.winOn} emissiveIntensity={0.8 * lit} position={[0, 1.15, 0.03]} shadow={false} />
      <Part geo={box(w - 0.4, 0.6, 0.14)} color={mixC("#2A2E38", sign, lit)} emissive={sign} emissiveIntensity={0.9 * lit} position={[0, 2.62, 0.08]} shadow={false} />
      {awning && (
        <group position={[0, 2.18, 0.45]} rotation={[0.45, 0, 0]}>
          {Array.from({ length: 6 }, (_, i) => (
            <Part key={i} geo={box((w - 0.2) / 6, 0.05, 0.9)} color={i % 2 ? "#FFF1D2" : awning} position={[-(w - 0.2) / 2 + ((w - 0.2) / 6) * (i + 0.5), 0, 0]} shadow={false} />
          ))}
        </group>
      )}
      {/* upper windows */}
      {[-1, 1].map((k) => (
        <Part key={k} geo={box(w / 2 - 0.6, 0.8, 0.05)} color={mixC(WPAL.winOff, WPAL.winOn, lit)} emissive={WPAL.winOn} emissiveIntensity={0.6 * lit} position={[k * (w / 4), Math.min(h - 0.8, 3.6), 0.03]} shadow={false} />
      ))}
      {children}
    </group>
  );
};

/** a dark fenced court with a locked gate (front fence at z 0) */
export const LockedCourt: React.FC<{ w: number; f: number }> = ({ w, f }) => {
  const d = 3.4;
  const H = 3.2;
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i <= 6; i++) nodes.push(<Part key={`p${i}`} geo={box(0.08, H, 0.08)} color="#4A4C55" position={[-w / 2 + (w / 6) * i, H / 2, 0]} />);
  return (
    <group>
      <Part geo={box(w, 0.08, d)} color="#23362C" position={[0, 0.04, -d / 2]} />
      <Part geo={box(w - 0.6, 0.02, 0.06)} color="#5A6A60" basic position={[0, 0.09, -d / 2]} shadow={false} />
      {nodes}
      <Part geo={box(w, 0.08, 0.08)} color="#4A4C55" position={[0, H, 0]} />
      {/* chain-link look: a grey see-through panel + a diagonal hatch */}
      <Part geo={box(w, H, 0.02)} color="#8A8E99" opacity={0.28} position={[0, H / 2, 0]} shadow={false} />
      {Array.from({ length: 9 }, (_, i) => (
        <Part key={`h${i}`} geo={box(0.02, H * 1.3, 0.02)} color="#7A7E88" opacity={0.6} position={[-w / 2 + 0.3 + i * ((w - 0.6) / 8), H / 2, 0.02]} rotation={[0, 0, 0.6]} shadow={false} />
      ))}
      {/* the gate in the middle: chained + padlock */}
      <Chain a={[-0.5, 1.6]} b={[0.5, 1.6]} z={0.08} />
      <Padlock position={[0, 1.62, 0.14]} s={0.9} swing={0.15 * Math.sin(f * 0.1)} color="#8A8E99" />
      {/* a goal at the back */}
      <Part geo={box(1.6, 0.06, 0.06)} color="#9A9EA8" position={[0, 1.1, -d + 0.3]} />
      {[-1, 1].map((k) => (
        <Part key={`g${k}`} geo={box(0.06, 1.1, 0.06)} color="#9A9EA8" position={[k * 0.8, 0.55, -d + 0.3]} />
      ))}
    </group>
  );
};

/** a five-a-side pitch (long side along z), green with white lines, a goal at each end */
export const PITCH = { w: 8, l: 12 };
export const Pitch: React.FC<{ lit: number }> = ({ lit }) => {
  const { w, l } = PITCH;
  const line = (x: number, z: number, lw: number, ll: number, k: string) => <Part key={k} geo={box(lw, 0.012, ll)} color="#FFFFFF" basic position={[x, 0.08, z]} shadow={false} />;
  return (
    <group>
      <Part geo={box(w + 1.2, 0.05, l + 1.2)} color="#1C2622" position={[0, 0.025, 0]} shadow={false} />
      <Part geo={box(w, 0.06, l)} color={mixC("#1F4A2C", "#2F9A4A", lit)} emissive="#2F9A4A" emissiveIntensity={0.2 * lit} position={[0, 0.06, 0]} shadow={false} />
      {[-1, 1].map((s) => line(s * (w / 2 - 0.05), 0, 0.08, l, `s${s}`))}
      {[-1, 1].map((s) => line(0, s * (l / 2 - 0.05), w, 0.08, `e${s}`))}
      {line(0, 0, w, 0.08, "mid")}
      <Part geo={torusArc(1.2, 0.035, Math.PI * 2)} color="#FFFFFF" basic position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} shadow={false} />
      {[-1, 1].map((s) => (
        <group key={`b${s}`}>
          {line(0, s * (l / 2 - 1.6), 4, 0.08, `bx${s}`)}
          {line(-2, s * (l / 2 - 0.8), 0.08, 1.6, `bl${s}`)}
          {line(2, s * (l / 2 - 0.8), 0.08, 1.6, `br${s}`)}
        </group>
      ))}
    </group>
  );
};

/** the big lime / warm % tag that pops above a venue (spring scale) */
export const PopTag: React.FC<{ position: V3; pop: number; spin: number; color?: string; ink?: string; s?: number }> = ({ position, pop, spin, color = TPAL.lime, ink = TPAL.ink, s = 1.6 }) =>
  pop <= 0.001 ? null : <PercentTag position={position} s={s * clamp(pop, 0, 1.3)} spin={spin} color={color} ink={ink} glow={0.7} />;
