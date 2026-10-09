// Scrapes the public TVJ "MEL Dashboard" (Apps Script web app) into mel.json for Crew Brief.
import { chromium } from "playwright";
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const URL = "https://script.google.com/macros/s/AKfycbx-Sz4RaGpEzQ_-kII6djoJPlm2_W3vEFycUvnwODVXdoa3Dx7DFnHrLBEIVb8Z1w0Q/exec";
const OUT = process.argv[2] || "mel.json";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

// the app renders inside a sandboxed iframe and fills the table via google.script.run
let frame = null, rows = [];
for (let i = 0; i < 60 && rows.length < 10; i++) {
  await page.waitForTimeout(2000);
  for (const f of page.frames()) {
    try {
      const r = await f.evaluate(() => {
        const tables = [...document.querySelectorAll("table")];
        const t = tables.find((x) => /DEFERRED\s*DEFECTS/i.test(x.innerText));
        if (!t) return null;
        const head = [...t.querySelectorAll("tr")].find((tr) => /DEFERRED\s*DEFECTS/i.test(tr.innerText));
        const cols = [...head.querySelectorAll("th,td")].map((c) => c.innerText.replace(/\s+/g, " ").trim());
        const body = [...t.querySelectorAll("tr")].filter((tr) => tr !== head && tr.querySelectorAll("td").length >= 5);
        return { cols, rows: body.map((tr) => [...tr.querySelectorAll("td")].map((c) => c.innerText.replace(/\s+/g, " ").trim())) };
      });
      if (r && r.rows.length) { frame = f; rows = r.rows; var cols = r.cols; break; }
    } catch {}
  }
}
let summary = {};
if (frame) {
  try {
    summary = await frame.evaluate(() => {
      const out = {};
      const txt = document.body.innerText;
      for (const k of ["TOTAL AIRCRAFT", "SERVICEABLE", "MAINTENANCE / PARKING", "AOG", "TOTAL MEL ALL FLEET", "TOTAL MEL AIRBUS FLEET", "TOTAL MEL BOEING FLEET"]) {
        const m = new RegExp(k.replace(/[/]/g, "\\/") + "\\s*\\n\\s*(\\d+)").exec(txt);
        if (m) out[k] = +m[1];
      }
      const t = /Current time:\s*([^\n]+)/.exec(txt);
      if (t) out.dashboard_time = t[1].trim();
      return out;
    });
  } catch {}
}
await browser.close();

if (rows.length < 10) {
  console.error("dashboard table not found (rows=" + rows.length + ")");
  process.exit(2);
}
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const names = cols.map(key);
const items = rows.map((r) => { const o = {}; names.forEach((n, i) => { if (n) o[n] = r[i] ?? ""; }); return o; });
const byReg = {};
for (const it of items) {
  const reg = (it.a_c_reg || it.reg || "").toUpperCase().replace(/\s+/g, "");
  if (!/^HS-[A-Z]{3}$/.test(reg)) continue;
  (byReg[reg] ||= []).push(it);
}
const json = { fetched_at: new Date().toISOString(), source: URL, columns: cols, summary, count: items.length, aircraft: byReg };
// keep the file stable when nothing but the timestamp changed
if (existsSync(OUT)) {
  try {
    const old = JSON.parse(readFileSync(OUT, "utf8"));
    if (JSON.stringify(old.aircraft) === JSON.stringify(byReg) && JSON.stringify(old.summary) === JSON.stringify(summary)) {
      console.log("no change (" + items.length + " items)");
      process.exit(0);
    }
  } catch {}
}
writeFileSync(OUT, JSON.stringify(json));
console.log("wrote " + OUT + ": " + items.length + " items, " + Object.keys(byReg).length + " aircraft");
