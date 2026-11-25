import React from "react";
import { useVideoConfig } from "remotion";
import { FONT } from "../lib/fonts";
import { easeOut, springIn } from "../lib/mechanics";
import { GAMESHOW_BPM, lookAt } from "../lib/looks";
import { changePoints, emphasisAt, gestureAt, loudnessAt, speakingAt, visemeAt } from "../lib/speech";
import { fbm, humanAmp, inBreath } from "../lib/human";
import { actingBlink, actingOf, headAt } from "../lib/acting";
import { mocapAt } from "../lib/mocap";
import type { Mood, PresenterConfig, Theme, Timeline } from "../lib/types";

/**
 * Mr. Coin / Mrs. Coin: the Tamrina brand mascots as the talking presenter.
 * A coin (lime for "mr", pink for "mrs") with rubber-hose arms and white gloves, "+1" on the face and "$" on the back.
 * Everything is a pure function of t (no CSS animation): pop-in or fly-in, a continuous bob with arm/leg/ponytail
 * secondary motion, a wave on every gesture point, blink, a mouth + brows + pupils driven by the word timings,
 * one flip to the back (scene `pose: "flip"`, else once near 45 % of the reel), and an exit in the last 0.6 s.
 * Moods (scene "mood" or [excited]-style tags in `say`, see guides/style.md) reshape eyes, brows, mouth and body:
 * happy = ^ ^ eyes + open smile, excited = big sparkly eyes + hops + both arms up, surprised = wide eyes + "O" mouth
 * + jolt, curious = one brow up + side glance + head tilt. Every change blends over 0.22 s with a squash "react" pop.
 * Group structure mirrors the approved design canvas (legs, arm-l, arm-r, body, face, back, ponytail).
 */
export const VARIANTS = {
  mr: { coin: "#D6FF3C", entrance: "pop" as const, lashes: false, ponytail: false },
  mrs: { coin: "#FF5CA8", entrance: "fly" as const, lashes: true, ponytail: true },
  // the base coin: Mr. Coin's body without his identity (his lime of the men's pool, his head-scratch habit, his
  // catchphrases): a classic gold coin that copies (players, a crowd, a team) start from
  plain: { coin: "#F2C14E", entrance: "pop" as const, lashes: false, ponytail: false },
};
/** which preset a coin config is: its cast kind, else the legacy name ("mrs" / anything else = "mr") */
export const kindOf = (cfg: PresenterConfig): keyof typeof VARIANTS => cfg.kind ?? (cfg.name === "mrs" ? "mrs" : "mr");

type Face = { eye: number; eyeY: number; pupil: number; happy: number; brow: number; browTilt: number; look: number;
  rest: number; mouthW: number; o: number; hop: number; tilt: number; armUp: number; sparkle: number;
  // personality faces (3D coin): brows tilted (+ sad / - angry), lower lids, frown, side smile, one eye closed,
  // heart / star / spiral pupils, blush, tears, pupils down, and the FX they bring (steam, sweat, Zzz, hearts)
  browIn: number; lid: number; frown: number; smirk: number; wink: number; heart: number; star: number; spiral: number;
  blush: number; tears: number; down: number; steam: number; sweat: number; zzz: number; cheek: number; grit: number; puff: number; tongue: number;
  // body: stands taller (proud) / slow sighs (bored, relieved)
  tall: number; sigh: number };
// Resting face = a calm, friendly half-smile (a flat line read as "sad" on the dark brand background).
// Owner feedback 2026-10-26: moods jumped around and "excited" was too much -> softer faces, slower blends, fewer changes.
const NEUTRAL: Face = { eye: 1, eyeY: 1, pupil: 11, happy: 0, brow: 2, browTilt: 0, look: 0, rest: 0.42, mouthW: 1.04, o: 0, hop: 0, tilt: 0, armUp: 0, sparkle: 0,
  browIn: 0, lid: 0, frown: 0, smirk: 0, wink: 0, heart: 0, star: 0, spiral: 0, blush: 0, tears: 0, down: 0, steam: 0, sweat: 0, zzz: 0, cheek: 0, grit: 0, puff: 0, tongue: 0, tall: 0, sigh: 0 };
