import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { Heatmap, heatLevel } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const cells = (el) => el.querySelectorAll(".m-heat-cell");

test("Heatmap: one cell per x × y; duplicates are summed; live data", () => {
  const data = signal([{ x: "a", y: 1, value: 2 }, { x: "b", y: 1, value: 4 }, { x: "a", y: 2, value: 1 }, { x: "a", y: 2, value: 1 }]);
  const [el, dispose] = mount(() => h(Heatmap, { data, title: "Load", width: 300 }));
  assert.equal(cells(el).length, 4);
  assert.equal(el.querySelector("svg title").textContent, "Load");
  data.set([{ x: "a", y: 1, value: 2 }]);
  assert.equal(cells(el).length, 1);
  dispose();
});

test("Heatmap: calendar mode draws weeks × 7 days; heatLevel buckets values", () => {
  const end = new Date(2026, 10, 20);
  const [el, dispose] = mount(() => h(Heatmap, { data: [{ x: end, value: 3 }], calendar: { weeks: 4 }, end, width: 300 }));
  assert.ok(cells(el).length >= 4 * 7 - 6 && cells(el).length <= 4 * 7);
  assert.equal(heatLevel(0, 10), 0);
  assert.equal(heatLevel(10, 10), 4, "the top level is levels − 1");
  dispose();
});

test("Heatmap: onSelect gets the clicked cell", () => {
  let got = null;
  const [el, dispose] = mount(() => h(Heatmap, { data: [{ x: "a", y: "r", value: 7 }], width: 300, onSelect: (c) => { got = c; } }));
  cells(el)[0].dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(got?.value, 7);
  dispose();
});
