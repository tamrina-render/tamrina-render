// Mocap playback (phase 2 of the human motion, 2026-11-08): tl.mocap[coin id] is built by scripts/mocap.mjs from a
// real person in a video (scripts/mocap.py); here it is only interpolated per frame. Hands go into naturalHands
// (Coin3D: so a {cue} gesture or a move still wins), head / body into coinPose. Weights fade to 0 where the person
// isn't seen, so the coin's own motion takes over there.
import type { Timeline } from "./types";

export type MocapHand = { x: number; y: number; a: number; z: number; fist: number; w: number };
export type MocapFrame = { L: MocapHand; R: MocapHand; roll: number; yaw: number; pitch: number; wHead: number; lean: number; bob: number; wBody: number; wRollYaw: number };

/** The mocap pose of coin `id` at time t, or null (no mocap for him). Frame layout: scripts/mocap.mjs. */
export const mocapAt = (tl: Timeline, id: string | undefined, t: number): MocapFrame | null => {
  const m = id ? tl.mocap?.[id] : undefined;
  if (!m || !m.f.length) return null;
  const x = Math.max(0, t * m.fps), i = Math.min(m.f.length - 1, Math.floor(x)), j = Math.min(m.f.length - 1, i + 1), u = x - Math.floor(x);
  const a = m.f[i], b = m.f[j];
  const g = (k: number) => a[k] + (b[k] - a[k]) * u;
  const hand = (o: number): MocapHand => ({ x: g(o), y: g(o + 1), a: g(o + 2), z: g(o + 3), fist: g(o + 4), w: g(o + 5) });
  return { L: hand(0), R: hand(6), roll: g(12), yaw: g(13), pitch: g(14), wHead: g(15), lean: g(16), bob: g(17), wBody: g(18), wRollYaw: g(19) ?? 0 };
};
