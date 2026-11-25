// Mocap retarget (phase 2 of the human motion, 2026-11-08): a person's body in a video -> the coin's hands, head
// and body, per timeline frame. Input = scripts/mocap.py JSON (public/mocap/<name>.json); output = tl.mocap[coin id]
// that the renderer only interpolates (src/lib/mocap.ts), so motion-check samples exactly what renders.
// Cast field: "mocap": { "src": "mocap/<name>.json", "person": "left" | "right" | 0 | 1, "offset": 0 }
// Time: clip time = timeline time + the scene's offset (an "audio" scene: audio.from - scene start; a scene without
// audio keeps the nearest one's), so a remake on the original sound lines up by itself. "offset" adds to it.
// Frame layout (src/lib/mocap.ts reads it): [Lx,Ly,La,Lz,Lfist,wL, Rx,Ry,Ra,Rz,Rfist,wR, roll,yaw,pitch,wHead, lean,bob,wBody, wRollYaw]
// Mapping (numbers in guides/motion.md "Mocap"): torso axes, unit U = shoulder-mid -> hip-mid (median over the clip,
// survives a person in profile), no mirroring: the person's right hand -> the coin's image-left hand (L), as if the
// coin were that person facing the camera. Head / lean / bob are offsets from the person's own median pose.
import fs from "node:fs";
import path from "node:path";
import { PUBLIC, r3, warn } from "./lib.mjs";

const K = (keys, n) => keys.indexOf(n);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const median = (a) => { const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const sstep = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };

/** one clip frame of one person -> raw coin values (null = not seen) */
export const retargetFrame = (f, keys, W, H, U, side3q = false) => { // side3q = the person is seen from the side (narrow shoulders)
  if (!f) return null;
  const P = (n) => { const v = f[K(keys, n)]; return { x: v[0] * W, y: v[1] * H, z: v[2], v: v[3] }; };
  const shL = P("shL"), shR = P("shR"), hpL = P("hipL"), hpR = P("hipR");
  const S = { x: (shL.x + shR.x) / 2, y: (shL.y + shR.y) / 2 }, Hp = { x: (hpL.x + hpR.x) / 2, y: (hpL.y + hpR.y) / 2 };
  const ul = Math.hypot(S.x - Hp.x, S.y - Hp.y) || 1;
  const up = { x: (S.x - Hp.x) / ul, y: (S.y - Hp.y) / ul }, right = { x: -up.y, y: up.x };
  const loc = (p) => ({ hx: ((p.x - S.x) * right.x + (p.y - S.y) * right.y) / U, hy: -((p.x - S.x) * up.x + (p.y - S.y) * up.y) / U });
  const hand = (side) => { // side = the PERSON's side (R -> coin L, on the image left)
    const cs = side === "R" ? -1 : 1; // the coin hand's side: -1 = image left (L), +1 = image right (R)
    const wr = P("wr" + side), ix = P("in" + side), pk = P("pi" + side), sh = P("sh" + side), el = P("el" + side);
    if (wr.v < 0.5) return null;
    const { hx, hy } = loc(wr);
    const tip = { x: (ix.x + pk.x) / 2, y: (ix.y + pk.y) / 2 };
    const dx = (tip.x - wr.x) * right.x + (tip.y - wr.y) * right.y, dy = -((tip.x - wr.x) * up.x + (tip.y - wr.y) * up.y);
    const a = (Math.atan2(dx, dy) * 180) / Math.PI; // clockwise from up
    const inside = sstep(0.45, 0.25, Math.abs(hx)) * sstep(1.25, 1.0, hy) * sstep(-0.9, -0.6, hy);
    const front = clamp((sh.z - wr.z) * 1.6, 0, 1);
    // hands on the hips / waist: the wrist at waist height with the ELBOW sticking out past it (a hanging arm has
    // the elbow in line or inside), so the two never mix
    // (only for someone facing the camera: from the side "elbow out" is just an arm reaching forward)
    const { hx: elx, hy: ely } = loc(el);
    const onHip = side3q || el.v < 0.5 ? 0 : sstep(0.3, 0.4, hy) * sstep(1.0, 0.9, hy) * sstep(0.2, 0.3, Math.abs(hx))
      * sstep(-0.08, 0.0, Math.abs(elx) - Math.abs(hx)) * sstep(0.65, 0.55, ely);
    // the coin is a disc: wide at the shoulders, narrow at the "hips", arms hanging lower than a person's.
    // y: shoulder (hy 0) -> 264, hip (hy 1) -> 302 (the coin's own {hip} pose), face (hy -0.55) -> ~200, hanging (1.15) -> ~356
    const y = hy <= 0 ? 264 + 120 * hy : hy <= 1 ? 264 + 38 * hy : 302 + 360 * (hy - 1);
    // x: px per U shrinks from the shoulders (400) to the hips (210), then widens again for hanging arms
    const sc = hy <= 0 ? 400 : hy <= 1 ? 400 - 190 * hy : 210 + 600 * Math.min(0.3, hy - 1);
    // from the side both hands point the way he faces: each hand stays on its own side of the coin's chest
    // (x 145 / 235) and reaching forward brings it toward the camera (z, below) instead of across the coin
    let x = side3q ? 190 + cs * 45 + clamp(hx * 60, -40, 40) : 190 + sc * hx, yy = y, aa = a;
    // hands on the hips: the coin's exact {hip} pose (x 96 / 284, y 302, knuckles in), so it reads as the same pose
    if (onHip > 0) { const hx0 = hx < 0 ? 96 : 284; x += (hx0 - x) * onHip; yy += (302 - yy) * onHip; aa += ((hx < 0 ? 150 : -150) - aa) * onHip; }
    const z = 0.16 + 0.42 * Math.max(inside, front, side3q ? sstep(0.05, 0.4, Math.abs(hx)) : 0);
    // never in front of the face (the lip sync and the eyes must stay seen; a turned coin swings a front hand over it):
    // a hand in front of the body comes down to the chest (y >= 305) unless it is up over the head (y < 130),
    // eased by height (130-170) and depth so it never jumps
    yy += (Math.max(yy, 305) - yy) * sstep(130, 170, yy) * sstep(0.28, 0.4, z);
    return { x: clamp(x, -60, 440), y: clamp(yy, 90, 420), a: aa, z, fist: onHip };
  };
  const eL = P("eyeL"), eR = P("eyeR"), aL = P("earL"), aR = P("earR"), no = P("nose");
  const headOk = Math.min(no.v, Math.max(eL.v, eR.v)) > 0.5;
  // a face in profile (eyes nearly on top of each other) has no usable eye line / ear balance: only the nod,
  // from the ear -> nose angle (degrees, + = looking down); roll and yaw stay the coin's own
  const profile = side3q || Math.hypot(eL.x - eR.x, eL.y - eR.y) / U < 0.06;
  const em = { x: (aL.x + aR.x) / 2, y: (aL.y + aR.y) / 2 };
  const ear = aL.v > aR.v ? aL : aR;
  // person's right eye is on the image left when facing the camera: eye line from image-left to image-right
  const roll = headOk && !profile ? (Math.atan2(eL.y - eR.y, eL.x - eR.x) * 180) / Math.PI : null;
  const yaw = headOk && !profile ? ((no.x - em.x) * right.x + (no.y - em.y) * right.y) / U : null;
  const pitch = !headOk ? null : profile ? (Math.atan2(no.y - ear.y, Math.abs(no.x - ear.x)) * 180) / Math.PI / 4 / 40
    : -((no.x - em.x) * up.x + (no.y - em.y) * up.y) / U;
  const lean = (Math.atan2(up.x, -up.y) * 180) / Math.PI;
  const rise = -((S.x) * up.x + (S.y) * up.y) / U; // shoulder height along the torso axis (U units)
  return { L: hand("R"), R: hand("L"), roll, yaw, pitch, lean, rise };
};

