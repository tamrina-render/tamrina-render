// Mouth shapes from the voice with Rhubarb Lip Sync (free, offline): tools/Rhubarb-Lip-Sync-*/rhubarb.exe
// "phonetic" recognizer = language independent, so it works for Egyptian Arabic. ~8 s for a 30 s voice.
// Install once: download Rhubarb-Lip-Sync-<v>-Windows.zip from github.com/DanielSWolf/rhubarb-lip-sync/releases into tools/ and unzip.
import fs from "node:fs";
import path from "node:path";
import { exists, r3, readJSON, ROOT, run, warn } from "./lib.mjs";

const findRhubarb = () => {
  const tools = path.join(ROOT, "tools");
  if (!exists(tools)) return null;
  for (const d of fs.readdirSync(tools)) {
    const exe = path.join(tools, d, process.platform === "win32" ? "rhubarb.exe" : "rhubarb");
    if (d.toLowerCase().startsWith("rhubarb") && exists(exe)) return exe;
  }
  return null;
};

/** voice mp3 -> [{t, v}] mouth cues (A-H, X), or null (no Rhubarb: the coin falls back to a generic mouth flap). */
export const mouthCues = (voiceMp3, workDir) => {
  const exe = findRhubarb();
  if (!exe) { warn("Rhubarb not found in tools/ -> generic mouth flap (see scripts/lipsync.mjs)"); return null; }
  const wav = path.join(workDir, "lipsync.wav"), out = path.join(workDir, "lipsync.json");
  run("ffmpeg", ["-v", "error", "-y", "-i", voiceMp3, "-ac", "1", "-ar", "16000", wav], { quiet: true });
  const r = run(exe, ["-q", "-r", "phonetic", "-f", "json", "-o", out, wav], { quiet: true, capture: true });
  if (r.status !== 0 || !exists(out)) { warn("Rhubarb failed -> generic mouth flap"); return null; }
  return cleanMouth(readJSON(out).mouthCues.map((c) => ({ t: r3(c.start), v: c.value })));
};

/**
 * Cartoon lip-sync clean-up (2026-11-08, the acting research: Williams / Animator Island):
 *  - a shape shorter than 3 frames (0.1 s) reads as chatter: it merges into the shape before it
 *  - a closed mouth (A = M / B / P) is visible >= 3 frames: it starts earlier, stealing from the shape before
 *  - at the end of a phrase the last shape holds 3 frames into the silence before the mouth rests (X)
 */
export const cleanMouth = (cues, F = 0.1) => {
  let c = cues.map((x) => ({ ...x }));
  const dur = (i) => (c[i + 1] ? c[i + 1].t - c[i].t : 1);
  for (let pass = 0; pass < 3; pass++) {
    const out = [];
    for (let i = 0; i < c.length; i++) {
      const short = dur(i) < F - 1e-6 && c[i].v !== "A" && c[i].v !== "X" && out.length && out[out.length - 1].v !== "X";
      if (!short) out.push(c[i]);
    }
    c = out.filter((x, i) => i === 0 || x.v !== out[i - 1].v); // two of the same in a row = one
  }
  for (let i = 1; i < c.length; i++) if (c[i].v === "A" && dur(i) < F) {
    const want = F - dur(i), room = c[i].t - c[i - 1].t - 0.05;
    if (room > 0) c[i].t = r3(c[i].t - Math.min(want, room));
  }
  for (let i = 1; i < c.length; i++) if (c[i].v === "X" && c[i - 1].v !== "A" && dur(i) > 0.25) c[i].t = r3(c[i].t + Math.min(F, (c[i + 1]?.t ?? 1e9) - c[i].t - 0.15));
  return c;
};

/**
 * Voice loudness per video frame (0..1): drives how far the mouth opens and the talking body beats, so the coin
 * moves WITH the voice (owner 2026-10-26: "the voice feels disconnected from the character").
 * RMS per 1/fps window -> -45 dB = 0 .. -15 dB = 1, fast attack, ~60 ms release.
 */
