// Deletes what our renders leave behind in the Windows Temp folder on drive C: every render / peek leaves a
// Remotion bundle (0.2-0.4 GB), a browser profile and an assets folder, and nothing ever removes them
// (2026-11-17: 44 GB had piled up and drive C was full).
// Usage: node scripts/clean-temp.mjs [--dry]
//   While another render is running (another session), only folders older than 2 hours are removed.
//   --dry = print what would be removed, delete nothing.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const dry = process.argv.includes("--dry");
const tmp = os.tmpdir();
const OURS = /^(remotion-webpack-bundle-|puppeteer_dev_chrome_profile-|remotion-v[\d.]+-assets)/;

const tasks = spawnSync("tasklist", { encoding: "utf8" }).stdout ?? "";
const busy = /chrome-headless-shell\.exe|ffmpeg\.exe/i.test(tasks);
const cutoff = busy ? Date.now() - 2 * 3600 * 1000 : Infinity;

const free = () => { try { const s = fs.statfsSync(tmp); return s.bavail * s.bsize; } catch { return 0; } };
const before = free();
let removed = 0, kept = 0, locked = 0;
for (const name of fs.readdirSync(tmp)) {
  if (!OURS.test(name)) continue;
  const p = path.join(tmp, name);
  let st; try { st = fs.statSync(p); } catch { continue; }
  if (st.mtimeMs > cutoff) { kept++; continue; }
  if (dry) { removed++; continue; }
  try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 2 }); removed++; } catch { locked++; }
}
const gb = ((free() - before) / 1024 ** 3).toFixed(1);
console.log(`clean-temp: ${dry ? "would remove" : "removed"} ${removed} folder(s)${dry ? "" : `, freed ${gb} GB on C`}` +
  (busy ? `; another render is running, kept ${kept} newer than 2 h` : "") + (locked ? `; ${locked} in use, left` : ""));
