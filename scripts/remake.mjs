// Remake a reel with the coins: everything before the acting, from one link (owner rules 2026-10-29: the words = the
// original sound verbatim, the coins do the people's moves, no text on screen, a generic generated set).
// Usage: node scripts/remake.mjs <reel url | local clip> <slug> [--lang ar|en] [--speakers 2] [--pool male|female]
//        [--caption "*POV:* ..."] [--place gym] [--same 30] [--force] [--fresh]
// Writes:
//   reference/<id>/      clip.mp4 · clip.wav · stt.json (words + who says them) · sheet.png (timestamped) · angle-A.png ...
//   public/audio/<slug>/sound.wav     the original sound (the coins lip-sync to it, zero voice credits)
//   public/sfx/<slug>/shot-NN.mp3     the sound of a shot where nobody talks (placed as a layer, so no coin mouths music)
//   videos/<slug>/script.json         one scene per shot (split where the speaker changes), audio slices, speakers,
//                                     the camera angle of each shot -> footage/<slug>/<A|B|...>.jpg, the other coins "off"
//   videos/<slug>/remake.md           the beats table + the Gemini prompts (one per angle) to make the sets
// What is left by hand: the moves and moods per scene, who else is in a shot without talking, the places.
// Costs: a few seconds of ElevenLabs speech-to-text (cached in stt.json; --fresh redoes it). Never overwrites a
// script.json unless --force.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { die, ensureDir, exists, ffprobeDuration, log, parseArgs, PUBLIC, r3, readJSON, ROOT, run, runOk, VIDEOS, warn, writeJSON } from "./lib.mjs";

const a = parseArgs(process.argv.slice(2));
const [src, slug] = a._;
if (!src || !slug) die("usage: node scripts/remake.mjs <reel url | local clip> <slug> [--lang ar|en] [--speakers 2] [--caption \"...\"] [--force]");
if (!/^[a-z0-9-]+$/.test(slug)) die(`slug must be kebab-case (a-z, 0-9, -): ${slug}`);
const scriptPath = path.join(VIDEOS, slug, "script.json");
if (exists(scriptPath) && !a.force) die(`videos/${slug}/script.json already exists (use --force to overwrite it)`);
const isUrl = /^https?:\/\//.test(src);
const id = isUrl ? (src.match(/\/(?:reel|reels|p|video|v)\/([A-Za-z0-9_-]+)/)?.[1] ?? slug) : slug;
const ref = path.join(ROOT, "reference", `ig-${id}`);
ensureDir(ref);
const clip = path.join(ref, "clip.mp4");

// ---- 1. the clip ----
if (!exists(clip)) {
  if (isUrl) runOk("yt-dlp", ["-q", "--no-playlist", "-f", "mp4/best", "-o", clip, src]);
  else { if (!exists(src)) die(`clip not found: ${src}`); fs.copyFileSync(src, clip); }
}
const dur = ffprobeDuration(clip);
if (!dur) die("could not read the clip's duration");
const wav = path.join(ref, "clip.wav");
runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", clip, "-vn", "-ac", "1", "-ar", "44100", wav], { quiet: true });
const audioDir = path.join(PUBLIC, "audio", slug);
ensureDir(audioDir);
fs.copyFileSync(wav, path.join(audioDir, "sound.wav"));
log(`clip: ${dur.toFixed(2)}s -> reference/ig-${id}/`);

// ---- 2. the cuts (scene detection), shots shorter than 0.3 s merged ----
const det = spawnSync("ffmpeg", ["-hide_banner", "-i", clip, "-vf", `scale=270:-1,scdet=threshold=${a.threshold ?? 8}`, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64 << 20 });
const cuts = [...String(det.stderr).matchAll(/lavfi\.scd\.time: ([\d.]+)/g)].map((m) => Number(m[1])).filter((t) => t > 0.3 && t < dur - 0.3);
const bounds = [0];
for (const t of cuts) if (t - bounds[bounds.length - 1] >= 0.3) bounds.push(r3(t));
bounds.push(r3(dur));

