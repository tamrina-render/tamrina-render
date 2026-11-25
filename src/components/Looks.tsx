import React from "react";
import { AbsoluteFill } from "remotion";
import { FONT } from "../lib/fonts";
import { backOut, clamp } from "../lib/mechanics";
import { hash, INK, setFor } from "../lib/looks";
import type { VisualProps } from "./visuals/common";

/** Game show set: one saturated colour + a same-hue pattern one step lighter, and a darker floor band with an ink line. */
export const GameShowSet: React.FC<{ index: number; t: number }> = ({ index, t }) => {
  const s = setFor(index);
  const pattern: React.CSSProperties =
    s.kind === "stripes"
      ? { backgroundImage: `repeating-linear-gradient(-45deg, ${s.pat} 0 46px, transparent 46px 92px)`, backgroundPosition: `${(t * 40) % 130}px 0` }
      : s.kind === "dots"
        ? { backgroundImage: `radial-gradient(${s.pat} 16px, transparent 17px), radial-gradient(${s.pat} 16px, transparent 17px)`, backgroundSize: "90px 90px", backgroundPosition: `0 ${(t * 24) % 90}px, 45px ${45 + ((t * 24) % 90)}px` }
        : { background: `repeating-conic-gradient(from ${(t * 14) % 360}deg at 50% 38%, ${s.pat} 0deg 11deg, transparent 11deg 22.5deg)` };
  return (
    <AbsoluteFill style={{ background: s.bg }}>
      <AbsoluteFill style={pattern} />
      {/* floor band the coin stands on */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 360, background: "rgba(0,0,0,0.22)", borderTop: `10px solid ${INK}` }} />
    </AbsoluteFill>
  );
};

