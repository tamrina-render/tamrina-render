// Props for FactCoach (videos/da7ee7-gym-intro): who talks when (from the diarized speech-to-text of the original
// intro, shifted by the 1.0 s that was cut) + the loudness of every frame (for the mouth).
// Usage (from bash): node scripts/coach-props.mjs > videos/da7ee7-gym-intro/out/factcoach/props.json
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CUT = 1.0, LEN = 47.3, FPS = 30;
const stt = JSON.parse(fs.readFileSync(ROOT + "reference/yt-ntZq0wIo2ds/intro-stt.json", "utf8"));
const who = { speaker_0: "coach", speaker_1: "mohab" };
const talk = { coach: [], mohab: [] };
for (const w of stt.words) {
  if (w.type !== "word") continue;
  const a = w.start - CUT, b = w.end - CUT;
  if (b <= 0 || a >= LEN) continue;
  const list = talk[who[w.speaker_id]];
  const last = list[list.length - 1];
  const fa = Math.max(0, Math.round(a * FPS)), fb = Math.round(b * FPS);
  if (last && fa - last[1] <= 4) last[1] = fb; else list.push([fa, fb]);
}
const rms = fs.readFileSync(ROOT + "videos/da7ee7-gym-intro/out/factcoach/rms.txt", "utf8")
  .split("\n").filter((l) => l.includes("RMS_level")).map((l) => parseFloat(l.split("=")[1]));
// -40 dB -> 0, -12 dB -> 1
const loud = rms.map((v) => (Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, (v + 40) / 28)) * 100) / 100 : 0));
const durationSec = Number(process.argv[2] || 54);
process.stdout.write(JSON.stringify({ durationSec, talk, loud }));
