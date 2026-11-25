import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { easeIn, easeInOut, easeOutBack, lerp, seg } from "./anim";

// A flat 2D phone over a 3D film that shows REAL app screenshots (FactIba version C; same idea as FactZander's PhoneLayer).
// Everything is laid out in real pixels every frame (no CSS scale), so the screenshot stays sharp during the push.
// Times are frames. Image rects are in screenshot pixels.

export type AppPhoneSpec = {
  /** the two screens: before the tap, after it */
  screens: [string, string];
  /** screenshot size */
  img: { w: number; h: number };
  /** rest place of the phone body (frame px): left, top, width */
  rest: { x: number; y: number; w: number };
  /** the push: this screenshot rect is brought to `to` (frame px, its centre) at `zoom` */
  focus: { x0: number; y0: number; x1: number; y1: number };
  to: { x: number; y: number };
  zoom: number;
  /** the button that is tapped (screenshot px) */
  button: { x0: number; y0: number; x1: number; y1: number };
  accent: string;
  /** optional (FactPilates): a glowing ring on rect 1 from on[0], gliding to rect 2 at on[1], gone at off (screenshot px, frames) */
  rings?: { rects: [Rect, Rect]; on: [number, number]; off: number; color?: string };
};
type Rect = { x0: number; y0: number; x1: number; y1: number };

export type AppPhoneTimes = { inF: number; pushF: number; tapF: number; outF: number; swapF?: number /* optional: screen 2 from here (default tapF + 3) */ };

const PAD = 14 / 420; // screen inset as a share of the body width

export const AppPhone: React.FC<{ f: number; t: AppPhoneTimes; spec: AppPhoneSpec }> = ({ f, t, spec }) => {
  const outLen = 14;
  if (f < t.inF || f >= t.outF + outLen) return null;
  const { img, rest } = spec;
  const scW = rest.w * (1 - 2 * PAD); // screen width at rest
  const SC = scW / img.w;
  const pad = rest.w * PAD;
  // rest screen-pixel position of a screenshot point
  const restPt = (ix: number, iy: number) => ({ x: rest.x + pad + ix * SC, y: rest.y + pad + iy * SC });
  const fc = restPt((spec.focus.x0 + spec.focus.x1) / 2, (spec.focus.y0 + spec.focus.y1) / 2);

  const inU = seg(f, t.inF, t.inF + 12, (x) => easeOutBack(x, 1.2));
  const inO = seg(f, t.inF, t.inF + 6, (x) => x);
  const pu = seg(f, t.pushF, t.pushF + 27, easeInOut);
  const outU = seg(f, t.outF, t.outF + outLen, easeIn);
  const k = lerp(0.72, 1, inU) * lerp(1, spec.zoom, pu) * lerp(1, 0.55, outU);
  const A = { x: lerp(fc.x, spec.to.x, pu), y: lerp(fc.y, spec.to.y, pu) + 70 * (1 - inU) - 1300 * outU };
  // map a rest frame point to now
  const M = (p: { x: number; y: number }) => ({ x: A.x + k * (p.x - fc.x), y: A.y + k * (p.y - fc.y) });

  const body = M({ x: rest.x, y: rest.y });
  const bw = rest.w * k;
  const bh = (pad * 2 + img.h * SC) * k;
  const scr = M({ x: rest.x + pad, y: rest.y + pad });
  const sw = scW * k;
  const sh = img.h * SC * k;
  const ik = SC * k; // screenshot px -> frame px now
  const bt = spec.button;
  const btn = { x: (bt.x0) * ik, y: bt.y0 * ik, w: (bt.x1 - bt.x0) * ik, h: (bt.y1 - bt.y0) * ik };

  const swapAt = t.swapF ?? t.tapF + 3;
  const swapU = seg(f, swapAt, swapAt + 5, (x) => x);
  const pr = f - t.tapF;
  const dip = pr >= 0 && pr < 9 ? 1 - 0.06 * Math.sin((pr / 9) * Math.PI) : 1;
  const rip = pr >= 0 && pr < 16 ? pr / 16 : -1;
  const dot = f >= t.tapF - 4 && f < t.tapF + 7 ? (f < t.tapF ? (f - t.tapF + 4) / 4 : 1 - (f - t.tapF) / 7) : 0;

  return (
    <AbsoluteFill
      style={{
        opacity: inO,
        // never reaches the caption band (y 1100): the pushed phone fades out above it
        WebkitMaskImage: `linear-gradient(to bottom, #000 0px, #000 ${lerp(1084, 930, pu)}px, transparent 1090px)`,
        maskImage: `linear-gradient(to bottom, #000 0px, #000 ${lerp(1084, 930, pu)}px, transparent 1090px)`,
      }}
    >
      <div style={{ position: "absolute", left: body.x, top: body.y, width: bw, height: bh, borderRadius: 62 * k * (rest.w / 450), background: "#0C0D10", boxShadow: `0 ${26 * k}px ${50 * k}px rgba(0,0,0,0.45), inset 0 0 0 ${3 * k}px #34363C` }} />
      <div style={{ position: "absolute", left: scr.x, top: scr.y, width: sw, height: sh, borderRadius: 50 * k * (rest.w / 450), overflow: "hidden", background: "#0E0F12" }}>
        <Img src={staticFile(spec.screens[0])} style={{ position: "absolute", left: 0, top: 0, width: sw, height: sh, display: "block", opacity: 1 - swapU }} />
        {swapU > 0 && <Img src={staticFile(spec.screens[1])} style={{ position: "absolute", left: 0, top: 0, width: sw, height: sh, display: "block", opacity: swapU }} />}
        {/* the button, cut out of the same screenshot, dips when pressed */}
        {pr >= 0 && pr < 9 && swapU <= 0 && (
          <div
            style={{
              position: "absolute",
              left: btn.x,
              top: btn.y,
              width: btn.w,
              height: btn.h,
              backgroundImage: `url(${staticFile(spec.screens[0])})`,
              backgroundSize: `${sw}px ${sh}px`,
              backgroundPosition: `${-btn.x}px ${-btn.y}px`,
              transform: `scale(${dip})`,
              borderRadius: btn.h / 2,
            }}
          />
        )}
        {rip >= 0 && (
          <div style={{ position: "absolute", left: btn.x, top: btn.y, width: btn.w, height: btn.h, overflow: "hidden", borderRadius: btn.h / 2 }}>
            <div
              style={{
                position: "absolute",
                left: btn.w * 0.5 - btn.w * 0.6 * rip,
                top: btn.h / 2 - btn.w * 0.6 * rip,
                width: btn.w * 1.2 * rip,
                height: btn.w * 1.2 * rip,
                borderRadius: "50%",
                background: spec.accent,
                opacity: 0.45 * (1 - rip),
              }}
            />
          </div>
        )}
        {dot > 0 && (
          <div style={{ position: "absolute", left: btn.x + btn.w * 0.5 - 22 * k, top: btn.y + btn.h / 2 - 22 * k, width: 44 * k, height: 44 * k, borderRadius: "50%", background: "rgba(255,255,255,0.8)", boxShadow: `0 0 ${14 * k}px rgba(255,255,255,0.7)`, opacity: dot, transform: `scale(${1 - 0.25 * Math.max(0, Math.min(1, (f - t.tapF + 4) / 4))})` }} />
        )}
      </div>
      {spec.rings && <Ring f={f} r={spec.rings} ik={ik} scr={scr} k={k} />}
    </AbsoluteFill>
  );
};