export const voiceEnvelope = (voiceMp3, fps = 30) => {
  const n = Math.round(48000 / fps);
  const r = run("ffmpeg", ["-v", "error", "-i", voiceMp3, "-af", `aresample=48000,asetnsamples=n=${n}:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-`, "-f", "null", "-"], { quiet: true, capture: true });
  const db = [...String(r.stdout).matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => (m[1] === "-inf" ? -90 : Number(m[1])));
  if (!db.length) { warn("voice envelope: no data"); return null; }
  // range adapts to this voice: its quiet speech (10th percentile of voiced frames) -> 0, its loud peaks (97th) -> 1
  const voiced = db.filter((d) => d > -50).sort((a, b) => a - b);
  const pct = (p) => voiced[Math.min(voiced.length - 1, Math.floor(voiced.length * p))] ?? -30;
  const lo = pct(0.1), hi = Math.max(lo + 6, pct(0.97));
  let prev = 0;
  const v = db.map((d) => { const x = Math.pow(Math.min(1, Math.max(0, (d - lo) / (hi - lo))), 1.3); prev = Math.max(x, prev * 0.55); return Math.round(prev * 1000) / 1000; });
  return { fps, v };
};

/**
 * Prosody for the human layer (src/lib/human.ts, 2026-11-07): the head, brows and gesture strokes follow the VOICE,
 * not the word list. Returns { fps, p, acc }:
 *  - p[i]   = pitch per frame in semitones from that speaker's own median (+ = higher), smoothed, 0 when unvoiced
 *  - acc[]  = syllable accents {t, s}: loudness peaks (prominent, >= 0.16 s apart), s 0..1 = loudness + pitch rise
 * Pitch comes from scripts/pitch.py (numpy autocorrelation); without it p is all 0 and acc uses loudness only.
 */
export const voiceProsody = (voiceMp3, env, scenes = []) => {
  if (!env?.v?.length) return null;
  const fps = env.fps, n = env.v.length;
  let f0 = new Array(n).fill(0);
  const r = run("python", ["-I", path.join(ROOT, "scripts", "pitch.py"), voiceMp3, String(fps)], { quiet: true, capture: true });
  try { const j = JSON.parse(String(r.stdout)); f0 = Array.from({ length: n }, (_, i) => j.f0[i] ?? 0); } catch { warn("pitch: no data -> accents from loudness only"); }
  // each speaker's own median (a deep and a high voice both centre on 0)
  const spk = (i) => scenes.find((s) => i / fps >= s.start && i / fps < s.end)?.speaker ?? "_";
  const med = {};
  for (const id of new Set(scenes.map((s) => s.speaker ?? "_").concat("_"))) {
    const v = f0.filter((x, i) => x > 0 && (id === "_" || spk(i) === id)).sort((a, b) => a - b);
    med[id] = v[Math.floor(v.length / 2)] ?? 0;
  }
  const raw = f0.map((x, i) => {
    const m = med[spk(i)] || med._;
    if (!x || !m) return null;
    if (x > 1.7 * m) x /= 2; else if (x < m / 1.7) x *= 2; // octave errors of the autocorrelation
    return Math.max(-7, Math.min(7, 12 * Math.log2(x / m)));
  });
  // median of 5 (kills single-frame octave jumps), then unvoiced frames ease back to 0
  const md = raw.map((_, i) => { const w = raw.slice(Math.max(0, i - 2), i + 3).filter((x) => x !== null).sort((a, b) => a - b); return w.length >= 2 ? w[Math.floor(w.length / 2)] : null; });
  let prev = 0;
  const held = md.map((x) => (prev = x === null ? prev * 0.85 : x));
  const p = held.map((_, i) => { const w = held.slice(Math.max(0, i - 2), i + 3); return r3(w.reduce((a, b) => a + b, 0) / w.length); });
  // accents: prominent loudness peaks
  const e = env.v.map((_, i) => (env.v[Math.max(0, i - 1)] + 2 * env.v[i] + env.v[Math.min(n - 1, i + 1)]) / 4);
  const acc = [];
  const gap = Math.round(0.16 * fps), back = Math.round(0.15 * fps);
  for (let i = 1; i < n - 1; i++) {
    if (!(e[i] >= e[i - 1] && e[i] > e[i + 1] && e[i] > 0.3)) continue;
    const floor = Math.min(...e.slice(Math.max(0, i - back), i));
    if (e[i] - floor < 0.12) continue;
    const s = Math.min(1, 0.7 * e[i] + 0.3 * Math.max(0, p[i] / 3.5) + 0.15 * (e[i] - floor));
    const last = acc[acc.length - 1];
    if (last && i - last.i < gap) { if (s > last.s) acc[acc.length - 1] = { i, s }; continue; }
    acc.push({ i, s });
  }
  return { fps, p, acc: acc.map((a) => ({ t: r3(a.i / fps), s: r3(a.s) })) };
};
