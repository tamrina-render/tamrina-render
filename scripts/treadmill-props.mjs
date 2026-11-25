// FactTreadmill props from a timeline (videos/treadmill-prison):
//   node scripts/treadmill-props.mjs videos/treadmill-prison/timeline.json > videos/treadmill-prison/out/facttreadmill/props.json
// Each beat = the start of the first WORD holding a snippet (tashkeel ignored), searched in order after the previous
// beat, so a new take needs no code change. Fails loudly when a snippet is missing.
import fs from "node:fs";
const t = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const W = t.scenes.flatMap((s, i) => s.words.map((w) => ({ ...w, line: i })));
const bare = (s) => (s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[.,،؟?!:%…]+/g, "").trim();
const r2 = (v) => +v.toFixed(2);
let from = 0;
const find = (snip) => {
  const f = bare(snip);
  for (let i = from; i < W.length; i++) if (bare(W[i].w).includes(f)) { from = i + 1; return r2(W[i].start); }
  throw new Error(`no word with "${snip}" after word ${from}`);
};
const lineStart = (n) => r2(t.scenes[n].start + 0.01);
const beats = { hook: 0 };
// Scene 1: the hook
beats.gym = find("الجيم");
beats.not = find("مكانش");
beats.year = find("تمنتاشر");
beats.punish = find("عقاب");
beats.england = find("إنجلترا");

// Scene 2: the engineer and the treadwheel
beats.engineer = find("المهندس");
beats.wheel = find("طاحونة");
beats.walk = find("يمشوا");
beats.six = find("ست");
beats.grind = find("يطحنوا");
beats.torture = find("تعذيب");
beats.energy = find("طاقة");

// Scene 3: banned, then we pay for it
beats.harsh = find("قاسي");
beats.banned = find("اتمنع");
beats.law = find("قانون");
beats.year2 = find("واتنين");
beats.us = find("نيجي");
beats.pay = find("ندفع");
beats.run = find("نجري");
beats.wall = find("الحيطة");

// Scene 4: the coin's line
beats.bored = find("زهقت");
beats.coin = lineStart(W[from].line);
beats.app = find("tamrina");
beats.match = find("ماتش");
beats.thumb = find("تعاقب");

process.stdout.write(JSON.stringify({ beats, durationSec: +t.durationSec.toFixed(3), debug: false }));
