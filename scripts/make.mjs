// ONE command: script.json -> voice -> master -> timeline -> render -> score -> fix -> final mp4
// Usage: node scripts/make.mjs <slug> [--full] [--skip-tts] [--no-render] [--no-fix] [--fps 60] [--preview] [--frames 0-120] [--voice NAME] [--speed 1.1]
//        brand scripts ("brand": "tamrina"): [--pool male|female] (default: every pool -> <slug>-mr.mp4 + <slug>-mrs.mp4) [--force-facts]
//        a re-run after a small fix renders only the changed scenes into the existing mp4 (scripts/patch.mjs); --full = whole render
//        --review: a look-at-it render with the real sound at 30 fps (about half the render time of the 60 fps brand final), never delivered.
//                 After the OK run the same command without --review: the 60 fps final keeps the review's added events, so it is the video he saw
//        --draft: silent preview + frames + the text ElevenLabs would get, no voice / no credits (Tamrina: always first)
//        --peek: build the timeline only, into peek-timeline[-tag].json (never timeline.json / draft-timeline.json, so the
//                next patch still compares with what was really rendered), then stop. scripts/peek.mjs renders frames from it
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyBrand, checkFacts, loadBrand, pronounce, respell } from "./brand.mjs";
import { die, ensureDir, exists, ffprobeDuration, log, parseArgs, PUBLIC, r3, readJSON, ROOT, run, runOk, stripMarks, VIDEOS, warn, writeJSON } from "./lib.mjs";
import { concatWithGaps, cutAndSpeed, masterLoudness, speechSpan } from "./master.mjs";
import { renderTimeline } from "./render.mjs";
import { analyze, minScore } from "./score.mjs";
import { buildSfx } from "./sfx.mjs";
import { sheetFrom } from "./sheet.mjs";
import { mouthCues, voiceEnvelope, voiceProsody } from "./lipsync.mjs";
import { buildMocap } from "./mocap.mjs";
import { actingTable, direct } from "./director.mjs";
import { buildTimeline, DEFAULTS } from "./timeline.mjs";
import { planCompanion } from "./companion.mjs";
import { applyPatch, describePatch, planPatch } from "./patch.mjs";
import { holdCheck, holdLines } from "./hold-check.mjs";

const a = parseArgs(process.argv.slice(2));
const slug = a._[0];
if (!slug) die("usage: node scripts/make.mjs <slug>   (expects videos/<slug>/script.json)");

const dir = path.join(VIDEOS, slug);
const scriptPath = path.join(dir, "script.json");
if (!exists(scriptPath)) die(`missing ${scriptPath}. Create it first (see guides/scripting.md) or run: node scripts/new.mjs ${slug}`);
let script = readJSON(scriptPath);
// --peek never spends voice credits: a scene that would need a new voice line (spoken, no recording) -> draft timing
if (a.peek && !a.draft && script.scenes.some((sc) => stripMarks(sc.say ?? "") && !sc.audio)) { a.draft = true; log("peek: lines without a recording -> estimated timing (no voice, no credits)"); }
for (const sc of script.scenes ?? []) sc.say ??= ""; // footage scenes may have no coin line (the real person talks)

/**
 * A small fix renders only what changed: compares the new timeline with the one the existing mp4 was made from
 * (scripts/patch.mjs). Returns the patched mp4, or null when a whole render is needed (says why). --full = always whole.
 */
const tryPatch = (oldTl, tl, tlPath, mp4, scale) => {
  if (a.full || a.frames) return null;
  const plan = planPatch(oldTl, tl, mp4, scale ?? 1);
  if (typeof plan === "string") { if (oldTl) log(`whole render: ${plan}`); return null; }
  const soundChanged = plan.soundChanged || JSON.stringify(oldTl.sfx ?? []) !== JSON.stringify(tl.sfx ?? []);
  if (!plan.ranges.length && !soundChanged) { log("nothing changed since the last render -> kept it"); return mp4; }
  if (tl.loop && plan.ranges.length) { log("whole render: a loop's last frames show frame 0, so a picture change is never patched"); return null; }
  log(plan.ranges.length ? describePatch(plan, tl) : "patch: only the sounds changed -> rebuilding the sound, keeping every frame");
  return applyPatch(plan, tlPath, mp4, mp4, { scale, soundChanged });
};

