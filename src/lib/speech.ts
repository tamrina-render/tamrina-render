// Speech-driven signals shared by the presenters: is a word being said, how strong is the emphasis right now,
// and the moments a character should change gesture (scene starts + emphasized words ≥ 1.3 s apart).
import type { Timeline } from "./types";

export const speakingAt = (tl: Timeline, t: number) => {
  for (const sc of tl.scenes) {
    if (t < sc.start - 0.05 || t > sc.end) continue;
    for (const w of sc.words) if (t >= w.start - 0.03 && t <= w.end + 0.04) return true;
  }
  return false;
};

/** 0..1, peaks a beat before an emphasized word is spoken and decays over ~0.65 s. */
export const emphasisAt = (tl: Timeline, t: number) => {
  let v = 0;
  for (const sc of tl.scenes) for (const w of sc.words) if (w.emph && t >= w.start - 0.15 && t < w.start + 0.5) { const d = t - (w.start - 0.15); v = Math.max(v, Math.min(d / 0.1, 1 - d / 0.65)); } // rises over 0.1 s (it popped to full in one frame)
  return v;
};

/** Gesture change points, sorted: every scene start + emphasized words at least 1.3 s after the previous point. */
export const changePoints = (tl: Timeline) => {
  const changes: number[] = [];
  for (const sc of tl.scenes) {
    changes.push(sc.start);
    for (const w of sc.words) if (w.emph && w.start - changes[changes.length - 1] > 1.3) changes.push(w.start - 0.12);
  }
  return changes.sort((a, b) => a - b);
};

// Rhubarb mouth shapes -> how open / wide / round the mouth is (https://github.com/DanielSWolf/rhubarb-lip-sync#mouth-shapes)
const VIS: Record<string, { o: number; w: number; r: number }> = {
  X: { o: 0, w: 1, r: 0 }, A: { o: 0.06, w: 0.95, r: 0 }, B: { o: 0.32, w: 1, r: 0 }, C: { o: 0.55, w: 1.02, r: 0 },
  D: { o: 0.95, w: 1.06, r: 0 }, E: { o: 0.6, w: 0.78, r: 1 }, F: { o: 0.38, w: 0.55, r: 1 }, G: { o: 0.2, w: 0.95, r: 0 }, H: { o: 0.45, w: 0.98, r: 0 },
};
/** Mouth at time t from tl.mouth (blends 60 ms into each new shape), or null when there are no cues. */
export const visemeAt = (tl: Timeline, t: number) => {
  const cues = tl.mouth;
  if (!cues || !cues.length) return null;
  let i = -1;
  for (let k = 0; k < cues.length; k++) if (cues[k].t <= t) i = k; else break;
  if (i < 0) return VIS.X;
  const cur = VIS[cues[i].v] ?? VIS.X, prev = i > 0 ? VIS[cues[i - 1].v] ?? VIS.X : VIS.X;
  const x = Math.min(1, (t - cues[i].t) / 0.08), k = x * x * (3 - 2 * x); // smoothstep: lips ease into each shape
  return { o: prev.o + (cur.o - prev.o) * k, w: prev.w + (cur.w - prev.w) * k, r: prev.r + (cur.r - prev.r) * k };
};

export type HandPose = "open" | "point" | "thumb" | "fist" | "count1" | "count2" | "count3";
/**
 * Coin hand gestures. Scene "gesture" wins; otherwise: point up at the visual on the scene's first emphasized word (1.4 s),
 * thumbs up through the last scene, nothing in the first scene (the wave is there). Each blends in 0.25 s / out 0.3 s.
 */
