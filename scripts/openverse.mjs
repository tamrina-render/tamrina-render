// Free sound effects from Openverse (openverse.org) with a strict licence filter.
// Usage: node scripts/openverse.mjs "<query>" --out <dir> [--n 5] [--max-dur 6] [--dry] [--no-api-filter]
//   Allowed: CC0, public domain mark (pdm), CC BY (any version). Everything else is rejected
//   (by-sa, by-nc, by-nd, nc-sampling+, sampling+, unknown), on the API side AND again here.
//   --dry           list kept / rejected (with the reason), download nothing.
//   --no-api-filter diagnostic: leave the licence filter out of the API call so the client-side check is exercised.
// Output: <out>/<name>-<id8>.<ext> (original) + .wav (48 kHz mono 16-bit), <out>/LICENSE.md, JSON summary on stdout.
// API: GET https://api.openverse.org/v1/audio/ (docs: https://api.openverse.org/v1/ , schema /v1/schema/).
//   Anonymous limits: 20 requests/min, 200/day, page_size <= 20. One search request per run.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const valued = new Set(["--out", "--n", "--max-dur"]);
const query = argv.find((a, i) => !a.startsWith("--") && !valued.has(argv[i - 1]));
const outDir = opt("--out");
const want = Number(opt("--n", 5));
const maxDur = opt("--max-dur") != null ? Number(opt("--max-dur")) : null;
const dry = flag("--dry");
if (!query || !outDir) { console.error('Usage: node scripts/openverse.mjs "<query>" --out <dir> [--n 5] [--max-dur 6] [--dry]'); process.exit(1); }

const ALLOWED = new Set(["cc0", "pdm", "by"]);
const UA = { "User-Agent": "reel-system/1.0" };

const params = new URLSearchParams({ q: query, page_size: "20" });
if (!flag("--no-api-filter")) params.set("license", [...ALLOWED].join(","));
const res = await fetch(`https://api.openverse.org/v1/audio/?${params}`, { headers: UA });
if (!res.ok) { console.error(`Openverse ${res.status}: ${(await res.text()).slice(0, 300)}`); process.exit(1); }
const data = await res.json();

const rejected = [], kept = [];
for (const r of data.results ?? []) {
  const lic = String(r.license ?? "").toLowerCase();
  let why = null;
  if (!ALLOWED.has(lic)) why = `licence ${lic || "unknown"}`;
  // real-sound skill policy: CC BY only in versions 2.0-4.0 (1.0 had different terms)
  else if (lic === "by" && !["2.0", "2.5", "3.0", "4.0"].includes(String(r.license_version ?? ""))) why = `licence by ${r.license_version ?? "?"} (only 2.0-4.0)`;
  else if (!r.url) why = "no direct url";
  else if (maxDur != null && r.duration != null && r.duration / 1000 > maxDur) why = `too long (${(r.duration / 1000).toFixed(1)}s)`;
  (why ? rejected : kept).push(why ? { r, why } : r);
}
const picked = kept.slice(0, want);
const row = (r) => ({ id: r.id, title: r.title, creator: r.creator, license: `${r.license} ${r.license_version ?? ""}`.trim(), duration_s: r.duration != null ? +(r.duration / 1000).toFixed(2) : null, source: r.source, page: r.foreign_landing_url });
const summary = {
  query, params: params.toString(), api_result_count: data.result_count, dry,
  rejected: rejected.map(({ r, why }) => ({ ...row(r), why })),
  kept: picked.map(row), files: [],
};

if (!dry && picked.length) {
  fs.mkdirSync(outDir, { recursive: true });
  const licPath = path.join(outDir, "LICENSE.md");
  const have = fs.existsSync(licPath) ? fs.readFileSync(licPath, "utf8") : "# Sound licences (Openverse)\n\n";
  let add = "";
  for (const r of picked) {
    const safe = (r.title || "sound").normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "sound";
    const ext = (r.filetype || path.extname(new URL(r.url).pathname).slice(1) || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
    const base = `${safe}-${r.id.slice(0, 8)}`;
    const orig = path.join(outDir, `${base}.${ext}`);
    const wav = path.join(outDir, ext === "wav" ? `${base}-48k.wav` : `${base}.wav`);
    try {
      const f = await fetch(r.url, { headers: UA });
      if (!f.ok) throw new Error(`download ${f.status}`);
      fs.writeFileSync(orig, Buffer.from(await f.arrayBuffer()));
      const ff = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", orig, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", wav], { encoding: "utf8" });
      if (ff.status !== 0) throw new Error(`ffmpeg: ${ff.stderr.slice(0, 200)}`);
    } catch (e) { summary.files.push({ id: r.id, error: String(e.message) }); continue; }
    const lic = `${String(r.license).toUpperCase()} ${r.license_version ?? ""}`.trim();
    summary.files.push({ original: orig, wav, ...row(r) });
    if (!have.includes(path.basename(orig)))
      add += `- ${path.basename(orig)} (+ ${path.basename(wav)}): "${r.title}" by ${r.creator ?? "unknown"}; licence ${lic} (${r.license_url}); source ${r.foreign_landing_url}; attribution required: ${r.license === "by" ? "yes" : "no"}\n`;
  }
  if (add) fs.writeFileSync(licPath, have + add);
}
console.log(JSON.stringify(summary, null, 2));
