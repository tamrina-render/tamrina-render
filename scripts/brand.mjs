// Brand presets: brands/<name>/brand.json (+ facts.json). One line in script.json ("brand": "tamrina")
// brings the look, voices per pool, pronunciation fixes, motion profile, sound map and a facts check.
import path from "node:path";
import { die, exists, readJSON, ROOT, warn } from "./lib.mjs";

export const BRANDS = path.join(ROOT, "brands");

export const loadBrand = (name) => {
  const dir = path.join(BRANDS, name);
  if (!exists(path.join(dir, "brand.json"))) die(`unknown brand "${name}" (no brands/${name}/brand.json)`);
  const brand = readJSON(path.join(dir, "brand.json"));
  brand.facts = exists(path.join(dir, "facts.json")) ? readJSON(path.join(dir, "facts.json")) : null;
  return brand;
};

const hexA = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, "0");

/**
 * script + brand + pool -> a plain script the rest of the pipeline already understands.
 * Script fields always win over brand defaults. Female pool: scene.sayF / scene.propsF replace say / merge into visual.props.
 */
export const applyBrand = (script, brand, pool) => {
  if (pool === "duo") return applyDuo(script, brand);
  const P = brand.pools?.[pool];
  if (!P) die(`brand ${brand.name}: unknown pool "${pool}" (use ${Object.keys(brand.pools ?? {}).join(" | ")})`);
  const fem = pool === "female";
  const theme = { ...brand.theme, accent: P.accent, soft: hexA(P.accent, 0.14), ...(script.theme ?? {}) };
  const out = {
    lang: brand.lang,
    captions: brand.captions,
    speed: brand.speed,
    gap: brand.gap,
    tail: brand.tail,
    motion: brand.motion,
    ttsEngine: brand.ttsEngine,
    ttsSettings: brand.ttsSettings,
    voice: P.voice,
    elevenVoice: P.elevenVoice,
    ttsModel: P.ttsModel,
    ...script,
    presenter: { ...P.presenter, ...(script.presenter ?? {}) },
    theme,
    brand: brand.name,
    pool,
    handle: script.handle ?? brand.handle,
    deliver: script.deliver ?? brand.deliver ?? null,
    keep: script.keep ?? brand.keep ?? null,
    read: script.read ?? brand.read,
    pronounce: { ...(brand.pronounce ?? {}), ...(P.pronounce ?? {}), ...(script.pronounce ?? {}) }, // brand < voice < script
    // script "sfx": false = silent; an object overrides map keys ({ "scene": null } drops a sound, { "auto": false } = only the
    // sounds the script places itself, e.g. a remake that plays the original sound)
    sfxMap: script.sfx === false ? null : script.sfx && typeof script.sfx === "object" && !Array.isArray(script.sfx) ? { ...(brand.sfx ?? {}), ...script.sfx } : brand.sfx ?? null,
  };
  out.scenes = script.scenes.map((sc) => {
    const s = { ...sc };
    if (fem && sc.sayF) s.say = sc.sayF;
    if (fem && sc.labelF) s.label = sc.labelF;
    if (fem && sc.propsF && sc.visual) s.visual = { ...sc.visual, props: { ...(sc.visual.props ?? {}), ...sc.propsF } };
    if (fem && sc.visualF) s.visual = sc.visualF;
    if (!fem && sc.visualM) s.visual = sc.visualM;
    delete s.sayF; delete s.propsF; delete s.labelF; delete s.visualF; delete s.visualM;
    return s;
  });
  const bad = out.scenes.map((s) => s.visual?.type).filter((t) => t && brand.visuals && !brand.visuals.includes(t));
  if (bad.length) die(`brand ${brand.name} does not use visual(s): ${[...new Set(bad)].join(", ")}. Allowed: ${brand.visuals.join(", ")}`);
  return out;
};

