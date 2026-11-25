#!/usr/bin/env node
/**
 * Hold check: warns BEFORE a render when a video breaks the rules learned from our own Instagram numbers
 * (PLAYBOOK §2 rule 10; D:\Claude\Reel Boost\skill\reel-boost\data\learnings.md). It never stops a build.
 *
 *   node scripts/hold-check.mjs <slug> [--tl peek-timeline.json] [--json]
 *
 * It samples the engine's own motion math (like motion-check: no rendering), so the coin's real place and size on
 * screen are used (scale, camera, seated, riding), not the script fields. Checks:
 *   1. frame 0: a coin is on screen, not hidden, from the first half second
 *   2. length: 8-15 s holds best (warns above 16 s; not for a fact / story reel, script "format": "fact": the owner
 *      accepts 30 s+ there, 2026-11-16)
 *   3. a coin that stays small on real footage reads as a sticker put on top
 *   5. no real touch: on footage he never sits on / rides / holds / passes behind anything in the picture
 *   4. the same shot for too long: nothing changes at shot level (cut, camera, the coin's place or size, a card, a punch-in)
 * make.mjs runs it on every draft, peek and final and prints the lines; the final also writes them into report.md.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// thresholds (calibrated 2026-11-11 on the timelines of the 15 reels in the 2026-11-09 review)
export const HOLD = {
  firstSeen: 1.5,   // s: the coin must be on screen by then (N1 opened on a cow and held 56 % with the coin at 1.1 s; the logo openings showed him at 4.3-4.7 s and held 13-26 %)
  maxLen: 16,       // s (the review's good band is 8-15 s; a 15.0 s remake is fine)
  small: 0.2,       // coin width / frame width: below this on footage he reads as a sticker
  smallFor: 3,      // s of footage with only small coins before it is flagged
  sameShot: 8.5,    // s without a shot-level change (phone-off: one shot for 8.3 s, hold 61 % = stays quiet; the 9.7-14 s ones held 26-39 %)
};

let probeCache = null;
/** the pure motion functions of the engine, bundled once for node (same way as motion-check) */
const loadProbe = async () => {
  if (probeCache) return probeCache;
  process.noDeprecation = true; // three prints a CJS deprecation line on every load
  const { build } = await import("esbuild");
  const out = path.join(ROOT, "node_modules", ".cache", `hold-probe-${process.pid}.mjs`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const res = await build({
    stdin: { contents: `export { __probe } from "./components/Coin3D"; export { coinPose } from "./components/CoinPresenter";`, resolveDir: path.join(ROOT, "src"), loader: "ts" },
    bundle: true, platform: "node", format: "esm", packages: "external", write: false, logLevel: "silent",
  });
  fs.writeFileSync(out, res.outputFiles[0].text);
  probeCache = await import(pathToFileURL(out).href);
  fs.rmSync(out, { force: true });
  return probeCache;
};

const r1 = (x) => Math.round(x * 10) / 10;

/** { warnings: [text], facts: {...} } for one timeline. Never throws for a video without a coin: returns no warnings. */
export const holdCheck = async (tl) => {
  const cfg = tl.presenter ?? {};
  const facts = { length: tl.durationSec };
  const warnings = [];
  if (tl.durationSec > HOLD.maxLen && tl.format !== "fact") warnings.push(`length ${r1(tl.durationSec)} s: our reels of 8-15 s kept 57-72 % watch-through, the 30 s and 41 s ones 23-27 %. Cut dead seconds or a slow middle`);
  if (cfg.type !== "coin") return { warnings, facts };
  const { __probe } = await loadProbe();
  const { viewFor, castOf, kindFor, liveRig, cameraAt } = __probe;
  const W = tl.width ?? 1080, H = tl.height ?? 1920, fps = tl.fps ?? 30, STEP = 0.1;
  const members = castOf(tl, cfg);
  const views = members.map((m) => viewFor(tl, m.who, m.duo, kindFor(m.who, m.c)));
  const sceneAt = (t) => tl.scenes.find((s) => t >= s.start && t < s.end) ?? tl.scenes[tl.scenes.length - 1];
  const hidden = (sc, t) => sc?.behind === true || (typeof sc?.behind === "number" && t - sc.start < sc.behind);
  const samples = [];
  for (let t = 0; t < tl.durationSec; t += STEP) {
    const sc = sceneAt(t), cam = cameraAt(tl, t), zoom = cam?.s ?? 1;
    let best = null; // the biggest coin on screen
    for (let i = 0; i < members.length; i++) {
      const m = members[i], { S } = liveRig(tl, views[i], t, m.who, m.duo, m.c, fps, m.enterAt);
      if (!S.visible || S.vis < 0.5 || hidden(sc, t)) continue;
      const on = S.px > -S.r * 0.3 && S.px < W + S.r * 0.3 && S.py > -S.r * 0.3 && S.py < H + S.r * 0.3;
      if (!on) continue;
      const w = (2 * S.r * zoom) / W;
      if (!best || w > best.w) best = { w, x: S.px, y: S.py };
    }
    samples.push({ t, sc, best, cam, shot: `${sc.footage?.src ?? ""}|${sc.visual?.type ?? "none"}|${JSON.stringify(sc.visual?.props?.src ?? "")}` });
  }

  // 1. frame 0
  const first = samples.find((s) => s.best);
  facts.firstSeen = first ? r1(first.t) : null;
  if (!first) warnings.push("no coin on screen in the whole video");
  else if (first.t > HOLD.firstSeen) warnings.push(`frame 0: the coin is first seen at ${r1(first.t)} s. Openings with a character in action at 0 s held 56-62 %, empty / logo openings 13-48 %. Put him in the first frame, already doing something`);

  // 3. small on footage
  let run = 0, worst = null, minW = 1;
  for (const s of samples) {
    if (s.sc.footage?.src && s.best && s.best.w < HOLD.small) { run += STEP; minW = Math.min(minW, s.best.w); if (!worst || run > worst.dur) worst = { end: s.t, dur: run, w: minW }; }
    else { run = 0; minW = 1; }
  }
  const sizes = samples.filter((s) => s.sc.footage?.src && s.best).map((s) => s.best.w);
  facts.coinWidth = sizes.length ? { min: Math.round(Math.min(...sizes) * 100) / 100, max: Math.round(Math.max(...sizes) * 100) / 100 } : null;
  if (worst && worst.dur >= HOLD.smallFor) warnings.push(`small coin: ${r1(worst.end - worst.dur)}-${r1(worst.end)} s he is only ${Math.round(worst.w * 100)} % of the frame width on real footage (owner: a small coin in the corner reads as a picture put on top). Person size next to the thing, or a camera push-in`);

  // 4. the same shot for too long: shot-level changes only (the hands gesture every ~1.6 s, they don't count)
  const changes = [0];
  const punch = new Set(["punch", "shake", "freeze", "crash", "poof", "walkIn", "walkOut", "flip", "toss", "jump"]);
  for (const sc of tl.scenes) for (const q of sc.cues ?? []) if (punch.has(String(q.name).split(":").pop().split(">")[0])) changes.push(q.t); // cue times are absolute
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (a.shot !== b.shot) { changes.push(b.t); continue; }
    if (!!a.best !== !!b.best) { changes.push(b.t); continue; }
    const lastT = changes.filter((c) => c <= b.t).pop() ?? 0, ref = samples.find((s) => s.t >= lastT) ?? a;
    // against the shot as it was at the last change: the camera pushed in / the coin went somewhere else or changed size
    if (ref.best && b.best && (Math.abs(b.best.x - ref.best.x) > W * 0.18 || Math.abs(b.best.y - ref.best.y) > H * 0.12 || Math.abs(b.best.w / ref.best.w - 1) > 0.22)) { changes.push(b.t); continue; }
    if ((ref.cam || b.cam) && Math.abs((b.cam?.s ?? 1) / (ref.cam?.s ?? 1) - 1) > 0.1) changes.push(b.t);
  }
  const ts = [...new Set(changes.filter((c) => c >= 0 && c < tl.durationSec).map((c) => r1(c)))].sort((x, y) => x - y);
  ts.push(r1(tl.durationSec));
  let gap = { from: 0, dur: 0 };
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > gap.dur) gap = { from: ts[i - 1], dur: r1(ts[i] - ts[i - 1]) };
  facts.longestSameShot = gap;
  if (gap.dur > HOLD.sameShot) warnings.push(`same shot: ${gap.from}-${r1(gap.from + gap.dur)} s nothing changes at shot level for ${gap.dur} s (a note, thin evidence: our long single-shot reels were mostly the weaker ones at 37-39 % hold, N1 still held 56 %; one shot is fine in a short 8 s reel). Add a camera push-in ("camera"), a cut, or move the coin`);
  // 5. one real touch (the Roger Rabbit rule: "he should always be touching something real"): on footage he sits on,
  // rides, holds, hangs from or passes behind something that is in the picture, at least once
  const onFootage = tl.scenes.some((s) => s.footage?.src);
  const touchCue = new Set(["grab", "hang", "lean", "sit", "peek", "push", "kick", "pass", "lob", "bounce", "hold", "shove"]);
  const touches = !!tl.front || !!(tl.companions?.length || tl.companion) || (cfg.cast ?? []).some((m) => typeof m === "object" && (m.seated || m.press)) || cfg.seated
    || tl.scenes.some((s) => s.seated || s.ride || s.behind || s.sign || (s.cues ?? []).some((q) => touchCue.has(String(q.name).split(":").pop().split(">")[0])));
  facts.touchesReal = touches;
  if (onFootage && !touches) warnings.push('no real touch: he never sits on, rides, holds or passes behind anything in the picture, so he can read as a sticker on top. Give him one touch: "seated" on something real, "front" (a thing in front of him), a ride, {grab}, {hang}');
  return { warnings, facts };
};

