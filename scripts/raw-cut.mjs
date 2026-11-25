// Auto editor for a raw talking-head take (free, local): Whisper listens, ffmpeg cuts.
//   node scripts/raw-cut.mjs <clip> [--out <mp4>] [--max-pause 0.5] [--pad 0.12] [--no-retakes] [--lang ar] [--dry]
// 1. raw-words.py gives word times (cached next to the clip as <name>.words.json);
// 2. words -> phrases at pauses >= 0.35 s; a phrase said again right after is a retake (the LAST take stays),
//    a short phrase that is only the start of the next one is a false start;
// 3. any gap between kept words longer than --max-pause is cut down to --pad on each side;
// 4. picture + sound are cut in one ffmpeg pass (trim/atrim + concat, 10 ms fades at each cut);
// 5. writes <name>.cuts.md, <name>.srt, <name>.captions.json (3 words max per caption) next to the output.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const withValue = ["--out", "--max-pause", "--pad", "--lang", "--model"];
const clip = args.find((a, i) => !a.startsWith("--") && !(i > 0 && withValue.includes(args[i - 1])));
if (!clip) { console.error("usage: node scripts/raw-cut.mjs <clip> [--out <mp4>] [--max-pause 0.5] [--pad 0.12] [--no-retakes] [--lang ar] [--dry]"); process.exit(1); }
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i > -1 ? args[i + 1] : d; };
const maxPause = Number(opt("max-pause", 0.5)), pad = Number(opt("pad", 0.12));
const lang = opt("lang", "ar"), model = opt("model", "small"), dry = args.includes("--dry"), retakes = !args.includes("--no-retakes");
const PHRASE_GAP = 0.35, MAX_CAPTION_WORDS = 3;
const src = resolve(clip);
if (!existsSync(src)) { console.error(`no clip at ${src}`); process.exit(1); }
const stem = basename(src, extname(src));
const out = resolve(opt("out", join(dirname(src), `${stem}-cut.mp4`)));
const outBase = out.replace(/\.[^.]+$/, "");
mkdirSync(dirname(out), { recursive: true });

// 1. words
const wordsJson = join(dirname(src), `${stem}.words.json`);
const py = spawnSync("python", ["-I", join(root, "scripts", "raw-words.py"), src, wordsJson, "--lang", lang, "--model", model], { stdio: ["ignore", "inherit", "inherit"] });
if (py.status !== 0) { console.error("raw-words.py failed"); process.exit(1); }
const words = JSON.parse(readFileSync(wordsJson, "utf8")).words;
if (!words.length) { console.error("no speech found"); process.exit(1); }

const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,r_frame_rate", "-of", "json", src], { encoding: "utf8" }));
const total = Number(probe.format.duration);
const fpsStr = probe.streams.find(s => s.codec_type === "video").r_frame_rate;

