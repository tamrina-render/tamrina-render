import React from "react";
import { FONT } from "../../lib/fonts";
import { countUp, enter, fmt, springIn } from "../../lib/mechanics";
import { beatTime, Mono, Panel, sceneProgress, type VisualProps } from "./common";

/** props: { from?: number, to: number, suffix?: string, label?: string, tab?: string, dark?: boolean, dial?: boolean, chips?: string[], steps?: boolean }
 *  steps: count one by one at an even pace (1... 2... 3), each number pops in (small counts the viewer counts along with)
 *  onWords: with steps, each number lands on the next *emphasized* word instead (the coin says "واحد.. اتنين.. تلاتة") */
export const Counter: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "scale", preset: "pop" });
  const prog = sceneProgress(p, 0.8);
  const from = props.from ?? 0;
  const to = props.to ?? 100;
  const steps = !!props.steps && Math.abs(to - from) >= 1;
  const n = Math.abs(to - from);
  const onWords = steps && !!props.onWords;
  const stepAt = (j: number) => (onWords ? beatTime(p, j - 1, n) : 0.8 * (p.scene.end - p.scene.start) * (j / n)); // scene-local s of number j
  const k = onWords ? Array.from({ length: n }, (_, j) => j + 1).filter((j) => local >= stepAt(j)).length : steps ? Math.min(n, Math.floor(prog * n + 1e-6)) : 0;
  const v = steps ? from + Math.sign(to - from) * k : countUp(prog, from, to);
  const dark = props.dark ?? true;
  const done = onWords ? k >= n : prog >= 0.999;
  const span = 0.8 * (p.scene.end - p.scene.start);
  const popS = steps
    ? k > 0 ? springIn(frame - Math.round(fps * stepAt(k)), fps, 0, "pop") : 1
    : done ? springIn(frame - Math.round(fps * span), fps, 0, "pop") : 1;
  const chips: string[] = props.chips ?? [];
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: e.opacity, transform: e.transform, position: "relative" }}>
        {chips.map((c, k) => {
          const a = (k / chips.length) * Math.PI * 2 - Math.PI / 2;
          const r = 300 + (k % 3) * 40;
          const s = springIn(frame, fps, Math.round(fps * (0.3 + k * 0.08)), "pop");
          const fly = 1 - prog * 0.65;
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                left: 260 + Math.cos(a) * r * fly - 70,
                top: 150 + Math.sin(a) * r * 0.55 * fly - 20,
                transform: `scale(${s}) rotate(${(k % 5) * 7 - 14}deg)`,
                background: theme.card,
                color: theme.ink,
                border: `2px solid ${theme.line}`,
                borderRadius: 10,
                padding: "6px 12px",
                fontFamily: FONT.mono,
                fontSize: 18,
                boxShadow: theme.shadowSoft,
                whiteSpace: "nowrap",
              }}
            >
              {c}
            </div>
          );
        })}
        <Panel theme={theme} dark={dark} t={local} seed={5} tab={props.tab} style={{ width: 520, padding: "34px 40px 30px", direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 118, letterSpacing: -5, lineHeight: 1, color: done ? theme.accent : dark ? theme.onPanel : theme.ink, transform: `scale(${0.9 + 0.1 * popS})`, transformOrigin: rtl ? "100% 50%" : "0% 50%" }}>
                {fmt(v)}
                {props.suffix ?? ""}
              </div>
              {props.label && <Mono color={dark ? theme.mutedPanel : theme.muted} size={20} style={{ display: "block", marginTop: 10 }}>{"// "}{props.label}</Mono>}
            </div>
            {(props.dial ?? true) && (
              <svg width={110} height={110} viewBox="0 0 100 100">
                <circle cx={50} cy={50} r={44} fill={dark ? theme.paper : theme.card} stroke={dark ? theme.faint : theme.ink} strokeWidth={4} />
                {Array.from({ length: 12 }).map((_, k) => {
                  const a = (k / 12) * Math.PI * 2;
                  return <line key={k} x1={50 + Math.cos(a) * 36} y1={50 + Math.sin(a) * 36} x2={50 + Math.cos(a) * 41} y2={50 + Math.sin(a) * 41} stroke={dark ? theme.mutedPanel : theme.ink} strokeWidth={2} />;
                })}
                <line x1={50} y1={50} x2={50 + Math.cos((prog * 1.75 - 0.75) * Math.PI) * 34} y2={50 + Math.sin((prog * 1.75 - 0.75) * Math.PI) * 34} stroke={theme.accent} strokeWidth={5} strokeLinecap="round" />
                <circle cx={50} cy={50} r={6} fill={theme.accent} />
              </svg>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
};
