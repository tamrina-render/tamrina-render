// One-time doctor + install. Run once after cloning: node scripts/setup.mjs
import fs from "node:fs";
import path from "node:path";
import { log, PUBLIC, ROOT, run, warn } from "./lib.mjs";

let ok = true;
const check = (name, pass, hint) => { if (pass) log(`✓ ${name}`); else { ok = false; warn(`✗ ${name}  -> ${hint}`); } };

const nodeMajor = Number(process.versions.node.split(".")[0]);
check(`node ${process.versions.node}`, nodeMajor >= 20, "install Node 20+ from nodejs.org");

const ff = run("ffmpeg", ["-version"], { capture: true, quiet: true });
check("ffmpeg", ff.status === 0, "winget install Gyan.FFmpeg  (then reopen the terminal)");

const py = run("python", ["--version"], { capture: true, quiet: true });
check(`python ${String(py.stdout || py.stderr).trim()}`, py.status === 0, "install Python 3.10+ from python.org (check 'Add to PATH')");

const et = run("python", ["-c", "import edge_tts,sys;print(edge_tts.__version__)"], { capture: true, quiet: true });
if (et.status !== 0) {
  log("installing edge-tts (free Microsoft neural voices)…");
  run("python", ["-m", "pip", "install", "--user", "-q", "edge-tts"], { quiet: true });
}
const et2 = run("python", ["-c", "import edge_tts;print(edge_tts.__version__)"], { capture: true, quiet: true });
check(`edge-tts ${String(et2.stdout).trim()}`, et2.status === 0, "python -m pip install edge-tts");

check("node_modules (remotion)", fs.existsSync(path.join(ROOT, "node_modules", "remotion")), "npm install");

const fonts = ["Manrope.ttf", "InstrumentSerif-Italic.ttf", "JetBrainsMono.ttf", "Cairo.ttf"];
check("fonts in public/fonts", fonts.every((f) => fs.existsSync(path.join(PUBLIC, "fonts", f))), "see guides/setup.md (font download list)");

log("ensuring Remotion's headless browser (one-time ~120 MB download)…");
const br = run(process.execPath, [path.join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js"), "browser", "ensure"], { capture: true, quiet: true });
check("headless browser", br.status === 0, "npx remotion browser ensure");

if (ok) {
  log("ALL GOOD. Try:  node scripts/new.mjs demo && node scripts/make.mjs demo");
} else {
  warn("fix the items above, then run setup again");
  process.exit(1);
}
