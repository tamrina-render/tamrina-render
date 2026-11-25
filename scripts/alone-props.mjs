// FactAlone props from a timeline (videos/gym-alone):
//   node scripts/alone-props.mjs videos/gym-alone/timeline.json > videos/gym-alone/out/factalone/props.json
// Each beat = the start of the first line whose text holds a snippet (tashkeel ignored), searched in order after the
// previous beat, so a re-split or re-paused voice needs no code change. Fails loudly when a snippet is missing.
import fs from "node:fs";
const t = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const S = t.scenes;
const bare = (s) => (s || "").replace(/\[[^\]]*\]/g, "").replace(/[ً-ْـ]/g, "").replace(/[.,،؟?!:%…]+/g, " ").replace(/\s+/g, " ").trim();
const text = (s) => bare(s.say || s.words.map((w) => w.w).join(" "));
const r2 = (v) => +v.toFixed(2);
let from = 0;
const find = (snip, exact = false) => {
  const f = bare(snip);
  for (let i = from; i < S.length; i++) {
    const x = text(S[i]);
    if (exact ? x === f : x.includes(f)) { from = i; return r2(S[i].start); }
  }
  throw new Error(`no line with "${snip}" after line ${from + 1}`);
};
// «بس..» on its own line before «محدش»: optional (falls back to the «محدش» line)
const optional = (snip, exact) => { const keep = from; try { return find(snip, exact); } catch { from = keep; return null; } };
const beats = {};
beats.hook = r2(S[0].start);
beats.alone = find("لوحدهم");
beats.gym = find("الجيم");
beats.forty1 = find("أربعين واحد");
beats.forty2 = find("سماعة");
beats.talk = find("أطول حوار");
beats.ask = find("كوتش");
beats.reply = find("مجموعة");
beats.newbie = find("داخل لوحده");
beats.phone = find("الموبايل");
beats.twenty = find("عشرين");
beats.up1 = find("نبعد");
beats.building = find("العمارة");
beats.up2 = find("نبعد");
beats.city = find("ناويين");
const butAt = optional("بس", true);
beats.noone = find("محدش يعرف");
beats.but = butAt ?? beats.noone;
beats.exists = find("موجود");
beats.apart = r2(S[from + 1].start); from += 1; // the line after «موجود», whatever its word
beats.join = find("جمعناهم");
beats.app = find("إمتى");
beats.coins = find("سوا");
beats.secret = find("بيني وبينك");
beats.hour = find("ساعة");
beats.logo = r2(S[S.length - 1].start);
process.stdout.write(JSON.stringify({ beats, durationSec: +t.durationSec.toFixed(3), debug: false }));
