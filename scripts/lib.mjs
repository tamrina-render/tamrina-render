// Shared helpers for the pipeline scripts (Node 20+, no dependencies).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VIDEOS = path.join(ROOT, "videos");
export const PUBLIC = path.join(ROOT, "public");

export const log = (...a) => console.log("[reel]", ...a);
export const warn = (...a) => console.warn("[reel] !", ...a);
export const die = (msg) => { console.error("[reel] ERROR:", msg); process.exit(1); };

export const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const writeJSON = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8"); };
export const exists = (p) => fs.existsSync(p);
export const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

/** Run a command, inherit stdio unless capture=true. Returns {status, stdout, stderr}. */
export const run = (cmd, args, { capture = false, cwd = ROOT, env = {}, quiet = false } = {}) => {
  if (!quiet) log("$", cmd, args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" "));
  const useShell = process.platform === "win32" && /^(npx|npm|node)$/.test(cmd);
  // with shell:true Node does not quote args -> paths with spaces (this repo!) would break
  const safeArgs = useShell ? args.map((a) => (/[\s"]/.test(a) ? `"${String(a).replace(/"/g, '\\"')}"` : a)) : args;
  const r = spawnSync(cmd, safeArgs, {
    cwd,
    env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8", ...env },
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    shell: useShell, // .cmd shims on Windows
    maxBuffer: 1024 * 1024 * 64,
  });
  if (r.error) die(`${cmd} failed to start: ${r.error.message}`);
  return r;
};

export const runOk = (cmd, args, opts) => {
  const r = run(cmd, args, opts);
  if (r.status !== 0) die(`${cmd} exited with ${r.status}${r.stderr ? "\n" + r.stderr.slice(-2000) : ""}`);
  return r;
};

export const ffprobeDuration = (file) => {
  const r = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { capture: true, quiet: true });
  return parseFloat(String(r.stdout).trim()) || 0;
};

export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "reel";

export const isRTL = (lang) => /^(ar|he|fa|ur)/i.test(lang || "");

export const parseArgs = (argv) => {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
};

export const stripMarks = (s) => String(s).replace(/\*(.+?)\*/g, "$1").replace(/\[\[.*?\]\]/g, "").replace(/\[[^\]]*\]/g, "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();
export const r3 = (n) => Math.round(n * 1000) / 1000;
