import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { CornerMark } = await import("./index.ts");
const { video } = await import("../../../icons/glyphs/video.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("CornerMark: defaults (top-end, md, scrim, decorative) with an icon", () => {
  const corner = signal(undefined);
  const [el, dispose] = mount(() => h(CornerMark, { icon: video, corner }));
  const m = el.querySelector(".m-corner-mark");
  for (const c of ["m-corner-mark-top-end", "m-corner-mark-md", "m-corner-mark-scrim"]) assert.ok(m.classList.contains(c), c);
  assert.equal(m.getAttribute("aria-hidden"), "true");
  assert.ok(m.querySelector("svg"));
  corner.set("bottom-start");
  assert.ok(m.classList.contains("m-corner-mark-bottom-start"));
  assert.ok(!m.classList.contains("m-corner-mark-top-end"));
  dispose();
});

test("CornerMark: colour, size, look, ring, hover, overlap, label, own content", () => {
  const [el, dispose] = mount(() => h(CornerMark, { corner: "bottom-end", color: "brand-orange", size: "sm", variant: "solid", ring: true, show: "hover", overlap: true, label: "Add story" }, h("b", { class: "own" }, "+")));
  const m = el.querySelector(".m-corner-mark");
  for (const c of ["m-corner-mark-bottom-end", "m-corner-mark-sm", "m-corner-mark-solid", "is-ringed", "is-hover", "is-overlap"]) assert.ok(m.classList.contains(c), c);
  assert.equal(m.getAttribute("data-m-color"), "brand-orange");
  assert.equal(m.getAttribute("role"), "img");
  assert.equal(m.getAttribute("aria-label"), "Add story");
  assert.equal(m.getAttribute("aria-hidden"), null);
  assert.equal(m.querySelector(".own").textContent, "+");
  dispose();
});
