import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Chevron } = await import("./index.ts");
const { arrowRight } = await import("../../../icons/glyphs/arrowRight.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("Chevron: decorative, follows `open`, automatic without it", () => {
  const open = signal(false);
  const [el, dispose] = mount(() => [h(Chevron, { open }), h(Chevron, { "data-k": "1" })]);
  const [a, b] = el.querySelectorAll(".m-chevron");
  assert.equal(a.getAttribute("aria-hidden"), "true");
  assert.ok(a.classList.contains("is-closed") && a.classList.contains("m-chevron-end") && a.classList.contains("m-chevron-sm"));
  assert.ok(a.querySelector("svg"), "the built-in glyph");
  open.set(true);
  assert.ok(a.classList.contains("is-open") && !a.classList.contains("is-closed"));
  assert.ok(b.classList.contains("is-auto"), "no open prop: the ancestor's aria-expanded drives it (CSS)");
  assert.equal(b.getAttribute("data-k"), "1");
  dispose();
});

test("Chevron: direction, size, motion, colour, own icon, leaf", () => {
  const leaf = signal(false);
  const [el, dispose] = mount(() => [
    h(Chevron, { direction: "down", size: "lg", motion: "spring", color: "primary", class: "mine", leaf }),
    h(Chevron, { motion: false, icon: "›" }),
    h(Chevron, { icon: arrowRight }),
  ]);
  const [a, b, c] = el.querySelectorAll(".m-chevron");
  for (const k of ["m-chevron-down", "m-chevron-lg", "is-spring", "mine"]) assert.ok(a.classList.contains(k), k);
  assert.equal(a.getAttribute("data-m-color"), "primary");
  assert.ok(b.classList.contains("is-still"));
  assert.equal(b.textContent, "›", "own text mark");
  assert.ok(c.querySelector(".m-chevron-own svg"), "own icon");
  leaf.set(true);
  assert.ok(a.classList.contains("is-leaf"));
  assert.equal(a.querySelector("svg"), null, "a leaf keeps the box only");
  dispose();
});
