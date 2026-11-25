// Audio chain (the reel's "CUT -> SPEED -> LOUD -> PEAK" pedalboard), all ffmpeg, no credits.
//   CUT   : trim leading/trailing silence of every clip (timings shift exactly by the trimmed amount)
//   SPEED : atempo (default x1.12) - word timings divided by the same factor
//   LOUD  : loudnorm two-pass to -14 LUFS integrated (Instagram)
//   PEAK  : true peak -1.5 dBTP (loudnorm TP), verified with ebur128 afterwards
import fs from "node:fs";
import path from "node:path";
import { ensureDir, ffprobeDuration, log, r3, run, runOk } from "./lib.mjs";

/** Detect leading and trailing silence. Returns {start, end} = the span of actual speech. */
export const speechSpan = (file, noise = "-38dB", minDur = 0.06) => {
  const dur = ffprobeDuration(file);
  const r = run("ffmpeg", ["-hide_banner", "-i", file, "-af", `silencedetect=noise=${noise}:d=${minDur}`, "-f", "null", "-"], { capture: true, quiet: true });
  const txt = String(r.stderr);
  const starts = [...txt.matchAll(/silence_start: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
  const ends = [...txt.matchAll(/silence_end: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
  let start = 0, end = dur;
  if (starts.length && starts[0] <= 0.02 && ends.length) start = Math.max(0, ends[0] - 0.04);
  const lastStart = starts[starts.length - 1];
  const lastEnd = ends[ends.length - 1];
  if (lastStart !== undefined && (lastEnd === undefined || lastEnd < lastStart || lastEnd >= dur - 0.02)) end = Math.min(dur, lastStart + 0.1);
  if (end - start < 0.2) { start = 0; end = dur; }
  return { start: r3(start), end: r3(end), dur: r3(dur) };
};

/** CUT + SPEED one clip to a 48k mono wav. Returns the new duration. */
export const cutAndSpeed = (inFile, outWav, span, speed) => {
  const filters = [`atrim=start=${span.start}:end=${span.end}`, "asetpts=PTS-STARTPTS"];
  if (Math.abs(speed - 1) > 0.001) filters.push(`atempo=${speed}`);
  runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", inFile, "-af", filters.join(","), "-ar", "48000", "-ac", "1", outWav], { quiet: true });
  return ffprobeDuration(outWav);
};

/** Concatenate wavs with a fixed gap of silence between them. */
/** gap: seconds of silence between clips, one number or one per clip (brand reading-time holds). */
export const concatWithGaps = (wavs, gap, outWav, workDir) => {
  ensureDir(workDir);
  const silenceFor = (g) => {
    const f = path.join(workDir, `gap_${g}.wav`);
    if (!fs.existsSync(f)) runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", String(g), f], { quiet: true });
    return f;
  };
  const list = path.join(workDir, "concat.txt");
  const lines = [];
  wavs.forEach((w, i) => { lines.push(`file '${w.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`); const g = Array.isArray(gap) ? gap[i] : gap; if (i < wavs.length - 1 && g > 0.001) lines.push(`file '${silenceFor(g).replace(/\\/g, "/")}'`); }); // no zero-length silence (silent footage scenes)
  fs.writeFileSync(list, lines.join("\n") + "\n", "utf8");
  runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", outWav], { quiet: true });
  return ffprobeDuration(outWav);
};

/** LOUD + PEAK: two-pass loudnorm to I=-14 LUFS, TP=-1.5 dBTP. Writes mp3 (and wav). */
export const masterLoudness = (inWav, outMp3, { I = -14, TP = -1.5, LRA = 11 } = {}) => {
  const first = run("ffmpeg", ["-hide_banner", "-i", inWav, "-af", `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`, "-f", "null", "-"], { capture: true, quiet: true });
  const m = String(first.stderr).match(/\{[^{}]*"input_i"[^{}]*\}/);
  let af = `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}`;
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      if (!Number.isFinite(Number(j.input_i))) throw 0; // all-silent track (a video with no words): measured -inf, single pass
      af +=`:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
    } catch { /* fall back to single pass */ }
  }
  // loudnorm upsamples to 192k; bring back to 48k. A gentle high-pass keeps TTS clean.
  const tmp = outMp3.replace(/\.mp3$/, ".pass1.wav");
  runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", inWav, "-af", `highpass=f=70,${af},aresample=48000`, "-ar", "48000", "-ac", "1", tmp], { quiet: true });
  // verify; if loudnorm undershot (common on short, low-LRA speech) apply exact gain + true-peak limiter
  let got = measure(tmp);
  let finalAf = "anull";
  if (Number.isFinite(got.I) && Math.abs(got.I - I) > 0.3) {
    const gain = (I - got.I).toFixed(2);
    finalAf = `volume=${gain}dB,alimiter=limit=${Math.pow(10, TP / 20).toFixed(3)}:attack=5:release=50:level=false`;
  }
  runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", tmp, "-af", finalAf, "-ar", "48000", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "192k", outMp3], { quiet: true });
  try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  return measure(outMp3);
};

/** Verify with ebur128: returns {I, TP} actually measured on the output. */
export const measure = (file) => {
  const r = run("ffmpeg", ["-hide_banner", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { capture: true, quiet: true });
  const txt = String(r.stderr);
  const I = parseFloat((txt.match(/I:\s*(-?[\d.]+) LUFS/g) || []).pop()?.match(/(-?[\d.]+)/)?.[1] ?? "NaN");
  const TP = parseFloat((txt.match(/Peak:\s*(-?[\d.]+) dBFS/g) || []).pop()?.match(/(-?[\d.]+)/)?.[1] ?? "NaN");
  return { I, TP };
};

if (process.argv[1] && process.argv[1].endsWith("master.mjs")) {
  const [inp, out] = process.argv.slice(2);
  if (!inp || !out) { console.log("usage: node scripts/master.mjs in.wav out.mp3"); process.exit(1); }
  const m = masterLoudness(inp, out);
  log(`mastered -> ${out}  I=${m.I} LUFS  TP=${m.TP} dBTP`);
}
