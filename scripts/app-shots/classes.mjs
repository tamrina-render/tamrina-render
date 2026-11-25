// Two states (before / after tapping «يهمني») of one Zumba class on the Classes tab (Ladies pool), for variants price and free.
// Same setup as shoot.mjs (mock-supabase.mjs + the app on :8099), then: node classes.mjs [outDir]
// Default outDir: ../../public/footage/iba-zumba-c/app  ->  classes-<v>-1|2.png (full screen) + card-<v>-1|2.png (card crop, identical size)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? path.join(HERE, "../../public/footage/iba-zumba-c/app");
const APP = "http://localhost:8099";
const MOCK = "http://localhost:54399";
const CHROME = process.env.CHROME ?? "C:/Users/a9229/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe";
const SCALE = 2.622, MARGIN = 6;
const BUNDLE = "/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=src%2Fapp&unstable_transformProfile=hermes-stable";
const SHELL = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--css-interop-darkMode:class dark}html,body,#root{height:100%;margin:0}body{overflow:hidden;background:#0d0f14}#root{display:flex}</style></head><body><div id="root"></div><script src="${BUNDLE}" defer></script></body></html>`;
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-features=LocalNetworkAccessChecks"] });
const blocked = new Set();
const { session } = await (await fetch(`${MOCK}/__pool?p=female`)).json();
const ctx = await browser.newContext({ viewport: { width: 412, height: 916 }, deviceScaleFactor: SCALE, locale: "ar-EG", timezoneId: "Africa/Cairo", hasTouch: true, reducedMotion: "reduce" });
await ctx.route("**/*", (route) => {
  const host = new URL(route.request().url()).hostname;
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
page.on("pageerror", (e) => console.log("page error:", e.message.slice(0, 200)));


const FIND = "Zumba";
for (const v of ["price", "free"]) {
  await fetch(`${MOCK}/__classes?v=${v}`);
  await page.goto(`${APP}/home`, { waitUntil: "load", timeout: 300000 });
  await page.getByText("كلاسات", { exact: true }).first().click({ timeout: 120000 });
  await page.getByText(FIND, { exact: true }).first().waitFor({ timeout: 60000 });
  await page.getByText("مهتمين: 5").first().waitFor({ timeout: 30000 });
  const fix = () => page.evaluate(() => {
    for (const e of document.querySelectorAll("div")) {
      const r = e.getBoundingClientRect();
      if (Math.round(r.height) === 58 && Math.round(r.bottom) >= innerHeight - 1) e.style.setProperty("height", "74px", "important");
    }
  });
  const measure = () => page.evaluate((FIND) => {
    let el = [...document.querySelectorAll("div,span")].find((e) => !e.children.length && e.textContent.trim() === FIND);
    while (el && !(parseFloat(getComputedStyle(el).borderTopWidth) > 0 && parseFloat(getComputedStyle(el).borderTopLeftRadius) > 0)) el = el.parentElement;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, text: el.innerText.split(String.fromCharCode(10)).join(" | ") };
  }, FIND);
  await page.waitForTimeout(2500);
  await fix();
  await page.waitForTimeout(250);
  const states = [];
  states.push(await measure());
  await page.screenshot({ path: path.join(out, `classes-${v}-1.png`) });
  await page.getByText("يهمني", { exact: true }).first().click();
  await page.getByText("إلغاء", { exact: true }).first().waitFor({ timeout: 30000 });
  await page.getByText("مهتمين: 6").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await fix();
  await page.waitForTimeout(250);
  states.push(await measure());
  await page.screenshot({ path: path.join(out, `classes-${v}-2.png`) });
  states.forEach((b, i) => console.log(v, i + 1, JSON.stringify(b)));
  // crop both states to the larger box so the two files are the same size and position
  const x = Math.min(states[0].x, states[1].x), y = Math.min(states[0].y, states[1].y);
  const r = Math.max(states[0].x + states[0].width, states[1].x + states[1].width), bt = Math.max(states[0].y + states[0].height, states[1].y + states[1].height);
  if (Math.abs(states[0].height - states[1].height) > 0.5 || Math.abs(states[0].y - states[1].y) > 0.5) console.log("note: card changed size, cropped to the larger box");
  const x0 = Math.floor((x - MARGIN) * SCALE) / SCALE, y0 = Math.floor((y - MARGIN) * SCALE) / SCALE;
  const w = Math.ceil((r - x + 2 * MARGIN) * SCALE) / SCALE, h = Math.ceil((bt - y + 2 * MARGIN) * SCALE) / SCALE;
  const clip = { x: x0, y: y0, width: w, height: h };
  await page.screenshot({ path: path.join(out, `card-${v}-2.png`), clip });
  // state 1 again: reset the mock, reload and crop with the same clip
  await fetch(`${MOCK}/__classes?v=${v}&me=0`);
  await page.goto(`${APP}/home`, { waitUntil: "load", timeout: 300000 });
  await page.getByText("كلاسات", { exact: true }).first().click({ timeout: 120000 });
  await page.getByText("مهتمين: 5").first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  await fix();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, `card-${v}-1.png`), clip });
}
await ctx.close();
await browser.close();
await fetch(`${MOCK}/__classes?v=off`);
if (blocked.size) console.log("blocked hosts:", [...blocked].join(", "));
