// Self-scoring: measures motion per 0.1 s with ffmpeg (frame difference), finds FLAT runs > 1.2 s,
// and produces a 0-10 motion score. make.mjs uses the flats to inject whip pans / zoom kicks and re-render.
import { parseArgs, r3, run, writeJSON } from "./lib.mjs";

// Calibrated 2026-10-25: a frame with only the paper dot-drift measures ≈0.45–0.55 (1.1 s window);
// the quietest real moment of the demos measures ≈1.2. Threshold sits between.
export const FLAT_THRESHOLD = 0.8;    // windowed mean |Δluma| (0-255) between consecutive 10 fps frames
export const FLAT_WINDOW = 5;         // ±5 samples = 1.1 s moving mean (kills the alternating dot-drift spikes)
export const MAX_STILL = 1.2;          // seconds
export const MIN_SCORE = 4.8;
// calm profile (Tamrina: readable pacing, ~5% overshoot) moves less on purpose; it still must never sit still > 1.2 s
export const MIN_SCORE_CALM = 3.5;
export const minScore = (motion) => (motion === "calm" ? MIN_SCORE_CALM : MIN_SCORE);

export const analyze = (mp4) => {
  const vf = "fps=10,scale=540:-1,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-";
  const r = run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", mp4, "-vf", vf, "-an", "-f", "null", "-"], { capture: true, quiet: true });
  const txt = String(r.stdout) + String(r.stderr);
  const samples = [];
  let t = null;
  for (const line of txt.split(/\r?\n/)) {
    const mt = line.match(/pts_time:([\d.]+)/);
    if (mt) { t = parseFloat(mt[1]); continue; }
    const mv = line.match(/YAVG=([\d.]+)/);
    if (mv && t !== null) { samples.push({ t, v: parseFloat(mv[1]) }); t = null; }
  }
  if (samples.length < 3) return { ok: false, error: "no samples (is the file a video?)", samples: [] };
  // first sample is the frame blended with itself -> drop
  const s = samples.slice(1);
  const total = s[s.length - 1].t - s[0].t + 0.1;
  const mean = s.reduce((a, b) => a + b.v, 0) / s.length;
  // flat runs (on a moving-window mean so single-frame texture spikes cannot hide a still moment)
  const smooth = s.map((_, i) => {
    const a = s.slice(Math.max(0, i - FLAT_WINDOW), i + FLAT_WINDOW + 1);
    return a.reduce((p, q) => p + q.v, 0) / a.length;
  });
  const flats = [];
  let runStart = null;
  for (let i = 0; i < s.length; i++) {
    const flat = smooth[i] < FLAT_THRESHOLD;
    if (flat && runStart === null) runStart = s[i].t;
    if ((!flat || i === s.length - 1) && runStart !== null) {
      const end = flat ? s[i].t + 0.1 : s[i].t;
      if (end - runStart >= MAX_STILL) flats.push({ start: r3(runStart), end: r3(end), dur: r3(end - runStart) });
      runStart = null;
    }
  }
  const flatTime = flats.reduce((a, f) => a + f.dur, 0);
  // events per second: count local peaks above 2x mean
  let peaks = 0;
  for (let i = 1; i < s.length - 1; i++) if (s[i].v > s[i - 1].v && s[i].v >= s[i + 1].v && s[i].v > mean * 1.8) peaks++;
  const eventsPerSec = peaks / total;
  const stillPenalty = 1 - Math.min(1, flatTime / total) * 1.6;
  const energy = Math.min(1, mean / 3.5);
  const rhythm = Math.min(1, eventsPerSec / 1.2);
  const score = r3(Math.max(0, Math.min(10, 10 * Math.max(0, stillPenalty) * (0.45 + 0.3 * energy + 0.25 * rhythm))));
  return { ok: true, score, mean: r3(mean), eventsPerSec: r3(eventsPerSec), flatTime: r3(flatTime), total: r3(total), flats, samples: s.map((x) => ({ t: r3(x.t), v: r3(x.v) })) };
};

if (process.argv[1] && process.argv[1].endsWith("score.mjs")) {
  const a = parseArgs(process.argv.slice(2));
  const mp4 = a._[0];
  if (!mp4) { console.log("usage: node scripts/score.mjs out.mp4 [--json score.json]"); process.exit(1); }
  const res = analyze(mp4);
  if (a.json) writeJSON(a.json, res);
  const { samples, ...rest } = res;
  console.log(JSON.stringify(rest, null, 2));
  if (res.ok) console.log(res.score >= MIN_SCORE ? `PASS (score ${res.score} >= ${MIN_SCORE})` : `LOW (score ${res.score} < ${MIN_SCORE}) -> ${res.flats.length} flat moment(s)`);
}
