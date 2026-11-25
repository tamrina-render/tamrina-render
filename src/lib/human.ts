// The human layer (phase 1, 2026-11-07): the coin moves like a person talking, not like a metronome.
// - idle = smooth seeded noise (two octaves) instead of sine waves: never repeats, never in sync with another coin
// - the head follows the VOICE (tl.pros from scripts/lipsync.mjs voiceProsody): a small nod that leads each
//   accented syllable by ~60 ms, a tilt that rides the intonation, a slow yaw drift while talking
// - brows follow the pitch 2 frames after the head; an in-breath before each phrase
// - gestures: prep -> stroke on the accent -> hold -> retract (planHands in Coin3D), beats on the next accents
// - listeners nod at the speaker's pauses (tl.hear, built per coin in viewFor)
// Pure functions of t (+ seed): motion-check and patch renders need the same frame every time.
// Off: "presenter": {"look": {"human": false}}. Numbers: guides/motion.md "Human layer".
import type { PresenterConfig, Timeline } from "./types";

const h = (k: number) => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Smooth value noise in -1..1 (quintic fade), `freq` lattice points per second. */
export const noise = (t: number, seed: number, freq = 1) => {
  const x = t * freq + seed * 17.31, i = Math.floor(x), f = x - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  const a = h(i + seed * 101.7) * 2 - 1, b = h(i + 1 + seed * 101.7) * 2 - 1;
  return a + (b - a) * u;
};
/** Two octaves: a slow drift with a little faster life on top (about -1..1). */
export const fbm = (t: number, seed: number, freq = 1) => noise(t, seed, freq) * 0.7 + noise(t, seed + 3.7, freq * 2.17) * 0.3;

/** 0 = the layer is off for this coin; else its amplitude (the brand's calm profile = 0.75). */
export const humanAmp = (tl: Timeline, cfg: PresenterConfig) => (cfg.look?.human === false ? 0 : tl.motion === "calm" ? 0.9 : 1);

/** Pitch in semitones from the speaker's median at time t (0 without prosody / unvoiced). */
export const pitchAt = (tl: Timeline, t: number) => {
  const p = tl.pros;
  if (!p || !p.p.length) return 0;
  const x = t * p.fps, i = Math.floor(x);
  if (i < 0 || i >= p.p.length - 1) return 0;
  return p.p[i] + (p.p[i + 1] - p.p[i]) * (x - i);
};

/** A one-sided bump: 0 at d = 0, peak 1 at d = peak, then a soft decay (gamma shape); 0 outside [0, len]. */
const bump = (d: number, peak: number, len: number) => (d <= 0 || d >= len ? 0 : (d / peak) * Math.exp(1 - d / peak) * Math.min(1, (len - d) / (len * 0.3)));

/** Head nod: one dip per accented syllable, its bottom `lead` s before the syllable peak (the head leads the voice). */
export const accentNod = (tl: Timeline, t: number, minS = 0.45, lead = 0.06) => {
  let n = 0;
  for (const a of tl.pros?.acc ?? []) {
    if (a.s < minS) continue;
    const d = t - (a.t - lead - 0.14);
    if (d > 0 && d < 0.6) n += a.s * bump(d, 0.14, 0.6);
  }
  return Math.min(1.4, n);
};

/** An eyebrow flash on the strongest accents (s >= 0.85), 2 frames after the head. */
export const browFlash = (tl: Timeline, t: number) => {
  let n = 0;
  for (const a of tl.pros?.acc ?? []) if (a.s >= 0.85) { const d = t - (a.t - 0.08); if (d > 0 && d < 0.55) n = Math.max(n, bump(d, 0.12, 0.55)); }
  return n;
};

/** In-breath before each phrase (a word after >= 0.35 s of quiet, or the scene's first word): 0..1. */
export const inBreath = (tl: Timeline, t: number) => {
  let n = 0;
  for (const sc of tl.scenes) {
    if (t < sc.start - 0.6 || t > sc.end) continue;
    sc.words.forEach((w, i) => {
      if (i > 0 && w.start - sc.words[i - 1].end < 0.35) return;
      const d = t - (w.start - 0.42);
      if (d > 0 && d < 0.55) n = Math.max(n, Math.sin(Math.min(1, d / 0.38) * Math.PI * 0.5) * Math.min(1, (0.55 - d) / 0.17));
    });
  }
  return n;
};

/** Listener backchannel: a small double nod ("aha") a moment after each pause of the other speaker (tl.hear). */
export const listenNod = (tl: Timeline, t: number, seed: number) => {
  let n = 0;
  (tl.hear?.nods ?? []).forEach((at, i) => {
    const d = t - (at + 0.12 + 0.25 * h(i * 3.1 + seed * 7));
    if (d > 0 && d < 0.9) n += bump(d, 0.13, 0.45) + 0.6 * bump(d - 0.3, 0.13, 0.45);
  });
  return n;
};

/** Which way this scene's head tilt goes (people tilt one side per phrase, not always the same one). */
export const tiltSide = (tl: Timeline, t: number, seed: number) => {
  const i = tl.scenes.findIndex((sc) => t >= sc.start && t < sc.end);
  return h(i * 5.3 + seed * 11) > 0.5 ? 1 : -1;
};
