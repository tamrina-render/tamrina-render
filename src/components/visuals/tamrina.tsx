// Tamrina visuals (Volt × Varsity), modelled on the real app: the "player card" (mobile/src/features/browse/person-card.tsx),
// the kit-number patch, slanted kit buttons, partner gyms, coins. All demo data comes from script props; no real faces.
// Beats: same rule as every visual (beatTime: emphasized words, else evenly spaced) and scripts/sfx.mjs puts the sounds there.
import React from "react";
import { FONT } from "../../lib/fonts";
import { enter, idle, springIn } from "../../lib/mechanics";
import type { Theme } from "../../lib/types";
import { beatTime, Check, Mono, Panel, sceneProgress, type VisualProps } from "./common";

const ar = (rtl: boolean) => (rtl ? FONT.arabic : FONT.head);
const Center: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>{children}</div>
);

/** Slanted varsity "kit" button: skewed box, upright label. */
export const Kit: React.FC<{ theme: Theme; children: React.ReactNode; ghost?: boolean; size?: number; style?: React.CSSProperties }> = ({ theme, children, ghost, size = 30, style }) => (
  <div style={{ display: "inline-block", transform: "skewX(-8deg)", background: ghost ? "transparent" : theme.accent, border: `3px solid ${theme.accent}`, padding: "10px 26px", ...style }}>
    <div style={{ transform: "skewX(8deg)", color: ghost ? theme.accent : theme.onAccent, fontFamily: FONT.head, fontWeight: 800, fontSize: size, letterSpacing: 1.5, whiteSpace: "nowrap" }}>{children}</div>
  </div>
);

/** Kit-number patch: big value, tiny unit (app: shared/ui/jersey-number.tsx). */
export const Jersey: React.FC<{ theme: Theme; value: React.ReactNode; unit?: string; size?: number }> = ({ theme, value, unit, size = 44 }) => (
  <div style={{ background: theme.accent, color: theme.onAccent, borderRadius: 6, padding: "6px 14px 4px", textAlign: "center", fontFamily: FONT.head, lineHeight: 1 }}>
    <div style={{ fontWeight: 800, fontSize: size, direction: "ltr" }}>{value}</div>
    {unit && <div style={{ fontWeight: 700, fontSize: size * 0.36, opacity: 0.8, marginTop: 2, letterSpacing: 1 }}>{unit}</div>}
  </div>
);

/** Faceless head-and-shoulders placeholder (we never show real people). */
const Avatar: React.FC<{ theme: Theme; size: number; ring?: boolean }> = ({ theme, size, ring }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.18, background: theme.fill, border: `3px solid ${ring ? theme.accent : theme.line}`, overflow: "hidden", flexShrink: 0 }}>
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={50} cy={40} r={18} fill={theme.mutedPanel} />
      <path d="M14 100 Q50 52 86 100 Z" fill={theme.mutedPanel} />
    </svg>
  </div>
);

