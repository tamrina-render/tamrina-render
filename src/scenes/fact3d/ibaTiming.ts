// Beat timing for FactIba: everything comes from the voice-track clause starts and a few moments (seconds).
// A new voice take only needs new `starts` / `words` / `durationSec` (take / speaker / step follow the starts unless given).

export const IBA_STARTS = [0, 2.2, 4.4, 6.0, 7.6, 9.6, 11.2, 13.0, 15.6, 18.0, 19.6, 20.6, 21.8, 23.4, 24.6, 25.4];
export const IBA_WORDS = { clack: 18.9 };
export const IBA_DURATION = 28.0;

export type IbaWords = typeof IBA_WORDS;

export type IBeats = {
  /** clause start frames, 16 entries */
  s: number[];
  /** frame the picture for clause i arrives (4 frames before it is spoken) */
  cut: (i: number) => number;
  /** the two clapper hits */
  clack: number;
  clack2: number;
  /** the clappers vanish from her hands */
  take: number;
  /** the speaker pops onto the floor */
  speaker: number;
  /** the row's one step together */
  step: number;
  /** 3D -> painted wall crossfade (10 frames) and back */
  rA: number;
  rB: number;
  bA: number;
  bB: number;
  /** the clapping goes from 2/s to 3/s (beat 7) */
  fast: number;
  /** from here the camera never moves */
  lock: number;
  end: number;
  fps: number;
};

export const makeIbaBeats = (
  starts: number[] | undefined,
  words: Partial<IbaWords> | undefined,
  take: number | undefined,
  speaker: number | undefined,
  step: number | undefined,
  fps: number,
  durationSec: number,
): IBeats => {
  const sec = IBA_STARTS.map((d, i) => starts?.[i] ?? d);
  const s = sec.map((t) => Math.round(t * fps));
  const ws = { ...IBA_WORDS, ...(words ?? {}) };
  const F = (t: number) => Math.round(t * fps);
  const lock = s[10] - 3;
  // the flat wall arrives with beat 5 and leaves just before beat 8 (both inside their beats, whatever the take)
  const rB = Math.max(s[4] + 22, s[5] - 2);
  const rA = rB - 10;
  const bB = Math.min(s[8] - 2, s[9] - 30);
  const bA = bB - 10;
  const clack = Math.min(Math.max(F(ws.clack), s[9] + 4), lock - 14);
  const clack2 = Math.min(clack + Math.round(0.35 * fps), lock - 3);
  return {
    s,
    cut: (i) => (i === 0 ? 0 : s[i] - 4),
    clack,
    clack2,
    take: Math.max(lock + 3, F(take ?? sec[10] + 0.5)),
    speaker: Math.max(lock + 6, F(speaker ?? sec[11] + 0.3)),
    step: F(step ?? sec[14] + 0.4),
    rA,
    rB,
    bA,
    bB,
    fast: Math.min(s[7] + 8, bA - 10),
    lock,
    end: F(durationSec),
    fps,
  };
};

/**
 * The music: a phase whose whole numbers are the claps (2/s, then 3/s from beat 7, landing exactly on the first
 * clapper hit), silent after the take, and the speaker's own 2/s beat after it pops in. `amt` = how much they dance.
 */
export const danceAt = (f: number, B: IBeats): { ph: number; amt: number; speakerBeat: boolean } => {
  const P1 = B.fps / 2;
  const ph0 = 0.35; // already mid-step at frame 0
  const phFast = ph0 + B.fast / P1;
  const N = Math.round(phFast + (B.clack - B.fast) / (B.fps / 3));
  const r2 = (N - phFast) / Math.max(1, B.clack - B.fast);
  const go = B.speaker + 6;
  if (f < B.fast) return { ph: ph0 + f / P1, amt: 1, speakerBeat: false };
  if (f < go) {
    const amt = f < B.take ? 1 : 1 - Math.min(1, (f - B.take) / 8);
    return { ph: phFast + (f - B.fast) * r2, amt, speakerBeat: false };
  }
  const ramp = Math.min(1, (f - go) / 6);
  const stop = 1 - Math.min(1, Math.max(0, (f - B.s[14]) / 8));
  return { ph: (f - go) / P1, amt: ramp * stop, speakerBeat: true };
};