// ---------- 0. BRAND (one line in script.json brings the whole preset) ----------
let tag = "";
if (script.brand) {
  const brand = loadBrand(script.brand);
  const pools = script.cast ? ["duo"] : a.pool ? [a.pool] : script.pool ? [script.pool] : script.pools ?? Object.keys(brand.pools);
  if (pools.length > 1) {
    // one script -> one video per pool (Mr. Coin for men, Mrs. Coin for Ladies Only)
    const rest = process.argv.slice(3);
    for (const p of pools) runOk(process.execPath, [fileURLToPath(import.meta.url), slug, "--pool", p, ...rest]);
    process.exit(0);
  }
  const pool = pools[0];
  if (!script.pool && pool !== "duo") tag = `-${brand.pools[pool]?.suffix ?? pool}`;
  script = applyBrand(script, brand, pool);
  const problems = checkFacts(script, brand);
  if (problems.length) {
    for (const p of problems) warn(`FACT ${p}`);
    if (!a["force-facts"]) die(`${problems.length} claim(s) do not match brands/${brand.name}/facts.json. Fix the script (or, if the fact changed, update facts.json; --force-facts skips this).`);
  }
  log(`brand ${brand.name} · pool ${pool} · voice ${script.elevenVoice ?? script.voice} · motion ${script.motion}`);
}
const outSlug = slug + tag;
script.slug = outSlug;
if (a.review) a["no-deliver"] = true; // a review is never the approved final
if (a.fps) script.fps = Number(a.fps);
else if (a.review) script.fps = 30;
// brand finals render at 60 fps (smoother motion); drafts stay 30 (fast). --fps or script "fps" override.
else if (!a.draft && !script.fps && script.brand) script.fps = 60;
if (a.voice) script.voice = a.voice;
if (!Array.isArray(script.scenes) || script.scenes.length === 0) die("script.scenes is empty");

const work = path.join(dir, tag ? `work/${tag.slice(1)}` : "work");
const outDir = path.join(dir, "out");
const pubDir = path.join(PUBLIC, "v", outSlug);
ensureDir(work); ensureDir(outDir); ensureDir(pubDir);

const speed = Number(a.speed ?? script.speed ?? DEFAULTS.speed);
const voice = script.voice ?? (/^ar/.test(script.lang ?? "en") ? "ar-EG-ShakirNeural" : "en-US-AndrewNeural");
// ELEVENLABS_API_KEY lives in .env.local (written by `npx @elevenlabs/cli onboard`), never in code
if (!process.env.ELEVENLABS_API_KEY && exists(path.join(ROOT, ".env.local"))) process.loadEnvFile(path.join(ROOT, ".env.local"));
let engine = script.ttsEngine ?? process.env.REEL_TTS_ENGINE ?? "edge";
// ElevenLabs: "elevenVoice" (voice id) + "ttsModel" (default eleven_v4, reads [excited]-style audio tags).
// No ELEVENLABS_API_KEY -> fall back to the free edge voice (tags are stripped, the coin still reacts to them).
if (engine === "eleven" && !process.env.ELEVENLABS_API_KEY) {
  // a brand's voices are part of the brand: never swap them silently
  if (script.brand && !a["allow-edge"] && !a.draft) die("ELEVENLABS_API_KEY not set (.env.local). Brand voices need it; --allow-edge renders a draft with the free edge voice.");
  warn("ttsEngine eleven but ELEVENLABS_API_KEY not set -> using edge-tts"); engine = "edge";
}
const ttsVoice = engine === "eleven" ? (script.elevenVoice ?? voice) : voice;
const ttsModel = script.ttsModel ?? "eleven_v4";
// what the ElevenLabs site uses for cloned voices; higher stability/similarity sounds flatter and less like the speaker
const ttsSettings = { stability: 0.32, similarity_boost: 0.75, style: 0, use_speaker_boost: true, ...(script.ttsSettings ?? {}) };

/**
 * Render into a temp file, then move it over the target. If the target is open in a video player (Windows locks it),
 * keep the new render next to it with a time stamp instead of failing, and say so.
 */
const renderSafe = (tlPath, target, opts) => {
  const tmp = target.replace(/\.mp4$/, `.rendering.mp4`);
  renderTimeline(tlPath, tmp, opts);
  try { fs.rmSync(target, { force: true }); fs.renameSync(tmp, target); return target; }
  catch {
    const alt = target.replace(/\.mp4$/, `-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}.mp4`);
    fs.renameSync(tmp, alt);
    warn(`${path.basename(target)} is open somewhere (locked) -> saved the new render as ${path.basename(alt)}`);
    return alt;
  }
};

