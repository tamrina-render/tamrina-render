// 5 screenshots of one football post on the Sports board (men's pool), joined 1..5 of 5, plus the full board.
// Same setup as shoot.mjs (mock-supabase.mjs + the app on :8099), then: node football.mjs [outDir]
// Default outDir: ../../public/footage/mob-football/app  ->  post-1..5.png (identical size, same card position) + board.png
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? path.join(HERE, "../../public/footage/mob-football/app");
const APP = "http://localhost:8099";
const MOCK = "http://localhost:54399";
const CHROME = process.env.CHROME ?? "C:/Users/a9229/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe";
const SCALE = 2.622, MARGIN = 6;
const BUNDLE = "/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=src%2Fapp&unstable_transformProfile=hermes-stable";
const SHELL = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--css-interop-darkMode:class dark}html,body,#root{height:100%;margin:0}body{overflow:hidden;background:#0d0f14}#root{display:flex}</style></head><body><div id="root"></div><script src="${BUNDLE}" defer></script></body></html>`;
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-features=LocalNetworkAccessChecks"] });
const blocked = new Set();
const { session } = await (await fetch(`${MOCK}/__pool?p=male`)).json();
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

let box = null; // the card's box from state 1, reused for every state so the crops line up
for (let n = 1; n <= 5; n++) {
  await fetch(`${MOCK}/__football?n=${n}`);
  await page.goto(`${APP}/home`, { waitUntil: "load", timeout: 300000 });
  await page.getByText("رياضات", { exact: false }).first().click({ timeout: 120000 });
  await page.getByText("ملعب خماسي في العبور").first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    for (const e of document.querySelectorAll("div")) {
      const r = e.getBoundingClientRect();
      if (Math.round(r.height) === 58 && Math.round(r.bottom) >= innerHeight - 1) e.style.setProperty("height", "74px", "important");
    }
  });
  await page.waitForTimeout(250);
  const b = await page.evaluate(() => {
    let el = [...document.querySelectorAll("div,span")].find((e) => !e.children.length && e.textContent.trim() === "ملعب خماسي في العبور");
    while (el && !(parseFloat(getComputedStyle(el).borderTopWidth) > 0 && parseFloat(getComputedStyle(el).borderTopLeftRadius) > 0)) el = el.parentElement;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, text: el.innerText.replace(/\n/g, " | ") };
  });
  console.log(n, JSON.stringify(b));
  if (!box) box = b;
  else if (Math.abs(b.x - box.x) > 0.5 || Math.abs(b.y - box.y) > 0.5 || Math.abs(b.width - box.width) > 0.5 || Math.abs(b.height - box.height) > 0.5) throw new Error(`card moved or resized in state ${n}`);
  // whole device pixels so every crop has the identical size
  const x0 = Math.floor((box.x - MARGIN) * SCALE) / SCALE, y0 = Math.floor((box.y - MARGIN) * SCALE) / SCALE;
  const w = Math.ceil((box.width + 2 * MARGIN) * SCALE) / SCALE, h = Math.ceil((box.height + 2 * MARGIN) * SCALE) / SCALE;
  await page.screenshot({ path: path.join(out, `post-${n}.png`), clip: { x: x0, y: y0, width: w, height: h } });
  if (n === 1) await page.screenshot({ path: path.join(out, "board.png") });
}
await ctx.close();
await browser.close();
await fetch(`${MOCK}/__football?n=0`);
if (blocked.size) console.log("blocked hosts:", [...blocked].join(", "));
