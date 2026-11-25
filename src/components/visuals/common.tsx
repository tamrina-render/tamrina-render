import React from "react";
import { FONT } from "../../lib/fonts";
import { idle } from "../../lib/mechanics";
import { RADIUS } from "../../lib/theme";
import type { MotionEvent, Scene, Theme, Timeline } from "../../lib/types";

/** Everything a visual receives. `local` = seconds since the scene started, `frame` = local frame. */
export type VisualProps = {
  t: number;
  local: number;
  frame: number;
  fps: number;
  scene: Scene;
  tl: Timeline;
  theme: Theme;
  events: MotionEvent[]; // scene + global events, absolute times
  props: any;
  rtl: boolean;
};

/** Progress 0..1 through the scene's spoken part. */
export const sceneProgress = (p: VisualProps, tailFraction = 0.85) =>
  Math.min(1, p.local / Math.max(0.1, (p.scene.end - p.scene.start) * tailFraction));

/** Time (local seconds) of the i-th emphasized word in the scene, or evenly spaced fallback. */
export const beatTime = (p: VisualProps, i: number, n: number) => {
  const emph = p.scene.words.filter((w) => w.emph);
  if (emph[i]) return emph[i].start - p.scene.start - p.tl.captions.lead;
  const span = (p.scene.end - p.scene.start) * 0.75;
  return 0.25 + (span * (i + 1)) / (n + 1);
};

export const Panel: React.FC<{
  theme: Theme;
  dark?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  tab?: string;
  tabColor?: string;
  seed?: number;
  t?: number;
}> = ({ theme, dark, style, children, tab, tabColor, seed = 0, t = 0 }) => {
  const i = idle(t, seed, 4);
  return (
    <div
      style={{
        position: "relative",
        background: dark ? theme.panel : theme.card,
        color: dark ? theme.onPanel : theme.ink,
        border: `3px solid ${theme.line}`,
        borderRadius: RADIUS,
        boxShadow: theme.shadow,
        transform: `translate(${i.x}px, ${i.y}px) rotate(${i.rot}deg)`,
        ...style,
      }}
    >
      {tab && (
        <div
          style={{
            position: "absolute",
            top: -22,
            left: 26,
            background: tabColor ?? theme.accent,
            color: tabColor && tabColor !== theme.accent ? theme.onInk : theme.onAccent,
            fontFamily: FONT.mono,
            fontSize: 20,
            fontWeight: 700,
            padding: "4px 14px",
            borderRadius: 8,
            border: `3px solid ${theme.line}`,
            letterSpacing: 1,
            textTransform: "uppercase",
            direction: "ltr",
          }}
        >
          {tab}
        </div>
      )}
      {children}
    </div>
  );
};

export const Mono: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({ children, color, size = 20, style }) => (
  <span style={{ fontFamily: FONT.mono, fontSize: size, color, letterSpacing: 0.4, direction: "ltr", ...style }}>{children}</span>
);

export const DocIcon: React.FC<{ color: string; size?: number; bg?: string }> = ({ color, size = 28, bg = "#fff" }) => (
  <svg width={size} height={size * 1.2} viewBox="0 0 20 24" style={{ flexShrink: 0 }}>
    <path d="M2 2 H13 L18 7 V22 H2 Z" fill={bg} stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <path d="M13 2 V7 H18" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <path d="M5 12 H15 M5 16 H15" stroke={color} strokeWidth={2} />
  </svg>
);

export const Check: React.FC<{ on: boolean; theme: Theme; accent?: boolean; size?: number }> = ({ on, theme, accent, size = 44 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      border: `3px solid ${theme.line}`,
      background: on ? (accent ? theme.accent : theme.ink) : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    {on && (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24">
        <path d="M4 12 L10 18 L20 6" fill="none" stroke={accent ? theme.onAccent : theme.onInk} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </div>
);

export const Pill: React.FC<{ theme: Theme; children: React.ReactNode; accent?: boolean; style?: React.CSSProperties }> = ({ theme, children, accent, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      background: accent ? theme.accent : theme.ink,
      color: accent ? theme.onAccent : theme.onInk,
      fontFamily: FONT.head,
      fontWeight: 800,
      fontSize: 30,
      padding: "10px 22px",
      borderRadius: 16,
      border: `3px solid ${theme.line}`,
      boxShadow: theme.shadowSoft,
      ...style,
    }}
  >
    {children}
  </div>
);
