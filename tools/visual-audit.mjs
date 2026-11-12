#!/usr/bin/env node
// Visual audit of the showcase (or any March app) in a headless Chromium browser (Edge / Chrome) over CDP.
// For every page × width it reports:
//   page-overflow   the page scrolls sideways
//   overflow        an element's content is wider than its box and spills out (overflow: visible)
//   broken-word     a word is split across lines (letter-by-letter wrapping, overflow-wrap: anywhere in a narrow box)
//   uneven-row      cards in the same Grid row have different heights
//   grid-cell       an item of a CSS grid (one column, stretching) is narrower than its track: a margin or width
//                   rule meant for something else, such as a class name used by two features
//   overlap         neighbouring items of a flex row draw on top of each other
//   badge           a choice card's tick badge leaves the card, touches its edge, covers the label or (a one-line
//                   card) is not centred on the block axis
//   double-mount    after in-app navigation (menu clicks, back / forward) more than one app shell or page heading; on
//                   a reload of the start page, more than one mount of its heading or an entrance animation the
//                   prerender takeover (hydrate) replays on screen
//   layout-shift    the start page shifts while it loads (CLS over 0.01)
//   console         a script error
//
//   node tools/visual-audit.mjs                      builds nothing; serves examples/showcase/dist itself
//   node tools/visual-audit.mjs --base http://127.0.0.1:5181 --widths 320,390 --routes /,/yerlesim
// Exit code 1 when anything is found. Browser: $BROWSER_PATH, else Edge / Chrome in the usual places.
import { openHeadless, showcaseRoutes, flag as argFlag, sleep } from "./lib/headless.mjs";

const argv = process.argv.slice(2);
const flag = (k, d) => argFlag(argv, k, d);
const WIDTHS = flag("--widths", "320,390,768,1024,1440").split(",").map(Number);
const ROUTES = flag("--routes", null)?.split(",") ?? showcaseRoutes();
// extra states per route: [label, script run after load]
const STATES = {
  "/layout": [["container 50%", `(() => { const s = document.querySelectorAll("input[type=range]")[1]; s.value = "50"; s.dispatchEvent(new Event("input", { bubbles: true })); })()`],
    ["container 30%, 6 columns", `(() => { const s = document.querySelectorAll("input[type=range]")[1]; s.value = "30"; s.dispatchEvent(new Event("input", { bubbles: true })); [...document.querySelectorAll("[role=radio]")].find((b) => b.textContent.trim() === "6")?.click(); })()`]],
};

const { send, ev, errs, load, close, base } = await openHeadless({ base: flag("--base", null) });