// footage scenes stay on screen at least as long as their clip (the real person's lines + pauses)
// a silent footage scene (coin says nothing) lasts exactly "dur" in the draft and in the final, no extra gap
const holdFootage = (gaps, clips) => gaps.map((g, i) => {
  const sc = script.scenes[i], f = sc.footage;
  if (!f?.dur) return g;
  return r3(sc.say.trim() ? Math.max(g, f.dur - clips[i].duration) : Math.max(0, f.dur - clips[i].duration));
});

// footage scenes: light (side, colour, level) + the face to look at, measured on one frame of each clip
// (scripts/footage-probe.py, cached in work/probe.json); the coin's 3D light and gaze follow it (Coin3D).
{
  const cacheP = path.join(work, "probe.json"), cache = exists(cacheP) ? readJSON(cacheP) : {};
  for (const sc of script.scenes) {
    const f = sc.footage; if (!f?.src) continue;
    const file = path.join(PUBLIC, f.src); if (!exists(file)) { warn(`footage not found: public/${f.src}`); continue; }
    const at = r3((f.from ?? 0) + Math.min(f.dur ?? 1, 2) / 2), key = `${f.src}@${at}@${fs.statSync(file).mtimeMs}`;
    if (!cache[key]) {
      let frame = file;
      if (!/\.(jpe?g|png|webp)$/i.test(file)) { ensureDir(work); frame = path.join(work, `probe-${Object.keys(cache).length}.png`); runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(at), "-i", file, "-frames:v", "1", frame], { quiet: true }); }
      try { cache[key] = JSON.parse(run("python3", [path.join(ROOT, "scripts", "footage-probe.py"), frame], { capture: true, quiet: true }).stdout.toString().trim().split(/\r?\n/).pop()); }
      catch (e) { warn(`footage probe failed for ${f.src}: ${e.message}`); continue; }
    }
    f.probe = cache[key];
  }
  if (Object.keys(cache).length) { ensureDir(work); writeJSON(cacheP, cache); }
}

// companion (script "companion"): the coin lives in a handheld clip. scripts/track.py measures how the phone moved
// every frame (cached in work/track-*.json), scripts/companion.mjs plans where he walks / runs / jumps so he stays
// planted in the room and in front of the camera. The plan goes into the timeline (Coin3D follows it).
// "companion" may be a list (2026-11-09): one per clip, e.g. a coin riding a different machine in each shot.
const attachCompanion = (tlX) => {
  const list = [script.companion ?? []].flat().filter((c) => c?.src);
  delete tlX.companion; delete tlX.companions;
  for (const cp of list) attachOne(tlX, cp);
  if (tlX.companions?.length) tlX.companion = tlX.companions[0]; // older readers
};
const attachOne = (tlX, cp) => {
  const file = path.join(PUBLIC, cp.src);
  if (!exists(file)) { warn(`companion clip not found: public/${cp.src}`); return; }
  const anchors = Object.entries(cp.anchors ?? {}).map(([n, [t, x, y]]) => `${n}:${t}:${x}:${y}`);
  const key = `${cp.src}|${fs.statSync(file).mtimeMs}|${anchors.join(",")}`;
  const hash = [...key].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36);
  const tp = path.join(work, `track-${hash}.json`);
  if (!exists(tp)) {
    log(`companion: tracking the camera in ${cp.src} (once, cached)`);
    ensureDir(work);
    const res = run("python", ["-I", path.join(ROOT, "scripts", "track.py"), file, ...anchors.flatMap((a) => ["--anchor", a])], { capture: true, quiet: true });
    fs.writeFileSync(tp, res.stdout.toString());
  }
  const track = readJSON(tp);
  // "anchorsFile": a moving part tracked by scripts/track-part.py (a plate that goes up and down): merged over track.py's anchors
  if (cp.anchorsFile) track.anchors = { ...(track.anchors ?? {}), ...readJSON(path.join(PUBLIC, cp.anchorsFile)).anchors };
  const i0 = tlX.scenes.findIndex((s) => s.footage?.src === cp.src);
  if (i0 < 0) { warn(`companion: no scene uses ${cp.src}`); return; }
  const sc0 = tlX.scenes[i0];
  let i1 = i0; while (tlX.scenes[i1 + 1]?.footage?.src === cp.src) i1++;
  // the path only rules the scenes that play this clip (a video of several clips: the other scenes keep their own places)
  (tlX.companions ??= []).push({ t0: r3(sc0.start - (sc0.footage.from ?? 0)), from: sc0.start, to: tlX.scenes[i1].end, ...planCompanion(track, JSON.parse(JSON.stringify(cp))) });
};

