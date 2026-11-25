import React from "react";
import { FONT } from "../../lib/fonts";
import { enter, springIn } from "../../lib/mechanics";
import { Mono, Panel, Pill, sceneProgress, type VisualProps } from "./common";

/** props: { value: number, max?: number, min?: number (threshold), label?: string, status?: string, fixTo?: number, bars?: number } */
export const Gauge: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "up", preset: "pop" });
  const prog = sceneProgress(p, 0.6);
  const max = props.max ?? 10;
  const min = props.min ?? 4.8;
  const fixing = typeof props.fixTo === "number" && local > (p.scene.end - p.scene.start) * 0.55;
  const target = fixing ? props.fixTo : props.value;
  const shown = fixing ? props.value + (props.fixTo - props.value) * Math.min(1, (local - (p.scene.end - p.scene.start) * 0.55) / 0.8) : props.value * prog;
  const low = shown < min;
  const statusS = springIn((local - 0.5) * fps, fps, 0, "pop");
  const bars = props.bars ?? 28;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: e.opacity, transform: e.transform }}>
        <Panel theme={theme} t={local} seed={11} style={{ width: 720, padding: "24px 30px 26px", direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Mono color={theme.muted} size={20}>{"// "}{props.label ?? "motion score"}</Mono>
            <div style={{ transform: `scale(${statusS})` }}>
              <Pill theme={theme} accent={low} style={{ fontSize: 20, padding: "6px 14px" }}>{fixing ? "fixing…" : props.status ?? (low ? "LOW" : "OK")}</Pill>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 10 }}>
            <div style={{ fontFamily: FONT.head, fontWeight: 900, fontSize: 130, letterSpacing: -5, lineHeight: 1, color: low ? theme.accent : theme.ink }}>
              {shown.toFixed(1)}<span style={{ fontSize: 44, color: theme.muted, fontWeight: 700 }}>/{max}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ position: "relative", height: 24, borderRadius: 12, background: "#E9E6DF", border: `3px solid ${theme.ink}`, overflow: "hidden" }}>
                <div style={{ width: `${(shown / max) * 100}%`, height: "100%", background: low ? theme.accent : theme.ink }} />
              </div>
              <div style={{ position: "relative", height: 24 }}>
                <div style={{ position: "absolute", left: `${(min / max) * 100}%`, top: 0, transform: "translateX(-50%)" }}>
                  <div style={{ width: 3, height: 10, background: theme.ink, margin: "0 auto" }} />
                  <Mono color={theme.muted} size={16}>min {min}</Mono>
                </div>
              </div>
            </div>
          </div>
          {/* motion per 0.1 s */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
            {Array.from({ length: bars }).map((_, k) => {
              const base = 0.35 + 0.55 * Math.abs(Math.sin(k * 1.7 + 0.4));
              const flat = !fixing && k >= 9 && k <= 13;
              const h = flat ? 0.08 : base;
              const live = k < bars * Math.min(1, local / 2.2);
              return <div key={k} style={{ flex: 1, height: `${h * 100}%`, background: flat ? "#F2B8B0" : live ? (fixing && k >= 9 && k <= 13 ? theme.accent : theme.ink) : "#DAD6CE", borderRadius: 3 }} />;
            })}
          </div>
          <Mono color={theme.muted} size={16} style={{ display: "block", marginTop: 6 }}>{"// motion per 0.1 s"}{target !== props.value ? "  · + whip pan · + zoom kick" : ""}</Mono>
        </Panel>
      </div>
    </div>
  );
};
