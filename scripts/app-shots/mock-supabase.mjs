// A fake Supabase for app screenshots: the real Tamrina app (web build) runs against this, so the
// screens are real code with made-up people, and nothing ever reaches the real database.
// node mock-supabase.mjs   then GET /__pool?p=male|female to switch accounts.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 54399;
const HOST = `http://localhost:${PORT}`;
const PARTNERS = "D:/Claude/GymBros/docs/partners";
const HERE = path.dirname(fileURLToPath(import.meta.url));

let pool = "male";
// Running post for bus-conductor: GET /__running?n=1..3 (my own post, n of 4 joined), n=0 off.
// Football post for the mob-football shots (football.mjs): off by default. GET /__football?n=1..5 turns it on with n + 2 joined of 7 (3/7 .. 7/7: three wait on the pitch, four join), n=0 turns it off.
let football = process.env.MOCK_FOOTBALL ? Number(process.env.MOCK_FOOTBALL) : 0;
let running = 0;
// One Zumba class in the Ladies pool for classes.mjs: off by default. GET /__classes?v=price|free|off[&me=1] (me=1 = "I tapped يهمني"). The tap itself (POST/DELETE class_interest) flips it too.
let classesV = "off", classesMe = false;
const ME = "00000000-0000-4000-8000-000000000001"; // sorts first, so "I am user A" in the chat
const MATCH = "00000000-0000-4000-8000-0000000000aa";

const asset = (dir, file) => `${HOST}/partners/${encodeURIComponent(dir)}/enhanced/${file}`;
const gym = (id, en, ar, district, dir, photos, extra = {}) => ({
  id, name_en: en, name_ar: ar, district, address: null, lat: 30.2 + Math.random() / 100, lng: 31.47,
  is_partner: true, is_featured: false,
  logo_path: asset(dir, "logo.jpg"), photos: photos.map((n) => asset(dir, n)), photos_female: [],
  whatsapp: "201000000000", social_url: null, facebook_url: null, women_only: false, ladies_hall: true, ...extra,
});
const GYMS = [
  gym("n1", "N1 Gym", "N1 جيم", "Obour", "N1 GYM", ["1.jpg", "2.jpg", "3.jpg"]),
  gym("power", "Power Gym", "باور جيم", "Obour", "Power Gym", ["1.jpg", "2.jpg"]),
  gym("muscle", "Muscle Arena", "ماسل أرينا", "Obour", "Muscle Arena", ["1.jpg", "2.jpg"]),
  gym("ikardio", "IKARDIO Gym", "آي كارديو", "Obour", "IKARDIO Gym", ["1.jpg", "2.jpg"]),
  gym("lifestyle", "LifeStyle Center", "لايف ستايل", "Obour", "LifeStyle Center", ["1.jpg", "2.jpg"]),
  gym("effective", "Effective", "إفيكتيف", "Obour", "Effective", ["1.jpg"]),
  gym("falcon", "Falcon Gym", "فالكون جيم", "Obour", "Falcon", ["1.jpg"]),
  gym("pawlo", "Pawlo Gym", "باولو جيم", "Obour", "Pawlo", ["1.jpg"]),
  gym("bibo", "BIBO Gym", "بيبو جيم", "Zahret El Obour", "BIBO", ["1.jpg"]),
  gym("apex", "Apex Academy", "أبيكس", "Obour", "Apex Academy", ["1.jpg"]),
  gym("nana", "NANA Studio", "نانا ستوديو", "Obour", "NANA Studio", ["1.jpg", "2.jpg"], { women_only: true }),
  gym("ayat", "Ayat El-Hady Fitness Studio", "آيات الهادي", "Obour", "Ayat Elhady Fitness Studio", ["1.jpg", "2.jpg", "3.jpg"], { women_only: true }),
];
// facts.json: 10 gyms for men, 9 for women (the screen prints the count)
const gymsFor = () => (pool === "female" ? [...GYMS.slice(0, 9), ...(classesV !== "off" ? [GYMS[10], GYMS[11]] : [])] : GYMS.slice(0, 10));
// next Saturday 7 pm in Cairo, at least 3 days ahead
const classStart = () => {
  const f = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(d).reduce((o, x) => ((o[x.type] = x.value), o), {});
  for (let k = 3; k < 11; k++) {
    const day = f(new Date(Date.now() + k * 864e5));
    if (day.weekday !== "Sat") continue;
    for (const h of [16, 17]) { const d = new Date(`${day.year}-${day.month}-${day.day}T${h}:00:00Z`); if (f(d).hour === "19") return d.toISOString(); }
  }
};
const classRows = () => {
  if (pool !== "female" || classesV === "off") return [];
  const at = classStart();
  const day = (k, mins) => new Date(Date.parse(at) + k * 864e5 + mins * 6e4).toISOString(); // Saturday 7 pm +/- days / minutes
  const row = (id, gym_id, title, starts_at, price_egp, seats, interested, me = false) => ({ id, gym_id, title, starts_at, price_egp, seats, note: null, interested: interested + (me ? 1 : 0), i_interested: me });
  return [
    row("c1", "ayat", "Zumba", at, classesV === "free" ? 0 : 150, 12, 5, classesMe),
    row("c2", "nana", "Pilates", day(1, -60), 200, 8, 9),
    row("c3", "ikardio", "Kickboxing", day(2, 60), 180, 15, 3),
    row("c4", "falcon", "Cardio", day(3, -120), 100, 20, 7),
  ];
};

