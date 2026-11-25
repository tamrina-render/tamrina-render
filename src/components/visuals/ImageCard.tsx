import React from "react";
import { Img, staticFile } from "remotion";
import type { VisualProps } from "./common";

const ease = (k: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);

/**
 * `image`: a picture (a partner gym's logo...) for the coin to play with.
 * props: src (path under public/, a transparent PNG), w (px), x / y (its centre inside the stage box, px), at (s it starts; negative = already there, no entrance: use it on every scene after the first, or the card replays its entrance at each cut).
 *  - drop: true = falls from above the frame, lands at `at + 0.32` s with a short shake (pair with an impact sound there).
 *  - from: {x, y, w} = eases from there to x / y / w over `dur` s (default 0.6) at the scene start (the logo moves up
 *    and shrinks to make room). Without drop / from it slams in (big -> its size).
 * With {peek} or scene "behind": true the card sits over the coin, so the opaque part of the PNG hides him.
 */
export const ImageCard: React.FC<VisualProps> = ({ local, props }) => {
  const at = props.at ?? 0;
  if (!props.src || local < at) return null;
  const lt = local - at;
  let w = props.w ?? 700, x = props.x ?? 500, y = props.y ?? 500, scale = 1, opacity = 1, sx = 0;
  if (props.from) {
    const k = ease(lt / (props.dur ?? 0.6));
    w = props.from.w + (w - props.from.w) * k; x = props.from.x + (x - props.from.x) * k; y = props.from.y + (y - props.from.y) * k;
  }
  if (props.drop) {
    const fall = 0.32, k = Math.min(1, lt / fall);
    y = y - (1 - k * k) * 1900; // accelerates down like a weight
    const s = lt - fall; // landing shake: a hard side-to-side jolt that dies in 0.4 s
    if (s > 0 && s < 0.4) { sx = Math.sin(s * 70) * 22 * (1 - s / 0.4); y += Math.sin(s * 55) * 10 * (1 - s / 0.4); }
  } else if (!props.from) {
    const k = Math.min(1, lt / 0.22);
    scale = 1 + 0.35 * Math.pow(1 - k, 3); opacity = k;
  }
  return (
    <Img src={staticFile(props.src)} style={{ position: "absolute", width: w, left: x - w / 2 + sx, top: y - w / 2,
      transform: `scale(${scale})`, opacity, transformOrigin: "50% 50%" }} />
  );
};
