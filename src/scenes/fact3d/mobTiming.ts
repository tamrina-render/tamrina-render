// Beat timing for FactMob: everything is derived from the voice-track clause starts and a few word times (seconds).
// A new voice take only needs new `starts` / `words` / `durationSec` (and optionally `joins`).

export const MOB_STARTS = [0, 2.6, 5.2, 7.4, 9.8, 11.6, 14.0, 17.6, 20.4, 24.2, 26.6, 29.4, 32.4];
export const MOB_WORDS = { not: 1.7, five: 6.6, rule: 19.2, year: 22.9 };
export const MOB_DURATION = 36.5;
export const MOB_POST_IMGS = [1, 2, 3, 4, 5].map((i) => `footage/mob-football/app/post-${i}.png`);

export type MobWords = typeof MOB_WORDS;

export type MBeats = {
  /** clause start frames, 13 entries */
  s: number[];
  /** frame the picture for clause i arrives (4 frames before it is spoken) */
  cut: (i: number) => number;
  /** word frames */
  w: MobWords;
  /** the four arrival frames of beat 13 (post card swaps 2/5 .. 5/5) */
  joins: number[];
  /** the castle -> modern pitch morph window (tail of beat 9): starts ~0.5 s after "year", done 3 frames before beat 10 */
  mA: number;
  mB: number;
  end: number;
  fps: number;
};

/** Default arrival times (seconds): four even steps after beat 13 starts, the last ~1.6 s before the end. */
export const defaultJoins = (s12: number, durationSec: number) => {
  const a = s12 + 0.45;
  const b = Math.max(a + 0.9, durationSec - 1.6);
  return [0, 1, 2, 3].map((i) => a + ((b - a) * i) / 3);
};

export const makeMobBeats = (
  starts: number[] | undefined,
  words: Partial<MobWords> | undefined,
  joins: number[] | undefined,
  fps: number,
  durationSec: number,
): MBeats => {
  const sec = MOB_STARTS.map((d, i) => starts?.[i] ?? d);
  const s = sec.map((t) => Math.round(t * fps));
  const ws = { ...MOB_WORDS, ...(words ?? {}) };
  const w: MobWords = { not: Math.round(ws.not * fps), five: Math.round(ws.five * fps), rule: Math.round(ws.rule * fps), year: Math.round(ws.year * fps) };
  const dj = defaultJoins(sec[12], durationSec);
  const j = [0, 1, 2, 3].map((i) => Math.round((joins?.[i] ?? dj[i]) * fps));
  const mB = s[9] - 3;
  const mA = Math.max(s[8] + 12, Math.min(Math.round(w.year + 0.5 * fps), s[9] - 24));
  return { s, cut: (i) => (i === 0 ? 0 : s[i] - 4), w, joins: j, mA, mB, end: Math.round(durationSec * fps), fps };
};
