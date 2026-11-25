// The acting director (2026-11-08, research: reports/Cartoon acting for coin mascots.md).
// A rule-based "animator" that reads each line and DECIDES what the coin does, the way BEAT / Cerebella and the
// classic dialogue rules do it, instead of reacting to every stressed syllable (that scored like random gestures):
//  - one OPERATIVE word per line (the first *mark*, else the most stressed word): the one arm gesture of the line
//    lands on it (a 2nd only on a line > 3 s, >= 1.5 s later), picked by what the word MEANS, from the hand-made
//    gesture library; it pops in 4 frames before the vowel and HOLDS (>= 8 frames, +12 past "done"), chained to the
//    next one instead of dropping to rest when they are close
//  - head acting a flat disc can show (never a pitch nod): roll tilt on a question, a yaw shake on a negation, a
//    squash "yes" on an affirmation, a side sweep on "all / everything", a small accent pop on the operative word
//  - blinks inside big head turns, never on the operative word
//  - listeners: no arm gestures, a reduced mirror of the speaker's head (+0.5 s), a small squash nod in his pauses
// Hand-written {cues} always win: the director leaves that coin alone around them. Off: script / scene "acting": false.
// Output: tl.acting[coin id] = { gestures, head, blinks, quiet } (played by src/lib/acting.ts + Coin3D), and a
// table of its choices (out/acting.md) the owner can veto per line.
import { MOODS, FACE_MOODS } from "./timeline.mjs";