// ---- the in-page scan
const SCAN = `(() => {
  const out = [];
  const name = (el) => { let s = el.tagName.toLowerCase(); const c = [...el.classList].filter((x) => !/^is-/.test(x)).slice(0, 2).join("."); return c ? s + "." + c : s; };
  const where = (el) => { const p = []; for (let e = el; e && e !== document.body && p.length < 3; e = e.parentElement) p.unshift(name(e)); return p.join(" > "); };
  const skip = (el) => !!el.closest("svg, canvas, [aria-hidden=true], .hm-sr-only, pre, code, .hm-fx-fill, .hm-overlay[hidden], [data-audit-skip]");
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) out.push(["page-overflow", "html", de.scrollWidth + " > " + de.clientWidth]);
  for (const el of document.body.querySelectorAll("*")) {
    if (skip(el) || !shown(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "inline" || cs.display === "contents" || cs.overflowX !== "visible") continue;
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2) {
      // a spill that an ancestor scrolls or clips on purpose is fine; report only what actually leaves the box
      const kids = [...el.children].filter((k) => shown(k) && getComputedStyle(k).position !== "absolute" && getComputedStyle(k).position !== "fixed");
      const r = el.getBoundingClientRect();
      const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (text || kids.some((k) => { const kr = k.getBoundingClientRect(); return kr.right > r.right + 2 || kr.left < r.left - 2; })) out.push(["overflow", where(el), el.scrollWidth + " > " + el.clientWidth]);
    }
    if (/flex/.test(cs.display) && cs.flexDirection.startsWith("row")) {
      const kids = [...el.children].filter((k) => shown(k) && !skip(k) && getComputedStyle(k).position === "static" && parseFloat(getComputedStyle(k).marginInlineStart) >= 0 && getComputedStyle(k).animationName === "none"); // spinning boxes change size
      for (let i = 1; i < kids.length; i++) {
        const a = kids[i - 1].getBoundingClientRect(), b = kids[i].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 2 && h > 2) out.push(["overlap", where(kids[i]), Math.round(w) + "×" + Math.round(h)]);
      }
    }
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!p || skip(p) || !shown(p) || /^(pre|nowrap)/.test(getComputedStyle(p).whiteSpace) && getComputedStyle(p).whiteSpace !== "pre-wrap") continue;
    for (const m of n.textContent.matchAll(/[\\p{L}\\p{N}]{2,}/gu)) {
      range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length);
      const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top / 3)));
      if (tops.size > 1) { out.push(["broken-word", where(p), m[0]]); break; }
    }
  }
  for (const g of document.querySelectorAll(".hm-grid")) {
    if (skip(g) || !shown(g)) continue;
    const rows = new Map();
    for (const k of g.children) { if (!shown(k)) continue; const r = k.getBoundingClientRect(); const key = Math.round(r.top); (rows.get(key) ?? rows.set(key, []).get(key)).push(r.height); }
    for (const hs of rows.values()) if (hs.length > 1 && Math.max(...hs) - Math.min(...hs) > 2) { out.push(["uneven-row", where(g), hs.map(Math.round).join("/")]); break; }
  }
  // any CSS grid: a one-column item that stretches (the default) must fill its track
  for (const g of document.body.querySelectorAll("*")) {
    if (skip(g) || !shown(g)) continue;
    const gs = getComputedStyle(g);
    if (gs.display !== "grid" && gs.display !== "inline-grid") continue;
    if (!/^(normal|stretch|legacy)$/.test(gs.justifyItems)) continue;
    const tracks = gs.gridTemplateColumns.split(" ").map(parseFloat).filter((x) => x >= 0);
    if (tracks.length < 2 || !g.offsetWidth) continue;
    // track edges in layout px; the item's track is the one under its centre (CSS zoom / transforms scale rects)
    const gr = g.getBoundingClientRect(), scale = gr.width / g.offsetWidth, gap = parseFloat(gs.columnGap) || 0;
    const x0 = parseFloat(gs.borderLeftWidth) + parseFloat(gs.paddingLeft);
    const starts = []; tracks.reduce((x, t) => (starts.push(x), x + t + gap), x0);
    for (const k of g.children) {
      if (!shown(k) || skip(k)) continue;
      const ks = getComputedStyle(k);
      if (/absolute|fixed/.test(ks.position) || /^inline|^table/.test(ks.display)) continue;
      if (!/^(auto|span 1)$/.test(ks.gridColumnEnd) || !/^(auto|normal|stretch)$/.test(ks.justifySelf)) continue;
      const kr = k.getBoundingClientRect(), mid = ((kr.left + kr.right) / 2 - gr.left) / scale;
      let i = starts.length - 1; while (i > 0 && starts[i] > mid) i--;
      const w = k.offsetWidth;
      if (w < tracks[i] - 2) { out.push(["grid-cell", where(k), w + " in a " + Math.round(tracks[i]) + " px track"]); break; }
    }
  }
  // choice cards (RadioGroup / CheckboxGroup card variant, ChoicePicker cards and tiles): the tick badge sits inside the
  // card, at the line end, clear of the label; a card that is one line high centres it on the block axis
  for (const c of document.querySelectorAll(".hm-choice-card .hm-check, .hm-picker-cards .hm-check, .hm-picker-grid .hm-check")) {
    const b = c.querySelector(".hm-check-box");
    if (!b || skip(c) || !shown(c)) continue;
    const cr = c.getBoundingClientRect(), br = b.getBoundingClientRect();
    if (!br.width) continue;
    const inset = Math.min(br.left - cr.left, cr.right - br.right, br.top - cr.top, cr.bottom - br.bottom);
    if (inset < 2) { out.push(["badge", where(c), "the badge is " + Math.round(inset) + " px from the card edge"]); continue; }
    const rtl = getComputedStyle(c).direction === "rtl";
    if (rtl ? br.left - cr.left > cr.right - br.right : cr.right - br.right > br.left - cr.left) { out.push(["badge", where(c), "the badge is not at the line end"]); continue; }
    const label = c.querySelector(".hm-choice-card-title, .hm-choice-card-text, .hm-check-label");
    const text = label && [...label.querySelectorAll("*"), label].map((e) => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect(); }).find((r) => r.width);
    if (text && text.right > br.left + 1 && text.left < br.right - 1 && text.bottom > br.top + 1 && text.top < br.bottom - 1) { out.push(["badge", where(c), "the badge covers the label"]); continue; }
    if (!c.querySelector(".hm-choice-card-icon, .hm-choice-card-desc, .hm-choice-card-meta") && Math.abs((br.top + br.bottom) / 2 - (cr.top + cr.bottom) / 2) > 2) out.push(["badge", where(c), "a one-line card: the badge is not centred on the block axis"]);
  }
  return out;
})()`;

