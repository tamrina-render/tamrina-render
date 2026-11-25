// Beat timing for FactBet (videos/bet-salary): 8 line starts + named word times (seconds). A new take only needs new props:
//   node scripts/bet-props.mjs videos/bet-salary/timeline.json > videos/bet-salary/out/factbet/props.json

/** line starts of the approved take (2026-11-20): 0 اتنين · 1 والنتيجة · 2 الفكرة · 3 لقوا · 4 واللي · 5 بس · 6 تخيّل · 7 تمرينة */
export const BET_STARTS = [0, 4.9, 7.58, 13.82, 19.5, 22.19, 25.78, 30.39];
export const BET_WORDS = {
  half: 1.79, // نص: the coin pile splits in two rings over the two heads
  lose1: 3.77, // يخسّوا: the red one reaches for the cake, his coins snatch it away (the laugh)
  lost: 6.33, // خسّوا: both pop thin, flex, ✓ ✓, the coins drop back to them
  company: 9.79, // شركة: the company slams down behind them
  analysed: 10.55, // وحللوا: goal flags rain down around them, the counter runs
  n125: 11.08, // 125
  thousand: 12.45, // ألف: the counter lands on 125,000
  loseIt: 15.11, // يخسرها: the grey runners give up one by one
  n29: 17.09, // 29: three of ten break the tape, the grey «29%»
  has: 19.78, // عنده: whip pan to the gold track
  n80: 20.46, // 80: eight of ten break the tape, confetti, the lime «80%», a shake
  bet: 23.22, // تراهن: the coin pile is swept off
  gym: 24.71, // الجيم: the dumbbell drops
  partner: 26.55, // بارتنر: the partner waves, the line to the coin draws
  waiting: 26.89, // مستنيك: he checks his watch
  skip: 28.15, // خلعت: the line snaps
  warn: 29.11, // إنذار: the warning card
  tamrina: 30.41, // تمرينة: the logo, the line joins again
  come: 33.04, // تيجي: the partner waves him in, the door opens
};
export const BET_DURATION = 35.067;
export type BetWords = typeof BET_WORDS;

export type BetBeats = { s: number[]; w: BetWords; end: number; fps: number };

export const makeBetBeats = (starts: number[] | undefined, words: Partial<BetWords> | undefined, fps: number, durationSec: number): BetBeats => {
  const s = BET_STARTS.map((d, i) => Math.round((starts?.[i] ?? d) * fps));
  const ws = { ...BET_WORDS, ...(words ?? {}) };
  const w = Object.fromEntries(Object.entries(ws).map(([k, v]) => [k, Math.round(v * fps)])) as BetWords;
  return { s, w, end: Math.ceil(durationSec * fps - 1e-6), fps };
};
