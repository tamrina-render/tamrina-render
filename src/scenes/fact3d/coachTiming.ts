// FactCoach timing (videos/da7ee7-gym-intro): the original Dahih intro, first second cut. All times are seconds of
// the NEW audio (original - 1.0 s); the shot list copies the original's cuts.
export const COACH_FPS = 30;
export const COACH_AUDIO = 47.3; // the original sound ends here; Mr. Coin's line comes after
export const COACH_DURATION = 54;

export type ShotName = "gymWide" | "coachCU" | "mohabCU" | "office" | "wedding" | "end";
/** [start s, shot] in order; whips are separate (WHIPS). */
export const SHOTS: [number, ShotName][] = [
  [0, "gymWide"],
  [6.72, "coachCU"],
  [7.6, "gymWide"],
  [9.2, "mohabCU"],
  [10.12, "coachCU"],
  [11.12, "mohabCU"],
  [12.68, "gymWide"],
  [16.8, "coachCU"],
  [19.36, "mohabCU"],
  [23.9, "office"],
  [35.25, "wedding"],
  [47.8, "end"],
];
/** whip pans: [start s, end s] (gym -> office, office -> wedding, wedding -> back to the gym for Mr. Coin) */
export const WHIPS: [number, number][] = [
  [23.4, 23.9],
  [34.75, 35.25],
  [47.3, 47.8],
];

// beats (seconds)
export const T = {
  lift0: 7.6, // Mohab starts pulling
  liftTop: 12.4,
  drop: 13.3, // the bar falls (clank)
  standUp: 19.36, // CU: he stands, hands on hips
  coachIn: 24.6, // the coach walks into the office
  coachLean: 26.2,
  coinIn: 48.0, // Mr. Coin walks in (drawn by the reel on top)
  phoneIn: 49.6,
  phoneTap: 51.0,
  logo: 52.2,
};

export type CoachProps = { durationSec?: number; talk?: { coach: [number, number][]; mohab: [number, number][] }; loud?: number[]; debug?: boolean };
