// Companion planner: the coin lives IN a handheld clip. Fed by scripts/track.py (how the picture moved every frame),
// it simulates him frame by frame as a small creature standing in the room:
//  - planted: his feet move with the floor when the phone moves (pan, walk forward = the room grows)
//  - he wants to be seen: when the camera leaves him behind he walks (or runs, when far) back in front of it,
//    with a top speed and an acceleration limit, so he never teleports and never slides like a sticker
//  - when you walk forward he walks ahead of you (his size relaxes back instead of growing into the lens)
//  - jumps: at a given clip time he leaps onto a tracked surface (the bed) along an arc, then stays planted on it
// Output (reel px, per clip frame): { t0, fps, frames: [{ x, y, s, vx, vy, air, walk, ww, mode }] }
//  x, y = his feet on screen; s = coin size (1 = brand coin); vx, vy = HIS OWN speed (px/s, without the camera);
//  air = height of a jump (px) above where his feet will land; walk = step phase; ww = walk weight (0 still, 1 walking)
const W = 1080, H = 1920, C = [W / 2, H / 2];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/**
 * How the patch of the picture at p moved this frame: [dx, dy, s]. Uses the local grid of track.py (the floor near the
 * lens moves much more than the far wall when you walk: parallax), else the whole-picture motion.
 */
const localMove = (track, f, p) => {
  const G = track.grid;
  if (!G || !f.g) { const q = cam(f, p); return [q[0] - p[0], q[1] - p[1], f.s]; }
  const nx = G.xs.length, ny = G.ys.length;
  const fx = clamp((p[0] - G.xs[0]) / (G.xs[1] - G.xs[0]), 0, nx - 1.001), fy = clamp((p[1] - G.ys[0]) / (G.ys[1] - G.ys[0]), 0, ny - 1.001);
  const ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
  const n = (x, y, k) => f.g[(y * nx + x) * 3 + k];
  const at = (k) => (n(ix, iy, k) * (1 - u) + n(ix + 1, iy, k) * u) * (1 - v) + (n(ix, iy + 1, k) * (1 - u) + n(ix + 1, iy + 1, k) * u) * v;
  return [at(0), at(1), at(2)];
};
/** the camera motion of one frame applied to a point (p' = s R (p - c) + c + d) */
const cam = (f, p) => {
  const q = [p[0] - C[0], p[1] - C[1]], c = Math.cos(f.r), s = Math.sin(f.r);
  return [f.s * (c * q[0] - s * q[1]) + C[0] + f.dx, f.s * (s * q[0] + c * q[1]) + C[1] + f.dy];
};

/**
 * @param track  scripts/track.py output
 * @param cfg    script.companion: { start: [x, y, size], spot?: [x, y], floor?: [yMin, yMax], walk?: px/s, run?: px/s,
 *               still?: [[from, to], ...] (he stands still, planted, e.g. while he spins / dances for you),
 *               horizon?: y of the floor's horizon on screen (perspective of his own steps; default 760),
 *               react?: s before he decides to walk back into the picture (default 0.35),
 *               leave?: s (from then on he stays where he is and lets the camera go, e.g. while it whips to the bed),
 *               jumps?: [{ at, anchor: name, offset?: [dx, dy], size?, from?: "below" | "here", dur?, height?,
 *                          then?: { spot: [x, y], floor: [yMin, yMax] } }] }   then = he walks on that surface afterwards
 */