// Only N1's real offers (brands/tamrina/facts.json): never an invented one.
const PERKS = [
  { id: "n1-free", gym_id: "n1", kind: "free_session", title_en: "First session free", title_ar: "أول حصة ببلاش", details_en: null, details_ar: null, audience: "new", valid_until: null, pool: null },
  { id: "n1-7", gym_id: "n1", kind: "discount", title_en: "7% off membership", title_ar: "خصم ٧٪ على الاشتراك", details_en: null, details_ar: "فوق سعر عرض الجيم، لما تحمّل تمرينة", audience: "all", valid_until: null, pool: null },
];

const coin = (name) => `${HOST}/shots/avatar-${name}.png`;
const PEOPLE = {
  male: {
    me: { name: "كريم", kit: 27 },
    partner: { id: "00000000-0000-4000-8000-000000000037", name: "عمر", kit: 37 },
    cards: [
      { id: "00000000-0000-4000-8000-000000000037", kit: 37, name: "عمر", age: 24, km: 1.2, gym: "n1", avatar: "mr", time: "evening", days: ["sat", "mon", "wed"], goals: ["muscle", "strength"], exp: "intermediate", bio: "بتمرن بالليل بعد الشغل، ومحتاج حد يلتزم معايا" },
      { id: "00000000-0000-4000-8000-000000000012", kit: 12, name: "يوسف", age: 22, km: 0.8, gym: "n1", avatar: "gold", time: "evening", days: ["sun", "tue", "thu"], goals: ["muscle"], exp: "beginner", bio: "لسه بادئ، عايز حد يشدني" },
      { id: "00000000-0000-4000-8000-000000000081", kit: 81, name: "مازن", age: 27, km: 2.1, gym: "power", avatar: "mr", time: "evening", days: ["sat", "tue"], goals: ["strength"], exp: "advanced", bio: null },
    ],
  },
  female: {
    me: { name: "نور", kit: 27 },
    partner: { id: "00000000-0000-4000-8000-000000000037", name: "فريدة", kit: 37 },
    cards: [
      { id: "00000000-0000-4000-8000-000000000037", kit: 37, name: "فريدة", age: 23, km: 1.2, gym: "n1", avatar: "mrs", time: "evening", days: ["sat", "mon", "wed"], goals: ["muscle", "strength"], exp: "intermediate", bio: "بروح بعد الشغل، ومحتاجة حد يلتزم معايا" },
      { id: "00000000-0000-4000-8000-000000000012", kit: 12, name: "ملك", age: 21, km: 0.8, gym: "n1", avatar: "gold", time: "evening", days: ["sun", "tue", "thu"], goals: ["muscle"], exp: "beginner", bio: "لسه بادئة، عايزة حد يشجعني" },
      { id: "00000000-0000-4000-8000-000000000081", kit: 81, name: "سلمى", age: 26, km: 2.1, gym: "power", avatar: "mrs", time: "evening", days: ["sat", "tue"], goals: ["strength"], exp: "advanced", bio: null },
    ],
  },
};

