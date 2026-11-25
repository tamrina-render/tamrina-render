import React from "react";
import { FONT } from "../../lib/fonts";
import { idle, springIn } from "../../lib/mechanics";
import { DocIcon, type VisualProps } from "./common";

/**
 * A fan / scatter of chips or cards.
 * props: { items: string[], style?: "chips" | "cards" | "stack", icon?: boolean, accentEvery?: number, title?: string }
 */
export const Cards: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const items: string[] = props.items ?? [];
  const style = props.style ?? "chips";
  const n = Math.max(1, items.length);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "relative", width: 900, height: 620, direction: rtl ? "rtl" : "ltr" }}>
        {items.map((it, k) => {
          const s = springIn(frame, fps, Math.round(fps * (0.15 + k * 0.1)), "pop");
          const i = idle(local, k + 1, 7, 0.45);
          let x = 0, y = 0, rot = 0, w = 0;
          if (style === "stack") {
            x = 450 - 200 + (k - n / 2) * 18;
            y = 310 - 150 + (k - n / 2) * -12;
            rot = (k - n / 2) * 4;
            w = 400;
          } else if (style === "cards") {
            const cols = Math.min(3, n);
            const col = k % cols, row = Math.floor(k / cols);
            x = 450 - (cols * 290) / 2 + col * 290;
            y = 60 + row * 260;
            rot = ((k * 7) % 11) - 5;
            w = 270;
          } else {
            const cols = 3;
            const col = k % cols, row = Math.floor(k / cols);
            x = 80 + col * 270 + ((row % 2) * 60);
            y = 90 + row * 120 + ((k % 3) * 14);
            rot = ((k * 13) % 17) - 8;
            w = 0;
          }
          const accent = props.accentEvery && (k + 1) % props.accentEvery === 0;
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: w || undefined,
                transform: `translate(${i.x}px, ${i.y}px) rotate(${rot + i.rot}deg) scale(${s})`,
                transformOrigin: "50% 50%",
                background: accent ? theme.accent : theme.card,
                color: accent ? theme.onAccent : theme.ink,
                border: `3px solid ${theme.line}`,
                borderRadius: style === "chips" ? 12 : 20,
                padding: style === "chips" ? "10px 18px" : "22px 24px",
                boxShadow: theme.shadowSoft,
                fontFamily: style === "chips" ? FONT.mono : rtl ? FONT.arabic : FONT.head,
                fontWeight: style === "chips" ? 600 : 700,
                fontSize: style === "chips" ? 22 : 30,
                display: "flex",
                alignItems: "center",
                gap: 12,
                whiteSpace: style === "chips" ? "nowrap" : "normal",
                minHeight: style === "cards" ? 200 : undefined,
              }}
            >
              {(props.icon ?? style === "chips") && <DocIcon color={accent ? theme.onAccent : theme.ink} bg={accent ? theme.accent : theme.card} size={24} />}
              {it}
            </div>
          );
        })}
        {props.title && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", fontFamily: FONT.mono, fontSize: 22, color: theme.muted }}>{"// "}{props.title}</div>
        )}
      </div>
    </div>
  );
};
