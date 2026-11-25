// Motion primitives. Every number here is tuned the way the reference reel moves:
// spring with ~45% overshoot, 0.43 s whip pans, x1.08 zoom kicks, and idle life so nothing is still > 1.2 s.
import { interpolate, spring } from "remotion";
import type { MotionEvent } from "./types";

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const easeOut = (p: number) => 1 - Math.pow(1 - clamp(p), 3);
export const easeInOut = (p: number) => {
  p = clamp(p);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
};

export type Preset = "pop" | "snappy" | "soft" | "heavy";
type Spring = { damping: number; stiffness: number; mass: number };
// Motion profiles. "reel" = the reference reel (fast, ~45% overshoot). "calm" = the Tamrina rule
// (owner, Falcon reel 2026-10-24): the eye must follow -> ~5% overshoot, entrances 0.45-0.7 s, small kicks/shakes.
const PROFILES: Record<"reel" | "calm", { springs: Record<Preset, Spring>; kick: number; whip: number; whipBlur: number; shake: number; flash: number; idle: number }> = {
  reel: {
    springs: {
      pop: { damping: 9, stiffness: 180, mass: 0.7 },       // ~45% overshoot
      snappy: { damping: 14, stiffness: 220, mass: 0.6 },   // tiny overshoot
      soft: { damping: 18, stiffness: 120, mass: 1 },       // no overshoot
      heavy: { damping: 11, stiffness: 90, mass: 1.6 },
    },
    kick: 1.08, whip: 70, whipBlur: 4, shake: 10, flash: 0.6, idle: 1,
  },
  calm: {
    springs: {
      pop: { damping: 13.5, stiffness: 120, mass: 0.8 },    // ~5% overshoot, settles ~0.5 s
      snappy: { damping: 18, stiffness: 160, mass: 0.7 },   // ~1%
      soft: { damping: 20, stiffness: 100, mass: 1 },
      heavy: { damping: 16, stiffness: 90, mass: 1.4 },     // ~6%, ~0.7 s (stamps)
    },
    kick: 1.04, whip: 34, whipBlur: 1.5, shake: 8, flash: 0.3, idle: 0.7,
  },
};
let P = PROFILES.reel;
export const motionProfile = () => P;
/** Called by Reel on every frame (same props every frame -> deterministic). */
export const applyMotionProfile = (name?: string) => { P = PROFILES[name === "calm" ? "calm" : "reel"]; };

/** Spring 0 -> 1 with overshoot. */
export const springIn = (frame: number, fps: number, delayFrames = 0, preset: Preset = "pop") =>
  spring({ frame: frame - delayFrames, fps, config: P.springs[preset], durationInFrames: Math.round(fps * 0.9) });

