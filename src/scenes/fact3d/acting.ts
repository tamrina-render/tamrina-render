// Poses and the shared "alive" layer. Pure functions of the frame.
import { BlockyPose, restPose } from "./Blocky";
import { clamp, easeInOut, easeOut, hash, lerp } from "./anim";

export const lerpPose = (a: BlockyPose, b: BlockyPose, t: number): BlockyPose => {
  const out = { ...a } as Record<string, unknown>;
  for (const k of Object.keys(a) as (keyof BlockyPose)[]) {
    const av = a[k];
    const bv = b[k];
    if (typeof av === "number" && typeof bv === "number") out[k] = lerp(av, bv, t);
    else if (typeof av === "object" && typeof bv === "object") {
      const o: Record<string, number> = {};
      for (const kk of Object.keys(av)) o[kk] = lerp((av as Record<string, number>)[kk] ?? 0, (bv as Record<string, number>)[kk] ?? 0, t);
      out[k] = o;
    } else out[k] = t < 0.5 ? av : bv;
  }
  return out as BlockyPose;
};

/** Eye-open multiplier: a 4-frame blink on a seeded, irregular schedule. */
export const blinkAt = (f: number, seed: number) => {
  const P = 64 + Math.floor(hash(seed * 3.17) * 56);
  const cycle = Math.floor((f + Math.floor(hash(seed * 7.7) * P)) / P);
  const t = (f + Math.floor(hash(seed * 7.7) * P)) % P;
  const jitter = Math.floor(hash(seed + cycle * 13.1) * 20); // not every blink at the same spot
  const k = t - jitter;
  if (k < 0 || k > 3) return 1;
  return [0.45, 0.04, 0.1, 0.6][k];
};

/** Breathing, weight shift, small head drift and blinks on top of any pose. k = amount. */
export const alive = (p: BlockyPose, f: number, seed: number, k = 1): BlockyPose => {
  const q = { ...p };
  const br = Math.sin(f * 0.11 + seed * 1.7);
  q.bob += br * 0.012 * k;
  q.shrug += (br * 0.5 + 0.5) * 0.05 * k;
  q.roll += Math.sin(f * 0.031 + seed) * 0.03 * k;
  q.twist += Math.sin(f * 0.023 + seed * 2.3) * 0.04 * k;
  q.headTilt += Math.sin(f * 0.043 + seed * 0.7) * 0.035 * k;
  q.headYaw += Math.sin(f * 0.029 + seed * 1.3) * 0.04 * k;
  if (q.eyeOpen > 0.3) q.eyeOpen *= blinkAt(f, seed);
  return q;
};

/** Frozen-in-shock tremble: a fast, tiny shiver instead of a dead hold. */
export const tremble = (p: BlockyPose, f: number, seed: number, k = 1): BlockyPose => ({
  ...p,
  roll: p.roll + Math.sin(f * 2.3 + seed) * 0.012 * k,
  headTilt: p.headTilt + Math.sin(f * 1.9 + seed * 2) * 0.015 * k,
  shrug: p.shrug + Math.sin(f * 2.7 + seed) * 0.02 * k,
});

/** Eyes dart between targets in quick 3-frame flicks. */
export const dart = (f: number, keys: [number, number][]) => {
  let prev = 0;
  for (const [t, x] of keys) {
    if (f < t + 3) return lerp(prev, x, easeOut(clamp((f - t) / 3)));
    prev = x;
  }
  return prev;
};

export const proudPose = (): BlockyPose => ({
  ...restPose(),
  armL: { sx: 0.05, sz: 0.85, twist: -1.5, elbow: -1.75 },
  armR: { sx: 0.05, sz: 0.85, twist: -1.5, elbow: -1.75 },
  legL: { hip: -0.16, sz: 0.06, knee: 0.08, toe: -0.15 },
  legR: { hip: 0.06, sz: 0.1, knee: 0, toe: -0.2 },
  lean: -0.07,
  headPitch: -0.12,
  eyeOpen: 0,
  mouth: "smile",
});

export const shyArms = (): Pick<BlockyPose, "armL" | "armR"> => ({
  armL: { sx: -0.82, sz: -0.06, twist: -1.5, elbow: -1.55 },
  armR: { sx: -0.62, sz: -0.06, twist: -1.5, elbow: -1.7 },
});