const profile = () => ({
  id: ME, kit_number: PEOPLE[pool].me.kit, first_name: PEOPLE[pool].me.name, birth_date: "2000-01-01", gender: pool, bio: null, district: "Obour",
  preferred_gym_id: "n1", verification_status: "approved", is_admin: false, account_status: "active", radius_km: 5, hidden_until: null,
  location: "POINT(31.47 30.2)", welcome_seen_at: "2026-01-01T00:00:00Z", training_time: "evening", days_per_week: 4, goals: ["muscle", "strength"],
  experience: "intermediate", free_days: ["sat", "mon", "wed"], profile_photos: [{ storage_path: coin(pool === "male" ? "mr" : "mrs"), position: 0 }],
});
const stack = () => PEOPLE[pool].cards.map((c) => ({
  id: c.id, kit_number: c.kit, first_name: c.name, age: c.age, district: "Obour", bio: c.bio, training_time: c.time, days_per_week: 4,
  free_days: c.days, goals: c.goals, experience: c.exp, preferred_gym_id: c.gym, photo_path: coin(c.avatar), distance_km: c.km, cards_left: 9,
}));
const matchRow = () => {
  const p = PEOPLE[pool].partner;
  return { match_id: MATCH, matched_at: "2026-11-01T10:00:00Z", partner_id: p.id, kit_number: p.kit, first_name: p.name, age: 24, district: "Obour", training_time: "evening", preferred_gym_id: "n1", photo_path: coin(pool === "male" ? "mr" : "mrs"), last_type: "text", last_body: "تمام، أشوفك هناك 💪", last_sender_id: p.id, last_at: "2026-11-01T10:06:00Z" };
};
const tomorrow = () => { const d = new Date(Date.now() + 864e5); d.setUTCHours(17, 0, 0, 0); return d.toISOString(); };
const sessions = () => [{ id: "s1", match_id: MATCH, gym_id: "n1", proposed_by: ME, scheduled_at: tomorrow(), status: "accepted", verified_at: null, present_a: null, present_b: null, outcome: null }];
const messages = () => {
  const p = PEOPLE[pool].partner;
  const row = (id, min, sender, type, body, payload = null) => ({ id, match_id: MATCH, sender_id: sender, type, body, payload, created_at: new Date(Date.UTC(2026, 10, 1, 10, min)).toISOString() });
  const near = (g, a, b) => ({ id: g.id, name_en: g.name_en, name_ar: g.name_ar, district: g.district, km_a: a, km_b: b });
  return [
    row("m1", 0, null, "gym_suggestion", null, { gyms: [near(GYMS[0], 1.3, 0.9), near(GYMS[1], 0.6, 1.6), near(GYMS[2], 1.0, 1.8)] }),
    row("m2", 2, ME, "session_proposal", null, { session_id: "s1", gym_id: "n1", scheduled_at: tomorrow() }),
    row("m3", 4, p.id, "text", pool === "male" ? "ماشي يا كريم، بكرة سبعة" : "ماشي يا نور، بكرة سبعة"),
    row("m4", 5, ME, "text", "اتفقنا"),
    row("m5", 6, p.id, "text", "تمام، أشوفك هناك 💪"),
  ].reverse(); // the app asks for newest first
};

const plans = () => {
  const soon = (h) => new Date(Date.now() + h * 36e5).toISOString();
  const [a, b, c] = PEOPLE[pool].cards;
  const row = (id, p, activity, place, h, spots, joined, note, km) => ({ id, user_id: p.id, first_name: p.name, kit_number: p.kit, photo_path: coin(p.avatar), activity, place, starts_at: soon(h), spots, note, distance_km: km, joined, i_joined: false, is_mine: false });
  // tomorrow 9 pm in Cairo, whatever the machine's own zone is
  const cairoNine = () => {
    const f = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(d).reduce((o, x) => ((o[x.type] = x.value), o), {});
    const day = f(new Date(Date.now() + 864e5));
    for (const h of [17, 18, 19]) { const d = new Date(`${day.year}-${day.month}-${day.day}T${h}:00:00Z`); if (f(d).hour === "21") return d.toISOString(); }
  };
  // tomorrow 7 am in Cairo (the morning run)
  const cairoSeven = () => {
    const f = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(d).reduce((o, x) => ((o[x.type] = x.value), o), {});
    const day = f(new Date(Date.now() + 864e5));
    for (const h of ["03", "04", "05", "06"]) { const d = new Date(`${day.year}-${day.month}-${day.day}T${h}:00:00Z`); if (f(d).hour === "07") return d.toISOString(); }
  };
  const fb = football > 0 && pool === "male"
    ? [{ ...row("pf", { id: "00000000-0000-4000-8000-000000000009", name: "كريم", kit: 9, avatar: "mr" }, "football", "ملعب خماسي في العبور", 24, 7, football + 2, "ناقصنا 4", 0.8), starts_at: cairoNine() }]
    : [];
  // Running post for the bus-conductor shots (running.mjs): GET /__running?n=1..3 = my own morning run, n of 4 joined; n=0 off.
  if (running > 0 && pool === "male")
    return [{ ...row("pr", { id: "00000000-0000-4000-8000-000000000001", name: "كوين", kit: 1, avatar: "mr" }, "running", "جري الصبح في الجنينة", 14, 4, running, "اللي قريب ينزل معايا", 0.6), starts_at: cairoSeven(), is_mine: true }, row("p1", a, "padel", "كورت قريب", 5, 3, 1, "ناقصنا اتنين", 1.2)];
  if (fb.length) return [...fb, row("p3", c, "running", "جولف العبور", 40, 4, 1, null, 2.1)]; // the football post is the first card on the board
  return pool === "male"
    ? [row("p1", a, "padel", "كورت في العبور", 5, 3, 1, "ناقصنا اتنين", 1.2), row("p2", b, "football", "ملعب العبور", 28, 5, 3, null, 0.8), row("p3", c, "running", "جولف العبور", 40, 4, 1, null, 2.1)]
    : [row("p1", a, "walking", "جولف العبور", 5, 3, 1, "ناقصنا اتنين", 1.2), row("p2", b, "running", "جولف العبور", 28, 4, 2, null, 0.8), row("p3", c, "swimming", "نادي العبور", 40, 3, 1, null, 2.1)];
};

