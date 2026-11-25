// FactBus props from a timeline (videos/bus-conductor):
//   node scripts/bus-props.mjs videos/bus-conductor/timeline.json > videos/bus-conductor/out/factbus/props.json
// Each beat = the start of the first WORD holding a snippet (tashkeel ignored), searched in order after the previous
// beat, so a new take needs no code change. Fails loudly when a snippet is missing.
import fs from "node:fs";
const t = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const W = t.scenes.flatMap((s, i) => s.words.map((w) => ({ ...w, line: i })));
const bare = (s) => (s || "").replace(/[ً-ْـ]/g, "").replace(/[.,،؟?!:%…]+/g, "").trim();
const r2 = (v) => +v.toFixed(2);
let from = 0;
const find = (snip) => {
  const f = bare(snip);
  for (let i = from; i < W.length; i++) if (bare(W[i].w).includes(f)) { from = i + 1; return r2(W[i].start); }
  throw new Error(`no word with "${snip}" after word ${from}`);
};
const lineStart = (n) => r2(t.scenes[n].start + 0.01);
const beats = { hook: 0 };
beats.driver = find("السواق");
beats.stairs = find("سلم");
beats.years = find("أكتر");
beats.doctor = find("دكتور");
beats.compare = find("قارن");
beats.decks = find("أبو");
beats.cond2 = find("كومسارية");
beats.sit = find("السواق");
beats.shift = find("الوردية");
beats.climb = find("الكومساري");
beats.tickets = find("يقطع");
beats.result = find("النتيجة");
beats.attacks = find("الأزمات");
beats.cond3 = find("الكومسارية");
beats.half = find("النص");
beats.free = find("ببلاش");
beats.us = find("وإحنا");
beats.pay = find("اشتراك");
beats.steps = find("سلم");
beats.coin = lineStart(W[from].line);
beats.likeDriver = find("زي");
beats.post = find("بوست");
beats.app = find("تمرينة");
beats.near = find("قريب");
beats.join = find("ينزل");
beats.yalla = find("يلا");
beats.tix = find("التذاكر");
process.stdout.write(JSON.stringify({ beats, durationSec: +t.durationSec.toFixed(3), debug: false }));
