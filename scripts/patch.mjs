// Patch render: a small fix re-renders only the scenes that changed and swaps them into the existing mp4.
// Used by make.mjs (automatic; --full forces a whole render). A line changed near the end (the timing moved only from
// scene k on) = a tail patch: the old frames before scene k stay, the rest + the whole sound are rendered again.
// Falls back to a whole render (returns null) when: the timing moved from the first scene, something video-wide changed (presenter, ball,
// theme, voice...), the engine (src/) changed after the old mp4 was made, or the old mp4 is a different size.
import fs from "node:fs";
import path from "node:path";
import { exists, ROOT, run, runOk, warn } from "./lib.mjs";
import { renderTimeline } from "./render.mjs";

const PAD_IN = 0.5;  // s rendered before a changed scene (the seam into it)
const PAD_OUT = 1.5; // s rendered into the next scene (flights / glides / camera moves that start from this scene)

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** newest modification time of the engine (src/), ms */
const engineTime = () => {
  let t = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else t = Math.max(t, fs.statSync(p).mtimeMs);
    }
  };
  walk(path.join(ROOT, "src"));
  return t;
};

const probe = (file) => {
  const r = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=width,height,nb_read_packets", "-of", "csv=p=0", file], { capture: true, quiet: true });
  const [w, h, n] = String(r.stdout).trim().split(",").map(Number);
  const a = run("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file], { capture: true, quiet: true });
  return { w, h, frames: n, audio: String(a.stdout).trim() !== "" };
};

/** why this can't be a patch (string), or the frame ranges [a, b] (inclusive) to re-render */
export const planPatch = (oldTl, newTl, oldMp4, scale = 1) => {
  if (!oldTl || !exists(oldMp4)) return "no earlier render";
  if (fs.statSync(oldMp4).mtimeMs < engineTime()) return "the engine (src/) changed after the last render";
  const fps = newTl.fps, total = Math.max(30, Math.ceil(newTl.durationSec * fps)); // same as Root.tsx durationInFrames
  // tail patch: the timing moved only from scene k on (a line changed near the end) -> keep the old frames before it,
  // render from just before scene k to the end, rebuild the whole sound track (the voice changed)
  const k = newTl.scenes.findIndex((n, i) => !oldTl.scenes[i] || oldTl.scenes[i].start !== n.start || oldTl.scenes[i].end !== n.end);
  const tailT = k > 0 ? Math.max(0, newTl.scenes[k].start - PAD_IN) : null;
  const before = (list) => (list ?? []).filter((c) => c.t < tailT);
  const keys = new Set([...Object.keys(oldTl), ...Object.keys(newTl)]);
  for (const x of ["scenes", "events", "sfx", ...(tailT != null ? ["durationSec", "mouth", "env"] : [])]) keys.delete(x);
  const noStamp = (m) => (m ? { ...m, builtAt: undefined, ...(tailT != null ? { narration: undefined } : {}) } : m); // meta.builtAt changes on every build
  const wide = [...keys].filter((x) => (x === "meta" ? !same(noStamp(oldTl[x]), noStamp(newTl[x])) : !same(oldTl[x], newTl[x])));
  if (wide.length) return `video-wide change (${wide.join(", ")})`;
  if (k === 0) return "the timing moved from the first scene";
  if (tailT != null && !same(before(oldTl.mouth), before(newTl.mouth))) return `the voice changed before scene ${newTl.scenes[k].id}`;
  if (tailT == null && oldTl.scenes.length !== newTl.scenes.length) return "scenes added or removed";
  const v = probe(oldMp4);
  const oldTotal = Math.max(30, Math.ceil(oldTl.durationSec * fps));
  if (v.w !== Math.round(newTl.width * scale) || v.frames !== (tailT != null ? oldTotal : total)) return `the old mp4 is ${v.w}px / ${v.frames} frames, expected ${Math.round(newTl.width * scale)}px / ${tailT != null ? oldTotal : total}`;
  const changed = [];
  for (let i = 0; i < (tailT != null ? k : newTl.scenes.length); i++) if (!same(oldTl.scenes[i], newTl.scenes[i])) changed.push(i);
  if (tailT != null) {
    if (!same(before(oldTl.events), before(newTl.events))) return "the global fix events changed";
    const ranges = [];
    for (const i of changed) ranges.push([Math.max(0, Math.floor((newTl.scenes[i].start - PAD_IN) * fps)), Math.ceil((newTl.scenes[i + 1].start + PAD_OUT) * fps)]);
    ranges.push([Math.floor(tailT * fps), total - 1]);
    const merged = [];
    for (const [a, b] of ranges) { const l = merged[merged.length - 1]; if (l && a <= l[1] + 1) l[1] = Math.max(l[1], b); else merged.push([a, b]); }
    return { ranges: merged, changed: [...changed, ...newTl.scenes.slice(k).map((_, j) => k + j)], total, audio: v.audio, soundChanged: true };
  }
  if (!changed.length && same(oldTl.events, newTl.events)) return { ranges: [], changed, total, audio: v.audio };
  const ranges = [];
  for (const i of changed) {
    const sc = newTl.scenes[i], next = newTl.scenes[i + 1];
    const a = Math.max(0, Math.floor((sc.start - PAD_IN) * fps));
    const b = Math.min(total - 1, Math.ceil(((next ? next.start : newTl.durationSec) + PAD_OUT) * fps));
    const last = ranges[ranges.length - 1];
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else ranges.push([a, b]);
  }
  if (!same(oldTl.events, newTl.events)) return "the global fix events changed";
  return { ranges, changed, total, audio: v.audio };
};

/**
 * Re-render plan.ranges of tlPath and splice them into oldMp4 -> outMp4 (video re-encoded once, same settings as a render).
 * Sound: the old mp4's track, unless the sound effects changed -> the whole track is rendered again (audio only, fast).
 */
export const applyPatch = (plan, tlPath, oldMp4, outMp4, { scale, soundChanged = false, quiet = true } = {}) => {
  const tmp = path.join(path.dirname(outMp4), `_patch${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  try {
    const segs = plan.ranges.map(([a, b], k) => renderTimeline(tlPath, path.join(tmp, `seg${k}.mp4`), { frames: `${a}-${b}`, scale, quiet }));
    let audio = null;
    if (soundChanged && plan.audio) {
      audio = path.join(tmp, "sound.m4a");
      runOk(process.execPath, [path.join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js"), "render", "src/index.ts", "Reel", audio, `--props=${tlPath}`, "--log=error", "--codec=aac", "--audio-bitrate=192k"], { cwd: ROOT, quiet });
    }
    // pieces in order: old [cursor, a) · new seg · ... · old [cursor, total)
    const pieces = []; let cur = 0;
    plan.ranges.forEach(([a, b], k) => { if (a > cur) pieces.push({ old: [cur, a] }); pieces.push({ seg: k + 1 }); cur = b + 1; });
    if (cur < plan.total) pieces.push({ old: [cur, plan.total] });
    const olds = pieces.filter((p) => p.old);
    const f = [];
    if (olds.length) f.push(`[0:v]split=${olds.length}${olds.map((_, i) => `[o${i}]`).join("")}`);
    let oi = 0;
    const labels = pieces.map((p, i) => {
      if (p.old) { f.push(`[o${oi++}]trim=start_frame=${p.old[0]}:end_frame=${p.old[1]},setpts=PTS-STARTPTS[p${i}]`); }
      else f.push(`[${p.seg}:v]setpts=PTS-STARTPTS[p${i}]`);
      return `[p${i}]`;
    });
    f.push(`${labels.join("")}concat=n=${pieces.length}:v=1:a=0[v]`);
    const inputs = [oldMp4, ...segs, ...(audio ? [audio] : [])].flatMap((x) => ["-i", x]);
    const amap = audio ? ["-map", `${segs.length + 1}:a`] : plan.audio ? ["-map", "0:a"] : [];
    const out = path.join(tmp, "patched.mp4");
    runOk("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", f.join(";"), "-map", "[v]", ...amap,
      "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", audio ? "aac" : "copy", ...(audio ? ["-b:a", "192k"] : []), "-movflags", "+faststart", out], { quiet: true });
    try { fs.rmSync(outMp4, { force: true }); fs.renameSync(out, outMp4); return outMp4; }
    catch { // open in a video player (Windows locks it): keep the patched one next to it, like make's renderSafe
      const alt = outMp4.replace(/\.mp4$/, `-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}.mp4`);
      fs.renameSync(out, alt);
      warn(`${path.basename(outMp4)} is open somewhere (locked) -> saved the patched video as ${path.basename(alt)}`);
      return alt;
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

/** log line for a plan */
export const describePatch = (plan, tl) => {
  const secs = plan.ranges.reduce((n, [a, b]) => n + (b - a + 1), 0) / tl.fps;
  return `patch: scene(s) ${plan.changed.map((i) => tl.scenes[i].id).join(", ")} changed -> re-rendering ${secs.toFixed(1)}s of ${tl.durationSec}s (${plan.ranges.map(([a, b]) => `${(a / tl.fps).toFixed(1)}–${((b + 1) / tl.fps).toFixed(1)}s`).join(", ")})`;
};
