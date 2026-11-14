import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Swatch, CHECKER } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("Swatch: a picture by default; colour as a custom property, token as data-m-color", () => {
  const color = signal("#ff7a1a");
  const [el, dispose] = mount(() => [h(Swatch, { color, label: "Orange" }), h(Swatch, { color: "brand-blue" })]);
  const [a, b] = el.querySelectorAll(".m-sample");
  assert.equal(a.tagName, "SPAN");
  assert.equal(a.getAttribute("role"), "img");
  assert.equal(a.getAttribute("aria-label"), "Orange");
  assert.equal(a.style.getPropertyValue("--m-sample"), "#ff7a1a");
  assert.ok(a.classList.contains(CHECKER) && a.classList.contains("m-sample-md") && a.classList.contains("m-sample-round"));
  color.set("linear-gradient(90deg, red, blue)");
  assert.equal(a.style.getPropertyValue("--m-sample"), "linear-gradient(90deg, red, blue)");
  color.set("cat-3");
  assert.equal(a.getAttribute("data-m-color"), "cat-3");
  assert.equal(a.style.getPropertyValue("--m-sample"), "");
  assert.equal(b.getAttribute("data-m-color"), "brand-blue");
  assert.equal(b.getAttribute("aria-hidden"), "true", "no label: decoration");
  dispose();
});

test("Swatch: a button with onClick; selected is pressed, the mark shows", () => {
  const sel = signal(false);
  let clicks = 0;
  const [el, dispose] = mount(() => h(Swatch, { color: "#000", label: "Black", selected: sel, mark: true, size: "lg", shape: "circle", checker: false, class: "mine", "data-v": "k", onClick: () => { clicks++; sel.set(true); } }));
  const b = el.querySelector("button.m-sample");
  assert.equal(b.getAttribute("type"), "button");
  assert.equal(b.getAttribute("aria-label"), "Black");
  assert.equal(b.getAttribute("title"), "Black");
  assert.equal(b.getAttribute("aria-pressed"), "false");
  assert.equal(b.querySelector(".m-sample-mark"), null);
  for (const k of ["m-sample-lg", "m-sample-circle", "mine"]) assert.ok(b.classList.contains(k), k);
  assert.ok(!b.classList.contains(CHECKER));
  assert.equal(b.getAttribute("data-v"), "k");
  b.click();
  assert.equal(clicks, 1);
  assert.equal(b.getAttribute("aria-pressed"), "true");
  assert.ok(b.classList.contains("is-selected"));
  assert.ok(b.querySelector(".m-sample-mark svg"), "the tick");
  dispose();
});

test("Swatch: role decides how selected is said; disabled; content", () => {
  const [el, dispose] = mount(() => [
    h(Swatch, { color: "#111", role: "radio", selected: true, onClick() {}, tabindex: "-1" }),
    h(Swatch, { color: "#222", role: "option", selected: false }),
    h(Swatch, { color: "#333", onClick() {}, disabled: true }, "Aa"),
  ]);
  const [a, b, c] = el.querySelectorAll(".m-sample");
  assert.equal(a.getAttribute("role"), "radio");
  assert.equal(a.getAttribute("aria-checked"), "true");
  assert.equal(a.getAttribute("aria-pressed"), null);
  assert.equal(a.getAttribute("tabindex"), "-1");
  assert.equal(b.getAttribute("aria-selected"), "false");
  assert.equal(c.disabled, true);
  assert.equal(c.getAttribute("aria-pressed"), null, "no selected prop: not a toggle");
  assert.equal(c.querySelector(".m-sample-body").textContent, "Aa");
  dispose();
});
