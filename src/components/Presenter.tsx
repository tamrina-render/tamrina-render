import React from "react";
import { Img, staticFile, useVideoConfig } from "remotion";
import { springIn } from "../lib/mechanics";
import { changePoints, emphasisAt, speakingAt } from "../lib/speech";
import type { PresenterConfig, Theme, Timeline } from "../lib/types";
import { Coin3D } from "./Coin3D";
import { CoinPresenter } from "./CoinPresenter";

/**
 * The cartoon presenter at the bottom of the frame.
 * builtin: a parametric SVG character (beanie, glasses, beard, jacket) with hand poses, blink, idle bob and a mouth
 *          driven by the word timings.  image: a PNG you drop in public/presenter/<name>/body.png (+ optional mouth.png).
 */
type BuiltinColors = Required<Pick<NonNullable<PresenterConfig["colors"]>, "skin" | "beanie" | "jacket" | "shirt" | "hair" | "glasses" | "label">>;
const PRESETS: Record<string, BuiltinColors> = {
  default: { skin: "#F1D2B6", beanie: "#242424", jacket: "#8A8070", shirt: "#F5F2EB", hair: "#2A2320", glasses: "#151515", label: "#E8321E" },
  warm: { skin: "#C98B5E", beanie: "#1E2A3A", jacket: "#5B6B55", shirt: "#F5F2EB", hair: "#1C1612", glasses: "#151515", label: "#E8321E" },
  light: { skin: "#F7E0CF", beanie: "#7A1E1E", jacket: "#3B3B3B", shirt: "#FFFFFF", hair: "#5A3A22", glasses: "#151515", label: "#F5C542" },
};

type Pose = "down" | "up" | "wave" | "point" | "both" | "explain";
const POSES: Pose[] = ["explain", "up", "wave", "explain", "point", "both", "wave", "up"];
// Two-segment arms. a = upper-arm rotation around the shoulder (0 = hanging down, grows outward/up),
// b = elbow bend of the forearm in the same direction. Magnitudes; the right arm is mirrored.
type ArmPose = { a: number; b: number };
const ANGLES: Record<Pose, { l: ArmPose; r: ArmPose }> = {
  down: { l: { a: 12, b: 10 }, r: { a: 12, b: 10 } },
  up: { l: { a: 105, b: 50 }, r: { a: 16, b: 10 } },      // one hand raised high
  wave: { l: { a: 70, b: 40 }, r: { a: 14, b: 8 } },      // arm out to the side, open palm (distinct from "up")
  point: { l: { a: 92, b: 14 }, r: { a: 18, b: 10 } },
  both: { l: { a: 80, b: 60 }, r: { a: 80, b: 60 } },
  explain: { l: { a: 58, b: 70 }, r: { a: 52, b: 62 } },
};
const UPPER = 76, FORE = 68, HAND_OFF = 16;

