// FactBet props from a timeline (videos/bet-salary, eight lines):
//   node scripts/bet-props.mjs videos/bet-salary/timeline.json > videos/bet-salary/out/factbet/props.json
// Same matching as tunnel-props.mjs: Arabic words, tashkeel ignored, fails loudly on a missing word.
import fs from "node:fs";
const t = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const S = t.scenes;
if (S.length !== 8) throw new Error(`expected the eight lines of videos/bet-salary, got ${S.length}`);
const rel = S[1].words[0].start < S[1].start - 0.01;
const r2 = (v) => +v.toFixed(2);
const bare = (s) => s.replace(/[ً-ْـ]/g, "").replace(/[.,،؟?!:%]+/g, "");
const at = (i, find, nth = 0) => {
  const ws = S[i].words;
  const f = bare(find);
  let k = -1, n = 0;
  ws.forEach((w, j) => { if (k < 0 && bare(w.w) === f) { if (n++ === nth) k = j; } });
  if (k < 0) throw new Error(`line ${i + 1}: no word "${find}" (#${nth + 1})`);
  return r2(ws[k].start + (rel ? S[i].start : 0));
};
const starts = S.map((s) => r2(s.start));
const words = {
  half: at(0, "نص"), lose1: at(0, "يخسّوا"), lost: at(1, "خسّوا"),
  company: at(2, "شركة"), analysed: at(2, "وحللوا"), n125: at(2, "125"), thousand: at(2, "ألف"),
  loseIt: at(3, "يخسرها"), n29: at(3, "29"), has: at(4, "عنده"), n80: at(4, "80"),
  bet: at(5, "تراهن"), gym: at(5, "الجيم"),
  partner: at(6, "بارتنر"), waiting: at(6, "مستنيك"), skip: at(6, "خلعت"), warn: at(6, "إنذار"),
  tamrina: at(7, "تمرينة"), come: at(7, "تيجي"),
};
process.stdout.write(JSON.stringify({ starts, words, durationSec: +t.durationSec.toFixed(3), debug: false }));