// scene "ride" (2026-11-17, FactPilates): a coin rides a moving part of the footage (a Reformer carriage). The part's track
// (an anchors file, same format as companion.anchorsFile: {"anchors": {"<name>": [{t, x, y}, ...]}}, t = reel s) is inlined
// into the timeline once per track (tl.rides); Coin3D moves the coin's place by how far the part moved (rideAt).
const attachRides = (tlX) => {
  delete tlX.rides;
  for (const sc of script.scenes) for (const rc of Object.values(sc.ride ?? {})) {
    const key = `${rc.track}#${rc.anchor}`;
    if (tlX.rides?.[key]) continue;
    const file = path.join(PUBLIC, rc.track);
    if (!exists(file)) { warn(`ride track not found: public/${rc.track}`); continue; }
    const a = readJSON(file).anchors?.[rc.anchor] ?? [];
    if (a.length < 2) { warn(`ride: no anchor "${rc.anchor}" in public/${rc.track}`); continue; }
    (tlX.rides ??= {})[key] = { t0: a[0].t, fps: Math.round(1 / (a[1].t - a[0].t)), x: a.map((q) => +q.x.toFixed(1)), y: a.map((q) => +q.y.toFixed(1)) };
  }
};

// hold check (scripts/hold-check.mjs): the rules learned from our own Instagram numbers, as warnings before the render.
// It never stops a build.
const holdNotes = async (t) => {
  try { const lines = holdLines(await holdCheck(t)); for (const l of lines) (l.includes("hold check: OK") ? log : warn)(l); return lines; }
  catch (e) { warn(`hold check skipped (${e.message})`); return []; }
};

// ---------- 0.5 DRAFT (owner rule: look + script first, voice only after the OK) ----------
// --draft: no TTS, no credits. Estimated word timings -> silent preview (half size) + one frame per scene
// + out/draft[-mr].md with the exact text ElevenLabs will get (tags, pronunciation spellings) and the moods.
if (a.draft) {
  const clipsD = script.scenes.map((sc) => {
    let t = 0;
    const words = stripMarks(sc.say).split(/\s+/).filter(Boolean).map((w) => {
      const d = (0.24 + 0.04 * w.length) * (script.draftPace ?? 1); // ~2.1 words/s on long Arabic words; "draftPace": 0.75 ≈ 2.8 words/s (the owner's clone, n1-white-friday) for a video synced to footage
      const o = { w, start: r3(t), end: r3(t + d) };
      t += d + 0.05;
      return o;
    });
    return { words, duration: r3(t) };
  });
  const g0 = script.gap ?? DEFAULTS.gap;
  const gapsD = clipsD.map((c, i) => r3((!script.read || i === clipsD.length - 1 ? g0 : Math.max(g0, c.words.length / script.read.wordsPerSec + script.read.pad - c.duration)) + (script.scenes[i].pause ?? 0)));
  const tlD = buildTimeline(script, clipsD, { audioPath: null, speed, gaps: holdFootage(gapsD, clipsD) });
  tlD.sfx = [];
  attachCompanion(tlD);
  attachRides(tlD);
  applyDirector(tlD, `acting${tag}.md`);
  if (a.peek) { const pk = path.join(dir, `peek-timeline${tag}.json`); writeJSON(pk, tlD); log(`peek timeline (draft timing) -> ${pk}`); process.exit(0); }
  const holdD = await holdNotes(tlD);
  const tlDPath = path.join(dir, `draft-timeline${tag}.json`);
  const oldD = exists(tlDPath) ? readJSON(tlDPath) : null;
  writeJSON(tlDPath, tlD);
  const mp4 = path.join(outDir, `draft${tag}.mp4`);
  let mp4Out = tryPatch(oldD, tlD, tlDPath, mp4, 0.5);
  if (!mp4Out) {
    log(`draft: rendering a silent preview (${tlD.durationSec}s, estimated timing)…`);
    mp4Out = renderSafe(tlDPath, mp4, { scale: 0.5, quiet: true });
  }
  const sheet = sheetFrom(tlD, mp4Out, path.join(outDir, `draft-sheet${tag}.png`));
  const cell = (s) => String(s).replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const rows = script.scenes.map((sc, i) => {
    const tags = [...sc.say.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]).join(", ") || (sc.mood ?? "(keeps the last mood)");
    const spoken = (script.pronounce ? pronounce(sc.say, script.pronounce).text : sc.say).replace(/\*/g, "");
    const who = sc.speaker ? (sc.speaker === "mr" ? "Mr. Coin: " : sc.speaker === "mrs" ? "Mrs. Coin: " : `${sc.speaker}: `) : "";
    return `| ${i + 1} | ${cell(who + stripMarks(sc.say))} | ${cell(spoken)} | ${cell(tags)} | ${sc.visual?.type ?? "none"}${sc.place ? " · " + cell(JSON.stringify(sc.place)) : ""} |`;
  });
  const md = [
    `# Draft · ${script.title ?? outSlug}${script.pool ? ` · ${script.pool === "female" ? "Mrs. Coin (Ladies Only)" : "Mr. Coin (men)"}` : ""}`,
    "",
    `No voice yet (no ElevenLabs credits used). Preview: \`${mp4}\` · frames: \`${sheet}\``,
    `Voice when approved: ${ttsVoice} (${engine}${engine === "eleven" ? " " + ttsModel : ""}) · speed x${speed}. Timing here is estimated.`,
    "",
    "| # | on screen (captions) | ElevenLabs gets | mood tags | visual |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    ...holdD.map((l) => `- ${l}`), "",
    "Change wording, diacritics (ضمة/فتحة/كسرة), English words or moods in script.json / brand.json pronounce, rerun --draft, then make without --draft.",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, `draft${tag}.md`), md, "utf8");
  log(`DRAFT ready -> ${path.join(outDir, `draft${tag}.md`)} + ${sheet}`);
  process.exit(0);
}

