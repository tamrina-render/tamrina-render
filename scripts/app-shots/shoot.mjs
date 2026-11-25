// Screenshots of the real Tamrina app with made-up people. Start first:
//   node mock-supabase.mjs
//   (GymBros/mobile) EXPO_PUBLIC_SUPABASE_URL=http://localhost:54399 EXPO_PUBLIC_SUPABASE_ANON_KEY=mock node node_modules/expo/bin/cli start --web --port 8099
// Then: node shoot.mjs <outDir> [male|female]
// Any request that is not this machine is blocked, so the real database and photo server can't be touched.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const out = process.argv[2];
const pools = process.argv[3] ? [process.argv[3]] : ["male", "female"];
const APP = "http://localhost:8099";
const MOCK = "http://localhost:54399";
const CHROME = process.env.CHROME ?? "C:/Users/a9229/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe";
const MATCH = "00000000-0000-4000-8000-0000000000aa";

const BUNDLE = "/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=src%2Fapp&unstable_transformProfile=hermes-stable";
const SHELL = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--css-interop-darkMode:class dark}html,body,#root{height:100%;margin:0}body{overflow:hidden;background:#0d0f14}#root{display:flex}</style></head><body><div id="root"></div><script src="${BUNDLE}" defer></script></body></html>`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-features=LocalNetworkAccessChecks"] });
const blocked = new Set();

for (const pool of pools) {
  const { session } = await (await fetch(`${MOCK}/__pool?p=${pool}`)).json();
  const suffix = pool === "male" ? "mr" : "mrs";
  const dir = path.join(out, suffix);
  fs.mkdirSync(dir, { recursive: true });

  // A 1080x2400 phone
  const ctx = await browser.newContext({ viewport: { width: 412, height: 916 }, deviceScaleFactor: 2.622, locale: "ar-EG", hasTouch: true, reducedMotion: "reduce" }); // reduce = the app skips its logo intro
  await ctx.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    // The page itself comes from here, not from the dev server: its server-render needs a browser and runs out of memory.
    if (route.request().resourceType() === "document") return route.fulfill({ contentType: "text/html", body: SHELL });
    if (host === "localhost" || route.request().url().startsWith("data:") || route.request().url().startsWith("blob:")) return route.continue();
    blocked.add(host);
    return route.abort();
  });
  await ctx.addInitScript(({ session }) => {
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session));
    localStorage.setItem("gymbros.language", "ar");
    for (const id of ["perks", "chat", "home", "session", "propose", "gyms"]) localStorage.setItem(`hint:${id}`, "1");
    const rtl = () => { document.documentElement.setAttribute("dir", "rtl"); document.documentElement.setAttribute("lang", "ar"); };
    if (document.documentElement) rtl(); else document.addEventListener("DOMContentLoaded", rtl);
  }, { session });

  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${suffix}] page error:`, e.message.slice(0, 200)));

  const snap = async (name, wait = 1800) => {
    await page.waitForTimeout(wait);
    // A phone has a safe area under the tab bar; on the web there is none and the labels get clipped
    await page.evaluate(() => {
      for (const e of document.querySelectorAll("div")) {
        const r = e.getBoundingClientRect();
        if (Math.round(r.height) === 58 && Math.round(r.bottom) >= innerHeight - 1) e.style.setProperty("height", "74px", "important");
      }
    });
    // the fake account's email line
    await page.evaluate(() => {
      for (const e of document.querySelectorAll("div")) if (!e.children.length && e.textContent.includes("@example.com")) e.style.visibility = "hidden";
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
    console.log(suffix, name);
  };

  await page.goto(`${APP}/home`, { waitUntil: "load", timeout: 300000 });
  await page.getByText("يلا تمرينة", { exact: false }).first().waitFor({ timeout: 120000 }).catch(() => console.log("no card on home"));
  await snap("1-card-a", 1500);

  // the feed scrolls like reels: the next person
  const scrollFeed = (i) =>
    page.evaluate((i) => {
      const els = [...document.querySelectorAll("div")].filter((e) => e.scrollHeight > e.clientHeight + 100 && getComputedStyle(e).overflowY !== "visible");
      const feed = els.sort((a, b) => b.clientHeight - a.clientHeight)[0];
      if (feed) feed.scrollTop = i * (feed.clientHeight - 44);
      return !!feed;
    }, i);
  await scrollFeed(1);
  await snap("2-card-b", 900);
  await scrollFeed(2);
  await snap("12-card-c", 900);

  await page.goto(`${APP}/match?matchId=${MATCH}`, { waitUntil: "load", timeout: 120000 });
  await snap("3-match", 1800);
  await page.goto(`${APP}/chat/${MATCH}`, { waitUntil: "load", timeout: 120000 });
  await snap("4-chat", 1800);
  await page.goto(`${APP}/propose-session?matchId=${MATCH}&near=n1,power,muscle&time=evening`, { waitUntil: "load", timeout: 120000 });
  await snap("5-propose", 1800);

  // Offers tab: coins + the gym's offers
  await page.goto(`${APP}/gyms`, { waitUntil: "load", timeout: 120000 });
  await page.getByText("العروض", { exact: false }).first().click().catch((e) => console.log("no offers tab:", e.message.slice(0, 80)));
  await snap("6-coins", 1500);
  await page.goto(`${APP}/gym/n1`, { waitUntil: "load", timeout: 120000 });
  await snap("7-gym", 1800);
  await page.goto(`${APP}/gyms`, { waitUntil: "load", timeout: 120000 });
  await snap("8-gyms", 2200);
  await page.goto(`${APP}/perk/n1-free`, { waitUntil: "load", timeout: 120000 });
  await snap("9-perk", 1800);
  await page.goto(`${APP}/you`, { waitUntil: "load", timeout: 120000 });
  await snap("11-you", 1800);
  // last: the inner tab is remembered
  await page.goto(`${APP}/home`, { waitUntil: "load", timeout: 120000 });
  await page.getByText("رياضات", { exact: false }).first().click().catch((e) => console.log("no sports tab:", e.message.slice(0, 80)));
  await snap("10-sports", 1800);
  await ctx.close();
}
await browser.close();
if (blocked.size) console.log("blocked hosts:", [...blocked].join(", "));
