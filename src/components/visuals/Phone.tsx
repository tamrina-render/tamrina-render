import React from "react";
import { Img, staticFile } from "remotion";
import { FONT } from "../../lib/fonts";
import { countUp, enter, fmt, idle, springIn } from "../../lib/mechanics";
import { Mono, Pill, sceneProgress, type VisualProps } from "./common";

/**
 * props: { header?: string, title?: string, lines?: string[], stat?: {from,to,label,suffix},
 *          bubble?: string, badge?: {n:number,label:string}, chart?: boolean, dark?: boolean, tilt?: number,
 *          src?: string, screens?: string[], swapAt?: number, align?: "left" | "center" | "right", x?: number, y?: number, w?: number, h?: number }
 */
export const Phone: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "up", distance: 90, preset: "pop" });
  const i = idle(local, 3, 6);
  const prog = sceneProgress(p);
  const dark = props.dark ?? true;
  const bg = dark ? theme.panel : theme.card;
  const fg = dark ? theme.onPanel : theme.ink;
  const lines: string[] = props.lines ?? [];
  const tilt = props.tilt ?? -4;

  const isScreenshot = Boolean(props.src || (props.screens && props.screens.length > 0));
  const screens: string[] = props.screens ?? (props.src ? [props.src] : []);
  const swapAt = props.swapAt ?? 2.8;
  const currentScreenIndex = screens.length > 1 && local >= swapAt ? 1 : 0;
  const phoneWidth = props.w ?? 430;
  const phoneHeight = props.h ?? 760;
  const alignLeft = props.align === "left";
  const alignRight = props.align === "right";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        justifyContent: alignLeft ? "flex-start" : alignRight ? "flex-end" : "center",
        alignItems: "center",
        paddingLeft: alignLeft ? (props.x ?? 40) : undefined,
        paddingRight: alignRight ? (props.x ?? 40) : undefined,
        direction: rtl ? "rtl" : "ltr",
      }}
    >
      <div
        style={{
          opacity: e.opacity,
          transform: `${e.transform} translate(${i.x}px, ${i.y}px) rotate(${tilt + i.rot}deg)`,
          width: phoneWidth,
          height: phoneHeight,
          background: bg,
          border: `4px solid ${theme.line}`,
          borderRadius: 58,
          boxShadow: theme.shadow,
          position: "relative",
          overflow: "hidden",
          color: fg,
          fontFamily: rtl ? FONT.arabic : FONT.head,
        }}
      >
        {/* notch */}
        <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", width: 120, height: 30, borderRadius: 15, background: "#000", border: `2px solid ${dark ? "#333" : theme.ink}`, zIndex: 10 }} />
        <div style={{ position: "absolute", top: 20, left: 36, fontSize: 18, fontWeight: 700, fontFamily: FONT.mono, zIndex: 10 }}>9:41</div>

        {isScreenshot ? (
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 54 }}>
            {screens.map((scr, idx) => {
              const opacity = screens.length > 1
                ? (idx === 0 ? (local < swapAt ? 1 : Math.max(0, 1 - (local - swapAt) / 0.35))
                             : (local < swapAt ? 0 : Math.min(1, (local - swapAt) / 0.35)))
                : 1;
              return (
                <div key={idx} style={{ position: "absolute", inset: 0, opacity }}>
                  <Img
                    src={staticFile(scr)}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
                  />
                </div>
              );
            })}
            {screens.length > 1 && local >= swapAt && local < swapAt + 0.6 && (
              <div
                style={{
                  position: "absolute",
                  top: "28%",
                  left: "30%",
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  background: "rgba(214, 255, 60, 0.4)",
                  border: `2px solid ${theme.accent}`,
                  transform: `scale(${1 + (local - swapAt) * 2})`,
                  opacity: Math.max(0, 1 - (local - swapAt) / 0.6),
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        ) : (
          <div style={{ padding: "70px 30px 0", display: "flex", flexDirection: "column", gap: 14 }}>
            {props.header && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `2px solid ${dark ? "#2A2A2A" : "#E5E2DB"}`, paddingBottom: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 24 }}>{props.header}</span>
                <span style={{ width: 28, height: 28, borderRadius: 14, background: theme.accent, display: "inline-block" }} />
              </div>
            )}
            {props.title && <div style={{ fontWeight: 800, fontSize: 34, lineHeight: 1.15, marginTop: 6 }}>{props.title}</div>}
            {props.stat && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: 64, fontWeight: 800, color: theme.accent, fontFamily: FONT.head, letterSpacing: -2 }}>
                  {typeof props.stat.from === "number" ? fmt(countUp(prog, props.stat.from, props.stat.to)) : props.stat.to}
                  {props.stat.suffix ?? ""}
                </span>
                <Mono color={dark ? theme.mutedPanel : theme.muted} size={18}>{props.stat.label}</Mono>
              </div>
            )}
            {props.chart && (
              <svg width={366} height={150} viewBox="0 0 366 150" style={{ marginTop: 6 }}>
                <path d="M0 150 L366 150" stroke={dark ? "#333" : "#DDD"} strokeWidth={2} />
                {(() => {
                  const n = 40;
                  const pts: string[] = [];
                  const upto = Math.floor(n * prog);
                  for (let k = 0; k <= upto; k++) {
                    const x = (k / n) * 366;
                    const y = 140 - Math.pow(k / n, 2.6) * 125;
                    pts.push(`${x},${y}`);
                  }
                  return (
                    <>
                      <polyline points={pts.join(" ")} fill="none" stroke={theme.accent} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                      {pts.length > 0 && (
                        <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r={8} fill={theme.accent} stroke={fg} strokeWidth={3} />
                      )}
                    </>
                  );
                })()}
              </svg>
            )}
            {lines.map((ln, k) => {
              const d = Math.round(fps * (0.25 + k * 0.22));
              const le = enter(frame, fps, { delay: d, from: rtl ? "right" : "left", distance: 50, preset: "snappy" });
              return (
                <div
                  key={k}
                  style={{
                    opacity: le.opacity,
                    transform: le.transform,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: dark ? (theme.bg === "volt" ? theme.fill : "#1B1B1B") : "#F3F1EC",
                    borderRadius: 14,
                    padding: "12px 14px",
                    fontSize: 22,
                    fontWeight: 600,
                  }}
                >
                  <span style={{ width: 34, height: 34, borderRadius: 17, background: ["#6B7A8F", "#8F6B6B", "#6B8F7A", "#8F8A6B"][k % 4], flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ln}</span>
                  {props.action !== false && <span style={{ background: props.action ? theme.accent : "#1E7CF2", color: props.action ? theme.onAccent : "#fff", fontSize: 16, fontWeight: 800, padding: "6px 12px", borderRadius: 8, transform: props.action ? "skewX(-10deg)" : undefined }}>{props.action ?? "Follow"}</span>}
                </div>
              );
            })}
          </div>
        )}
        {props.bubble && !isScreenshot && (
          <div style={{ position: "absolute", bottom: 40, left: 30, right: 30, background: dark ? (theme.bg === "volt" ? theme.fill : "#1B1B1B") : "#F3F1EC", borderRadius: 16, padding: 16, fontSize: 24, fontWeight: 700, transform: `scale(${0.7 + 0.3 * springIn(frame, fps, Math.round(fps * 0.6), "pop")})` }}>
            {props.bubble}
          </div>
        )}
      </div>
      {props.badge && (
        <div style={{ position: "absolute", right: 90, bottom: 110, transform: `scale(${springIn(frame, fps, Math.round(fps * 0.5), "pop")}) rotate(${i.rot * 2}deg)`, direction: "ltr" }}>
          <Pill theme={theme} accent style={{ whiteSpace: "nowrap", padding: "10px 20px" }}>
            <svg width={30} height={30} viewBox="0 0 24 24"><circle cx={12} cy={8} r={5} fill={theme.onAccent} /><path d="M3 22 Q12 10 21 22 Z" fill={theme.onAccent} /></svg>
            {fmt(countUp(prog, 0, props.badge.n))}
            {props.badge.label && <span style={{ fontSize: 21, fontWeight: 700, opacity: 0.95, fontFamily: rtl ? FONT.arabic : FONT.head }}>{props.badge.label}</span>}
          </Pill>
        </div>
      )}
    </div>
  );
};