// ---------- 1. VOICE (per scene) ----------
const clips = [];
const t0 = Date.now();
log(`${outSlug}: ${script.scenes.length} scenes · lang=${script.lang ?? "en"} · voice=${voice} · speed=x${speed}`);
for (let i = 0; i < script.scenes.length; i++) {
  const sc = script.scenes[i];
  if (!sc.say.trim() && !sc.footage) die(`scene ${i + 1} has no "say"`);
  const sdir = path.join(work, `s${String(i + 1).padStart(2, "0")}`);
  ensureDir(sdir);
  if (!sc.say.trim()) { // footage scene, coin silent: a silent clip as long as the footage
    const wav = path.join(sdir, "clip.wav"), d = sc.footage.dur ?? 3;
    runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", String(d), wav], { quiet: true });
    clips.push({ wav, words: [], duration: r3(d) });
    log(`  ${String(i + 1).padStart(2, "0")} footage ${d}s (coin silent)`);
    continue;
  }
  if (sc.audio) { // a recorded line (a movie line, the owner's own take) instead of TTS: the coin lip-syncs to it, no speed-up
    const src = path.join(PUBLIC, sc.audio.src), wav = path.join(sdir, "clip.wav");
    if (!exists(src)) die(`scene ${i + 1}: audio not found: ${src}`);
    const cut = [...(sc.audio.from != null ? ["-ss", String(sc.audio.from)] : []), ...(sc.audio.to != null ? ["-to", String(sc.audio.to)] : [])];
    runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", src, ...cut, "-af", `volume=${sc.audio.volume ?? 1}`, "-ar", "48000", "-ac", "1", wav], { quiet: true });
    const dur = ffprobeDuration(wav);
    // captions: the "say" words spread over the clip by length (or exact "words": [{w,start,end}] from speech-to-text)
    const ws = stripMarks(sc.say).split(/\s+/).filter(Boolean);
    const total = ws.reduce((n, w) => n + w.length, 0) || 1, a0 = sc.audio.start ?? 0.1, a1 = sc.audio.end ?? dur - 0.1;
    let acc = 0;
    const words = sc.audio.words ?? ws.map((w) => { const s = a0 + ((a1 - a0) * acc) / total; acc += w.length; return { w, start: r3(s), end: r3(a0 + ((a1 - a0) * acc) / total) }; });
    clips.push({ wav, words, duration: r3(dur) });
    log(`  ${String(i + 1).padStart(2, "0")} recorded ${dur.toFixed(2)}s  ${sc.audio.src}`);
    continue;
  }
  const raw = path.join(sdir, "voice_raw.mp3");
  const wordsPath = path.join(sdir, "words.json");
  // pronunciation fixes go to the voice only; captions keep the script spelling (respell below)
  const pr = script.pronounce ? pronounce(sc.say, script.pronounce) : null;
  const spoken = pr ? pr.text : sc.say;
  // duo videos: each scene can have its own voice (the speaker's)
  const scVoice = engine === "eleven" ? sc.elevenVoice ?? ttsVoice : sc.voice ?? ttsVoice, scModel = sc.ttsModel ?? ttsModel;
  const cacheKey = JSON.stringify({ say: spoken, voice: scVoice, engine, ...(engine === "eleven" ? { model: scModel, settings: ttsSettings } : {}), rate: sc.rate ?? script.rate ?? "+0%" });
  const keyPath = path.join(sdir, "key.txt");
  const cached = exists(raw) && exists(wordsPath) && exists(keyPath) && fs.readFileSync(keyPath, "utf8") === cacheKey;
  if (a["skip-tts"] && !cached) warn(`scene ${i + 1}: --skip-tts but no cached voice, synthesizing anyway`);
  if (!cached) {
    const args = [path.join(ROOT, "scripts", "tts.py"), "--text", spoken, "--out", sdir, "--voice", scVoice, "--engine", engine, "--model", scModel, "--settings", JSON.stringify(ttsSettings)];
    const rate = sc.rate ?? script.rate;
    if (rate) args.push("--rate", rate);
    runOk("python", args, { quiet: true });
    fs.writeFileSync(keyPath, cacheKey, "utf8");
  }
  const wj = readJSON(wordsPath);
  // CUT + SPEED
  const span = speechSpan(raw);
  const wav = path.join(sdir, "clip.wav");
  const dur = cutAndSpeed(raw, wav, span, speed);
  const ttsWords = pr?.changed ? respell(wj.words, sc.say, pr.map) : wj.words;
  const words = ttsWords
    .map((w) => ({ w: w.w, start: r3(Math.max(0, (w.start - span.start) / speed)), end: r3(Math.max(0, (w.end - span.start) / speed)) }))
    .filter((w) => w.start <= dur + 0.05);
  clips.push({ wav, words, duration: r3(dur) });
  log(`  ${String(i + 1).padStart(2, "0")} ${cached ? "(cached)" : "tts"} ${words.length}w ${dur.toFixed(2)}s  "${wj.text.slice(0, 60)}${wj.text.length > 60 ? "…" : ""}"`);
}

