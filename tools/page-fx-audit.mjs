#!/usr/bin/env node
// Motion › Page transition effects in headless Edge / Chrome (real View Transitions):
//   - mid-transition, nothing outside the page area changes: the side menu and the top bar are the same pixels
//     as before (a scaled, blurred or striped layer stays inside the stage)
//   - all ten variants one after another (slow), then all of them with rapid clicks, then "Stop all" in the middle of
//     a transition: afterwards no View Transition runs, no ::view-transition layer or animation stays, no element keeps
//     a transition name or an inline clip / transform, and the stage shows the last variant
// Usage: node examples/showcase/build.mjs && node tools/page-fx-audit.mjs   (exit 1 on a failure)
import { openHeadless, sleep } from "./lib/headless.mjs";

setTimeout(() => { console.error("✖ timed out"); process.exit(2); }, 10 * 60_000).unref();
const VARIANTS = ["circle", "wipe", "stack", "cube", "flip", "zoom-through", "curtain", "blinds", "pixel", "morph"];
const LABEL = { circle: "Daire", wipe: "Silme", stack: "Yığın", cube: "Küp", flip: "Çevir", "zoom-through": "İçinden geç", curtain: "Perde", blinds: "Panjur", pixel: "Piksel", morph: "Morph" };
const b = await openHeadless();
let fails = 0;
const check = (ok, what, extra = "") => { if (!ok) fails++; console.log(`${ok ? "✔" : "✖"} ${what}${extra ? ` (${extra})` : ""}`); };
await b.load("/motion/pages/circle", 1280);
await b.ev(`(async () => { for (let i = 0; i < 40 && !document.querySelector(".sc-mo-variant"); i++) await new Promise((r) => setTimeout(r, 250)) })()`);
await sleep(600);

const click = (v) => b.ev(`[...document.querySelectorAll(".sc-mo-variant")].find((a) => a.getAttribute("href").endsWith("/${v}"))?.click()`);
const LEFT = `({ vt: !!document.activeViewTransition, mark: document.documentElement.getAttribute("data-hm-vt"),
  layers: document.getAnimations().filter((a) => a.effect?.pseudoElement?.startsWith("::view-transition") && a.playState !== "finished").length,
  named: [...document.querySelectorAll("*")].filter((e) => e.style.viewTransitionName).length,
  styled: [...document.querySelectorAll("main *")].filter((e) => e.style.clipPath || e.style.transform).length,
  title: document.querySelector(".sc-mo-scene-title")?.textContent })`;
const clean = async (what, last) => {
  await sleep(2200);
  const s = await b.ev(LEFT);
  check(!s.vt && !s.mark && !s.layers && !s.named && !s.styled && s.title === LABEL[last], what, JSON.stringify(s));
};
// pixels of a region (png of the same pixels = the same bytes)
const shot = async (x, y, w, h) => (await b.send("Page.captureScreenshot", { format: "png", clip: { x, y, width: w, height: h, scale: 1 } })).result.data;
const outside = async () => {
  const r = await b.ev(`(() => { const s = document.querySelector(".sc-mo-scene").getBoundingClientRect(), n = document.querySelector("nav.hm-sidebar, .hm-nav-wrap, aside")?.getBoundingClientRect(); return { top: s.top, menuW: n ? n.right : 260 } })()`);
  // the side menu and the top bar (the page below the bar re-renders with its own entrance animation)
  return [await shot(0, 0, Math.max(40, r.menuW - 4), 880), await shot(r.menuW + 8, 0, 1280 - r.menuW - 16, 52)];
};

// 1 · mid-transition the layers stay inside the stage (slow motion so the middle is long)
await b.ev(`[...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Ağır çekim")?.click()`); await sleep(300);
// a first visit settles the menu (recently used pages) before the comparisons
await click("wipe"); await sleep(4000);
for (const v of ["curtain", "blinds", "zoom-through", "cube", "pixel"]) {
  const before = await outside();
  await click(v); await sleep(700);
  const running = await b.ev(`!!document.activeViewTransition`), mid = await outside();
  check(running && mid[0] === before[0] && mid[1] === before[1], `${v}: mid-transition the side menu and the top bar are untouched`, running ? "" : "no transition running at the sample");
  await sleep(3200);
}
await b.ev(`[...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Normal hız")?.click()`); await sleep(300);

// 2 · all ten, one after another
for (const v of VARIANTS) { await click(v); await sleep(1100); }
await clean("ten variants in a row: nothing left behind", "morph");
// 3 · rapid clicks
for (const v of [...VARIANTS, "curtain", "blinds", "pixel", "curtain", "blinds"]) { await click(v); await sleep(90); }
await clean("rapid clicks across the ten variants: nothing left behind", "blinds");
// 4 · back / forward quickly
for (let i = 0; i < 4; i++) { await b.ev("history.back()"); await sleep(120); }
for (let i = 0; i < 2; i++) { await b.ev("history.forward()"); await sleep(120); }
await sleep(2200);
const s4 = await b.ev(LEFT);
check(!s4.vt && !s4.mark && !s4.layers && !s4.named && !s4.styled, "back / forward in quick succession: nothing left behind", JSON.stringify(s4));
// 5 · "Stop all" in the middle of a transition: it ends at once, no layer stays
await click("curtain"); await sleep(1200);
await click("blinds"); await sleep(150);
await b.ev(`[...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Tümünü durdur")?.click()`);
await clean("\"Stop all\" mid-transition: the transition ends, no layer stays", "blinds");
await b.ev(`[...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Tümünü sürdür")?.click()`);

check(!b.errs.length, "no console errors", b.errs.slice(0, 3).join(" | "));
await b.close();
console.log(fails ? `✖ ${fails} failure(s)` : "✔ page transitions stay in their stage and leave nothing behind");
process.exit(fails ? 1 : 0);