/** Ink outline + hard offset shadow around a block (cards, the visual stage). No blur anywhere in this look. */
export const INK_OUTLINE = [[5, 0], [-5, 0], [0, 5], [0, -5]].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${INK})`).join(" ") + ` drop-shadow(12px 14px 0 ${INK})`;

/** Telop text: white / accent fill with a thick ink stroke painted under it + a hard drop. */
export const telop = (size: number): React.CSSProperties => ({
  WebkitTextStroke: `${Math.round(size * 0.14)}px ${INK}`,
  paintOrder: "stroke fill",
  textShadow: `0 ${Math.round(size * 0.1)}px 0 ${INK}`,
});

/** {judge}: the round's verdict word pops in centre-top with back-ease and leaves with ease-in. */
export const Judge: React.FC<{ label: string; age: number; accent: string; rtl: boolean }> = ({ label, age, accent, rtl }) => {
  const IN = 0.22, HOLD = 1.1, OUT = 0.18;
  if (age < 0 || age > IN + HOLD + OUT) return null;
  const s = age < IN ? backOut(age / IN, 1.7) : age < IN + HOLD ? 1 : 1 - Math.pow((age - IN - HOLD) / OUT, 2);
  return (
    <div style={{ position: "absolute", top: 560, left: 0, right: 0, textAlign: "center", transform: `rotate(-6deg) scale(${s.toFixed(3)})`, pointerEvents: "none", zIndex: 5 }}>
      <span style={{ fontFamily: rtl ? FONT.arabicEmph : FONT.head, fontWeight: 900, fontSize: 150, color: accent, direction: rtl ? "rtl" : "ltr", ...telop(150) }}>{label}</span>
    </div>
  );
};

/**
 * Silent film print damage over the whole frame, new every output frame (the motion under it is at 16 fps):
 * two-octave grain, broken vertical scratches, dust, a hair in the gate now and then, burnt edges, a heavy vignette.
 */
export const SilentDamage: React.FC<{ frame: number }> = ({ frame }) => {
  const scratches = [0, 1, 2].filter((k) => hash(frame * 3 + k) < 0.55).map((k) => ({
    x: 60 + hash(Math.floor(frame / 3) * 7 + k) * 960, y0: hash(frame * 5 + k) * 900, len: 300 + hash(frame * 11 + k) * 1100, light: hash(k * 13 + Math.floor(frame / 9)) > 0.4,
  }));
  const dust = Array.from({ length: 7 }, (_, k) => ({ x: hash(frame * 17 + k) * 1080, y: hash(frame * 29 + k) * 1920, r: 2 + hash(frame * 31 + k) * 7 })).filter((_, k) => hash(frame + k * 3.3) < 0.5);
  const hair = Math.floor(frame / 40) % 4 === 1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
        <filter id="silver"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 50} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="1080" height="1920" filter="url(#silver)" opacity={0.16} style={{ mixBlendMode: "overlay" }} />
        {scratches.map((s, i) => <line key={i} x1={s.x} y1={s.y0} x2={s.x + (hash(i + frame) - 0.5) * 6} y2={s.y0 + s.len} stroke={s.light ? "#f4efe2" : "#1a1612"} strokeWidth={1.4} opacity={0.55} />)}
        {dust.map((d, i) => <circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill={i % 3 ? "#120f0c" : "#f4efe2"} opacity={0.7} />)}
        {hair && <path d={`M ${300 + (frame % 40) * 0.4} 1500 q 60 -120 20 -260 q -30 -90 40 -170`} stroke="#120f0c" strokeWidth={2.2} fill="none" opacity={0.6} />}
      </svg>
      {/* burnt edges + vignette + a rounded aperture */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 72% 58% at 50% 50%, rgba(0,0,0,0) 52%, rgba(40,22,8,0.45) 82%, rgba(0,0,0,0.85) 100%)" }} />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 0 26px #050403, inset 0 0 60px 40px rgba(0,0,0,0.8)", borderRadius: 60 }} />
    </AbsoluteFill>
  );
};

/** Silent film screen: a pale silver print with the projector's hot spot in the middle (the print filter greys it). */
export const SilentScreen: React.FC = () => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 60% at 50% 45%, #e4ddcd 0%, #b9b1a1 55%, #6f685d 100%)" }} />
);

/** Iris: black frame with a round hole of radius r (px, on 1080 x 1920) around (x, y). */
export const Iris: React.FC<{ r: number; x?: number; y?: number }> = ({ r, x = 540, y = 1000 }) =>
  r >= 1150 ? null : (
    <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(circle ${Math.max(0, r).toFixed(0)}px at ${x}px ${y}px, rgba(0,0,0,0) 97%, #050403 100%)`, zIndex: 6 }} />
  );

/**
 * Intertitle card (silent film): black card, double deco border, a few words in white. Visual type "intertitle",
 * props { text, sub? }. Holds 2.5-3.75 s in the recipe, so give the scene enough words / a "hold".
 */
export const Intertitle: React.FC<VisualProps> = ({ local, props, rtl }) => {
  const p = props as { text?: string; sub?: string };
  const o = clamp(local / 0.25);
  return (
    <div style={{ position: "absolute", inset: "0 20px", display: "flex", alignItems: "center", justifyContent: "center", opacity: o }}>
      <div style={{ width: "100%", padding: "70px 50px", background: "#0b0a09", border: "6px double #e9e1cf", outline: "2px solid #e9e1cf", outlineOffset: -26, textAlign: "center", color: "#efe8d8", direction: rtl ? "rtl" : "ltr" }}>
        <div style={{ fontSize: 30, letterSpacing: 10, opacity: 0.7, fontFamily: FONT.serif }}>❦</div>
        <div style={{ fontFamily: rtl ? FONT.arabicEmph : FONT.serif, fontSize: rtl ? 74 : 84, lineHeight: 1.25, fontStyle: rtl ? "normal" : "italic", margin: "18px 0" }}>{p.text ?? ""}</div>
        {p.sub && <div style={{ fontFamily: rtl ? FONT.arabic : FONT.serif, fontSize: 38, opacity: 0.8 }}>{p.sub}</div>}
        <div style={{ fontSize: 30, letterSpacing: 10, opacity: 0.7, fontFamily: FONT.serif }}>❦</div>
      </div>
    </div>
  );
};
