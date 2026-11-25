// videos/iba-zumba: (re)place the timed sounds from out/factiba/props.json + timeline.json (run after iba-props.mjs, before the render).
// Claps follow the film's own clap phase (fact3d/ibaTiming.ts danceAt), the ivory knocks the film's clack frames.
import fs from "node:fs";
// node scripts/iba-sfx.mjs [slug] [props.json]
const slug = process.argv[2] ?? "iba-zumba";
const P = JSON.parse(fs.readFileSync(process.argv[3] ?? "out/factiba/props.json", "utf8"));
const T = JSON.parse(fs.readFileSync(`videos/${slug}/timeline.json`, "utf8"));
const vB = T.scenes[1].say.includes("حيطان");
const sp = `videos/${slug}/script.json`, S = JSON.parse(fs.readFileSync(sp, "utf8"));
const fps = 30, F = (t) => Math.round(t * fps), s = P.starts.map(F);
const lock = s[10] - 3, bB = Math.min(s[8] - 2, s[9] - 30), bA = bB - 10, fast = Math.min(s[7] + 8, bA - 10);
const clack = Math.min(Math.max(F(P.words.clack), s[9] + 4), lock - 14);
const P1 = 15, ph0 = 0.35, phFast = ph0 + fast / P1, N = Math.round(phFast + (clack - fast) / 10), r2 = (N - phFast) / Math.max(1, clack - fast);
const times = [];
for (let n = Math.ceil(ph0); ; n++) { const f = (n - ph0) * P1; if (f >= fast) break; times.push(f / fps); }
for (let n = Math.ceil(phFast + 1e-6); ; n++) { const f = fast + (n - phFast) / r2; if (f >= clack - 2) break; times.push(f / fps); }
const from = vB ? P.starts[7] : (s[4] - 4) / fps, to = s[8] / fps - 0.15, wallA = P.starts[5], fastT = fast / fps;
const put = (t, e) => { const k = T.scenes.findIndex((x) => t >= x.start && t < x.end); if (k >= 0) (S.scenes[k].sfx ??= []).push({ at: +(t - T.scenes[k].start).toFixed(3), ...e }); };
S.scenes.forEach((sc) => { delete sc.sfx; });
if (vB) put(Math.max(s[4] + 22, s[5] - 2) / fps - 0.15, { sound: "trend/03-whoosh-cinematic", volume: 0.8 });   // version B: the cinematic whoosh (owner shortlisted 3 / 4 / 7, 2026-11-16), its peak on the wall arriving
else {
  put(P.starts[2] + 0.2, { sound: "trend/01-whoosh-air", volume: 0.7 });         // the whip after the hook line
  put(P.starts[5], { sound: "trend/01-whoosh-air", volume: 0.6 });                // into the painted wall
}
put(P.starts[8], { sound: "trend/01-whoosh-air", volume: 0.6 });                  // back to the hall
times.filter((t) => t >= from - 0.02 && t < to).forEach((t, i) => put(t, { sound: "iba-zumba/clap-" + (i % 2 ? "b" : "a"), layer: true, peak: 0.008, volume: t < wallA ? 0.85 : t < fastT ? 0.4 : 0.65 }));
put(clack / fps, { sound: "iba-zumba/clack", peak: 0.015 });
put(clack / fps + 0.35, { sound: "iba-zumba/clack", peak: 0.015 });
put(P.speaker, { sound: "trend/16-pop-whoosh" });
const last = S.scenes.length - 1, act = (S.scenes[last].action ?? []).find((a) => a.type === "mrs:clack");
if (act) [0.57, 1.14].forEach((d) => put(T.scenes[last].start + act.at + d, { sound: "iba-zumba/clack", peak: 0.015 }));
fs.writeFileSync(sp, JSON.stringify(S, null, 1));
console.log("sfx placed:", S.scenes.map((x) => (x.sfx ?? []).length).join(" "));