/** the lines make.mjs prints / writes into the report */
export const holdLines = ({ warnings }) => (warnings.length ? warnings.map((w) => `hold check: ${w}`) : ["hold check: OK (coin in frame 0, length, coin size, shot changes, a real touch)"]);

if (process.argv[1] && process.argv[1].endsWith("hold-check.mjs")) {
  const args = process.argv.slice(2), slug = args.find((x) => !x.startsWith("--"));
  if (!slug) { console.error("usage: node scripts/hold-check.mjs <slug> [--tl peek-timeline.json] [--json]"); process.exit(1); }
  const dir = path.join(ROOT, "videos", slug), ti = args.indexOf("--tl");
  const file = ti >= 0 ? path.resolve(dir, args[ti + 1]) : fs.readdirSync(dir).filter((f) => /^(timeline|draft-timeline).*\.json$/.test(f)).sort((a, b) => (a.startsWith("timeline") ? -1 : 1) - (b.startsWith("timeline") ? -1 : 1)).map((f) => path.join(dir, f))[0];
  if (!file || !fs.existsSync(file)) { console.error(`no timeline in ${dir} (run make.mjs --draft or peek first)`); process.exit(1); }
  const res = await holdCheck(JSON.parse(fs.readFileSync(file, "utf8")));
  if (args.includes("--json")) console.log(JSON.stringify(res));
  else { console.log(`${slug} (${path.basename(file)}): first seen ${res.facts.firstSeen ?? "-"} s · ${r1(res.facts.length)} s · coin width ${res.facts.coinWidth ? `${res.facts.coinWidth.min}-${res.facts.coinWidth.max}` : "-"} · longest same shot ${res.facts.longestSameShot?.dur ?? "-"} s from ${res.facts.longestSameShot?.from ?? "-"}`); for (const l of holdLines(res)) console.log("  " + l); }
}
