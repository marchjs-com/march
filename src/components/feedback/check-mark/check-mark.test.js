import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { CheckMark } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("CheckMark: glyph hidden, text read; follows the value", () => {
  const value = signal(true);
  const [el, dispose] = mount(() => h(CheckMark, { value }));
  const m = el.querySelector(".m-checkmark");
  assert.ok(m.classList.contains("is-yes") && m.classList.contains("m-checkmark-plain") && m.classList.contains("m-checkmark-md"));
  assert.equal(m.querySelector(".m-checkmark-icon").getAttribute("aria-hidden"), "true");
  assert.ok(m.querySelector(".m-checkmark-icon svg"));
  assert.equal(m.querySelector(".m-sr-only").textContent, "Yes");
  assert.equal(m.getAttribute("aria-hidden"), null);
  value.set(false);
  assert.ok(m.classList.contains("is-no"));
  assert.equal(m.querySelector(".m-sr-only").textContent, "No");
  value.set("partial");
  assert.ok(m.classList.contains("is-partial"));
  assert.equal(m.querySelector(".m-sr-only").textContent, "Partly");
  dispose();
});

test("CheckMark: own texts, visible text, decorative", () => {
  const [el, dispose] = mount(() => [
    h(CheckMark, { value: false, labels: { no: "Not included" }, text: true }),
    h(CheckMark, { value: "partial", label: "Half" }),
    h(CheckMark, { value: true, label: false, "data-k": "1" }),
  ]);
  const [a, b, c] = el.querySelectorAll(".m-checkmark");
  assert.equal(a.querySelector(".m-checkmark-text").textContent, "Not included");
  assert.equal(a.querySelector(".m-sr-only"), null, "shown text is not hidden");
  assert.equal(b.querySelector(".m-sr-only").textContent, "Half");
  assert.equal(c.getAttribute("aria-hidden"), "true");
  assert.equal(c.querySelector(".m-sr-only, .m-checkmark-text"), null);
  assert.equal(c.getAttribute("data-k"), "1");
  dispose();
});

test("CheckMark: look, size, colour and own glyphs", () => {
  const [el, dispose] = mount(() => [
    h(CheckMark, { value: true, variant: "soft", size: "lg", color: "brand-purple", class: "mine" }),
    h(CheckMark, { value: false, icons: { no: "👎", yes: false } }),
    h(CheckMark, { value: true, icons: { no: "👎", yes: false } }),
  ]);
  const [a, b, c] = el.querySelectorAll(".m-checkmark");
  for (const k of ["m-checkmark-soft", "m-checkmark-lg", "mine"]) assert.ok(a.classList.contains(k), k);
  assert.equal(a.getAttribute("data-m-color"), "brand-purple");
  assert.equal(b.querySelector(".m-checkmark-icon").textContent, "👎");
  assert.equal(c.querySelector(".m-checkmark-icon").childNodes.length === 0 || c.querySelector(".m-checkmark-icon").textContent === "", true, "false draws no glyph");
  dispose();
});

test("CheckMark: motion plays a transition between two values (the old glyph leaves, the new one arrives); none by default", async () => {
  const a = signal(false), b = signal(false), c = signal(true), d = signal(true);
  const seen = [];
  const [el, dispose] = mount(() => [
    h(CheckMark, { value: a }),
    h(CheckMark, { value: b, motion: "flip", variant: "soft" }),
    h(CheckMark, { value: c, motion: (next, prev, change) => { seen.push([next.isConnected, prev.isConnected, change.from, change.to]); } }),
    h(CheckMark, { value: d, motion: "none" }),
  ]);
  const [plain, flip, own, none] = el.querySelectorAll(".m-checkmark");
  assert.ok(!plain.classList.contains("m-checkmark-moves") && !none.classList.contains("m-checkmark-moves"));
  assert.ok(flip.classList.contains("m-checkmark-moves") && own.classList.contains("m-checkmark-moves"));
  assert.equal(flip.querySelectorAll(".m-checkmark-glyph").length, 1, "nothing plays on the first draw");
  a.set(true); d.set(false);
  assert.equal(plain.querySelectorAll(".m-checkmark-glyph").length, 1, "no motion: the glyph changes at once");
  assert.equal(none.querySelectorAll(".m-checkmark-glyph").length, 1);
  b.set(true);
  assert.ok(flip.classList.contains("is-yes"), "the value shows at once");
  const glyphs = flip.querySelectorAll(".m-checkmark-glyph");
  if (glyphs.length === 2) assert.ok(glyphs[0].classList.contains("is-leaving") && !glyphs[1].classList.contains("is-leaving"));
  c.set("partial");
  assert.deepEqual(seen, [[true, true, true, "partial"]], "your own function gets both glyphs and the change");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(own.querySelectorAll(".m-checkmark-glyph").length, 1, "the leaving glyph is removed when your motion settles");
  // a quick second change never leaves more than one glyph behind
  b.set(false); b.set("partial");
  assert.ok(flip.querySelectorAll(".m-checkmark-glyph").length <= 2);
  assert.ok(flip.classList.contains("is-partial"));
  await new Promise((r) => setTimeout(r, 30)); // the motion engine arrives: the transition starts, nothing waits unseen
  assert.equal(flip.querySelector(".is-arriving"), null);
  dispose();
});

test("CheckMark: variant bare is the glyph alone (the colour and text size of its host)", () => {
  const [el, dispose] = mount(() => h(CheckMark, { variant: "bare", label: false }));
  const m = el.querySelector(".m-checkmark");
  assert.ok(m.classList.contains("m-checkmark-bare"));
  assert.equal(m.getAttribute("aria-hidden"), "true");
  assert.ok(m.querySelector(".m-checkmark-icon svg"));
  dispose();
});