// ---- 3. the words + who says them (ElevenLabs scribe, diarized), cached ----
const sttPath = path.join(ref, "stt.json");
if (!exists(sttPath) || a.fresh) {
  let key = process.env.ELEVENLABS_API_KEY;
  const envF = path.join(ROOT, ".env.local");
  if (!key && exists(envF)) key = fs.readFileSync(envF, "utf8").match(/ELEVENLABS_API_KEY\s*=\s*"?([^"\s]+)/)?.[1];
  if (!key) die("ELEVENLABS_API_KEY not set (.env.local): needed for speech-to-text");
  const fd = new FormData();
  fd.append("model_id", "scribe_v1");
  fd.append("language_code", (a.lang ?? "ar") === "en" ? "eng" : "ara");
  fd.append("diarize", "true");
  if (a.speakers) fd.append("num_speakers", String(a.speakers));
  fd.append("file", new Blob([fs.readFileSync(wav)], { type: "audio/wav" }), "clip.wav");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body: fd });
  if (!res.ok) die(`speech-to-text failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  writeJSON(sttPath, await res.json());
}
const stt = readJSON(sttPath);
const words = (stt.words ?? []).filter((w) => w.type === "word").map((w) => ({ w: w.text, start: w.start, end: w.end, sp: w.speaker_id ?? "speaker_0" }));
log(`words: ${words.length} · "${stt.text ?? ""}"`);

// ---- 4. the camera angle of each shot: a tiny blurred colour thumbnail of its middle frame; a shot joins the angle
// whose shots it is closest to on average (the people move, the room stays). --angles A,B,A,... overrides the guess ----
const thumb = (t) => spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", clip, "-frames:v", "1", "-vf", "scale=24:42,boxblur=1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], { maxBuffer: 1 << 20 }).stdout;
const diff = (x, y) => { let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]); return s / x.length; };
const same = Number(a.same ?? 27); // average colour difference under this = the same angle (tested on reel Dd68DwgIj43)
const forced = a.angles ? String(a.angles).split(",").map((x) => x.trim().toUpperCase()) : null;
if (forced && forced.length !== bounds.length - 1) die(`--angles has ${forced.length} entries, the clip has ${bounds.length - 1} shots`);
const angles = []; // { name, thumbs[], at }
const shots = [];
for (let i = 0; i < bounds.length - 1; i++) {
  const s = bounds[i], e = bounds[i + 1], mid = (s + e) / 2, th = thumb(mid);
  let best = null, bd = Infinity;
  if (forced) best = angles.find((g) => g.name === forced[i]) ?? null;
  else for (const g of angles) { const d = g.thumbs.reduce((n, x) => n + diff(th, x), 0) / g.thumbs.length; if (d < bd) { bd = d; best = g; } }
  if (!best || (!forced && bd > same)) { best = { name: forced ? forced[i] : String.fromCharCode(65 + angles.length), thumbs: [], at: mid }; angles.push(best); bd = 0; }
  best.thumbs.push(th);
  shots.push({ s, e, angle: best.name, d: Math.round(bd) });
}
for (const g of angles) runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(g.at), "-i", clip, "-frames:v", "1", "-vf", "scale=540:-1", path.join(ref, `angle-${g.name}.png`)], { quiet: true });
runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", clip, "-vf", "fps=2,scale=240:-1,tile=6x4", "-frames:v", "1", path.join(ref, "sheet.png")], { quiet: true });

// ---- 5. scenes: each shot, split where the speaker changes (each coin mouths only his own words) ----
const ids = [];
const idOf = (sp) => { if (!ids.includes(sp)) ids.push(sp); return ids.indexOf(sp); };
for (const w of words) idOf(w.sp); // in order of first appearance: the first voice = Mr. / Mrs. Coin
const female = a.pool === "female";
const castIds = ids.map((_, i) => (i === 0 ? (female ? "mrs" : "mr") : String.fromCharCode(97 + i))); // mr, b, c...
const COLORS = [null, null, "#4FB3F0", "#FF8A1F", "#B58CFF"]; // b = the plain gold coin, then blue, orange, violet
const scenes = [];
for (const sh of shots) {
  // a word belongs to the shot holding its middle (a word that starts just before a cut is said in the next shot)
  const ws = words.filter((w) => (w.start + w.end) / 2 >= sh.s && (w.start + w.end) / 2 < sh.e);
  // runs of one speaker inside the shot; the split sits halfway between two speakers' words
  const runs = [];
  for (const w of ws) { const l = runs[runs.length - 1]; if (l && l.sp === w.sp) l.ws.push(w); else runs.push({ sp: w.sp, ws: [w] }); }
  if (!runs.length) { scenes.push({ ...sh, s: sh.s, e: sh.e, sp: null, ws: [], cut: true }); continue; }
  const inShot = [...new Set(runs.map((x) => x.sp))];
  // music / silence before the first word (> 0.6 s) or after the last one (> 1.2 s) = its own scene with the sound as a
  // layer, so no coin mouths the music (PLAYBOOK §3.11, the ghashim intro)
  const first = runs[0].ws[0].start, last = runs[runs.length - 1].ws.at(-1).end;
  let t0 = sh.s, cut = true;
  if (first - sh.s > 0.6) { t0 = r3(first - 0.1); scenes.push({ ...sh, s: sh.s, e: t0, sp: null, spk: runs[0].sp, ws: [], cut: true, inShot }); cut = false; }
  const tailAt = sh.e - last > 1.2 ? r3(last + 0.25) : null;
  runs.forEach((r, k) => {
    const t1 = k === runs.length - 1 ? tailAt ?? sh.e : r3((r.ws[r.ws.length - 1].end + runs[k + 1].ws[0].start) / 2);
    scenes.push({ ...sh, s: t0, e: t1, sp: r.sp, ws: r.ws, cut: cut && k === 0, inShot });
    t0 = t1;
  });
  if (tailAt) scenes.push({ ...sh, s: tailAt, e: sh.e, sp: null, spk: runs[runs.length - 1].sp, ws: [], cut: false, inShot });
}
// who stands in each angle: everyone who ever talks in it (a guess; the beats table shows it to correct by hand)
const inAngle = {};
for (const sc of scenes) if (sc.sp) (inAngle[sc.angle] ??= new Set()).add(sc.sp);
const SOLO = "540,1430,0.78", DUO = ["380,1450,0.72", "800,1430,0.72"], TRIO = ["250,1460,0.62", "540,1430,0.62", "830,1460,0.62"];
const spots = (list) => (list.length === 1 ? [SOLO] : list.length === 2 ? DUO : TRIO);
const sfxDir = path.join(PUBLIC, "sfx", slug);
const out = scenes.map((sc, i) => {
  // a shot shows the coins who talk in it; the others are off (a camera cut hides them, PLAYBOOK camera cuts)
  // (a silent shot: whoever talks in this angle elsewhere, else the main coin)
  const here = sc.inShot ?? (inAngle[sc.angle]?.size ? [...inAngle[sc.angle]] : [ids[0] ?? "speaker_0"]);
  const place = {};
  ids.forEach((sp, k) => { const j = here.indexOf(sp); place[castIds[k]] = j >= 0 ? spots(here)[Math.min(j, spots(here).length - 1)] : "off"; });
  const footage = { src: `footage/${slug}/${sc.angle}.jpg` };
  const base = { speaker: sc.sp || sc.spk ? castIds[idOf(sc.sp ?? sc.spk)] : castIds[0], camera: "wide", ...(sc.cut && i > 0 ? { seam: "cut" } : {}), place, say: sc.ws.map((w) => w.w).join(" "), footage, visual: { type: "none" } };
  if (sc.ws.length) return { ...base, audio: { src: `audio/${slug}/sound.wav`, from: sc.s, to: sc.e } };
  // nobody talks: the shot's own sound as a layer (an "audio" scene would make the coin mouth the music)
  ensureDir(sfxDir);
  const name = `shot-${String(i + 1).padStart(2, "0")}`;
  runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(sc.s), "-t", String(r3(sc.e - sc.s)), "-i", wav, "-c:a", "libmp3lame", "-q:a", "2", path.join(sfxDir, `${name}.mp3`)], { quiet: true });
  return { ...base, footage: { ...footage, dur: r3(sc.e - sc.s) }, sfx: [{ at: 0, sound: `${slug}/${name}`, dur: r3(sc.e - sc.s), volume: 1, layer: true, peak: 0 }] };
});
const multiAngle = angles.length > 1;
const script = {
  title: `${slug} (remake of ${isUrl ? src.split("?")[0] : path.basename(src)}; the original sound, verbatim)`,
  brand: "tamrina", pool: female ? "female" : "male", text: false,
  ...(a.caption ? { caption: { text: String(a.caption), handle: "@tamrina.squad", y: 620, size: 60 } } : {}),
  sfx: { auto: false }, ...(multiAngle ? { seam: false } : {}), gap: 0, tail: 0, read: false,
  presenter: { flip: false, exit: false, entrance: "none" },
  cast: castIds.map((cid, k) => (k === 0 ? { id: cid, place: SOLO } : { id: cid, from: "plain", ...(COLORS[k] ? { color: COLORS[k] } : {}), place: "off" })),
  scenes: out,
};
// the "seam" key on scene 1 would be meaningless; per-scene seams are redundant with script seam false but harmless
writeJSON(scriptPath, script);

// ---- 5b. mocap: the people's bodies, so the coins can copy their moves (scripts/mocap.py, PLAYBOOK §3.1) ----
const mocapRel = `mocap/${slug}.json`, mocapSheet = path.join(ref, "mocap-sheet.png");
let mocapOk = false;
{ // never stops the remake: without mocap the coins act with cues, as before
  const r = run("python", ["-I", path.join(ROOT, "scripts", "mocap.py"), clip, path.join(PUBLIC, mocapRel), "--people", String(castIds.length), "--sheet", mocapSheet], { quiet: true, capture: true });
  mocapOk = r.status === 0 && exists(path.join(PUBLIC, mocapRel));
  const lines = (x) => String(x ?? "").split(String.fromCharCode(10)).map((l) => l.trim()).filter(Boolean);
  if (mocapOk) log(lines(r.stdout).find((l) => l.startsWith("mocap:")) ?? "mocap done");
  else warn(`mocap failed (${lines(r.stderr).pop()}): the coins act with cues only`);
}

// ---- 6. remake.md: the beats to act + the Gemini prompts ----
const place = String(a.place ?? "gym");
const P1 = `Generate a realistic smartphone photo of an ordinary modern ${place}, vertical 9:16 portrait.

Camera: phone held at chest height, straight on, looking slightly down at the floor.
Foreground and center: a wide, EMPTY patch of floor, completely clear (no equipment, no objects on it), with room for two people to stand.
Background: what a normal ${place} has along the walls, large windows, a white ceiling with recessed round lights.

Lighting: bright, clean, evenly lit, daytime, white balanced. NOT moody, NOT cinematic, NOT dark, no heavy shadows, no vignette.
Must NOT include: any people, body parts or reflections of people, any text, signs, logos or brand names.
Style: sharp, natural colours, no blur.`;
const Pn = (k) => `Same ${place} as the first image you made (same floor, same lighting, same windows, same ceiling lights, same style), seen from a different camera angle: the camera turned about ${k * 90 > 270 ? 180 : 90} degrees toward another wall. Phone at chest height, vertical 9:16 portrait.

Center of the frame: an empty patch of floor where a person can stand.
Bright, evenly lit, daytime, white balanced. NOT moody, NOT cinematic, NOT dark, no vignette.
Must NOT include: any people, text, signs or logos. Realistic smartphone photo, sharp.`;
const cell = (s) => String(s).replace(/\|/g, "/");
const md = [
  `# Remake · ${slug}`, "",
  `Source: ${src} · ${dur.toFixed(2)}s · reference: \`reference/ig-${id}/\` (sheet.png, angle-*.png) · STT: "${stt.text ?? ""}"`, "",
  `Cast: ${castIds.map((c, k) => `${c} = voice ${ids[k]}`).join(", ")}. Angles: ${angles.map((g) => `${g.name} (reference/ig-${id}/angle-${g.name}.png)`).join(", ")}.`, "",
  "| # | time | angle | who talks | words (verbatim, check them) | on screen (guess) |",
  "|---|---|---|---|---|---|",
  ...out.map((sc, i) => `| ${i + 1} | ${scenes[i].s.toFixed(2)}–${scenes[i].e.toFixed(2)} | ${scenes[i].angle}${scenes[i].cut && i > 0 ? " (cut)" : ""} | ${scenes[i].sp ? sc.speaker : "nobody (sound layer)"} | ${cell(sc.say || "-")} | ${Object.entries(sc.place).filter(([, p]) => p !== "off").map(([c]) => c).join(", ") || "-"} |`),
  "",
  "## To do by hand (then `node scripts/peek.mjs " + slug + "`, one real render at the end)",
  "- Check the words against the sound (the owner's rule: verbatim, never rewritten); ask him for a line you can't hear.",
  "- Per scene: the mood tag + the moves (PLAYBOOK §1.5 table), who else stands in a shot without talking, the places.",
  ...(mocapOk ? [`- **The same moves (mocap):** look at \`reference/ig-${id}/mocap-sheet.png\` (people #0, #1... left to right, their skeletons). If each person is tracked right, run \`node scripts/suggest-cues.mjs ${slug} --map ${castIds.map((c, k) => `${c}=${k === 0 ? "left" : "right"}`).join(",")} --apply\` (fix the map: each coin = the person it plays): their held poses (hips, crossed arms, a hand raised...) become our cues at the same moments. A wrong id on the sheet = leave that coin out of the map.`] : []),
  `- The sets: the owner makes ${angles.length} image(s) with the prompts below -> \`public/footage/${slug}/${angles.map((g) => `${g.name}.jpg`).join(", ")}\` (1080x1920: \`ffmpeg -i in.jpg -vf "scale=1080:-1,crop=1080:1920" -q:v 2 out.jpg\`).`,
  "",
  "## Gemini prompts (a generic place, NOT a copy of the original: owner rule)",
  ...angles.flatMap((g, k) => [`### ${g.name}${k ? " (paste in the SAME Gemini chat)" : " (new chat, no image attached)"}`, "```", k ? Pn(k) : P1, "```", ""]),
];
fs.writeFileSync(path.join(VIDEOS, slug, "remake.md"), md.join("\n"), "utf8");
if (!multiAngle) warn("one camera angle only: no seam:false (scene changes slide as usual, there is no text anyway)");
log(`${shots.length} shots, ${out.length} scenes, ${angles.length} angle(s), ${castIds.length} coin(s) -> videos/${slug}/script.json + remake.md`);
console.log(path.join(VIDEOS, slug, "remake.md"));