const RPC = {
  get_plans: plans,
  in_service_area: () => true,
  get_gyms: gymsFor,
  get_browse_stack: stack,
  get_badges: () => [],
  my_badge: () => ({ sessions: 3, badge: "rookie", next_badge: "starter", next_at: 5 }),
  my_coins: () => 3,
  my_perk_progress: () => [
    { perk_id: "n1-free", uses: 0, progress: 1, goal: 1, open: true, used_at: null },
    { perk_id: "n1-7", uses: 0, progress: 1, goal: 1, open: true, used_at: null },
  ],
  get_my_match: () => [matchRow()],
  get_my_matches: () => [matchRow()],
  get_person: () => stack()[0],
  is_owner: () => false,
  my_gym: () => [],
  get_classes: classRows,
};
const TABLES = { profiles: profile, gym_perks: () => PERKS, messages, sessions };

const jwt = () => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b({ alg: "HS256", typ: "JWT" })}.${b({ sub: ME, role: "authenticated", exp: 4102444800 })}.mock`;
};
const user = () => ({ id: ME, aud: "authenticated", role: "authenticated", email: "mock@example.com", app_metadata: { provider: "google" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });

const MIME = { ".jpg": "image/jpeg", ".png": "image/png" };
const served = new Set();

http
  .createServer((req, res) => {
    const u = new URL(req.url, HOST);
    // "*" does not cover Authorization: echo what the browser asks for
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] ?? "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,HEAD,OPTIONS", "Access-Control-Expose-Headers": "*" };
    if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
    const json = (body, code = 200, extra = {}) => res.writeHead(code, { ...cors, "Content-Type": "application/json", ...extra }).end(JSON.stringify(body));

    if (u.pathname === "/__running") return json({ running: (running = Number(u.searchParams.get("n") ?? 0)) });
    if (u.pathname === "/__football") return json({ football: (football = Number(u.searchParams.get("n") ?? 0)) });
    if (u.pathname === "/__classes") { classesV = u.searchParams.get("v") ?? "off"; classesMe = u.searchParams.get("me") === "1"; return json({ classes: classesV, me: classesMe }); }
    if (u.pathname === "/__pool") {
      pool = u.searchParams.get("p") === "female" ? "female" : "male";
      return json({ pool, session: { access_token: jwt(), refresh_token: "mock", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user: user() } });
    }
    if (u.pathname.startsWith("/partners/") || u.pathname.startsWith("/shots/")) {
      const rel = decodeURIComponent(u.pathname);
      const file = rel.startsWith("/partners/") ? path.join(PARTNERS, rel.slice(10)) : path.join(HERE, rel.slice(1));
      if (!fs.existsSync(file)) return res.writeHead(404, cors).end();
      return res.writeHead(200, { ...cors, "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" }).end(fs.readFileSync(file));
    }
    if (u.pathname === "/auth/v1/user") return json(user());
    if (u.pathname === "/auth/v1/token") return json({ access_token: jwt(), refresh_token: "mock", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user: user() });

    const rpc = u.pathname.match(/^\/rest\/v1\/rpc\/(\w+)/);
    if (rpc) {
      const fn = RPC[rpc[1]];
      if (!fn && !served.has(rpc[1])) (served.add(rpc[1]), console.log("rpc (empty):", rpc[1]));
      const out = fn ? fn() : [];
      const one = (req.headers.accept ?? "").includes("vnd.pgrst.object");
      return json(one && Array.isArray(out) ? out[0] ?? null : out);
    }
    const table = u.pathname.match(/^\/rest\/v1\/(\w+)/);
    if (table) {
      if (req.method === "HEAD") return res.writeHead(200, { ...cors, "Content-Range": "0-0/0" }).end();
      if (table[1] === "class_interest") { classesMe = req.method === "POST"; return res.writeHead(req.method === "POST" ? 201 : 204, cors).end(); }
      const fn = TABLES[table[1]];
      if (!fn && !served.has(table[1])) (served.add(table[1]), console.log("table (empty):", table[1]));
      const out = fn ? fn() : [];
      const one = (req.headers.accept ?? "").includes("vnd.pgrst.object");
      return json(one && Array.isArray(out) ? out[0] ?? null : out);
    }
    json({}, 404);
  })
  .listen(PORT, () => console.log("mock supabase on", HOST));