// ---------- 2. CONCAT + MASTER ----------
const gap = script.gap ?? DEFAULTS.gap;
// reading time (brand "read"): a scene stays on screen at least words / wordsPerSec + pad, so the eye can follow
const gaps = clips.map((c, i) => {
  const pause = script.scenes[i].pause ?? 0; // scene "pause": extra seconds of silence after this line (a held beat)
  if (!script.read || i === clips.length - 1) return r3(gap + pause);
  const need = c.words.length / script.read.wordsPerSec + script.read.pad;
  return r3(Math.max(gap, need - c.duration) + pause);
});
const held = gaps.filter((g) => g > gap).length;
if (held) log(`reading time: held ${held} scene(s) a little longer`);
const joined = path.join(work, "voice_joined.wav");
const gapsHeld = holdFootage(gaps, clips); // the same gaps as the timeline: a footage "dur" longer than its line must be silence in the voice too, or the voice runs ahead of the picture
concatWithGaps(clips.map((c) => c.wav), gapsHeld, joined, work);
const voiceMp3 = path.join(pubDir, "voice.mp3");
const m = masterLoudness(joined, voiceMp3);
log(`voice mastered: ${ffprobeDuration(voiceMp3).toFixed(2)}s  I=${m.I} LUFS  TP=${m.TP} dBTP  -> public/v/${outSlug}/voice.mp3`);

// the acting director (scripts/director.mjs): per line, one operative word, one held gesture by meaning, disc-native
// head moves, listener rules -> tl.acting + out/acting.md (the owner vetoes a line with scene "acting": false)
function applyDirector(t, mdName) {
  if (t.presenter?.type !== "coin") return;
  let d = null;
  try { d = direct(t, script); } catch (e) { warn(`acting director failed (${e.message}): the coins use the old automatic hands`); }
  if (!d) return;
  t.acting = d.acting;
  fs.writeFileSync(path.join(outDir, mdName), actingTable(d.rows, d.lint), "utf8");
  const n = Object.values(d.acting).reduce((s, a) => s + a.gestures.length, 0), h = Object.values(d.acting).reduce((s, a) => s + a.head.length, 0);
  log(`acting: ${n} gestures, ${h} head moves over ${d.rows.length} lines${d.lint.length ? ` · ${d.lint.length} lint note(s)` : ""} -> out/${mdName}`);
}

