// Named edits (from reel Dfm3n64k4-K): script scene "edit": "orbit" or { "type": "orbit", ...props }. One per scene.
// Our "subject" is the coin, already its own layer, so "behind him" needs no matting: Back is drawn over the footage and
// under the coin (inside SceneView, under the scene's text), Front over the coin and the script "front" PNG, under the
// captions. Both ride the same camera transform as the coin, so they stay on him through a punch-in / creep.
// Edits are pictures, so they show in "text": false scripts (remakes) too: nothing here checks tl.text.
// Time comes only from the frame (t), so a render is deterministic and the loop's ghost copy of frame 0 matches.
//
// To add an edit: its name in edit-names.json (timeline.mjs warns on unknown names from it) + one entry in EDITS below
// (+ its component). Each entry may give any of:
//   Back    drawn above the footage, under the coin            Front   above the coin, under the captions
//   cam(c)  a zoom on the whole picture, centred on the coin    view(c, w0) the whole camera window (zoom out / move: pullback)
//   bg(c)   a scale on the background only (footage + front), around his feet
//   replace true = Back is opaque and replaces the footage (the script "front" PNG, grain and vignette fade out with it)
//   fixed   true = Front is NOT on the camera (screen space; c.view = the camera window this frame)
//   coinFilter(c) a CSS filter added after the coin's own (a sticker outline)     floor false = no contact shadow / glow
//   through true = the zoom-through transition (Reel-level: also zooms the END of the scene before it)
//   in/out  seconds of the ease in / out (default 0.25 / 0.2)
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { coinSpot } from "./Coin3D";
import NAMES from "./edit-names.json";
import { FONT } from "../lib/fonts";
import { hash } from "../lib/looks";
import type { Scene, Theme, Timeline } from "../lib/types";

export type Spot = { x: number; y: number; r: number };
export type Win = { s: number; u: number; v: number }; // camera window: zoom s, top-left u,v in frame px (as Coin3D cameraAt)
/** what an edit gets: its props, the time in the scene, the ease envelope k (0..1), where the coin is */
export type EditCtx = { p: Record<string, any>; local: number; dur: number; k: number; ks?: number; spot: Spot; theme: Theme; tl: Timeline; scene: Scene; view?: Win };
type EditDef = {
  Back?: React.FC<{ c: EditCtx }>;
  Front?: React.FC<{ c: EditCtx }>;
  cam?: (c: EditCtx) => number;
  focus?: (c: EditCtx) => { x: number; y: number }; // where cam zooms to (default: his face)
  view?: (c: EditCtx, w0: Win, W: number, H: number) => Win;
  bg?: (c: EditCtx) => number;
  replace?: boolean;
  cover?: boolean; // covers the whole frame without replacing the footage (pullback): held to a cut next to another cover
  fixed?: boolean;
  coinFilter?: (c: EditCtx) => string;
  floor?: false;
  through?: boolean;
  in?: number;
  out?: number;
};

// the safe box (Reels UI covers the rest): what must be read stays inside
const SAFE = { x0: 120, x1: 888, y0: 288, y1: 1248 };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (x: number) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const AR = /[؀-ۿ]/;
/** Arabic: its own font, rtl; never letterSpacing, a text stroke or a mono face on it (they break the joined letters) */
const textStyle = (s: string, latin: string, arabic = FONT.arabic): React.CSSProperties =>
  AR.test(s) ? { fontFamily: arabic, direction: "rtl" } : { fontFamily: latin, direction: "ltr" };
/** "typing" without breaking Arabic joins: a clip that opens in reading direction (u 0..1) */
const typeClip = (s: string, u: number): React.CSSProperties => {
  const hid = ((1 - clamp(u, 0, 1)) * 100).toFixed(1);
  return { clipPath: AR.test(s) ? `inset(-20% 0 -20% ${hid}%)` : `inset(-20% ${hid}% -20% 0)` };
};
const MONO = "JetBrains Mono"; // Latin only (FONT.mono is Changa under the brand)
const SERIF = "Instrument Serif";
/** where his feet meet the floor: the background scales around it (vertigo) and the studio floor shadow sits on it */
export const feetOf = (s: Spot) => ({ x: s.x, y: s.y + s.r * 1.6 });
const SHADOW = "0 2px 6px rgba(0,0,0,0.85), 0 0 26px rgba(0,0,0,0.5)";
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
/** the side of the coin with more room: 1 = right of him, -1 = left */
const roomySide = (c: EditCtx, prop?: string) => (prop === "left" ? -1 : prop === "right" ? 1 : c.spot.x <= 540 ? 1 : -1);

