#!/usr/bin/env node
// Opens every API example on the showcase API page (#/api/<subpath>/<name>, built showcase in examples/showcase/dist)
// in a headless browser and reports the ones whose page throws, whose live demo renders nothing, or that overflow.
//   node tools/api-examples-audit.mjs [--sub march/ui] [--width 390] [--base http://…]
// Build first: node examples/showcase/build.mjs. Exit 1 on a problem.
import { openHeadless, flag, sleep } from "./lib/headless.mjs";
import { exampleFiles } from "./api-examples.js";
import { slugOf } from "./api-docs.js";

const argv = process.argv.slice(2);
const only = flag(argv, "--sub", null);
const width = Number(flag(argv, "--width", "1280"));
const want = [];
for (const { subs } of exampleFiles().values()) for (const [sub, names] of Object.entries(subs)) if (!only || sub === only) for (const n of names) want.push([sub, n]);

const b = await openHeadless({ base: flag(argv, "--base", null) });
await b.load("/api", width);
const problems = [];
for (const [sub, name] of want) {
  b.errs.length = 0;
  const r = await b.ev(`(async () => {
    location.hash = ${JSON.stringify(`#/api/${slugOf(sub)}/${name}`)};
    const ready = () => document.querySelector(".sc-apip-name")?.textContent === ${JSON.stringify(name)} && document.querySelector(".sc-apip-stage, .sc-apip-doc .sc-play, .sc-apip-doc [role=alert], .sc-apip-doc .sc-apip-note:not(:empty)");
    for (let i = 0; i < 100 && !ready(); i++) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 300));
    const doc = document.querySelector(".sc-apip-doc");
    if (!doc || document.querySelector(".sc-apip-name")?.textContent !== ${JSON.stringify(name)}) return { err: "no doc" };
    const stage = doc.querySelector(".sc-apip-stage, .sc-play");
    const alert = doc.querySelector("[role=alert]")?.textContent;
    const note = [...doc.querySelectorAll(".sc-apip-note")].map((n) => n.textContent).join(" ");
    const main = document.querySelector(".sc-apip-main").getBoundingClientRect();
    const wide = [...doc.querySelectorAll(".sc-apip-stage *, .sc-play *")].some((e) => e.getBoundingClientRect().right > main.right + 1 && getComputedStyle(e).position !== "fixed" && !e.closest(".sc-ex-log, pre"));
    return { sig: !!doc.querySelector(".sc-apip-pre"), empty: !stage || !(stage.textContent.trim() || stage.querySelector("svg, canvas, img, input, button, video")), alert, note, wide, overflow: document.documentElement.scrollWidth > innerWidth };
  })()`);
  const errs = [...b.errs];
  if (!r || r.err || r.empty || r.alert || r.note || r.wide || r.overflow || errs.length) problems.push(`${sub} › ${name}: ${JSON.stringify({ ...r, errs: errs.slice(0, 2) })}`);
}
await b.close();
for (const p of problems) console.error(`✖ ${p}`);
console.log(`${want.length} examples at ${width}px, ${problems.length} with a problem`);
if (problems.length) process.exit(1);