// ---------- swipe: the player card, facts tick in, then it swipes ----------
/** props: { name, sub, kit, facts: [{label, value, same}], score?: "3 / 4" + scoreLabel, swipe?: bool (default true), action?: "تمرين" } */
export const Swipe: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "up", distance: 80 });
  const facts: { label: string; value: string; same?: boolean }[] = props.facts ?? [];
  // swipe on the LAST emphasized word (or props.swipeAt, local s) so the facts are read first; scripts/sfx.mjs uses the same moment
  const nE = p.scene.words.filter((w) => w.emph).length;
  const swipeAt = typeof props.swipeAt === "number" ? props.swipeAt : nE ? beatTime(p, nE - 1, nE) : (p.scene.end - p.scene.start) * 0.7;
  const sw = props.swipe === false ? 0 : springIn((local - swipeAt) * fps, fps, 0, "snappy");
  const dir = rtl ? -1 : 1;
  const i = idle(local, 2, 5);
  return (
    <Center>
      {/* the next card waiting underneath */}
      <div style={{ position: "absolute", width: 700, height: 640, borderRadius: 22, background: theme.card, border: `3px solid ${theme.line}`, transform: `translateY(28px) scale(${0.94 + 0.06 * sw})`, opacity: 0.55 + 0.45 * sw, padding: 30, display: "flex", flexDirection: "column", gap: 16, direction: rtl ? "rtl" : "ltr" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Avatar theme={theme} size={130} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ height: 30, width: "60%", borderRadius: 6, background: theme.fill }} />
            <div style={{ height: 20, width: "40%", borderRadius: 6, background: theme.fill }} />
          </div>
          <div style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 82, color: theme.accent, opacity: 0.5, lineHeight: 1 }}>{props.nextKit ?? 9}</div>
        </div>
        {[0, 1, 2].map((k) => <div key={k} style={{ height: 62, borderRadius: 10, background: theme.fill }} />)}
      </div>
      <div style={{ opacity: e.opacity, transform: `${e.transform} translate(${i.x + dir * sw * 900}px, ${i.y - sw * 60}px) rotate(${i.rot + dir * sw * 18}deg)` }}>
        <Panel theme={theme} t={local} seed={3} style={{ width: 700, padding: "30px 30px 26px", direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <Avatar theme={theme} size={130} ring />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: ar(rtl), fontWeight: 700, fontSize: 46, lineHeight: 1.1 }}>{props.name ?? "أحمد"}</div>
              {props.sub && <div style={{ fontFamily: ar(rtl), fontSize: 26, color: theme.muted, marginTop: 4 }}>{props.sub}</div>}
            </div>
            <div style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 82, color: theme.accent, lineHeight: 1 }}>{props.kit ?? 22}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
            {facts.map((f, k) => {
              const s = springIn(frame, fps, Math.round(fps * (0.3 + k * 0.18)), "snappy");
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 14, background: theme.fill, borderRadius: 10, padding: "14px 18px", opacity: s, transform: `translateX(${(1 - s) * 40 * (rtl ? 1 : -1)}px)` }}>
                  <span style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 30, color: f.same === false ? theme.mutedPanel : theme.accent, width: 30, textAlign: "center" }}>{f.same === false ? "–" : "✓"}</span>
                  <span style={{ fontFamily: ar(rtl), fontSize: 26, color: theme.muted }}>{f.label}</span>
                  <span style={{ flex: 1, textAlign: rtl ? "left" : "right", fontFamily: ar(rtl), fontWeight: 700, fontSize: 30 }}>{f.value}</span>
                </div>
              );
            })}
            {props.score && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, border: `3px solid ${theme.accent}`, background: theme.soft, borderRadius: 10, padding: "12px 18px" }}>
                <span style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 36, color: theme.accent, direction: "ltr" }}>{props.score}</span>
                <span style={{ fontFamily: ar(rtl), fontWeight: 700, fontSize: 28 }}>{props.scoreLabel ?? "مشترك"}</span>
              </div>
            )}
          </div>
        </Panel>
        {/* the action stamp lands as the card leaves */}
        {props.swipe !== false && sw > 0.02 && (
          <div style={{ position: "absolute", top: 40, [rtl ? "left" : "right"]: -10, transform: `rotate(${dir * 14}deg) scale(${0.6 + 0.4 * Math.min(1, sw * 1.5)})`, opacity: Math.min(1, sw * 2) }}>
            <Kit theme={theme} size={40}>{props.action ?? "تمرين"} ✓</Kit>
          </div>
        )}
      </div>
    </Center>
  );
};

