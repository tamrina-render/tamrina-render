import React from "react";
import { FONT } from "../../lib/fonts";
import { enter, springIn } from "../../lib/mechanics";
import { beatTime, Check, DocIcon, Mono, Panel, type VisualProps } from "./common";

/**
 * props: { title?: string, sub?: string, items: ({text:string, sub?:string, at?:number} | string)[], counter?: string, accentLast?: boolean }
 * Items check in at their `at` (local seconds) or on the scene's emphasized words.
 */
export const Checklist: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "up", preset: "pop" });
  const items = (props.items ?? []).map((it: any) => (typeof it === "string" ? { text: it } : it));
  const n = items.length;
  const times = items.map((it: any, k: number) => (typeof it.at === "number" ? it.at : beatTime(p, k, n)));
  const doneCount = times.filter((tm: number) => local >= tm).length;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: e.opacity, transform: e.transform }}>
        <Panel theme={theme} t={local} seed={4} style={{ width: 780, padding: "26px 30px 22px", direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, direction: "ltr" }}>
            {props.title && <DocIcon color={theme.ink} bg={theme.card} size={26} />}
            {props.title && <span style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 30 }}>{props.title}</span>}
            {props.sub && <Mono color={theme.muted} size={20}>{props.sub}</Mono>}
            <span style={{ flex: 1 }} />
            <Mono color={theme.accent} size={20}>{props.counter ?? `${doneCount}/${n}`}</Mono>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {items.map((it: any, k: number) => {
              const on = local >= times[k];
              const s = springIn((local - times[k]) * fps, fps, 0, "pop");
              const isLast = k === n - 1 && (props.accentLast ?? true);
              const revealed = local >= times[k] - 0.35;
              return (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    padding: "14px 18px",
                    borderRadius: 16,
                    border: `3px ${revealed ? "solid" : "dashed"} ${on ? theme.line : theme.faint}`,
                    background: on && isLast ? theme.soft : on ? theme.card : "transparent",
                    transform: on ? `scale(${0.96 + 0.04 * s})` : "scale(0.98)",
                    opacity: revealed ? 1 : 0.45,
                  }}
                >
                  <Check on={on} theme={theme} accent={isLast} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: rtl ? FONT.arabic : FONT.head, fontWeight: 800, fontSize: 34, color: on ? theme.ink : theme.muted, lineHeight: 1.1 }}>{it.text}</div>
                    {it.sub && <Mono color={theme.muted} size={18} style={{ display: "block", marginTop: 4 }}>{"// "}{it.sub}</Mono>}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
};
