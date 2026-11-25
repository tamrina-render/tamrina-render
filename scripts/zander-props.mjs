// FactZander props from a timeline: node scripts/zander-props.mjs <timeline.json> > videos/zander-gym/out/factzander/props.json
// Beat starts + named word times found by matching the Arabic words of videos/zander-gym, so a new voice take only needs this rerun + a film render.
import fs from "node:fs";
const t = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const S = t.scenes;
const rel = S[1].words[0].start < S[1].start - 0.01; // word times relative to the scene?
const r2 = (v) => +v.toFixed(2);
const at = (i, find, nth = 0) => {
  const ws = S[i].words;
  let k = 0, n = 0;
  if (find) { k = -1; ws.forEach((w, j) => { if (k < 0 && w.w.includes(find)) { if (n++ === nth) k = j; } }); if (k < 0) throw new Error(`scene ${i + 1}: no word "${find}"`); }
  return r2(ws[k].start + (rel ? S[i].start : 0));
};
const sc = (i) => r2(S[i].start);
const starts = [0, at(0, "كان"), at(0, "الناس"), sc(1), at(1, "ستوكهولم"), at(1, "فيه"), at(2, "طب"), at(2, "الصور"), sc(3), at(4, "دلوقتي"), at(4, "ناقص"), at(5, "استنى"), at(6, "أهو")];
const words = {
  suits: at(0, "بالبدل"), dresses: at(0, "والفساتين"), opened: at(1, "فتح"), n27: at(1, "27"),
  man: at(2, "راجل"), lady: at(2, "وست"), look: at(3, "لله"), same: at(6, "وبيتمرن"),
  sent: at(7, "بعتله"), accepted: at(7, "ووافق"), go: at(7, "يلا"),
};
// sanity: warn (stderr) when a take moved a beat by more than 0.05 s from the approved one
const REF = { starts: [0, 2.27, 3.72, 5.94, 8.3, 9.22, 11.45, 12.6, 18.52, 21.39, 23.45, 25.18, 26.43], words: { suits: 4.7, dresses: 5.04, opened: 7.54, n27: 9.45, man: 14.0, lady: 16.26, look: 19.4, same: 28.07, sent: 29.92, accepted: 30.84, go: 31.68 } };
starts.forEach((v, i) => { if (Math.abs(v - REF.starts[i]) > 0.05) process.stderr.write(`note: starts[${i}] = ${v} (approved take ${REF.starts[i]})\n`); });
for (const [k, v] of Object.entries(words)) if (Math.abs(v - REF.words[k]) > 0.05) process.stderr.write(`note: words.${k} = ${v} (approved take ${REF.words[k]})\n`);
process.stdout.write(JSON.stringify({ starts, words, durationSec: +t.durationSec.toFixed(3), debug: false }));
