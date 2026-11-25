import React from "react";
import { FONT } from "../../lib/fonts";
import { countUp, easeOut, enter, fmt, springIn } from "../../lib/mechanics";
import { Mono, Panel, sceneProgress, type VisualProps } from "./common";

/** props: { value: number|string, prefix?: string, suffix?: string, label?: string, bar?: number (0..100), sub?: string, dark?: boolean, crowd?: number } */
export const BigNum: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "scale", preset: "pop" });
  const prog = sceneProgress(p, 0.7);
  const decimals = typeof props.decimals === "number" ? props.decimals : typeof props.value === "number" && !Number.isInteger(props.value) ? 1 : 0;
  const value =
    typeof props.value === "number"
      ? decimals > 0
        ? (props.value * easeOut(prog)).toFixed(decimals)
        : fmt(countUp(prog, 0, props.value))
      : props.value;
  const barS = springIn((local - 0.3) * fps, fps, 0, "soft");
  const crowd = props.crowd ?? 0;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 26 }}>
      <div style={{ opacity: e.opacity, transform: e.transform }}>
        <Panel theme={theme} dark={props.dark} t={local} seed={10} style={{ width: 640, padding: "30px 40px 28px", direction: rtl ? "rtl" : "ltr" }}>
          {props.label && <Mono color={theme.muted} size={20} style={{ display: "block", marginBottom: 8 }}>{"// "}{props.label}</Mono>}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: FONT.head, fontWeight: 900, fontSize: 150, lineHeight: 1, letterSpacing: -6, color: theme.accent }}>
              {props.prefix ?? ""}{value}{props.suffix ?? ""}
            </span>
          </div>
          {typeof props.bar === "number" && (
            <div style={{ marginTop: 18, height: 22, borderRadius: 11, background: theme.fill, border: `3px solid ${theme.line}`, overflow: "hidden" }}>
              <div style={{ width: `${props.bar * barS}%`, height: "100%", background: theme.accent }} />
            </div>
          )}
          {props.sub && <Mono color={theme.muted} size={20} style={{ display: "block", marginTop: 12 }}>{props.sub}</Mono>}
        </Panel>
      </div>
      {crowd > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", width: 760, gap: 10, justifyContent: "center" }}>
          {Array.from({ length: crowd }).map((_, k) => {
            const s = springIn(frame, fps, Math.round(fps * (0.2 + k * 0.03)), "snappy");
            const lit = k < Math.round(crowd * ((props.bar ?? 10) / 100));
            return (
              <div key={k} style={{ width: 54, height: 54, borderRadius: 27, border: `3px solid ${theme.line}`, background: lit ? theme.accent : theme.card, transform: `scale(${s}) translateY(${Math.sin(local * 2 + k) * 3}px)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.head, fontWeight: 900, color: lit ? theme.onAccent : theme.muted, fontSize: 24 }}>
                {lit ? "!" : "?"}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
