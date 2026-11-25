// Sound effects from the brand's map (brand.json "sfx"): ONE sound per on-screen movement, placed on the same
// beats the visuals use (src/components/visuals/common.tsx beatTime), each cut before the next one starts.
import path from "node:path";
import { exists, r3, readJSON, ROOT, stripMarks } from "./lib.mjs";

/** Same rule as beatTime() in the visuals: i-th emphasized word (minus lead), else evenly spaced. Absolute seconds. */
const beat = (sc, lead, i, n) => {
  const emph = sc.words.filter((w) => w.emph);
  if (emph[i]) return emph[i].start - lead;
  const span = (sc.end - sc.start) * 0.75;
  return sc.start + 0.25 + (span * (i + 1)) / (n + 1);
};

/** Movement moments of one scene's visual -> [{t, key}] (keys of the brand sfx map). */
const visualCues = (sc, lead) => {
  const v = sc.visual ?? {};
  const p = v.props ?? {};
  const dur = sc.end - sc.start;
  const at = (x) => sc.start + x;
  const each = (n, key, list) => Array.from({ length: n }, (_, k) => ({ t: typeof list?.[k]?.at === "number" ? at(list[k].at) : beat(sc, lead, k, n), key }));
  switch (v.type) {
    case "checklist": return each((p.items ?? []).length, "check", p.items);
    case "pipeline": return each((p.steps ?? []).length, "check");
    case "stamp": return [{ t: typeof p.stampAt === "number" ? at(p.stampAt) : beat(sc, lead, 0, 1), key: "stamp" }];
    case "counter": {
      const key = /coin/i.test(p.tab ?? "") ? "coin" : "number", n = Math.abs((p.to ?? 100) - (p.from ?? 0));
      // steps: one sound per number (the same pace as Counter.tsx), else one when it lands
      if (p.steps && p.onWords && n >= 1) return Array.from({ length: n }, (_, k) => ({ t: beat(sc, lead, k, n), key }));
      return p.steps && n >= 1 ? Array.from({ length: n }, (_, k) => ({ t: at(dur * 0.8 * ((k + 1) / n)), key })) : [{ t: at(dur * 0.8), key }];
    }
    case "bignum": return [{ t: at(dur * 0.7), key: "number" }];
    case "calendar": return [{ t: at(dur * 0.75), key: "pin" }];
    case "chart": return [{ t: at(0.5), key: "pin" }];
    case "phone": return p.badge ? [{ t: at(0.5), key: "pin" }] : [];
    case "cards": return [{ t: at(0.15), key: "card" }];
    case "swipe": { const n = sc.words.filter((w) => w.emph).length; return [{ t: typeof p.swipeAt === "number" ? at(p.swipeAt) : n ? beat(sc, lead, n - 1, n) : at(dur * 0.7), key: "card" }]; }
    case "map": return each(Math.min(4, (p.pins ?? []).length || 3), "pin");
    case "chat": return each((p.messages ?? []).length, "message");
    case "gym": return [{ t: beat(sc, lead, 0, 1), key: "stamp" }];
    case "wallet": return each(p.steps ?? 1, "coin");
    case "verify": return [{ t: beat(sc, lead, 0, 1), key: "verified" }];
    case "checkin": return [{ t: beat(sc, lead, 0, 1), key: "check" }];
    case "stores": return [{ t: beat(sc, lead, 0, 1), key: "end" }];
    default: return [];
  }
};

/** Coin flip time, mirrored from CoinPresenter (scene pose "flip" -> start + 0.3, else ~45 % of the reel). */
const flipTimes = (tl) => {
  const f = tl.scenes.filter((s) => s.pose === "flip").map((s) => s.start + 0.3);
  if (f.length || tl.scenes.length < 3 || tl.presenter?.type !== "coin" || tl.presenter?.cast?.length || tl.presenter?.flip === false) return f;
  const target = tl.durationSec * 0.45;
  let best = tl.scenes[1];
  for (const sc of tl.scenes.slice(1, -1)) if (Math.abs(sc.start - target) < Math.abs(best.start - target)) best = sc;
  return [best.start + 0.3];
};

const PEAKS_FILE = path.join(ROOT, "public", "sfx", "peaks.json");
const PEAKS = exists(PEAKS_FILE) ? readJSON(PEAKS_FILE) : {};

/**
 * timeline -> [{t, src, dur, volume}]. Every movement has a HIT time; its sound starts early by the file's peak offset
 * (peaks.json) so the loudest moment lands on the movement. No overlaps: a cue is cut 30 ms before the next one starts
 * (a cut that would lose the peak drops the cue). Two movements < 0.12 s apart share one sound.
 */
