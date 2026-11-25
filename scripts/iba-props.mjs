// FactIba props from a timeline: node scripts/iba-props.mjs <timeline.json> > out/factiba/props.json
// Beat starts = clause starts of videos/iba-zumba (word times), so a new voice take only needs this rerun + a film render.
import fs from "node:fs";
const t = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const S = t.scenes;
const rel = S[1].words[0].start < S[1].start - 0.01; // word times relative to the scene?
const at = (i, find, nth = 0) => {
  const ws = S[i].words; let k = 0, n = 0;
  if (find) { k = -1; ws.forEach((w, j) => { if (k < 0 && w.w.includes(find)) { if (n++ === nth) k = j; } }); if (k < 0) throw new Error(`scene ${i + 1}: no word "${find}"`); }
  return +(ws[k].start + (rel ? S[i].start : 0)).toFixed(2);
};
// beat 2 (the pan across the empty corners) is a 0.45 s whip under a whoosh when line 1 has no "بس من غير سماعات"
const has = (i, f) => S[i].words.some((w) => w.w.includes(f));
const b2 = has(0, "بس") ? at(0, "بس") : +(S[1].start - 0.45).toFixed(2);
const endBeat = S[8] ? +S[8].start.toFixed(2) : +(t.durationSec - 1.9).toFixed(2); // no closing question: everyone looks at the camera for the last knocks
const vB = has(1, "حيطان"); // version B: line 1, then straight to the painted wall (no searching / clapping-girls beats)
const vC = vB && S[5]?.words.some((x) => x.w.includes("استني")); // version C: the classes ending (below)
let props;
if (vB) {
  const w = +S[1].start.toFixed(2), e0 = S[0].words.at(-1).end; // the camera rushes through beats 2-4 on the last word of line 1; the wall is fully in 22 frames after beat 4 (ibaTiming rB), on the first words of its own line
  const starts = [0, at(0, "من"), +(e0 - 0.45).toFixed(2), +(e0 - 0.45).toFixed(2), +(e0 - 0.45).toFixed(2), w, at(1, "صف"), at(1, "وجنبهم"), at(2), at(2, "إيدين", 1),
    +S[3].start.toFixed(2), +S[4].start.toFixed(2), +S[5].start.toFixed(2), +S[6].start.toFixed(2), vC ? 0 : at(6, "تنزلوا"), +(t.durationSec - 1.9).toFixed(2)];
  props = { starts, words: { clack: at(2, "بتسقف") }, take: +S[4].start.toFixed(2), speaker: at(4, "سماعات"), step: vC ? 0 : at(6, "سوا"), durationSec: +t.durationSec.toFixed(2), direct: true, debug: false };
  // version C (2026-11-17): the classes ending «استني كده.. / أهو.. class Zumba نازل على تمرينة.. بالميعاد والسعر. / دوست يهمني.. يلا بينا.»
  // a phone with the real «كلاسات» screens: up on «استني», push to the top card on «بالميعاد», tap on «يهمني», out on the hop.
  // The hop time = the last scene's "all:hop" action (script.json, passed as argv[3]), else «بينا».
  if (vC) {
    const sc = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], "utf8")).scenes : null;
    const hopA = sc?.[7]?.action?.find((a) => a.type === "all:hop");
    const hop = hopA ? +(S[7].start + hopA.at).toFixed(2) : at(7, "بينا");
    starts[12] = +S[5].start.toFixed(2); starts[13] = +S[6].start.toFixed(2); starts[14] = at(7, "يلا");
    Object.assign(props, {
      step: hop,
      phoneIn: +(at(5, "استني") - 0.1).toFixed(2), phonePush: +(at(6, "بالميعاد") - 0.1).toFixed(2), phoneTap: at(7, "يهمني"), phoneOut: +(hop - 0.1).toFixed(2),
      phoneScreens: ["footage/iba-zumba-c/app/classes-price-1.png", "footage/iba-zumba-c/app/classes-price-2.png"],
    });
  }
} else {
  const starts = [0, at(0, "من"), b2, at(1), at(1, "بنات"), at(2), at(2, "صف"), at(2, "وجنبهم"), at(3), at(3, "إيدين", 1),
  +S[4].start.toFixed(2), +S[5].start.toFixed(2), +S[6].start.toFixed(2), +S[7].start.toFixed(2), at(7, "تنزلوا"), endBeat];
props = { starts, words: { clack: at(3, "بتسقف") }, take: +S[5].start.toFixed(2), speaker: at(5, "سماعات"), step: at(7, "سوا"), durationSec: +t.durationSec.toFixed(2), debug: false };
}
process.stdout.write(JSON.stringify(props));
