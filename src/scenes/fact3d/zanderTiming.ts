// Beat timing for FactZander: everything is derived from the voice-track clause starts and a few word times (seconds).
// A new voice take only needs new `starts` / `words` / `durationSec` (scripts/zander-props.mjs builds them from timeline.json).

/** clause starts: 0 من · 1 كان · 2 الناس · 3 دكتور (scene) · 4 ستوكهولم · 5 فيه · 6 طب · 7 الصور · 8 الحمد (scene) · 9 دلوقتي · 10 ناقص · 11 استنى · 12 أهو */
export const ZANDER_STARTS = [0, 2.27, 3.72, 5.94, 8.3, 9.22, 11.45, 12.6, 18.52, 21.39, 23.45, 25.18, 26.43];
export const ZANDER_WORDS = { suits: 4.7, dresses: 5.04, opened: 7.54, n27: 9.45, man: 14.0, lady: 16.26, look: 19.4, same: 28.07, sent: 29.92, accepted: 30.84, go: 31.68 };
export const ZANDER_DURATION = 33.414;

export type ZanderWords = typeof ZANDER_WORDS;

export type ZBeats = {
  /** clause start frames (13) */
  s: number[];
  /** frame the picture for clause i arrives (4 frames before it is spoken) */
  cut: (i: number) => number;
  /** word frames */
  w: ZanderWords;
  /** camera locked from here to the end */
  lock: number;
  /** old -> modern morph window (complete before beat 10) */
  mA: number;
  mB: number;
  /** counter: first tick, landing on 27, gone */
  cA: number;
  cB: number;
  cOut: number;
  /** the white flashes (first frame of each) */
  flash1: number;
  flash2: number;
  /** phone: in, ring 1, ring 2, press, swap, out start, out end; logo in */
  phIn: number;
  ring1: number;
  ring2: number;
  press: number;
  swap: number;
  phOut: number;
  phGone: number;
  logo: number;
  end: number;
  fps: number;
};

export const makeZanderBeats = (starts: number[] | undefined, words: Partial<ZanderWords> | undefined, fps: number, durationSec: number): ZBeats => {
  const sec = ZANDER_STARTS.map((d, i) => starts?.[i] ?? d);
  const s = sec.map((t) => Math.round(t * fps));
  const ws = { ...ZANDER_WORDS, ...(words ?? {}) };
  const w = Object.fromEntries(Object.entries(ws).map(([k, v]) => [k, Math.round(v * fps)])) as ZanderWords;
  const end = Math.round(durationSec * fps);
  const cA = w.n27 - 5;
  const cB = Math.max(cA + 20, Math.round(w.n27 + 0.85 * fps));
  return {
    s,
    cut: (i) => (i === 0 ? 0 : s[i] - 4),
    w,
    lock: s[8] - 10,
    mA: s[9] - 4,
    mB: Math.min(s[10] - 6, s[9] - 4 + Math.round(1.9 * fps)),
    cA,
    cB,
    cOut: Math.min(cB + Math.round(1.0 * fps), s[6] - 5),
    flash1: w.man,
    flash2: w.lady,
    phIn: s[11] - 4,
    ring1: s[12] - 2,
    ring2: w.same - 3,
    press: w.sent,
    swap: w.accepted,
    phOut: w.go - 2,
    phGone: Math.min(end - 30, w.go + Math.round(0.7 * fps)),
    logo: end - fps,
    end,
    fps,
  };
};