// ---------- map: you (blurred area, never the exact spot) + radius ring + partners popping in ----------
/** props: { pins: [{label, km}] (max 4 shown), radius?: "3 كم", label?: string } */
export const MapV: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "scale" });
  const pins: { label?: string; km?: string }[] = (props.pins ?? [{}, {}, {}]).slice(0, 4);
  const spots = [[250, 170], [560, 230], [190, 470], [600, 520]];
  const ring = springIn(frame, fps, Math.round(fps * 0.2), "soft");
  const pulse = (local * 0.8) % 1;
  return (
    <Center>
      <div style={{ opacity: e.opacity, transform: e.transform }}>
        <Panel theme={theme} t={local} seed={6} style={{ width: 800, height: 700, padding: 0, overflow: "hidden" }}>
          <svg width={800} height={700} viewBox="0 0 800 700" style={{ display: "block" }}>
            {/* stylised streets */}
            {[90, 260, 430, 600].map((y, k) => <path key={`h${k}`} d={`M0 ${y + (k % 2) * 30} C 260 ${y - 40} 520 ${y + 50} 800 ${y}`} stroke={theme.fill} strokeWidth={k % 2 ? 10 : 18} fill="none" />)}
            {[140, 400, 660].map((x, k) => <path key={`v${k}`} d={`M${x} 0 C ${x + 50} 240 ${x - 40} 460 ${x + 20} 700`} stroke={theme.fill} strokeWidth={k === 1 ? 20 : 10} fill="none" />)}
            {/* radius ring */}
            <circle cx={400} cy={350} r={300 * ring} fill={`${theme.accent}10`} stroke={theme.accent} strokeWidth={4} strokeDasharray="14 12" />
            {/* you: a fuzzy area, not a point */}
            <circle cx={400} cy={350} r={46 + pulse * 40} fill={theme.accent} opacity={0.25 * (1 - pulse)} />
            <circle cx={400} cy={350} r={40} fill={theme.accent} opacity={0.3} />
            <circle cx={400} cy={350} r={16} fill={theme.accent} />
          </svg>
          {pins.map((pin, k) => {
            const at = beatTime(p, k, pins.length);
            const s = springIn((local - at) * fps, fps, 0, "pop");
            if (local < at) return null;
            const [x, y] = spots[k];
            return (
              <div key={k} style={{ position: "absolute", left: x - 30, top: y - 74, transform: `scale(${s})`, transformOrigin: "30px 74px", display: "flex", alignItems: "flex-start", gap: 8, direction: rtl ? "rtl" : "ltr" }}>
                <svg width={60} height={78} viewBox="0 0 60 78"><path d="M30 76 C 10 50 2 38 2 28 A 28 28 0 1 1 58 28 C 58 38 50 50 30 76 Z" fill={theme.accent} stroke={theme.paper} strokeWidth={3} /><circle cx={30} cy={28} r={10} fill={theme.onAccent} /></svg>
                {(pin.label || pin.km) && (
                  <div style={{ background: theme.card, border: `2px solid ${theme.line}`, borderRadius: 10, padding: "6px 14px", fontFamily: ar(rtl), fontWeight: 700, fontSize: 30, whiteSpace: "nowrap", direction: "ltr" }}>
                    {pin.label}{pin.km && <span style={{ color: theme.accent, fontFamily: FONT.head, marginInlineStart: 8 }}>{pin.km}</span>}
                  </div>
                )}
              </div>
            );
          })}
          {props.radius && (
            <div style={{ position: "absolute", bottom: 22, [rtl ? "right" : "left"]: 22 }}>
              <Jersey theme={theme} value={props.radius} unit={props.radiusUnit ?? "RADIUS"} size={40} />
            </div>
          )}
        </Panel>
        {props.label && <Mono color={theme.muted} size={22} style={{ display: "block", textAlign: "center", marginTop: 20 }}>{props.label}</Mono>}
      </div>
    </Center>
  );
};

