import React from "react";
import { FONT } from "../../lib/fonts";
import { enter, springIn } from "../../lib/mechanics";
import { beatTime, Check, Mono, Panel, type VisualProps } from "./common";

/** props: { steps: string[], title?: string, tab?: string, progressLabel?: string } — steps complete on the scene's beats, the last shows a progress bar. */
export const Pipeline: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "up", preset: "pop" });
  const steps: string[] = props.steps ?? ["script", "voice", "motion", "render"];
  const n = steps.length;
  const times = steps.map((_, k) => beatTime(p, k, n));
  const doneCount = times.filter((tm) => local >= tm).length;
  const dur = p.scene.end - p.scene.start;
  const lastPct = Math.min(100, Math.max(0, Math.round(((local - times[n - 1]) / Math.max(0.5, dur - times[n - 1])) * 100)));
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: e.opacity, transform: e.transform }}>
        <Panel theme={theme} t={local} seed={9} tab={props.tab} style={{ width: 600, padding: "26px 28px", direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <Mono color={theme.muted} size={20}>{"// "}{props.title ?? "pipeline"}</Mono>
            <Mono color={theme.accent} size={20}>{doneCount}/{n}</Mono>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {steps.map((st, k) => {
              const on = local >= times[k];
              const running = !on && (k === 0 || local >= times[k - 1]);
              const s = springIn((local - times[k]) * fps, fps, 0, "pop");
              const isLast = k === n - 1;
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 16, border: `3px solid ${on || running ? theme.line : theme.faint}`, borderRadius: 14, padding: "12px 16px", background: on ? theme.card : "transparent", transform: `scale(${on ? 0.97 + 0.03 * s : 1})`, opacity: on || running ? 1 : 0.5 }}>
                  <span style={{ fontFamily: FONT.mono, fontSize: 16, color: on ? theme.onInk : running ? theme.onAccent : theme.onInk, background: on ? theme.ink : running ? theme.accent : theme.faint, borderRadius: 6, padding: "2px 8px" }}>{String(k + 1).padStart(2, "0")}</span>
                  <span style={{ flex: 1, fontFamily: rtl ? FONT.arabic : FONT.head, fontWeight: 800, fontSize: 30 }}>{st}</span>
                  {on && !isLast && <Mono color={theme.muted} size={18}>{props.doneLabel ?? "done"}</Mono>}
                  {on && isLast && <Mono color={theme.accent} size={18}>{props.progressLabel ?? `${lastPct}%`}</Mono>}
                  {running ? (
                    <svg width={36} height={36} viewBox="0 0 36 36" style={{ transform: `rotate(${local * 360}deg)` }}>
                      <circle cx={18} cy={18} r={13} fill="none" stroke={theme.fill} strokeWidth={5} />
                      <path d="M18 5 A13 13 0 0 1 31 18" fill="none" stroke={theme.accent} strokeWidth={5} strokeLinecap="round" />
                    </svg>
                  ) : (
                    <Check on={on} theme={theme} accent={isLast} size={36} />
                  )}
                </div>
              );
            })}
          </div>
          {local >= times[n - 1] && (
            <div style={{ marginTop: 16, height: 16, borderRadius: 8, background: theme.fill, border: `2px solid ${theme.line}`, overflow: "hidden" }}>
              <div style={{ width: `${lastPct}%`, height: "100%", background: theme.accent }} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
