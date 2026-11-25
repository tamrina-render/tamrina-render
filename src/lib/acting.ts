// Playback of the acting director (scripts/director.mjs -> tl.acting[coin id]). The director decides; this only
// shapes the moves a flat disc can show (research: reports/Cartoon acting for coin mascots.md):
//  tilt  = roll in its own plane (a question), pops in fast (no ease-in), held, eased out over 0.45 s, brows up
//  shake = yaw left / right, 2.2 cycles dying out (a negation): the coin's edge shows, so it reads
//  yes   = a squash + dip (an affirmation, a listener's "aha"): a pitch nod is invisible on a disc facing the camera
//  toss  = the Egyptian "لأ" (with a "tsk"): the head goes UP: a lift + stretch, brows and eyes up, then back down
//  sweep = a slow yaw across from one side to the other ("all / everything")
//  pop   = the operative word's accent: a quick dip + squash + small roll that settles (a damped spring)
// Pure functions of t: motion-check samples them.
import type { Timeline } from "./types";

type Ev = { t: number; k: string; a: number; d: number; side: number };
export type Acting = { gestures: { t: number; dur: number; g: string; prep?: number }[]; head: Ev[]; blinks: number[]; quiet: [number, number, string][] };

export const actingOf = (tl: Timeline, id: string | undefined): Acting | undefined => (id ? (tl.acting?.[id] as Acting | undefined) : undefined);

const io = (x0: number) => { const x = Math.max(0, Math.min(1, x0)); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
const outBack = (x: number) => { const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

/** The director's head acting at t: roll (deg, + = clockwise), yaw (rad), dip (px down), squash (0..), brow (px up). */
export const headAt = (A: Acting | undefined, t: number) => {
  const r = { roll: 0, yaw: 0, dip: 0, sq: 0, brow: 0, eyeUp: 0 };
  if (!A) return r;
  for (const e of A.head) {
    const lt = t - e.t;
    if (lt < 0 || lt > e.d + 0.8) continue;
    switch (e.k) {
      case "tilt": { // in 4 frames with a little overshoot, held, out over 0.45 s
        const w = lt < 0.14 ? outBack(lt / 0.14) : lt < e.d ? 1 : Math.max(0, 1 - io((lt - e.d) / 0.45));
        r.roll += e.a * e.side * w; r.brow += 5 * Math.min(1, w); break;
      }
      case "shake": {
        if (lt > e.d) break;
        const u = lt / e.d;
        r.yaw += e.a * Math.sin(2 * Math.PI * 2.2 * u) * Math.pow(1 - u, 1.2) * Math.min(1, lt / 0.05); break;
      }
      case "yes": {
        if (lt > e.d) break;
        const b = Math.sin((Math.PI * lt) / e.d);
        r.dip += 12 * e.a * b; r.sq += 0.05 * e.a * b; break;
      }
      case "toss": { // up in 0.1 s, held 0.2 s, down over 0.3 s
        if (lt > 0.6) break;
        const w = lt < 0.1 ? io(lt / 0.1) : lt < 0.3 ? 1 : 1 - io((lt - 0.3) / 0.3);
        r.dip -= 14 * e.a * w; r.sq -= 0.05 * e.a * w; r.brow += 9 * e.a * w; r.eyeUp += 6 * e.a * w; break;
      }
      case "sweep": {
        const u = Math.min(1, lt / e.d), fin = Math.min(1, lt / 0.15), fout = lt < e.d ? 1 : Math.max(0, 1 - io((lt - e.d) / 0.4));
        r.yaw += e.a * e.side * (2 * io(u) - 1) * fin * fout; break;
      }
      case "pop": { // no ease-in: hits the extreme in 3 frames, then a damped settle
        if (lt > 0.7) break;
        const k = lt < 0.1 ? lt / 0.1 : Math.exp(-(lt - 0.1) * 6) * Math.cos((lt - 0.1) * 11);
        r.dip += 7 * e.a * k; r.sq += 0.035 * e.a * k; r.roll += 4 * e.a * e.side * Math.max(0, k); break;
      }
    }
  }
  return r;
};

/** A director blink at t (0..1, 3/1/4 frames close / hold / open), and whether t is in a no-blink window. */
export const actingBlink = (A: Acting | undefined, t: number) => {
  if (!A) return { blink: 0, noBlink: false };
  let blink = 0;
  for (const c of A.blinks) { const d = t - c; if (d >= 0 && d < 0.27) blink = Math.max(blink, d < 0.1 ? d / 0.1 : d < 0.133 ? 1 : 1 - (d - 0.133) / 0.133); }
  const noBlink = A.quiet.some(([a, b, n]) => n === "noblink" && t >= a && t <= b);
  return { blink, noBlink };
};