// ---------------------------------------------------------------- orbit: word chips circling the coin
const orbitChips = (c: EditCtx, fs: number) => {
  const items: string[] = (arr(c.p.items).length ? c.p.items : ["Claude", "Cut", "Captions", "Effects", "Grade"]).map(String);
  const { x, y, r } = c.spot, n = items.length, dir = roomySide(c);
  const tilt = ((c.p.tilt ?? -6) * Math.PI) / 180, ry = r * 0.36;
  // the ring sits low (centre at his lower face): the near pass crosses his lower body, under his mouth (its lowest
  // point y + 0.86 r, above the chunk captions); the far pass is hidden behind his face
  const cy = y + r * 0.5;
  // chip half width (text + dot + padding): the ends of the ring clear his rim by a whole chip, so a chip switches
  // Back <-> Front beside him (never over his face) and the far half shows behind him at both sides. On the cramped
  // side the end may leave the frame: only while passing
  const hw = Math.max(...items.map((s) => (s.length * (AR.test(s) ? 0.5 : 0.58) * fs + fs * 1.6) / 2));
  // his drawn rim reaches ~1.1 r (3/4 view). The ring's centre moves toward his roomy side (d) as far as the frame
  // lets that end stay on screen, and widens by as much, so the cramped end still clears his rim
  const R = r * 1.2 + hw, own = Number(c.p.radius) > 0;
  const d = own ? 0 : dir * clamp(((dir > 0 ? 1072 - x : x - 8) - R - hw) / 2, 0, r * 0.3);
  const rx = own ? Number(c.p.radius) : R + Math.abs(d), cx = x + d;
  const endsOnHim = rx < r + hw * 0.6; // a small "radius" puts the ends over the coin: fade there, so the switch never pops
  // fast enough that every chip comes round from behind to the front once in a short scene (the last one needs 7/8 of
  // a turn), calmer in a long one
  const w = (2 * Math.PI) / (Number(c.p.period) || clamp(c.dur * 1.1, 2.4, 6));
  // spread evenly, none at the far ends or the far middle (hidden behind him) on frame 0 (that frame is also the
  // loop's): 4 chips sit at the diagonals. dir turns it so a chip comes from behind to the front on his roomy side
  const off = n % 2 ? Math.PI / (2 * n) : Math.PI / n;
  return items.map((label, i) => {
    const a = (i / n) * 2 * Math.PI + off + c.local * w;
    const ex = dir * Math.cos(a) * rx, ey = Math.sin(a) * ry, z = Math.sin(a); // z > 0 = the near half (lower on screen), in front of him
    return { label, z, fade: endsOnHim ? smooth(Math.abs(z) / 0.3) : 1, px: cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), py: cy + ex * Math.sin(tilt) + ey * Math.cos(tilt) };
  });
};
const Chips: React.FC<{ c: EditCtx; near: boolean }> = ({ c, near }) => {
  const fs = Number(c.p.size) || clamp(c.spot.r * 0.2, 42, 60); // >= 42 px text at full frame
  const chips = orbitChips(c, fs).filter((q) => (q.z > 0) === near).sort((a, b) => a.z - b.z);
  return (
    <>
      {chips.map((q, i) => {
        const d = (q.z + 1) / 2; // 0 far .. 1 near
        const s = (0.9 + 0.1 * d) * (0.9 + 0.1 * c.k); // the far side only a little smaller
        return (
          <div key={i} style={{ position: "absolute", left: q.px, top: q.py, transform: `translate(-50%, -50%) scale(${s.toFixed(4)})`, opacity: c.k * q.fade * (0.7 + 0.3 * d),
            background: "#FFFFFF", borderRadius: 999, padding: `${fs * 0.3}px ${fs * 0.62}px`,
            boxShadow: "0 6px 18px rgba(0,0,0,0.28)", display: "flex", alignItems: "center", gap: fs * 0.32, whiteSpace: "nowrap",
            fontSize: fs, fontWeight: 700, lineHeight: 1.15, color: "#16171B", ...textStyle(q.label, FONT.head) }}>
            <span style={{ width: fs * 0.34, height: fs * 0.34, borderRadius: "50%", background: c.theme.accent, boxShadow: "0 0 0 2px rgba(0,0,0,0.22)", flex: "none" }} />
            {q.label}
          </div>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- cover-story: a magazine cover, masthead behind his head
const coverMast = (c: EditCtx) => {
  const m = String(c.p.masthead ?? "COVER"), ar = AR.test(m);
  const fs = clamp((SAFE.x1 - SAFE.x0) / (Math.max(1, m.length) * (ar ? 0.5 : 0.56)), 110, 250); // fit ~768 px by its length
  const coinTop = c.spot.y - c.spot.r;
  const y0 = SAFE.y0 + (c.p.strap ? 50 : 0), behind = coinTop - fs * 0.6; // his head covers the lower third of the letters
  // "y" = the masthead's centre; else behind his head; a coin whose head is below the safe box (the brand's bottom coin)
  // cannot cover it there: a plain cover header at the top instead
  const top = typeof c.p.y === "number" ? clamp(c.p.y - fs / 2, y0, SAFE.y1 - fs) : behind + fs * 0.9 > SAFE.y1 ? y0 : clamp(behind, y0, SAFE.y1 - fs);
  return { m, ar, fs, top };
};
const CoverBack: React.FC<{ c: EditCtx }> = ({ c }) => {
  const { m, ar, fs, top } = coverMast(c), strap = c.p.strap ? String(c.p.strap) : "";
  const rise = (1 - c.k) * 24;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: c.k, transform: `translateY(${rise.toFixed(2)}px)` }}>
      {strap && (
        <div style={{ position: "absolute", left: SAFE.x0, width: SAFE.x1 - SAFE.x0, top: top - 46, textAlign: "center", fontSize: 30, fontWeight: 600, color: "#F4F5F7", textShadow: SHADOW, whiteSpace: "nowrap",
          ...textStyle(strap, FONT.head), ...(AR.test(strap) ? {} : { letterSpacing: 6, textTransform: "uppercase" as const }) }}>{strap}</div>
      )}
      {/* a soft dark shadow so a light accent (lime) reads on a light photo */}
      <div style={{ position: "absolute", left: SAFE.x0, width: SAFE.x1 - SAFE.x0, top, textAlign: "center", fontSize: fs, lineHeight: 1, whiteSpace: "nowrap", color: c.p.color ?? c.theme.accent,
        fontWeight: ar ? 800 : 400, textShadow: "0 2px 4px rgba(0,0,0,0.45), 0 6px 34px rgba(0,0,0,0.55)", ...textStyle(m, SERIF, FONT.arabicEmph) }}>{m}</div>
    </div>
  );
};
const CoverFront: React.FC<{ c: EditCtx }> = ({ c }) => {
  const line = c.p.line ? String(c.p.line) : "";
  if (!line) return null;
  const { x, y, r } = c.spot, right = x <= 540, ar = AR.test(line);
  // the side with more room, inside the safe box; it may overlap his edge a little (it is in front)
  const left = right ? clamp(x + r * 0.55, SAFE.x0, SAFE.x1 - 280) : SAFE.x0;
  const width = right ? SAFE.x1 - left : clamp(x - r * 0.55, SAFE.x0 + 280, SAFE.x1) - SAFE.x0;
  return (
    <div style={{ position: "absolute", left, width, top: clamp(y - r * 0.2, SAFE.y0, SAFE.y1 - 160), opacity: c.k, textAlign: right ? "right" : "left",
      fontSize: 60, lineHeight: 1.05, color: "#FFFFFF", textShadow: SHADOW, fontStyle: ar ? "normal" : "italic", fontWeight: ar ? 700 : 400,
      ...textStyle(line, SERIF) }}>{line}</div>
  );
};

// ---------------------------------------------------------------- green-screen: a clean studio instead of the footage
// Note: a white hook title (script "caption") is weak on the white studio: it reads only through its dark shadow.
const STUDIO = "radial-gradient(ellipse 95% 62% at 50% 36%, #FFFFFF 0%, #F2F2F0 46%, #DCDCD8 100%)";
const FloorShadow: React.FC<{ c: EditCtx; a?: number }> = ({ c, a = 0.26 }) => {
  const { x, r } = c.spot, floor = feetOf(c.spot).y;
  return <div style={{ position: "absolute", left: x - r, width: r * 2, top: floor - r * 0.14, height: r * 0.28, borderRadius: "50%",
    background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,${a}) 0%, rgba(0,0,0,${a * 0.4}) 45%, rgba(0,0,0,0) 72%)` }} />;
};
const GreenBack: React.FC<{ c: EditCtx }> = ({ c }) => (
  <div style={{ position: "absolute", inset: 0, opacity: c.k }}>
    {c.p.src
      ? <Img src={staticFile(String(c.p.src))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      : <div style={{ position: "absolute", inset: 0, background: c.p.color ?? STUDIO }} />}
    <FloorShadow c={c} />
  </div>
);

// ---------------------------------------------------------------- couch-wall: a wall of rounded thumbnail cards behind him
const CouchBack: React.FC<{ c: EditCtx }> = ({ c }) => {
  const imgs = arr(c.p.images).map(String), cols = 5, gap = 16, cw = (1080 - gap * (cols + 1)) / cols, ch = cw * 1.33;
  const rows = Math.ceil(1920 / (ch + gap)) + 1;
  const tones = [c.theme.panel, c.theme.accent, "#2B2F36", "#E9E6DF", c.theme.panel, "#3A3F47"];
  const cells = [];
  for (let rI = 0; rI < rows; rI++) for (let q = 0; q < cols; q++) {
    // staggered pops row by row from the top (left to right inside a row); a bigger column step or jitter made a low
    // row's first tile pop before the rows above it (a stray tile alone at bottom left)
    const i = rI * cols + q, delay = 0.012 * q + 0.06 * rI + hash(i + 3) * 0.02;
    const u = easeOut((c.local - delay) / 0.32);
    const drift = (q % 2 ? -1 : 1) * c.local * 7; // columns drift slowly in turn
    const tone = tones[i % tones.length];
    cells.push(
      <div key={i} style={{ position: "absolute", left: gap + q * (cw + gap), top: gap + rI * (ch + gap) - ch * 0.4 + drift, width: cw, height: ch, borderRadius: 18, overflow: "hidden",
        transform: `scale(${(0.82 + 0.18 * u).toFixed(4)})`, opacity: u, boxShadow: "0 8px 22px rgba(0,0,0,0.35)", background: tone }}>
        {imgs.length
          ? <Img src={staticFile(imgs[i % imgs.length])} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <>
              <div style={{ position: "absolute", left: 14, right: 40, bottom: 34, height: 12, borderRadius: 6, background: "rgba(255,255,255,0.55)" }} />
              <div style={{ position: "absolute", left: 14, right: 80, bottom: 16, height: 10, borderRadius: 5, background: "rgba(255,255,255,0.3)" }} />
            </>}
      </div>,
    );
  }
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: 0.45 * c.k }} />
      <div style={{ position: "absolute", inset: 0, opacity: c.k }}>{cells}</div>
    </div>
  );
};

// ---------------------------------------------------------------- ui-world: a dark app / terminal window behind him, lines type in
const lineAt = (i: number) => 0.3 + i * 0.5; // when line i starts typing
const UiBack: React.FC<{ c: EditCtx }> = ({ c }) => {
  const { x, y, r } = c.spot, lines = arr(c.p.lines).map(String), title = String(c.p.title ?? "claude — reel");
  const win = { x0: 40, x1: 1040, y0: 300, y1: Math.max(900, Math.min(1300, y + r * 0.6)) };
  // all text inside the safe box. The lines: beside him if a side has room, else above his head (the safe width)
  const side = roomySide(c), roomW = side > 0 ? SAFE.x1 - (x + r * 1.1) : x - r * 1.1 - SAFE.x0;
  const box = roomW >= 340
    ? { left: side > 0 ? x + r * 1.1 : SAFE.x0, width: roomW, top: win.y0 + 90 }
    : { left: SAFE.x0, width: SAFE.x1 - SAFE.x0, top: win.y0 + 78 };
  const lh = 52;
  const progress = typeof c.p.progress === "number" ? clamp(c.p.progress, 0, 100) / 100 : null;
  // the progress bar under the lines when it clears his head, else at the right end of the title bar
  const barTop = box.top + lines.length * lh + 16, barUnder = roomW >= 340 || barTop + 14 <= y - r * 1.12 - 12;
  const bar = barUnder ? { left: box.left, width: Math.min(box.width, 520), top: barTop } : { left: SAFE.x1 - 230, width: 230, top: win.y0 + 29 - 7 };
  return (
    <div style={{ position: "absolute", inset: 0, opacity: c.k, transform: `translateY(${((1 - c.k) * 30).toFixed(2)}px)` }}>
      <div style={{ position: "absolute", left: win.x0, top: win.y0, width: win.x1 - win.x0, height: win.y1 - win.y0, borderRadius: 26, background: "rgba(16,17,20,0.94)",
        border: "1.5px solid rgba(255,255,255,0.12)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", overflow: "hidden" }}>
        {/* the dots start at x 64, the title at ~x 150 (inside the safe box) */}
        <div style={{ height: 58, display: "flex", alignItems: "center", gap: 12, padding: "0 24px", borderBottom: "1.5px solid rgba(255,255,255,0.08)" }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((col) => <span key={col} style={{ width: 16, height: 16, borderRadius: 8, background: col }} />)}
          <span style={{ marginLeft: 14, fontSize: 34, fontWeight: 600, color: "rgba(255,255,255,0.78)", whiteSpace: "nowrap", overflow: "hidden", maxWidth: (barUnder || progress === null ? SAFE.x1 : bar.left - 20) - 150, ...textStyle(title, MONO) }}>{title}</span>
        </div>
      </div>
      {lines.map((s, i) => {
        const u = (c.local - lineAt(i)) / Math.max(0.25, s.length / 32);
        if (u <= 0) return null;
        const ar = AR.test(s);
        return (
          <div key={i} style={{ position: "absolute", left: box.left, width: box.width, top: box.top + i * lh, fontSize: 38, lineHeight: `${lh}px`, whiteSpace: "nowrap", overflow: "hidden",
            color: i === lines.length - 1 ? c.theme.accent : "rgba(255,255,255,0.9)", textAlign: ar ? "right" : "left", ...textStyle(s, MONO), ...typeClip(s, u) }}>
            {ar ? s : `> ${s}`}
          </div>
        );
      })}
      {progress !== null && (
        <div style={{ position: "absolute", ...bar, height: 14, borderRadius: 7, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
          <div style={{ width: `${(progress * easeOut((c.local - 0.3) / Math.max(0.5, c.dur * 0.7)) * 100).toFixed(2)}%`, height: "100%", background: c.theme.accent }} />
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- frame-break: dark all round, a bordered window round his lower body; his head breaks out of its top
const FrameBack: React.FC<{ c: EditCtx }> = ({ c }) => {
  const { x, y, r } = c.spot, w = clamp(r * 2.9, 420, 1000), feet = feetOf(c.spot).y;
  const left = clamp(x - w / 2, 40, 1040 - w), top = y, h = feet + r * 0.3 - y;
  const s = 1.04 - 0.04 * c.k;
  return (
    <div style={{ position: "absolute", left, top, width: w, height: h, borderRadius: 34, border: `6px solid ${c.p.color ?? "#FFFFFF"}`, transform: `scale(${s.toFixed(4)})`,
      boxShadow: `0 0 0 4000px rgba(10,10,12,${((c.p.dim ?? 0.85) * c.k).toFixed(3)})`, opacity: Math.min(1, c.k * 1.5) }} />
  );
};

/** the lowest y a thing beside him may reach: above the chunk caption row when that row is below his centre */
const bottomFree = (c: EditCtx) => {
  const cap = c.tl.captions;
  return cap.mode === "chunk" && (cap.y ?? 820) > c.spot.y ? Math.min(SAFE.y1, (cap.y ?? 820) - 80) : SAFE.y1;
};

// ---------------------------------------------------------------- full-mockup: a phone slides in beside him, tilted, resting inside the safe box
const MockFront: React.FC<{ c: EditCtx }> = ({ c }) => {
  const { x, y, r } = c.spot, side = roomySide(c, c.p.side);
  const tilt = Number(c.p.tilt ?? 6 * side), sn = Math.abs(Math.sin((tilt * Math.PI) / 180));
  // the room beside his drawn rim (~1.1 r); the phone may cover his far edge by ~0.4 r (never his eyes), never leaves the safe box
  const room = side > 0 ? SAFE.x1 - (x + r * 1.1) : x - r * 1.1 - SAFE.x0;
  const yMax = bottomFree(c);
  const w = Math.min(clamp((room + r * 0.4 - 6) / (1 + 1.075 * sn), 240, 380), (yMax - SAFE.y0 - 20) / (2.15 + sn)), h = w * 2.15;
  const pad = (h * sn) / 2 + 6; // the tilted corners stick out by about this much
  const left = side > 0 ? SAFE.x1 - w - pad : SAFE.x0 + pad;
  const top = clamp(y - h / 2, SAFE.y0 + pad, yMax - h - pad);
  // slides fully past the frame edge, and fades over its last bit, so no sliver is left on the last frame of the scene
  const slide = (1 - easeOut(c.k)) * (side > 0 ? 1080 - left + 80 : left + w + 80) * side;
  return (
    <div style={{ position: "absolute", left, top, width: w, height: h, transform: `translateX(${slide.toFixed(1)}px) rotate(${tilt}deg)`, opacity: smooth(c.k * 4), borderRadius: w * 0.14, background: "#0E0F12",
      padding: w * 0.03, boxShadow: "0 30px 70px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.12)" }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: w * 0.115, overflow: "hidden", background: `linear-gradient(160deg, ${c.theme.panel}, #1B1E24)` }}>
        {c.p.src && <Img src={staticFile(String(c.p.src))} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", top: w * 0.03, left: "50%", transform: "translateX(-50%)", width: w * 0.3, height: w * 0.075, borderRadius: w * 0.04, background: "#000" }} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- checklist: a small dark glass card, rows type in and tick
// This is the small overlay beside him. The full-page document is the card "visual": { "type": "checklist" }.
const tickTimes = (c: EditCtx, n: number) => {
  const emph = c.scene.words.filter((w) => w.emph), lead = c.tl.captions.lead ?? 0;
  // never before the card is in and its row has typed (~0.75 s), then at least 0.3 s apart
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const want = emph[i] ? emph[i].start - c.scene.start - lead : 0.4 + ((c.dur * 0.75) * (i + 1)) / (n + 1);
    out.push(Math.max(want, 0.75 + i * 0.3, i ? out[i - 1] + 0.3 : 0));
  }
  return out;
};
const CheckFront: React.FC<{ c: EditCtx }> = ({ c }) => {
  const items = arr(c.p.items).map(String).slice(0, 4);
  if (!items.length) return null;
  const { x, y, r } = c.spot, side = roomySide(c), cw = 500, rowH = 66, ch = items.length * rowH + 40;
  const roomW = side > 0 ? SAFE.x1 - (x + r * 1.05) : x - r * 1.05 - SAFE.x0;
  const midX = clamp(x - cw / 2, SAFE.x0, SAFE.x1 - cw), brows = y - r * 0.72;
  // beside his face when a side has room; else above his brows (it may cover the top of his rim) when it fits; else below
  // his face (over his chest; it may meet the chunk captions there: said in the report); never on his eyes or mouth
  const pos = roomW >= cw
    ? { left: side > 0 ? x + r * 1.05 : x - r * 1.05 - cw, top: clamp(y - ch / 2, SAFE.y0, SAFE.y1 - ch) }
    : brows - SAFE.y0 >= ch
      ? { left: midX, top: Math.min(brows - ch, Math.max(SAFE.y0, y - r * 1.05 - ch - 10)) }
      : { left: midX, top: clamp(y + r * 0.42, SAFE.y0, SAFE.y1 - ch) };
  const ticks = tickTimes(c, items.length);
  return (
    <div style={{ position: "absolute", ...pos, width: cw, padding: "20px 26px", borderRadius: 24, background: "rgba(18,20,24,0.66)", border: "1.5px solid rgba(255,255,255,0.16)",
      boxShadow: "0 20px 50px rgba(0,0,0,0.45)", opacity: c.k, transform: `translateY(${((1 - c.k) * 20).toFixed(2)}px)` }}>
      {items.map((s, i) => {
        const appear = Math.min(ticks[i] - 0.5, 0.15 + i * 0.25), u = (c.local - appear) / 0.35, on = smooth((c.local - ticks[i]) / 0.15), ar = AR.test(s);
        return (
          <div key={i} style={{ height: rowH, display: "flex", alignItems: "center", gap: 18, flexDirection: ar ? "row-reverse" : "row", opacity: smooth(u * 3) }}>
            <span style={{ width: 32, height: 32, flex: "none", borderRadius: 8, border: `3px solid ${on > 0.5 ? c.theme.accent : "rgba(255,255,255,0.75)"}`, background: on > 0 ? c.theme.accent : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${(1 + 0.12 * Math.sin(Math.PI * on)).toFixed(3)})` }}>
              {on > 0 && <svg width={22} height={22} viewBox="0 0 22 22"><path d="M4 11.5 L9 16 L18 6" fill="none" stroke={c.theme.onAccent ?? "#111"} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - on} /></svg>}
            </span>
            <span style={{ fontSize: 40, fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap", textAlign: ar ? "right" : "left", flex: 1, opacity: on > 0 ? 0.92 : 1, ...textStyle(s, FONT.head), ...typeClip(s, u) }}>{s}</span>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- headline-wall: big number rows stacked at one side, the picture dims
const HeadlineBack: React.FC<{ c: EditCtx }> = ({ c }) => {
  const rows = arr(c.p.rows).slice(0, 3).map((q) => ({ n: String(q?.n ?? ""), label: String(q?.label ?? "") }));
  const { x, y, r } = c.spot, side = roomySide(c, c.p.side), n = Math.max(1, rows.length);
  // each row = a huge heavy number with its label under it. Beside him (a column at the frame side of the safe box)
  // only where his gesturing hands cannot reach: above ~1 r over his centre, or more than ~1.8 r from it. Else the
  // rows stand side by side above his head
  const left = side > 0 ? clamp(x + r * 1.1, SAFE.x0, SAFE.x1 - 200) : SAFE.x0;
  const right = side > 0 ? SAFE.x1 : clamp(x - r * 1.1, SAFE.x0 + 200, SAFE.x1);
  const colW = right - left, len = Math.max(1, ...rows.map((q) => q.n.length));
  const colFs = Math.min(clamp((colW + r * 0.25) / (len * 0.58), 110, 230), (bottomFree(c) - SAFE.y0 - 30) / (n * 1.32));
  const handsTop = y - r * 1.0, clearW = side > 0 ? SAFE.x1 - (x + r * 1.8) : x - r * 1.8 - SAFE.x0;
  const headTop = y - r * 1.12, overFs = Math.min(230, (SAFE.x1 - SAFE.x0) / n / (len * 0.62), (headTop - 16 - SAFE.y0 - 20) / 1.3);
  const column = SAFE.y0 + 24 + n * colFs * 1.32 <= handsTop || clearW >= 200 || overFs < 110;
  const fs = column ? colFs : overFs, rowH = fs * 1.32, cellW = (SAFE.x1 - SAFE.x0) / n;
  const at = (i: number): React.CSSProperties => column
    ? { left, width: colW, top: SAFE.y0 + 24 + i * rowH, alignItems: side > 0 ? "flex-end" : "flex-start" }
    : { left: SAFE.x0 + (AR.test(rows[0]?.label ?? "") ? n - 1 - i : i) * cellW, width: cellW, top: SAFE.y0 + 20, alignItems: "center" }; // Arabic: the first at the right
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: 0.5 * c.k }} />
      {rows.map((q, i) => {
        const u = easeOut((c.local - 0.15 - i * 0.4) / 0.4);
        return (
          <div key={i} style={{ position: "absolute", ...at(i), display: "flex", flexDirection: "column",
            opacity: u * c.k, transform: `translateY(${((1 - u) * 26).toFixed(2)}px)`, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: fs, lineHeight: 0.95, fontWeight: 800, color: c.theme.accent, textShadow: "0 3px 6px rgba(0,0,0,0.45), 0 6px 26px rgba(0,0,0,0.55)", ...textStyle(q.n, FONT.head, FONT.arabicEmph) }}>{q.n}</span>
            <span style={{ fontSize: fs * 0.27, lineHeight: 1.25, fontWeight: 700, color: "#FFFFFF", textShadow: SHADOW, ...textStyle(q.label, FONT.head) }}>{q.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- chart-grow: a thin line chart draws itself behind him
const ChartBack: React.FC<{ c: EditCtx }> = ({ c }) => {
  const pts: number[] = arr(c.p.points).length > 1 ? c.p.points.map(Number) : [0.06, 0.14, 0.11, 0.24, 0.31, 0.27, 0.45, 0.58, 0.55, 0.78, 0.96];
  const lo = Math.min(...pts), hi = Math.max(...pts), X0 = SAFE.x0 + 10, X1 = SAFE.x1 - 24, Y1 = SAFE.y0 + 80;
  // the line rises above his head (the start about at his top edge), so most of it shows; a low coin gives it more height
  const Y0 = clamp(c.spot.y - c.spot.r, Y1 + 180, 1100);
  const P = pts.map((v, i) => [X0 + ((X1 - X0) * i) / (pts.length - 1), Y0 + ((Y1 - Y0) * (v - lo)) / Math.max(1e-6, hi - lo)]);
  // smooth through the points (midpoint quadratics)
  let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
  for (let i = 1; i < P.length - 1; i++) d += ` Q${P[i][0].toFixed(1)} ${P[i][1].toFixed(1)} ${((P[i][0] + P[i + 1][0]) / 2).toFixed(1)} ${((P[i][1] + P[i + 1][1]) / 2).toFixed(1)}`;
  d += ` L${P[P.length - 1][0].toFixed(1)} ${P[P.length - 1][1].toFixed(1)}`;
  const u = easeOut((c.local - 0.05) / Math.max(0.6, c.dur * 0.75)), end = P[P.length - 1]; // draws from the start, slows to the end
  const label = c.p.label ? String(c.p.label) : "", value = c.p.value !== undefined ? String(c.p.value) : "";
  const shown = smooth((u - 0.9) / 0.1);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: c.k }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
        <path d={`M${X0} ${Y0} L${X1} ${Y0}`} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
        <path d={d} fill="none" stroke="rgba(0,0,0,0.38)" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - u} />
        <path d={d} fill="none" stroke={c.theme.accent} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - u} />
        {shown > 0 && <circle cx={end[0]} cy={end[1]} r={15 * shown} fill={c.theme.accent} stroke="#fff" strokeWidth={4} />}
      </svg>
      {label && <div style={{ position: "absolute", left: SAFE.x0 + 4, top: SAFE.y0 + 2, fontSize: 54, lineHeight: 1.2, fontWeight: 700, color: "#FFFFFF", textShadow: SHADOW, whiteSpace: "nowrap", ...textStyle(label, MONO) }}>{label}</div>}
      {/* the value under the end dot (above it would leave the safe box) */}
      {value && <div style={{ position: "absolute", right: 1080 - SAFE.x1, top: clamp(end[1] + 28, SAFE.y0, SAFE.y1 - 90), fontSize: 84, lineHeight: 1, color: c.theme.accent, opacity: shown,
        textShadow: "0 2px 4px rgba(0,0,0,0.45), 0 4px 24px rgba(0,0,0,0.5)", whiteSpace: "nowrap", ...textStyle(value, SERIF, FONT.arabicEmph) }}>{value}</div>}
    </div>
  );
};

// ---------------------------------------------------------------- pullback: the whole picture shrinks into a window of a dark editor screen
// the editor screen, all inside the safe box and above the chunk caption row: the title bar at its top, the shrunken
// picture (the preview) at its left, the typed lines in a panel to its right, the timeline strip under the preview
const PULL = { top: 356, strip: 32 };
const pullTarget = (c: EditCtx, H: number) => {
  const Tt = Number(c.p.top) || PULL.top;
  const st = Number(c.p.zoom) || clamp((bottomFree(c) - Tt - 14 - PULL.strip) / H, 0.25, 0.4);
  return { st, Lt: SAFE.x0, Tt };
};
const pullView = (c: EditCtx, w0: Win, W: number, H: number): Win => {
  const { st, Lt, Tt } = pullTarget(c, H), k = smooth(c.k);
  const s0 = w0.s, L0 = -w0.u * s0, T0 = -w0.v * s0;
  const s = s0 + (st - s0) * k, L = L0 + (Lt - L0) * k, T = T0 + (Tt - T0) * k;
  return { s, u: -L / s, v: -T / s };
};
const PullFront: React.FC<{ c: EditCtx }> = ({ c }) => {
  const v = c.view ?? { s: 1, u: 0, v: 0 }, L = -v.u * v.s, T = -v.v * v.s, w = 1080 * v.s, h = 1920 * v.s;
  const k = smooth(c.k), lines = arr(c.p.lines).map(String), title = String(c.p.title ?? "reel — edit");
  const play = clamp(c.local / c.dur, 0, 1);
  // laid out from where the picture ends up (the target), so nothing slides while the picture shrinks
  const tg = pullTarget(c, 1920), panelL = tg.Lt + 1080 * tg.st + 26, panelT = tg.Tt + 16, sY = tg.Tt + 1920 * tg.st + 14;
  const blocks = [0.14, 0.09, 0.2, 0.12, 0.08, 0.17, 0.11, 0.09];
  return (
    <AbsoluteFill>
      {/* the screen, with a rounded hole exactly where the shrunken picture is (one huge box-shadow round the hole) */}
      <div style={{ position: "absolute", left: L, top: T, width: w, height: h, borderRadius: 26 * k, boxShadow: `0 0 0 3000px rgba(14,15,18,${(0.97 * k).toFixed(3)}), 0 0 0 ${(3 * k).toFixed(2)}px rgba(255,255,255,0.18)` }} />
      <div style={{ position: "absolute", inset: 0, opacity: k }}>
        <div style={{ position: "absolute", left: SAFE.x0, right: 1080 - SAFE.x1, top: tg.Tt - 64, height: 50, display: "flex", alignItems: "center", gap: 12, borderBottom: "1.5px solid rgba(255,255,255,0.1)" }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((col) => <span key={col} style={{ width: 14, height: 14, borderRadius: 7, background: col }} />)}
          <span style={{ marginLeft: 12, fontSize: 30, fontWeight: 600, color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap", ...textStyle(title, MONO) }}>{title}</span>
        </div>
        <div style={{ position: "absolute", left: SAFE.x0, width: SAFE.x1 - SAFE.x0, top: sY, height: PULL.strip, display: "flex", gap: 6 }}>
          {blocks.map((b, i) => <div key={i} style={{ flex: b, borderRadius: 6, background: i % 3 === 1 ? c.theme.accent : "rgba(255,255,255,0.2)", opacity: i % 3 === 1 ? 0.9 : 1 }} />)}
          <div style={{ position: "absolute", left: `${(play * 100).toFixed(2)}%`, top: -8, bottom: -8, width: 3, background: "#FFFFFF", boxShadow: "0 0 8px rgba(255,255,255,0.7)" }} />
        </div>
        {lines.map((s, i) => {
          const u = (c.local - 0.5 - i * 0.45) / Math.max(0.25, s.length / 32);
          return u > 0 ? (
            <div key={i} style={{ position: "absolute", left: panelL, width: SAFE.x1 - panelL, top: panelT + i * 48, fontSize: 28, lineHeight: "48px", whiteSpace: "nowrap", overflow: "hidden",
              color: i === lines.length - 1 ? c.theme.accent : "rgba(255,255,255,0.8)", textAlign: AR.test(s) ? "right" : "left", ...textStyle(s, MONO), ...typeClip(s, u) }}>{AR.test(s) ? s : `> ${s}`}</div>
          ) : null;
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- paper-cut: a kraft paper collage behind him, a white sticker outline on him
const PaperBack: React.FC<{ c: EditCtx }> = ({ c }) => {
  const step = Math.floor(c.local * 8); // paper stop-motion: the shapes jump a few px at 8 fps
  const j = (i: number, a = 3) => ({ x: (hash(step * 7 + i * 13) - 0.5) * 2 * a, y: (hash(step * 11 + i * 17) - 0.5) * 2 * a, r: (hash(step * 5 + i * 3) - 0.5) * 1.2 });
  const shape = (i: number, st: React.CSSProperties, rot: number, child?: React.ReactNode) => {
    const q = j(i);
    return <div key={i} style={{ position: "absolute", boxShadow: "0 6px 0 rgba(0,0,0,0.12), 0 14px 30px rgba(0,0,0,0.18)", ...st, transform: `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px) rotate(${(rot + q.r).toFixed(2)}deg)` }}>{child}</div>;
  };
  return (
    <div style={{ position: "absolute", inset: 0, opacity: c.k, background: "radial-gradient(ellipse 90% 70% at 50% 45%, #D2AE80 0%, #C39C6C 60%, #A98258 100%)" }}>
      {shape(0, { left: -40, top: 250, width: 520, height: 420, background: c.theme.accent }, -5)}
      {shape(1, { left: 620, top: 210, width: 470, height: 470, borderRadius: "50%", background: "#F3EBDD" }, 0)}
      {shape(2, { left: 680, top: 760, width: 360, height: 470, background: "#FBF8F1", backgroundImage: "repeating-linear-gradient(180deg, transparent 0 38px, rgba(60,90,160,0.35) 38px 40px)" }, 4)}
      {shape(3, { left: -30, top: 1240, width: 470, height: 360, background: "#1E2E58" }, 3)}
      {shape(4, { left: 720, top: 1380, width: 300, height: 120, background: "#E5DCCB" }, -3)}
    </div>
  );
};
/** the sticker outline: 4 hard white drop-shadows (as Looks INK_OUTLINE) + a soft lift. Full width at once, it fades
 *  with the edit's own ease (ks: also when the paper is held across a cut); growing its width popped in 1-2 frames */
const sticker = (c: EditCtx) => {
  const a = c.ks ?? c.k, w = `rgba(255,255,255,${a.toFixed(3)})`;
  return `drop-shadow(8px 0 0 ${w}) drop-shadow(-8px 0 0 ${w}) drop-shadow(0 8px 0 ${w}) drop-shadow(0 -8px 0 ${w}) drop-shadow(0 10px 14px rgba(0,0,0,${(0.25 * a).toFixed(3)}))`;
};

// ---------------------------------------------------------------- doodle-boil: hand-drawn doodles round his head, lines boil
const DOODLE: Record<string, (s: number) => string> = { // paths in a unit box -1..1, scaled by s
  crown: (s) => `M${-s} ${s * 0.5} L${-s * 0.85} ${-s * 0.45} L${-s * 0.4} ${s * 0.05} L0 ${-s * 0.7} L${s * 0.4} ${s * 0.05} L${s * 0.85} ${-s * 0.45} L${s} ${s * 0.5} Z`,
  star: (s) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? s * 0.42 : s; return `${i ? "L" : "M"}${(Math.cos(a) * q).toFixed(1)} ${(Math.sin(a) * q).toFixed(1)}`; }).join(" ") + " Z",
  squiggle: (s) => `M${-s} 0 C${-s * 0.7} ${-s * 0.5} ${-s * 0.4} ${s * 0.5} ${-s * 0.1} 0 S${s * 0.4} ${-s * 0.5} ${s * 0.7} 0 S${s} ${s * 0.3} ${s * 1.1} 0`,
  arrow: (s) => `M${-s} ${-s * 0.4} C${-s * 0.4} ${-s * 0.6} ${s * 0.2} ${-s * 0.2} ${s * 0.7} ${s * 0.3} M${s * 0.35} ${s * 0.35} L${s * 0.7} ${s * 0.3} L${s * 0.62} ${-s * 0.05}`,
  heart: (s) => `M0 ${s * 0.8} C${-s * 1.1} 0 ${-s * 0.8} ${-s * 0.9} 0 ${-s * 0.35} C${s * 0.8} ${-s * 0.9} ${s * 1.1} 0 0 ${s * 0.8} Z`,
};
const DoodleFront: React.FC<{ c: EditCtx }> = ({ c }) => {
  const { x, y, r } = c.spot, list: string[] = (arr(c.p.doodles).length ? c.p.doodles : ["crown", "star", "star", "squiggle"]).map(String).filter((d: string) => DOODLE[d]);
  const seed = Math.floor(c.local * 8); // a new wobble at 8 fps (hand-drawn boil), whatever the render fps
  const fid = `boil-${c.scene.id}-${seed}`;
  // the crown sits just above his top edge; the rest take the slots round his head in turn
  const slots = [[x - r * 1.22, y - r * 0.85, 0.2], [x + r * 1.2, y - r * 1.0, 0.16], [x + r * 1.32, y - r * 0.2, 0.32], [x - r * 1.4, y + r * 0.05, 0.3], [x + r * 1.25, y + r * 0.55, 0.22]];
  let si = 0;
  const items = list.map((d, i) => d === "crown" ? { d, x: x, y: y - r * 1.28, s: r * 0.42, i } : (() => { const q = slots[si++ % slots.length]; return { d, x: clamp(q[0], 40, 1040), y: q[1], s: r * q[2], i }; })());
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <filter key={fid} id={fid} x="-20%" y="-20%" width="140%" height="140%">
          {/* one smooth octave: a wavy hand-drawn line, not a jagged one */}
          <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves={1} seed={seed} />
          <feDisplacementMap in="SourceGraphic" scale={Math.max(14, r * 0.07)} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      {/* a dark edge under the line, so a white doodle reads on a bright window too. The shadow sits on an outer group:
          a CSS filter in style overrides the filter attribute, so on one group the boil was never applied (straight lines) */}
      <g style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" }}>
      <g key={fid} filter={`url(#${fid})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {items.flatMap((q) => {
          const u = smooth((c.local - 0.1 - q.i * 0.12) / 0.4); // each one draws on in turn
          const sw = Math.max(6, r * 0.032), at = { d: DOODLE[q.d](q.s), transform: `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - u, opacity: c.k };
          return [
            <path key={`e${q.i}`} {...at} stroke="rgba(18,18,22,0.85)" strokeWidth={sw + 7} />,
            <path key={`l${q.i}`} {...at} stroke={c.p.color ?? "#FFFFFF"} strokeWidth={sw} />,
          ];
        })}
      </g>
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------- glass-type: one huge glass word behind his head
const GlassBack: React.FC<{ c: EditCtx }> = ({ c }) => {
  const s = String(c.p.text ?? "GLASS"), ar = AR.test(s);
  const fs = clamp(1000 / (Math.max(1, s.length) * (ar ? 0.5 : 0.6)), 140, 330);
  // his head (top ~1.1 r above his centre) covers only the foot of the letters at his middle: a bottom bar (E -> F) or a
  // tail stays readable; the word sits as high as the safe box allows
  const top = typeof c.p.y === "number" ? c.p.y - fs / 2 : clamp(c.spot.y - c.spot.r * 1.1 - fs * 0.74, SAFE.y0, SAFE.y1 - fs);
  // Latin: a bright stroke + a frosted fill + a soft top highlight. Arabic: no stroke (it cuts the joins): a fuller fill + glow
  const glass: React.CSSProperties = ar
    ? { backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.45) 60%, rgba(255,255,255,0.6) 100%)", fontWeight: 800 }
    : { backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.34) 55%, rgba(255,255,255,0.5) 100%)", WebkitTextStroke: "3px rgba(255,255,255,0.95)", fontWeight: 400 };
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, textAlign: "center", fontSize: fs, lineHeight: 1, whiteSpace: "nowrap", opacity: c.k,
      transform: `scale(${(0.97 + 0.03 * c.k).toFixed(4)})`, filter: "drop-shadow(0 0 2px rgba(0,0,0,0.55)) drop-shadow(0 0 14px rgba(255,255,255,0.3)) drop-shadow(0 4px 18px rgba(0,0,0,0.5))", ...textStyle(s, SERIF, FONT.arabicEmph) }}>
      <span style={{ ...glass, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{s}</span>
    </div>
  );
};

export const EDITS: Record<string, EditDef> = {
  orbit: { Back: ({ c }) => <Chips c={c} near={false} />, Front: ({ c }) => <Chips c={c} near /> },
  "couch-wall": { Back: CouchBack },
  "ui-world": { Back: UiBack },
  "frame-break": { Back: FrameBack },
  // 1.2 keeps both his hands in frame with room for a gesture (1.4 cut a raised hand). A coin whose arm already reaches
  // the frame edge (x 400, size 1.5) is cut there with or without the zoom: no zoom can show past the footage's edge.
  // Aimed a bit low when the chunk captions are under him, so they land on his feet, not across his body
  "digital-zoom": { cam: (c) => 1 + ((c.p.zoom ?? 1.2) - 1) * c.k,
    focus: (c) => ({ x: c.spot.x + c.spot.r * 0.12, y: c.spot.y + c.spot.r * (c.tl.captions.mode === "chunk" && (c.tl.captions.y ?? 820) > c.spot.y ? 0.8 : 0.15) }) },
  "full-mockup": { Front: MockFront, in: 0.45 },
  checklist: { Front: CheckFront },
  "headline-wall": { Back: HeadlineBack },
  "zoom-through": { through: true }, // the zoom itself is Reel-level (editView): it needs the scene before it too
  "chart-grow": { Back: ChartBack },
  pullback: { view: pullView, Front: PullFront, fixed: true, cover: true, in: 0.5, out: 0.4 },
  "green-screen": { Back: GreenBack, replace: true },
  "paper-cut": { Back: PaperBack, replace: true, coinFilter: sticker, floor: false },
  "doodle-boil": { Front: DoodleFront },
  // dolly zoom: the background grows over the whole scene around his feet (the floor under him stays put) while the coin
  // keeps his size; grows until 0.9 s before the end, then eases back slowly to normal exactly at the cut (the old 0.2 s
  // ease read as a reverse lurch, holding it to the cut moved the snap onto the cut). Needs no Reel change
  vertigo: { bg: (c) => {
    const back = Math.min(0.9, c.dur * 0.35), up = 0.5 - 0.5 * Math.cos(Math.PI * clamp(c.local / (c.dur - back), 0, 1));
    return 1 + ((c.p.amount ?? 1.25) - 1) * up * smooth((c.dur - c.local) / back) * (c.scene.index === 0 ? 1 : smooth(c.local / 0.25));
  } },
  "cover-story": { Back: CoverBack, Front: CoverFront },
  "glass-type": { Back: GlassBack },
};
// one list of names for both sides (timeline.mjs reads edit-names.json): a drift fails loudly at load
for (const n of NAMES) if (!EDITS[n]) throw new Error(`edit-names.json has "${n}" but Edits.tsx EDITS has no entry`);
for (const n of Object.keys(EDITS)) if (!NAMES.includes(n)) throw new Error(`Edits.tsx EDITS has "${n}" but edit-names.json does not`);

/** the edit at absolute time t of scene sc, with its context, or null (no edit / unknown name) */
export const editAt = (tl: Timeline, sc: Scene | undefined, t: number, theme: Theme): { def: EditDef; c: EditCtx } | null => {
  const def = sc?.edit ? EDITS[sc.edit.type] : undefined;
  if (!sc || !def) return null;
  const local = t - sc.start, dur = Math.max(0.01, sc.end - sc.start);
  const next = tl.scenes[sc.index + 1], prev = tl.scenes[sc.index - 1];
  // eases in, except on the first scene (the hook shows at once, and the loop's frame-0 ghost then carries it);
  // eases out, except into a hard cut (the cut itself ends it)
  const kin = sc.index === 0 ? 1 : smooth(local / (def.in ?? 0.25));
  const kout = next && (next.seam === "cut" || tl.seam === false) ? 1 : smooth((dur - local) / (def.out ?? 0.2));
  // two full-frame covers back to back (green-screen then paper-cut, pullback then green-screen): they meet at the cut,
  // never easing through the plain footage between them. ks keeps the own ease (the sticker outline still fades in / out)
  const covers = (d?: EditDef) => !!(d?.replace || d?.cover);
  const rep = (s?: Scene) => !!(s?.edit && covers(EDITS[s.edit.type]));
  const hin = covers(def) && rep(prev) ? 1 : kin, hout = covers(def) && rep(next) ? 1 : kout;
  const spot = coinSpot(tl, sc.index, t) ?? { x: tl.width / 2, y: tl.height * 0.55, r: 220 };
  const { type: _type, ...p } = sc.edit!;
  return { def, c: { p, local, dur, k: Math.min(hin, hout), ks: Math.min(kin, kout), spot, theme, tl, scene: sc } };
};

// ---- the camera: digital-zoom (cam), pullback (view), zoom-through (through) ----
const zoomWin = (w0: Win, z: number, f: { x: number; y: number }, k: number, W: number, H: number): Win => {
  const s2 = w0.s * z, cx = w0.u + W / (2 * w0.s), cy = w0.v + H / (2 * w0.s);
  return { s: s2, u: clamp(cx + (f.x - cx) * k - W / (2 * s2), 0, W - W / s2), v: clamp(cy + (f.y - cy) * k - H / (2 * s2), 0, H - H / s2) };
};
const THROUGH_IN = 0.22, THROUGH_OUT = 0.3;
/** zoom-through at t in scene sc: its own first 0.3 s settle from "zoom" to 1; the last 0.22 s of the scene BEFORE one rise to it */
const throughZ = (tl: Timeline, sc: Scene, t: number, fps: number) => {
  let z = 1;
  if (sc.index > 0 && sc.edit && EDITS[sc.edit.type]?.through) z *= 1 + ((Number(sc.edit.zoom) || 2.6) - 1) * Math.pow(1 - clamp((t - sc.start) / THROUGH_OUT, 0, 1), 3);
  const nx = tl.scenes[sc.index + 1];
  if (nx?.edit && EDITS[nx.edit.type]?.through) z *= 1 + ((Number(nx.edit.zoom) || 2.6) - 1) * Math.pow(clamp((t - (sc.end - THROUGH_IN)) / (THROUGH_IN - 1 / fps), 0, 1), 3);
  return z;
};
/** the camera window this frame with the edits applied (w0 = the cast camera + creep, null = none), and a light blur on
 *  the fast part of a zoom-through. null = no edit touches the camera (Reel keeps its own window, byte-identical) */
export const editView = (tl: Timeline, sc: Scene | undefined, t: number, theme: Theme, w0: Win | null, fps: number): { w: Win; blur: number } | null => {
  if (!sc) return null;
  const e = editAt(tl, sc, t, theme), W = tl.width, H = tl.height;
  const z = throughZ(tl, sc, t, fps), zc = e?.def.cam ? e.def.cam(e.c) : 1;
  if (z === 1 && zc === 1 && !e?.def.view) return null;
  let w = w0 ?? { s: 1, u: 0, v: 0 };
  if (e && zc !== 1) w = zoomWin(w, zc, e.def.focus ? e.def.focus(e.c) : { x: e.c.spot.x, y: e.c.spot.y + e.c.spot.r * 0.15 }, e.c.k, W, H);
  if (e?.def.view) w = e.def.view(e.c, w, W, H);
  let blur = 0;
  if (z !== 1) {
    const sp = coinSpot(tl, sc.index, t) ?? { x: W / 2, y: H * 0.55, r: 220 };
    w = zoomWin(w, z, { x: sp.x, y: sp.y }, clamp((z - 1) / 0.5, 0, 1), W, H);
    const h = 0.5 / fps, rate = Math.abs(Math.log(throughZ(tl, sc, t + h, fps)) - Math.log(throughZ(tl, sc, t - h, fps))) / (2 * h);
    blur = clamp((rate - 1.5) * 0.3, 0, 2); // a hint on the fast part only, never a smear
  }
  return { w, blur };
};

/** paper-cut etc.: scenes whose edit wants no contact shadow / glow under the coin get "floor": false (same tl when none) */
export const withEditFloors = (tl: Timeline): Timeline =>
  tl.scenes.some((s) => s.edit && EDITS[s.edit.type]?.floor === false)
    ? { ...tl, scenes: tl.scenes.map((s) => (s.edit && EDITS[s.edit.type]?.floor === false ? { ...s, floor: false as const } : s)) }
    : tl;

/** the scene whose Sequence shows frame f (Reel.tsx starts each at Math.round(start * fps)): the Reel-level pieces (cam, bg,
 *  Front) must pick the same scene as the Back layer and the footage, or a cut gets one frame of the old scene's edit */
export const sceneOfFrame = (tl: Timeline, f: number, fps: number): Scene | undefined => {
  let cur = tl.scenes[0];
  for (const sc of tl.scenes) if (f >= Math.round(sc.start * fps)) cur = sc;
  return cur;
};

/** an edit's Back or Front layer, inside a div carrying the coin's camera (a "fixed" Front: screen space, given the camera
 *  window as c.view); nothing at all when the scene has none */
export const EditLayer: React.FC<{ which: "Back" | "Front"; tl: Timeline; scene: Scene | undefined; t: number; theme: Theme; cam?: React.CSSProperties; z?: number; view?: Win | null }> = ({ which, tl, scene, t, theme, cam, z, view }) => {
  const e = editAt(tl, scene, t, theme);
  const L = e?.def[which];
  if (!e || !L || e.c.k <= 0) return null;
  const fixed = which === "Front" && e.def.fixed;
  return <AbsoluteFill style={{ pointerEvents: "none", ...(z !== undefined ? { zIndex: z } : {}), ...(fixed ? {} : cam) }}><L c={view ? { ...e.c, view } : e.c} /></AbsoluteFill>;
};
