import React from "react";
import { FONT } from "../lib/fonts";
import { countUp, fmt } from "../lib/mechanics";
import type { Scene, Theme } from "../lib/types";

/**
 * "// 01 · the account" top-left and an optional live counter top-right (FOLLOWERS 39,522).
 * varsity (Tamrina): a slanted jersey-number patch "01" + uppercase label, the handle on the other side.
 */
export const SectionLabel: React.FC<{ scene: Scene; theme: Theme; local: number; dir: "ltr" | "rtl"; top?: number; varsity?: boolean; handle?: string }> = ({
  scene,
  theme,
  local,
  dir,
  top = 54,
  varsity,
  handle,
}) => {
  const c = scene.counter;
  const dur = Math.max(0.1, scene.end - scene.start);
  const p = Math.min(1, local / (dur * 0.85));
  let value: string = "";
  if (c) {
    if (typeof c.from === "number" && typeof c.to === "number") value = fmt(countUp(p, c.from, c.to));
    else value = String(c.to ?? c.from ?? "");
    if (c.suffix) value += c.suffix;
  }
  const counter = c && (
    <span style={{ textTransform: "uppercase" }}>
      {c.key} <span style={{ color: theme.accent, fontWeight: 700 }}>{value}</span>
    </span>
  );
  if (varsity) {
    return (
      <div
        style={{
          position: "absolute",
          top,
          left: 64,
          right: 64,
          display: "flex",
          flexDirection: dir === "rtl" ? "row-reverse" : "row",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: FONT.mono,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: 2,
          color: theme.muted,
          textTransform: "uppercase",
        }}
      >
        <span style={{ display: "flex", flexDirection: dir === "rtl" ? "row-reverse" : "row", alignItems: "center", gap: 14 }}>
          <span style={{ background: theme.accent, color: theme.onAccent, fontWeight: 800, fontSize: 26, padding: "0 14px", transform: "skewX(-12deg)", letterSpacing: 1, lineHeight: "40px" }}>
            {scene.id}
          </span>
          <span style={{ direction: dir }}>{scene.label}</span>
        </span>
        {counter ?? (handle && <span style={{ direction: "ltr", textTransform: "none", letterSpacing: 1 }}>{handle}</span>)}
      </div>
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 64,
        right: 64,
        display: "flex",
        flexDirection: dir === "rtl" ? "row-reverse" : "row",
        justifyContent: "space-between",
        fontFamily: FONT.mono,
        fontSize: 23,
        letterSpacing: 0.5,
        color: theme.muted,
        direction: "ltr",
      }}
    >
      <span>
        {"// "}
        {scene.id} {"·"} {scene.label}
      </span>
      {counter}
    </div>
  );
};