export const gestureAt = (tl: Timeline, t: number) => {
  let r = { pose: "open" as HandPose, angle: 0, w: 0 };
  // the other hand is never still (owner): it rests ON THE HIP and breathes, and lifts in an open "explaining" gesture
  // on the scene's other stressed words (not while the right hand points / gives a thumbs up)
  let explain = 0;
  for (const sc of tl.scenes) {
    if (t < sc.start - 0.3 || t > sc.end + 0.5) continue;
    sc.words.filter((w) => w.emph).slice(1).forEach((w) => {
      const a = w.start - 0.3, b = w.start + 0.75;
      if (t > a && t < b) { const x = Math.max(0, Math.min(1, (t - a) / 0.25, (b - t) / 0.35)); explain = Math.max(explain, x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2); }
    });
  }
  const last = tl.scenes.length - 1;
  tl.scenes.forEach((sc, i) => {
    if (t < sc.start || t > sc.end) return;
    const g = sc.gesture ?? (i === last ? "thumb" : i > 0 && sc.visual?.type && sc.visual.type !== "none" ? "point" : null);
    if (!g || g === "none" || g === "wave") return;
    let a = sc.start + 0.2, b = sc.end - 0.1;
    if (g === "point") { const e = sc.words.find((w) => w.emph); a = (e ? e.start : sc.start + 0.4) - 0.25; b = a + 1.4; }
    if (t < a || t > b) return;
    const x = Math.max(0, Math.min(1, (t - a) / 0.25, (b - t) / 0.3));
    const w = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    if (g !== "hip") r = { pose: g as HandPose, angle: g === "point" ? -32 : 22, w };
  });
  explain *= 1 - r.w;
  const hipAngle = -24 + Math.sin(t * 1.4) * 4;
  // l.w = how much the arm follows l.angle instead of its free swing (always fully posed now); curl = fist on the hip
  const l = { pose: "fist" as HandPose, angle: hipAngle + (62 - hipAngle) * explain, w: 1, curl: 1 - explain };
  return { r, l };
};

/** Voice loudness 0..1 at time t (linear between frames), or null without an envelope. */
export const loudnessAt = (tl: Timeline, t: number) => {
  const e = tl.env;
  if (!e || !e.v.length) return null;
  const x = t * e.fps, i = Math.floor(x);
  if (i < 0 || i >= e.v.length - 1) return e.v[Math.max(0, Math.min(e.v.length - 1, i))] ?? 0;
  return e.v[i] + (e.v[i + 1] - e.v[i]) * (x - i);
};

// ---------- {cue} animations (gestures, body actions, fx), see characters/coin/README.md ----------
/** seconds each cue lasts */
export const GESTURE_CUES: Record<string, number> = { clap: 1.6, clack: 1.5, cross: 2.2, shrug: 1.3, facepalm: 1.5, chin: 2, think: 2, count: 1.9, wave: 1.2, point: 1.4, you: 1.6, thumb: 1.5, hip: 2.2, flex: 1.5, watch: 1.8 };
export const ACTION_CUES: Record<string, number> = { take: 1.3, doubletake: 1.5, hop: 0.5, jump: 0.95, flip: 1.15, toss: 1.6, roll: 1.7, spin: 2, poof: 0.75, walkIn: 1.5, walkOut: 1.4, flyIn: 1.15, dance: 2.4, highfive: 1.1, faceplant: 4.4, grab: 2.8,
  lean: 60, sit: 60, peek: 60, push: 60, sign: 60,
  curl: 2.6, press: 2.6, raise: 2.7, squat: 2.6, run: 2.4, box: 2.3, jacks: 2.2, drink: 2.2, eat: 2.6, shaker: 1.8, doubleflex: 1.6,
  tree: 3.2, warrior: 3, lotus: 3.8, swim: 4.4, pilates: 3.1, bellydance: 3.4, rope: 2.6, hoop: 3, selfie: 2.6, hearthands: 2, kiss: 1.9, cheer: 2.6,
  // personality kit (characters/coin/bible.md, one per emotion row, 2026-10-28); aliases share one move
  no: 1.3, nod: 1.4, serious: 1.6, stubborn: 2.2, drama: 2.2, sulk: 3, diva: 1.8, protect: 2, cough: 1.4, toldyou: 1.4, eyeroll: 1.2,
  wow: 1.4, plan: 2.2, tap: 2.4, impatient: 2.4, oops: 1.8, hungry: 2.2, yawn: 2.4, nudge: 1.4, scared: 2,
  // football (the ball: tl.ball, scripts/timeline.mjs). kick = wind-up, the foot meets the ball at +0.35 s (KICK_CONTACT)
  kick: 0.9, juggle: 2.6, keeper: 3, dive: 1.3, hit: 4.4, crash: 3,
  // the angry trainer (videos/ndl): shouts "get down" pointing at the floor + a stomp, "come back up" palms up, a shove, a scuffle; {drop} lets go of the barbell
  yell: 1.3, comeup: 1.3, shove: 0.9, slap: 0.85, slapped: 1.2, sideplank: 2.3, daydream: 60, yogasit: 60, scuffle: 2.8, drop: 0.7, hold: 12, cower: 12, hang: 12,
  // on the phone, fed up (videos/leg-day-call): the free hand swats the air
  shoo: 1.5,
  // phone in hand (outfit "phone", videos/waffarha-story): eyes down at the phone, the holding thumb flicks up every 0.48 s
  scroll: 2.4,
  // a tracking shot (videos/waffarha-story): he walks in place, turned 3/4 to the screen's left, while the film's camera travels with him
  walkon: 1.8,
  // the same walk turned away from the camera, into the picture (the camera travels forward with him)
  walkaway: 1.8,
  // a secret (videos/spot-tour): {whisper} leans into the lens, a hand cupped by the mouth, the other holding the camera; {splash} = seated with "dangle", the feet kick the water in turn. Both hold until their scene ends
  whisper: 12, splash: 12 };
