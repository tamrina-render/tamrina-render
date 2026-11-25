// Build timeline.json from script.json + per-scene voice clips. Pure data, no rendering.
import fs from "node:fs";
import path from "node:path";
import { isRTL, r3, ROOT, stripMarks, warn } from "./lib.mjs";
import { buildSfx } from "./sfx.mjs";

// the named edits (src/components/Edits.tsx; one list for both sides: src/components/edit-names.json). An unknown name draws nothing: warn
const EDIT_NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "components", "edit-names.json"), "utf8"));
const editOf = (e, i) => {
  const ed = typeof e === "string" ? { type: e } : e;
  if (!EDIT_NAMES.includes(ed?.type)) warn(`scene ${i + 1}: unknown edit "${ed?.type}" (draws nothing). Valid: ${EDIT_NAMES.join(", ")}`);
  return ed;
};

const DEFAULTS = {
  fps: 30, width: 1080, height: 1920, speed: 1.12, gap: 0.28, tail: 0.7, lead: 0.15,
  captions: "headline", presenter: { type: "builtin", name: "default" },
};

// ElevenLabs-style audio tags in `say` ("[excited] يلا بينا") also drive the coin's face. Tag -> presenter mood.
const MOODS = {
  excited: "excited", enthusiastic: "excited", energetic: "excited", shouting: "excited", proud: "proud",
  happy: "happy", warm: "happy", playful: "happy", cheerful: "happy",
  laughs: "laugh", laughing: "laugh", chuckles: "laugh", giggles: "laugh",
  surprised: "surprised", gasps: "surprised", amazed: "surprised", shocked: "surprised", wow: "surprised",
  curious: "curious", thoughtful: "curious", whispers: "curious", mischievously: "curious", sarcastic: "curious", confused: "curious",
  calm: "neutral", neutral: "neutral", explaining: "neutral",
  sad: "sad", crying: "cry", sobbing: "cry", angry: "angry", annoyed: "annoyed", frustrated: "annoyed", nervous: "nervous", sleepy: "sleepy", tired: "sleepy",
  determined: "determined", confident: "determined", serious: "determined", bored: "bored", relieved: "relieved", sighs: "relieved",
  disgusted: "disgusted", disgust: "disgusted", zen: "zen", peek: "peek", resigned: "resigned", givesup: "resigned",
};
// face-only moods for {cues} (ElevenLabs never sees them)
const FACE_MOODS = {
  sad: "sad", cry: "cry", crying: "cry", angry: "angry", mad: "angry", annoyed: "annoyed", smug: "smug", ehem: "smug",
  shocked: "shocked", love: "love", hearts: "love", starry: "starry", stars: "starry", sleepy: "sleepy", dizzy: "dizzy",
  shy: "shy", blush: "shy", nervous: "nervous", wink: "wink", happy: "happy", laugh: "laugh", excited: "excited",
  surprised: "surprised", curious: "curious", calm: "neutral", neutral: "neutral",
  determined: "determined", focus: "determined", proud: "proud", bored: "bored", relieved: "relieved", phew: "relieved",
  disgusted: "disgusted", disgust: "disgusted", ew: "disgusted", zen: "zen", peek: "peek", resigned: "resigned", givesup: "resigned",
};
const moodOf = (tag) => { for (const w of tag.toLowerCase().split(/\s+/)) if (MOODS[w]) return MOODS[w]; return null; };

/**
 * Split `say` into the spoken text (tags and cues removed) + [{ word: index of the next spoken word, mood }] from
 * [voice tags] and {face moods}, + [{ word, name }] animation cues from {cues} (gestures, actions, fx).
 */
