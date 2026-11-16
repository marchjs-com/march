import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { SectionTimeline } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const key = (el, k) => el.dispatchEvent(Object.assign(new Event("keydown", { bubbles: true, cancelable: true }), { key: k }));
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const items = (n, slug = true) => Array.from({ length: n }, (_, i) => ({ label: `Part ${i + 1}`, target: `#sec-${i}`, slug: slug ? `part-${i + 1}` : undefined }));

test("SectionTimeline: a named nav, a dot per section (links with a slug, buttons without), names on the dots", () => {
  const [el, dispose] = mount(() => h("div", null, h(SectionTimeline, { items: items(4) }), h(SectionTimeline, { items: items(3, false), labels: { group: "Steps" } })));
  const [a, b] = el.querySelectorAll("nav.m-stl");
  assert.equal(a.getAttribute("aria-label"), "Sections");
  assert.equal(b.getAttribute("aria-label"), "Steps");
  const links = a.querySelectorAll("a.m-stl-mark");
  assert.equal(links.length, 4);
  assert.equal(links[1].getAttribute("href"), "#part-2");
  assert.equal(links[1].getAttribute("aria-label"), "Part 2");
  assert.equal(b.querySelectorAll("button.m-stl-mark").length, 3);
  assert.equal(a.querySelectorAll("svg.m-stl-dot circle").length, 8, "a dot with its halo");
  dispose();
});

test("SectionTimeline: vertical by default, horizontal on request; fixed goes to the page's end", () => {
  const [el, dispose] = mount(() => h("div", null, h(SectionTimeline, { items: items(2) }), h(SectionTimeline, { items: items(2), orientation: "horizontal" })));
  const [a, b] = el.querySelectorAll("nav.m-stl");
  assert.ok(a.classList.contains("m-stl-vertical") && b.classList.contains("m-stl-horizontal"));
  dispose();
  const [host, d2] = mount(() => h(SectionTimeline, { items: items(2), fixed: true }));
  const fixed = document.querySelector("nav.m-stl.is-fixed");
  assert.ok(fixed, "a fixed timeline is rendered");
  assert.ok(!host.contains(fixed), "into the page's body, not the component's place (a transformed parent would carry it)");
  d2();
});

test("SectionTimeline: one tab stop; the arrow keys, Home and End move between the dots (Left / Right in a row)", () => {
  const [el, dispose] = mount(() => h("div", null, h(SectionTimeline, { items: items(4) }), h(SectionTimeline, { items: items(3), orientation: "horizontal" })));
  const [col, row] = el.querySelectorAll("ol.m-stl-list");
  const marks = [...col.querySelectorAll(".m-stl-mark")];
  assert.deepEqual(marks.map((m) => m.getAttribute("tabindex")), ["0", "-1", "-1", "-1"]);
  marks[0].focus();
  key(col, "ArrowDown"); assert.equal(document.activeElement, marks[1]);
  key(col, "End"); assert.equal(document.activeElement, marks[3]);
  key(col, "ArrowDown"); assert.equal(document.activeElement, marks[3], "stays at the last");
  key(col, "Home"); assert.equal(document.activeElement, marks[0]);
  const rmarks = [...row.querySelectorAll(".m-stl-mark")];
  rmarks[0].focus();
  key(row, "ArrowRight"); assert.equal(document.activeElement, rmarks[1]);
  key(row, "ArrowLeft"); assert.equal(document.activeElement, rmarks[0]);
  dispose();
});

test("SectionTimeline: a press marks its section as the one read, tells onChange and, with hash, writes #slug into the address without a history entry", async () => {
  for (let i = 0; i < 3; i++) { const s = document.createElement("section"); s.id = `sec-${i}`; document.body.appendChild(s); }
  const seen = [], before = history.length;
  const [el, dispose] = mount(() => h(SectionTimeline, { items: items(3), hash: true, smooth: false, onChange: (i) => seen.push(i) }));
  const marks = el.querySelectorAll(".m-stl-mark");
  marks[2].click();
  await tick();
  assert.equal(marks[2].getAttribute("aria-current"), "location");
  assert.ok(marks[2].closest("li").classList.contains("is-on"));
  assert.ok(marks[0].closest("li").classList.contains("is-past") && marks[1].closest("li").classList.contains("is-past"));
  assert.equal(marks[2].getAttribute("tabindex"), "0");
  assert.equal(seen[0], 2);
  assert.equal(location.hash, "#part-3");
  assert.equal(history.length, before, "replaceState: no new entry");
  dispose();
  document.querySelectorAll("section[id^=sec-]").forEach((s) => s.remove());
});

test("SectionTimeline: the magnifier writes --k and the shift near the pointer only, and lets go when it leaves; magnify={false} keeps still", async () => {
  const [el, dispose] = mount(() => h("div", null, h(SectionTimeline, { items: items(6) }), h(SectionTimeline, { items: items(6), magnify: false })));
  const [on, off] = el.querySelectorAll("ol.m-stl-list");
  const ev = (list, type, y) => list.dispatchEvent(Object.assign(new Event(type, { bubbles: type === "pointermove" }), { clientX: 0, clientY: y }));
  ev(on, "pointerenter", 0); ev(on, "pointermove", 0);
  ev(off, "pointerenter", 0); ev(off, "pointermove", 0);
  for (let i = 0; i < 40 && !on.classList.contains("is-lens"); i++) await tick(20);
  await tick(200);
  assert.ok(on.classList.contains("is-lens"), "magnified");
  assert.ok(Number(on.children[0].style.getPropertyValue("--k")) > 0.5, "the dot under the pointer grows");
  assert.equal(off.classList.contains("is-lens"), false);
  assert.equal(off.children[0].style.getPropertyValue("--k"), "");
  ev(on, "pointerleave", 0);
  for (let i = 0; i < 60 && on.classList.contains("is-lens"); i++) await tick(20);
  assert.equal(on.classList.contains("is-lens"), false, "lets go");
  assert.equal(on.children[0].style.getPropertyValue("--k"), "0");
  dispose();
});

test("SectionTimeline: the colour runs as a wave from the old section to the new one (each dot waits by its distance); wave={false} all at once", async () => {
  for (let i = 0; i < 6; i++) { const s = document.createElement("section"); s.id = `sec-${i}`; document.body.appendChild(s); }
  const [el, dispose] = mount(() => h("div", null, h(SectionTimeline, { items: items(6), smooth: false, wave: 400 }), h(SectionTimeline, { items: items(6), smooth: false, wave: false })));
  const [a, b] = el.querySelectorAll("ol.m-stl-list");
  a.querySelectorAll(".m-stl-mark")[5].click();
  b.querySelectorAll(".m-stl-mark")[5].click();
  await tick();
  const delays = (list) => [...list.children].map((li) => parseInt(li.style.getPropertyValue("--m-stl-delay")) || 0);
  const d = delays(a);
  // none read yet: the wave starts before the first dot
  for (let i = 1; i < 6; i++) assert.ok(d[i] > d[i - 1], `dot ${i} waits longer than dot ${i - 1}`);
  assert.ok(d[5] <= 400, "the whole wave within its length");
  assert.ok(delays(b).every((x) => x === 0));
  a.querySelectorAll(".m-stl-mark")[3].click();
  await tick();
  const back = delays(a);
  assert.ok(back[4] < back[3] && back[5] === 0, "going back the wave runs the other way, from the old one");
  dispose();
  document.querySelectorAll("section[id^=sec-]").forEach((s) => s.remove());
});
