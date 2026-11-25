import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThumbLine, thumbPose, type ThumbKind } from "./components/visuals/Thumb";
import { loadFonts } from "./lib/fonts";

loadFonts();

/** The thumb alone on black with the hook, to look at it without a whole reel. props: { kind, color, hook: [white line, accent line], beat } */
export const ThumbOnly: React.FC<{ kind?: ThumbKind; color?: string; hook?: string[]; beat?: number }> = ({
  kind = "man",
  color = kind === "woman" ? "#FF5CA8" : "#D6FF3C",
  hook = kind === "woman" ? ["بدل ما تقلّبي في الريلز", "دوّري على بارتنر"] : ["بدل ما تقلّب في الريلز", "دوّر على بارتنر"],
  beat = 0.444,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ background: "#07070A" }}>
      <div style={{ position: "absolute", top: 300, left: 70, right: 70, direction: "rtl", fontFamily: "Changa", fontWeight: 800, lineHeight: 1.12 }}>
        <div style={{ color: "#F4F5F7", fontSize: 92 }}>{hook[0]}</div>
        <div style={{ color, fontSize: 122 }}>{hook[1]}</div>
      </div>
      <ThumbLine pose={thumbPose(t, beat)} lag={thumbPose(t - 1.5 / fps, beat)} kind={kind} color={color} />
    </AbsoluteFill>
  );
};