/** FactZander's ring (person -> time row), drawn in the phone's own pixels so it follows the push */
const Ring: React.FC<{ f: number; r: NonNullable<AppPhoneSpec["rings"]>; ik: number; scr: { x: number; y: number }; k: number }> = ({ f, r, ik, scr, k }) => {
  const op = seg(f, r.on[0], r.on[0] + 5, (x) => x) * (1 - seg(f, r.off - 6, r.off, (x) => x));
  if (op <= 0) return null;
  const mv = seg(f, r.on[1], r.on[1] + 8, easeInOut);
  const [a, b] = r.rects;
  const q = { x0: lerp(a.x0, b.x0, mv), y0: lerp(a.y0, b.y0, mv), x1: lerp(a.x1, b.x1, mv), y1: lerp(a.y1, b.y1, mv) };
  const pt = f >= r.on[1] + 6 ? f - r.on[1] - 6 : f - r.on[0];
  const pulse = pt >= 0 && pt < 22 ? Math.sin((pt / 22) * Math.PI) : 0;
  const pad = (6 + 8 * pulse) * k;
  const c = r.color ?? "#C6FF3D";
  return (
    <div
      style={{
        position: "absolute",
        left: scr.x + q.x0 * ik - pad,
        top: scr.y + q.y0 * ik - pad,
        width: (q.x1 - q.x0) * ik + pad * 2,
        height: (q.y1 - q.y0) * ik + pad * 2,
        borderRadius: 22 * k,
        border: `${5 * k}px solid ${c}`,
        boxShadow: `0 0 ${(18 + 26 * pulse) * k}px ${c}`,
        opacity: op,
      }}
    />
  );
};
