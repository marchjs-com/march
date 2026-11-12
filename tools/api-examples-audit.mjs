#!/usr/bin/env node
// Opens every API reference example in a headless browser (İlk Adımlar › API başvurusu, built showcase in
// examples/showcase/dist) and reports the ones that throw, render nothing or overflow their card.
//   node tools/api-examples-audit.mjs [--sub hadi-march/ui] [--width 390] [--base http://…]
// Build first: node examples/showcase/build.mjs. Exit 1 on a problem.
import { openHeadless, flag, sleep } from "./lib/headless.mjs";
import { exampleFiles } from "./api-examples.js";

const argv = process.argv.slice(2);
const only = flag(argv, "--sub", null);
const width = Number(flag(argv, "--width", "1280"));
const want = [];
for (const { subs } of exampleFiles().values()) for (const [sub, names] of Object.entries(subs)) if (!only || sub === only) for (const n of names) want.push([sub, n]);

const b = await openHeadless({ base: flag(argv, "--base", null) });
await b.load("/start", width);
// the reference loads when it scrolls into view
for (let i = 0; i < 60 && !(await b.ev(`!!document.querySelector(".sc-api-toggle")`)); i++) {
  await b.ev(`(() => { const h = [...document.querySelectorAll("main h2")].find((x) => /API başvurusu/.test(x.textContent)); h?.scrollIntoView(); })()`);
  await sleep(250);
}
const problems = [];
for (const [sub, name] of want) {
  b.errs.length = 0;
  const r = await b.ev(`(async () => {
    const group = [...document.querySelectorAll(".sc-api-group")].find((g) => g.querySelector(".sc-api-sub code")?.textContent === ${JSON.stringify(sub)});
    const row = group && [...group.querySelectorAll(".sc-api-row")].find((li) => li.querySelector(".sc-api-name")?.textContent === ${JSON.stringify(name)});
    if (!row) return { err: "no card" };
    const btn = row.querySelector(".sc-api-toggle");
    if (btn.getAttribute("aria-expanded") !== "true") btn.click();
    for (let i = 0; i < 60 && !row.querySelector(".sc-api-stage, .sc-play, [role=alert], .sc-api-note:not([aria-live])"); i++) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 250));
    const stage = row.querySelector(".sc-api-stage, .sc-play");
    const alert = row.querySelector(".sc-api-detail [role=alert]")?.textContent;
    const note = row.querySelector(".sc-api-note")?.textContent;
    const box = row.getBoundingClientRect(), wide = [...row.querySelectorAll("*")].some((e) => e.getBoundingClientRect().right > box.right + 1 && getComputedStyle(e).position !== "fixed" && !e.closest("[style*=overflow], pre, .hm-code, .sc-ex-log"));
    const out = { sig: !!row.querySelector(".sc-api-sig"), empty: !stage || !(stage.textContent.trim() || stage.querySelector("svg, canvas, img, input, button, video")), alert, note, wide, overflow: document.documentElement.scrollWidth > innerWidth };
    btn.click();
    return out;
  })()`);
  const errs = [...b.errs];
  const bad = !r || r.err || r.empty || r.alert || r.note || r.wide || r.overflow || errs.length;
  if (bad) problems.push(`${sub} › ${name}: ${JSON.stringify({ ...r, errs: errs.slice(0, 2) })}`);
}
await b.close();
for (const p of problems) console.error(`✖ ${p}`);
console.log(`${want.length} examples at ${width}px, ${problems.length} with a problem`);
if (problems.length) process.exit(1);