const parseTags = (say) => {
  const tags = [], cues = [];
  let words = 0;
  const re = /\[([^\]\[]*)\]|\{([^}]*)\}|(\S+)/g;
  let m;
  while ((m = re.exec(say))) {
    if (m[1] !== undefined) { const mood = moodOf(m[1]); if (mood) tags.push({ word: words, mood }); }
    else if (m[2] !== undefined) {
      for (const name of m[2].split(/[\s,]+/).filter(Boolean)) {
        const mood = FACE_MOODS[name] ?? MOODS[name];
        if (mood) tags.push({ word: words, mood, temp: true }); else cues.push({ word: words, name });
      }
    }
    else if (!/^\*+$/.test(m[3])) words++;
  }
  return { say: say.replace(/\[[^\]\[]*\]/g, "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim(), tags, cues };
};

/** Words that were *emphasized* in `say`, by normalized text, in order. */
const emphasisFlags = (say, words) => {
  const toks = [];
  const re = /\*([^*]+)\*|(\S+)/g;
  let m;
  while ((m = re.exec(say))) {
    if (m[1] !== undefined) for (const p of m[1].trim().split(/\s+/)) toks.push({ t: p, e: true });
    else toks.push({ t: m[2], e: false });
  }
  const norm = (s) => s.toLowerCase().replace(/[ً-ْٰ]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
  let j = 0;
  const flags = words.map(() => false);
  for (let i = 0; i < toks.length; i++) {
    const want = norm(toks[i].t);
    let found = -1;
    for (let k = j; k < Math.min(words.length, j + 3); k++) {
      const have = norm(words[k].w);
      if (have === want || (want.length > 1 && have.startsWith(want)) || (have.length > 1 && want.startsWith(have))) { found = k; break; }
    }
    if (found === -1) { if (toks[i].e && words[j]) flags[j] = true; continue; }
    if (toks[i].e) flags[found] = true;
    j = found + 1;
  }
  return flags;
};

/**
 * @param script  parsed script.json
 * @param clips   per scene: { words:[{w,start,end}] (relative to the processed clip), duration }
 */
export const buildTimeline = (script, clips, { audioPath, speed, gaps }) => {
  const fps = script.fps ?? DEFAULTS.fps;
  const lead = script.lead ?? DEFAULTS.lead;
  const gap = script.gap ?? DEFAULTS.gap;
  const tail = script.tail ?? DEFAULTS.tail;
  const lang = script.lang ?? "en";
  let offset = 0;
  const scenes = script.scenes.map((sc, i) => {
    const clip = clips[i];
    const { say, tags, cues: rawCues } = parseTags(sc.say);
    const flags = emphasisFlags(say, clip.words);
    const words = clip.words.map((w, k) => ({ w: w.w, start: r3(offset + w.start), end: r3(offset + w.end), ...(flags[k] ? { emph: true } : {}) }));
    const start = r3(offset);
    const end = r3(offset + clip.duration + (gaps?.[i] ?? gap));
    // auto events: every emphasized word gets a zoom kick (a beat before it is said), min 0.45 s apart
    const events = [];
    let last = -9;
    for (const w of words) {
      if (!w.emph) continue;
      const t = r3(Math.max(start, w.start - lead));
      if (t - last < 0.45) continue;
      events.push({ t, kind: "zoomKick" });
      last = t;
    }
    // explicit beats: { word: "40,000", kind: "whipPan" } or { at: 1.2 (local s), kind }
    for (const b of sc.beats ?? []) {
      let t = null;
      if (typeof b.at === "number") t = start + b.at;
      else if (b.word) {
        const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
        const w = words.find((x) => norm(x.w) === norm(b.word) || norm(x.w).startsWith(norm(b.word)));
        if (w) t = w.start - lead;
      }
      if (t !== null) events.push({ t: r3(Math.max(start, t)), kind: b.kind ?? "zoomKick", ...(b.strength ? { strength: b.strength } : {}), ...(b.dir ? { dir: b.dir } : {}) });
    }
    events.sort((a, b) => a.t - b.t);
    // moods: scene "mood" holds from the scene start, each tag switches a beat before its next word
    const moods = [];
    if (sc.mood) moods.push({ t: start, mood: sc.mood });
    for (const tg of tags) {
      const w = words[Math.min(tg.word, words.length - 1)];
      moods.push({ t: r3(tg.word === 0 || !w ? start : Math.max(start, w.start - lead)), mood: tg.mood, ...(tg.temp ? { temp: true } : {}) });
    }
    // {cues}: a beat before their word (like the moods), or at the scene start
    const cues = rawCues.map((c) => { const w = words[Math.min(c.word, words.length - 1)]; return { t: r3(c.word === 0 || !w ? start + 0.05 : Math.max(start, w.start - lead)), name: c.name }; });
    for (const a of [].concat(sc.action ?? [])) cues.push({ t: r3(start + (typeof a === "object" && typeof a.at === "number" ? a.at : 0.2)), name: typeof a === "object" ? a.type : a });
    // one slow-motion beat: "slowmo": { at: <s in the scene | a word>, dur, rate }. The picture slows to "rate" AT that moment and is
    // back on real time at both ends of the window, so nothing after it drifts
    let slow = null;
    if (sc.slowmo) {
      const w = typeof sc.slowmo.at === "string" ? words.find((x) => stripMarks(x.w).includes(sc.slowmo.at)) : null;
      const c = w ? w.start : start + (typeof sc.slowmo.at === "number" ? sc.slowmo.at : (end - start) / 2), d = sc.slowmo.dur ?? 1.2;
      slow = { t0: r3(Math.max(start, c - d / 2)), t1: r3(Math.min(end, c + d / 2)), rate: sc.slowmo.rate ?? 0.4 };
      if (words.some((x) => x.end > slow.t0 && x.start < slow.t1)) warn(`scene ${i + 1}: words are spoken inside the slow motion (${slow.t0}-${slow.t1}s): the lips run up to ${Math.round((1 - slow.rate) * 0.1 * (slow.t1 - slow.t0) * 1000)} ms off there; put it on a silent moment`);
    }
    offset = end;
    return {
      id: String(i + 1).padStart(2, "0"),
      index: i,
      label: sc.label ?? `scene ${i + 1}`,
      ...(sc.counter ? { counter: sc.counter } : {}),
      start, end,
      say,
      words,
      visual: sc.visual ?? { type: "none" },
      events,
      ...(sc.pose ? { pose: sc.pose } : {}),
      ...(sc.seam === "cut" || sc.seam === "fade" ? { seam: "cut" } : {}),
      ...(sc.seam === "fade" ? { fade: typeof sc.fade === "number" ? sc.fade : 0.4 } : {}), // a fade through black INTO this scene (a time skip): a cut under the black, fade = total seconds
      ...(typeof sc.creep === "number" ? { creep: sc.creep } : {}), // slow creep zoom: the picture reaches this zoom (1.03-1.12) at the scene's end
      ...(sc.edit ? { edit: editOf(sc.edit, i) } : {}), // a named edit (src/components/Edits.tsx): "orbit" or { type, ...props }
      ...(slow ? { slowmo: slow } : {}),
      ...(typeof sc.look === "string" ? { look: sc.look } : {}),
      ...(sc.look && typeof sc.look === "object" ? { gaze: sc.look } : {}), // an object "look" = where each cast coin looks
      ...(sc.camera ? { camera: sc.camera } : {}),
      ...(Array.isArray(sc.sfx) ? { sfx: sc.sfx } : {}),
      ...(sc.judge ? { judge: sc.judge } : {}),
      ...(sc.gesture ? { gesture: sc.gesture } : {}),
      ...(sc.speaker ? { speaker: sc.speaker } : {}),
      ...(sc.accent ? { accent: sc.accent } : {}),
      ...(sc.place ? { place: sc.place } : {}),
      ...(sc.fly === false || typeof sc.fly === "object" ? { fly: sc.fly } : {}),
      ...(sc.sign ? { sign: sc.sign } : {}),
      ...(sc.behind ? { behind: sc.behind } : {}), // the card covers the coin (hidden behind a logo)
      ...(typeof sc.peekEdge === "number" ? { peekEdge: sc.peekEdge } : {}), // {peek}: x of the edge he hides behind
      ...(sc.freeze ? { freeze: sc.freeze } : {}),
      ...(sc.headline === false || script.text === false ? { headline: false } : {}),
      ...(sc.outfit ? { outfit: sc.outfit } : {}),
      ...(sc.kit ? { kit: sc.kit } : {}),
      ...(sc.seated !== undefined ? { seated: sc.seated } : {}),   // sits / stands this scene (per coin or one flag)
      ...(sc.ride ? { ride: sc.ride } : {}),   // rides a moving part of the footage (per coin, see RideCfg in types.ts)
      ...(sc.floor === false ? { floor: false } : {}),   // no floor under the coins: no contact shadow, no glow
      ...(sc.dumbbell !== undefined ? { dumbbell: sc.dumbbell } : {}), // dumbbell size this scene (per coin or one number)
      ...(sc.hinge !== undefined ? { hinge: sc.hinge } : {}),       // barbell: how far he bends over with it (per coin or one number)
      ...(sc.footage ? { footage: sc.footage } : {}),
      ...(typeof sc.turn === "number" ? { turn: sc.turn } : {}),
      ...(sc.lookAt ? { lookAt: sc.lookAt } : {}),
      ...(Array.isArray(sc.watch) && sc.watch.length ? { watch: sc.watch } : {}),
      ...(moods.length ? { moods } : {}),
      ...(cues.length ? { cues } : {}),
    };
  });
  // "jcut" (script or scene, seconds, at most 0.2): the picture changes that long AFTER the scene's sound starts, so the
  // voice leads the cut. Only the boundary moves; words, lips and sounds keep their times
  scenes.forEach((s, i) => {
    const d = Math.min(0.2, script.scenes[i].jcut ?? script.jcut ?? 0, (s.end - s.start) / 3);
    if (i === 0 || !(d > 0)) return;
    scenes[i - 1].end = s.start = r3(s.start + d);
    for (const k of ["events", "moods", "cues"]) for (const x of s[k] ?? []) if (x.t < s.start) x.t = s.start;
  });
  // footage: a scene without "from" that uses the same clip as the scene before continues where that one ended
  scenes.forEach((s, i) => {
    if (!s.footage || s.footage.from !== undefined) return;
    const p = scenes[i - 1];
    s.footage = { ...s.footage, from: p?.footage && p.footage.src === s.footage.src ? r3((p.footage.from ?? 0) + (p.end - p.start)) : 0 };
  });
  // last scene holds for the tail
  if (scenes.length) scenes[scenes.length - 1].end = r3(scenes[scenes.length - 1].end + tail);
  const ball = buildBall(script, scenes);
  const durationSec = scenes.length ? scenes[scenes.length - 1].end : 3;
  const tl = {
    slug: script.slug,
    title: script.title ?? script.slug,
    lang,
    dir: script.dir ?? (isRTL(lang) ? "rtl" : "ltr"),
    fps,
    width: script.width ?? DEFAULTS.width,
    height: script.height ?? DEFAULTS.height,
    durationSec: r3(durationSec),
    audio: audioPath,
    music: script.music ?? null,
    presenter: script.loop ? { ...(script.presenter ?? DEFAULTS.presenter), entrance: "none", exit: false } : script.presenter ?? DEFAULTS.presenter, // a loop: he is there at frame 0 and still there at the end
    captions: { mode: script.captions ?? DEFAULTS.captions, lead, ...(typeof script.captionY === "number" ? { y: script.captionY } : {}), ...(typeof script.captionCtaY === "number" ? { ctaY: script.captionCtaY, ctaT: script.captionCtaT ?? 0 } : {}) },
    theme: script.theme ?? {},
    brand: script.brand ?? null,
    pool: script.pool ?? null,
    handle: script.handle,
    motion: script.motion ?? "reel",
    ...(script.seam === false ? { seam: false } : {}),
    ...(script.loop ? { loop: true } : {}), // the last 0.4 s dissolves into frame 0, so the replay has no seam
    ...(script.text === false ? { text: false } : {}),
    ...(script.front ? { front: script.front } : {}), // a transparent PNG over the coins (what stands in front of him in the set)
    ...(script.format ? { format: script.format } : {}), // "fact": a fact / story reel (the hold check skips the length line, owner 2026-11-16)
    ...(script.caption ? { caption: typeof script.caption === "string" ? { text: script.caption } : script.caption } : {}), // one fixed caption for the whole video
    ...(script.look ? { look: script.look } : {}),
    ...(ball ? { ball } : {}),
    scenes,
    events: [],
    tail,
    meta: { speed, voice: script.voice ?? null, builtAt: new Date().toISOString(), narration: script.scenes.map((s) => stripMarks(s.say)).join(" ") },
  };
  tl.sfx = buildSfx(tl, script.sfxMap);
  return tl;
};

// ---------- the ball (one per video) ----------
// Cues "{red5:pass>captain}", "{new11:kick>mr}" (a shot), "{captain:lob>goal}", "{x:bounce>spot}": the kicker plays
// {kick} (the foot meets the ball KICK_CONTACT later, that is when the ball leaves); the ball flies to a coin (its feet,
// or its FACE for a shot -> that coin gets {hit} automatically) or to a named spot of script.ball.spots (a place name,
// "x,y,size" px or fractions; cues can't hold commas). Fixed flight times keep a shot readable at any distance.
// tl.ball = { start, legs: [{ t0, t1, kind, from, to, toCoin, hit }], events: [{ t, key }] } (keys of the brand sfx map)
const KICK_CONTACT = 0.35; // = src/lib/speech.ts
const FLIGHT = { pass: 0.8, shot: 0.5, lob: 1.25, bounce: 1.1 };
const buildBall = (script, scenes) => {
  const cfg = script.ball;
  const castIds = (script.presenter?.cast ?? []).map((m) => (typeof m === "string" ? m : m.id));
  const ids = castIds.length ? castIds : [script.presenter?.name ?? "mr"];
  const moves = [];
  for (const sc of scenes) for (const c of sc.cues ?? []) {
    const m = c.name.match(/^(?:([^:>]+):)?(pass|kick|shot|lob|bounce)>(.+)$/);
    if (!m) continue;
    const who = m[1] ?? sc.speaker ?? ids[0];
    c.name = m[1] ? `${m[1]}:kick` : "kick"; // the kicker's move; the ball part is below
    moves.push({ t: c.t, who, verb: m[2] === "kick" ? "shot" : m[2], target: m[3] });
  }
  if (!cfg && !moves.length) return null;
  moves.sort((a, b) => a.t - b.t);
  const legs = [], events = [];
  let at = cfg?.start ?? moves[0]?.who ?? ids[0]; // where the ball is: a coin id, a spot, or "near:<id>"
  moves.forEach((mv, i) => {
    const t0 = r3(mv.t + KICK_CONTACT), t1 = r3(t0 + FLIGHT[mv.verb]);
    const spot = cfg?.spots?.[mv.target];
    const toCoin = !spot && ids.includes(mv.target);
    const hit = toCoin && mv.verb === "shot";
    if (i === 0) events.push({ t: r3(mv.t), key: "whistle" });
    events.push({ t: t0, key: "kick" });
    legs.push({ t0, t1, kind: mv.verb, from: at, to: toCoin ? mv.target : spot ?? mv.target, toCoin, hit });
    if (hit) {
      // off his face: two bounces, then it rests on the floor next to him; he gets {hit} the moment it lands
      events.push({ t: t1, key: "bonk" }, { t: r3(t1 + 0.55), key: "bounce" }, { t: r3(t1 + 0.83), key: "bounce" });
      legs.push({ t0: t1, t1: r3(t1 + 1.0), kind: "rebound", from: mv.target, to: `near:${mv.target}`, toCoin: false, hit: false });
      const sc = scenes.find((s) => t1 >= s.start && t1 < s.end) ?? scenes[scenes.length - 1];
      (sc.cues ??= []).push({ t: t1, name: `${mv.target}:hit` });
      sc.cues.sort((a, b) => a.t - b.t);
      at = `near:${mv.target}`;
    } else if (toCoin) {
      at = mv.target;
    } else {
      if (mv.verb !== "pass") events.push({ t: t1, key: "bounce" }, { t: r3(t1 + 0.38), key: "bounce" });
      legs.push({ t0: t1, t1: r3(t1 + (mv.verb === "pass" ? 0.01 : 0.6)), kind: "settle", from: legs[legs.length - 1].to, to: legs[legs.length - 1].to, toCoin: false, hit: false });
      at = legs[legs.length - 1].to;
    }
  });
  return { start: cfg?.start ?? moves[0]?.who ?? ids[0], spots: cfg?.spots ?? {}, legs, events };
};

export { DEFAULTS };
export { MOODS, FACE_MOODS }; // the acting director tells mood cues from body cues