/** Duo: Mr. + Mrs. Coin in ONE video. Every scene has "speaker": "mr" | "mrs" -> that coin's voice, colour, facts pool. */
const applyDuo = (script, brand) => {
  if (script.cast.some((m) => typeof m === "object")) return applyCast(script, brand);
  const M = brand.pools.male, Fm = brand.pools.female;
  const byWho = { mr: M, mrs: Fm };
  const base = applyBrand({ ...script, cast: undefined }, brand, "male");
  const out = {
    ...base,
    pool: null,
    presenter: { ...M.presenter, ...(script.presenter ?? {}), cast: ["mr", "mrs"] },
    theme: { ...base.theme, accent: M.accent, accent2: Fm.accent, ...(script.theme ?? {}) },
  };
  out.scenes = script.scenes.map((sc, i) => {
    const who = sc.speaker;
    if (who !== "mr" && who !== "mrs") throw new Error(`duo video: scene ${i + 1} needs "speaker": "mr" or "mrs"`);
    const P = byWho[who];
    return { ...base.scenes[i], speaker: who, accent: P.accent, elevenVoice: P.elevenVoice, ttsModel: P.ttsModel, voice: P.voice, factsPool: who === "mr" ? "male" : "female" };
  });
  return out;
};

/**
 * A cast of copies: any number of coins, each { id, from?: "mr" | "mrs" | "plain", voice?, color?, place?, outfit?, kit?... }.
 * Every scene has "speaker": <cast id> -> that coin's voice (its own ElevenLabs id, else its preset's: Mrs. = the female
 * pool, Mr. / plain = the male pool), its mouth, the accent and facts pool of its preset. The coins are drawn by Coin3D.
 */
const applyCast = (script, brand) => {
  const M = brand.pools.male, Fm = brand.pools.female;
  const members = script.cast.map((m) => (typeof m === "string" ? { id: m } : m));
  const kindOf = (m) => m.from ?? (m.id === "mrs" ? "mrs" : m.id === "mr" ? "mr" : "plain");
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  if (members.length !== Object.keys(byId).length) throw new Error("cast: two coins have the same id");
  const base = applyBrand({ ...script, cast: undefined }, brand, "male");
  const out = {
    ...base,
    pool: null,
    presenter: { ...M.presenter, ...(script.presenter ?? {}), cast: members },
    theme: { ...base.theme, accent: M.accent, ...(members.some((m) => kindOf(m) === "mrs") ? { accent2: Fm.accent } : {}), ...(script.theme ?? {}) },
  };
  out.scenes = script.scenes.map((sc, i) => {
    const m = byId[sc.speaker];
    if (!m) throw new Error(`cast video: scene ${i + 1} needs "speaker": one of ${members.map((x) => x.id).join(", ")}`);
    const P = kindOf(m) === "mrs" ? Fm : M;
    return { ...base.scenes[i], speaker: m.id, accent: P.accent, elevenVoice: m.voice ?? P.elevenVoice, ttsModel: P.ttsModel, voice: P.voice, factsPool: P === Fm ? "female" : "male" };
  });
  return out;
};

// ---------- pronunciation: only the voice hears it, captions keep the normal spelling ----------
const PUNCT = /^([\p{P}]*)(.*?)([\p{P}]*)$/u;
const PREFIXES = ["", "و", "ف"];

/** Spoken form of one plain word token (no tags, no marks) or null. */
const say1 = (word, dict) => {
  const [, pre, core, post] = word.match(PUNCT);
  if (!core || core.startsWith("$")) return null;
  for (const p of PREFIXES) {
    if (core.startsWith(p) && dict[core.slice(p.length)] !== undefined) return pre + p + dict[core.slice(p.length)] + post;
  }
  return null;
};

/**
 * "[happy] كل تمرينة *متأكدة*" -> { text for TTS, map: per spoken script word, how many TTS words it became }.
 * Tags and *marks* are kept (tts.py strips them), so word order and emphasis are unchanged.
 */
export const pronounce = (say, dict) => {
  const map = [];
  // whitespace words, like respell(); *marks* are dropped here (tts.py strips them anyway, emphasis comes from `say`)
  const text = say.replace(/\[[^\]]*\]|\{[^}]*\}|\S+/g, (m) => {
    if (m.startsWith("[")) return m;
    if (m.startsWith("{")) return "";
    const w = m.replace(/\*/g, "");
    if (!w) return "";
    const r = dict ? say1(w, dict) : null;
    map.push(r ? r.trim().split(/\s+/).length : 1);
    return r ?? w;
  });
  return { text, map, changed: map.some((n) => n !== 1) || text !== say };
};

