import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { ScatterChart, linearFit, symbolPath } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const key = (el, k) => el.querySelector("svg").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const rows = [
  { name: "A", x: 1, y: 2, pop: 10, team: "red" }, { name: "B", x: 3, y: 5, pop: 40, team: "red" },
  { name: "C", x: 2, y: 3, pop: 20, team: "blue" }, { name: "D", x: 4, y: 7, pop: 90, team: "blue" },
];
const translate = (p) => p.getAttribute("transform").match(/translate\(([-\d.]+),([-\d.]+)\)/).slice(1).map(Number);

test("ScatterChart: one point per row; the title, the data table and the points follow live data", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(ScatterChart, { data, label: "name", title: "Teams", width: 300, height: 200, animate: false }));
  assert.equal(el.querySelectorAll(".m-scatter-point").length, 4);
  assert.equal(el.querySelector("svg title").textContent, "Teams");
  assert.equal(el.querySelectorAll("table tbody tr").length, 4);
  data.set(rows.slice(0, 3));
  assert.equal(el.querySelectorAll(".m-scatter-point").length, 3, "with animate false the leaving point goes at once");
  assert.equal(el.querySelectorAll("table tbody tr").length, 3);
  dispose();
});

test("ScatterChart: animate false places points at once; a point keeps its key and moves to the new x / y", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(ScatterChart, { data, label: "name", width: 300, height: 200, xMin: 0, xMax: 10, yMin: 0, yMax: 10, animate: false }));
  const a = el.querySelector('[data-key="A"]');
  const [x1] = translate(a);
  data.set(rows.map((r) => (r.name === "A" ? { ...r, x: 9 } : r)));
  const [x2] = translate(el.querySelector('[data-key="A"]'));
  assert.equal(el.querySelector('[data-key="A"]'), a, "same element: the point glides instead of being redrawn");
  assert.ok(x2 > x1 + 100, `moved right (${x1} → ${x2})`);
  dispose();
});

test("ScatterChart: size makes area-scaled bubbles; group colors series with shapes and a legend that toggles", () => {
  const [el, dispose] = mount(() => h(ScatterChart, { data: rows, label: "name", size: "pop", group: "team", shape: "auto", width: 300, height: 200, animate: false }));
  const pts = [...el.querySelectorAll(".m-scatter-point")];
  assert.equal(pts.length, 4);
  assert.ok(el.querySelector(".m-scatter-bubble"));
  assert.ok(el.querySelector(".m-scatter-square"), "the second group is drawn as squares");
  const legend = el.querySelectorAll(".m-chart-legend-item");
  assert.equal(legend.length, 2);
  legend[0].click();
  assert.equal(el.querySelectorAll(".m-scatter-point").length, 2, "hiding a series removes its points");
  assert.equal(legend[0].getAttribute("aria-pressed"), "false");
  dispose();
});

test("ScatterChart: arrows walk the points in x order, the tooltip follows, Enter selects, Escape clears", () => {
  let got = null;
  const [el, dispose] = mount(() => h(ScatterChart, { data: rows, label: "name", width: 300, height: 200, animate: false, onSelect: (p) => { got = p; } }));
  key(el, "ArrowRight");
  assert.ok(el.querySelector('[data-key="A"]').classList.contains("m-chart-active"));
  key(el, "ArrowRight");
  assert.ok(el.querySelector('[data-key="C"]').classList.contains("m-chart-active"), "x = 2 comes second");
  const tip = el.querySelector(".m-chart-tooltip");
  assert.equal(tip.hidden, false);
  assert.ok(tip.textContent.includes("C"));
  key(el, "Enter");
  assert.equal(got?.label, "C");
  assert.equal(got?.y, 3);
  key(el, "Escape");
  assert.equal(tip.hidden, true);
  dispose();
});

test("ScatterChart: a trend line with r², reference marks, axis titles; empty data shows the empty text", () => {
  const [el, dispose] = mount(() => [
    h(ScatterChart, { data: rows, trend: "linear", marks: [{ y: 4, label: "Goal" }, { x: 2.5 }], xTitle: "Spend", yTitle: "Score", width: 300, height: 200, animate: false }),
    h(ScatterChart, { data: [], empty: "Nothing yet", width: 300 }),
  ]);
  assert.equal(el.querySelectorAll(".m-scatter-trend").length, 1);
  assert.match(el.querySelector(".m-scatter-trend text").textContent, /^r² 0\.\d+/);
  assert.ok(el.textContent.includes("Goal"));
  assert.equal(el.querySelector(".m-scatter-x-title").textContent, "Spend");
  assert.ok(el.textContent.includes("Nothing yet"));
  dispose();
});

test("ScatterChart helpers: least squares and symbol paths", () => {
  const fit = linearFit([[0, 1], [1, 3], [2, 5]]);
  assert.equal(fit.slope, 2);
  assert.equal(fit.intercept, 1);
  assert.equal(fit.r2, 1);
  assert.equal(linearFit([[1, 1]]), null);
  assert.equal(symbolPath("circle", 0), "");
  assert.match(symbolPath("diamond", 4), /^M0,-5\.01L5\.01,0/);
});

test("ScatterChart: animated, a new point grows from nothing and a leaving one shrinks before it is removed", async () => {
  const data = signal([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
  const [el, dispose] = mount(() => h(ScatterChart, { data, width: 300, animate: { duration: 40, easing: "out" } }));
  assert.equal(el.querySelector(".m-scatter-point").getAttribute("d"), "", "drawn at radius 0 first");
  await new Promise((r) => setTimeout(r, 150));
  assert.match(el.querySelector(".m-scatter-point").getAttribute("d"), /^M-5,0a5,5/);
  data.set([{ x: 1, y: 1 }]);
  assert.equal(el.querySelectorAll(".m-scatter-point").length, 2);
  assert.equal(el.querySelectorAll(".m-scatter-leaving").length, 1);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(el.querySelectorAll(".m-scatter-point").length, 1);
  dispose();
});
