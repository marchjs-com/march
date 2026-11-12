#!/usr/bin/env node
// Showcase › Hız › Karşılaştırma in headless Edge/Chrome, with the published showcase's strict CSP: opens /bench,
// checks that no library chunk downloads before the test, runs a short round through the page's own controls
// (default: every library, "1.000 satır oluştur", 3 repeats; --full: every operation) and checks that every library
// produced numbers, no load or check error and no page error. Also: no sideways overflow at 390 px.
//   node examples/showcase/build.mjs && node tools/bench-edge.mjs [--full] [--json out.json]
import { writeFileSync } from "node:fs";
import { openHeadless, sleep, flag } from "./lib/headless.mjs";

const full = process.argv.includes("--full");
const out = flag(process.argv, "--json", null);
const b = await openHeadless({ csp: true, args: ["--js-flags=--expose-gc"] });
const fail = [];
const click = (sel, text) => b.ev(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.textContent.trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true })()`);
const chunks = () => b.ev(`performance.getEntriesByType("resource").map((e) => e.name.split("/").pop().split("?")[0]).filter((n) => /^(react|preact|vue|svelte|solid|lit)\\b/.test(n))`);
try {
  await b.load("/bench", 390);
  if (await b.ev("document.documentElement.scrollWidth > innerWidth + 1")) fail.push("390 px: sideways overflow");
  await b.load("/bench", 1280);
  if (!(await b.ev(`!!document.querySelector(".bt-pick")`))) fail.push("page did not render");
  const early = await chunks();
  if (early.length) fail.push(`library chunks before the test: ${early.join(", ")}`);
  if (full && !(await click(".bt-pick button", "Tümü"))) fail.push("no 'Tümü' chip");
  if (!(await click("button, [role=radio], label", "3 tekrar"))) fail.push("no '3 tekrar' choice");
  if (!(await click("button", "Testi başlat"))) fail.push("no start button");
  const t0 = Date.now(), limit = full ? 30 * 60e3 : 4 * 60e3;
  let status = "";
  while (Date.now() - t0 < limit) {
    await sleep(1000);
    status = await b.ev(`document.querySelector(".bt-status-text")?.textContent ?? ""`);
    if (status.startsWith("Test bitti")) break;
  }
  if (!status.startsWith("Test bitti")) fail.push(`did not finish: ${status}`);
  const table = await b.ev(`[...document.querySelectorAll(".bt-table")].at(-1) ? [...[...document.querySelectorAll(".bt-table")].at(-1).rows].map((r) => [...r.cells].map((c) => c.textContent.trim())) : []`);
  console.log(table.map((r) => r.join(" | ")).join("\n"));
  const head = table[0] ?? [];
  const opCols = head.length - 4;
  const libs = table.slice(1);
  if (libs.length < 3) fail.push(`only ${libs.length} libraries in the table`);
  for (const r of libs) for (let i = 1; i <= opCols; i++) if (!/^\d/.test(r[i] ?? "")) fail.push(`${r[0]} · ${head[i]}: ${r[i]}`);
  const env = await b.ev(`document.querySelector(".bt-env")?.textContent ?? ""`);
  if (!env.includes("Cihaz ve tarayıcı")) fail.push("no device/browser line");
  if (out) writeFileSync(out, JSON.stringify({ table, env }, null, 1));
  const errs = b.errs.filter(Boolean);
  if (errs.length) fail.push(...errs.map((e) => `page error: ${e}`));
} finally { await b.close(); }
if (fail.length) { console.error(`✖ bench:\n  ${fail.join("\n  ")}`); process.exit(1); }
console.log(`✔ bench: ${full ? "full" : "short"} round in headless browser, strict CSP`);
