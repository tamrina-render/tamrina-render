import React from "react";
import { clamp, easeIn, easeOut, hash, lerp, seg, springAt } from "./anim";

// A flat Greater Cairo map for the last line of videos/waffarha-story, drawn in screen space (1080 x 1920, north up).
// Hand-drawn simplified shapes placed at the areas' real positions (approx. lat / lon); NOT OpenStreetMap boundaries.
// Obour sits at (540, OB_Y) so the pin and its name stay above the caption row (captionY 1170) and Mr. Coin stands below.

export const OB = { lat: 30.23, lon: 31.47 };
export const OB_Y = 680;
const SX = 1500; // px per degree of longitude
const SY = 1730; // px per degree of latitude (cos 30° keeps km square)
export const toXY = (lat: number, lon: number): [number, number] => [540 + (lon - OB.lon) * SX, OB_Y + (OB.lat - lat) * SY];

type Area = { name: string; lat: number; lon: number; r: number; label?: boolean; mark?: boolean; markAt?: [number, number] }; // markAt: the «؟» offset from the name (default just above it)
/** the areas (Sheikh Zayed and 6th of October fall off the left edge at this framing, so they are left out) */
export const AREAS: Area[] = [
  { name: "العاشر من رمضان", lat: 30.3, lon: 31.74, r: 120, mark: true },
  { name: "بدر", lat: 30.14, lon: 31.72, r: 72, mark: true },
  { name: "الشروق", lat: 30.12, lon: 31.61, r: 82, mark: true },
  { name: "السلام", lat: 30.17, lon: 31.42, r: 62, mark: true, markAt: [-75, 0] }, // beside its name: above it would touch «العبور»
  { name: "القاهرة الجديدة", lat: 30.03, lon: 31.47, r: 130, mark: true },
  { name: "مدينة نصر", lat: 30.06, lon: 31.34, r: 62 },
  { name: "مصر الجديدة", lat: 30.09, lon: 31.32, r: 52, mark: true },
  { name: "شبرا", lat: 30.1, lon: 31.245, r: 44 },
  { name: "وسط البلد", lat: 30.045, lon: 31.235, r: 36 },
  { name: "الجيزة", lat: 30.01, lon: 31.21, r: 70 },
  { name: "المعادي", lat: 29.96, lon: 31.26, r: 56 },
  { name: "حلوان", lat: 29.85, lon: 31.33, r: 84 },
];
/** where each «؟» sits (just above the area's name), left to right = the order they pop and he looks */
export const MARKS = AREAS.filter((a) => a.mark)
  .map((a) => { const [x, y] = toXY(a.lat, a.lon); const [dx, dy] = a.markAt ?? [0, -44]; return { name: a.name, x: x + dx, y: y + dy }; })
  .sort((p, q) => p.x - q.x);