export const MOOD_FACE: Record<Mood, Face> = {
  neutral: NEUTRAL,
  // happy = eyes OPEN with a big smile (owner: the ^ ^ eyes made him look asleep); ^ ^ is only for laughing
  happy: { ...NEUTRAL, eyeY: 0.92, pupil: 12, brow: 7, rest: 0.66, mouthW: 1.16, hop: 0.2, cheek: 0.55 },
  laugh: { ...NEUTRAL, happy: 1, brow: 8, rest: 0.8, mouthW: 1.2, hop: 0.35, cheek: 0.6 },
  excited: { ...NEUTRAL, eye: 1.12, eyeY: 1.12, pupil: 13, brow: 10, rest: 0.72, mouthW: 1.18, hop: 0.45, armUp: 0.5, sparkle: 1, cheek: 0.3 },
  surprised: { ...NEUTRAL, eye: 1.2, eyeY: 1.28, pupil: 7, brow: 17, rest: 0.6, mouthW: 0.9, o: 1, tilt: -3 },
  curious: { ...NEUTRAL, eyeY: 0.96, pupil: 10, brow: 4, browTilt: 12, look: 7, rest: 0.38, mouthW: 0.85, smirk: 0.25, tilt: 6 },
  sad: { ...NEUTRAL, eyeY: 0.88, pupil: 13, brow: -1, browIn: 1.5, lid: 0.35, rest: 0.28, mouthW: 0.7, frown: 1, down: 7, tilt: 5 },
  cry: { ...NEUTRAL, eyeY: 0.86, pupil: 13, brow: -1, browIn: 1.6, lid: 0.32, rest: 0.55, mouthW: 0.95, frown: 1, tears: 1, tilt: 5 },
  angry: { ...NEUTRAL, eyeY: 0.8, pupil: 8, brow: -6, browIn: -1.7, lid: 0.3, rest: 0.45, mouthW: 1.0, frown: 0.3, grit: 1, steam: 1, tilt: -2 },
  annoyed: { ...NEUTRAL, pupil: 10, brow: -2, browIn: -0.7, lid: 0.5, rest: 0.3, mouthW: 0.7, frown: 0.35, smirk: 0.45, look: 8 },
  smug: { ...NEUTRAL, pupil: 11, brow: 2, browTilt: 13, lid: 0.5, rest: 0.6, mouthW: 0.9, smirk: 1.25, cheek: 0.35, tilt: 5 },
  shocked: { ...NEUTRAL, eye: 1.32, eyeY: 1.38, pupil: 5, brow: 22, rest: 0.95, mouthW: 1.0, o: 1, sweat: 0.7 },
  love: { ...NEUTRAL, heart: 1, blush: 1, brow: 7, rest: 0.66, mouthW: 1.12, hop: 0.25, cheek: 0.45 },
  starry: { ...NEUTRAL, eye: 1.14, eyeY: 1.14, star: 1, sparkle: 1, brow: 9, rest: 0.72, mouthW: 1.16, hop: 0.3, cheek: 0.3 },
  sleepy: { ...NEUTRAL, lid: 0.72, brow: -2, browIn: 0.4, rest: 0.18, mouthW: 0.65, zzz: 1, tilt: 7 },
  dizzy: { ...NEUTRAL, spiral: 1, rest: 0.5, mouthW: 0.85, smirk: 0.5, tilt: 9 },
  shy: { ...NEUTRAL, blush: 1.2, lid: 0.3, brow: 3, browIn: 0.5, rest: 0.35, mouthW: 0.62, down: 8, look: -6, tilt: -7 },
  nervous: { ...NEUTRAL, eyeY: 1.08, pupil: 7, browIn: 0.9, rest: 0.32, mouthW: 0.95, grit: 0.6, sweat: 1 },
  wink: { ...NEUTRAL, wink: 1, brow: 5, browTilt: 7, rest: 0.66, mouthW: 1.08, smirk: 0.55, cheek: 0.35 },
  // after Clawd's acted emotions (JohnHeibel/ClaudeAnimationBase, MIT), built from the existing face parts only
  determined: { ...NEUTRAL, eyeY: 0.9, pupil: 9, brow: -2, browIn: -0.9, lid: 0.22, rest: 0.3, mouthW: 0.92, grit: 0.35, tilt: -3 }, // "let's go" before a set
  proud: { ...NEUTRAL, eyeY: 0.95, pupil: 11, brow: 9, browTilt: 4, lid: 0.15, rest: 0.68, mouthW: 1.1, smirk: 0.9, cheek: 0.55, sparkle: 0.5, down: -5, tilt: -4, tall: 1 }, // after a PR: chin up, eyes up
  bored: { ...NEUTRAL, lid: 0.55, pupil: 10, brow: -1, rest: 0.18, mouthW: 0.7, frown: 0.25, smirk: 0.3, look: 8, down: 4, tilt: 5, sigh: 1 },                 // the excuse / the old gym
  // قرفان (2026-10-29, leg-day-call): heavy half lids, brows pulled down and in, mouth turned down, NO smile, eyes away
  disgusted: { ...NEUTRAL, pupil: 10, brow: -3, browIn: -1.2, lid: 0.52, rest: 0.25, mouthW: 0.72, frown: 0.85, look: 6, tilt: -3 },
  // yoga (2026-11-11, dezjj): zen = eyes shut, a small calm smile; peek = one eye opens to look at whoever is shouting, a little afraid (brows up and in, a bit of teeth, a sweat drop)
  // مستسلمة (2026-11-12, dezjj): she gives up: puffs her cheeks and blows it out, heavy lids, brows up in the middle, head down a little
  resigned: { ...NEUTRAL, lid: 0.45, pupil: 11, brow: 3, browIn: 0.9, rest: 0.22, mouthW: 0.66, puff: 1, sigh: 1, down: 5, tilt: 4 },
  zen: { ...NEUTRAL, lid: 0.92, brow: 5, rest: 0.5, mouthW: 0.88, cheek: 0.3, tilt: 2 },
  peek: { ...NEUTRAL, wink: 1, eyeY: 1.12, pupil: 7, brow: 9, browIn: 0.9, rest: 0.3, mouthW: 0.9, grit: 0.45, sweat: 0.8, look: 8 },
  relieved: { ...NEUTRAL, lid: 0.82, brow: 4, browIn: 0.9, rest: 0.58, mouthW: 1.08, cheek: 0.4, sweat: 0.6, tilt: 3, sigh: 0.6 },    // phew: eyes shut, smile
};
/**
 * How big the body "take" is when he enters a mood (Clawd's take table, x0.6 for the brand's calm motion):
 * 0.1 s of anticipation squash before the change, then a damped stretch + small lift after it.
 */
