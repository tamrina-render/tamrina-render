// Beat timing + the locked camera + the two Reformer carriages for FactPilates (videos/pilates-bed).
// Self-contained on purpose (no imports): scripts/pilates-props.mjs imports this file in Node to project the carriage
// seats through the locked camera into the coins' ride tracks, so the film and the coins use ONE motion function.
// A new voice take only needs new `starts` / `words` / `durationSec` (scripts/pilates-props.mjs builds them).

/** the 9 line starts (s): the approved take, line 7 re-recorded 2026-11-17 («استني كده.. هفتح تمرينة.») */
export const PIL_STARTS = [0, 4.419, 11.15, 17.214, 22.116, 25.185, 29.543, 31.857, 35.561];
/** named word starts (s), in the order they are spoken */
export const PIL_WORDS = {
  pilates: 0.47, reel: 1.49, story: 2.25, bed: 3.2, hosp: 3.56,
  n110: 4.75, years: 5.44, man: 6.16, joseph: 7.33, jailed: 8.35, camp: 8.93, island: 9.8, england: 10.31,
  untie: 12.57, springs: 12.94, beds: 13.33, tie: 14.21, patients: 15.12, train: 15.63, lying: 16.5,
  out: 17.8, thebed: 18.38, reformer: 19.41, bysprings: 20.49, moves: 21.07,
  found: 23.64, train5: 24.37, me: 25.18, but: 27.4, nobody: 28.31,
  wait: 29.54, here: 31.86, girl: 32.51, same: 34.55, sent: 35.56, accepted: 36.65, go: 37.52, us: 37.82,
};
export const PIL_DURATION = 40.446;
export type PilWords = typeof PIL_WORDS;

type V3 = [number, number, number];

// ---------------------------------------------------------------- the final, locked camera (from `lock` to the end)
export const FIN_P: V3 = [-0.35, 8, 15];
export const FIN_L: V3 = [-0.35, 0.3, 0];
export const FIN_FOV = 34;

// ---------------------------------------------------------------- the Reformers (world units; a Blocky person is ~2.65 tall)
// Local frame of a Reformer: x from the foot end (footbar, -L/2) to the head end (shoulder blocks, risers, +L/2); y up.
// The carriage rests near the foot end and slides toward the head end when you push the footbar away.
export const REF = { L: 4.0, W: 1.15, railY: 0.62, carY: 0.66, carL: 1.3, carT: 0.2, rest: -0.35 };
/** carriage top (the seat), local: x = rest + slide, y */
export const SEAT_Y = REF.carY + REF.carT;
export const SEAT_DX = 0.12; // where a coin sits: a little toward the head end from the carriage centre
// diagonal, head end back-left; solved so the seats land at ~(350, 1650) and ~(800, 1505) in the locked frame
export const R1 = { p: [-0.83, 0, 6.2] as V3, yaw: 2.4 };
export const R2 = { p: [0.8, 0, 5.38] as V3, yaw: 2.4 };

// ---------------------------------------------------------------- carriage slides (world units along the Reformer's x)
/** one push: the carriage goes out and comes back, zero speed at both ends */
const push = (t: number, a: number, b: number, amp: number) => (t <= a || t >= b ? 0 : amp * Math.pow(Math.sin(((t - a) / (b - a)) * Math.PI), 2));

export type Pushes = [number, number, number][];
/** Every push of both carriages, in seconds, from the words. */
export const pushPlan = (w: PilWords, end: number): { c1: Pushes; c2: Pushes; hop1: number; hop2: number } => {
  const us = w.us - 0.03;
  const half = Math.max(1.0, (end - 0.08 - us) / 2);
  const together: Pushes = [
    [us, us + half - 0.03, 0.78],
    [us + half, Math.min(end - 0.05, us + 2 * half), 0.78],
  ];
  return {
    c1: [
      [0.25, Math.min(3.05, w.bed - 0.12), 0.85], // L1: it slides slowly by itself, back home before the bed change
      [w.moves - 0.02, Math.min(w.moves + 0.8, PIL_STARTS[4] - 0.25), 1.15], // «وبيتحرك» (back at rest before 21.9 s)
      [w.train5 - 0.22, w.train5 + 0.82, 0.78], // L5: her first push, on «يتمرن»
      [w.me + 0.05, w.me + 1.37, 0.62], // L6: slower
      [w.me + 1.42, w.but + 0.02, 0.3], // ... dying out, still on «غير إني»
      ...together,
    ],
    c2: together,
    hop1: w.found + 0.03, // Mrs. Coin is seated on the carriage from here (the props script prints the scene actions)
    hop2: us - 0.5, // the friend: lands on carriage 2 before both carriages slide on «بينا»
  };
};
export const slideAt = (pushes: Pushes, t: number) => pushes.reduce((s, [a, b, amp]) => s + push(t, a, b, amp), 0);

/** World point of a Reformer-local point. */
export const refWorld = (r: { p: V3; yaw: number }, lx: number, ly: number, lz: number): V3 => {
  const c = Math.cos(r.yaw);
  const s = Math.sin(r.yaw);
  // local x -> world (cos, 0, -sin): the head end goes back and to the right
  return [r.p[0] + lx * c + lz * s, r.p[1] + ly, r.p[2] - lx * s + lz * c];
};
/** The seat point of a carriage (world) for a slide value. */
export const seatWorld = (r: { p: V3; yaw: number }, slide: number): V3 => refWorld(r, REF.rest + SEAT_DX + slide, SEAT_Y, 0);
