// FactTunnel props from a timeline (videos/waffarha-tunnel, six lines; word times there are absolute seconds):
//   node scripts/tunnel-props.mjs videos/waffarha-tunnel/timeline.json > videos/waffarha-tunnel/out/facttunnel/props.json
// `starts` = the 6 line starts; `words` = the named word times the film is cut on (found by matching the Arabic words,
// tashkeel ignored, `nth` = which repeat inside the line). Fails loudly when a word is missing.
import fs from "node:fs";
const t = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const S = t.scenes;
if (S.length !== 6) throw new Error(`expected the six lines of videos/waffarha-tunnel, got ${S.length}`);
const rel = S[1].words[0].start < S[1].start - 0.01; // word times relative to the scene?
const r2 = (v) => +v.toFixed(2);
const bare = (s) => s.replace(/[ً-ْـ]/g, ""); // strip tashkeel + tatweel
const at = (i, find, nth = 0) => {
  const ws = S[i].words;
  const f = bare(find);
  let k = -1, n = 0;
  ws.forEach((w, j) => { if (k < 0 && bare(w.w).replace(/[.,،؟?!:]+/g, "") === f) { if (n++ === nth) k = j; } });
  if (k < 0) throw new Error(`line ${i + 1}: no word "${find}" (#${nth + 1})`);
  return r2(ws[k].start + (rel ? S[i].start : 0));
};
const starts = S.map((s) => r2(s.start));
const words = {
  hundred: at(0, "100"), down: at(0, "تنزل"), gym1: at(0, "الجيم"), pay: at(0, "تدفع"),
  waff: at(1, "وفّرها"), rest: at(1, "للمطاعم"), outings: at(1, "والخروجات"), gyms: at(1, "للجيمات"), courts: at(1, "والملاعب"), acads: at(1, "والأكاديميات"), free: at(1, "حصة"),
  tam: at(2, "تمرينة"),
  gyms5: at(3, "جيمات"), acad5: at(3, "أكاديميات"), courts5: at(3, "وملاعب"), offers: at(3, "وعروض"), coupon: at(3, "كوبونات"),
  ball: at(4, "كورة"), padel: at(4, "بادل"), lazy: at(4, "مكسّل"), alone: at(4, "لوحدك"), find: at(4, "هتلاقي"), people: at(4, "ناس", 1),
  obour: at(5, "العبور"), now: at(5, "دلوقتي"), where: at(5, "نفتح"),
};
const durationSec = +t.durationSec.toFixed(3);
process.stdout.write(JSON.stringify({ starts, words, durationSec, debug: false }));