const TAKE: Partial<Record<Mood, number>> = {
  neutral: 0.3, happy: 0.6, laugh: 0.8, excited: 1, surprised: 0, curious: 0.5, sad: 0.3, cry: 0.8, angry: 0.8, annoyed: 0.4,
  smug: 0.4, shocked: 1.1, love: 0.7, starry: 1, sleepy: 0.2, dizzy: 0.7, shy: 0.3, nervous: 0.5, wink: 0.4,
  determined: 0.7, proud: 0.5, bored: 0.2, relieved: 0.4, disgusted: 0.4, zen: 0.1, peek: 0.3, resigned: 0.3,
};
const BLEND = 0.45;   // seconds to morph from one face to the next
const MIN_HOLD = 1.0; // a face stays at least this long before the next change

/**
 * Mood changes in time order. A mood holds across scenes until the next tag (no reset to neutral per scene,
 * that made the face flicker), and changes closer than MIN_HOLD to the previous one are skipped.
 */
const moodTrack = (tl: Timeline) => {
  const all: { t: number; mood: Mood; revert?: boolean; cue?: boolean }[] = [{ t: 0, mood: "neutral" }];
  // {face} cues (temp) end with their scene: the coin goes back to the last lasting mood
  let base: Mood = "neutral";
  for (const sc of tl.scenes) {
    let temp = false;
    for (const m of sc.moods ?? []) {
      const mood = MOOD_FACE[m.mood] ? m.mood : "neutral";
      all.push({ t: m.t, mood, cue: !!m.temp });
      if (m.temp) temp = true; else base = mood;
    }
    if (temp) all.push({ t: sc.end - 0.05, mood: base, revert: true });
  }
  all.sort((a, b) => a.t - b.t);
  // a mood given at the very start is the face of frame 0 (it used to morph in from the neutral smile for 0.45 s: an angry line opened on a smile)
  if (all[1] && all[1].t <= 0.05) all[0] = { t: 0, mood: all[1].mood };
  const out = [all[0]];
  const hold = (tl as { presenter?: { look?: { moodHold?: number } } }).presenter?.look?.moodHold ?? MIN_HOLD; // script presenter.look.moodHold
  for (const m of all.slice(1)) {
    const last = out[out.length - 1];
    if (m.mood === last.mood) continue;
    // a "back to normal" that is followed at once by another mood is replaced by it (a {face} cue, or the next scene's
    // own tag: the ndl trainer's [angry] right after his {coach:angry} cue was skipped and he went back to the listener smile)
    if (m.t - last.t < hold && last.t > 0) {
      if (last.revert) out[out.length - 1] = m;
      continue;
    }
    out.push(m);
  }
  return out;
};

const GloveShapes: React.FC<{ fill: string; stroke?: string; sw?: number }> = ({ fill, stroke, sw }) => (
  <g fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round">
    <rect x={-19} y={-8} width={38} height={30} rx={13} />
    <rect x={-18} y={-28} width={11} height={26} rx={5.5} />
    <rect x={-5.5} y={-32} width={11} height={30} rx={5.5} />
    <rect x={7} y={-28} width={11} height={26} rx={5.5} />
    <rect x={13} y={-14} width={11} height={24} rx={5.5} transform="rotate(-30 18 8)" />
  </g>
);

/** White cartoon glove (4 fingers + thumb) with the house ink outline and a dark cuff. Fingers point to -y. */
const Glove: React.FC<{ fill: string; ink: string; outline: string }> = ({ fill, ink, outline }) => (
  <g>
    <GloveShapes fill={outline} stroke={outline} sw={8} />
    <GloveShapes fill={fill} />
    <rect x={-20} y={16} width={40} height={10} rx={4} fill={ink} />
  </g>
);