/** Words from TTS (spoken spelling) -> words with the script spelling, merging multi-word replacements. */
export const respell = (words, say, map) => {
  const plain = say.replace(/\[[^\]]*\]/g, " ").replace(/\{[^}]*\}/g, " ").replace(/\*/g, "").trim().split(/\s+/).filter(Boolean);
  const want = map.reduce((a, b) => a + b, 0);
  if (plain.length !== map.length || words.length !== want) {
    warn(`pronounce: TTS returned ${words.length} words, expected ${want}; captions keep the TTS spelling for this scene`);
    return words;
  }
  const out = [];
  let j = 0;
  plain.forEach((w, i) => {
    const part = words.slice(j, j + map[i]);
    j += map[i];
    out.push({ ...part[0], w, end: part[part.length - 1].end });
  });
  return out;
};

// ---------- facts check ----------
const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);

/** Returns a list of problems (empty = OK). Checks both what is said and what is shown. */
export const checkFacts = (script, brand) => {
  const F = brand.facts;
  if (!F) return [];
  const problems = [];
  script.scenes.forEach((sc, i) => {
    const said = String(sc.say ?? "").replace(/\*/g, "");
    // what is shown: the card's props and a named edit's text (orbit chips, a cover masthead): an invented number there is stopped too
    // only the edit props that are words on screen: layout numbers (y, size, zoom) and file paths (src, images) are not claims
    const EDIT_TEXT = ["items", "lines", "rows", "masthead", "strap", "line", "text", "label", "value", "title"];
    const editText = typeof sc.edit === "object" && sc.edit ? Object.fromEntries(EDIT_TEXT.filter((k) => sc.edit[k] !== undefined).map((k) => [k, sc.edit[k]])) : {};
    const shown = JSON.stringify(sc.visual?.props ?? {}) + "\n" + JSON.stringify(editText);
    const both = `${said}\n${sc.label ?? ""}\n${shown}`;
    for (const r of F.rules ?? []) {
      if (r.unless && get(F.facts, r.unless)) continue;
      const m = both.match(new RegExp(r.pattern, "iu"));
      if (m) problems.push(`scene ${i + 1}: "${m[0]}" -> ${r.msg}`);
    }
    const gyms = F.facts?.gyms?.[sc.factsPool ?? script.pool];
    if (gyms != null && F.counts?.words) {
      const words = F.counts.words;
      const toLatin = (s) => s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
      const re = new RegExp(`(?<![A-Za-z\\d])(\\d+)\\s*(?:${words})|(?:${words})[^\\d"]{0,24}?(\\d+)`, "giu");
      // what is said + the words a named edit shows (orbit chips, a masthead): "50 جيم" on a chip is a claim too
      // every string / number in the edit, nested ones too; an object's values stay on one line ({ n: 17, label } -> "17 label")
      const flat = (v) => (typeof v === "string" || typeof v === "number" ? [String(v)] : Array.isArray(v) ? v.flatMap(flat) : v && typeof v === "object" ? [Object.values(v).flatMap(flat).join(" ")] : []);
      const editWords = flat(Object.values(editText)).join("\n");
      for (const m of toLatin(`${said}\n${editWords}`).matchAll(re)) {
        const n = Number(m[1] ?? m[2]);
        if (/(?:سنة|عام)\s*\d+$/u.test(m[0].trim())) continue; // a year ("الجيم على تيتانيك سنة 1912") is not a gym count
        if (n !== gyms) problems.push(`scene ${i + 1}: says ${n} next to "${m[0].trim()}" but the ${sc.factsPool ?? script.pool} pool has ${gyms} partner places`);
      }
      // a counter/stat whose label talks about gyms must count to the real number
      const visit = (o) => {
        if (!o || typeof o !== "object") return;
        const label = String(o.label ?? "");
        const n = o.to ?? o.value ?? o.n;
        if (typeof n === "number" && new RegExp(words, "iu").test(label) && n !== gyms) problems.push(`scene ${i + 1}: visual shows ${n} for "${label}" but the ${sc.factsPool ?? script.pool} pool has ${gyms}`);
        Object.values(o).forEach(visit);
      };
      visit(sc.visual?.props);
      visit(editText);
    }
  });
  return problems;
};
