import React from "react";
import { FONT } from "../../lib/fonts";
import { enter, springIn } from "../../lib/mechanics";
import { Mono, Panel, Pill, sceneProgress, type VisualProps } from "./common";

/**
 * props: { title?: string, yLabel?: string, xLabel?: string, pin?: string, badge?: string, bigNumber?: string, bigSub?: string,
 *          curve?: "exp" | "linear" | "s", marker?: number (0..1 position of the pin) }
 */
export const Chart: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "scale", preset: "pop" });
  const prog = sceneProgress(p, 0.8);
  const W = 760, H = 520, pad = 60;
  const curve = props.curve ?? "exp";
  const f = (x: number) => (curve === "linear" ? x : curve === "s" ? 1 / (1 + Math.exp(-(x - 0.5) * 10)) : Math.pow(x, 3));
  const n = 60;
  const pts: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const x = k / n;
    pts.push([pad + x * (W - pad * 2), H - pad - f(x) * (H - pad * 2.4)]);
  }
  const upto = Math.max(1, Math.floor(n * prog));
  const drawn = pts.slice(0, upto + 1);
  const mk = Math.min(1, Math.max(0, props.marker ?? 0.18));
  const mkPt = pts[Math.round(mk * n)];
  const pinS = springIn(frame, fps, Math.round(fps * 0.5), "pop");
  const bigS = springIn(frame, fps, Math.round(fps * 0.9), "pop");
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: e.opacity, transform: e.transform }}>
        <Panel theme={theme} t={local} seed={2} tab={props.title} tabColor={theme.ink} style={{ width: W, height: H, padding: 0 }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", borderRadius: 20 }}>
            {/* grid */}
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1={pad} x2={W - pad} y1={H - pad - g * (H - pad * 2.4)} y2={H - pad - g * (H - pad * 2.4)} stroke={theme.fill} strokeWidth={2} strokeDasharray="6 8" />
            ))}
            {/* axes */}
            <path d={`M${pad} ${pad * 0.6} L${pad} ${H - pad} L${W - pad} ${H - pad}`} fill="none" stroke={theme.ink} strokeWidth={4} strokeLinecap="round" />
            <path d={`M${pad - 10} ${pad * 0.6 + 12} L${pad} ${pad * 0.6} L${pad + 10} ${pad * 0.6 + 12}`} fill="none" stroke={theme.ink} strokeWidth={4} />
            <path d={`M${W - pad - 12} ${H - pad - 10} L${W - pad} ${H - pad} L${W - pad - 12} ${H - pad + 10}`} fill="none" stroke={theme.ink} strokeWidth={4} />
            {/* ghost of full curve */}
            <polyline points={pts.map((q) => q.join(",")).join(" ")} fill="none" stroke={theme.faint} strokeWidth={3} strokeDasharray="8 10" />
            {/* drawn curve */}
            <polyline points={drawn.map((q) => q.join(",")).join(" ")} fill="none" stroke={theme.ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            {/* "now" dashed line */}
            <line x1={mkPt[0]} x2={mkPt[0]} y1={pad * 0.8} y2={H - pad} stroke={theme.accent} strokeWidth={3} strokeDasharray="10 8" />
            {/* pin */}
            <g transform={`translate(${mkPt[0]} ${mkPt[1]}) scale(${pinS})`}>
              <path d="M0 0 L-16 -30 A22 22 0 1 1 16 -30 Z" fill={theme.accent} stroke={theme.ink} strokeWidth={3} />
              <circle cx={0} cy={-36} r={8} fill={theme.onAccent} />
            </g>
            <text x={W - pad} y={H - pad + 36} textAnchor="end" fontFamily={FONT.mono} fontSize={18} fill={theme.muted}>{props.xLabel ?? "time"}</text>
            <text x={pad - 14} y={pad * 0.6 + 10} textAnchor="end" fontFamily={FONT.mono} fontSize={18} fill={theme.muted} transform={`rotate(-90 ${pad - 14} ${pad * 0.6 + 10})`}>{props.yLabel ?? "reach"}</text>
          </svg>
          {props.pin && (
            <div style={{ position: "absolute", left: mkPt[0] - 70, top: mkPt[1] - 124, transform: `scale(${pinS})`, transformOrigin: "50% 100%", whiteSpace: "nowrap" }}>
              <Pill theme={theme} accent style={{ fontSize: 24, padding: "8px 16px" }}>{props.pin}</Pill>
            </div>
          )}
          {props.badge && (
            <div style={{ position: "absolute", top: 22, right: 22, transform: `scale(${springIn(frame, fps, Math.round(fps * 0.3), "snappy")})` }}>
              <Pill theme={theme} style={{ fontSize: 22, padding: "6px 14px" }}>{props.badge}</Pill>
            </div>
          )}
          {props.bigNumber && (
            <div style={{ position: "absolute", top: 90, right: 50, transform: `scale(${bigS})`, transformOrigin: "100% 50%", textAlign: "right", direction: rtl ? "rtl" : "ltr" }}>
              <div style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 92, letterSpacing: -3, color: theme.ink, lineHeight: 1 }}>
                {props.bigNumber} <span style={{ fontFamily: FONT.serif, fontStyle: "italic", fontWeight: 400, fontSize: 70 }}>{props.bigSub ?? ""}</span>
              </div>
            </div>
          )}
        </Panel>
        {props.sub && (
          <Mono color={theme.muted} size={20} style={{ display: "block", textAlign: "center", marginTop: 22 }}>{props.sub}</Mono>
        )}
      </div>
    </div>
  );
};
