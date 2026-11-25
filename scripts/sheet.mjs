// Contact sheet: one frame per scene (at 80 % of the scene, when its visual has settled) -> out/sheet[-mr].png
// Usage: node scripts/sheet.mjs <slug>   (brand videos: one sheet per pool). make.mjs also calls sheetFrom() itself.
import fs from "node:fs";
import path from "node:path";
import { die, exists, parseArgs, readJSON, run, runOk, VIDEOS } from "./lib.mjs";

// a freshly rendered mp4 can be locked for a moment on Windows (antivirus scan): retry a few times before failing
const ffmpegRetry = (args) => {
  for (let i = 0; i < 4; i++) {
    if (run("ffmpeg", args, { quiet: true, capture: true }).status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
  }
  runOk("ffmpeg", args, { quiet: true });
};

/** timeline + its mp4 -> one png with a frame per scene. */
export const sheetFrom = (tl, mp4, out) => {
  const tmp = path.join(path.dirname(out), `_sheet${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  try {
    tl.scenes.forEach((s, i) => {
      const t = (s.start + (s.end - s.start) * 0.8).toFixed(2);
      ffmpegRetry(["-v", "error", "-y", "-ss", t, "-i", mp4, "-frames:v", "1", "-vf", "scale=360:-1", path.join(tmp, `f${String(i + 1).padStart(2, "0")}.png`)], { quiet: true });
    });
    const cols = Math.min(5, tl.scenes.length);
    runOk("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-i", path.join(tmp, "f%02d.png"), "-vf", `tile=${cols}x${Math.ceil(tl.scenes.length / cols)}`, "-frames:v", "1", out], { quiet: true });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return out;
};

if (process.argv[1] && process.argv[1].endsWith("sheet.mjs")) {
  const a = parseArgs(process.argv.slice(2));
  const slug = a._[0];
  if (!slug) die("usage: node scripts/sheet.mjs <slug>");
  const dir = path.join(VIDEOS, slug);
  const tags = fs.readdirSync(dir).filter((f) => /^timeline(-\w+)?\.json$/.test(f)).map((f) => f.slice(8, -5));
  if (!tags.length) die(`no timeline in ${dir}; run make first`);
  for (const tag of tags) {
    const mp4 = path.join(dir, "out", `${slug}${tag}.mp4`);
    if (exists(mp4)) console.log("->", sheetFrom(readJSON(path.join(dir, `timeline${tag}.json`)), mp4, path.join(dir, "out", `sheet${tag}.png`)));
  }
}