const findings = [];
for (const route of ROUTES) for (const w of WIDTHS) for (const [label, script] of [["", null], ...(STATES[route] ?? [])]) {
  await load(route, w);
  if (script) { await ev(script); await sleep(700); }
  await ev(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 900)); })()`);
  const found = (await ev(SCAN)) ?? [];
  const seen = new Set();
  for (const [kind, at, detail] of found) { const key = kind + at; if (seen.has(key)) continue; seen.add(key); findings.push({ route, w, state: label, kind, at, detail }); }
  for (const e of new Set(errs)) findings.push({ route, w, state: label, kind: "console", at: "", detail: e });
  errs.length = 0;
  process.stdout.write(found.length ? "✖" : "·");
}
// double mount: navigate through every page inside the app (menu clicks, then back / forward), without reloading.
// After each step there must be exactly one app shell and one page heading (a second copy of the app would add both).
{
  await load("/", 1440);
  const COUNT = "(() => ({ shells: [...document.querySelectorAll('.hm-app-shell, .hm-shell')].filter((e) => !e.parentElement?.closest('.hm-app-shell, .hm-shell')).length, h1: document.querySelectorAll('h1').length, roots: document.querySelectorAll('#app > :not(.hm-nav-bar)').length }))()";
  const verify = async (step) => {
    const c = await ev(COUNT);
    if (!c || c.shells !== 1 || c.h1 !== 1 || c.roots !== 1) findings.push({ route: step, w: 1440, state: "navigation", kind: "double-mount", at: "#app", detail: JSON.stringify(c) });
    for (const e of new Set(errs)) findings.push({ route: step, w: 1440, state: "navigation", kind: "console", at: "", detail: e });
    errs.length = 0;
  };
  for (const route of [...ROUTES.slice(1), ROUTES[0]]) {
    await ev("(() => { const a = [...document.querySelectorAll('a[href]')].find((x) => x.getAttribute('href') === '#" + route + "' || x.getAttribute('href').endsWith('#" + route + "')); if (a) a.click(); else location.hash = '" + route + "'; return 1; })()");
    await sleep(900); await verify(route);
  }
  for (const dir of ["back", "back", "forward"]) { await ev("history." + dir + "()"); await sleep(700); await verify(dir); }
  process.stdout.write("·");
}
// reload: the start page loads once. index.html carries it prerendered and hydrate() takes it over in one step that
// must not show: at most one mount of the page heading after parsing, no layout shift, and no entrance animation
// (opacity from 0) replayed on screen by the takeover.
{
  const PROBE = `(() => {
    const p = window.__hmReload = { mounts: 0, cls: 0, replays: [], pre: false, settled: false };
    document.addEventListener("DOMContentLoaded", () => { p.pre = !!document.querySelector("#app[data-hm-prerender]"); });
    new MutationObserver((ms) => { if (document.readyState === "loading") return; for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches("h1") || n.querySelector("h1"))) { p.mounts++; p.at = performance.now(); (p.what = p.what || []).push(Math.round(p.at) + ":" + (n.className || n.tagName).toString().slice(0, 30) + "<" + (m.target.className || m.target.id || m.target.tagName).toString().slice(0, 20)); } }).observe(document, { childList: true, subtree: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) p.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    const seen = new WeakSet(), t0 = performance.now();
    const iv = setInterval(() => {
      const app = document.getElementById("app");
      if (p.at && app && !app.hasAttribute("data-hm-prerender") && !document.documentElement.hasAttribute("data-hm-hydrating") && performance.now() - p.at > 1200) { p.settled = true; clearInterval(iv); }
      if (performance.now() - t0 > 15000) { p.settled = true; clearInterval(iv); }
      if (!p.pre || !p.at || performance.now() - p.at > 1200) return;
      for (const a of document.getAnimations()) {
        const t = a.effect && a.effect.target; if (!t || seen.has(a) || t.closest(".hm-roll")) continue; seen.add(a);
        const k = a.effect.getKeyframes()[0] || {}, r = t.getBoundingClientRect();
        if (String(k.opacity) === "0" && r.bottom > 0 && r.top < innerHeight && r.width > 0) p.replays.push((t.className || t.tagName).toString().slice(0, 40));
      }
    }, 50);
  })()`;
  const reg = await send("Page.addScriptToEvaluateOnNewDocument", { source: PROBE });
  const start = ROUTES.includes("/") ? "/" : ROUTES[0];
  await load(start, 1440);
  for (let i = 0; i < 40 && !(await ev("!!(window.__hmReload && window.__hmReload.settled)")); i++) await sleep(400);
  const r = await ev("window.__hmReload ? JSON.parse(JSON.stringify(window.__hmReload)) : null");
  await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: reg.result?.identifier });
  if (!r) findings.push({ route: start, w: 1440, state: "reload", kind: "double-mount", at: "#app", detail: "probe did not run" });
  else {
    if (r.mounts > 1) findings.push({ route: start, w: 1440, state: "reload", kind: "double-mount", at: "#app", detail: `page heading mounted ${r.mounts} times after parsing` });
    if (r.cls > 0.01) findings.push({ route: start, w: 1440, state: "reload", kind: "layout-shift", at: "#app", detail: `CLS ${r.cls.toFixed(3)}` });
    if (r.replays.length) findings.push({ route: start, w: 1440, state: "reload", kind: "double-mount", at: "#app", detail: `takeover replayed ${r.replays.length} entrance animation(s): ${[...new Set(r.replays)].slice(0, 4).join(", ")}` });
  }
  if (process.env.MARCH_AUDIT_DEBUG) console.log("\nreload:", JSON.stringify(r));
  process.stdout.write("·");
}
await close();
console.log("");
for (const f of findings) console.log(`✖ ${f.route} @${f.w}${f.state ? ` (${f.state})` : ""}  ${f.kind}  ${f.at}  ${f.detail}`);
console.log(findings.length ? `${findings.length} problems` : `✔ ${ROUTES.length} pages × ${WIDTHS.length} widths: no overflow, broken words, uneven cards, overlap or double mount`);
process.exit(findings.length ? 1 : 0);
