// Jump-cut pass on a finished reel (owner, 2026-11-16: "every couple of seconds it cuts, the words are tightened,
// as if a frame was taken out; not everything continuous").
//   node scripts/jumpcut.mjs <slug> [--zoom 1.1] [--max 2.4] [--keep 0.05] [--min 0.16] [--in <mp4>] [--out <mp4>]
// 1. finds the pauses in the voice (ffmpeg silencedetect) and cuts the middle of each pause out of picture AND sound;
// 2. makes sure no piece is longer than --max seconds by adding a cut on the nearest word start (timeline.json);
// 3. every other piece is punched in (--zoom, centre crop), so each cut reads as a creator's jump cut.
// The source mp4 is never changed; the result is <slug>-jumpcut.mp4 next to it.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const slug = args[0];
if (!slug) { console.error("usage: node scripts/jumpcut.mjs <slug> [--zoom 1.1] [--max 2.4]"); process.exit(1); }
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i > -1 ? args[i + 1] : def; };
const zoom = Number(opt("zoom", 1.1)), maxLen = Number(opt("max", 2.4)), keep = Number(opt("keep", 0.05)), minPause = Number(opt("min", 0.16));
const dir = join(root, "videos", slug);
const input = resolve(opt("in", join(dir, "out", `${slug}.mp4`)));
const output = resolve(opt("out", join(dir, "out", `${slug}-jumpcut.mp4`)));
if (!existsSync(input)) { console.error(`no video at ${input}`); process.exit(1); }

const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=width,height,r_frame_rate,codec_type", "-of", "json", input], { encoding: "utf8" }));
const video = probe.streams.find(s => s.codec_type === "video");
const duration = Number(probe.format.duration), W = video.width, H = video.height;
const [fn, fd] = video.r_frame_rate.split("/").map(Number), fps = fn / (fd || 1);

// 1. pauses in the sound
const det = spawnSync("ffmpeg", ["-hide_banner", "-i", input, "-af", `silencedetect=noise=-34dB:d=${minPause}`, "-f", "null", "-"], { encoding: "utf8" });
const pauses = [];
let open = null;
for (const line of det.stderr.split("\n")) {
  const s = line.match(/silence_start: ([\d.]+)/), e = line.match(/silence_end: ([\d.]+)/);
  if (s) open = Number(s[1]);
  if (e && open !== null) { pauses.push([open, Number(e[1])]); open = null; }
}

// --sentences (owner, 2026-11-16: "cut where one thing ends and the next begins, a cut in the middle of a sentence is annoying"):
// cut ONLY where a sentence ends. A sentence start = the first word of a scene, or the word after one that ends with . ? ! or ،
// The pause just before it is tightened; no cut anywhere else, and no --max splitting.
const sentencesOnly = args.includes("--sentences");
const tlPathS = join(dir, "timeline.json");
const sentenceStarts = [];
if (sentencesOnly && existsSync(tlPathS)) {
  for (const scene of JSON.parse(readFileSync(tlPathS, "utf8")).scenes) {
    const ws = scene.words || [];
    ws.forEach((w, i) => { if (i === 0 || /[.؟?!،,]["”»)]*$/.test(ws[i - 1].w)) sentenceStarts.push(w.start); });
  }
}
const nearSentence = (s, e) => sentenceStarts.some(t => t > 0.3 && t >= s - 0.12 && t <= e + 0.3);

// kept pieces = everything except the middle of each pause (the first and last pause of the file stay whole)
let pieces = [], cursor = 0;
for (const [s, e] of pauses) {
  if (s < 0.2 || e > duration - 0.3) continue;
  if (sentencesOnly && !nearSentence(s, e)) continue;
  const a = s + keep, b = e - keep;
  if (b - a < 0.04) continue;
  pieces.push([cursor, a]); cursor = b;
}
pieces.push([cursor, duration]);

// 2. no piece longer than maxLen: split on the word start nearest to the middle
const tlPath = join(dir, "timeline.json");
const words = existsSync(tlPath) ? JSON.parse(readFileSync(tlPath, "utf8")).scenes.flatMap(s => (s.words || []).map(w => w.start)) : [];
// in --sentences mode: a sentence start with no pause before it still gets a plain cut (the punch-in changes there)
if (sentencesOnly) {
  for (const t of sentenceStarts) {
    if (t < 0.3 || t > duration - 0.5) continue;
    const k = pieces.findIndex(([a, b]) => t > a + 0.35 && t < b - 0.35);
    if (k > -1) { const [a, b] = pieces[k]; pieces.splice(k, 1, [a, t], [t, b]); }
  }
}
const split = ([a, b]) => {
  if (sentencesOnly || b - a <= maxLen) return [[a, b]];
  const mid = (a + b) / 2;
  const cands = words.filter(t => t > a + 0.7 && t < b - 0.7);
  const cut = cands.length ? cands.reduce((best, t) => Math.abs(t - mid) < Math.abs(best - mid) ? t : best) : mid;
  return [...split([a, cut]), ...split([cut, b])];
};
pieces = pieces.flatMap(split).map(([a, b]) => [Math.round(a * fps) / fps, Math.round(b * fps) / fps]).filter(([a, b]) => b - a > 1 / fps);

// 3. every other piece punched in
const cw = Math.round(W / zoom / 2) * 2, ch = Math.round(H / zoom / 2) * 2;
const filters = [], labels = [];
pieces.forEach(([a, b], i) => {
  const punch = i % 2 === 1 ? `,crop=${cw}:${ch},scale=${W}:${H}:flags=lanczos` : "";
  filters.push(`[0:v]trim=start=${a.toFixed(4)}:end=${b.toFixed(4)},setpts=PTS-STARTPTS${punch},setsar=1[v${i}]`);
  filters.push(`[0:a]atrim=start=${a.toFixed(4)}:end=${b.toFixed(4)},asetpts=PTS-STARTPTS,afade=t=in:d=0.006,afade=t=out:st=${Math.max(0, b - a - 0.006).toFixed(4)}:d=0.006[a${i}]`);
  labels.push(`[v${i}][a${i}]`);
});
filters.push(`${labels.join("")}concat=n=${pieces.length}:v=1:a=1[v][a]`);
const script = join(dir, "out", "jumpcut-filter.txt");
writeFileSync(script, filters.join(";\n"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", input, "-/filter_complex", script, "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", String(fps), "-c:a", "aac", "-b:a", "192k", output], { stdio: "inherit" });
const outDur = pieces.reduce((sum, [a, b]) => sum + (b - a), 0);
console.log(`[jumpcut] ${pauses.length} pauses found, ${pieces.length} pieces, ${duration.toFixed(2)} s -> ${outDur.toFixed(2)} s, zoom ${zoom} on every other piece`);
console.log(`[jumpcut] cuts at: ${pieces.slice(1).map(([a]) => a.toFixed(2)).join(", ")}`);
console.log(`[jumpcut] -> ${output}`);
