import React from "react";
import { FONT } from "../../lib/fonts";
import { countUp, enter, springIn } from "../../lib/mechanics";
import { Mono, Panel, sceneProgress, type VisualProps } from "./common";

/** props: { from?: number, to: number, label?: string, sub?: string, big?: string (overrides number, e.g. "NOW"), unit?: string } */
export const Calendar: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "scale", preset: "pop" });
  const prog = sceneProgress(p, 0.75);
  const from = props.from ?? 1;
  const to = props.to ?? 35;
  const v = countUp(prog, from, to);
  const flip = prog < 1 ? Math.abs(Math.sin(prog * (to - from) * Math.PI)) : 1;
  const done = prog >= 0.999;
  const ring = springIn((local - (p.scene.end - p.scene.start) * 0.75) * fps, fps, 0, "pop");
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: e.opacity, transform: `${e.transform} rotate(${Math.sin(local * 0.8) * 2 - 3}deg)` }}>
        <Panel theme={theme} t={local} seed={8} style={{ width: 460, padding: 0, overflow: "visible" }}>
          <div style={{ background: theme.ink, color: theme.onInk, borderRadius: "18px 18px 0 0", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Mono color={theme.onInk} size={20}>{"// "}{props.label ?? "calendar"}</Mono>
            <span style={{ background: theme.accent, color: theme.onAccent, fontFamily: FONT.mono, fontSize: 18, padding: "2px 10px", borderRadius: 6 }}>+1</span>
          </div>
          {[0, 1].map((k) => (
            <div key={k} style={{ position: "absolute", top: -18, left: 110 + k * 200, width: 30, height: 40, borderRadius: 8, background: theme.faint, border: `3px solid ${theme.line}` }} />
          ))}
          <div style={{ padding: "26px 24px 30px", textAlign: "center", position: "relative", direction: rtl ? "rtl" : "ltr" }}>
            <div style={{ fontFamily: FONT.head, fontWeight: 900, fontSize: props.big ? 96 : 170, lineHeight: 1, letterSpacing: -6, color: theme.ink, transform: `scaleY(${0.75 + 0.25 * flip})`, transformOrigin: "50% 50%" }}>
              {props.big ?? v}
            </div>
            {props.unit && <Mono color={theme.muted} size={22} style={{ display: "block", marginTop: 10 }}>{"// "}{props.unit}</Mono>}
            {done && (
              <svg width={300} height={240} viewBox="0 0 300 240" style={{ position: "absolute", left: 80, top: props.big ? -10 : 0, transform: `scale(${ring})`, pointerEvents: "none" }}>
                <ellipse cx={150} cy={120} rx={130} ry={100} fill="none" stroke={theme.accent} strokeWidth={9} strokeDasharray="700" strokeDashoffset={700 * (1 - Math.min(1, ring))} strokeLinecap="round" transform="rotate(-8 150 120)" />
              </svg>
            )}
          </div>
        </Panel>
        {props.sub && <Mono color={theme.muted} size={20} style={{ display: "block", textAlign: "center", marginTop: 26 }}>{props.sub}</Mono>}
      </div>
    </div>
  );
};