/** One arm: outlined two-segment limb (round joints) ending in a hand whose fingers point away from the forearm. */
const Arm: React.FC<{ pose: ArmPose; sign: 1 | -1; jacket: string; skin: string; ink: string; point?: boolean }> = ({ pose, sign, jacket, skin, ink, point }) => {
  const br = ((sign * pose.b) * Math.PI) / 180;
  const ex = 0, ey = UPPER;
  const hx = ex - Math.sin(br) * FORE, hy = ey + Math.cos(br) * FORE;
  const px = ex - Math.sin(br) * (FORE + HAND_OFF), py = ey + Math.cos(br) * (FORE + HAND_OFF);
  const d = `M0 0 L${ex} ${ey} L${hx.toFixed(1)} ${hy.toFixed(1)}`;
  return (
    <g transform={`rotate(${sign * pose.a})`}>
      <path d={d} stroke={ink} strokeWidth={56} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={d} stroke={jacket} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <g transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${sign * pose.b + 180}) scale(0.95)`}>
        <Hand c={skin} ink={ink} point={point} />
      </g>
    </g>
  );
};

const poseAt = (tl: Timeline, t: number) => {
  const changes = changePoints(tl);
  let idx = -1;
  for (let i = 0; i < changes.length; i++) if (t >= changes[i]) idx = i;
  const cur = POSES[(idx + POSES.length) % POSES.length];
  const prev = POSES[(idx - 1 + POSES.length) % POSES.length];
  const since = idx >= 0 ? t - changes[idx] : 99;
  return { cur, prev, since };
};

const Hand: React.FC<{ c: string; ink: string; point?: boolean }> = ({ c, ink, point }) => (
  <g>
    <circle r={27} fill={c} stroke={ink} strokeWidth={4} />
    {point ? (
      <path d="M8 -20 L18 -60 Q22 -70 30 -64 L26 -22 Z" fill={c} stroke={ink} strokeWidth={4} />
    ) : (
      <>
        <ellipse cx={-12} cy={-26} rx={7} ry={13} fill={c} stroke={ink} strokeWidth={4} />
        <ellipse cx={4} cy={-29} rx={7} ry={14} fill={c} stroke={ink} strokeWidth={4} />
        <ellipse cx={19} cy={-23} rx={7} ry={12} fill={c} stroke={ink} strokeWidth={4} />
      </>
    )}
  </g>
);

export const Presenter: React.FC<{ tl: Timeline; theme: Theme; t: number }> = ({ tl, theme, t }) => {
  const { fps } = useVideoConfig();
  const cfg = tl.presenter;
  if (!cfg || cfg.type === "none") return null;
  if (cfg.type === "coin") return cfg.render === "3d" ? <Coin3D tl={tl} theme={theme} t={t} cfg={cfg} /> : <CoinPresenter tl={tl} theme={theme} t={t} cfg={cfg} />;
  const scale = cfg.scale ?? 0.92;
  const speaking = speakingAt(tl, t);
  const emph = emphasisAt(tl, t);
  const bob = Math.sin(t * 2.1) * 5 + Math.sin(t * 0.7) * 3;
  const tilt = Math.sin(t * 0.9) * 1.6 + emph * 3;
  // mouth opening 0..1: dips to (almost) closed between syllables instead of a permanent "O"
  const mouth = speaking ? 0.08 + 0.92 * Math.pow(Math.abs(Math.sin(t * 21 + Math.sin(t * 6.3) * 1.5)), 1.6) : 0.02;
  const blinkPhase = (t + 1.3) % 3.3;
  const blink = blinkPhase < 0.13 ? 1 - Math.abs(blinkPhase / 0.065 - 1) : 0;

  if (cfg.type === "image") {
    const name = cfg.name ?? "default";
    return (
      <div style={{ position: "absolute", left: 0, right: 0, bottom: -10, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ transform: `translate(${cfg.x ?? 0}px, ${bob}px) rotate(${tilt * 0.5}deg) scale(${scale})`, transformOrigin: "50% 100%", position: "relative" }}>
          <Img src={staticFile(`presenter/${name}/body.png`)} style={{ height: 780, display: "block" }} />
          {mouth > 0.4 && (
            <Img src={staticFile(`presenter/${name}/mouth.png`)} style={{ position: "absolute", inset: 0, height: 780 }} />
          )}
        </div>
      </div>
    );
  }

  const C = { ...PRESETS[cfg.name ?? "default"] ?? PRESETS.default, ...(cfg.colors ?? {}) };
  const ink = theme.ink;
  const { cur, prev, since } = poseAt(tl, t);
  const s = springIn(since * fps, fps, 0, "pop");
  const mix = (p: ArmPose, c: ArmPose): ArmPose => ({ a: p.a + (c.a - p.a) * s, b: p.b + (c.b - p.b) * s });
  const left = mix(ANGLES[prev].l, ANGLES[cur].l);
  const right = mix(ANGLES[prev].r, ANGLES[cur].r);
  const beard = cfg.beard ?? true;
  const glasses = cfg.glasses ?? true;
  const beanie = cfg.beanie ?? true;

  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: -30, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <svg
        width={860 * scale}
        height={745 * scale}
        viewBox="0 0 600 520"
        style={{ transform: `translate(${cfg.x ?? 0}px, ${bob}px)`, overflow: "visible" }}
      >
        {/* halftone shadow */}
        <ellipse cx={300} cy={515} rx={210} ry={14} fill="rgba(21,21,21,0.12)" />
        {/* right arm (behind body) */}
        <g transform="translate(428 352)">
          <Arm pose={right} sign={-1} jacket={C.jacket} skin={C.skin} ink={ink} />
        </g>
        {/* body */}
        <path d="M110 525 L135 372 Q150 330 205 318 L258 300 L342 300 L395 318 Q450 330 465 372 L490 525 Z" fill={C.jacket} stroke={ink} strokeWidth={4} />
        <path d="M245 300 L300 372 L355 300 Z" fill={C.shirt} stroke={ink} strokeWidth={4} />
        <path d="M258 300 L245 335 M342 300 L355 335" stroke={ink} strokeWidth={4} fill="none" />
        {/* head group */}
        <g transform={`rotate(${tilt} 300 250)`}>
          <rect x={272} y={262} width={56} height={50} fill={C.skin} stroke={ink} strokeWidth={4} />
          <ellipse cx={300} cy={195} rx={92} ry={105} fill={C.skin} stroke={ink} strokeWidth={4} />
          <ellipse cx={209} cy={205} rx={13} ry={18} fill={C.skin} stroke={ink} strokeWidth={4} />
          <ellipse cx={391} cy={205} rx={13} ry={18} fill={C.skin} stroke={ink} strokeWidth={4} />
          {/* mouth: closed = slight smile, open = rounded mouth that narrows as it opens */}
          {mouth < 0.16 ? (
            <path d={`M281 251 Q300 ${256 + mouth * 20} 319 251`} stroke={ink} strokeWidth={4} fill="none" strokeLinecap="round" />
          ) : (
            <>
              <ellipse cx={300} cy={254 + mouth * 3} rx={21 - mouth * 7} ry={3 + mouth * 14} fill="#3B1F1F" stroke={ink} strokeWidth={3} />
              {mouth > 0.45 && <rect x={291} y={247 + mouth * 2} width={18} height={4} rx={1} fill="#fff" />}
            </>
          )}
          {/* beard */}
          {beard && (
            <path
              d="M212 212 Q222 318 300 322 Q378 318 388 212 Q372 272 300 276 Q228 272 212 212 Z"
              fill={C.hair}
              stroke={ink}
              strokeWidth={4}
            />
          )}
          {/* nose */}
          <path d="M300 205 Q290 228 304 232" stroke={ink} strokeWidth={4} fill="none" strokeLinecap="round" />
          {/* eyes */}
          <g transform={`translate(268 194) scale(1 ${1 - blink * 0.92})`}>
            <ellipse rx={13} ry={15} fill="#fff" stroke={ink} strokeWidth={3} />
            <ellipse cx={2} cy={3} rx={7.5} ry={9.5} fill={ink} />
          </g>
          <g transform={`translate(332 194) scale(1 ${1 - blink * 0.92})`}>
            <ellipse rx={13} ry={15} fill="#fff" stroke={ink} strokeWidth={3} />
            <ellipse cx={2} cy={3} rx={7.5} ry={9.5} fill={ink} />
          </g>
          {/* brows */}
          <path d={`M250 ${170 - emph * 6} Q268 ${160 - emph * 8} 286 ${168 - emph * 6}`} stroke={ink} strokeWidth={6} fill="none" strokeLinecap="round" />
          <path d={`M314 ${168 - emph * 6} Q332 ${160 - emph * 8} 350 ${170 - emph * 6}`} stroke={ink} strokeWidth={6} fill="none" strokeLinecap="round" />
          {/* glasses */}
          {glasses && (
            <g fill="none" stroke={C.glasses} strokeWidth={5}>
              <circle cx={268} cy={195} r={28} />
              <circle cx={332} cy={195} r={28} />
              <path d="M296 193 Q300 188 304 193" />
              <path d="M240 190 L212 198 M360 190 L388 198" />
            </g>
          )}
          {/* beanie */}
          {beanie ? (
            <g>
              <path d="M206 140 Q214 60 300 56 Q386 60 394 140 Z" fill={C.beanie} stroke={ink} strokeWidth={4} />
              <rect x={203} y={126} width={194} height={36} rx={12} fill={C.beanie} stroke={ink} strokeWidth={4} />
              <rect x={318} y={136} width={24} height={14} rx={2} fill={C.label} />
              <path d="M225 150 L375 150" stroke="rgba(255,255,255,0.12)" strokeWidth={3} />
            </g>
          ) : (
            <path d="M208 160 Q215 70 300 66 Q385 70 392 160 Q350 120 300 118 Q250 120 208 160 Z" fill={C.hair} stroke={ink} strokeWidth={4} />
          )}
        </g>
        {/* left arm (in front) */}
        <g transform="translate(172 352)">
          <Arm pose={left} sign={1} jacket={C.jacket} skin={C.skin} ink={ink} point={cur === "point"} />
        </g>
      </svg>
    </div>
  );
};