/** Everything that moves, as a pure function of t: shared by the 2D coin (below) and the 3D coin (Coin3D.tsx). */
export const coinPose = (tl: Timeline, t: number, fps: number, cfg: PresenterConfig) => {
  const V = VARIANTS[kindOf(cfg)];
  const entrance = cfg.entrance ?? V.entrance;
  const D = tl.durationSec;
  // continuous life (2.4 s cycle)
  // the two coins never move in sync (duo): their own idle phase, blink rhythm and glances
  const seed = cfg.seed ?? (cfg.name === "mrs" ? 1 : 0); // copies get their own (castOf in Coin3D)
  const ph = (t * Math.PI * 2) / 2.4 + seed * 1.9;
  // two out-of-step waves so the idle never repeats like a metronome
  // idle (src/lib/human.ts): seeded noise instead of the sine waves, same size, so it never repeats like a metronome
  // (the voice-driven head of phase 1 is gone: the acting director decides the head now, src/lib/acting.ts)
  const H = humanAmp(tl, cfg);
  const bobY0 = H ? fbm(t, seed + 1, 0.42) * 8.5 : Math.sin(ph) * 7 + Math.sin(t * 1.37 + 1.1) * 2.5;
  const bobR0 = H ? fbm(t, seed + 2, 0.3) * 2.2 : Math.sin(ph) * 2 + Math.sin(t * 0.83 + 0.4) * 1.2;
  // breathing (slow, independent of the bob) and an idle weight shift from foot to foot.
  // human: the breath's pace drifts (3-4 s), he breathes in before each phrase, the weight shift wanders
  const breath = H ? 1 + 0.012 * Math.sin((t * Math.PI * 2) / 3.4 + fbm(t, seed + 4, 0.15) * 1.6) + 0.022 * H * inBreath(tl, t)
    : 1 + 0.014 * Math.sin((t * Math.PI * 2) / 3.3);
  const shift = H ? fbm(t, seed + 3, 0.14) * 0.05 : Math.sin((t * Math.PI * 2) / 5.7 + 0.8) * 0.035 + Math.sin(t * 0.47) * 0.015;
  const swing = Math.sin(ph) * 6;
  const dangle = Math.sin(ph) * 7;
  const sway = Math.sin(ph + 0.6) * 8;

  // mood: blend from the previous face to the current one, with a react pop on every real change
  const track = moodTrack(tl);
  let cur = 0;
  for (let i = 0; i < track.length; i++) if (track[i].t <= t) cur = i;
  const curMood = track[cur]?.mood ?? "neutral";
  let prevMood: Mood = curMood;
  for (let i = cur - 1; i >= 0; i--) if (track[i].t < track[cur].t || track[i].mood !== curMood) { prevMood = track[i].mood; break; }
  const since = t - (track[cur]?.t ?? 0);
  const x = Math.min(1, since / BLEND);
  const mk = prevMood === curMood ? 1 : x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; // ease in-out
  const A = MOOD_FACE[prevMood], B = MOOD_FACE[curMood];
  const F = Object.fromEntries(Object.keys(B).map((k) => [k, A[k as keyof Face] + (B[k as keyof Face] - A[k as keyof Face]) * mk])) as Face;
  // eyes first (Clawd: notice -> think -> act): the pupils start toward the NEXT mood's look 0.25 s before the
  // face changes and arrive before it, so you see him notice, then feel
  {
    const nx = track[cur + 1], ahead = nx ? nx.t - t : 9;
    const eyeOf = (m: Mood) => MOOD_FACE[m];
    if (nx && ahead < 0.25) {
      const e = 1 - ahead / 0.25, ee = e * e * (3 - 2 * e);
      F.look = F.look + (eyeOf(nx.mood).look - F.look) * ee * 0.8; F.down = F.down + (eyeOf(nx.mood).down - F.down) * ee * 0.8;
    } else if (prevMood !== curMood && since < BLEND) {
      const e = Math.min(1, (since + 0.25) / BLEND), ee = e * e * (3 - 2 * e), from = 0.8;
      const lk = A.look + (B.look - A.look) * (from + (1 - from) * ee), dn = A.down + (B.down - A.down) * (from + (1 - from) * ee);
      F.look = lk; F.down = dn;
    }
  }
  // only a surprise gets a body "jolt"; other changes just morph
  const react = curMood === "surprised" && prevMood !== curMood && since < 0.4 ? Math.sin((since / 0.4) * Math.PI) * 0.6 : 0;
  // the take (Clawd): squash 0.1 s before every mood change, then a damped stretch and a small lift.
  // surprised keeps its own jolt (react) instead.
  let takeSq = 0, takeY = 0;
  for (let i = 1; i < track.length; i++) {
    const k = (TAKE[track[i].mood] ?? 0.4) * 0.6;
    const a = t - track[i].t;
    if (a > -0.1 && a < 0) takeSq += 0.12 * k * (1 + a / 0.1);
    else if (a >= 0 && a < 0.7) { takeSq += -0.26 * k * Math.exp(-6 * a) * Math.cos(16 * a); takeY += -14 * k * Math.exp(-7 * a) * Math.max(0, Math.cos(9 * a)); }
  }
  // bored / relieved: one slow sigh every 2 s (in 30 %, out 70 %); proud stands a little taller
  const sp = (t % 2) / 2;
  const sighC = F.sigh * (sp < 0.3 ? Math.sin((sp / 0.3) * Math.PI / 2) : Math.cos(((sp - 0.3) / 0.7) * Math.PI / 2));
  const hopY = -F.hop * Math.abs(Math.sin(t * Math.PI * 2)) * 16 - react * 16 + takeY;
  // game show look: a small parabola hop on every beat (the whole set moves on one tempo)
  const beat = 60 / GAMESHOW_BPM, bp = (t % beat) / beat;
  const beatHop = lookAt(tl, t) === "gameshow" ? -4 * bp * (1 - bp) * 12 : 0;

  // speech
  const speaking = speakingAt(tl, t);
  const emph = emphasisAt(tl, t);
  // real mouth shapes from the voice (Rhubarb) when the timeline has them, else a generic flap while a word is said
  // The mouth leads the sound by one frame (animation rule: lips a frame early read as in sync).
  // How far it opens follows the voice's loudness; the SHAPE (round / wide / closed for m-b-p) comes from Rhubarb.
  const LEAD = 1 / 30;
  const vis = visemeAt(tl, t + LEAD);
  const loud = loudnessAt(tl, t + LEAD);
  const jaw = loud === null ? null : Math.min(1, loud * 1.1);
  const mouthRaw = vis && jaw !== null ? (vis.o < 0.1 ? vis.o : Math.max(0.12, 0.3 * vis.o + 0.7 * jaw))
    : vis ? vis.o : jaw !== null ? jaw : speaking ? 0.08 + 0.92 * Math.pow(Math.abs(Math.sin(t * 14 + Math.sin(t * 4.2) * 1.2)), 1.6) : 0;
  const oMouth = Math.max(F.o, vis ? vis.r : 0);       // round "O/U" shapes use the O mouth
  const mouthWV = vis ? vis.w : 1;
  // squash & stretch on stressed words (the body "says" the word), a touch with every syllable
  let ts = 0;
  for (const sc of tl.scenes) for (const w of sc.words) if (w.emph) { const d = t - (w.start - 0.1); if (d >= 0 && d < 0.6) ts += Math.exp(-d / 0.16) * Math.sin(d * 16); }
  // talking beats: every syllable onset (loudness rising) gives the body a small push
  const rise = loud === null ? 0 : Math.max(0, loud - (loudnessAt(tl, t + LEAD - 0.08) ?? 0));
  const body = -takeSq + 0.04 * F.tall - 0.05 * sighC; // + = stretch up
  const talkSY = 1 + 0.06 * ts + 0.025 * (jaw ?? mouthRaw) + 0.05 * rise + body, talkSX = 1 - 0.04 * ts - 0.02 * rise - body * 0.6;
  const gesture = gestureAt(tl, t);
  const mouth = F.rest + (1 - F.rest) * mouthRaw; // scaleY from the top lip; 0.25 = thin smile
  // cartoon blinks: irregular (2.4-4.4 s apart), every 5th one doubled, plus one on every mood change (a classic acting beat)
  let blink = 0;
  const blinkOn = (c: number) => { const d = t - c; if (d >= 0 && d < 0.17) blink = Math.max(blink, d < 0.06 ? d / 0.06 : 1 - (d - 0.06) / 0.11); };
  for (let c = 1.1 + seed * 0.83, i = 0; c < t + 0.2; i++) { blinkOn(c); if (i % 5 === 3 - seed) blinkOn(c + 0.24); c += 2.4 + ((i * 7919 + seed * 13) % 21) / 10; }
  for (const m of track.slice(1)) blinkOn(m.t - 0.04);
  // brows ride the voice a little (people lift them with the pitch), more on stressed words and on questions (below)
  let browLift = emph * 7 + gesture.r.w * (gesture.r.pose === "point" ? 5 : 0) + 2 * (jaw ?? 0);
  // idle eye saccades: quick glances (80 ms moves) to a new spot every 1.3-2.9 s, only while he isn't speaking
  const sacc = (() => {
    const hash = (k: number) => { const x = Math.sin((k + seed * 100) * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    let k = 0, at = 0;
    while (at + 1.3 + 1.6 * hash(k) <= t) { at += 1.3 + 1.6 * hash(k); k++; }
    const target = (n: number) => (n % 3 === 2 ? 0 : (hash(n + 50) - 0.5) * 9);
    const u = Math.min(1, (t - at) / 0.08);
    return target(k - 1) + (target(k) - target(k - 1)) * u;
  })();
  let dart = emph * 4 * Math.cos((t * Math.PI) / 1.7) + F.look + sacc * (1 - emph); // glance side drifts smoothly (a hard flip every 1.7 s made the eyes jump)

  // ---- every mood has its own way of standing still (Clawd's acted emotions, toned down for the brand) ----
  // weights blend with the face, so the body changes with it
  const wM = (m: Mood) => (curMood === m ? mk : 0) + (prevMood === m && prevMood !== curMood ? 1 - mk : 0);
  const sm = (k: number) => Math.max(0, Math.sin(k)) ** 4; // a short pulse once per cycle
  let mDy = 0, mRot = 0;
  mRot += wM("angry") * (Math.sin(t * 38) * 0.5 + Math.sin(t * 23) * 0.3); mDy += wM("angry") * Math.sin(t * 31) * 0.6;           // held-in tremble
  mRot += wM("nervous") * Math.sin(t * 21) * 0.45; dart += wM("nervous") * 3.5 * Math.tanh(4 * Math.sin(t * 5.3));             // fidget, eyes flicking side to side
  mDy += wM("sad") * (5 + Math.sin(t * 0.9) * 1.5); mRot += wM("sad") * Math.sin(t * 0.7) * 1.6;                                // sinks, slow sway
  mRot += wM("curious") * Math.sin(t * 1.3) * 2.2;                                                                                // head tilts back and forth while thinking
  mRot += (wM("love") + 0.5 * wM("shy")) * Math.sin(t * Math.PI * 0.9) * 3.2; mDy += wM("shy") * 2;                             // dreamy sway / shy sway
  mDy += wM("proud") * (-3 - 2.5 * sm(t * Math.PI));                                                                             // chest out, a small pulse every second
  mDy += wM("determined") * 2.2 * sm(t * Math.PI * 2);                                                                          // a small forward pump on the beat
  mDy += wM("sleepy") * 7 * sm((t * Math.PI) / 3.2); mRot += wM("sleepy") * Math.sin(t * 0.6) * 3;                              // nods off every ~3 s
  mDy += wM("bored") * 2.5;
  const still = 1 - 0.7 * (wM("surprised") + wM("shocked")) - 0.45 * wM("sad") - 0.3 * wM("sleepy");                            // a shock freezes the idle

  // ---- talking like a person ----
  const AC = actingOf(tl, cfg.id ?? cfg.name), HD = headAt(AC, t); // the acting director (scripts/director.mjs)
  // a glance away as a sentence starts (finding the words), back to you by its first stressed word
  let startGlance = 0, question = 0;
  for (const sc of tl.scenes) {
    if (!sc.words.length) continue;
    const w0 = sc.words[0].start, d = t - (w0 - 0.15);
    if (d >= 0 && d < 0.65) startGlance += Math.sin((d / 0.65) * Math.PI) * (sc.index % 2 ? 4 : -4);
    // questions: brows up and a head tilt over the last word (the rising tone), held a moment after
    if (/[?؟]/.test(sc.say) && !AC) { // with the acting director the question tilt is its own (bigger, held)
      const last = sc.words[sc.words.length - 1], q = t - (last.start - 0.2);
      if (q >= 0 && q < last.end - last.start + 0.9) question = Math.max(question, Math.min(1, q / 0.2, (last.end - last.start + 0.9 - q) / 0.35));
    }
  }
  dart += startGlance * (1 - emph);
  // the director's turns ("all / everything" sweeps): the eyes get there 3 frames before the head (eyes -> head ->
  // body). Not in a "no" shake: there the eyes stay on whoever he talks to
  if (AC) dart += 22 * headAt({ ...AC, head: AC.head.filter((e) => e.k === "sweep") }, t + 0.1).yaw;
  // blinks where people blink: at the end of a sentence, and on a long pause
  for (const sc of tl.scenes) {
    if (!sc.words.length) continue;
    blinkOn(sc.words[sc.words.length - 1].end + 0.08);
    for (let i = 1; i < sc.words.length; i++) if (sc.words[i].start - sc.words[i - 1].end > 0.35) blinkOn(sc.words[i - 1].end + 0.05);
  }
  // the director: a blink inside every big head turn, none on the operative word
  { const ab = actingBlink(AC, t); if (ab.noBlink) blink = 0; blink = Math.max(blink, ab.blink); }
  // never end on shut eyes: the last frame is what freezes / loops on Instagram, so no blink in the last 0.45 s (eased out before it)
  blink *= Math.max(0, Math.min(1, (tl.durationSec - 0.45 - t) / 0.15));
  browLift += HD.brow;
  // eyes follow the pointing hand (up, toward the card)
  const lookX = gesture.r.pose === "point" ? -5 * gesture.r.w : 0, lookY = gesture.r.pose === "point" ? -7 * gesture.r.w : 0;
  // head nod on stressed words (a small dip and back), for the 3D coin's pitch
  let nod = 0;
  for (const sc of tl.scenes) for (const w of sc.words) if (w.emph) { const d = t - (w.start - 0.12); if (d >= 0 && d < 0.5) nod += Math.exp(-d / 0.15) * Math.sin(d * 14); }
  // human: a dip on every accented syllable of the voice, leading it by 60 ms (replaces the per-syllable loudness dip),
  // and a listener's "aha" nods at the other speaker's pauses
  nod += rise * 1.6; // and a tiny dip on every syllable
  // human: the head tilts with the intonation (one side per scene) and drifts left / right while he talks
  // + a head angle that wanders while he talks and settles when he stops (a disc only shows roll, not pitch)
  // mocap (a real person he copies): his head and body replace the generated ones where the person is seen
  const mo = mocapAt(tl, cfg.id ?? cfg.name, t);
  const mH = mo ? mo.wHead : 0, mRY = mo ? mo.wRollYaw : 0, mB = mo ? mo.wBody : 0;
  const keep = 1 - 0.8 * Math.max(mH, mRY);
  if (mo) nod = nod * (1 - 0.8 * mH) + mo.pitch * mH;
  // the director's head (roll / yaw / dip / squash) rides on top of everything
  const bobR = bobR0 * keep + (mo ? mo.roll * mRY + mo.lean * mB : 0) + HD.roll;
  // a nod on a flat disc is nearly invisible as pitch: it reads as the body dipping (and a squash, talkSY below)
  const bobY = bobY0 * keep + (mo ? mo.bob * mB : 0) + HD.dip;

  // wave on gesture points
  let wave = 0;
  for (const c of changePoints(tl)) {
    const a = t - c;
    if (a >= 0 && a < 0.8) {
      const p = a / 0.8;
      wave = Math.sin(p * Math.PI) * (-26 + 18 * Math.sin(p * Math.PI * 3));
    }
  }
  wave = wave * (1 - gesture.r.w) + gesture.r.angle * gesture.r.w;
  wave += F.armUp * Math.sin(t * 8) * 9;

  // flip to the back: scenes marked pose "flip", else once near 45 % of the reel (never first/last scene)
  const flips: number[] = [];
  for (const sc of tl.scenes) if (sc.pose === "flip") flips.push(sc.start + 0.3);
  if (!flips.length && tl.scenes.length >= 3 && !tl.presenter?.cast?.length && tl.presenter?.flip !== false) {
    const target = D * 0.45;
    let best = tl.scenes[1];
    for (const sc of tl.scenes.slice(1, -1)) if (Math.abs(sc.start - target) < Math.abs(best.start - target)) best = sc;
    flips.push(best.start + 0.3);
  }
  let sx = 1, tada = 1;
  for (const f of flips) {
    const p = t - f;
    if (p < 0 || p > 1.1) continue;
    if (p < 0.25) sx = Math.cos((p / 0.25) * (Math.PI / 2));
    else if (p < 0.85) { sx = -1; tada = 1 + 0.06 * Math.sin(Math.min(1, (p - 0.25) / 0.3) * Math.PI); }
    else sx = -Math.cos(((p - 0.85) / 0.25) * Math.PI);
  }
  // 3D: the same flips as real turns (0 -> pi in 0.3 s, hold, pi -> 2pi), so the coin's edge shows
  let flipAngle = 0;
  for (const f of flips) {
    const p = t - f;
    if (p < 0 || p > 1.15) continue;
    const e = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    flipAngle = p < 0.3 ? Math.PI * e(p / 0.3) : p < 0.85 ? Math.PI : Math.PI + Math.PI * e(Math.min(1, (p - 0.85) / 0.3));
  }
  const showBack = sx < 0;
  const flipX = Math.abs(sx) < 0.03 ? (sx < 0 ? -0.03 : 0.03) : sx;

  // entrance / exit (around the feet)
  let ex = 0, ey = 0, er = 0, esx = 1, esy = 1;
  if (entrance === "pop") {
    const s = springIn(t * fps, fps, 0, "pop");
    const sq = Math.sin(Math.min(1, t / 0.45) * Math.PI) * 0.18;
    esx = s * (1 + sq); esy = s * (1 - sq);
    ey = (1 - s) * 60;
  } else if (entrance !== "none") { // "none": already standing there
    const e = easeOut(Math.min(1, t / 0.8));
    ex = (1 - e) * 900; ey = (1 - e) * -260; er = (1 - e) * -720;
    const sc = 0.35 + 0.65 * e;
    const land = t > 0.8 && t < 1.1 ? Math.sin(((t - 0.8) / 0.3) * Math.PI) : 0;
    esx = sc * (1 + 0.12 * land); esy = sc * (1 - 0.1 * land);
  }
  esx *= 1 + react * 0.07; esy *= 1 - react * 0.05 + (curMood === "surprised" ? react * 0.1 : 0);
  const left = D - t;
  if (cfg.exit !== false && left < 0.6) {
    const p = 1 - Math.max(0, left) / 0.6;
    if (entrance === "pop") {
      const sq = Math.sin(p * Math.PI) * 0.2;
      esx *= (1 - p) * (1 + sq); esy *= (1 - p) * (1 - sq); ey += p * 60;
    } else {
      const e = p * p;
      ex -= e * 1000; ey -= e * 280; er += e * 540; esx *= 1 - 0.65 * e; esy *= 1 - 0.65 * e;
    }
  }

  browLift += 6 * question;
  return { bobY: bobY * still + mDy, bobR: bobR * still + mRot + 4 * question, breath, shift, swing, dangle, sway, F, curMood, react, hopY: hopY + beatHop, speaking, mouthRaw, mouth, oMouth, mouthWV, talkSX: talkSX * (1 + 0.6 * HD.sq), talkSY: talkSY * (1 - HD.sq), gesture, lookX, lookY: lookY - HD.eyeUp, nod, hYaw: (mo ? mo.yaw * mRY : 0) + HD.yaw, blink, browLift, dart, wave, sx, tada, showBack, flipX, flipAngle, ex, ey, er, esx, esy, entrance };
};

export const CoinPresenter: React.FC<{ tl: Timeline; theme: Theme; t: number; cfg: PresenterConfig }> = ({ tl, theme, t, cfg }) => {
  const { fps } = useVideoConfig();
  const variant = cfg.name === "mrs" ? "mrs" : "mr";
  const V = VARIANTS[variant];
  const coin = cfg.colors?.coin ?? V.coin;
  const ink = cfg.colors?.ink ?? "#0E0F12";
  const white = cfg.colors?.glove ?? "#F4F5F7";
  const outline = theme.ink;
  const entrance = cfg.entrance ?? V.entrance;
  const scale = cfg.scale ?? 1;
  const D = tl.durationSec;

  const { bobY, bobR, swing, dangle, sway, F, hopY, mouthRaw, mouth, oMouth, mouthWV, talkSX, talkSY, gesture, blink, browLift, dart, wave, tada, showBack, flipX, ex, ey, er, esx: esx0, esy: esy0 } = coinPose(tl, t, fps, cfg);
  const esx = esx0 * talkSX, esy = esy0 * talkSY;

  const face = variant === "mrs"
    ? { brows: ["M136 166 L178 166", "M202 166 L244 166"], bw: 7, mouth: "M142 250 Q190 308 238 250 Z" }
    : { brows: ["M134 170 L176 170", "M204 170 L246 170"], bw: 8, mouth: "M140 250 Q190 310 240 250 Z" };

  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <svg width={619 * scale} height={700 * scale} viewBox="0 0 380 430" style={{ transform: `translateX(${cfg.x ?? 0}px)`, overflow: "visible" }}>
        <ellipse cx={190} cy={418} rx={120} ry={10} fill="rgba(21,21,21,0.12)" transform={`translate(${ex} 0) scale(${Math.max(0, esx)} 1)`} style={{ transformOrigin: "190px 418px" }} />
        <g transform={`translate(${190 + ex} ${430 + ey}) rotate(${er}) scale(${esx} ${esy}) translate(-190 -430)`}>
          <g transform={`translate(190 222) scale(${flipX * tada} ${tada}) translate(-190 -222)`}>
            <g transform={`translate(0 ${bobY + hopY}) translate(190 222) rotate(${bobR + F.tilt}) translate(-190 -222)`}>
              {V.ponytail && (
                <g transform={`translate(285 121) rotate(${sway}) translate(-285 -121)`}>
                  <path d="M282 112 C332 82 368 118 354 164 C349 182 334 190 326 184 C342 150 332 122 280 128 Z" fill={coin} stroke={outline} strokeWidth={4} strokeLinejoin="round" />
                  <rect x={277} y={109} width={15} height={24} rx={6} fill={ink} transform="rotate(-40 285 121)" />
                </g>
              )}
              {/* legs */}
              <g transform={`translate(164 350) rotate(${dangle}) translate(-164 -350)`}>
                <path d="M164 350 L154 392" stroke={outline} strokeWidth={22} strokeLinecap="round" />
                <path d="M164 350 L154 392" stroke={coin} strokeWidth={14} strokeLinecap="round" />
                <ellipse cx={148} cy={404} rx={28} ry={12} fill={white} stroke={outline} strokeWidth={4} />
              </g>
              <g transform={`translate(216 350) rotate(${-dangle}) translate(-216 -350)`}>
                <path d="M216 350 L226 392" stroke={outline} strokeWidth={22} strokeLinecap="round" />
                <path d="M216 350 L226 392" stroke={coin} strokeWidth={14} strokeLinecap="round" />
                <ellipse cx={232} cy={404} rx={28} ry={12} fill={white} stroke={outline} strokeWidth={4} />
              </g>
              {/* left arm (swings with the bob) */}
              <g transform={`translate(70 250) rotate(${(swing + F.armUp * (140 + Math.sin(t * 8 + 1.5) * 8)) * (1 - gesture.l.w) + gesture.l.angle * gesture.l.w}) translate(-70 -250)`}>
                <path d="M70 250 C36 270 32 310 62 334" stroke={outline} strokeWidth={24} strokeLinecap="round" fill="none" />
                <path d="M70 250 C36 270 32 310 62 334" stroke={coin} strokeWidth={16} strokeLinecap="round" fill="none" />
                <g transform="translate(71 341) rotate(129)"><Glove fill={white} ink={ink} outline={outline} /></g>
              </g>
              {/* right arm (waves) */}
              <g transform={`translate(310 250) rotate(${wave}) translate(-310 -250)`}>
                <path d="M310 250 C348 232 366 184 344 142" stroke={outline} strokeWidth={24} strokeLinecap="round" fill="none" />
                <path d="M310 250 C348 232 366 184 344 142" stroke={coin} strokeWidth={16} strokeLinecap="round" fill="none" />
                <g transform="translate(338 131) rotate(-28)"><Glove fill={white} ink={ink} outline={outline} /></g>
              </g>
              {/* body */}
              <circle cx={190} cy={222} r={134} fill={outline} />
              <circle cx={190} cy={222} r={130} fill={coin} />
              <circle cx={190} cy={222} r={121} fill="none" stroke={ink} strokeWidth={6} strokeDasharray="6 9" />
              <circle cx={190} cy={222} r={104} fill="none" stroke={ink} strokeWidth={6} />
              <path d="M98 170 A104 104 0 0 1 150 120" stroke="rgba(255,255,255,0.45)" strokeWidth={9} strokeLinecap="round" fill="none" />
              {showBack ? (
                <text x={190} y={278} textAnchor="middle" fontFamily={FONT.brand} fontWeight={800} fontSize={170} fill={ink} transform="translate(380 0) scale(-1 1)">$</text>
              ) : (
                <g>
                  <text x={190} y={318} textAnchor="middle" fontFamily={FONT.brand} fontWeight={800} fontSize={28} fill={ink}>+1</text>
                  {[158, 222].map((cx, i) => (
                    <g key={cx}>
                      <g opacity={1 - F.happy} transform={`translate(${cx} 206) scale(${F.eye} ${F.eyeY * (1 - blink * 0.92)}) translate(${-cx} -206)`}>
                        <ellipse cx={cx} cy={206} rx={22} ry={27} fill={white} stroke={ink} strokeWidth={4} />
                        <circle cx={cx + dart} cy={210} r={F.pupil} fill={ink} />
                        <circle cx={cx - 4 + dart} cy={205} r={3.5} fill={white} />
                        {F.sparkle > 0.01 && <circle cx={cx + 4 + dart} cy={214} r={2.4 * F.sparkle} fill={white} />}
                        {V.lashes && (
                          <path d={i === 0 ? "M138 186 L127 178 M142 179 L133 169 M149 174 L144 162" : "M242 186 L253 178 M238 179 L247 169 M231 174 L236 162"} stroke={ink} strokeWidth={4} strokeLinecap="round" />
                        )}
                      </g>
                      {F.happy > 0.01 && (
                        <g opacity={F.happy} stroke={ink} strokeWidth={8} strokeLinecap="round" fill="none">
                          <path d={`M${cx - 21} 216 Q${cx} 186 ${cx + 21} 216`} />
                          {V.lashes && <path d={i === 0 ? "M139 205 L128 199" : "M241 205 L252 199"} strokeWidth={4} />}
                        </g>
                      )}
                    </g>
                  ))}
                  <g stroke={ink} strokeWidth={face.bw} strokeLinecap="round" fill="none">
                    <path d={face.brows[0]} transform={`translate(0 ${-browLift - F.brow - F.browTilt})`} />
                    <path d={face.brows[1]} transform={`translate(0 ${-browLift - F.brow})`} />
                  </g>
                  <g opacity={oMouth >= 0.5 ? 0 : 1} transform={`translate(190 250) scale(${F.mouthW * mouthWV} ${mouth}) translate(-190 -250)`}>
                    <path d={face.mouth} fill={ink} />
                  </g>
                  {oMouth >= 0.5 && <ellipse cx={190} cy={268} rx={19 * mouthWV} ry={10 + 16 * mouthRaw} fill={ink} />}
                </g>
              )}
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
};
