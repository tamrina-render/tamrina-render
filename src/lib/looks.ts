// Film "looks" for a whole video or a single scene (script `"look"` / scene `"look"`), after two Lemo Opuscar style
// recipes (lemomo-ai/lemo-opuscar, MIT; full recipes in guides/reference/lemo-opuscar/):
//   silent   = 1920s silent film: silver print + a little sepia, 16 fps hand-cranked motion while the damage changes
//              every frame, flicker, gate weave, scratches, dust, burnt edges, iris in / out. The coin keeps its colour
//              (the recipe's "one colour, at most": the single thing the film is about).
//   gameshow = flat vector game show: one saturated set per scene (stripes / dots / sunburst, never the coin's hue,
//              never the same as the scene before), ink-outlined telop headline, cards with an ink outline + hard offset
//              shadow, hard cuts with a short white flash, a beat punch, the coin hops on the beat, {judge} stamps a word.
import type { Scene, Timeline } from "./types";

export type Look = "none" | "silent" | "gameshow";

export const sceneAt = (tl: Timeline, t: number) =>
  tl.scenes.find((s) => t >= s.start && t < s.end) ?? tl.scenes[tl.scenes.length - 1];

export const lookOf = (tl: Timeline, sc?: Scene): Look => (sc?.look ?? tl.look ?? "none") as Look;
export const lookAt = (tl: Timeline, t: number): Look => lookOf(tl, sceneAt(tl, t));

/** silent film: motion is sampled at 16 fps (hand-cranked) */
export const SILENT_FPS = 16;
/** game show tempo: everything that idles moves on this beat */
export const GAMESHOW_BPM = 120;

/** deterministic noise per integer key */
export const hash = (k: number) => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// One set per scene. Coin hues (lime #D6FF3C, pink #FF5CA8) and anything close to them are left out on purpose.
export const SETS = [
  { bg: "#FF9F45", pat: "#FFB870", kind: "stripes" },   // tangerine
  { bg: "#3BA8F5", pat: "#6CC2FF", kind: "dots" },      // sky
  { bg: "#7C4DFF", pat: "#9B78FF", kind: "sunburst" },  // violet
  { bg: "#14A89B", pat: "#3FCFC1", kind: "stripes" },   // teal
  { bg: "#1F2A6B", pat: "#F7C744", kind: "sunburst" },  // navy + gold
  { bg: "#F0533F", pat: "#FF7A69", kind: "dots" },      // red
] as const;
export const setFor = (index: number) => SETS[index % SETS.length];
export const INK = "#14121A";
