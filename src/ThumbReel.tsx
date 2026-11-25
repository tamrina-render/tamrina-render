import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThumbLine, thumbPose, type ThumbKind } from "./components/visuals/Thumb";
import { loadFonts } from "./lib/fonts";

loadFonts();

/**
 * The "move your thumb" reel: a line thumb on black swings on the beat, then one app screen per beat, then the logo + stores.
 * The idea (owner, 2026-11-01): you move your thumb and the screen moves with it. Every beat the screen goes the way the thumb goes:
 * thumb up = the screen flies up and the next comes from below; thumb down = it flies down and the next comes from above.
 * No voice and no text on screen; the owner adds the music in the app, so the timing follows that sound (beat + offset).
 * transition: "vertical" (default, the screen follows the thumb) or "wipe" (the trend reel's left/right edge, on its exact times).
 * Screens come from scripts/app-shots (the real app with made-up people).
 * props: { pool: "mr" | "mrs", dir: folder under public/, beat, offset, introBeats, shots: [file names] }
 */
const BG = "#050507";
const SLIDE = 0.17; // seconds, like a flick
const out = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

const DEFAULT_SHOTS = ["1-card-a", "2-card-b", "12-card-c", "3-match", "4-chat", "5-propose", "8-gyms", "7-gym", "6-coins", "9-perk", "10-sports", "11-you"];
const TRAVEL = 1900;

const Screen: React.FC<{ src: string; y: number }> = ({ src, y }) => (
  <Img
    src={staticFile(src)}
    style={{
      position: "absolute",
      left: (1080 - 738) / 2,
      top: 110 + y,
      width: 738,
      height: 1640,
      objectFit: "cover",
      objectPosition: "top",
      borderRadius: 46,
      boxShadow: "0 0 0 2px rgba(255,255,255,0.14)",
    }}
  />
);