export const shyPose = (): BlockyPose => ({
  ...restPose(),
  ...shyArms(),
  legL: { hip: -0.18, sz: -0.11, knee: 0.36, toe: 0.45 },
  legR: { hip: -0.18, sz: -0.11, knee: 0.36, toe: 0.45 },
  lean: 0.1,
  bob: -0.05,
  shrug: 1,
  hunch: 1,
  headPitch: 0.1,
  headTilt: 0.08,
  eyeOpen: 1,
  eyeWide: 1.25,
  brow: 1,
  browUp: 0.3,
  mouth: "wavy",
  blush: 1,
});

/** Running: phase in radians, amp 1 = sprint, 0.6 = easy jog. */
export const runnerPose = (phase: number, amp = 1): BlockyPose => {
  const s = Math.sin(phase);
  const sR = Math.sin(phase + Math.PI);
  const kneeFor = (ph: number) => 0.25 + 1.25 * amp * Math.max(0, -Math.cos(ph));
  return {
    ...restPose(),
    legL: { hip: 0.85 * amp * s, sz: 0.02, knee: kneeFor(phase) },
    legR: { hip: 0.85 * amp * sR, sz: 0.02, knee: kneeFor(phase + Math.PI) },
    armL: { sx: -0.8 * amp * s, sz: 0.12, twist: 0, elbow: -1.45 },
    armR: { sx: -0.8 * amp * sR, sz: 0.12, twist: 0, elbow: -1.45 },
    lean: 0.08 + 0.14 * amp,
    bob: 0.07 * amp * Math.abs(Math.cos(phase)) - 0.05 * amp,
    headPitch: -0.12,
    eyeOpen: 1,
    eyeWide: 0.95,
    brow: -0.6 * amp,
    mouth: "grin",
  };
};

/** Clapping in front of the chest. */
export const clapPose = (f: number, speed = 0.55, seed = 0): BlockyPose => {
  const c = 0.5 + 0.5 * Math.cos(f * speed + seed); // 1 = apart, 0 = together
  const sz = lerp(-0.5, 0.12, c);
  return {
    ...restPose(),
    armL: { sx: -1.15, sz, twist: 0, elbow: -0.75 },
    armR: { sx: -1.15, sz, twist: 0, elbow: -0.75 },
    bob: -0.02 * (1 - c),
    headPitch: -0.1,
    mouth: "grin",
    browUp: 0.4,
    eyeWide: 1.05,
  };
};

/** Double-biceps flex; `pump` 0..1 squeezes. */
export const flexPose = (pump: number): BlockyPose => ({
  ...restPose(),
  armL: { sx: 0.1, sz: 1.55 + pump * 0.12, twist: 1.57, elbow: -1.85 - pump * 0.45 },
  armR: { sx: 0.1, sz: 1.55 + pump * 0.12, twist: 1.57, elbow: -1.85 - pump * 0.45 },
  legL: { hip: 0, sz: 0.16, knee: 0.05 },
  legR: { hip: 0, sz: 0.16, knee: 0.05 },
  lean: -0.06,
  squash: 1 - pump * 0.04,
  headPitch: -0.15,
  eyeOpen: 1,
  brow: -0.5,
  mouth: "grin",
});

/** Overhead press with two stone balls; t = 0..1 through one rep. effort 0..1. */
export const pressPose = (t: number, effort: number): BlockyPose => {
  // 0-0.25 dip (anticipation), 0.25-0.45 drive up, 0.45-0.65 lockout hold (shaking), 0.65-1 lower
  const dip = t < 0.25 ? easeInOut(t / 0.25) : t < 0.45 ? 1 - easeOut((t - 0.25) / 0.2) : 0;
  const up = t < 0.25 ? 0 : t < 0.45 ? easeOut((t - 0.25) / 0.2) : t < 0.65 ? 1 : 1 - easeInOut((t - 0.65) / 0.35);
  const shake = t > 0.45 && t < 0.65 ? Math.sin(t * 160) * 0.04 * effort : 0;
  const arm = { sx: -0.1, sz: lerp(1.25, 2.7, up) + shake, twist: 1.57, elbow: lerp(-1.95, -0.25, up) };
  return {
    ...restPose(),
    armL: arm,
    armR: { ...arm, sz: arm.sz - shake * 2 },
    legL: { hip: -0.35 * dip, sz: 0.18, knee: 0.7 * dip },
    legR: { hip: -0.35 * dip, sz: 0.18, knee: 0.7 * dip },
    bob: -0.16 * dip + 0.03 * up,
    lean: 0.06 * dip - 0.04 * up,
    squash: 1 - 0.07 * dip * (0.5 + effort) + 0.03 * up,
    headPitch: -0.12 * up,
    eyeOpen: 1,
    eyeWide: lerp(0.85, 1.05, up),
    brow: -0.4 - 0.5 * effort,
    mouth: up > 0.5 ? "grin" : "flat",
    blush: effort * 0.55 * up,
  };
};