// ---------- 3. TIMELINE ----------
const tl = buildTimeline(script, clips, { audioPath: `v/${outSlug}/voice.mp3`, speed, gaps: gapsHeld });
attachCompanion(tl);
attachRides(tl);
// the coin's mouth follows the real voice (Rhubarb mouth shapes); only the coin presenter uses it
if (tl.presenter?.type === "coin") {
  tl.mouth = mouthCues(voiceMp3, work);
  tl.env = voiceEnvelope(voiceMp3, tl.fps);
  tl.pros = voiceProsody(voiceMp3, tl.env, tl.scenes); // pitch + syllable accents: the human layer (src/lib/human.ts)
  if (tl.pros) log(`prosody: ${tl.pros.acc.length} accents, pitch on ${tl.pros.p.filter((x) => x !== 0).length} frames`);
  tl.mocap = buildMocap(tl, script) ?? undefined; // cast "mocap": the coins copy real people from a video
  applyDirector(tl, `acting${tag}.md`);
  if (tl.mouth) log(`lip sync: ${tl.mouth.length} mouth shapes + loudness for ${tl.env?.v.length ?? 0} frames`);
}
const tlPath = path.join(dir, tag ? `timeline${tag}.json` : "timeline.json");
const oldTl = exists(tlPath) ? readJSON(tlPath) : null;
// a patch keeps the last render's added fix events (and their sounds), so only the changed scenes differ
const freshSfx = tl.sfx;
if (oldTl?.events?.length && !a.full) { tl.events = oldTl.events; tl.sfx = buildSfx(tl, script.sfxMap); }
// --peek: the timeline as the next render would use it (with the last render's fix events), into its own file
if (a.peek) { const pk = path.join(dir, `peek-timeline${tag}.json`); writeJSON(pk, tl); log(`peek timeline -> ${pk}`); process.exit(0); }
if (a.review) tl.meta = { ...(tl.meta ?? {}), review: true };
// the final after an approved review: same content at 60 fps, so keep the review's added events and don't re-run the fix
const fromReview = !a.review && !a.full && oldTl?.meta?.review === true;
// the director reads the voice per frame, so at 60 fps it can place a gesture a little differently than at 30:
// when nothing in the scenes changed since the review, the final keeps the acting he approved
if (fromReview && oldTl.acting && tl.acting) {
  if (JSON.stringify(oldTl.scenes) === JSON.stringify(tl.scenes)) { tl.acting = oldTl.acting; log("acting: kept from the approved review"); }
  else warn("the script changed since the review: the acting was planned again for the final (look at out/acting.md)");
}
writeJSON(tlPath, tl);
const holdF = await holdNotes(tl);
const firstWord = tl.scenes.find((sc) => sc.words.length)?.words[0]?.start ?? 0; // silent footage openers: the first real word
log(`timeline: ${tl.durationSec}s · first word at ${firstWord}s ${firstWord <= 1.5 ? "(hook OK)" : "(!! hook later than 1.5s)"} · ${tl.scenes.reduce((n, s) => n + s.events.length, 0)} auto events`);
if (a["no-render"]) { log("done (no render)"); process.exit(0); }

// ---------- 4. RENDER ----------
const finalMp4 = path.join(outDir, `${outSlug}.mp4`);
const MIN_SCORE = minScore(script.motion);
const renderOpts = {};
if (a.preview) { renderOpts.scale = 0.5; }
if (a.frames) renderOpts.frames = a.frames;
if (a.concurrency) renderOpts.concurrency = a.concurrency;
let finalOut = tryPatch(oldTl, tl, tlPath, finalMp4, renderOpts.scale);
const patched = !!finalOut;
if (!patched) {
  if (tl.events.length && !fromReview) { tl.events = []; tl.sfx = freshSfx; writeJSON(tlPath, tl); }
  log(a.review ? "rendering the review (30 fps, not delivered)…" : fromReview ? "rendering the final from the approved review (same events)…" : "rendering…");
  finalOut = renderSafe(tlPath, finalMp4, { ...renderOpts, quiet: true });
}

// ---------- 5. SCORE + FIX ----------
let report = analyze(finalOut);
const logScore = (r, tag) => log(`${tag}: motion score ${r.score}/10 · mean motion ${r.mean} · ${r.eventsPerSec}/s events · still ${r.flatTime}s (${r.flats.length} flat run${r.flats.length === 1 ? "" : "s"})`);
if (report.ok) logScore(report, "score");
if (report.ok && !patched && !fromReview && !a["no-fix"] && !a.frames && (report.flats.length > 0 || report.score < MIN_SCORE)) {
  // inject alternating whip pans / zoom kicks into every flat run, re-render once
  const fixes = [];
  for (const f of report.flats) {
    let t = f.start + 0.25, k = 0;
    while (t < f.end - 0.3) { fixes.push({ t: r3(t), kind: k % 2 === 0 ? "whipPan" : "zoomKick", strength: 1.2 }); t += 0.9; k++; }
  }
  if (report.flats.length === 0 && report.score < MIN_SCORE) {
    for (let t = 0.8; t < tl.durationSec - 0.5; t += 1.4) fixes.push({ t: r3(t), kind: "zoomKick", strength: 0.9 });
  }
  tl.events = fixes;
  tl.sfx = buildSfx(tl, script.sfxMap); // a whip pan is a movement too -> its own sound, re-cut so nothing overlaps
  writeJSON(tlPath, tl);
  log(`fixing ${report.flats.length} flat moment(s) with ${fixes.length} added events, re-rendering…`);
  finalOut = renderSafe(tlPath, finalMp4, { ...renderOpts, quiet: true });
  const r2 = analyze(finalOut);
  if (r2.ok) { logScore(r2, "score after fix"); report = r2; }
}