const EndCard: React.FC<{ accent: string; y: number; t: number }> = ({ accent, y, t }) => {
  const pop = (d: number) => out((t - d) / 0.2);
  return (
    <AbsoluteFill style={{ background: BG, transform: `translateY(${y}px)`, alignItems: "center", justifyContent: "center", gap: 36, paddingBottom: 150 }}>
      <Img src={staticFile("footage/thumb-reel/logo.png")} style={{ width: 300, height: 300, transform: `scale(${0.8 + 0.2 * pop(0.05)})` }} />
      <div style={{ fontFamily: "Changa", fontWeight: 800, fontSize: 150, letterSpacing: 6, color: "#F4F5F7", lineHeight: 1 }}>
        TAMR<span style={{ color: accent }}>I</span>NA
      </div>
      <div style={{ display: "flex", gap: 10, width: 560 }}>
        {[0, 1, 2, 3, 4].map((k) => (
          <div key={k} style={{ flex: 1, height: 12, background: accent, opacity: pop(0.1 + k * 0.04) }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 22, marginTop: 14, opacity: pop(0.35), transform: `translateY(${(1 - pop(0.35)) * 24}px)` }}>
        {["App Store", "Google Play"].map((s) => (
          <div key={s} style={{ fontFamily: "Changa", fontWeight: 700, fontSize: 42, color: BG, background: accent, padding: "14px 34px", borderRadius: 14 }}>
            {s}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---- transition "wipe": as measured frame by frame from the trend reel (reference/DelngKMqB86) ----
// A sharp vertical edge crosses the frame in 5 frames (slow-fast-slow) and reveals the next picture; the old one drifts a little
// with the edge. The direction flips every cut: left to right, right to left, left to right...
// Times are that reel's real ones, so everything sits on its sound (its beat is not even).
const THUMB_TIMES = [0.07, 0.5, 0.9, 1.4, 1.8, 2.27, 2.67, 3.17];
const CUTS = [3.53, 4.03, 4.47, 4.97, 5.4, 5.87, 6.33, 6.8, 7.27, 7.7, 8.17, 8.7, 9.17];
const WIPE = 5 / 30;
const inOut = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
};
const WIPE_SHOTS: { file: string; top?: number }[] = [
  { file: "1-card-a", top: 180 },
  { file: "2-card-b", top: 180 },
  { file: "12-card-c", top: 180 },
  { file: "3-match", top: 240 },
  { file: "4-chat", top: 130 },
  { file: "5-propose" },
  { file: "8-gyms" },
  { file: "7-gym" },
  { file: "6-coins" },
  { file: "9-perk" },
  { file: "10-sports" },
  { file: "11-you" },
];

const thumbAt = (t: number) => {
  const k = THUMB_TIMES.filter((x) => t >= x).length - 1;
  if (k < 0) return 1;
  const from = k % 2 === 0 ? 1 : 0; // starts down; an even swing goes up
  const m = Math.min(1, (t - THUMB_TIMES[k]) / 0.17);
  const c = 1.3;
  const e = 1 + (c + 1) * Math.pow(m - 1, 3) + c * Math.pow(m - 1, 2);
  return from + (1 - 2 * from) * e;
};

const ThumbReelWipe: React.FC<{ pool: "mr" | "mrs"; dir: string }> = ({ pool, dir }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const kind: ThumbKind = pool === "mrs" ? "woman" : "man";
  const accent = pool === "mrs" ? "#FF5CA8" : "#D6FF3C";
  const i = CUTS.filter((x) => t >= x).length - 1; // -1 = the thumb; the last cut = the end card

  const layer = (j: number) => {
    if (j < 0) return <ThumbLine pose={thumbAt(t)} lag={thumbAt(t - 1.5 / fps)} kind={kind} color={accent} bg={BG} />;
    if (j >= WIPE_SHOTS.length) return <EndCard accent={accent} y={0} t={t - CUTS[j]} />;
    const s = WIPE_SHOTS[j];
    return (
      <AbsoluteFill style={{ background: "#0d0f14", overflow: "hidden" }}>
        <Img src={staticFile(`${dir}/${pool}/${s.file}.png`)} style={{ position: "absolute", left: 0, top: -(s.top ?? 0), width: 1080 }} />
      </AbsoluteFill>
    );
  };

  if (i < 0) return <AbsoluteFill style={{ background: BG }}>{layer(-1)}</AbsoluteFill>;
  const p = inOut((t - CUTS[i]) / WIPE);
  const ltr = i % 2 === 0; // the first cut goes left to right
  const edge = 1080 * p;
  const clip = ltr ? `inset(0 ${1080 - edge}px 0 0)` : `inset(0 0 0 ${1080 - edge}px)`;
  const sign = ltr ? 1 : -1;
  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      {p < 1 && <AbsoluteFill style={{ transform: `translateX(${sign * edge * 0.35}px)` }}>{layer(i - 1)}</AbsoluteFill>}
      <AbsoluteFill style={{ clipPath: clip }}>
        <AbsoluteFill style={{ transform: `translateX(${-sign * 50 * (1 - p)}px)` }}>{layer(i)}</AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const ThumbReel: React.FC<{ pool?: "mr" | "mrs"; dir?: string; beat?: number; offset?: number; introBeats?: number; shots?: string[]; transition?: "vertical" | "wipe" }> = ({
  pool = "mr",
  dir = "footage/thumb-reel/app",
  beat = 0.444,
  offset = 0.07,
  introBeats = 8,
  shots = DEFAULT_SHOTS,
  transition = "vertical",
}) => {
  if (transition === "wipe") return <ThumbReelWipe pool={pool} dir={dir} />;
  return <ThumbReelVertical pool={pool} dir={dir} beat={beat} offset={offset} introBeats={introBeats} shots={shots} />;
};

const ThumbReelVertical: React.FC<{ pool: "mr" | "mrs"; dir: string; beat: number; offset: number; introBeats: number; shots: string[] }> = ({
  pool,
  dir,
  beat,
  offset,
  introBeats,
  shots,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const kind: ThumbKind = pool === "mrs" ? "woman" : "man";
  const accent = pool === "mrs" ? "#FF5CA8" : "#D6FF3C";

  const start = offset + introBeats * beat;
  // one screen per beat; after the last one, the end card
  const i = Math.min(shots.length, Math.floor((t - start) / beat)); // -1 or less = still the thumb
  const landed = start + i * beat;
  const k = i >= 0 ? out((t - landed) / SLIDE) : 0;
  // the same direction as thumbPose: an even beat goes up, an odd beat goes down
  const dir_ = (introBeats + i) % 2 === 0 ? -1 : 1;
  const leave = dir_ * TRAVEL * k; // where the old one has gone
  const enter = -dir_ * TRAVEL * (1 - k); // where the new one still is
  const file = (j: number) => `${dir}/${pool}/${shots[j]}.png`;

  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      {i < 1 && (
        <AbsoluteFill style={{ transform: `translateY(${i === 0 ? leave : 0}px)` }}>
          <ThumbLine pose={thumbPose(t - offset, beat)} lag={thumbPose(t - offset - 1.5 / fps, beat)} kind={kind} color={accent} bg={BG} />
        </AbsoluteFill>
      )}
      {i >= 0 && i < shots.length && (
        <>
          {i > 0 && <Screen src={file(i - 1)} y={leave} />}
          <Screen src={file(i)} y={enter} />
        </>
      )}
      {i >= shots.length && (
        <>
          <Screen src={file(shots.length - 1)} y={leave} />
          <EndCard accent={accent} y={enter} t={t - landed} />
        </>
      )}
    </AbsoluteFill>
  );
};
