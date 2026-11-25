// Render a timeline.json with Remotion. Usage: node scripts/render.mjs <slug|timeline.json> [--out file.mp4] [--frames a-b] [--still t] [--scale 0.5]
import path from "node:path";
import { exists, parseArgs, ROOT, runOk, VIDEOS } from "./lib.mjs";

export const renderTimeline = (timelinePath, outFile, { frames, scale, concurrency, still, quiet } = {}) => {
  // call the CLI entry directly with node: no shell, so paths with spaces are safe
  const cli = path.join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js");
  const base = [cli, still !== undefined ? "still" : "render", exists(path.join(ROOT,"build","index.html")) ? "build" : "src/index.ts", "Reel", outFile, `--props=${timelinePath}`, "--log=error","--gl=swangle"];
  if (still !== undefined) base.push(`--frame=${still}`);
  else base.push("--codec=h264", "--crf=17", "--pixel-format=yuv420p", "--audio-codec=aac", "--audio-bitrate=192k");
  if (frames) base.push(`--frames=${frames}`);
  if (scale) base.push(`--scale=${scale}`);
  if (concurrency) base.push(`--concurrency=${concurrency}`);
  runOk(process.execPath, base, { cwd: ROOT, quiet });
  return outFile;
};

if (process.argv[1] && process.argv[1].endsWith("render.mjs")) {
  const a = parseArgs(process.argv.slice(2));
  const target = a._[0];
  if (!target) { console.log("usage: node scripts/render.mjs <slug|timeline.json> [--out out.mp4] [--frames 0-90] [--still 30] [--scale 0.5]"); process.exit(1); }
  const tlPath = target.endsWith(".json") ? path.resolve(target) : path.join(VIDEOS, target, "timeline.json");
  if (!exists(tlPath)) { console.error("timeline not found:", tlPath); process.exit(1); }
  const slug = path.basename(path.dirname(tlPath));
  const out = a.out ? path.resolve(a.out) : path.join(VIDEOS, slug, "out", a.still !== undefined ? `still-${a.still}.png` : `${slug}.mp4`);
  renderTimeline(tlPath, out, { frames: a.frames, scale: a.scale, concurrency: a.concurrency, still: a.still });
  console.log("->", out);
}