export const planCompanion = (track, cfg) => {
  const fps = track.fps, dt = 1 / fps;
  const [x0, y0, s0] = cfg.start ?? [540, 1560, 0.42];
  let spot = cfg.spot ?? [540, y0];
  let [yMin, yMax] = cfg.floor ?? [1300, 1760];
  const vWalk = cfg.walk ?? 380, vRun = cfg.run ?? 900, acc = cfg.accel ?? 1600;
  const anchorAt = (name, t) => {
    const tr = track.anchors?.[name] ?? [];
    let best = null;
    for (const q of tr) if (!best || Math.abs(q.t - t) < Math.abs(best.t - t)) best = q;
    return best && Math.abs(best.t - t) < 0.2 ? best : null;
  };
  let s0Now = s0, going = false, uneasy = 0, depthV = 0, horizon = cfg.horizon ?? 760;
  const react = cfg.react ?? 0.35;
  let g = [x0, y0], sz = s0, v = [0, 0], walk = 0, ww = 0, rw = 0;
  let mode = "follow", jump = null, onAnchor = null;
  const out = [];
  for (const f of track.frames) {
    const t = f.t;
    // 1) the room moves under him (camera): his feet go with the patch of floor they stand on, nothing else.
    //    He is NOT tied to the camera: if you pan away, he stays where he is in the room.
    if (f.ok !== false && mode !== "jump" && mode !== "on") { const m = localMove(track, f, g); g = [g[0] + m[0], g[1] + m[1]]; sz *= m[2]; }
    // 2) a jump starts?
    const j = (cfg.jumps ?? []).find((q) => !q.done && t >= q.at);
    if (j && mode !== "jump") {
      j.done = true;
      const a = anchorAt(j.anchor, t + (j.dur ?? 0.8));
      if (a) {
        const from = j.from === "below" ? [a.x + (j.fromDx ?? -160), H + 260] : g.slice();
        jump = { t0: t, dur: j.dur ?? 0.8, from, fromS: j.from === "below" ? (j.size ?? sz) * 1.15 : sz, height: j.height ?? 520, j };
        mode = "jump"; v = [0, 0];
      }
    }
    let air = 0;
    if (mode === "jump") {
      const q = Math.min(1, (t - jump.t0) / jump.dur), e = ease(q);
      const a = anchorAt(jump.j.anchor, t) ?? anchorAt(jump.j.anchor, jump.t0 + jump.dur);
      const off = jump.j.offset ?? [0, 0];
      const to = a ? [a.x + off[0], a.y + off[1]] : g;
      const toS = (jump.j.size ?? sz) * (a?.s ?? 1);
      // feet travel on a straight line to the landing spot; the body arcs above it (air)
      g = [jump.from[0] + (to[0] - jump.from[0]) * e, jump.from[1] + (to[1] - jump.from[1]) * e];
      air = jump.height * Math.sin(Math.PI * q) * (1 - 0.25 * q);
      sz = jump.fromS + (toS - jump.fromS) * e;
      if (q >= 1) {
        // landed: walks on the new surface (stays in front of the camera), or stays planted on the anchor
        if (jump.j.then) { mode = "follow"; spot = jump.j.then.spot; [yMin, yMax] = jump.j.then.floor; s0Now = sz; horizon = jump.j.then.horizon ?? horizon; going = false; uneasy = 0; }
        else { mode = "on"; onAnchor = { name: jump.j.anchor, off, size: jump.j.size ?? sz }; }
      }
    } else if (mode === "on") {
      // planted on the tracked surface (it moves with the bed, not the whole picture)
      const a = anchorAt(onAnchor.name, t);
      if (a) { g = [a.x + onAnchor.off[0], a.y + onAnchor.off[1]]; sz = onAnchor.size * a.s; }
    } else if ((cfg.leave !== undefined && t >= cfg.leave && !(cfg.jumps ?? []).some((q) => q.done)) || (cfg.still ?? []).some(([a, b]) => t >= a && t < b)) {
      // he lets the camera go (it whips away): planted where he is, waiting for his jump
      depthV = 0;
      v = [0, 0];
    } else {
      // 3) he decides to come to you, like a person would: he stands still while he is comfortably in the picture;
      //    when he is about to leave it (or you came too close / went too far) he notices, and after a short beat
      //    (react) he walks back toward the camera, until he is well in frame again. He never moves just because
      //    the camera moved.
      const out = g[0] < 150 || g[0] > W - 150 || g[1] < yMin - 60 || g[1] > yMax + 60;
      if (!going && out) { uneasy += dt; if (uneasy >= react) going = true; } else if (!going) uneasy = 0;
      const e = [spot[0] - g[0], spot[1] - g[1]], d = Math.hypot(e[0], e[1]);
      if (going && d < 110) { going = false; uneasy = 0; }
      const want = going ? Math.min(d > 300 ? vRun : vWalk, Math.max(120, d * 2.2)) : 0;
      const tv = going && d > 1e-3 ? [(e[0] / d) * want, (e[1] / d) * want] : [0, 0];
      const dv = [tv[0] - v[0], tv[1] - v[1]], dm = Math.hypot(dv[0], dv[1]), lim = acc * dt;
      v = dm > lim ? [v[0] + (dv[0] / dm) * lim, v[1] + (dv[1] / dm) * lim] : tv;
      // perspective on the floor: his own steps up the screen take him away from you (smaller), down = toward you
      const y1 = g[1] + v[1] * dt;
      sz *= clamp((y1 - horizon) / Math.max(40, g[1] - horizon), 0.9, 1.1);
      g = [g[0] + v[0] * dt, y1];
      depthV = 0;
    }
    // his feet stay on the walkable band (the camera can push him past it; he steps back onto it, softly)
    const sp = Math.hypot(v[0], v[1]) + Math.abs(depthV) * 380; // walking toward / away from you is walking too
    walk += (sp * dt) / Math.max(30, 150 * sz) * Math.PI; // one step per ~half a coin of travel
    ww += ((sp > 40 ? Math.min(1, sp / 250) : 0) - ww) * Math.min(1, dt / 0.12);
    rw += (clamp((sp - 500) / 300, 0, 1) - rw) * Math.min(1, dt / 0.2); // running blends in with speed
    out.push({ t: +t.toFixed(4), x: +g[0].toFixed(1), y: +g[1].toFixed(1), s: +sz.toFixed(4), vx: +v[0].toFixed(1), vy: +v[1].toFixed(1), air: +air.toFixed(1), walk: +walk.toFixed(3), ww: +ww.toFixed(3), run: +rw.toFixed(3), mode });
  }
  return { fps, frames: out };
};