/** {kick}: when the foot meets the ball, seconds after the cue (the ball leaves then; timeline.mjs uses the same number) */
export const KICK_CONTACT = 0.35;
// camera cues (whole frame): shake, a zoom punch, a meme freeze frame
export const CAMERA_CUES: Record<string, number> = { shake: 0.55, punch: 0.6, freeze: 1.6 };
/** cues that hold a pose until their scene ends (card interactions) */
export const STATE_CUES = new Set(["lean", "sit", "peek", "push", "sign", "hang", "whisper", "splash"]); // hang: holds on until its scene ends
export const FX_CUES: Record<string, number> = { confetti: 2, bulb: 1.4, question: 1.4, exclaim: 1, sparkle: 1.3, hearts: 1.8, steam: 1.6, sweat: 1.6, zzz: 2.2, impact: 0.5, puff: 0.6 };

export type ActiveCue = { name: string; lt: number; dur: number; p: number; w: number };
/** The cue of `table` running at time t (the latest one that started), with local time, progress and a blend weight. */
export const cueAt = (tl: Timeline, t: number, table: Record<string, number>, fadeIn = 0.2, fadeOut = 0.25): ActiveCue | null => {
  let best: ActiveCue | null = null;
  const starts = tl.scenes.flatMap((sc) => (sc.cues ?? []).filter((c) => table[c.name] !== undefined).map((c) => c.t)).sort((x, y) => x - y);
  for (const sc of tl.scenes) for (const c of sc.cues ?? []) {
    let dur = STATE_CUES.has(c.name) ? sc.end - c.t : table[c.name];
    // {sign}: kept up through the next scenes that show the same "sign" (one cue = he holds it while he talks, no lowering at the cuts)
    if (c.name === "sign" && sc.sign) { let k = tl.scenes.indexOf(sc); while (tl.scenes[k + 1]?.sign === sc.sign) k++; dur = tl.scenes[k].end - c.t; }
    if (c.name === "faceplant") { const back = tl.scenes.find((s2) => s2.start > sc.start && s2.words.length); if (back) dur = Math.max(1.5, back.start + 0.35 - c.t); }
    // {hit} (the ball in the face): he stays down until he speaks again, else to the end of the video
    // {grab} (the heavy dumbbell): he stays dragged down to the end of the scene his 2.8 s land in, so the weight never vanishes mid-line
    if (c.name === "grab" && dur !== undefined) { const scEnd = tl.scenes.find((s2) => s2.start <= c.t + dur! && s2.end > c.t + dur!)?.end; dur = Math.max(dur!, (scEnd ?? 0) - c.t); }
    if (c.name === "hit") { const back = tl.scenes.find((s2) => s2.start > c.t + 0.5 && s2.words.length); dur = Math.max(2.5, back ? back.start + 0.35 - c.t : tl.durationSec - c.t + 0.5); }
    const next = starts.find((x) => x > c.t + 1e-6);
    if (dur !== undefined && next !== undefined) dur = Math.min(dur, next - c.t);
    if (dur === undefined || t < c.t || t > c.t + dur) continue;
    const lt = t - c.t;
    if (!best || lt < best.lt) best = { name: c.name, lt, dur, p: lt / dur, w: Math.max(0, Math.min(1, lt / fadeIn, (dur - lt) / fadeOut)) };
  }
  return best;
};
/** every fx cue running at t */
export const fxAt = (tl: Timeline, t: number): ActiveCue[] => {
  const out: ActiveCue[] = [];
  for (const sc of tl.scenes) for (const c of sc.cues ?? []) {
    const dur = FX_CUES[c.name];
    if (dur !== undefined && t >= c.t && t <= c.t + dur) out.push({ name: c.name, lt: t - c.t, dur, p: (t - c.t) / dur, w: 1 });
  }
  return out;
};
