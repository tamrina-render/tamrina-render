// Cue suggestions from the people of a reel (2026-11-08, step 7 of the acting plan): the tracked bodies
// (scripts/mocap.py -> public/mocap/<name>.json) are NOT copied frame by frame (the owner preferred hand cues);
// instead each person's held poses are recognised and turned into OUR hand-made {cues}, at the same moment:
//   both hands on the hips -> hip · arms crossed -> cross · a hand at the face / chin -> chin · a hand raised over
//   the head -> wave · an arm stretched out -> point · head shaken -> no · head nodded -> nod
// A pose counts when it holds >= 0.4 s (a passing hand is not a gesture); one cue per coin per 1.2 s. Only while the
// person stands / sits upright (bent over a dumbbell = nothing). A hand at the face while HE talks = talking hands
// (the acting director's job), so "chin" is only suggested for a listener. Head shakes / nods (--head) are off by
// default: the pose landmarks are too coarse for them (dfr22: one false nod, the real ones missed); the director
// already puts head moves on the words (نعم -> yes, لأ -> shake).
//
// usage: node scripts/suggest-cues.mjs <slug> --map mr=left,b=right [--src mocap/<slug>.json] [--apply] [--head] [--debug]
//   -> videos/<slug>/cues-suggested.md (time · coin · cue · why); --apply writes them into script.json as scene
//      "action" cues (it never touches a scene's hand-written cues of the same body part: arms / head)
// Look at reference/<id>/mocap-sheet.png first: "left" / "right" = the people left to right (scripts/mocap.py).
import fs from "node:fs";
import path from "node:path";
import { die, log, parseArgs, PUBLIC, readJSON, VIDEOS, warn, writeJSON } from "./lib.mjs";

const a = parseArgs(process.argv.slice(2));
const slug = a._[0];
if (!slug || !a.map) die("usage: node scripts/suggest-cues.mjs <slug> --map mr=left,b=right [--src mocap/<slug>.json] [--apply] [--head] [--debug]");
const dir = path.join(VIDEOS, slug), scriptPath = path.join(dir, "script.json");
const script = readJSON(scriptPath);
const tlPath = [path.join(dir, "timeline.json"), path.join(dir, "draft-timeline.json")].find((p) => fs.existsSync(p));
if (!tlPath) die(`no timeline for ${slug}: run node scripts/make.mjs ${slug} --draft (or --no-render) first`);
const tl = readJSON(tlPath);
const src = a.src ?? `mocap/${slug}.json`;
const M = readJSON(path.join(PUBLIC, src));
const map = Object.fromEntries(String(a.map).split(",").map((kv) => kv.split("=")));

