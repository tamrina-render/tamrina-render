import React from "react";
import { FONT } from "../../lib/fonts";
import { enter, springIn } from "../../lib/mechanics";
import { beatTime, Mono, Panel, type VisualProps } from "./common";

/**
 * A card that gets slammed with a rubber stamp. props: { text: string, sub?: string, stamp: string, stampAt?: number, color?: string, dark?: boolean, cards?: string[] }
 */
export const Stamp: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "up", preset: "pop" });
  const at = typeof props.stampAt === "number" ? props.stampAt : beatTime(p, 0, 1);
  const slam = local >= at;
  const s = springIn((local - at) * fps, fps, 0, "heavy");
  const stampScale = slam ? 2.4 - 1.4 * Math.min(1, s) : 0;
  const color = props.color ?? theme.accent;
  const cards: string[] = props.cards ?? [];
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: e.opacity, transform: e.transform, position: "relative", width: 820, height: 560 }}>
        {cards.map((c, k) => {
          const cs = springIn(frame, fps, Math.round(fps * (0.02 + k * 0.06)), "pop");
          const cols = 3;
          const col = k % cols, row = Math.floor(k / cols);
          return (
            <div key={k} style={{ position: "absolute", left: 40 + col * 250, top: 30 + row * 250, width: 220, height: 220, borderRadius: 18, border: `3px solid ${theme.line}`, background: theme.fill, boxShadow: theme.shadowSoft, transform: `scale(${cs}) rotate(${((k * 7) % 9) - 4}deg)`, filter: slam ? "grayscale(1) contrast(0.8)" : "none", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12, fontFamily: FONT.head, fontWeight: 800, fontSize: 20, color: theme.muted, textAlign: "center" }}>
              <div style={{ position: "absolute", top: 14, left: 14, background: theme.accent, color: theme.onAccent, fontFamily: FONT.mono, fontSize: 14, padding: "2px 8px", borderRadius: 6 }}>+ AI</div>
              <div style={{ position: "absolute", top: 70, left: 80, width: 60, height: 60, borderRadius: 30, background: theme.card, border: `3px solid ${theme.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={26} height={26} viewBox="0 0 24 24"><path d="M7 4 L19 12 L7 20 Z" fill={theme.ink} /></svg>
              </div>
              {c}
            </div>
          );
        })}
        {cards.length === 0 && (
          <Panel theme={theme} dark={props.dark} t={local} seed={7} style={{ position: "absolute", left: 90, top: 60, width: 640, padding: "40px 44px", direction: rtl ? "rtl" : "ltr" }}>
            <div style={{ fontFamily: rtl ? FONT.arabic : FONT.head, fontWeight: 800, fontSize: 56, lineHeight: 1.1 }}>{props.text}</div>
            {props.sub && <Mono color={theme.muted} size={22} style={{ display: "block", marginTop: 14 }}>{props.sub}</Mono>}
          </Panel>
        )}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) rotate(-14deg) scale(${stampScale})`,
            opacity: slam ? Math.min(1, s * 1.6) : 0,
            border: `10px double ${color}`,
            borderRadius: 18,
            padding: "10px 34px",
            fontFamily: FONT.head,
            fontWeight: 900,
            fontSize: 110,
            letterSpacing: 4,
            color,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            mixBlendMode: theme.blend,
            maskImage: "radial-gradient(circle at 30% 40%, #000 60%, rgba(0,0,0,0.75) 100%)",
          }}
        >
          {props.stamp ?? "AI SLOP"}
        </div>
      </div>
    </div>
  );
};