// 2. phrases + retakes
const norm = (t) => t.normalize("NFKD").replace(/[ً-ٰٟـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
const phrases = [];
for (const w of words) {
  const last = phrases[phrases.length - 1];
  if (last && w.start - last.words[last.words.length - 1].end < PHRASE_GAP) last.words.push(w);
  else phrases.push({ words: [w] });
}
for (const p of phrases) { p.n = p.words.map(w => norm(w.w)).filter(Boolean); p.text = p.words.map(w => w.w).join(" "); p.start = p.words[0].start; p.end = p.words.at(-1).end; }

// two words "match" when Whisper spells the same spoken word a little differently, or the first take was cut off
// mid-word (عمل / عملت): equal, one a prefix of the other (3+ letters), or one letter apart (4+ letters)
function lev1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}
const same = (x, y) => x === y || (Math.min(x.length, y.length) >= 3 && (x.startsWith(y) || y.startsWith(x))) || (Math.min(x.length, y.length) >= 4 && lev1(x, y));
// share of the earlier phrase's words found in order at the start of the later one
function prefixShare(a, b) {
  if (!a.length) return 0;
  const window = b.slice(0, Math.ceil(a.length * 1.5) + 1);
  let k = 0, hit = 0;
  for (const x of a) { const j = window.findIndex((y, n) => n >= k && same(x, y)); if (j > -1) { hit++; k = j + 1; } }
  return hit / a.length;
}
const dropped = new Map(); // phrase index -> reason
if (retakes) {
  phrases.forEach((p, i) => {
    for (let j = i + 1; j <= i + 2 && j < phrases.length; j++) {
      const q = phrases[j];
      if (dropped.has(j)) continue;
      const exactPrefix = p.n.length <= 3 && p.n.every((x, k) => q.n[k] !== undefined && same(x, q.n[k])) && q.n.length > p.n.length;
      if (exactPrefix) { dropped.set(i, `false start "${p.text}"`); break; }
      if (p.n.length >= 2 && q.n.length >= p.n.length && prefixShare(p.n, q.n) >= (p.n.length <= 3 ? 1 : 0.75)) { dropped.set(i, `retake of "${p.text}" (said again later)`); break; }
    }
  });
}
const keptWords = phrases.flatMap((p, i) => dropped.has(i) ? [] : p.words);
if (!keptWords.length) { console.error("nothing left to keep"); process.exit(1); }

// 3. keep intervals + cut list
const keeps = [], cuts = [];
const fmt = (t) => t.toFixed(2);
let cur = { s: Math.max(0, keptWords[0].start - pad), words: [keptWords[0]] };
cur.e = keptWords[0].end;
const firstDropped = [...dropped.keys()].filter(i => phrases[i].end <= keptWords[0].start + 1e-6).map(i => dropped.get(i));
if (cur.s > 0.05) cuts.push({ from: 0, to: cur.s, why: firstDropped.length ? firstDropped.join("; ") + " + silence" : "silence (start)" });
for (let k = 1; k < keptWords.length; k++) {
  const a = keptWords[k - 1], b = keptWords[k];
  const between = [...dropped.keys()].filter(i => phrases[i].start >= a.end - 1e-6 && phrases[i].end <= b.start + 1e-6).map(i => dropped.get(i));
  const gap = b.start - a.end;
  if ((gap > maxPause || between.length) && gap > 2 * pad + 0.02) {
    cur.e = a.end + pad; keeps.push(cur);
    cuts.push({ from: cur.e, to: b.start - pad, why: between.length ? between.join("; ") + " + silence" : "silence" });
    cur = { s: b.start - pad, e: b.end, words: [b] };
  } else { cur.e = b.end; cur.words.push(b); }
}
cur.e = Math.min(total, cur.e + pad); keeps.push(cur);
if (total - cur.e > 0.05) cuts.push({ from: cur.e, to: total, why: "silence (end)" });
let off = 0; for (const k of keeps) { k.o = off; off += k.e - k.s; }
const after = off;
const map = (k, t) => k.o + Math.min(Math.max(t, k.s), k.e) - k.s;

// 5. report + captions
let md = `# Cuts for ${basename(src)}\n\n| # | from | to | length | why |\n|---|---|---|---|---|\n`;
cuts.forEach((c, i) => { md += `| ${i + 1} | ${fmt(c.from)} | ${fmt(c.to)} | ${fmt(c.to - c.from)} | ${c.why} |\n`; });
md += `\n**${fmt(total)} s -> ${fmt(after)} s** (${cuts.length} cuts, ${fmt(total - after)} s removed)\n\nKept text: ${keptWords.map(w => w.w).join(" ")}\n`;
writeFileSync(`${outBase}.cuts.md`, md);

const caps = [];
for (const k of keeps) {
  for (let i = 0; i < k.words.length; i += MAX_CAPTION_WORDS) {
    const ws = k.words.slice(i, i + MAX_CAPTION_WORDS).map(w => ({ w: w.w, start: +map(k, w.start).toFixed(3), end: +map(k, w.end).toFixed(3) }));
    caps.push({ text: ws.map(w => w.w).join(" "), start: ws[0].start, end: ws.at(-1).end, words: ws });
  }
}
const ts = (t) => { const ms = Math.round(t * 1000); const p = (n, l = 2) => String(n).padStart(l, "0"); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
writeFileSync(`${outBase}.srt`, caps.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n"));
writeFileSync(`${outBase}.captions.json`, JSON.stringify(caps, null, 1));
console.log(md);
if (dry) { console.log("dry run: no video written"); process.exit(0); }

// 4. one ffmpeg pass
const F = 0.01;
const parts = [];
keeps.forEach((k, i) => {
  const d = k.e - k.s;
  parts.push(`[0:v]trim=start=${k.s.toFixed(3)}:end=${k.e.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
  parts.push(`[0:a]atrim=start=${k.s.toFixed(3)}:end=${k.e.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=${F},afade=t=out:st=${Math.max(0, d - F).toFixed(3)}:d=${F}[a${i}]`);
});
parts.push(keeps.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${keeps.length}:v=1:a=1[cv][ca]`);
parts.push(`[cv]fps=${fpsStr}[v]`);
const script = `${outBase}.filter.txt`;
writeFileSync(script, parts.join(";\n"));
const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-/filter_complex", script, "-map", "[v]", "-map", "[ca]",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "fast", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out], { stdio: "inherit" });
if (r.status !== 0) { console.error("ffmpeg failed"); process.exit(1); }
try { unlinkSync(script); } catch {}
const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], { encoding: "utf8" }));
console.log(`done: ${out} (${fmt(total)} s -> ${fmt(dur)} s)`);
