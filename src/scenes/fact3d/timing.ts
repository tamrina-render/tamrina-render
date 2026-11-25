// Beat timing: everything in the film is derived from the voice-track clause starts (seconds).
// A new voice take only needs a new `starts` list (and `durationSec`).

export const DEFAULT_STARTS = [0, 2.16, 3.72, 7.61, 8.8, 10.46, 12.73, 14.39, 16.63, 18.72, 21.81, 23.06, 24.77];
export const DEFAULT_DURATION = 28;

export type Beats = {
  /** clause start frames, 13 entries */
  s: number[];
  /** frame the picture for clause i appears (4 frames before it is spoken) */
  cut: (i: number) => number;
  /** frame the gym people freeze on the word "naked" */
  freeze: number;
  end: number;
};

export const makeBeats = (starts: number[] | undefined, fps: number, durationSec: number, nakedWordSec?: number): Beats => {
  const sec = DEFAULT_STARTS.map((d, i) => starts?.[i] ?? d);
  const s = sec.map((t) => Math.round(t * fps));
  // the last word of clause 3 lands about 1 s before clause 4 starts, unless told otherwise
  const freeze = Math.round((nakedWordSec ?? sec[3] - 1.0) * fps);
  return { s, cut: (i) => (i === 0 ? 0 : s[i] - 4), freeze, end: Math.round(durationSec * fps) };
};
