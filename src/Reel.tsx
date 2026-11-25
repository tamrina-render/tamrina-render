import React from "react";
import { AbsoluteFill, Audio, Freeze, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Headline } from "./components/Headline";
import { GameShowSet, INK_OUTLINE, Iris, Judge, SilentDamage, SilentScreen } from "./components/Looks";
import { Chunk, Karaoke } from "./components/Karaoke";
import { Paper } from "./components/Paper";
import { cameraAt } from "./components/Coin3D";
import { EditLayer, editAt, editView, feetOf, sceneOfFrame, withEditFloors } from "./components/Edits";
import { Presenter } from "./components/Presenter";
import { SectionLabel } from "./components/SectionLabel";
import { VISUALS } from "./components/visuals";
import { applyFontSet, FONT } from "./lib/fonts";
import { applyMotionProfile, flash, seam, stageTransform, whipPan, zoomKick } from "./lib/mechanics";
import { hash, lookOf, sceneAt, SILENT_FPS } from "./lib/looks";
import { isRTL } from "./lib/text";
import { resolveTheme } from "./lib/theme";
import { useFonts } from "./lib/useFonts";
import type { Scene, Theme, Timeline } from "./lib/types";

/** {cue} names in a scene without their coin prefix ("mrs:push" -> "push") */
const cueNames = (sc: Scene) => (sc.cues ?? []).map((c) => ({ t: c.t, name: c.name.includes(":") ? c.name.split(":")[1] : c.name }));
const easeIO = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

// Small card visuals are scaled up so they fill the stage (readable mono labels on a phone, no dead paper band).
// Phone / chart / cards / layers / stamp / checklist already fill it and stay at 1.
const VISUAL_FIT: Record<string, number> = { counter: 1.3, bignum: 1.25, pipeline: 1.28, gauge: 1.2, calendar: 1.3, terminal: 1.1, prompt: 1.1, layers: 1.12,
  chat: 1.22, map: 1.12, checkin: 1.3, wallet: 1.4, gym: 1.28, verify: 1.2, stores: 1.15, stamp: 1.15, swipe: 1.02 };

