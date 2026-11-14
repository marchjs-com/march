import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Skeleton } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };
const mountD = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Skeleton: n lines (the last short) are busy; a block is decorative; colours add a tint class", () => {
  const el = mount(() => [h(Skeleton, { lines: 4 }), h(Skeleton, { block: true, height: "lg", colors: "brand" })]);
  const lines = el.querySelector(".hm-skel-lines");
  assert.equal(lines.getAttribute("aria-busy"), "true");
  assert.equal(lines.querySelectorAll(".hm-skel-line").length, 4);
  assert.ok(lines.lastElementChild.classList.contains("hm-skel-short"));
  const block = el.querySelector(".hm-skel-block");
  assert.equal(block.getAttribute("aria-hidden"), "true");
  assert.ok(block.classList.contains("hm-skel-lg") && block.classList.contains("hm-skel-brand"));
});

test("Skeleton: still shapes, full-width last line, own label and class", () => {
  const m = mountD(() => [h(Skeleton, { lines: 3, shimmer: false, shortLast: false, label: "Loading the profile", class: ["mine", false] }), h(Skeleton, { block: true, shimmer: false })]);
  const lines = m.el.querySelector(".hm-skel-lines");
  assert.ok(lines.classList.contains("is-still") && lines.classList.contains("mine"));
  assert.equal(lines.getAttribute("aria-label"), "Loading the profile");
  assert.equal(lines.querySelector(".hm-skel-short"), null);
  assert.ok(m.el.querySelector(".hm-skel-block").classList.contains("is-still"));
  m.dispose();
});

test("Skeleton: shape=\"circle\" is one round decorative shape in three sizes", () => {
  const el = mount(() => [h(Skeleton, { shape: "circle", class: "a" }), h(Skeleton, { shape: "circle", height: "lg", shimmer: false, class: "b" })]);
  const a = el.querySelector(".a"), b = el.querySelector(".b");
  assert.ok(a.classList.contains("hm-skel") && a.classList.contains("hm-skel-circle"));
  assert.equal(a.getAttribute("aria-hidden"), "true");
  assert.ok(!a.classList.contains("hm-skel-md") && !a.classList.contains("hm-skel-block"));
  assert.ok(b.classList.contains("hm-skel-circle-lg") && b.classList.contains("is-still") && !b.classList.contains("hm-skel-lg"));
});
