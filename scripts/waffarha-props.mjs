// FactWaffarha props from a timeline (draft-timeline.json for the silent draft, timeline.json after the voice):
//   node scripts/waffarha-props.mjs videos/waffarha-story/draft-timeline.json > videos/waffarha-story/out/factwaffarha/props.json
// Beat starts + named word times found by matching the Arabic words of videos/waffarha-story, plus the times of
// Mr. Coin's {scroll} cues (the app on the floating screen steps up on each thumb flick).
// stderr: the scene "action" times that match the film (seconds from the scene start), to paste into script.json
// after a new take (his runs must stop when the camera stops).
import fs from "node:fs";
const t = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const S = t.scenes;
const rel = S[1].words[0].start < S[1].start - 0.01; // word times relative to the scene?
const r2 = (v) => +v.toFixed(2);
const at = (i, find, nth = 0) => {
  const ws = S[i].words;
  let k = -1, n = 0;
  ws.forEach((w, j) => { if (k < 0 && w.w.includes(find)) { if (n++ === nth) k = j; } });
  if (k < 0) throw new Error(`scene ${i + 1}: no word "${find}"`);
  return r2(ws[k].start + (rel ? S[i].start : 0));
};
// (six lines since 2026-11-17 (scene 3 «عشان كده عملت تمرينة.» + a held pause, scene 4 «أبلكيشن مصري…»); the film's
// `starts` keep their five beats: 0 كنت · 1 مكان · 2 عشان · 3 ومش · 4 الأبلكيشن (scene 4's start is the word app3)
if (S.length !== 6) throw new Error(`expected the six lines of videos/waffarha-story, got ${S.length}`);
const starts = [0, 1, 2, 4, 5].map((i) => r2(S[i].start));
const words = {
  ask: at(0, "وسألت"), qs: at(0, "للجيم"), gym2: at(1, "الجيم"), acad2: at(1, "والأكاديميات"), free: at(1, "ببلاش"),
  tam: at(2, "تمرينة"), app3: at(3, "أبلكيشن"), gyms3: at(3, "جيم"), acad3: at(3, "أكاديميات"), courts: at(3, "ملاعب"), coupon: at(3, "كوبونات"),
  padel: at(4, "بادل"), lazy: at(4, "مكسل"), find: at(4, "هتلاقيهم"),
  obour: at(5, "العبور"), now: at(5, "دلوقتي"), where: at(5, "نفتح"),
};
const scroll = S.flatMap((sc) => (sc.cues ?? []).filter((c) => /(^|:)scroll$/.test(c.name)).map((c) => r2(c.t)));
const durationSec = +t.durationSec.toFixed(3);
process.stdout.write(JSON.stringify({ starts, words, scroll, durationSec, debug: false }));

// the coin's moves that ride the film (same arithmetic as src/scenes/fact3d/waffarhaTiming.ts, at 30 fps)
const F = 30, fr = (s) => Math.round(s * F), sec = (f) => f / F;
const s3 = fr(starts[3]), t1A = s3 + 3, t1B = Math.min(t1A + fr(1.6), fr(words.padel) - 22);
const t2A = Math.max(t1B + 4, fr(words.lazy) - 3), t2B = Math.min(t2A + fr(1.3), fr(words.find) - 4);
const r = (f, base) => r2(sec(f) - base);
process.stderr.write(
  `scene 5 action: mr:walkaway ${r(t1A - 3, starts[3])} (to the court), mr:walkon ${r(t2A - 3, starts[3])} (to the gym door), b:walkIn ${r(fr(words.find) - 45, starts[3])} (arrives on هتلاقيهم)\n` +
    `scene 6 action: mr:jump 0.02 (the camera rises), mr:you ${r2(words.where - starts[4] - 0.1)} (نفتح فين); the «؟» pops start at ${r2(words.now - starts[4])} (one every 0.33 s, left to right: watch points = MARKS in src/scenes/fact3d/cairoMap.tsx: 315,878 · 390,784 · 540,982 · 750,826 · 915,792 · 945,515)\n`,
);