/** One fixed TikTok-style caption for the whole video (script "caption"): centred, *marks* in the accent, a thin handle above. */
const FixedCaption: React.FC<{ c: NonNullable<Timeline["caption"]>; theme: Theme; handle?: string }> = ({ c, theme, handle }) => {
  const size = c.size ?? 64, y = c.y ?? 600, rtlC = /[؀-ۿ]/.test(c.text); // any Arabic = an RTL line ("POV:" first = on the right)
  const parts = c.text.split(/(\*[^*]+\*)/).filter(Boolean);
  const shadow = "0 2px 6px rgba(0,0,0,0.9), 0 0 28px rgba(0,0,0,0.65)";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 40, right: 40, top: y - size * (handle ? 1.25 : 0.7), textAlign: "center", direction: rtlC ? "rtl" : "ltr" }}>
        {handle && <div style={{ fontFamily: FONT.head, fontWeight: 300, fontSize: Math.round(size * 0.44), letterSpacing: 2, color: "#F4F5F7", opacity: 0.9, textShadow: shadow, marginBottom: Math.round(size * 0.2), direction: "ltr" }}>{handle}</div>}
        <div style={{ fontFamily: rtlC ? FONT.arabic : FONT.head, fontWeight: 700, fontSize: size, lineHeight: 1.35, color: "#F4F5F7", textShadow: shadow }}>
          {parts.map((p, i) => p.startsWith("*") && p.endsWith("*")
            ? <span key={i} style={{ color: c.color ?? theme.accent, fontFamily: /[؀-ۿ]/.test(p) ? FONT.arabicEmph : FONT.head, fontWeight: 800 }}>{p.slice(1, -1)}</span>
            : <span key={i}>{p}</span>)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
// ---- quiet extras (all opt-in; numbers in guides/motion.md "Quiet extras") ----
/** slow motion: picture time inside a scene's window. Slowest (rate) in the middle, speed back to 1 at both ends, and
 *  the same time as the sound at both ends (the shoulders run up to 1 + 0.51 x (1 - rate) faster). null = no window now */
const slowAt = (tl: Timeline, t: number): number | null => {
  for (const sc of tl.scenes) {
    const w = sc.slowmo;
    if (!w || t <= w.t0 || t >= w.t1) continue;
    const u = (t - w.t0) / (w.t1 - w.t0);
    return w.t0 + (w.t1 - w.t0) * (u - (1 - w.rate) * (Math.sin(4 * Math.PI * u) / (8 * Math.PI) - Math.sin(2 * Math.PI * u) / (4 * Math.PI)));
  }
  return null;
};
/** creep zoom: eases to the scene's "creep" over the whole scene; a scene without it eases back to 1 in 0.6 s; a fade through black or a cut to another picture starts from 1 */
const creepAt = (tl: Timeline, t: number): number => {
  let level = 1;
  for (const sc of tl.scenes) {
    if (t < sc.start) break;
    const prev = tl.scenes[sc.index - 1];
    const from = sc.fade || ((sc.seam === "cut" || tl.seam === false) && sc.footage?.src !== prev?.footage?.src) ? 1 : level; // under a fade's black, or on a cut to another picture, it starts again from 1
    const to = sc.creep ?? 1;
    const k = Math.min(1, (t - sc.start) / (sc.creep ? sc.end - sc.start : 0.6));
    level = from + (to - from) * (1 - Math.cos(Math.PI * k)) / 2;
    if (t < sc.end) break;
    level = to;
  }
  return level;
};
/** fade through black: 0..1, up over the half before a "fade" scene's cut, down over the half after it */
const fadeAt = (tl: Timeline, t: number): number => {
  let v = 0;
  for (const sc of tl.scenes) if (sc.fade && sc.index > 0) v = Math.max(v, 1 - Math.abs(t - sc.start) / (sc.fade / 2));
  return v;
};
/** the music's volume: dips under every placed / movement sound (not the layers), 0.08 s in, 0.3 s back */
const musicVolume = (tl: Timeline, t: number): number => {
  const m = tl.music!;
  if (!m.duck) return m.volume;
  let d = 0;
  for (const c of tl.sfx ?? []) if (c.key !== "layer") d = Math.max(d, Math.min(1, (t - c.t) / 0.08 + 1, 1 - (t - c.t - c.dur) / 0.3));
  return m.volume * (1 - (1 - Math.pow(10, -(m.duck === true ? 5 : m.duck) / 20)) * Math.max(0, d));
};
const LOOP_FADE = 0.4;

const DEFAULT_LAYOUT ={ labelTop: 54, headTop: 108, stageTop: 380, stageH: 860 };
const BRAND_LAYOUT = { labelTop: 150, headTop: 214, stageTop: 470, stageH: 800 };

/** Real footage (video or photo) filling the frame behind a scene; a dark band on top keeps the headline readable. */
const Footage: React.FC<{ f: NonNullable<Scene["footage"]>; fps: number; local: number; cam?: React.CSSProperties; mute?: boolean }> = ({ f, fps, local, cam, mute }) => {
  const cover: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };
  const still = /\.(jpe?g|png|webp)$/i.test(f.src);
  const media = still
    ? <Img src={staticFile(f.src)} style={{ ...cover, transform: `scale(${(1.04 + (f.hold ? 0 : local * 0.006)).toFixed(4)})` }} />
    : <OffthreadVideo src={staticFile(f.src)} startFrom={Math.round((f.from ?? 0) * fps)} volume={mute ? 0 : f.volume ?? 1} style={cover} />;
  return (
    <AbsoluteFill>
      {/* the scene camera moves the picture; the dark band for the headline stays put */}
      {cam ? <AbsoluteFill style={cam}>{media}</AbsoluteFill> : media}
      {f.band !== false && <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 22%, rgba(0,0,0,0) 36%)" }} />}
    </AbsoluteFill>
  );
};

