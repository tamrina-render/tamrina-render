// Beat timing for FactTitanic: everything is derived from the voice-track clause starts and a few word times (seconds).
// A new voice take only needs new `starts` / `words` / `durationSec`.

export const TITANIC_STARTS = [0, 1.96, 4.2, 5.46, 6.87, 9.06, 14.47, 17.05, 18.8, 22.64, 25.94, 28.57];
export const TITANIC_WORDS = { horse: 14.85, rower: 15.46, bike: 16.22, tilt: 20.56 };
export const TITANIC_DURATION = 32.36;

export type TitanicWords = typeof TITANIC_WORDS;

export type TBeats = {
  /** clause start frames, 12 entries */
  s: number[];
  /** frame the picture for clause i arrives (4 frames before it is spoken) */
  cut: (i: number) => number;
  /** word frames */
  w: TitanicWords;
  end: number;
  fps: number;
};

export const makeTitanicBeats = (starts: number[] | undefined, words: Partial<TitanicWords> | undefined, fps: number, durationSec: number): TBeats => {
  const sec = TITANIC_STARTS.map((d, i) => starts?.[i] ?? d);
  const s = sec.map((t) => Math.round(t * fps));
  const ws = { ...TITANIC_WORDS, ...(words ?? {}) };
  const w: TitanicWords = { horse: Math.round(ws.horse * fps), rower: Math.round(ws.rower * fps), bike: Math.round(ws.bike * fps), tilt: Math.round(ws.tilt * fps) };
  return { s, cut: (i) => (i === 0 ? 0 : s[i] - 4), w, end: Math.round(durationSec * fps), fps };
};
