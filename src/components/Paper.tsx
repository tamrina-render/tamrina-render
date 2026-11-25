import React from "react";
import { AbsoluteFill } from "remotion";
import type { Theme } from "../lib/types";

/** The reel's base layer. "paper": warm paper + halftone dots (reference reel). "volt": Tamrina near-black + faint grid + accent glow + varsity stripes. */
export const Paper: React.FC<{ theme: Theme; t: number }> = ({ theme, t }) => {
  const drift = (t * 4) % 16; // dots crawl very slowly -> never a frozen frame
  if (theme.bg === "volt") {
    const g = (t * 6) % 72;
    return (
      <AbsoluteFill style={{ background: theme.paper }}>
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${theme.dots} 1.5px, transparent 1.5px), linear-gradient(90deg, ${theme.dots} 1.5px, transparent 1.5px)`,
            backgroundSize: "72px 72px",
            backgroundPosition: `${g}px ${g}px`,
            opacity: 0.6,
          }}
        />
        {/* soft accent glow behind the visual stage (duo: lime on the left, pink on the right) */}
        {theme.accent2 ? (
          <>
            <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 45% at 18% 62%, ${theme.accent}2E 0%, transparent 70%)` }} />
            <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 45% at 82% 62%, ${theme.accent2}2E 0%, transparent 70%)` }} />
          </>
        ) : (
          <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 32% at 50% 44%, ${theme.accent}22 0%, transparent 72%)` }} />
        )}
        {/* varsity stripe band (jersey sleeve piping): full width, behind the presenter's body */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 330 }}>
          <div style={{ height: 14, background: theme.accent, opacity: 0.85 }} />
          <div style={{ height: 10 }} />
          <div style={{ height: 14, background: theme.accent2 ?? theme.accent, opacity: theme.accent2 ? 0.85 : 0.35 }} />
        </div>
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)" }} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: theme.paper }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${theme.dots} 1.1px, transparent 1.4px)`,
          backgroundSize: "16px 16px",
          backgroundPosition: `${drift}px ${drift * 0.5}px`,
          opacity: 0.9,
        }}
      />
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.35) 0%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.08) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