const isStill = (src?: string) => !!src && /\.(jpe?g|png|webp)$/i.test(src);
/** image reels: a still dissolves in over the previous still (default 0.5 s) so there are no visible cuts between stills */
const xfDur = (tl: Timeline, sc: Scene): number => {
  const prev = tl.scenes[sc.index - 1];
  if (!prev || !isStill(sc.footage?.src) || !isStill(prev.footage?.src) || sc.footage?.src === prev.footage?.src) return 0;
  return (sc.footage as any)?.xfade ?? 0.5;
};
const xfOpacity = (tl: Timeline, sc: Scene, local: number): number => {
  const d = xfDur(tl, sc);
  if (!d) return 1;
  const k = Math.min(1, Math.max(0, local / d));
  return k * k * (3 - 2 * k);
};

const SceneView: React.FC<{ scene: Scene; tl: Timeline; theme: Theme; rtl: boolean; cam?: React.CSSProperties; bgCam?: React.CSSProperties }> = ({ scene, tl, theme: theme0, rtl, cam, bgCam = cam }) => {
  // duo videos: this scene's headline + visual use the speaker's colour
  const theme: Theme = scene.accent ? { ...theme0, accent: scene.accent, soft: scene.accent + "24" } : theme0;
  const frame = useCurrentFrame(); // local to the Sequence
  const { fps } = useVideoConfig();
  const local = frame / fps;
  const t = scene.start + local;
  const events = [...scene.events, ...tl.events];
  const type = scene.visual?.type ?? "none";
  const Visual = VISUALS[type];
  const fit = scene.visual?.props?.fit ?? VISUAL_FIT[type] ?? 1;
  const stage = stageTransform(local, events, scene.index, 4);
  const push = cueNames(scene).find((c) => c.name === "push");
  const pushX = push ? (1 - easeIO(Math.min(1, Math.max(0, t - push.t) / 1.0))) * 1150 : 0;
  const peek = cueNames(scene).some((c) => c.name === "peek") || scene.behind === true || (typeof scene.behind === "number" && local < scene.behind); // the card covers the coin (he is behind it)
  const mode = tl.captions.mode;
  const showHeadline = mode === "headline" || mode === "both";
  const showKaraoke = mode === "karaoke" || mode === "both";
  // stage band: below the headline, above the presenter's head (~y 1330); leaves room for the karaoke pill when shown
  // brand layouts keep text inside the Reels/TikTok safe zone (top bar ~200 px, caption + buttons at the bottom)
  const L = tl.brand === "tamrina" ? BRAND_LAYOUT : DEFAULT_LAYOUT;
  const top = showHeadline ? L.stageTop : 200;
  const height = showHeadline ? (showKaraoke ? 760 : L.stageH) : 990;
  // scene seam: no entry on the first scene (the hook shows at once), no exit on the last (the coin's exit ends it),
  // "seam": "cut" on a scene = hard cut into it (bursts, the end card), timeline "seam": false = old hard cuts everywhere
  const last = scene.index === tl.scenes.length - 1;
  const next = tl.scenes[scene.index + 1];
  // film looks cut hard (game show: on the bar with a flash; silent film: straight cuts / iris)
  const look = lookOf(tl, scene), nextLook = next ? lookOf(tl, next) : "none";
  const sm = tl.seam === false ? {} : seam(local, scene.end - scene.start, rtl ? -1 : 1,
    { entry: scene.index > 0 && scene.seam !== "cut" && look === "none" && lookOf(tl, tl.scenes[scene.index - 1]) === "none",
      exit: !last && next?.seam !== "cut" && look === "none" && nextLook === "none" });
  const game = look === "gameshow";
  return (
    <>
    {/* {peek} lifts the card over the coin; the footage stays under him (a full-frame photo would hide him) */}
    {peek && scene.footage && <AbsoluteFill style={{ zIndex: 0 }}><Footage f={scene.footage} fps={fps} local={local} cam={bgCam} mute={tl.ghost} /><EditLayer which="Back" tl={tl} scene={scene} t={t} theme={theme} cam={cam} /></AbsoluteFill>}
    <AbsoluteFill style={{ zIndex: peek ? 2 : 0 }}>
      {!peek && scene.footage && <div style={{ position: 'absolute', inset: 0, opacity: xfOpacity(tl, scene, local) }}><Footage f={scene.footage} fps={fps} local={local} cam={bgCam} mute={tl.ghost} /></div>}
      {/* a named edit's back layer (Edits.tsx): over the footage, under the coin and this scene's text */}
      {!peek && <EditLayer which="Back" tl={tl} scene={scene} t={t} theme={theme} cam={cam} />}
      {tl.text !== false && mode !== "chunk" && <SectionLabel scene={scene} theme={theme} local={local} dir={tl.dir} top={L.labelTop} varsity={tl.brand === "tamrina"} handle={tl.handle} />}
      {/* text + card ride the seam (cut the curve); the footage and the coin stay put and carry the eye across the cut */}
      <AbsoluteFill style={{ ...sm }}>
      {/* the real person's line in a footage scene (the coin is silent there, so no word timings) */}
      {tl.text !== false && scene.footage?.caption && !scene.words.length && (
        <div style={{ position: "absolute", top: L.headTop, left: 60, right: 60, textAlign: "center", direction: rtl ? "rtl" : "ltr", fontFamily: rtl ? FONT.arabic : FONT.head, fontWeight: 600, fontSize: 56, lineHeight: 1.3, color: "#fff", textShadow: "0 3px 12px rgba(0,0,0,0.8)", opacity: Math.min(1, local / 0.2) }}>{scene.footage.caption}</div>
      )}
      {showHeadline && scene.headline !== false && <Headline scene={scene} theme={look === "silent" ? { ...theme, ink: "#17130f", accent: "#5a1d0e" } : theme} t={t} lead={tl.captions.lead} rtl={rtl} lang={tl.lang} top={L.headTop} telop={game} />}
      {/* visual stage */}
      <div style={{ position: "absolute", left: 40, right: 40, top, height, transformOrigin: "50% 50%", ...stage, transform: `translateX(${pushX.toFixed(1)}px) ${stage.transform} scale(${fit})`, filter: game ? INK_OUTLINE : stage.filter }}>
        {Visual && (
          <Visual
            t={t}
            local={local}
            frame={frame}
            fps={fps}
            scene={scene}
            tl={tl}
            theme={theme}
            events={events}
            props={scene.visual.props ?? {}}
            rtl={rtl}
          />
        )}
      </div>
      {showKaraoke && scene.headline !== false && <Karaoke scene={scene} theme={theme} t={t} lead={tl.captions.lead} rtl={rtl} y={showHeadline ? 1160 : 1120} />}
      </AbsoluteFill>
    </AbsoluteFill>
    </>
  );
};