/** Overhead side-bend stretch; t in radians. */
export const stretchPose = (t: number): BlockyPose => {
  const s = Math.sin(t);
  return {
    ...restPose(),
    armL: { sx: 0, sz: 2.75 + s * 0.12, twist: 1.57, elbow: -0.45 },
    armR: { sx: 0, sz: 2.75 - s * 0.12, twist: 1.57, elbow: -0.45 },
    legL: { hip: 0, sz: 0.12, knee: 0 },
    legR: { hip: 0, sz: 0.12, knee: 0 },
    roll: s * 0.32,
    headTilt: s * 0.2,
    eyeOpen: 0.15 + 0.85 * clamp(1 - Math.abs(s) * 1.4),
    mouth: "smile",
  };
};

/** Discus wind-up: torso twists back and forth, throwing arm out wide. w = -1..1 twist. */
export const discusPose = (w: number): BlockyPose => ({
  ...restPose(),
  armR: { sx: 0.2 * w, sz: 1.3, twist: 0, elbow: -0.15 },
  armL: { sx: -0.9, sz: 0.35, twist: -0.6, elbow: -1.2 },
  legL: { hip: -0.15, sz: 0.2, knee: 0.35 },
  legR: { hip: 0.1, sz: 0.2, knee: 0.35 },
  bob: -0.08,
  twist: -0.55 * w,
  headYaw: 0.25 * w,
  lean: 0.08,
  eyeOpen: 1,
  brow: -0.6,
  mouth: "flat",
});

/** Waving with the left arm, bouncing on the toes. */
export const wavePose = (f: number, seed = 0): BlockyPose => {
  const w = Math.sin(f * 0.42 + seed);
  const bounce = Math.abs(Math.sin(f * 0.26 + seed));
  return {
    ...restPose(),
    armL: { sx: -0.1, sz: 2.35, twist: 1.57, elbow: -0.55 + w * 0.4 },
    armR: { sx: 0.05, sz: 0.2, twist: 0, elbow: -0.3 },
    legL: { hip: -0.05, sz: 0.08, knee: 0.08 * (1 - bounce) },
    legR: { hip: 0.03, sz: 0.08, knee: 0.08 * (1 - bounce) },
    bob: 0.07 * bounce - 0.02,
    squash: 1 + 0.03 * bounce - 0.02,
    headTilt: w * 0.06,
    eyeOpen: 1,
    eyeWide: 1.05,
    browUp: 0.5,
    mouth: "grin",
  };
};

/** Calm walking: phase in radians (one stride = PI), amp 1 = brisk walk. */
export const walkPose = (phase: number, amp = 1): BlockyPose => {
  const s = Math.sin(phase);
  return {
    ...restPose(),
    legL: { hip: 0.5 * amp * s, sz: 0.03, knee: 0.08 + 0.55 * amp * Math.max(0, -Math.cos(phase)) },
    legR: { hip: -0.5 * amp * s, sz: 0.03, knee: 0.08 + 0.55 * amp * Math.max(0, Math.cos(phase)) },
    armL: { sx: -0.38 * amp * s, sz: 0.1, twist: 0, elbow: -0.3 },
    armR: { sx: 0.38 * amp * s, sz: 0.1, twist: 0, elbow: -0.3 },
    lean: 0.04 * amp,
    bob: 0.035 * amp * Math.abs(Math.cos(phase)) - 0.02 * amp,
    roll: 0.03 * amp * s,
    eyeOpen: 1,
  };
};