const r3 = (x) => Math.round(x * 1000) / 1000;
const F = 1 / 30; // one frame at 30 fps (the numbers below are in frames of the classic 24/30 fps rules)
const norm = (w) => w.replace(/[ً-ْـ]/g, "").replace(/[*.,!?؟،:;"'«»()…]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();
const hash = (n) => { const x = Math.sin(n * 91.345 + 47.853) * 43758.5453; return x - Math.floor(x); };

// ---- the Egyptian word-function lexicon (inference from BEAT / Cerebella / McClave, see the report) ----
const SET = (s) => new Set(s.split(" ").map(norm));
const NEG = SET("مش لا لأ لاء مفيش مافيش ابدا مستحيل");
const AFF = SET("اه ايوه ايوا تمام ماشي طبعا اكيد صح نعم بالظبط");
const QW = SET("ايه ليه ازاي امتي فين مين كام هل اشمعني");
const INCL = SET("كل كلنا كلهم كلكم الكل دايما محدش جميع");
const SELF = SET("انا احنا عندي بتاعي ليا معايا انايا");
const YOU = SET("انت انتي انتو انتم ليك ليكي معاك معاكي بتاعك");
const THIS = SET("ده دي دول هنا هناك اهو اهي اهم");
const INTENS = SET("اوي قوي جدا موت خالص جامد فشخ بجد");
const CONTRAST = SET("بس لكن انما بينما رغم");
const NUM = SET("واحد اتنين تلاته اربعه خمسه سته سبعه تمانيه تسعه عشره اول تاني تالت");
const isNeg = (w) => NEG.has(w) || (/^م.{2,}ش$/.test(w) && w.length >= 4) || /^ما.+ش$/.test(w);
export const fnOf = (w) => {
  if (isNeg(w)) return "neg";
  if (AFF.has(w)) return "aff";
  if (QW.has(w)) return "q";
  if (INCL.has(w)) return "incl";
  if (SELF.has(w)) return "self";
  if (YOU.has(w)) return "you";
  if (THIS.has(w)) return "this";
  if (INTENS.has(w)) return "intens";
  if (CONTRAST.has(w)) return "contrast";
  if (NUM.has(w) || /^\d+$/.test(w)) return "num";
  return null;
};
// ICONIC words: the hands ACT what the word says (owner's blind A/B 2026-11-08: hand cues that act the line beat
// everything else). [regex on the normalised word, gesture or move]. A "move" (shoo, eat, drink) is a full move cue
// (its own body + hands); the rest are hand poses (Coin3D planTargets / gestureHands).
const P = "^(و|ف)?(ب|ه|ي|ت|ن|ا|بي|بت|بن|هي|هت|هن)?"; // و / ف + a verb prefix
const ICON = [
  [/رفع|^(في)?الهوا$/, "air"], // (not فوق: "فوق سعر العرض" = on top of)
  [new RegExp(P + "لف(ه|ها|هم|وا|ي)$|^(و|ف)(ا|ت|ي|ن)?لف$"), "circle"],
  [/رمي|رما/, "throw"],
  [/^(و|ف)?تعال(ي|وا)?$|^(و)?هات(ي|وا|ه|ها)?$|^يلا$|^(ا|و)?لحق(وا|ي)?$|^الحقوا$/, "come"], // تعالوا / هات / يلا / الحقوا (not جبت = I brought)
  [/^(و|ع)?(ال|لل)?ارض$|^(و|ل)?تحت$|^لتحت$/, "down"], // الأرض / تحت (not نزل: in Egyptian also "go out / go to the gym" and نزّل = download)
  [/^(ال)?(خصم|سعر|اسعار|فلوس|جنيه|عروض|العرض)$/, "money"],
  [/^(الو|كلمني|كلميني|كلموني|كلمه|اتصل|اتصلي|اتصلوا|رن|رنلي)$/, "phone"], // a call (not the noun موبايل: "يديك موبايله")
  [/^(و)?(خد|خدي|خدوا|اتفضل|اتفضلي|تكرم)$/, "presentR"], // offering
  [/^(والله|حاضر)$/, "self"],
  [/^(محدود|محدوده)$/, "small"],
  [/^(خلاص|غلط)$/, "stop"],
  [/^ب(ا|ي)يد(ك|ي|كم)$/, "stop"], // بإيدك: shows the palm
  [/^(مستني|مستنيك|مستنيكي|مستنيين)$/, "watch"],
  [/^دوس(ي|وا)?$/, "you"],
  [/^(ا|و)?(امشي|غور|اخرج)$|^روح$|^بره$/, "shoo", "move"], // (not اطلع: "أطلع بعرف" = it turns out)
  [/^(صغير|صغيره|حته|شويه|شويتين)$/, "small"],
  [/^(كبير|كبيره|ضخم|تقيل|تقيله)$/, "both"],
  [/^(استني|اسكت|ثانيه|لحظه|اهدي)$/, "stop"],
  [new RegExp(P + "اكل(ها|ه|وا)?$"), "eat", "move"], // ياكل / هاكل / باكل (never كل = "all")
  [new RegExp(P + "شرب(ها|ه|وا)?$|^(المايه|مايه)$"), "drink", "move"],
  [/^(عارف|عارفه|اعرف|معرفش|عارفين)$/, "shrug"],
  [new RegExp(P + "فكر(ت)?$"), "think"],
  [/^(الساعه|ساعه|متاخر|اتاخرت|بدري)$/, "watch"],
  [/عضلات|معضل/, "flex"],
  [/^(تمام|حلو|حلوه|جميل|جامد|عظيم|برافو)$/, "thumb"],
];
export // acted words that ARE the action win a crowded moment over the softer ones (shows a palm, points at the floor...)
const ICON_PRI = { air: 3, circle: 3, throw: 3, come: 3, shoo: 3, eat: 3, drink: 3, phone: 3, money: 2, watch: 2, shrug: 2, think: 2, flex: 2, thumb: 2, small: 1, both: 1, stop: 1, down: 1, presentR: 1, self: 1, you: 1 };
const iconOf = (w) => { if (w === "الف" || w === "كل") return null; for (const [re, g, kind] of ICON) if (re.test(w)) return { g, move: kind === "move" }; return null; };
// priority when two functions compete for the same body part (BEAT: drop the lower one)
const PRI = { neg: 9, q: 8, you: 7, self: 7, incl: 6, aff: 6, num: 5, this: 5, contrast: 4, intens: 3, emph: 2 };

// the one arm gesture of a line, by the operative word's function (names = Coin3D planTargets / gestureHands)
const ARM = { self: ["self"], you: ["you"], this: ["presentR", "presentL"], q: ["shrug", "both"], neg: ["openR", "presentL"], incl: ["both"], num: ["count"], contrast: ["presentL", "presentR"], intens: ["beatR", "beatL"], aff: ["thumb", "openR"], emph: ["presentR", "openR", "both", "presentL", "beatR", "openL"] };
// calm / low moods gesture less (Cerebella: the mood sets the threshold; the owner's taste: calm)

const MOOD_NAMES = new Set([...Object.keys(MOODS), ...Object.keys(FACE_MOODS)]);
// what a hand-written cue takes over: a hand gesture blocks only the director's arms, a head move only its head,
// a whole-body move (jump, dance, a workout...) both (names: src/lib/speech.ts GESTURE_CUES / ACTION_CUES)
const ARM_CUES = new Set("clap clack cross shrug facepalm chin think count wave point you thumb hip flex watch shoo sign".split(" "));
const HEAD_CUES = new Set("nod no stubborn eyeroll".split(" "));
// effects (sweat, confetti...) and camera cues (shake, punch, freeze) don't move the coin: they block nothing
// (src/lib/speech.ts FX_CUES / CAMERA_CUES; judge = the game show stamp)
const NO_BODY = new Set("confetti bulb question exclaim sparkle hearts steam sweat zzz impact puff shake punch freeze judge".split(" "));
const partOf = (n) => (NO_BODY.has(n) ? null : ARM_CUES.has(n) ? "arm" : HEAD_CUES.has(n) ? "head" : "body");
const isMoodCue = (name) => MOOD_NAMES.has(name.split(":").pop());

/** tl -> tl.acting (mutates nothing else). Returns { acting, rows, lint }. */
export const direct = (tl, script = {}) => {
  if (script.acting === false || tl.presenter?.type !== "coin") return null;
  const noStyle = script.acting?.no ?? "shake"; // how a coin says لأ: "shake" (side to side) or "toss" (head up)
  const cast = (tl.presenter.cast ?? []).map((c) => (typeof c === "string" ? c : c.id)).filter(Boolean);
  const ids = cast.length ? cast : [tl.presenter.name === "mrs" ? "mrs" : "mr"];
  const acting = Object.fromEntries(ids.map((id) => [id, { gestures: [], head: [], blinks: [], quiet: [] }]));
  // staging: a coin with a neighbour close on one side gestures with the other hand (never a glove in a friend's face)
  const xOf = (c) => { const p = typeof c === "object" ? String(c.place ?? "") : ""; const m = p.match(/^(-?[\d.]+),/); if (!m) return null; const v = Number(m[1]); return v <= 1.5 ? v * 1080 : v; };
  const xs = Object.fromEntries((tl.presenter.cast ?? []).map((c) => [typeof c === "string" ? c : c.id, xOf(c)]));
  const crowd = (id) => { // -1 = someone close on his left, +1 = on his right, 0 = free
    const x = xs[id]; if (x == null) return 0;
    let best = 0, bd = 1e9;
    for (const o of ids) if (o !== id && xs[o] != null && Math.abs(xs[o] - x) < 620 && Math.abs(xs[o] - x) < bd) { bd = Math.abs(xs[o] - x); best = Math.sign(xs[o] - x); }
    return best;
  };
  // what each coin wears (a coin already holding a phone all video doesn't do the "phone" act)
  const outfitOf = (id) => { const c = (tl.presenter.cast ?? []).find((x) => (typeof x === "string" ? x : x.id) === id); return [...(tl.presenter.outfit ?? []), ...(typeof c === "object" ? c.outfit ?? [] : [])]; };
  const AWAY_FROM_RIGHT = { presentR: "presentL", beatR: "beatL", openR: "openL", both: "presentL" };
  // one-hand poses done with the right hand: mirrored to the left hand ("m:") when a friend stands on his right
  const RIGHT_HAND = new Set(["come", "money", "phone", "stop", "down", "throw", "thumb", "count", "self"]);
  const AWAY_FROM_LEFT = { presentL: "presentR", beatL: "beatR", openL: "openR", both: "presentR" };
  const rows = [], lint = [];
  const acc = tl.pros?.acc ?? [];
  let lastG = null;
  tl.scenes.forEach((sc, si) => {
    const who = sc.speaker && acting[sc.speaker] ? sc.speaker : ids[0];
    const A = acting[who];
    // hand-written body cues: the director stays out of that coin's way around them (they win)
    for (const c of sc.cues ?? []) {
      if (isMoodCue(c.name)) continue;
      const [p, n] = c.name.includes(":") ? c.name.split(":") : [null, c.name];
      const targets = p === null ? [who] : p === "all" || p === "both" ? ids : [p];
      const part = partOf(n), len = part === "arm" ? 1.6 : part === "head" ? 1.4 : 2.5; // about the cue's own length
      if (!part) continue;
      for (const id of targets) if (acting[id]) acting[id].quiet.push([r3(c.t - 0.4), r3(c.t + len + 0.2), part]);
    }
    if (sc.acting === false || !sc.words.length) return;
    const quietAt = (t, part) => A.quiet.some(([a, b, p]) => t >= a && t <= b && (p === "body" || p === part));
    const mood = (sc.moods ?? []).filter((m) => m.t <= sc.start + 0.2).pop()?.mood ?? "neutral";
    const W = sc.words.map((w, k) => {
      const n = norm(w.w), inW = acc.filter((a) => a.t >= w.start - 0.03 && a.t <= w.end + 0.03);
      const top = inW.reduce((b, a) => (!b || a.s > b.s ? a : b), null);
      return { ...w, k, n, fn: fnOf(n), icon: iconOf(n), s: top?.s ?? 0, vowel: top ? top.t : w.start + Math.min(0.12, (w.end - w.start) * 0.4) };
    });
    // the words lose their punctuation in the timeline: find the question marks in the line itself
    const toks = String(sc.say ?? "").split(/\s+/).filter((x) => x && !/^[*.…]+$/.test(x));
    const qAt = toks.length === W.length ? toks.map((x, k) => (/[?؟]/.test(x) ? k : -1)).filter((k) => k >= 0) : /[?؟]/.test(sc.say ?? "") ? [W.length - 1] : [];
    const isQ = qAt.length > 0 || W.some((w) => w.fn === "q");
    // ---- the operative word: the first *mark*, else the most stressed word (a function word breaks a tie) ----
    const marked = W.filter((w) => w.emph);
    const op = marked[0] ?? [...W].sort((a, b) => (b.s + (b.fn ? 0.15 : 0)) - (a.s + (a.fn ? 0.15 : 0)))[0];
    const choice = [];
    // ---- head events: what the words mean, one per word at most, a disc's own moves ----
    const head = (k, t, a, d, why, side) => { if (!quietAt(t, "head")) { A.head.push({ t: r3(t), k, a, d, side: side ?? (hash(si * 7 + t) > 0.5 ? 1 : -1), own: si }); choice.push(`${why} → ${k}`); } };
    for (const w of W) {
      const at = w.vowel - 4 * F; // the head / body extreme lands 4 frames before the vowel (Williams)
      // "لأ": a side-to-side shake, or the Egyptian head toss up ("acting": {"no": "toss"})
      if (w.fn === "neg") { if (noStyle === "toss") head("toss", at - 0.05, 1, 0.6, `"${w.w}" (لأ)`); else head("shake", at - 0.05, 0.3, 0.6, `"${w.w}" (لأ)`); }
      else if (w.fn === "aff") head("yes", at, 1, 0.4, `"${w.w}" (أيوه)`);
      else if (w.fn === "incl") head("sweep", w.start - 0.1, 0.32, Math.max(0.5, w.end - w.start + 0.2), `"${w.w}" (الكل)`);
    }
    if (isQ) { // a question: roll tilt + brows from the question word (or the last word) to the end, held
      const qw = W.find((w) => w.fn === "q" && (!qAt.length || w.k <= qAt[0])) ?? W[qAt[0] ?? W.length - 1];
      const qEnd = W[qAt[0] ?? W.length - 1];
      head("tilt", qw.vowel - 4 * F, 11, Math.max(0.6, qEnd.end - qw.vowel + 0.45), `سؤال "${qw.w}"`);
    }
    if (!A.head.some((h) => h.own === si && Math.abs(h.t - op.vowel) < 0.35)) head("pop", op.vowel - 4 * F, 1, 0.5, `الكلمة المهمة "${op.w}"`);
    // ---- the arms (2026-11-08 v2, after the owner's blind A/B: the old cadence was livelier, so it is back) ----
    // a gesture on every *mark*, on أنا / إنت, on a function word (priority >= 5), and at least every ~1.6 s, >= 0.75 s
    // apart (the old rhythm); what is NEW: the pose is picked by the word's meaning, it pops in 4 frames before the
    // vowel, the hands never go into a neighbour's face, never the same pose twice in a row
    const dur = sc.end - sc.start;
    const arms = W.filter((w, k) => w.icon || w.emph || w.fn === "self" || w.fn === "you" || (w.fn && PRI[w.fn] >= 5) || w === op);
    let lastT = -9;
    const picked = [];
    // the video's first line opens with a wave, as before (unless the script says otherwise there)
    // (not in a remake on the original sound: the people of the reel don't wave)
    // (nor when the line opens with an acted word: "ألو.." plays the phone instead)
    if (si === tl.scenes.findIndex((x) => x.words.length) && !script.scenes?.[si]?.audio && !quietAt(sc.start + 0.1, "arm") && !W.some((w) => w.icon && w.start < sc.start + 0.9)) { A.gestures.push({ t: r3(sc.start + 0.1), dur: 1, g: "wave" }); lastT = sc.start + 0.1; choice.push("أول جملة → wave"); }
    W.forEach((w, i) => {
      // the same iconic act twice in a row ("ارفعه .. في الهوا") is one gesture held, not two
      const prevPick = picked[picked.length - 1];
      if (w.icon && prevPick?.icon?.g === w.icon.g && w.vowel - prevPick.vowel < 1.6) return;
      const forced = arms.includes(w);
      if (!forced) { // a filler: only a strongly stressed word, and never pushing out a meaningful word right after it
        if (w.vowel - lastT <= 1.6 || w.s < 0.5) return;
        const nf = W.slice(i + 1).find((x) => arms.includes(x));
        if (nf && nf.vowel - w.vowel < 0.75) return;
      }
      // two acted words in a row ("ولفه وارميه") both play: 0.25 s apart is enough (a fast line: the 1st one becomes the wind-up of the 2nd)
      const minGap = w.icon && picked[picked.length - 1]?.icon ? 0.25 : w.icon || w.fn === "self" || w.fn === "you" ? 0.5 : 0.75;
      if (w.vowel - lastT < minGap) {
        // an iconic word wins its slot from a plain one just before it
        const prev = picked[picked.length - 1];
        if (w.icon && prev && !prev.icon && w.vowel - (picked[picked.length - 2]?.vowel ?? -9) >= 0.5) {
          if (picked[picked.length - 2]?.icon?.g === w.icon.g) picked.pop(); // "ارفعه بإيدك في الهوا": the raise just holds
          else { picked[picked.length - 1] = w; lastT = w.vowel; }
        }
        return;
      }
      picked.push(w); lastT = w.vowel;
    });
    // never more than 3 arm gestures in any 2 s (dfr22: 5 in 2 s read as flapping): drop the least important
    const imp = (w) => (w.icon ? 10 + (ICON_PRI[w.icon.g] ?? 1) : 0) + (w.emph ? 5 : 0) + (PRI[w.fn] ?? 0) / 10;
    for (let guard = 0; guard < 20; guard++) {
      const crowded = picked.find((w) => picked.filter((x) => x.vowel >= w.vowel && x.vowel < w.vowel + 2).length > 3);
      if (!crowded) break;
      const win = picked.filter((x) => x.vowel >= crowded.vowel && x.vowel < crowded.vowel + 2);
      picked.splice(picked.indexOf(win.reduce((lo, x) => (imp(x) < imp(lo) ? x : lo))), 1);
    }
    picked.forEach((w, j) => {
      const f = w.fn ?? "emph";
      const opts = ARM[f] ?? ARM.emph;
      if (w.icon?.move) { // a full move that acts the word (shoo / eat / drink): a cue of its own, like a hand-written one
        const t0 = w.vowel - 4 * F - 0.1;
        if (quietAt(t0, "arm")) return;
        (sc.cues ??= []).push({ t: r3(t0), name: `${who}:${w.icon.g}`, auto: true });
        A.quiet.push([r3(t0 - 0.2), r3(t0 + 1.7), "arm"]);
        lastG = { g: w.icon.g, t: t0 };
        choice.push(`"${w.w}" يمثّلها → {${w.icon.g}}`);
        return;
      }
      if (w.icon?.g === "phone" && outfitOf(who).includes("phonecall")) return;
      let g = w.icon?.g ?? opts[Math.floor(hash(si * 13 + j * 5) * opts.length)];
      if (g === lastG?.g && opts.length > 1 && !w.icon) g = opts[(opts.indexOf(g) + 1) % opts.length];
      const side = crowd(who);
      if (side > 0) g = AWAY_FROM_RIGHT[g] ?? (RIGHT_HAND.has(g) ? "m:" + g : g); else if (side < 0) g = AWAY_FROM_LEFT[g] ?? g;
      if (g === lastG?.g && !w.icon) { // never the same pose twice in a row (after the staging flip too; an iconic one keeps its pose)
        const pool = side > 0 ? ["openL", "presentL", "beatL"] : side < 0 ? ["openR", "presentR", "beatR"] : ["openR", "presentL", "beatR", "openL", "presentR"];
        const alt = pool[(pool.indexOf(g) + 1 + Math.floor(hash(si * 3 + j) * (pool.length - 1))) % pool.length];
        g = alt ?? g;
      }
      const stroke = w.vowel - 4 * F;
      if (quietAt(stroke, "arm")) return;
      const next = picked[j + 1]?.vowel ?? sc.end;
      const hold = Math.max(0.5, Math.min(1.3, next - stroke - 0.15)); // the old hold: to the next gesture, 0.6-1.3 s
      A.gestures.push({ t: r3(stroke - 0.25), dur: r3(0.25 + hold), g, prep: 0.25 });
      lastG = { g, t: stroke };
      choice.push(w.icon ? `"${w.w}" يمثّلها → ${g}` : `إيد على "${w.w}" → ${g}`);
    });
    // chain: a gesture that ends < 1 s before the next one holds until it starts
    const G = A.gestures;
    for (let i = 0; i < G.length - 1; i++) { const end = G[i].t + G[i].dur; if (G[i + 1].t > end && G[i + 1].t - end < 1) G[i].dur = r3(G[i + 1].t - G[i].t + 0.1); }
    // ---- blinks: inside every big head turn; none on the operative word ----
    for (const h of A.head.filter((h) => h.t >= sc.start - 0.3 && h.t <= sc.end)) if (h.k === "shake" || h.k === "sweep") A.blinks.push(r3(h.t + h.d * 0.35));
    A.quiet.push([r3(op.vowel - 0.2), r3(op.vowel + 0.25), "noblink"]);
    // ---- listeners: reduced mirror of the speaker's head (+0.5 s), a squash nod in his pauses, no arms ----
    for (const id of ids) {
      if (id === who) continue;
      const L = acting[id];
      // (only inside this line: a listener who speaks next starts clean)
      for (const h of A.head) if (h.own === si && (h.k === "tilt" || h.k === "shake" || h.k === "sweep") && h.t + 0.5 < sc.end - 0.2) L.head.push({ ...h, t: r3(h.t + 0.5), a: h.k === "tilt" ? h.a * 0.4 : h.a * 0.35, d: Math.min(h.d, sc.end - h.t - 0.5), side: -h.side, own: -1 });
      let lastNod = -9;
      W.forEach((w, k) => {
        const gap = (W[k + 1]?.start ?? sc.end + 0.5) - w.end;
        const at = w.end + 0.15 + 0.2 * hash(si + k);
        if (gap >= 0.3 && w.end - lastNod > 1.5 && k > 0 && at + 0.4 < sc.end) { L.head.push({ t: r3(at), k: "yes", a: 0.45, d: 0.4, side: 1, own: -1 }); lastNod = w.end; }
      });
    }
    rows.push({ si: si + 1, who, line: sc.words.map((w) => w.w).join(" "), op: op.w, choice: choice.join(" · ") || "-" });
    // ---- lint (the appeal checklist items a machine can check) ----
    for (const id of ids) { // per coin: two of HIS hand-written moves too close
      const mine = (sc.cues ?? []).filter((c) => !isMoodCue(c.name) && partOf(c.name.split(":").pop()) && !c.auto && (c.name.includes(":") ? c.name.split(":")[0] === id : id === who)).sort((a, b) => a.t - b.t);
      for (let i = 1; i < mine.length; i++) if (mine[i].t - mine[i - 1].t < 1.2) lint.push(`scene ${si + 1}: ${id} has two hand-written moves ${(mine[i].t - mine[i - 1].t).toFixed(2)} s apart (${mine[i - 1].name}, ${mine[i].name}): one gesture per thought reads better`);
    }
    // *marks* (a run of marked words = one mark): each one gets a gesture now, so more than one per ~1.5 s shouts
    const spans = W.filter((w, k) => w.emph && !W[k - 1]?.emph).length;
    if (spans > Math.max(2, Math.ceil(dur / 1.5))) lint.push(`scene ${si + 1}: ${spans} *marks* in ${dur.toFixed(1)} s: each gets a gesture, more than one per ~1.5 s makes every word shout`);
  });
  for (const id of ids) for (const k of ["gestures", "head"]) acting[id][k].sort((a, b) => a.t - b.t);
  return { acting, rows, lint };
};

/** The director's choices as a markdown table (out/acting.md): the owner vetoes a line with scene "acting": false. */
export const actingTable = (rows, lint) => [
  "# What each coin does (the acting director)", "",
  "Change a line: write the move yourself with a {cue} (it wins), or `\"acting\": false` on that scene (or the whole script).", "",
  "| # | who | line | operative word | choices |", "|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.si} | ${r.who} | ${r.line.replace(/\|/g, "/")} | ${r.op} | ${r.choice.replace(/\|/g, "/")} |`),
  "", ...(lint.length ? ["## Lint", ...lint.map((l) => `- ${l}`)] : ["Lint: clean."]), "",
].join("\n");
