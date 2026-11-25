import React from "react";
import { FONT } from "../../lib/fonts";
import { enter, springIn } from "../../lib/mechanics";
import { beatTime, Mono, Panel, type VisualProps } from "./common";

/**
 * A dark terminal / prompt box. props: { prompt: string, lines?: string[], tabs?: string[], activeTab?: number, label?: string, done?: boolean, typeSeconds?: number }
 */
export const Terminal: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "up", preset: "pop" });
  const prompt: string = props.prompt ?? "make a reel about my app";
  const typeSeconds = props.typeSeconds ?? Math.min(1.6, 0.05 * prompt.length);
  const typed = prompt.slice(0, Math.floor(Math.min(1, Math.max(0, (local - 0.25) / typeSeconds)) * prompt.length));
  const cursorOn = Math.floor(local * 3) % 2 === 0;
  const lines: string[] = props.lines ?? [];
  const n = lines.length;
  const sent = local > typeSeconds + 0.45;
  const sendS = springIn((local - typeSeconds - 0.45) * fps, fps, 0, "pop");
  const tabs: string[] = props.tabs ?? [];
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: e.opacity, transform: e.transform, width: 860 }}>
        {tabs.length > 0 && (
          <div style={{ display: "flex", gap: 12, marginBottom: 18, justifyContent: "center" }}>
            {tabs.map((tb, k) => (
              <div key={k} style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 22, padding: "8px 18px", borderRadius: 999, border: `3px solid ${theme.ink}`, background: k === (props.activeTab ?? 0) ? theme.ink : "#fff", color: k === (props.activeTab ?? 0) ? "#fff" : theme.ink, boxShadow: "4px 5px 0 rgba(21,21,21,0.85)" }}>
                {tb}
              </div>
            ))}
          </div>
        )}
        <Panel theme={theme} dark t={local} seed={6} style={{ padding: "22px 26px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c, display: "inline-block" }} />)}
            <span style={{ flex: 1 }} />
            <Mono color="#8E8C86" size={18}>{props.label ?? "// your prompt"}</Mono>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#0D0D0D", border: "2px solid #333", borderRadius: 14, padding: "16px 20px", direction: rtl ? "rtl" : "ltr" }}>
            <span style={{ color: theme.accent, fontFamily: FONT.mono, fontSize: 30, fontWeight: 800 }}>{">"}</span>
            <span style={{ flex: 1, color: "#F4F2EC", fontFamily: rtl ? FONT.arabic : FONT.mono, fontSize: 30, whiteSpace: "pre-wrap" }}>
              {typed}
              <span style={{ opacity: cursorOn && !sent ? 1 : 0, color: "#F4F2EC" }}>|</span>
            </span>
            <span style={{ width: 54, height: 54, borderRadius: 27, background: sent || props.done ? theme.accent : "#2A2A2A", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${sent ? 0.8 + 0.2 * sendS : 1})` }}>
              <svg width={28} height={28} viewBox="0 0 24 24">
                {sent || props.done ? <path d="M4 12 L10 18 L20 6" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" /> : <path d="M12 20 V5 M5 12 L12 5 L19 12" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />}
              </svg>
            </span>
          </div>
          {n > 0 && (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {lines.map((ln, k) => {
                const at = beatTime(p, k, n);
                const on = local >= at;
                const s = springIn((local - at) * fps, fps, 0, "snappy");
                return (
                  <div key={k} style={{ opacity: on ? 1 : 0, transform: `translateX(${(1 - s) * (rtl ? 30 : -30)}px)`, fontFamily: FONT.mono, fontSize: 22, color: k === n - 1 ? theme.accent : "#C9C6BF", direction: rtl ? "rtl" : "ltr" }}>
                    {ln}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
