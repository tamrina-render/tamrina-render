import type { CSSProperties } from "react";
import type { Theme } from "./types";

// Default style tokens copied from the reference reel: warm paper, near-black ink, one red accent,
// monospace section labels, italic serif emphasis words, solid offset shadows, halftone dots.
// Brands (brands/<name>/brand.json) override any of these through timeline.theme.
export const THEME: Theme = {
  paper: "#EFECE6",
  ink: "#151515",
  accent: "#E8321E",
  muted: "#8B8984",
  panel: "#1C1C1C",
  card: "#FFFFFF",
  dots: "#D6D2CA",
  line: "#151515",
  shadow: "10px 12px 0 rgba(21,21,21,0.92)",
  shadowSoft: "6px 8px 0 rgba(21,21,21,0.85)",
  onAccent: "#FFFFFF",
  onInk: "#FFFFFF",
  onPanel: "#F3F1EC",
  mutedPanel: "#9A9893",
  fill: "#E9E6DF",
  soft: "#FBE9E6",
  faint: "#D8D4CC",
  danger: "#E8321E",
  gold: "#F5B82E",
  blend: "multiply",
  bg: "paper",
};

export const resolveTheme = (over?: Partial<Theme>): Theme => ({ ...THEME, ...(over ?? {}) });

export const SHADOW = THEME.shadow;
export const SHADOW_SOFT = "6px 8px 0 rgba(21,21,21,0.18)";
export const RADIUS = 22;

export const panelStyle = (t: Theme, dark = false): CSSProperties => ({
  background: dark ? t.panel : t.card,
  color: dark ? t.onPanel : t.ink,
  border: `3px solid ${t.line}`,
  borderRadius: RADIUS,
  boxShadow: t.shadow,
});
