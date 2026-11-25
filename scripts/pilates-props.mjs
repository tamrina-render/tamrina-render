// FactPilates props from a timeline: node scripts/pilates-props.mjs <timeline.json> [script.json] > videos/pilates-bed/out/factpilates/props.json
// Beat starts + named word times found by matching the Arabic words of videos/pilates-bed, so a new voice take only needs this
// rerun + a film render. It also (re)writes the coins' ride tracks public/footage/pilates-bed/carriage.json / carriage2.json:
// the carriage seats moved by the SAME function the film uses (src/scenes/fact3d/pilatesTiming.ts: pushPlan, slideAt,
// seatWorld) and projected through the locked camera, so the coins ride the carriages frame-accurately (scene "ride").
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import * as T from "../src/scenes/fact3d/pilatesTiming.ts";

const t = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const S = t.scenes;
const rel = S[1].words[0].start < S[1].start - 0.01; // word times relative to the scene?
const r2 = (v) => +v.toFixed(2);
const r3 = (v) => +v.toFixed(3);
const at = (i, find, nth = 0) => {
  const ws = S[i].words;
  let k = 0, n = 0;
  if (find) { k = -1; ws.forEach((w, j) => { if (k < 0 && w.w.includes(find)) { if (n++ === nth) k = j; } }); if (k < 0) throw new Error(`scene ${i + 1}: no word "${find}"`); }
  return r2(ws[k].start + (rel ? S[i].start : 0));
};
const starts = S.map((s) => r3(s.start));
const words = {
  pilates: at(0, "Pilates"), reel: at(0, "ريل"), story: at(0, "حكايته"), bed: at(0, "بسرير"), hosp: at(0, "مستشفى"),
  n110: at(1, "110"), years: at(1, "سنة"), man: at(1, "واحد"), joseph: at(1, "جوزيف"), jailed: at(1, "اتحبس"), camp: at(1, "معتقل"), island: at(1, "جزيرة"), england: at(1, "إنجلترا"),
  untie: at(2, "فك"), springs: at(2, "سوست"), beds: at(2, "السراير"), tie: at(2, "وربطها"), patients: at(2, "العيانين"), train: at(2, "يتمرنوا"), lying: at(2, "نايمين"),
  out: at(3, "خرج"), thebed: at(3, "السرير"), reformer: at(3, "Reformer"), bysprings: at(3, "بسوست"), moves: at(3, "وبيتحرك"),
  found: at(4, "ولقى"), train5: at(4, "يتمرن"), me: at(5, "وأنا"), but: at(5, "غير"), nobody: at(5, "حد"),
  wait: at(6, "استني"), here: at(7, "أهي"), girl: at(7, "بنت"), same: at(7, "نفس"), sent: at(8, "بعتلها"), accepted: at(8, "ووافقت"), go: at(8, "يلا"), us: at(8, "بينا"),
};
const durationSec = r3(t.durationSec);
// sanity: warn (stderr) when a take moved a word by more than 0.05 s from the approved one the film defaults to
for (const [k, v] of Object.entries(words)) if (Math.abs(v - T.PIL_WORDS[k]) > 0.05) process.stderr.write(`note: words.${k} = ${v} (approved take ${T.PIL_WORDS[k]})\n`);
starts.forEach((v, i) => { if (Math.abs(v - T.PIL_STARTS[i]) > 0.05) process.stderr.write(`note: starts[${i}] = ${v} (approved take ${T.PIL_STARTS[i]})\n`); });

// ---- the ride tracks (reel px of each carriage seat, 30 samples per second, from rest just before Mrs. Coin's line)
const cam = new THREE.PerspectiveCamera(T.FIN_FOV, 1080 / 1920, 0.1, 3000);
cam.position.set(...T.FIN_P);
cam.up.set(0, 1, 0);
cam.lookAt(...T.FIN_L);
cam.updateProjectionMatrix();
cam.updateMatrixWorld();
const P = (w) => { const v = new THREE.Vector3(...w).project(cam); return { x: +(((v.x + 1) / 2) * 1080).toFixed(1), y: +(((1 - v.y) / 2) * 1920).toFixed(1) }; };
const plan = T.pushPlan(words, durationSec);
const t0 = r3(starts[4] - 0.2);
const track = (r, pushes) => {
  const out = [];
  for (let i = 0; t0 + i / 30 <= durationSec + 1e-6; i++) {
    const tt = r3(t0 + i / 30);
    out.push({ t: tt, ...P(T.seatWorld(r, T.slideAt(pushes, tt))), s: 1, local: true });
  }
  return out;
};
const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "footage", "pilates-bed");
fs.mkdirSync(pub, { recursive: true });
const c1 = track(T.R1, plan.c1);
const c2 = track(T.R2, plan.c2);
if (Math.abs(T.slideAt(plan.c1, t0)) > 1e-6 || Math.abs(T.slideAt(plan.c2, t0)) > 1e-6) throw new Error("a carriage is not at rest at the first sample");
fs.writeFileSync(path.join(pub, "carriage.json"), JSON.stringify({ anchors: { carriage: c1 } }));
fs.writeFileSync(path.join(pub, "carriage2.json"), JSON.stringify({ anchors: { carriage2: c2 } }));

// ---- what the script needs (stderr): the seats at rest, the floor spots beside them, the hop times
const floor1 = P(T.refWorld(T.R1, T.REF.rest + T.SEAT_DX, 0, -0.95));
const floor2 = P(T.refWorld(T.R2, T.REF.rest + T.SEAT_DX, 0, -0.95));
const say = (s) => process.stderr.write(s + "\n");
say(`seat 1 at rest ${c1[0].x},${c1[0].y} (moves to ${Math.min(...c1.map((q) => q.x))}..${Math.max(...c1.map((q) => q.x))} x) · floor in front ${floor1.x},${floor1.y}`);
say(`seat 2 at rest ${c2[0].x},${c2[0].y} · floor in front ${floor2.x},${floor2.y}`);
say(`ride on: mrs at ${r3(plan.hop1 - starts[4])} s into line 5, g at ${r3(plan.hop2 - starts[8])} s into line 9`);
process.stdout.write(JSON.stringify({ starts, words, durationSec, debug: false }));
