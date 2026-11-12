#!/usr/bin/env node
// Every showcase menu page opens, in headless Edge / Chrome:
//   - each page of nav.ts and nav-meta.ts SUB_PAGES, by hash (a direct visit: #/motion) and by a click on its side
//     menu link (the way a user opens it), shows its page: no "not found" view, no console error
//   - the page transition variant routes (#/motion/pages/<variant>) open the variants page
// Usage: node examples/showcase/build.mjs && node tools/menu-audit.mjs   (exit 1 on a failure)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openHeadless, showcaseRoutes, sleep, ROOT } from "./lib/headless.mjs";

const subs = readFileSync(join(ROOT, "examples/showcase/src/nav-meta.ts"), "utf8").match(/SUB_PAGES[^=]*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
const pages = [...showcaseRoutes(), ...[...subs.matchAll(/path: "([^"]+)"/g)].map((m) => m[1])];
const variants = ["circle", "curtain", "blinds"].map((v) => `/motion/pages/${v}`);
setTimeout(() => { console.error("✖ timed out"); process.exit(2); }, 30 * 60_000).unref();

const b = await openHeadless();
let fails = 0;
const check = (ok, what, extra = "") => { if (!ok) fails++; console.log(`${ok ? "✔" : "✖"} ${what}${extra ? ` (${extra})` : ""}`); };
// what the page area shows: a not-found view (the router's or a hub's), else the length of its text
const STATE = `(() => { const m = document.querySelector("main") ?? document.body; const txt = m.innerText;
  const nf = /Sayfa bulunamadı/.test(txt) || [...m.querySelectorAll(".hm-empty")].some((e) => /^(Not found|Bulunamadı)\\.?$/.test(e.textContent.trim()));
  return { nf, len: txt.trim().length, path: location.hash } })()`;

for (const p of [...pages, ...variants]) {
  b.errs.length = 0;
  await b.load(p);
  let s = await b.ev(STATE);
  for (let i = 0; i < 40 && !s.nf && s.len < 40; i++) { await sleep(250); s = await b.ev(STATE); }
  check(!s.nf && s.len >= 40 && !b.errs.length, `#${p}: opens by hash`, s.nf ? "not found view" : s.len < 40 ? "empty page" : b.errs.slice(0, 2).join(" | "));
}

// by a menu click, from another page (the hash changes in place, no reload)
await b.load("/start");
for (const p of pages) {
  if (p === "/") continue;
  b.errs.length = 0;
  const clicked = await b.ev(`(() => { const a = [...document.querySelectorAll("nav a[href]")].find((a) => { const h = a.getAttribute("href"); return h === "#${p}" || h === "${p}" || h.endsWith("#${p}") }); if (!a) return false; a.click(); return true })()`);
  if (!clicked) { check(false, `${p}: a side menu link`, "no link"); continue; }
  // settled: the same good state twice in a row (the old page may still be on screen while the new one loads)
  const ok = (s) => s.path === `#${p}` && !s.nf && s.len >= 40;
  let s = await b.ev(STATE), streak = 0;
  for (let i = 0; i < 60 && streak < 2; i++) { await sleep(300); s = await b.ev(STATE); streak = ok(s) ? streak + 1 : 0; }
  check(s.path === `#${p}` && !s.nf && s.len >= 40 && !b.errs.length, `${p}: opens from the menu`, s.path !== `#${p}` ? `at ${s.path}` : s.nf ? "not found view" : s.len < 40 ? "empty page" : b.errs.slice(0, 2).join(" | "));
}

await b.close();
console.log(fails ? `✖ ${fails} failure(s)` : `✔ ${pages.length} menu pages open`);
process.exit(fails ? 1 : 0);