// ---------- 6. FINAL ----------
const still = path.join(outDir, `cover${tag}.png`);
try { runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(Math.min(1.2, tl.durationSec / 2)), "-i", finalOut, "-frames:v", "1", still], { quiet: true }); } catch { /* optional */ }
const { samples, ...summary } = report;
writeJSON(path.join(outDir, `score${tag}.json`), report);
const md = [
  `# ${tl.title}`, "",
  `- output: \`${finalOut}\``,
  `- duration: ${tl.durationSec}s · ${tl.width}x${tl.height}@${tl.fps} · scenes: ${tl.scenes.length}`,
  `- voice: ${ttsVoice} (${engine}${engine === "eleven" ? " " + ttsModel : ""}) · speed x${speed} · mastered I=${m.I} LUFS / TP=${m.TP} dBTP`,
  `- hook: first word at ${firstWord}s`,
  report.ok ? `- motion score: **${report.score}/10** (min ${MIN_SCORE}) · still time ${report.flatTime}s · flats: ${report.flats.map((f) => `${f.start}–${f.end}s`).join(", ") || "none"}` : "- motion score: n/a",
  `- global fix events: ${tl.events.length}`,
  `- build: ${((Date.now() - t0) / 1000).toFixed(0)} s (${patched ? "patch" : "whole render"}${a.review ? ", review 30 fps: run again without --review for the 60 fps final" : ""})`,
  ...holdF.map((l) => `- ${l}`),
  ...(tl.brand ? [`- brand: ${tl.brand} · pool ${tl.pool} · motion ${tl.motion} · sound effects: ${tl.sfx.length} (${[...new Set(tl.sfx.map((c) => c.key))].join(", ")})`, `- reading time: ${held} scene(s) held longer (${script.read?.wordsPerSec} words/s + ${script.read?.pad}s)`] : []),
  "", "## narration", "", tl.meta.narration, "",
].join("\n");
fs.writeFileSync(path.join(outDir, `report${tag}.md`), md, "utf8");
try { sheetFrom(tl, finalOut, path.join(outDir, `sheet${tag}.png`)); } catch { /* optional */ }
// DELIVER: finished videos (not drafts, previews or frame ranges) are copied to the brand's shared folder (Google Drive)
if (script.deliver && !a.preview && !a.frames && !a["no-deliver"]) { // --no-deliver: a final the owner has not approved yet stays local
  if (!exists(script.deliver)) warn(`deliver folder not found (${script.deliver}); is Google Drive running? Video stays in ${outDir}`);
  else {
    const day = new Date().toISOString().slice(0, 10);
    const dest = path.join(script.deliver, `${day} ${slug}`);
    ensureDir(dest);
    fs.copyFileSync(finalOut, path.join(dest, path.basename(finalOut)));
    if (exists(still)) fs.copyFileSync(still, path.join(dest, `cover${tag}.png`));
    log(`delivered -> ${dest}`);
  }
  // owner rule (2026-10-28): every approved final also stays on drive D (brand "keep", e.g. D:/Videos/Tamrina/<slug>[-mr].mp4)
  if (script.keep) {
    try {
      ensureDir(script.keep);
      const base = path.basename(finalOut, ".mp4");
      fs.copyFileSync(finalOut, path.join(script.keep, `${base}.mp4`));
      if (exists(still)) fs.copyFileSync(still, path.join(script.keep, `${base}-cover.png`));
      log(`local copy -> ${script.keep}`);
    } catch (e) { warn(`local copy to ${script.keep} failed (${e.message})`); }
  }
}
log(`DONE in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${finalOut}`);
console.log(JSON.stringify({ output: finalOut, cover: still, durationSec: tl.durationSec, score: summary.score ?? null, loudness: m }, null, 2));
