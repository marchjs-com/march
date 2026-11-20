import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { Sparkline } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("Sparkline: a line, the size, and a spoken summary that follows live data", () => {
  const data = signal([3, 5, 4]);
  const [el, dispose] = mount(() => h(Sparkline, { data, width: 100, height: 30, title: "Price" }));
  const svg = el.querySelector(".m-sparkline");
  assert.equal(svg.getAttribute("width"), "100");
  assert.ok(svg.querySelector(".m-chart-line").getAttribute("d").startsWith("M"));
  assert.match(svg.getAttribute("aria-label"), /^Price: 3 values, from 3 to 4/);
  data.set([1, 9]);
  assert.match(svg.getAttribute("aria-label"), /2 values, from 1 to 9/);
  dispose();
});

test("Sparkline: area, no dot, objects through y; empty data says so", () => {
  const [el, dispose] = mount(() => [h(Sparkline, { data: [{ v: 1 }, { v: 2 }], y: "v", area: true, dot: false }), h(Sparkline, { data: [], empty: "Nothing" })]);
  const [a, b] = el.querySelectorAll(".m-sparkline");
  assert.ok(a.querySelector(".m-chart-area"));
  assert.equal(a.querySelector(".m-chart-marker").getAttribute("visibility"), "hidden");
  assert.equal(b.getAttribute("aria-label"), "Nothing");
  dispose();
});
