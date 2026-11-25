import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Presenter } from "./components/Presenter";
import { applyFontSet } from "./lib/fonts";
import { applyMotionProfile } from "./lib/mechanics";
import { resolveTheme } from "./lib/theme";
import { useFonts } from "./lib/useFonts";
import type { Timeline } from "./lib/types";

// Only the presenter on a transparent frame, to lay over another video (e.g. the partner-wheel reels).
// Render as PNGs: remotion render src/index.ts CoinOnly <dir> --props=<timeline.json> --sequence --image-format=png
export const CoinOnly: React.FC<Timeline> = (tl) => {
  const { fps } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  applyFontSet(tl.brand);
  applyMotionProfile(tl.motion ?? (tl.brand === "tamrina" ? "calm" : "reel"));
  useFonts();
  return <AbsoluteFill><Presenter tl={tl} theme={resolveTheme(tl.theme)} t={t} /></AbsoluteFill>;
};
