import React from "react";
import type { VisualProps } from "./common";

/**
 * A line-drawn thumb that swings on a beat (the "move your thumb" trend).
 * The lines are TRACED from real photos, point by point (never a formula: the owner rejected a computed tube, 2026-11-01):
 * man = Wikimedia "Liam Thumb.jpg" (CC0), woman = the same anatomy slimmed + a long nail shaped after a real manicure photo.
 * Coordinates below are the photo's pixels; the swing rotates them around the wrist.
 */
export type ThumbKind = "man" | "woman";
type Pt = [number, number];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

// ---- the art ----
const MAN = {
  // from the wrist (off-frame) up the left side, around the tip, down the right side
  outline: [
    [250, 1500], [300, 1200], [322, 1120], [342, 1040], [366, 950], [394, 860], [410, 770], [420, 700], [424, 620], [420, 560], [415, 500],
    [414, 440], [418, 370], [434, 305], [460, 245], [493, 210], [530, 197], [568, 202], [598, 224], [613, 262], [622, 320], [630, 400],
    [640, 460], [652, 510], [653, 570], [655, 640], [662, 715], [690, 785], [722, 850], [750, 930], [770, 1020], [782, 1140], [880, 1500],
  ] as Pt[],
  nail: [
    [484, 262], [497, 234], [535, 222], [578, 224], [603, 246], [608, 290], [603, 335], [560, 334], [520, 333], [497, 322], [486, 295],
  ] as Pt[],
  lines: [
    [[506, 510], [540, 509], [580, 502], [612, 488], [640, 470]],
    [[530, 545], [570, 549], [610, 545], [650, 530]],
    [[566, 606], [610, 606], [650, 600]],
    [[497, 322], [520, 333], [560, 334], [603, 335]],
  ] as Pt[][],
  stroke: 13,
};

// the same real thumb, narrower (about its axis), a fingertip that tapers
const slim = (p: Pt): Pt => {
  const k = p[1] > 560 ? 0.8 : 0.8 - 0.07 * smooth((560 - p[1]) / 300);
  return [533 + (p[0] - 533) * k, p[1]];
};
const WOMAN = {
  outline: MAN.outline.map(slim),
  // long, soft-square, sides almost parallel, past the fingertip (as in the manicure photo)
  nail: [
    [486, 322], [482, 262], [483, 200], [489, 146], [505, 110], [532, 98], [560, 106], [578, 142], [586, 200], [587, 262], [582, 322],
    [560, 340], [532, 345], [506, 340],
  ] as Pt[],
  lines: [
    [[510, 510], [540, 509], [570, 503], [600, 490]],
    [[530, 544], [565, 547], [600, 538]],
  ] as Pt[][],
  shine: [[560, 150], [566, 210], [566, 280]] as Pt[],
  stroke: 11,
};

// ---- the swing ----
/** Fast move on the beat (5 frames, a small overshoot), then it holds. 0 = up, 1 = down. */
export const thumbPose = (t: number, beat: number, startDown = false) => {
  const k = Math.max(0, Math.floor(t / beat));
  const from = (k + (startDown ? 1 : 0)) % 2 === 0 ? 1 : 0;
  const to = 1 - from;
  const m = clamp01((t - k * beat) / 0.17);
  const c = 1.3;
  const e = 1 + (c + 1) * Math.pow(m - 1, 3) + c * Math.pow(m - 1, 2);
  return from + (to - from) * e;
};

const PIVOT: Pt = [620, 1300]; // the wrist, in photo pixels
const SCREEN: Pt = [1010, 1800]; // where the wrist sits in the reel
const SCALE = 0.85;

const rotate = (p: Pt, c: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)];
};

/** Photo pixels to the reel at this pose: the top joint leans back a little, the whole thumb turns on the wrist. */
const place = (p: Pt, pose: number, lag: number): Pt => {
  const top = smooth((640 - p[1]) / 200);
  const bent = rotate(p, [535, 560], 6 * lag * top);
  const r = rotate(bent, PIVOT, -60 * pose);
  return [SCREEN[0] + (r[0] - PIVOT[0]) * SCALE, SCREEN[1] + (r[1] - PIVOT[1]) * SCALE];
};

/** A smooth curve through the points (Catmull-Rom to Bezier). */
const curve = (pts: Pt[], closed = false) => {
  const n = pts.length;
  const get = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return closed ? d + "Z" : d;
};

export const ThumbLine: React.FC<{ pose: number; lag?: number; kind: ThumbKind; color: string; bg?: string; nail?: string }> = ({
  pose,
  lag = pose,
  kind,
  color,
  bg = "#07070A",
  nail,
}) => {
  const at = (pts: Pt[]) => pts.map((p) => place(p, pose, lag));
  const art = kind === "woman" ? WOMAN : MAN;
  const thin = art.stroke * 0.6;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <path d={curve(at(art.outline))} fill={bg} stroke={color} strokeWidth={art.stroke} strokeLinecap="round" strokeLinejoin="round" />
      {art.lines.map((l, i) => (
        <path key={i} d={curve(at(l))} fill="none" stroke={color} strokeWidth={thin} strokeLinecap="round" />
      ))}
      {kind === "woman" ? (
        <>
          <path d={curve(at(WOMAN.nail), true)} fill={nail ?? color} stroke={color} strokeWidth={art.stroke} strokeLinejoin="round" />
          <path d={curve(at(WOMAN.shine))} fill="none" stroke="#fff" strokeOpacity={0.75} strokeWidth={7} strokeLinecap="round" />
        </>
      ) : (
        <path d={curve(at(MAN.nail), true)} fill="none" stroke={color} strokeWidth={thin} strokeLinejoin="round" />
      )}
    </svg>
  );
};

/** visual "thumb". props: { kind?: "man" | "woman" (default from the coin: mrs = woman), beat?: seconds (0.444), color?, nail?, startDown? } */
export const Thumb: React.FC<VisualProps> = ({ local, fps, tl, theme, props = {} }) => {
  const beat = props.beat ?? 0.444;
  const name = (tl as any).presenter?.name;
  const kind: ThumbKind = props.kind ?? (name === "mrs" ? "woman" : "man");
  const color = props.color ?? theme.accent;
  const pose = thumbPose(local, beat, props.startDown);
  const lag = thumbPose(local - 1.5 / fps, beat, props.startDown); // the tip follows a little late
  return <ThumbLine pose={pose} lag={lag} kind={kind} color={color} nail={props.nail} />;
};