export const buildSfx = (tl, map) => {
  if (!map) return [];
  const raw = [];
  const add = (hit, key) => { // automatic sounds only; map.auto === false keeps just the script's own (scene "sfx")
    if (map.auto === false) return;
    const d = map[key];
    if (!Array.isArray(d) || hit < 0 || hit >= tl.durationSec) return;
    const peak = PEAKS[d[0]] ?? 0;
    raw.push({ hit: r3(hit), t: r3(Math.max(0, hit - peak)), peak, key, d });
  };
  if (tl.presenter?.type === "coin") {
    // the coin's own movements (timings mirror Coin3D / CoinPresenter)
    const is3d = tl.presenter.render === "3d";
    const pop = (tl.presenter.entrance ?? (tl.presenter.name === "mrs" ? "fly" : "pop")) === "pop";
    const cast = tl.presenter.cast?.length ? tl.presenter.cast : null;
    if (cast && cast.some((m) => typeof m === "object")) {
      // a cast of copies: everyone is on stage from the start (one entrance sound; none when they are already standing there)
      if (tl.presenter.entrance !== "none") { add(0.45, "presenterIn"); add(0.9, "land"); }
    } else if (tl.presenter.entrance === "none") {
      // already standing there at frame 0 (a loop): nobody flies in, so no entrance sound
    } else if (cast) {
      // duo: Mr. Coin drops in (lands at +0.7), Mrs. Coin flies in from the depth (lands at +0.9), each when they first speak
      for (const who of cast) {
        const at = tl.scenes.find((sc) => sc.speaker === who)?.start ?? 0;
        if (who === "mr") add(at + 0.7, "land"); else { add(at + 0.45, "presenterIn"); add(at + 0.9, "land"); }
      }
    } else {
      if (is3d || !pop) add(is3d ? 0.45 : 0.4, "presenterIn"); // the fly-in, peak mid-flight
      add(is3d ? 0.9 : pop ? 0.25 : 0.8, "land");
    }
    // flights between places (scene "place" changes far enough): one whoosh mid-flight
    // (only when the place really changes: a cast scene repeats its places to keep them, that is not a move)
    const placeKey = (sc) => JSON.stringify(sc?.place ?? null);
    tl.scenes.forEach((sc, i) => { if (i > 0 && sc.place && sc.fly !== false && placeKey(sc) !== placeKey(tl.scenes[i - 1])) add(sc.start + 0.4, "move"); });
    // footsteps (brand key "step"): a walk in / out = a step every 0.29 s, a jog ("fly": false to a new place) every 0.2 s
    for (const sc of tl.scenes) for (const c of sc.cues ?? []) {
      const n = String(c.name).split(":").pop();
      if (n === "walkIn") for (let k = 0; k < 4; k++) add(c.t + 0.18 + k * 0.29, "step");
      if (n === "walkOut") for (let k = 0; k < 4; k++) add(c.t + 0.25 + k * 0.29, "step");
    }
    tl.scenes.forEach((sc, i) => { if (i > 0 && sc.place && sc.fly === false && placeKey(sc) !== placeKey(tl.scenes[i - 1])) for (let k = 0; k < 3; k++) add(sc.start + 0.14 + k * 0.2, "step"); });
    if (tl.presenter.exit !== false) add(tl.durationSec - 0.35, "exit");
    for (const f of flipTimes(tl)) { add(f + 0.15, "flip"); add(f + 0.32, "reveal"); add(f + 1.0, "flipBack"); }
  }
  tl.scenes.forEach((sc, i) => {
    if (i > 0 && !sc.fade) add(sc.start, "scene"); // a fade through black is quiet: no whoosh
    for (const c of visualCues(sc, tl.captions.lead)) add(Math.max(sc.start, c.t), c.key);
  });
  for (const e of tl.events ?? []) if (e.kind === "whipPan") add(e.t, "fix");
  // the ball: whistle on the first kick's wind-up, a thud when the foot meets it, bounces, a cartoon bonk on a hit
  for (const e of tl.ball?.events ?? []) add(e.t, e.key);
  // the script's own sounds (scene "sfx": [{ at, sound, dur, volume, layer }]): at = s after the scene starts or a word
  // of the line; sound = a brand map key or a file under public/sfx (no .mp3). layer: true = under everything (a typing
  // bed, a crowd), never cut and never cutting; otherwise it takes its turn like any movement sound
  const layers = [];
  for (const sc of tl.scenes) {
    for (const s of sc.sfx ?? []) {
      const w = typeof s.at === "string" ? sc.words.find((x) => stripMarks(x.w ?? x.text ?? "").includes(s.at)) : null;
      const hit = w ? w.start : sc.start + (typeof s.at === "number" ? s.at : 0);
      const d = Array.isArray(map[s.sound]) ? [...map[s.sound]] : [s.sound, s.dur ?? 2, s.volume ?? 0.6];
      if (s.dur !== undefined) d[1] = s.dur;
      if (s.volume !== undefined) d[2] = s.volume;
      const peak = s.peak ?? PEAKS[d[0]] ?? 0;
      // a negative "peak" starts the sound that long AFTER the hit (a sad trombone after the line ends)
      if (s.layer) layers.push({ t: r3(Math.max(0, hit - peak)), src: `sfx/${d[0]}.mp3`, dur: r3(d[1] + Math.max(0, peak)), volume: r3(d[2] * (map.gain ?? 1)), key: "layer" });
      else if (hit >= 0 && hit < tl.durationSec) raw.push({ hit: r3(hit), t: r3(Math.max(0, hit - peak)), peak, key: "script", d });
    }
  }
  raw.sort((a, b) => a.hit - b.hit);
  const merged = [];
  for (const c of raw) {
    const prev = merged[merged.length - 1];
    // two sounds on one moment: the script's own sound wins, then any movement over a plain scene change
    if (prev && c.hit - prev.hit < 0.12) { if (prev.key !== "script" && (c.key === "script" || prev.key === "scene" || prev.key === "fix")) merged[merged.length - 1] = c; continue; }
    merged.push(c);
  }
  merged.sort((a, b) => a.t - b.t);
  const out = [];
  merged.forEach((c, i) => {
    const next = merged[i + 1];
    const dur = Math.min(c.d[1] + c.peak, next ? next.t - c.t - 0.03 : c.d[1] + c.peak);
    if (dur >= Math.max(0.08, c.peak + 0.05)) out.push({ t: c.t, src: `sfx/${c.d[0]}.mp3`, dur: r3(dur), volume: r3(c.d[2] * (map.gain ?? 1)), key: c.key });
  });
  return [...out, ...layers].sort((a, b) => a.t - b.t);
};
