#!/usr/bin/env node
// Every showcase menu page opens, in headless Edge / Chrome:
//   - each page of nav.ts and nav-meta.ts SUB_PAGES, by hash (a direct visit: #/motion) and by a click on its side
//     menu link (the way a user opens it), shows its page: no "not found" view, no console error
//   - the page transition variant routes (#/motion/pages/<variant>) open the variants page
//   - the menu is kept across navigations: after a click on a link of a scrolled menu it is the same DOM node and keeps
//     its scroll position; an active row outside the visible area comes into view
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

// the menu is kept: same node, same scroll position; only the active row changes
{
  await b.load("/start");
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) { await sleep(250); ready = await b.ev(`!!document.querySelector("nav .hm-sb-scroll .hm-sb-gitems a[href]")`); }
  const mark = await b.ev(`(() => { const sc = document.querySelector(".hm-sb-scroll"); window.__menuNav = sc.closest("nav"); window.__menuScroller = sc;
    sc.scrollTop = Math.min(400, sc.scrollHeight - sc.clientHeight); const top = sc.scrollTop, c = sc.getBoundingClientRect();
    // a category link in view, not the current page
    const a = [...sc.querySelectorAll(".hm-sb-gitems a[href]")].find((a) => { const r = a.getBoundingClientRect(); return r.height && r.top >= c.top && r.bottom <= c.bottom && a.getAttribute("aria-current") !== "page" });
    if (!a) return { top, href: null }; const href = a.getAttribute("href"); a.click(); return { top, href } })()`);
  if (!mark.href) check(false, "menu kept on navigation", "no link in view");
  else {
    let s;
    for (let i = 0; i < 40; i++) { await sleep(250); s = await b.ev(`(() => { const sc = document.querySelector(".hm-sb-scroll"); return { path: location.hash, same: sc === window.__menuScroller && sc.closest("nav") === window.__menuNav, top: sc.scrollTop,
      active: !!sc.querySelector('.hm-sb-gitems a[aria-current="page"][href="${mark.href}"]') } })()`); if (s.path.endsWith(mark.href.replace(/^#/, "")) && s.active) break; }
    check(s.same, "menu kept on navigation: same DOM node", s.same ? "" : "the menu was rebuilt");
    check(Math.abs(s.top - mark.top) <= 1, "menu kept on navigation: scroll position", `${mark.top} → ${s.top}`);
    check(s.active, "menu kept on navigation: the clicked row is active");
  }
  // an active row below the visible area comes into view
  const far = await b.ev(`(() => { const sc = document.querySelector(".hm-sb-scroll"); sc.scrollTop = 0; const c = sc.getBoundingClientRect();
    const a = [...sc.querySelectorAll(".hm-sb-gitems a[href]")].reverse().find((a) => { const r = a.getBoundingClientRect(); return r.height && r.top > c.bottom }); return a?.getAttribute("href") ?? null })()`);
  if (far) {
    await b.ev(`location.hash = ${JSON.stringify(far.startsWith("#") ? far : `#${far}`)}`);
    let seen = false;
    for (let i = 0; i < 20 && !seen; i++) { await sleep(250); seen = await b.ev(`(() => { const sc = document.querySelector(".hm-sb-scroll"), a = sc.querySelector('.hm-sb-gitems a[aria-current="page"]'); if (!a) return false;
      const r = a.getBoundingClientRect(), c = sc.getBoundingClientRect(); return r.top >= c.top - 1 && r.bottom <= c.bottom + 1 })()`); }
    check(seen, `menu reveals the active row (${far})`);
  }
}

await b.close();
console.log(fails ? `✖ ${fails} failure(s)` : `✔ ${pages.length} menu pages open`);
process.exit(fails ? 1 : 0);
