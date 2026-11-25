// A few frames of a video in seconds, without rendering it: look before the one real render.
// Usage: node scripts/peek.mjs <slug> [t1 t2 ...] [--full] [--draft] [--cols 4]
//   t = seconds (no times = the middle of every scene). Default = the lower part of the frame (where the coins stand),
//   --full = the whole frame. Writes videos/<slug>/out/peek.png (one image, small) and prints its path.
// It builds the timeline with `make --peek` (never touches timeline.json / draft-timeline.json, never spends voice
// credits: lines without a recording use the draft timing), bundles the project once and renders only those frames.
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { die, ensureDir, exists, log, parseArgs, readJSON, ROOT, runOk, VIDEOS, warn } from "./lib.mjs";
import { holdCheck, holdLines } from "./hold-check.mjs";

const a = parseArgs(process.argv.slice(2));
const slug = a._[0];
if (!slug) die("usage: node scripts/peek.mjs <slug> [t1 t2 ...] [--full] [--draft] [--cols 4]");
const dir = path.join(VIDEOS, slug), out = path.join(dir, "out"), tmp = path.join(out, "peek");
if (!exists(path.join(dir, "script.json"))) die(`missing videos/${slug}/script.json`);

// 1. the timeline, in its own file
for (const f of fs.readdirSync(dir)) if (/^peek-timeline.*\.json$/.test(f)) fs.rmSync(path.join(dir, f));
runOk(process.execPath, [path.join(ROOT, "scripts", "make.mjs"), slug, "--peek", ...(a.draft ? ["--draft"] : [])], { quiet: true });
const tls = fs.readdirSync(dir).filter((f) => /^peek-timeline.*\.json$/.test(f)).sort();
if (!tls.length) die("make --peek wrote no timeline (see the error above)");

// 2. bundle once, then one still per time (same GL renderer as remotion.config.ts)
log("peek: bundling…");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts") });
fs.rmSync(tmp, { recursive: true, force: true }); ensureDir(tmp);
const cells = [];
for (const f of tls) {
  const tl = readJSON(path.join(dir, f));
  try { for (const l of holdLines(await holdCheck(tl))) (l.includes("hold check: OK") ? log : warn)(l); } catch (e) { warn(`hold check skipped (${e.message})`); }
  const times = a._.slice(1).map(Number).filter((x) => !Number.isNaN(x));
  const ts = times.length ? times : tl.scenes.map((sc) => Math.round(((sc.start + sc.end) / 2) * 100) / 100);
  const comp = await selectComposition({ serveUrl, id: "Reel", inputProps: tl, chromiumOptions: { gl: "angle" } });
  const tag = f.replace(/^peek-timeline|\.json$/g, "");
  for (const t of ts) {
    const frame = Math.max(0, Math.min(comp.durationInFrames - 1, Math.round(t * tl.fps)));
    const png = path.join(tmp, `${tag || "v"}-${String(cells.length).padStart(2, "0")}.png`);
    await renderStill({ composition: comp, serveUrl, inputProps: tl, frame, output: png, imageFormat: "png", scale: 0.5, chromiumOptions: { gl: "angle" }, overwrite: true });
    cells.push({ png, label: `${tag ? tag.slice(1) + " " : ""}${t.toFixed(2)}s` });
  }
}

// 3. one sheet: each cell cropped (coins) or whole, labelled with its time, in rows of --cols
const cols = Math.max(1, Number(a.cols) || 4);
const crop = a.full ? "scale=270:-1" : "crop=540:560:0:400,scale=324:-1"; // half-size frame: y 400..960 = the lower part of 1920
const font = "C\\:/Windows/Fonts/arial.ttf";
const label = (s) => `,drawtext=fontfile='${font}':text='${s}':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4`;
const sheet = path.join(out, "peek.png");
const build = (withLabels) => {
  const n = cells.length, rows = Math.ceil(n / cols), m = n === 1 ? 1 : rows * cols;
  // every cell is a 540x960 still; empty cells of the last row = black 540x960 inputs, cropped the same way
  const inputs = [...cells.flatMap((c) => ["-i", c.png]), ...Array.from({ length: m - n }, () => ["-f", "lavfi", "-i", "color=c=black:s=540x960:d=1"]).flat()];
  const parts = Array.from({ length: m }, (_, i) => `[${i}:v]${crop}${withLabels && i < n ? label(cells[i].label) : ""}[c${i}]`);
  const sum = (k, u) => (k ? Array.from({ length: k }, () => u).join("+") : "0");
  const layout = Array.from({ length: m }, (_, i) => `${sum(i % cols, "w0")}_${sum(Math.floor(i / cols), "h0")}`).join("|");
  const graph = m === 1 ? `[0:v]${crop}${withLabels ? label(cells[0].label) : ""}` : `${parts.join(";")};${parts.map((_, i) => `[c${i}]`).join("")}xstack=inputs=${m}:layout=${layout}`;
  runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", graph, "-frames:v", "1", sheet], { quiet: true });
};
try { build(true); } catch { build(false); } // no labels if drawtext / the font is missing
log(`peek: ${cells.length} frame(s) -> ${sheet}`);
console.log(sheet);
