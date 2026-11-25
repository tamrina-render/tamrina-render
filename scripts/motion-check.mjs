#!/usr/bin/env node
/**
 * Motion check: samples the coin's motion math frame by frame (no rendering) and flags SNAPS: a value that jumps
 * in one frame while the frames around it barely move (a pop the eye may miss). Checks hands (position, angle,
 * depth), body (position, turn, tilt, crouch, legs) and the face values of the moods.
 *
 *   node scripts/motion-check.mjs <slug>          (uses videos/<slug>/timeline.json, else draft-timeline.json)
 *
 * Intended pops are listed as "expected" (the camera flash, poof, scene changes of place are smooth flights).
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
// --trace <from> <to>: print the hands every frame in that window (debugging)
const ti = process.argv.indexOf("--trace");
const TRACE = ti > 0 ? [Number(process.argv[ti + 1]), Number(process.argv[ti + 2])] : null;
if (!slug) { console.error("usage: node scripts/motion-check.mjs <slug>"); process.exit(1); }
const dir = path.join(ROOT, "videos", slug);
// --tl <file>: check another timeline of this video (e.g. peek-timeline.json, so a test never touches the real one)
const tlArg = process.argv.indexOf("--tl");
const tlFile = tlArg > 0 ? path.resolve(dir, process.argv[tlArg + 1]) : ["timeline.json", "draft-timeline.json"].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
if (!tlFile) { console.error(`no timeline in ${dir} (run make.mjs first)`); process.exit(1); }
const tl = JSON.parse(fs.readFileSync(tlFile, "utf8"));

// bundle the pure motion functions for node
const out = path.join(ROOT, "node_modules", ".cache", `motion-probe-${process.pid}.mjs`); // inside the repo so its packages resolve
fs.mkdirSync(path.dirname(out), { recursive: true });
const res = await build({
  stdin: { contents: `export { __probe } from "./components/Coin3D"; export { coinPose } from "./components/CoinPresenter";`, resolveDir: path.join(ROOT, "src"), loader: "ts" },
  bundle: true, platform: "node", format: "esm", packages: "external", write: false, logLevel: "silent",
});
fs.writeFileSync(out, res.outputFiles[0].text);
const { __probe, coinPose } = await import(pathToFileURL(out).href);
fs.rmSync(out, { force: true });
const { rigState, composeHands, planHands, viewFor } = __probe;

const cfg = tl.presenter ?? {};
const fps = tl.fps ?? 30;
const cast = cfg.cast?.length ? cfg.cast : [cfg.name === "mrs" ? "mrs" : "mr"];
const duo = cast.length > 1;
const N = Math.floor(tl.durationSec * fps);

// face values that live on a bigger scale than 0..1
const MAXF = { brow: 10, browTilt: 10, look: 10, tilt: 10 };
// signal kind -> threshold per frame for a "big" change]
const LIMIT = { hand: 14, ang: 22, z: 0.12, body: 0.05, rot: 0.06, leg: 0.05, face: 0.25, squash: 0.35, ball: 45, eye: 4, cam: 12, zoom: 0.02 }; // ball: px per frame (a shot is fast, a teleport is not); eye: pupil px (an idle dart is a quick saccade, under 4 px); cam: window px; zoom: scale
const issues = [];
// every coin as the render builds it (single, duo, or a cast of copies with their own configs)
const members = __probe.castOf ? __probe.castOf(tl, cfg) : cast.map((who) => ({ who, duo, c: { ...cfg, name: who }, enterAt: duo ? tl.scenes.find((sc) => sc.speaker === who)?.start ?? 0 : 0 }));
for (const { who, c, enterAt, duo } of members) {
  const view = viewFor(tl, who, duo, __probe.kindFor ? __probe.kindFor(who, c) : undefined);
  const plan = view.acting?.[c.id ?? who]?.gestures ?? planHands(view); // the acting director plans the gestures when it ran
  const series = {}; // name -> { kind, v: [] }
  const put = (name, kind, v) => ((series[name] ??= { kind, v: [] }).v.push(v));
  for (let i = 0; i <= N; i++) {
    const t = i / fps;
    // the rig as rendered: rigState + the life layer (lean, stretch, trailing hands, landing ring-out, effort)
    const { P, S } = __probe.liveRig ? __probe.liveRig(tl, view, t, who, duo, c, fps, enterAt) : (() => { const P = coinPose(view, t, fps, c); return { P, S: rigState(tl, view, t, who, duo, c, P, enterAt) }; })();
    const H = composeHands(view, plan, t, P.F, who, S, c);
    if (TRACE && t >= TRACE[0] && t <= TRACE[1]) console.log(`trace F.o=${P.F.o.toFixed(2)} eyeY=${P.F.eyeY.toFixed(2)} mood=${P.curMood} ${t.toFixed(3)} ${who} L ${JSON.stringify(H.L)} R ${JSON.stringify(H.R)} nat=${JSON.stringify(__probe.naturalHands(view, plan, t, P.F, who).L)} active=${JSON.stringify(plan.filter((q) => t >= q.t && t < q.t + q.dur + 0.4))} act=${S.act} handsW=${S.handsW.toFixed(2)} hands=${JSON.stringify(S.hands)}`);
    for (const side of ["L", "R"]) {
      put(`hand${side}.x`, "hand", H[side].x); put(`hand${side}.y`, "hand", H[side].y);
      put(`hand${side}.angle`, "ang", H[side].a); put(`hand${side}.z`, "z", H[side].z);
      const lp = S.legs?.[side];
      put(`leg${side}.foot`, "leg", lp ? S.legW * Math.hypot(...lp.f) : 0);
    }
    // the ball (one per video): checked once, with the first coin
    if (who === members[0].who && __probe.ballAt && tl.ball) { const b = __probe.ballAt(tl, t); if (b) { put("ball.x", "ball", b.x); put("ball.y", "ball", b.y); put("ball.size", "ball", b.r); } }
    // the scene camera (cast videos): checked once, with the first coin. A "seam": "cut" scene cuts on purpose
    if (who === members[0].who && __probe.cameraAt) { const k = __probe.cameraAt(tl, t); if (k) { put("camera.x", "cam", k.u); put("camera.y", "cam", k.v); put("camera.zoom", "zoom", k.s); } }
    put("eyes.x", "eye", S.gaze ? S.gaze.x : P.dart); put("eyes.y", "eye", S.gaze ? S.gaze.y : 0);
    put("body.stretchX", "squash", S.sx); put("body.stretchY", "squash", S.sy); // squash / stretch. Take-off (squash -> stretch) and impact (stretch -> squash) are one-frame contact changes on purpose, so only an absurd one is flagged
    put("body.x", "body", S.X); put("body.y", "body", S.Y); put("body.size", "body", S.size * S.vis);
    put("body.turn", "rot", S.yaw); put("body.pitch", "rot", S.rx); put("body.tilt", "rot", S.rz);
    put("body.crouch", "leg", S.crouch); put("body.spread", "leg", S.spread); put("body.knee", "leg", S.knee); put("body.sit", "leg", S.sit); put("body.tuck", "leg", S.tuck);
    put("hands.weight", "face", S.handsW);
    for (const [k, v] of Object.entries(P.F)) if (typeof v === "number" && !["o", "rest", "mouthW", "pupil"].includes(k)) put(`face.${k}`, "face", v / (Math.abs(MAXF[k] ?? 1) || 1));
  }
  for (const [name, { kind, v }] of Object.entries(series)) {
    const d = v.slice(1).map((x, i) => { const r = Math.abs(x - v[i]); if (kind === "ang") return Math.min(r % 360, 360 - (r % 360)); if (kind === "rot") { const k = r % (2 * Math.PI); return Math.min(k, 2 * Math.PI - k); } return r; }); // 350° -> 10° is a 20° turn
    for (let i = 0; i < d.length; i++) {
      if (d[i] < LIMIT[kind]) continue;
      const around = [...d.slice(Math.max(0, i - 3), i), ...d.slice(i + 1, i + 4)].sort((a, b) => a - b);
      const usual = around[Math.floor(around.length / 2)] ?? 0;
      if (d[i] > 4 * Math.max(usual, LIMIT[kind] / 8)) issues.push({ who, t: (i + 1) / fps, name, jump: d[i], usual });
    }
  }
}

const sceneAt = (t) => tl.scenes.find((s) => t >= s.start && t < s.end);
const cueNear = (sc, t) => (sc?.cues ?? []).filter((q) => q.t <= t + 0.05).map((q) => `{${q.name}} +${(t - q.t).toFixed(2)}s`).pop() ?? "";
if (!issues.length) console.log(`motion check ${slug}: no snaps in ${N} frames (${cast.map((m) => (typeof m === "object" ? m.id : m)).join(" + ")})`);
else {
  console.log(`motion check ${slug}: ${issues.length} snap(s)`);
  for (const x of issues) {
    const sc = sceneAt(x.t);
    console.log(`  ${x.t.toFixed(2)}s ${x.who} ${x.name.padEnd(14)} jumped ${x.jump.toFixed(2)} (usual ${x.usual.toFixed(2)})  scene "${sc?.label ?? "?"}" ${cueNear(sc, x.t)}`);
  }
}
