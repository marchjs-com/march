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
  const m = el.querySelector(".hm-checkmark");
  assert.ok(m.classList.contains("is-yes") && m.classList.contains("hm-checkmark-plain") && m.classList.contains("hm-checkmark-md"));
  assert.equal(m.querySelector(".hm-checkmark-icon").getAttribute("aria-hidden"), "true");
  assert.ok(m.querySelector(".hm-checkmark-icon svg"));
  assert.equal(m.querySelector(".hm-sr-only").textContent, "Yes");
  assert.equal(m.getAttribute("aria-hidden"), null);
  value.set(false);
  assert.ok(m.classList.contains("is-no"));
  assert.equal(m.querySelector(".hm-sr-only").textContent, "No");
  value.set("partial");
  assert.ok(m.classList.contains("is-partial"));
  assert.equal(m.querySelector(".hm-sr-only").textContent, "Partly");
  dispose();
});

test("CheckMark: own texts, visible text, decorative", () => {
  const [el, dispose] = mount(() => [
    h(CheckMark, { value: false, labels: { no: "Not included" }, text: true }),
    h(CheckMark, { value: "partial", label: "Half" }),
    h(CheckMark, { value: true, label: false, "data-k": "1" }),
  ]);
  const [a, b, c] = el.querySelectorAll(".hm-checkmark");
  assert.equal(a.querySelector(".hm-checkmark-text").textContent, "Not included");
  assert.equal(a.querySelector(".hm-sr-only"), null, "shown text is not hidden");
  assert.equal(b.querySelector(".hm-sr-only").textContent, "Half");
  assert.equal(c.getAttribute("aria-hidden"), "true");
  assert.equal(c.querySelector(".hm-sr-only, .hm-checkmark-text"), null);
  assert.equal(c.getAttribute("data-k"), "1");
  dispose();
});

test("CheckMark: look, size, colour and own glyphs", () => {
  const [el, dispose] = mount(() => [
    h(CheckMark, { value: true, variant: "soft", size: "lg", color: "brand-purple", class: "mine" }),
    h(CheckMark, { value: false, icons: { no: "👎", yes: false } }),
    h(CheckMark, { value: true, icons: { no: "👎", yes: false } }),
  ]);
  const [a, b, c] = el.querySelectorAll(".hm-checkmark");
  for (const k of ["hm-checkmark-soft", "hm-checkmark-lg", "mine"]) assert.ok(a.classList.contains(k), k);
  assert.equal(a.getAttribute("data-hm-color"), "brand-purple");
  assert.equal(b.querySelector(".hm-checkmark-icon").textContent, "👎");
  assert.equal(c.querySelector(".hm-checkmark-icon").childNodes.length === 0 || c.querySelector(".hm-checkmark-icon").textContent === "", true, "false draws no glyph");
  dispose();
});
