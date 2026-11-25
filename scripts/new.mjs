// Scaffold videos/<slug>/script.json from a template. Usage: node scripts/new.mjs <slug> [--lang ar] [--title "..."] [--brand tamrina]
import path from "node:path";
import { exists, parseArgs, slugify, VIDEOS, writeJSON } from "./lib.mjs";

const a = parseArgs(process.argv.slice(2));
const slug = slugify(a._[0] || "");
if (!slug) { console.log("usage: node scripts/new.mjs <slug> [--lang ar] [--title ...]"); process.exit(1); }
const lang = a.lang || "en";
const ar = /^ar/.test(lang);
const p = path.join(VIDEOS, slug, "script.json");
if (exists(p) && !a.force) { console.log("exists:", p); process.exit(0); }
if (a.brand === "tamrina") {
  // Tamrina: one script, both pools (sayF = Ladies wording). Shape: hook (pain) -> but/therefore -> coin reveal -> last dab (guides/brand-tamrina.md)
  writeJSON(p, {
    title: a.title || slug,
    brand: "tamrina",
    scenes: [
      { label: "hook", say: "[curious] الساعة تسعة بالليل، وانت *لوحدك* في الجيم... *تاني*؟", sayF: "[curious] الساعة تسعة بالليل، وانتي *لوحدك* في الجيم... *تاني*؟", visual: { type: "chat", props: { title: "جروب الجيم", dim: true, messages: [{ text: "مين نازل النهارده؟", me: true }, { text: "...؟", me: true }] } } },
      { label: "nearby", say: "[happy] بس *تمرينة* بتلاقيلك *بارتنر* قريب منك.", sayF: "[happy] بس *تمرينة* بتلاقيلك *بارتنر* قريبة منك.", visual: { type: "map", props: { radius: "3", radiusUnit: "KM", pins: [{ km: "0.8" }, { km: "1.2" }, { km: "2.1" }] } } },
      { label: "the coin", pose: "flip", say: "كل تمرينة متسجلة بـ *كوين*... [laughs] *وأنا* الكوين ده!", visual: { type: "wallet", props: { steps: 2, label: "كوين لكل تمرينة" } } },
      { label: "squad", say: "[excited] حمّل *تمرينة*، ومتتمرنش *لوحدك* تاني.", sayF: "[excited] حمّلي *تمرينة*، ومتتمرنيش *لوحدك* تاني.", visual: { type: "stores", props: { tagline: "لاقي البارتنر بتاعك", stores: ["App Store"] } } },
    ],
  });
  console.log("created:", p);
  console.log(`next: node scripts/make.mjs ${slug} (both pools), then node scripts/sheet.mjs ${slug}`);
  process.exit(0);
}
const script = {
  title: a.title || slug,
  lang,
  voice: ar ? "ar-EG-ShakirNeural" : "en-US-AndrewNeural",
  speed: 1.12,
  captions: ar ? "both" : "headline",
  presenter: { type: "builtin", name: "default" },
  scenes: [
    {
      label: ar ? "الهوك" : "the hook",
      counter: { key: "VIEWS", from: 0, to: 4900000 },
      say: ar ? "أنا عملت *سيستم* بيبني الريل كله من *سطر واحد.*" : "I built a *system* that makes a whole reel from *one line.*",
      visual: { type: "terminal", props: { prompt: ar ? "اعمل ريل عن..." : "make a reel about my app", tabs: ["Claude Code", "Cursor", "Codex"] } },
    },
    {
      label: ar ? "ازاي" : "how",
      say: ar ? "بيكتب السكريبت، *يسجل الصوت*، ويحرك *كل مشهد*." : "It writes the script, *records the voice*, and animates *every scene*.",
      visual: { type: "pipeline", props: { steps: ar ? ["سكريبت", "صوت", "حركة", "ريندر"] : ["script", "voice", "motion", "render"], tab: "SYSTEM" } },
    },
    {
      label: ar ? "النتيجة" : "the result",
      counter: { key: "FOLLOWERS", from: 2283, to: 39522 },
      say: ar ? "والنتيجة؟ *أربعين ألف* متابع في *خمسة وتلاتين يوم.*" : "The result? *Forty thousand* followers in *thirty five days.*",
      visual: { type: "phone", props: { header: "yourname", stat: { from: 2283, to: 39522, label: "followers" }, chart: true, badge: { n: 22, label: "new followers" } } },
    },
  ],
};
writeJSON(p, script);
console.log("created:", p);
console.log(`next: node scripts/make.mjs ${slug}`);