const K = (n) => M.keys.indexOf(n);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const median = (v) => { const s = v.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const ARM = new Set(["hip", "cross", "chin", "wave", "point", "shrug", "clap", "facepalm", "think", "count", "thumb", "flex", "watch", "shoo", "sign"]);
const HEAD = new Set(["no", "nod", "stubborn", "eyeroll"]);

/** per clip frame: the pose classes this person shows (null = not seen) */
const classify = (person) => {
  const fr = person.frames;
  const P = (f, n) => ({ x: f[K(n)][0] * M.w, y: f[K(n)][1] * M.h, z: f[K(n)][2], v: f[K(n)][3] });
  const torso = (f) => { const s = P(f, "shL"), r = P(f, "shR"), h = P(f, "hipL"), g = P(f, "hipR"); return { S: { x: (s.x + r.x) / 2, y: (s.y + r.y) / 2 }, H: { x: (h.x + g.x) / 2, y: (h.y + g.y) / 2 } }; };
  const U = median(fr.map((f) => { if (!f) return NaN; const { S, H } = torso(f); return Math.hypot(S.x - H.x, S.y - H.y); }));
  const side = median(fr.map((f) => (f ? Math.abs(P(f, "shL").x - P(f, "shR").x) / U : NaN))) < 0.3;
  const feats = fr.map((f) => {
    if (!f) return null;
    const { S, H } = torso(f);
    const ul = Math.hypot(S.x - H.x, S.y - H.y) || 1, up = { x: (S.x - H.x) / ul, y: (S.y - H.y) / ul }, rt = { x: -up.y, y: up.x };
    const loc = (p) => ({ hx: ((p.x - S.x) * rt.x + (p.y - S.y) * rt.y) / U, hy: -((p.x - S.x) * up.x + (p.y - S.y) * up.y) / U });
    const no = P(f, "nose"), aL = P(f, "earL"), aR = P(f, "earR"), em = { x: (aL.x + aR.x) / 2, y: (aL.y + aR.y) / 2 };
    const arm = (s) => {
      const w = P(f, "wr" + s), e = P(f, "el" + s), sh = P(f, "sh" + s);
      if (w.v < 0.5) return null;
      const W = loc(w), E = loc(e), SH = loc(sh);
      const reach = Math.hypot(W.hx - SH.hx, W.hy - SH.hy), bend = (Math.hypot(E.hx - SH.hx, E.hy - SH.hy) + Math.hypot(W.hx - E.hx, W.hy - E.hy)) / (reach || 1);
      return { ...W, ex: E.hx, ey: E.hy, ev: e.v, reach, straight: bend < 1.12, face: Math.hypot(w.x - no.x, w.y - no.y) / U };
    };
    const upright = Math.abs(Math.atan2(up.x, -up.y)) < 0.7; // torso within 40° of vertical (not bent over a dumbbell)
    return { upright, R: arm("R"), L: arm("L"), yaw: ((no.x - em.x) * rt.x + (no.y - em.y) * rt.y) / U, pitch: -((no.x - em.x) * up.x + (no.y - em.y) * up.y) / U, headOk: no.v > 0.5 };
  });
  const onHip = (h) => !!h && h.hy > 0.3 && h.hy < 1.0 && Math.abs(h.hx) > 0.2 && Math.abs(h.ex) - Math.abs(h.hx) > -0.08 && h.ey < 0.65 && h.ev > 0.5;
  const cls = feats.map((F) => {
    if (!F) return null;
    const c = new Set(), R = F.R, L = F.L;
    if (!F.upright) return c; // bent over: no pose reads
    if (!side && onHip(R) && onHip(L)) c.add("hip");
    if (!side && R && L && Math.abs(R.hx) < 0.35 && Math.abs(L.hx) < 0.35 && R.hy > 0.15 && R.hy < 0.8 && L.hy > 0.15 && L.hy < 0.8 && R.hx > L.hx + 0.05) c.add("cross");
    for (const h of [R, L]) {
      if (!h) continue;
      if (h.face < 0.38) c.add("chin");
      else if (h.hy < -0.55) c.add("wave");
      else if (h.reach > 0.85 && h.straight && h.hy > -0.45 && h.hy < 0.5) c.add("point"); // above the lap (a hand on the knee is not a point)
    }
    return c;
  });
  return { cls, feats, side, U };
};

/** runs of one class held >= 0.4 s (gaps <= 0.15 s bridged) -> [{name, s, e}] in clip seconds */
const runsOf = (cls, name) => {
  const out = [], fps = M.fps, minLen = Math.round(0.4 * fps), gap = Math.round(0.15 * fps);
  let s = -1, lastOn = -99;
  for (let i = 0; i <= cls.length; i++) {
    const on = i < cls.length && !!cls[i]?.has(name);
    if (on) { if (s < 0 || i - lastOn > gap) { if (s >= 0 && lastOn - s + 1 >= minLen) out.push({ name, s: s / fps, e: lastOn / fps }); s = i; } lastOn = i; }
  }
  if (s >= 0 && lastOn - s + 1 >= minLen) out.push({ name, s: s / fps, e: lastOn / fps });
  return out;
};

/** head shake / nod: >= 2 direction changes of >= amp within 1 s */
const headMoves = (feats, key, name, amp) => {
  const out = [], fps = M.fps;
  const v = feats.map((f) => (f?.headOk && f.upright ? f[key] : NaN)); // standing up from a bend is not a nod
  const sm = v.map((_, i) => median(v.slice(Math.max(0, i - 2), i + 3)));
  const ext = [];
  for (let i = 2; i < sm.length - 2; i++) {
    if (!Number.isFinite(sm[i])) continue;
    const win = sm.slice(i - 2, i + 3).filter(Number.isFinite);
    if (sm[i] === Math.max(...win) || sm[i] === Math.min(...win)) { if (!ext.length || i - ext[ext.length - 1].i >= 3) ext.push({ i, v: sm[i] }); }
  }
  for (let k = 0; k + 2 < ext.length; k++) {
    const A = ext[k], B = ext[k + 1], C = ext[k + 2];
    if (C.i - A.i <= fps && Math.abs(B.v - A.v) >= amp && Math.abs(C.v - B.v) >= amp && Math.sign(B.v - A.v) !== Math.sign(C.v - B.v)) { out.push({ name, s: A.i / fps, e: C.i / fps }); k += 2; }
  }
  return out;
};

// clip time -> timeline time (the same scene offsets as scripts/mocap.mjs: an "audio" scene's from - its start)
const offs = tl.scenes.map((sc, i) => { const au = script.scenes?.[i]?.audio; return au && Number.isFinite(au.from) ? au.from - sc.start : null; });
for (let i = 0; i < offs.length; i++) if (offs[i] === null) { const j = [...offs.keys()].filter((k) => offs[k] !== null).sort((x, y) => Math.abs(x - i) - Math.abs(y - i))[0]; offs[i] = j === undefined ? 0 : offs[j]; }
const toTimeline = (ct) => { for (let i = 0; i < tl.scenes.length; i++) { const t = ct - offs[i]; if (t >= tl.scenes[i].start - 1e-3 && t < tl.scenes[i].end) return { t, si: i }; } return null; };

const PRI = { hip: 5, cross: 5, point: 4, wave: 4, chin: 3, no: 6, nod: 5 };
const rows = [];
for (const [id, who] of Object.entries(map)) {
  const pi = who === "left" ? 0 : who === "right" ? M.people.length - 1 : Number(who);
  const person = M.people[pi];
  if (!person) { warn(`no person "${who}" in ${src}`); continue; }
  const { cls, feats, side, U } = classify(person);
  if (a.debug) for (let i = 0; i < cls.length; i += Math.round(M.fps / 2)) console.log(id, (i / M.fps).toFixed(1), cls[i] ? [...cls[i]].join(",") || "-" : "unseen", feats[i]?.R ? `R(${feats[i].R.hx.toFixed(2)},${feats[i].R.hy.toFixed(2)} r${feats[i].R.reach.toFixed(2)})` : "", feats[i]?.L ? `L(${feats[i].L.hx.toFixed(2)},${feats[i].L.hy.toFixed(2)} r${feats[i].L.reach.toFixed(2)})` : "");
  if (a.debug) for (const k of ["yaw", "pitch"]) { const v = feats.map((f) => (f?.headOk ? f[k] : NaN)).filter(Number.isFinite); const d = v.slice(1).map((x, i) => Math.abs(x - v[i])); console.log(id, k, "range", Math.min(...v).toFixed(3), Math.max(...v).toFixed(3), "p95 step", d.sort((x, y) => x - y)[Math.floor(d.length * 0.95)].toFixed(3)); }
  let found = [...["hip", "cross", "chin", "wave", "point"].flatMap((n) => runsOf(cls, n)), ...(a.head ? [...headMoves(feats, "yaw", "no", 0.04), ...headMoves(feats, "pitch", "nod", 0.035)] : [])];
  // a pose that stays on: one cue at its start (the move holds by itself); hip held for long = one hip, not many
  found.sort((x, y) => x.s - y.s || PRI[y.name] - PRI[x.name]);
  const kept = [];
  for (const f of found) {
    const part = HEAD.has(f.name) ? "head" : "arm";
    if (kept.some((k) => (HEAD.has(k.name) ? "head" : "arm") === part && f.s - k.s < 1.2)) continue;
    kept.push(f);
  }
  for (const f of kept) {
    const at = toTimeline(f.s);
    if (!at) continue;
    // a hand at the face while HE talks is talking hands (the acting director does those): "chin" = only a listener thinking
    if (f.name === "chin" && tl.scenes[at.si].speaker === id) continue;
    rows.push({ id, t: at.t, si: at.si, cue: f.name, len: f.e - f.s, why: `${who}: ${f.name} held ${(f.e - f.s).toFixed(1)} s from ${f.s.toFixed(2)} s${side ? " (seen from the side)" : ""}` });
  }
  log(`${id} <- person ${who}${side ? " (side view: only face / raised / pointing / head)" : ""}: ${kept.length} cue(s)`);
}
rows.sort((x, y) => x.t - y.t);
const md = ["# Cue suggestions from the reel's people (" + src + ")", "", "Moves recognised in the original (held >= 0.4 s) -> our hand-made cues at the same moment. Check, then `--apply` (or copy what you want).", "",
  "| time | scene | coin | cue | why |", "|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.t.toFixed(2)} | ${r.si + 1} | ${r.id} | {${r.id}:${r.cue}} | ${r.why} |`), ""].join("\n");
fs.writeFileSync(path.join(dir, "cues-suggested.md"), md, "utf8");
log(`${rows.length} suggestion(s) -> videos/${slug}/cues-suggested.md`);
if (a.apply) {
  let added = 0;
  const before = script.scenes.map((sc) => [...(sc.action ?? [])]); // the hand-written ones (not those added here)
  for (const r of rows) {
    const sc = script.scenes[r.si], sct = tl.scenes[r.si];
    sc.action ??= [];
    const part = HEAD.has(r.cue) ? HEAD : ARM;
    if (before[r.si].some((x) => { const [p, n] = String(x.type).split(":"); return p === r.id && part.has(n); })) continue; // a hand-written one of that body part wins
    sc.action.push({ type: `${r.id}:${r.cue}`, at: Math.round((r.t - sct.start) * 100) / 100 }); added++;
  }
  writeJSON(scriptPath, script);
  log(`applied ${added} cue(s) to videos/${slug}/script.json`);
}
