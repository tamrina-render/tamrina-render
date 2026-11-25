// Pure timing helpers: every value is a function of the frame number only.

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix3 = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;
export const easeOutBack = (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

/** 0..1 progress of `f` between frames a and b, eased. */
export const seg = (f: number, a: number, b: number, ease: (t: number) => number = easeInOut) =>
  ease(clamp((f - a) / (b - a)));

/** Damped spring step response: 0 before `start`, overshoots past 1, settles at 1. */
export const springAt = (f: number, start: number, freq = 0.55, decay = 5) => {
  const t = f - start;
  if (t <= 0) return 0;
  return 1 - Math.exp(-t / decay) * Math.cos(t * freq);
};

/** Damped wobble around 0 after `start` (for squash, shake). Starts at `amp`. */
export const wobble = (f: number, start: number, amp: number, freq = 0.6, decay = 5) => {
  const t = f - start;
  if (t < 0) return 0;
  return amp * Math.exp(-t / decay) * Math.cos(t * freq);
};

/** Deterministic hash noise in [0,1). */
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