/** Build tl.mocap for every cast coin with a "mocap" field. Returns null when none. */
export const buildMocap = (tl, script) => {
  const cast = (script.cast ?? tl.presenter?.cast ?? []).filter((c) => typeof c === "object" && c.mocap);
  if (!cast.length) return null;
  const fps = tl.fps ?? 30, N = Math.ceil(tl.durationSec * fps) + 1;
  // scene offsets (clip time - timeline time)
  const offs = tl.scenes.map((sc, i) => { const au = script.scenes?.[i]?.audio; return au && Number.isFinite(au.from) ? au.from - sc.start : null; });
  for (let i = 0; i < offs.length; i++) if (offs[i] === null) { const j = [...offs.keys()].filter((k) => offs[k] !== null).sort((a, b) => Math.abs(a - i) - Math.abs(b - i))[0]; offs[i] = j === undefined ? 0 : offs[j]; }
  const out = {};
  for (const c of cast) {
    const file = path.join(PUBLIC, c.mocap.src);
    if (!fs.existsSync(file)) { warn(`mocap: ${c.mocap.src} not found (run scripts/mocap.py) -> ${c.id} moves by itself`); continue; }
    const M = JSON.parse(fs.readFileSync(file, "utf8"));
    const who = c.mocap.person ?? 0;
    const pi = who === "left" ? 0 : who === "right" ? M.people.length - 1 : Number(who);
    const person = M.people[pi];
    if (!person) { warn(`mocap: no person ${who} in ${c.mocap.src}`); continue; }
    // the person's own size: median torso length
    const kk = M.keys;
    const U = median(person.frames.map((f) => { if (!f) return NaN; const g = (n) => f[K(kk, n)]; return Math.hypot(((g("shL")[0] + g("shR")[0]) - (g("hipL")[0] + g("hipR")[0])) / 2 * M.w, ((g("shL")[1] + g("shR")[1]) - (g("hipL")[1] + g("hipR")[1])) / 2 * M.h); }));
    // seen from the side = shoulders narrower than 0.3 U in the picture (median over the clip; a person facing the camera ~0.6)
    const shw = median(person.frames.map((f) => (f ? Math.abs(f[K(kk, "shL")][0] - f[K(kk, "shR")][0]) * M.w / U : NaN)));
    const side3q = shw < 0.3;
    const raw = person.frames.map((f) => retargetFrame(f, kk, M.w, M.h, U, side3q));
    const med = (k) => median(raw.map((r) => r?.[k]));
    const base = { roll: med("roll"), yaw: med("yaw"), pitch: med("pitch"), lean: med("lean"), rise: med("rise") };
    // channels per CLIP frame (NaN = unseen)
    const ch = {};
    const put = (k, i, v) => ((ch[k] ??= new Array(raw.length).fill(NaN))[i] = v ?? NaN);
    raw.forEach((r, i) => {
      for (const s of ["L", "R"]) { const h = r?.[s]; put(s + "x", i, h?.x); put(s + "y", i, h?.y); put(s + "a", i, h?.a); put(s + "z", i, h?.z); put(s + "f", i, h?.fist); }
      put("roll", i, r?.roll == null ? null : clamp(r.roll - base.roll, -14, 14));
      put("yaw", i, r?.yaw == null ? null : clamp((r.yaw - base.yaw) * 1.6, -0.4, 0.4));
      put("pitch", i, r?.pitch == null ? null : clamp((r.pitch - base.pitch) * 40, -4, 4));
      put("lean", i, r ? clamp(r.lean - base.lean, -12, 12) : null);
      put("bob", i, r ? clamp(-(r.rise - base.rise) * 80, -25, 25) : null);
    });
    // fill gaps <= 0.3 s (linear), unwrap angles, then a 5-frame median + 5-frame mean
    const gapMax = Math.round(0.3 * M.fps);
    const seen = {};
    for (const [k, a] of Object.entries(ch)) {
      if (k.endsWith("a")) for (let i = 1; i < a.length; i++) { // unwrap hand angles (no 359 -> 1 jumps)
        if (!Number.isFinite(a[i])) continue;
        let j = i - 1; while (j >= 0 && !Number.isFinite(a[j])) j--;
        if (j < 0) continue;
        while (a[i] - a[j] > 180) a[i] -= 360;
        while (a[i] - a[j] < -180) a[i] += 360;
      }
      seen[k] = a.map(Number.isFinite);
      for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) {
        let j = i; while (j < a.length && !Number.isFinite(a[j])) j++;
        const p = i - 1;
        if (p >= 0 && j < a.length && j - i <= gapMax) for (let q = i; q < j; q++) { a[q] = a[p] + ((a[j] - a[p]) * (q - p)) / (j - p); seen[k][q] = true; }
        i = j;
      }
      // hand angles come from the finger landmarks, the noisiest ones: a wider window (9 frames) for them
      const h = k.endsWith("a") ? 4 : 2;
      const m5 = a.map((_, i) => { const w = a.slice(Math.max(0, i - h), i + h + 1).filter(Number.isFinite).sort((x, y) => x - y); return w.length ? w[Math.floor(w.length / 2)] : NaN; });
      ch[k] = m5.map((v, i) => { if (!Number.isFinite(v)) return NaN; const w = m5.slice(Math.max(0, i - h), i + h + 1).filter(Number.isFinite); return w.reduce((x, y) => x + y, 0) / w.length; });
    }
    // per-hand / head weight: 1 when seen, eased 0.25 s in and out around unseen stretches
    const weight = (k) => { // distance (frames) to the nearest unseen frame, eased over 0.25 s; the clip edges don't count
      const s = seen[k], ease = Math.round(0.25 * M.fps);
      return s.map((ok, i) => { if (!ok) return 0; let d = 1; while (d < ease && (i - d < 0 || s[i - d]) && (i + d >= s.length || s[i + d])) d++; return d / ease; });
    };
    const wL = weight("Lx"), wR = weight("Rx"), wH = weight("pitch"), wRY = weight("roll"), wB = weight("lean");
    const at = (arr, ct) => { const x = ct * M.fps, i = Math.floor(x); if (i < 0 || i >= arr.length - 1) return arr[clamp(i, 0, arr.length - 1)]; const a = arr[i], b = arr[i + 1]; return !Number.isFinite(a) ? b : !Number.isFinite(b) ? a : a + (b - a) * (x - i); };
    const frames = [];
    for (let i = 0; i < N; i++) {
      const t = i / fps;
      const si = Math.max(0, tl.scenes.findIndex((sc) => t >= sc.start && t < sc.end));
      // outside the clip: hold its first / last pose (the video can run a few frames longer than the clip)
      const ct = clamp(t + (offs[si] ?? 0) + (c.mocap.offset ?? 0), 0, (M.n - 1) / M.fps);
      const inClip = true;
      const v = (k) => { const x = at(ch[k], ct); return Number.isFinite(x) ? r3(x) : 0; };
      const w = (arr) => (inClip ? r3(at(arr, ct) ?? 0) : 0);
      frames.push([v("Lx"), v("Ly"), v("La"), v("Lz"), v("Lf"), w(wL), v("Rx"), v("Ry"), v("Ra"), v("Rz"), v("Rf"), w(wR), v("roll"), v("yaw"), v("pitch"), w(wH), v("lean"), v("bob"), w(wB), w(wRY)]);
    }
    out[c.id] = { fps, f: frames };
    const cov = (a) => Math.round((100 * a.filter((x) => x > 0.5).length) / a.length);
    console.log(`[reel] mocap ${c.id} <- ${c.mocap.src} person ${who}: hands ${cov(wL)}% / ${cov(wR)}% · head nod ${cov(wH)}% / tilt + turn ${cov(wRY)}% of the clip (U ${Math.round(U)} px${side3q ? ", seen from the side" : ""})`);
  }
  return Object.keys(out).length ? out : null;
};
