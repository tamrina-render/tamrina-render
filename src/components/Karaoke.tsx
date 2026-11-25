import React from "react";
import { useVideoConfig } from "remotion";
import { FONT } from "../lib/fonts";
import { springIn } from "../lib/mechanics";
import { alignTokens, tokenize } from "../lib/text";
import type { Scene, Theme } from "../lib/types";

/** Lower caption pill: a sliding window of words, the active word inverted (black pill, white text). */
export const Karaoke: React.FC<{ scene: Scene; theme: Theme; t: number; lead: number; rtl: boolean; y?: number }> = ({
  scene,
  theme,
  t,
  lead,
  rtl,
  y = 1150,
}) => {
  const { fps } = useVideoConfig();
  const tokens = alignTokens(tokenize(scene.say), scene.words, scene.start, scene.end);
  let active = -1;
  for (let i = 0; i < tokens.length; i++) if (t >= tokens[i].start - lead) active = i;
  if (active < 0) return null;
  const from = Math.max(0, active - 2);
  const to = Math.min(tokens.length, from + 5);
  const slice = tokens.slice(from, to);
  const fontFamily = rtl ? `${FONT.arabic}, ${FONT.arabicAlt}, sans-serif` : `${FONT.head}, sans-serif`;
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        direction: rtl ? "rtl" : "ltr",
      }}
    >
      <div
        style={{
          background: theme.card,
          border: `3px solid ${theme.line}`,
          borderRadius: 18,
          boxShadow: theme.shadowSoft,
          padding: "14px 22px",
          display: "flex",
          gap: 14,
          fontFamily,
          fontWeight: 700,
          fontSize: 40,
          color: theme.ink,
          maxWidth: 960,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {slice.map((tk, i) => {
          const idx = from + i;
          const isActive = idx === active;
          const frame = (t - (tk.start - lead)) * fps;
          const s = springIn(frame, fps, 0, "pop");
          return (
            <span
              key={idx}
              style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: 10,
                background: isActive ? (tk.emph ? theme.accent : theme.ink) : "transparent",
                color: isActive ? (tk.emph ? theme.onAccent : theme.onInk) : idx < active ? theme.muted : theme.ink,
                transform: isActive ? `scale(${0.85 + 0.15 * s})` : "scale(1)",
                transition: "none",
              }}
            >
              {tk.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Chunk captions (captions "chunk"): 2-3 big words at a time, white with a dark edge behind the letters, *marked*
 *  words in the accent. A new chunk after 3 words, 18 letters or a pause; it pops in softly (no shake) and is gone
 *  0.6 s after its last word. For reels on real footage, where the three-line headline is too much. */
export const Chunk: React.FC<{ scene: Scene; theme: Theme; t: number; lead: number; rtl: boolean; y?: number }> = ({ scene, theme, t, lead, rtl, y = 820 }) => {
  const tokens = alignTokens(tokenize(scene.say), scene.words, scene.start, scene.end);
  const groups: number[][] = [];
  tokens.forEach((tk, i) => {
    const g = groups[groups.length - 1];
    const len = g ? g.reduce((n, j) => n + tokens[j].text.length, 0) : 0;
    // a chunk never runs over the end of a sentence or a ".." clause: "جهاز.. وست" would show the next picture's words early
    const stop = i > 0 && /(\.\.|[.؟?!])["»”]?$/.test(tokens[i - 1].text.trim());
    if (!g || stop || g.length >= 3 || len + tk.text.length > 18 || tk.start - tokens[i - 1].end > 0.35) groups.push([i]); else g.push(i);
  });
  let gi = -1;
  groups.forEach((g, k) => { if (t >= tokens[g[0]].start - lead) gi = k; });
  if (gi < 0) return null;
  const g = groups[gi], t0 = tokens[g[0]].start - lead;
  if (t > tokens[g[g.length - 1]].end + 0.6) return null;
  const k = 1 - Math.pow(1 - Math.min(1, (t - t0) / 0.12), 3); // ease out, 0.12 s
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: y - 70, textAlign: "center", direction: rtl ? "rtl" : "ltr", opacity: k, transform: `scale(${(0.92 + 0.08 * k).toFixed(4)})`,
      fontFamily: rtl ? `${FONT.arabicEmph}, ${FONT.arabic}, sans-serif` : `${FONT.head}, sans-serif`, fontWeight: 800, fontSize: 96, lineHeight: 1.3, color: "#fff",
      WebkitTextStroke: "14px #111", paintOrder: "stroke fill", textShadow: "0 6px 18px rgba(0,0,0,0.55)" }}>
      {g.map((j) => <span key={j} style={{ color: tokens[j].emph ? theme.accent : undefined }}>{tokens[j].text}{" "}</span>)}
    </div>
  );
};