/** a soft irregular blob around (cx, cy) (seeded, so every frame draws the same shape) */
const blob = (cx: number, cy: number, r: number, seed: number) => {
  const n = 10;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.78 + 0.4 * hash(seed * 13.1 + i * 3.7));
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9];
  });
  // closed Catmull-Rom -> cubic Bezier
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + " Z";
};
const line = (ll: [number, number][]) => ll.map(([la, lo], i) => { const [x, y] = toXY(la, lo); return `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ");
// the Nile, south to north, splitting into the Rosetta and Damietta branches north of the city
const NILE = line([[29.7, 31.3], [29.8, 31.29], [29.9, 31.27], [29.98, 31.24], [30.04, 31.228], [30.1, 31.23], [30.16, 31.2], [30.19, 31.14]]);
const ROSETTA = line([[30.19, 31.14], [30.25, 31.07], [30.33, 31.0], [30.45, 30.92]]);
const DAMIETTA = line([[30.19, 31.14], [30.24, 31.17], [30.31, 31.21], [30.42, 31.25], [30.55, 31.27]]);
const RING = (() => { const [cx, cy] = toXY(30.06, 31.3); return { cx, cy, rx: 0.15 * SX, ry: 0.1 * SY }; })();

const AR = "IBM Plex Sans Arabic";
const LIME = "#D6FF3C";

export const CairoMap: React.FC<{ f: number; show: number; obourAt: number; marksAt: number; markStep: number; noBg?: boolean /* the caller draws the backdrop (FactTunnel moves the map) */ }> = ({ f, show, obourAt, marksAt, markStep, noBg }) => {
  if (show <= 0.001) return null;
  const lit = seg(f, obourAt - 4, obourAt + 8, easeOut);
  const [ox, oy] = toXY(OB.lat, OB.lon);
  // the pin drops onto Obour on «العبور» and squashes once
  const dropU = seg(f, obourAt - 2, obourAt + 8, easeIn);
  const pinY = f < obourAt - 2 ? -1 : lerp(-420, 0, dropU);
  const sq = f >= obourAt + 8 ? 1 - 0.16 * Math.exp(-(f - obourAt - 8) / 4) * Math.cos((f - obourAt - 8) * 0.9) : 1;
  const ring = seg(f, obourAt + 8, obourAt + 30, easeOut);
  const glow = 0.75 + 0.25 * Math.sin(f * 0.15);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, opacity: show }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", left: 0, top: 0 }}>
        <defs>
          <radialGradient id="cmBg" cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor="#1A2130" />
            <stop offset="100%" stopColor="#0B0E15" />
          </radialGradient>
          <filter id="cmGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        {!noBg && <rect x={0} y={0} width={1080} height={1920} fill="url(#cmBg)" />}
        {/* the ring road, then the Nile on top of it */}
        <ellipse cx={RING.cx} cy={RING.cy} rx={RING.rx} ry={RING.ry} fill="none" stroke="#4E586E" strokeWidth={4} strokeDasharray="14 8" opacity={0.85} />
        {[NILE, ROSETTA, DAMIETTA].map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#6FA8DC" strokeWidth={i ? 6 : 9} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        ))}
        {/* the dark areas */}
        {AREAS.map((a, i) => {
          const [x, y] = toXY(a.lat, a.lon);
          return <path key={a.name} d={blob(x, y, a.r, i + 2)} fill="#1E2535" stroke="#5A6580" strokeWidth={3} />;
        })}
        {/* Obour: dark fill + a lime edge and glow once lit (the lime coin never stands on a flat lime fill) */}
        {lit > 0 && <path d={blob(ox, oy, 92, 1)} fill="none" stroke={LIME} strokeWidth={22} opacity={0.5 * lit * glow} filter="url(#cmGlow)" />}
        <path d={blob(ox, oy, 92, 1)} fill={lit > 0.5 ? "#28330F" : "#202839"} stroke={lit > 0 ? LIME : "#56617A"} strokeWidth={lerp(3, 6, lit)} />
        {ring > 0 && ring < 1 && <circle cx={ox} cy={oy} r={20 + 90 * ring} fill="none" stroke={LIME} strokeWidth={5} opacity={1 - ring} />}
        {/* the pin (tip on Obour's centre) */}
        {pinY > -1 && (
          <g transform={`translate(${ox} ${oy + pinY}) scale(1 ${sq})`}>
            <path d="M 0 0 C -10 -24 -34 -42 -34 -68 A 34 34 0 1 1 34 -68 C 34 -42 10 -24 0 0 Z" fill={LIME} stroke="#0E0F12" strokeWidth={4} />
            <circle cx={0} cy={-68} r={13} fill="#0E0F12" />
          </g>
        )}
      </svg>
      {/* area names (dark, so Obour stands out) */}
      {AREAS.filter((a) => a.label !== false).map((a) => {
        const [x, y] = toXY(a.lat, a.lon);
        const fs = a.name.length > 9 ? 26 : 30;
        return (
          <div key={a.name} dir="rtl" style={{ position: "absolute", left: x - 110, top: y - fs * 0.7, width: 220, textAlign: "center", fontFamily: AR, fontWeight: 700, fontSize: fs, lineHeight: 1.2, color: "#AEB6C8", textShadow: "0 2px 6px rgba(0,0,0,0.9)" }}>
            {a.name}
          </div>
        );
      })}
      <div dir="rtl" style={{ position: "absolute", left: ox - 160, top: oy + 14, width: 320, textAlign: "center", fontFamily: AR, fontWeight: 800, fontSize: lerp(30, 46, lit), lineHeight: 1.2, color: lit > 0.5 ? LIME : "#A3ACC0", textShadow: lit > 0.5 ? "0 0 16px rgba(214,255,60,0.7), 0 3px 8px rgba(0,0,0,0.9)" : "0 2px 6px rgba(0,0,0,0.9)" }}>
        العبور
      </div>
      {/* «؟» on the other areas, one by one, left to right */}
      {MARKS.map((m, k) => {
        const s = clamp(springAt(f, marksAt + k * markStep, 0.55, 4), 0, 1.25);
        if (s <= 0) return null;
        return (
          <div key={m.name} style={{ position: "absolute", left: m.x - 34, top: m.y - 34, width: 68, height: 68, borderRadius: 34, background: "rgba(14,17,26,0.92)", border: "3px solid #7A849C", color: "#E8ECF4", fontFamily: AR, fontWeight: 800, fontSize: 44, lineHeight: "62px", textAlign: "center", transform: `scale(${s})` }}>
            ؟
          </div>
        );
      })}
    </div>
  );
};