/** Entrance transform for a block: from a direction, with spring. */
export const enter = (
  frame: number,
  fps: number,
  opts: { delay?: number; from?: "up" | "down" | "left" | "right" | "scale" | "none"; distance?: number; preset?: Preset } = {},
) => {
  const { delay = 0, from = "up", distance = 60, preset = "pop" } = opts;
  const s = springIn(frame, fps, delay, preset);
  const opacity = interpolate(frame - delay, [0, Math.round(fps * 0.18)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const d = (1 - s) * distance;
  let transform = "";
  if (from === "up") transform = `translateY(${d}px)`;
  else if (from === "down") transform = `translateY(${-d}px)`;
  else if (from === "left") transform = `translateX(${-d}px)`;
  else if (from === "right") transform = `translateX(${d}px)`;
  else if (from === "scale") transform = `scale(${0.6 + 0.4 * s})`;
  return { opacity, transform, s };
};

/** Zoom kick: a x1.08 punch that decays. Returns a multiplicative scale. */
export const zoomKick = (t: number, events: MotionEvent[], punch = 1.08, decay = 0.35) => {
  let scale = 1;
  punch = 1 + (punch - 1) * (P.kick - 1) / 0.08;
  for (const e of events) {
    if (e.kind !== "zoomKick" || t < e.t) continue;
    const age = t - e.t;
    if (age > decay * 1.5) continue;
    scale += (punch - 1) * (e.strength ?? 1) * Math.exp(-age * (4 / decay));
  }
  return scale;
};

/** Whip pan: a 0.43 s lateral whip with motion blur. Returns {x, blur}. */
export const whipPan = (t: number, events: MotionEvent[], duration = 0.43, amount = 70) => {
  let x = 0, blur = 0;
  amount *= P.whip / 70;
  for (const e of events) {
    if (e.kind !== "whipPan" || t < e.t || t > e.t + duration) continue;
    const p = (t - e.t) / duration;
    const dir = e.dir ?? (Math.round(e.t * 10) % 2 === 0 ? 1 : -1);
    x += dir * Math.sin(p * Math.PI) * amount * (e.strength ?? 1) * (1 - p * 0.5);
    blur += Math.sin(p * Math.PI) * P.whipBlur;
  }
  return { x, blur };
};

/** Shake: short decaying jitter. */
export const shake = (t: number, events: MotionEvent[], amp = 10, duration = 0.3) => {
  let x = 0, y = 0;
  amp *= P.shake / 10;
  for (const e of events) {
    if (e.kind !== "shake" || t < e.t || t > e.t + duration) continue;
    const p = (t - e.t) / duration;
    const env = (1 - p) * (e.strength ?? 1);
    x += Math.sin(t * 90) * amp * env;
    y += Math.cos(t * 70) * amp * 0.6 * env;
  }
  return { x, y };
};

/** Pop: scale bump (1 -> 1.18 -> 1) over 0.28 s. */
export const popScale = (t: number, events: MotionEvent[], peak = 1.18, duration = 0.28) => {
  let s = 1;
  for (const e of events) {
    if (e.kind !== "pop" || t < e.t || t > e.t + duration) continue;
    const p = (t - e.t) / duration;
    s += (peak - 1) * Math.sin(p * Math.PI) * (e.strength ?? 1);
  }
  return s;
};

/** Flash: brief white overlay opacity. */
export const flash = (t: number, events: MotionEvent[], duration = 0.18) => {
  let o = 0;
  for (const e of events) {
    if (e.kind !== "flash" || t < e.t || t > e.t + duration) continue;
    o = Math.max(o, (1 - (t - e.t) / duration) * P.flash * (e.strength ?? 1));
  }
  return o;
};

/** Idle life: slow float + tilt so an element is never perfectly still. seed separates elements. */
export const idle = (t: number, seed = 0, amp = 6, speed = 0.55) => {
  amp *= P.idle;
  const a = t * speed * Math.PI * 2 + seed * 1.7;
  return {
    x: Math.sin(a * 0.8 + seed) * amp * 0.6,
    y: Math.sin(a) * amp,
    rot: Math.sin(a * 0.6 + seed * 2.1) * amp * 0.25,
  };
};

/** Combine kick + whip + shake + idle into one transform for a stage container. */
export const stageTransform = (t: number, events: MotionEvent[], seed = 0, idleAmp = 5) => {
  const k = zoomKick(t, events);
  const w = whipPan(t, events);
  const s = shake(t, events);
  const i = idle(t, seed, idleAmp);
  return {
    transform: `translate(${(w.x + s.x + i.x).toFixed(2)}px, ${(s.y + i.y).toFixed(2)}px) rotate(${i.rot.toFixed(3)}deg) scale(${k.toFixed(4)})`,
    filter: w.blur > 0.2 ? `blur(${w.blur.toFixed(2)}px)` : undefined,
  };
};

// ---------------------------------------------------------------------------------------------------------------
// Seams + word entries, after the HyperFrames motion doctrine (heygen-com/hyperframes, Apache-2.0: "cut the curve",
// "waterfall"): a scene never settles to rest before a cut and never starts from rest after one. Exit and entry move
// along ONE axis in ONE direction (the reading direction), ~12 % of the frame, power4 in / out, the exit fades out
// before it has travelled far and the entry starts already at 0.35 opacity mid-path. No crossfades: the coin stays
// on screen across every cut and carries the eye. Numbers in guides/motion.md.
// ---------------------------------------------------------------------------------------------------------------
const p4in = (p: number) => Math.pow(clamp(p), 4);
const p4out = (p: number) => 1 - Math.pow(1 - clamp(p), 4);
/** back.out with overshoot s (1.4-1.7 allowed by the doctrine; bounce / elastic are not) */
export const backOut = (p: number, s = 1.5) => { p = clamp(p) - 1; return 1 + p * p * ((s + 1) * p + s); };

/**
 * Scene seam ("cut the curve"). local = seconds into the scene, dur = scene length, dir = +1 content moves right,
 * -1 left (Arabic reads right -> left, so its "forward" is left). Returns the transform + opacity + blur for the
 * scene's text + card layer. The exit lives in the scene's tail (the silent gap after the last word).
 */
export const seam = (local: number, dur: number, dir: 1 | -1, o: { entry?: boolean; exit?: boolean } = {}) => {
  const calm = P === PROFILES.calm;
  // blur is only a hint of speed (owner 2026-10-28: the heavy blur strained the eyes): 2.5 / 3 px at most
  const travel = calm ? 110 : 130, IN = calm ? 0.36 : 0.3, OUT = Math.min(calm ? 0.26 : 0.22, dur * 0.12), maxBlur = calm ? 2.5 : 3;
  let x = 0, opacity = 1, blur = 0;
  if (o.entry !== false && local < IN) {
    const p = local / IN;
    x = -dir * travel * (1 - p4out(p));
    opacity = 0.35 + 0.65 * Math.min(1, p / 0.35);
    blur = maxBlur * (1 - p4out(p * 1.4));
  }
  const left = dur - local;
  if (o.exit !== false && left < OUT) {
    const p = 1 - left / OUT;
    x += dir * travel * p4in(p);
    opacity *= 1 - clamp((p - 0.35) / 0.4);
    blur += maxBlur * p4in(p);
  }
  return { transform: `translateX(${x.toFixed(1)}px)`, opacity, filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined };
};

/**
 * Waterfall word entry: the word whips up from below and is there at once (2-frame fade, so it never reads as a
 * fade), heavy words rise further and take longer. frame = frames since the word's cue. Returns rise px, scale, opacity.
 */
export const waterfall = (frame: number, fps: number, heavy: boolean) => {
  const calm = P === PROFILES.calm;
  const dur = (heavy ? 0.19 : 0.15) * (calm ? 1.5 : 1), rise = (heavy ? 70 : 44) * (calm ? 0.75 : 1);
  const p = frame / (fps * dur);
  const e = p4out(p);
  return {
    rise: (1 - e) * rise,
    scale: heavy ? 0.7 + 0.3 * backOut(p, calm ? 1.4 : 1.7) : 0.94 + 0.06 * e,
    opacity: frame < 0 ? 0 : Math.min(1, (frame + 1) / 2),
  };
};

/** Count-up helper with ease-out. */
export const countUp = (p: number, from: number, to: number) => Math.round(from + (to - from) * easeOut(p));

export const fmt = (n: number | string | undefined) =>
  typeof n === "number" ? n.toLocaleString("en-US") : (n ?? "");