// ---------- chat: messages pop in on the beats ----------
/** props: { title?: string, messages: [{text, me?: bool}], dim?: bool (a dead group chat: grey, nobody answers) } */
export const Chat: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "up", distance: 70 });
  const msgs: { text: string; me?: boolean }[] = props.messages ?? [];
  const dim = !!props.dim;
  return (
    <Center>
      <div style={{ opacity: e.opacity, transform: e.transform, filter: dim ? "grayscale(1)" : undefined }}>
        <Panel theme={theme} t={local} seed={4} style={{ width: 720, minHeight: 470, padding: "0 0 24px", overflow: "hidden", direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 24px", borderBottom: `2px solid ${theme.line}` }}>
            <Avatar theme={theme} size={64} ring={!dim} />
            <div style={{ flex: 1, fontFamily: ar(rtl), fontWeight: 700, fontSize: 36 }}>{props.title ?? "بارتنر"}</div>
            {!dim && <span style={{ width: 16, height: 16, borderRadius: 8, background: theme.accent }} />}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "24px 24px 0" }}>
            {msgs.map((m, k) => {
              const at = beatTime(p, k, msgs.length);
              if (local < at) return null;
              const s = springIn((local - at) * fps, fps, 0, "pop");
              const mine = !!m.me;
              return (
                <div key={k} style={{ alignSelf: mine ? "flex-start" : "flex-end", maxWidth: 520, transform: `scale(${0.7 + 0.3 * s})`, opacity: Math.min(1, s * 1.4), transformOrigin: mine ? (rtl ? "100% 100%" : "0% 100%") : rtl ? "0% 100%" : "100% 100%" }}>
                  <div style={{ background: mine ? theme.accent : theme.fill, color: mine ? theme.onAccent : theme.ink, fontFamily: ar(rtl), fontWeight: 600, fontSize: 40, lineHeight: 1.3, padding: "16px 26px", borderRadius: 24 }}>{m.text}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </Center>
  );
};

// ---------- gym: a partner gym card with its offer; the offer tag slams on the first beat ----------
/** props: { name, kind?: "جيم", area?: string, offers: string[], tag?: "ببلاش", logo?: "Letter" } */
export const Gym: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "up", distance: 70 });
  const offers: string[] = props.offers ?? [];
  const at = beatTime(p, 0, 1);
  const slam = local >= at;
  const s = springIn((local - at) * fps, fps, 0, "heavy");
  return (
    <Center>
      <div style={{ opacity: e.opacity, transform: e.transform, position: "relative" }}>
        <Panel theme={theme} t={local} seed={8} tab={props.tabLabel ?? "PARTNER"} style={{ width: 720, padding: "40px 32px 30px", direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ width: 120, height: 120, borderRadius: 60, background: theme.fill, border: `4px solid ${theme.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.head, fontWeight: 800, fontSize: 56, color: theme.accent }}>{props.logo ?? String(props.name ?? "G").slice(0, 1)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 50, letterSpacing: 1, textTransform: "uppercase", lineHeight: 1.05 }}>{props.name ?? "Partner Gym"}</div>
              {props.area && <div style={{ fontFamily: ar(rtl), fontSize: 26, color: theme.muted, marginTop: 6 }}>{props.area}</div>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 26 }}>
            {offers.map((o, k) => {
              const os = springIn(frame, fps, Math.round(fps * (0.35 + k * 0.2)), "snappy");
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 14, background: k === 0 ? theme.soft : theme.fill, border: k === 0 ? `2px solid ${theme.accent}` : "2px solid transparent", borderRadius: 10, padding: "14px 18px", opacity: os, transform: `translateY(${(1 - os) * 20}px)` }}>
                  <span style={{ width: 14, height: 14, transform: "rotate(45deg)", background: theme.accent, flexShrink: 0 }} />
                  <span style={{ fontFamily: ar(rtl), fontWeight: 700, fontSize: 32 }}>{o}</span>
                </div>
              );
            })}
          </div>
        </Panel>
        {props.tag && slam && (
          <div style={{ position: "absolute", top: -50, [rtl ? "left" : "right"]: -30, transform: `rotate(${rtl ? -10 : 10}deg) scale(${2 - Math.min(1, s)})`, opacity: Math.min(1, s * 1.6) }}>
            <Kit theme={theme} size={52}>{props.tag}</Kit>
          </div>
        )}
      </div>
    </Center>
  );
};

// ---------- wallet: coins count up one by one on the beats, then the unlock ----------
/** props: { from?: 0, steps?: 3, label?: "كوينز", unlock?: "خصم 10%", sub?: string } */
export const Wallet: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "scale" });
  const steps: number = props.steps ?? 3;
  const from: number = props.from ?? 0;
  const times = Array.from({ length: steps }, (_, k) => beatTime(p, k, steps));
  const got = times.filter((tm) => local >= tm).length;
  const last = got ? times[got - 1] : -9;
  const bump = got ? springIn((local - last) * fps, fps, 0, "pop") : 1;
  const unlockAt = times[steps - 1] + 0.5;
  const u = props.unlock ? springIn((local - unlockAt) * fps, fps, 0, "pop") : 0;
  return (
    <Center>
      <div style={{ opacity: e.opacity, transform: e.transform, display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <Panel theme={theme} t={local} seed={5} tab={props.tab ?? "COINS"} style={{ width: 600, padding: "40px 40px 30px", direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {/* a coin in the brand colour */}
            <svg width={150} height={150} viewBox="0 0 100 100" style={{ transform: `rotate(${(1 - bump) * 40}deg) scale(${0.9 + 0.1 * bump})` }}>
              <circle cx={50} cy={50} r={46} fill={theme.accent} stroke={theme.onAccent} strokeWidth={4} />
              <circle cx={50} cy={50} r={36} fill="none" stroke={theme.onAccent} strokeWidth={2.5} strokeDasharray="3 4" />
              <text x={50} y={64} textAnchor="middle" fontFamily={FONT.brand} fontWeight={800} fontSize={40} fill={theme.onAccent} direction="ltr" style={{ unicodeBidi: "plaintext" }}>+1</text>
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 130, lineHeight: 1, color: theme.ink, transform: `scale(${0.92 + 0.08 * bump})`, transformOrigin: rtl ? "100% 50%" : "0% 50%" }}>{from + got}</div>
              <Mono color={theme.muted} size={24} style={{ display: "block", marginTop: 6 }}>{props.label ?? "كوينز"}</Mono>
            </div>
          </div>
          {/* stripe band: one accent cell per coin (app: shared/ui/stripe-band.tsx) */}
          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            {times.map((_, k) => <div key={k} style={{ flex: 1, height: 12, borderRadius: 2, background: k < got ? theme.accent : theme.fill }} />)}
          </div>
        </Panel>
        {props.unlock && local >= unlockAt && (
          <div style={{ transform: `scale(${u})` }}>
            <Kit theme={theme} size={40}>{props.unlock}</Kit>
          </div>
        )}
      </div>
    </Center>
  );
};

// ---------- verify: live gesture video -> verified (Ladies Only) ----------
/** props: { hint?: "اعملي ✌️", label?: string, badge?: "VERIFIED", sub?: string } */
export const Verify: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "up", distance: 70 });
  const at = beatTime(p, 0, 1);
  const prog = Math.min(1, local / Math.max(0.3, at));
  const ok = local >= at;
  const s = springIn((local - at) * fps, fps, 0, "pop");
  return (
    <Center>
      <div style={{ opacity: e.opacity, transform: e.transform, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <div style={{ position: "relative", width: 440, height: 440 }}>
          <svg width={440} height={440} viewBox="0 0 440 440" style={{ position: "absolute", inset: 0 }}>
            <circle cx={220} cy={220} r={200} fill={theme.card} stroke={theme.line} strokeWidth={4} />
            <circle cx={220} cy={220} r={200} fill="none" stroke={theme.accent} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${1257 * prog} 1257`} transform="rotate(-90 220 220)" />
            <circle cx={220} cy={180} r={62} fill={theme.mutedPanel} />
            <path d="M80 400 Q220 250 360 400 Z" fill={theme.mutedPanel} />
          </svg>
          {!ok && <div style={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, background: theme.danger, color: "#fff", fontFamily: FONT.head, fontWeight: 800, fontSize: 22, padding: "4px 14px", borderRadius: 8, letterSpacing: 1.5 }}><span style={{ width: 12, height: 12, borderRadius: 6, background: "#fff", opacity: Math.round(local * 2) % 2 ? 1 : 0.3 }} />LIVE</div>}
          {ok && (
            <div style={{ position: "absolute", right: 6, bottom: 20, transform: `scale(${s})` }}>
              <div style={{ width: 120, height: 120, borderRadius: 60, background: theme.accent, border: `6px solid ${theme.paper}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={64} height={64} viewBox="0 0 24 24"><path d="M4 12 L10 18 L20 6" fill="none" stroke={theme.onAccent} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
          )}
        </div>
        {props.hint && !ok && <div style={{ fontFamily: ar(rtl), fontWeight: 700, fontSize: 36, direction: rtl ? "rtl" : "ltr" }}>{props.hint}</div>}
        {ok && <div style={{ transform: `scale(${s})` }}><Kit theme={theme} size={38}>{props.badge ?? "VERIFIED"}</Kit></div>}
        {props.sub && <Mono color={theme.muted} size={22}>{props.sub}</Mono>}
      </div>
    </Center>
  );
};

// ---------- checkin: at the gym together -> session verified -> +1 ----------
/** props: { gym?: string, who?: string, button?: "تشيك إن", done?: "اتسجلت ✓", reward?: "+1 كوين" } */
export const Checkin: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl } = p;
  const e = enter(frame, fps, { from: "up", distance: 70 });
  const at = beatTime(p, 0, 1);
  const on = local >= at;
  const s = springIn((local - at) * fps, fps, 0, "pop");
  return (
    <Center>
      <div style={{ opacity: e.opacity, transform: e.transform, position: "relative" }}>
        <Panel theme={theme} t={local} seed={9} style={{ width: 680, padding: "32px", direction: rtl ? "rtl" : "ltr" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width={70} height={90} viewBox="0 0 60 78"><path d="M30 76 C 10 50 2 38 2 28 A 28 28 0 1 1 58 28 C 58 38 50 50 30 76 Z" fill={theme.accent} /><circle cx={30} cy={28} r={10} fill={theme.onAccent} /></svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 44, textTransform: "uppercase" }}>{props.gym ?? "Partner Gym"}</div>
              {props.who && <div style={{ fontFamily: ar(rtl), fontSize: 28, color: theme.muted }}>{props.who}</div>}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 26, margin: "30px 0 26px" }}>
            {[0, 1].map((k) => <Avatar key={k} theme={theme} size={150} ring={on} />)}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ transform: `scale(${on ? 0.96 + 0.04 * s : 1})` }}>
              <Kit theme={theme} size={36} ghost={!on}>{on ? props.done ?? "اتسجلت ✓" : props.button ?? "تشيك إن"}</Kit>
            </div>
          </div>
        </Panel>
        {on && props.reward && (
          <div style={{ position: "absolute", top: -40, [rtl ? "left" : "right"]: -20, transform: `translateY(${(1 - s) * 40}px) scale(${s})` }}>
            <Jersey theme={theme} value={props.reward} size={46} />
          </div>
        )}
      </div>
    </Center>
  );
};

// ---------- stores: the end card ----------
/** props: { tagline?: string, stores?: ["App Store"], handle?: string } Only list stores that are live (facts.json). */
export const Stores: React.FC<VisualProps> = (p) => {
  const { theme, frame, fps, local, props = {}, rtl, tl } = p;
  const e = enter(frame, fps, { from: "scale" });
  const at = beatTime(p, 0, 1);
  const s = springIn((local - at) * fps, fps, 0, "pop");
  const stores: string[] = props.stores ?? ["App Store"];
  const prog = sceneProgress(p, 0.6);
  return (
    <Center>
      <div style={{ opacity: e.opacity, transform: e.transform, display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
        <div style={{ fontFamily: FONT.head, fontWeight: 800, fontSize: 150, letterSpacing: 6, color: theme.ink, lineHeight: 1, textTransform: "uppercase" }}>
          Tamr<span style={{ color: theme.accent }}>i</span>na
        </div>
        {/* stripe band under the wordmark */}
        <div style={{ display: "flex", gap: 10, width: 560 }}>
          {[0, 1, 2, 3, 4].map((k) => <div key={k} style={{ flex: 1, height: 12, background: k / 5 < prog ? theme.accent : theme.fill }} />)}
        </div>
        {props.tagline && <div style={{ fontFamily: ar(rtl), fontWeight: 700, fontSize: 46, direction: rtl ? "rtl" : "ltr" }}>{props.tagline}</div>}
        <div style={{ display: "flex", gap: 22, transform: `scale(${local >= at ? 0.85 + 0.15 * s : 0.85})`, opacity: local >= at ? 1 : 0.35 }}>
          {stores.map((st) => <Kit key={st} theme={theme} size={34}>{st}</Kit>)}
        </div>
        <Mono color={theme.muted} size={30} style={{ letterSpacing: 1.5 }}>{props.handle ?? tl.handle ?? ""}</Mono>
      </div>
    </Center>
  );
};
