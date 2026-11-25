import React from "react";
import { useVideoConfig } from "remotion";
import { FONT } from "../lib/fonts";
import { waterfall } from "../lib/mechanics";
import { telop as telopStyle } from "./Looks";
import { alignTokens, tokenize } from "../lib/text";
import type { Scene, Theme } from "../lib/types";

/**
 * Word-timed kinetic headline (the big text at the top of the reel).
 * Each word appears exactly when it is spoken (minus `lead`), emphasized words are red italic serif and pop with a spring.
 */
export const Headline: React.FC<{ scene: Scene; theme: Theme; t: number; lead: number; rtl: boolean; lang: string; top?: number; telop?: boolean }> = ({
  scene,
  theme,
  t,
  lead,
  rtl,
  lang,
  top = 108,
  telop = false, // game show look: white / accent words with a thick ink stroke
}) => {
  const { fps } = useVideoConfig();
  const tokens = alignTokens(tokenize(scene.say), scene.words, scene.start, scene.end);
  const fontFamily = rtl ? `${FONT.arabic}, ${FONT.arabicAlt}, sans-serif` : `${FONT.head}, sans-serif`;
  const serif = rtl ? `${FONT.arabicEmph}, ${FONT.arabic}, sans-serif` : `${FONT.serif}, serif`;
  const words = tokens.length;
  const size = words > 14 ? 54 : words > 9 ? 60 : 68;

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 64,
        right: 64,
        direction: rtl ? "rtl" : "ltr",
        textAlign: rtl ? "right" : "left",
        fontFamily,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.14,
        letterSpacing: rtl ? 0 : -1.2,
        color: theme.ink,
        display: "flex",
        flexWrap: "wrap",
        columnGap: rtl ? 14 : 16,
        rowGap: 2,
        minHeight: 240,
        alignContent: "flex-start",
      }}
      lang={lang}
    >
      {tokens.map((tk, i) => {
        // waterfall entry (HyperFrames): each word whips up as it is said, stressed words rise further and pop
        const frame = (t - (tk.start - lead)) * fps;
        const { rise, scale, opacity: op } = waterfall(frame, fps, !!tk.emph);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: op,
              transform: `translateY(${rise}px) scale(${scale})`,
              transformOrigin: rtl ? "100% 80%" : "0% 80%",
              color: tk.emph ? theme.accent : telop ? "#fff" : theme.ink,
              ...(telop ? telopStyle(size) : {}),
              fontFamily: tk.emph ? serif : fontFamily,
              fontStyle: tk.emph && !rtl ? "italic" : "normal",
              fontWeight: tk.emph ? (rtl ? 800 : 400) : 600,
              fontSize: tk.emph && !rtl ? size * 1.12 : size,
              whiteSpace: "pre",
            }}
          >
            {tk.text}
          </span>
        );
      })}
    </div>
  );
};
