// The reviewer's eyes: after a render, look at the whole video without playing it.
//   node scripts/review.mjs <slug> [file.mp4]
// Writes videos/<slug>/out/review-sheet.png (frames every 0.6 s, in order, left to right) and prints:
// - one-frame flashes (a frame whose picture is unlike its neighbours: a hole in the footage, a wrong cut)
// - the hold check (frame 0, length, coin size, same shot too long, a real touch)
// - where the acting table is. The agent `reel-reviewer` (.claude/agents) reads these and reports; it never edits.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug) { console.error("usage: node scripts/review.mjs <slug> [file.mp4]"); process.exit(1); }
const out = join(root, "videos", slug, "out");
const mp4 = process.argv[3] ? resolve(process.argv[3]) : join(out, `${slug}.mp4`);
if (!existsSync(mp4)) { console.error(`no video: ${mp4} (render it first: node scripts/make.mjs ${slug} --review)`); process.exit(1); }
const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26 });

const dur = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).stdout.trim()) || 0;
const n = Math.max(1, Math.ceil(dur / 0.6)), cols = 8, rows = Math.ceil(n / cols);
const sheet = join(out, "review-sheet.png");
run("ffmpeg", ["-v", "error", "-y", "-i", mp4, "-vf", `fps=1/0.6,scale=270:-1,tile=${cols}x${rows}`, "-frames:v", "1", "-update", "1", sheet]);
console.log(`review: ${slug} · ${dur.toFixed(2)} s · sheet (a frame every 0.6 s, ${cols} per row) -> ${sheet}`);

// a flash = a frame very unlike the one before it AND the next frame is very unlike it again (two big jumps in a row);
// a single big jump is a hard cut and is only listed
const det = run("ffmpeg", ["-hide_banner", "-i", mp4, "-vf", "select='gt(scene,0.3)',showinfo", "-an", "-f", "null", "-"]);
const jumps = [...det.stderr.matchAll(/pts_time:([0-9.]+)/g)].map((m) => Number(m[1]));
const fps = 30, flashes = jumps.filter((t, i) => jumps[i + 1] !== undefined && jumps[i + 1] - t < 2.5 / fps);
const lastFrame = jumps.filter((t) => dur - t < 0.08);
if (!jumps.length) console.log("flashes: none (no frame is unlike its neighbours)");
else {
  console.log(`big picture jumps at: ${jumps.map((t) => t.toFixed(2)).join(", ")} s`);
  if (flashes.length) console.log(`  ! FLASH (one odd frame) at: ${flashes.map((t) => t.toFixed(2)).join(", ")} s`);
  if (lastFrame.length) console.log(`  ! the last frame is unlike the one before it (${lastFrame[0].toFixed(2)} s): a dark frame at the end`);
  console.log("  a jump that is not a planned hard cut = a glitch: look at it with  ffmpeg -ss <t-0.07> -i <mp4> -vf \"scale=216:-1,tile=5x1\" -frames:v 1 -update 1 g.png");
}
const hc = run("node", [join(root, "scripts", "hold-check.mjs"), slug]);
console.log((hc.stdout || "").trim());
const acting = ["acting.md", "acting-mr.md", "acting-mrs.md"].map((f) => join(out, f)).filter(existsSync);
if (acting.length) console.log(`acting table: ${acting.join(" · ")}`);