export const Reel: React.FC<Timeline> = (tl) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // brand switches are module-level and set on every frame from the same props -> deterministic renders
  applyFontSet(tl.brand);
  applyMotionProfile(tl.motion ?? (tl.brand === "tamrina" ? "calm" : "reel"));
  const theme: Theme = resolveTheme(tl.theme);
  const rtl = tl.dir === "rtl" || isRTL(tl.lang);
  useFonts();
  const presTl = React.useMemo(() => withEditFloors(tl), [tl]); // paper-cut: no contact shadow under the sticker outline
  const allEvents = [...tl.events, ...tl.scenes.flatMap((s) => s.events)];
  const fl = flash(t, allEvents);
  // global events (injected by the self-scoring fix pass) kick the WHOLE frame, so a fix always produces motion
  const gk = zoomKick(t, tl.events, 1.06, 0.4);
  const gw = whipPan(t, tl.events, 0.43, 40);
  let shx = 0, shy = 0, punch = 1, freeze: { t: number; label: string } | null = null;
  for (const sc of tl.scenes) for (const c of cueNames(sc)) {
    const d = t - c.t;
    if (c.name === "shake" && d >= 0 && d < 0.55) { const e = 1 - d / 0.55; shx += Math.sin(d * 70) * 22 * e; shy += Math.cos(d * 55) * 14 * e; }
    if (c.name === "punch" && d >= 0 && d < 0.6) punch += 0.16 * Math.sin(Math.min(1, d / 0.12) * Math.PI / 2) * (1 - Math.max(0, d - 0.12) / 0.48);
    if (c.name === "freeze" && d >= 0 && d < 1.6) freeze = { t: c.t, label: sc.freeze ?? "" };
  }
  // film looks (src/lib/looks.ts)
  const cur = sceneAt(tl, t);
  const look = lookOf(tl, cur);
  const silent = look === "silent", game = look === "gameshow";
  const curLocal = t - (cur?.start ?? 0);
  // silent film: the picture is hand-cranked at 16 fps, the print damage below changes every frame
  const slow = slowAt(tl, t);
  const ft = freeze ? freeze.t : silent ? Math.floor(t * SILENT_FPS) / SILENT_FPS : slow ?? t;
  const flick = silent ? 1 + (hash(frame) - 0.5) * 0.14 : 1;
  const weave = silent ? { x: (hash(frame * 2) - 0.5) * 3, y: (hash(frame * 3) - 0.5) * 4 + (frame % 97 < 2 ? -14 : 0) } : { x: 0, y: 0 };
  const print = silent ? `grayscale(1) sepia(0.3) contrast(1.35) brightness(${flick.toFixed(3)})` : undefined;
  // iris in when a silent stretch starts, iris out when it ends (and at the very end)
  let iris = 9999;
  if (silent && cur) {
    const prev = tl.scenes[cur.index - 1], next = tl.scenes[cur.index + 1];
    if (!prev || lookOf(tl, prev) !== "silent") iris = Math.min(iris, 1150 * Math.pow(Math.min(1, curLocal / 0.6), 1.6));
    const left = cur.end - t;
    if (!next || lookOf(tl, next) !== "silent") iris = Math.min(iris, 1150 * Math.pow(Math.min(1, left / 0.5), 1.6));
  }
  // game show: hard cut on the scene change + a short white flash + a beat punch
  const gameCut = game && cur && cur.index > 0 ? curLocal : 99;
  const gameFlash = gameCut < 0.1 ? 0.75 * (1 - gameCut / 0.1) : 0;
  const gamePunch = gameCut < 0.3 ? 1 + 0.04 * Math.exp(-gameCut / 0.06) : 1;
  const judges = tl.scenes.flatMap((sc) => lookOf(tl, sc) === "gameshow" ? cueNames(sc).filter((c) => c.name === "judge").map((c) => ({ t: c.t, label: sc.judge ?? "PERFECT!", accent: sc.accent ?? theme.accent })) : []);
  const onFootage = !!tl.scenes.find((sc) => t >= sc.start && t < sc.end)?.footage;
  const fd = freeze ? t - freeze.t : 0;
  // the scene camera (cast videos, src/components/Coin3D cameraAt): one crop window over the background, the footage and
  // the coins + ball; the headline, captions and cards stay fixed on top. null (single coin, duo) = no transform at all
  let cw = cameraAt(tl, ft);
  // creep zoom: the same window, a little tighter around its own centre (works without a cast too)
  const creep = creepAt(tl, ft);
  if (creep !== 1) { const w0 = cw ?? { u: 0, v: 0, s: 1 }, s2 = w0.s * creep; cw = { ...w0, s: s2, u: w0.u + tl.width / (2 * w0.s) - tl.width / (2 * s2), v: w0.v + tl.height / (2 * w0.s) - tl.height / (2 * s2) }; }
  // a named edit (Edits.tsx) on the scene now: "cam" = a zoom on the whole picture toward the coin, "bg" = a scale on the
  // background only (footage + front) around him. Nothing changes when the scene has no edit
  const edScene = sceneOfFrame(tl, Math.round(ft * fps), fps);
  const ed = editAt(tl, edScene, ft, theme);
  const ev = editView(tl, edScene, ft, theme, cw, fps); // digital-zoom, pullback, zoom-through (also the scene before one)
  if (ev) cw = ev.w;
  const eb = ed?.def.bg ? ed.def.bg(ed.c) : 1;
  const fadeK = fadeAt(tl, t);
  const cam: React.CSSProperties | undefined = cw ? { transform: `translate(${(-cw.u * cw.s).toFixed(2)}px, ${(-cw.v * cw.s).toFixed(2)}px) scale(${cw.s.toFixed(4)})`, transformOrigin: "0 0" } : undefined;
  const { x: px, y: py } = ed ? feetOf(ed.c.spot) : { x: 0, y: 0 };
  const bgCam: React.CSSProperties | undefined = eb !== 1
    ? { transform: `${cam?.transform ?? ""} translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) scale(${eb.toFixed(4)}) translate(${(-px).toFixed(1)}px, ${(-py).toFixed(1)}px)`, transformOrigin: "0 0" }
    : cam;
  // the coin's own filter (phone-camera grade on footage) + an edit's (paper-cut sticker outline), composed
  const baseF = silent ? `contrast(1.12) saturate(0.85) brightness(${flick.toFixed(3)})` : onFootage ? "saturate(0.9) contrast(0.95) brightness(0.97) blur(0.3px)" : undefined;
  const coinF = ed?.def.coinFilter ? ed.def.coinFilter(ed.c) : "";
  const frontOn = ed?.def.replace ? 1 - ed.c.k : 1; // a replaced background takes the set's "front" PNG with it
  return (
    <AbsoluteFill style={{ fontFamily: rtl ? FONT.arabic : FONT.head, color: theme.ink, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, filter: print, ...cam }}>{game && cur ? <GameShowSet index={cur.index} t={t} /> : silent ? <SilentScreen /> : <Paper theme={theme} t={ft} />}</div>
      {tl.audio && <Audio src={staticFile(tl.audio)} />}
      {tl.music && <Audio src={staticFile(tl.music.src)} volume={musicVolume(tl, t)} loop />}
      {/* sound effects: one per movement, already clipped so none overlap (timeline.mjs); short fade-out at the cut */}
      {(tl.sfx ?? []).map((c, k) => {
        const dur = Math.max(2, Math.round(c.dur * fps));
        return (
          <Sequence key={`sfx${k}`} from={Math.round(c.t * fps)} durationInFrames={dur} layout="none">
            <Audio src={staticFile(c.src)} volume={(f) => c.volume * Math.min(1, (dur - f) / 3)} />
          </Sequence>
        );
      })}
      <AbsoluteFill style={{ transform: `translate(${(gw.x + shx + weave.x).toFixed(2)}px, ${(shy + weave.y).toFixed(2)}px) scale(${(gk * punch * gamePunch * (freeze ? 1 + 0.05 * Math.min(1, fd / 0.15) : 1)).toFixed(4)})`, transformOrigin: "50% 45%", filter: freeze ? "grayscale(1) contrast(1.1)" : gw.blur > 0.2 ? `blur(${gw.blur.toFixed(2)}px)` : ev && ev.blur > 0.05 ? `blur(${ev.blur.toFixed(2)}px)` : undefined }}>
        <Freeze frame={Math.round(ft * fps)} active={!!freeze || silent || slow !== null}>
        <div style={{ position: "absolute", inset: 0, filter: print }}>
        {tl.scenes.map((sc) => {
          const from = Math.round(sc.start * fps);
          const dur = Math.max(1, Math.round(sc.end * fps) - from) + (sc === tl.scenes[tl.scenes.length - 1] ? 2 : 0); // to the next scene's first frame: rounding the length by itself left a one-frame hole (the dark stage flashed) when a cut fell between two frames
          const xd = xfDur(tl, sc);
          return (
            <React.Fragment key={sc.id}>
            {xd > 0 && <Sequence from={from} durationInFrames={Math.round(xd * fps) + 1} name={`${sc.id} · dissolve from previous`}><AbsoluteFill><Footage f={tl.scenes[sc.index - 1].footage!} fps={fps} local={0} cam={bgCam} mute /></AbsoluteFill></Sequence>}
            <Sequence from={from} durationInFrames={dur} name={`${sc.id} · ${sc.label}`}>
              <SceneView scene={sc} tl={tl} theme={theme} rtl={rtl} cam={cam} bgCam={bgCam} />
            </Sequence>
            </React.Fragment>
          );
        })}
        </div>
        {/* on real footage the coin is graded toward a phone camera: a touch less saturated / contrasty, slightly soft */}
        <div style={{ position: "absolute", inset: 0, zIndex: 1, ...cam, filter: coinF ? `${baseF ?? ""} ${coinF}`.trim() : baseF }}><Presenter tl={presTl} theme={theme} t={ft} /></div>
        {/* script "front": the part of the set in front of the coin (a steering wheel), same crop + camera as a held photo */}
        {tl.front && frontOn > 0 && <div style={{ position: "absolute", inset: 0, zIndex: 2, ...bgCam, ...(frontOn < 1 ? { opacity: frontOn } : {}) }}><Img src={staticFile(tl.front)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.04)" }} /></div>}
        {/* a named edit's front layer (Edits.tsx): over the coin and "front", under the captions, on his camera */}
        <EditLayer which="Front" tl={tl} scene={edScene} t={ft} theme={theme} cam={cam} z={3} view={cw} />
        </Freeze>
      </AbsoluteFill>
      {freeze && (
        // meme freeze frame: the label slams in on a slanted band
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: 1290, left: -40, right: -40, transform: `rotate(-4deg) scale(${Math.min(1, fd / 0.12) * (1 + 0.08 * Math.sin(Math.min(1, fd / 0.3) * Math.PI))})`, background: theme.accent, padding: "26px 60px", boxShadow: "0 12px 0 rgba(0,0,0,0.5)", textAlign: "center" }}>
            <div style={{ fontFamily: rtl ? FONT.arabicEmph : FONT.head, fontWeight: 800, fontSize: 64, color: theme.onAccent, direction: rtl ? "rtl" : "ltr", lineHeight: 1.15 }}>{freeze.label}</div>
          </div>
          <div style={{ position: "absolute", top: 400, left: 70, fontFamily: FONT.head, fontWeight: 800, fontSize: 40, color: "#fff", background: "rgba(0,0,0,0.6)", padding: "6px 18px", borderRadius: 8, letterSpacing: 2 }}>❚❚ PAUSE</div>
        </AbsoluteFill>
      )}
      {/* footage scenes: one grain + vignette over everything, so the coin and the real video share the same "camera" */}
      {onFootage && tl.presenter?.look?.grain !== false && !(ed?.def.replace && ed.c.k >= 1) && (
        // a replaced background (green-screen, paper-cut) is not footage: the grain + vignette fade out with it
        <AbsoluteFill style={{ pointerEvents: "none", ...(ed?.def.replace ? { opacity: 1 - ed.c.k } : {}) }}>
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.09, mixBlendMode: "overlay" }}>
            <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 24} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
            <rect width="100%" height="100%" filter="url(#grain)" />
          </svg>
          <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 60% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.32) 100%)" }} />
        </AbsoluteFill>
      )}
      {judges.map((j, k) => <Judge key={`j${k}`} label={j.label} age={t - j.t} accent={j.accent} rtl={rtl} />)}
      {/* chunk captions sit above the coins (a caption under a big coin's chin would be hidden behind him) */}
      {tl.captions.mode === "chunk" && tl.text !== false && cur && cur.headline !== false && !(tl.loop && !tl.ghost && tl.durationSec - t < LOOP_FADE) && <Chunk scene={cur} theme={cur.accent ? { ...theme, accent: cur.accent } : theme} t={t} lead={tl.captions.lead} rtl={rtl} y={(tl.captions as any).ctaY != null && t >= ((tl.captions as any).ctaT ?? 0) ? (tl.captions as any).ctaY : tl.captions.y} />}
      {tl.caption && <FixedCaption c={tl.caption} theme={theme} handle={tl.caption.handle ?? tl.handle} />}
      {silent && <SilentDamage frame={frame} />}
      {silent && <Iris r={iris} />}
      {gameFlash > 0 && <AbsoluteFill style={{ background: "#fff", opacity: gameFlash }} />}
      {fl > 0 && <AbsoluteFill style={{ background: theme.bg === "volt" ? theme.accent : "#fff", opacity: fl }} />}
      {fadeK > 0 && <AbsoluteFill style={{ background: "#000", opacity: fadeK * fadeK * (3 - 2 * fadeK) }} />}
      {/* loop: frame 0 (silent) dissolves in over the last 0.4 s, so the last frame flows into the first */}
      {tl.loop && !tl.ghost && tl.durationSec - t < LOOP_FADE && (
        <AbsoluteFill style={{ opacity: easeIO(1 - (tl.durationSec - t) / LOOP_FADE) }}>
          <Freeze frame={0}><Reel {...tl} ghost audio={null} music={null} sfx={[]} /></Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
