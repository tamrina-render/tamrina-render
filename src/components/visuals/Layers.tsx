import React from "react";
import { FONT } from "../../lib/fonts";
import { enter, idle, springIn } from "../../lib/mechanics";
import { beatTime, Mono, Panel, type VisualProps } from "./common";

/** Isometric stack of layers, each lands on a beat. props: { layers: {name:string, sub?:string}[], title?: string } */
export const Layers: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "up", preset: "pop" });
  const layers: { name: string; sub?: string }[] = props.layers ?? [{ name: "motion", sub: "layer 01 · 60fps" }, { name: "voiceover", sub: "layer 02 · voice" }, { name: "captions", sub: "layer 03 · words" }];
  const n = layers.length;
  const times = layers.map((_, k) => beatTime(p, k, n));
  const doneCount = times.filter((tm) => local >= tm).length;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: e.opacity, transform: e.transform, position: "relative", width: 900, height: 600 }}>
        <div style={{ position: "absolute", top: 0, right: 40, direction: "ltr" }}>
          <Mono color={theme.muted} size={20}>{props.title ?? "building"} <span style={{ color: theme.accent }}>{doneCount}/{n}</span></Mono>
        </div>
        {/* stack */}
        <div style={{ position: "absolute", left: 380, top: 120, width: 460, height: 420 }}>
          {layers.map((ly, k) => {
            const on = local >= times[k];
            const s = springIn((local - times[k]) * fps, fps, 0, "pop");
            const i = idle(local, k + 20, 4);
            const y = 300 - k * 95 + (1 - s) * -140;
            return (
              <div
                key={k}
                style={{
                  position: "absolute",
                  left: 0,
                  top: y + i.y,
                  width: 340,
                  height: 200,
                  borderRadius: 24,
                  background: on ? (k === n - 1 ? "#fff" : "#F7F5F0") : "transparent",
                  border: `3px ${on ? "solid" : "dashed"} ${on ? theme.ink : "#C9C5BD"}`,
                  boxShadow: on ? "8px 10px 0 rgba(21,21,21,0.9)" : "none",
                  transform: `rotateX(58deg) rotateZ(-32deg) scale(${on ? 0.9 + 0.1 * s : 1})`,
                  transformStyle: "preserve-3d",
                  opacity: on ? 1 : 0.6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT.mono,
                  fontSize: 44,
                  color: on ? theme.ink : "#C9C5BD",
                }}
              >
                {!on && String(k + 1).padStart(2, "0")}
                {on && (
                  <svg width={220} height={110} viewBox="0 0 220 110">
                    <rect x={10} y={10} width={60} height={60} rx={12} fill={theme.accent} />
                    <path d="M90 80 Q140 20 210 60" stroke={theme.ink} strokeWidth={5} fill="none" strokeLinecap="round" />
                    <circle cx={210} cy={60} r={8} fill={theme.ink} />
                    <rect x={10} y={84} width={120} height={10} rx={5} fill="#D6D2CA" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
        {/* labels */}
        <div style={{ position: "absolute", left: 20, top: 150, display: "flex", flexDirection: "column-reverse", gap: 18, direction: rtl ? "rtl" : "ltr" }}>
          {layers.map((ly, k) => {
            const on = local >= times[k];
            const s = springIn((local - times[k]) * fps, fps, 0, "pop");
            return (
              <div key={k} style={{ opacity: on ? 1 : 0, transform: `translateX(${(1 - s) * -40}px) scale(${0.9 + 0.1 * s})`, transformOrigin: "0 50%" }}>
                <Panel theme={theme} t={local} seed={k + 30} style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "6px 7px 0 rgba(21,21,21,0.9)", border: `3px solid ${k === n - 1 ? theme.accent : theme.ink}` }}>
                  <span style={{ width: 40, height: 40, borderRadius: 10, background: k === n - 1 ? theme.accent : theme.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.head, fontWeight: 900, fontSize: 20 }}>{["◎", "♪", "Aa"][k % 3]}</span>
                  <div>
                    <div style={{ fontFamily: rtl ? FONT.arabic : FONT.head, fontWeight: 800, fontSize: 30, lineHeight: 1 }}>{ly.name}</div>
                    {ly.sub && <Mono color={theme.muted} size={15}>{ly.sub}</Mono>}
                  </div>
                </Panel>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
