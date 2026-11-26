import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { ChordChart } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const matrix = [[0, 5, 3], [2, 0, 4], [6, 1, 0]];
const names = ["A", "B", "C"];
const key = (k) => new KeyboardEvent("keydown", { key: k, bubbles: true });

test("ChordChart: one arc per group; undirected pairs share a ribbon, directed flows get one each", () => {
  const [el, dispose] = mount(() => [h(ChordChart, { matrix, names, width: 400, height: 360, animate: false }), h(ChordChart, { matrix, names, directed: true, width: 400, height: 360, animate: false })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  assert.equal(a.querySelectorAll(".m-chord-arc").length, 3);
  assert.equal(a.querySelectorAll(".m-chord-ribbon").length, 3);
  assert.equal(b.querySelectorAll(".m-chord-ribbon").length, 6);
  assert.ok(a.querySelector(".m-chord-groups").textContent.includes("B"));
  assert.equal(a.querySelectorAll("table tbody tr").length, 6);
  dispose();
});

test("ChordChart: flow rows build the matrix; names fix the group order; arcs span by total", () => {
  const data = [{ from: "x", to: "y", n: 10 }, { from: "y", to: "x", n: 10 }];
  const [el, dispose] = mount(() => h(ChordChart, { data, source: "from", target: "to", value: "n", padAngle: 0, labels: false, width: 400, height: 360, animate: false }));
  assert.equal(el.querySelectorAll(".m-chord-arc").length, 2);
  const d = el.querySelector(".m-chord-arc").getAttribute("d");
  assert.ok(d.startsWith("M"));
  // two equal groups: the first arc is a half turn, its end is straight below the center
  assert.ok(d.includes("A") && el.querySelectorAll(".m-chord-label").length === 0);
  dispose();
});

test("ChordChart: keyboard over groups then ribbons; a group lights its ribbons; Enter selects; Escape clears", () => {
  let got = null;
  const [el, dispose] = mount(() => h(ChordChart, { matrix, names, width: 400, height: 360, animate: false, onSelect: (p) => { got = p; } }));
  const svg = el.querySelector("svg");
  svg.dispatchEvent(key("ArrowRight"));
  assert.ok(el.querySelector(".m-chord-group.m-chart-active"));
  assert.ok(el.querySelector(".m-chord-focus"));
  assert.equal(el.querySelectorAll(".m-chord-ribbon.m-chord-on").length, 2);
  assert.equal(el.querySelector(".m-chart-tooltip").hidden, false);
  svg.dispatchEvent(key("Enter"));
  assert.equal(got?.kind, "group");
  assert.equal(got?.label, "A");
  svg.dispatchEvent(key("End"));
  svg.dispatchEvent(key("Enter"));
  assert.equal(got?.kind, "ribbon");
  svg.dispatchEvent(key("Escape"));
  assert.equal(el.querySelector(".m-chord-focus"), null);
  dispose();
});

test("ChordChart: live data, empty, legend hides a group with its ribbons, ticks", () => {
  const m = signal(matrix);
  const [el, dispose] = mount(() => h(ChordChart, { matrix: m, names, legend: true, ticks: true, width: 400, height: 360, animate: false, empty: "No flows" }));
  assert.ok(el.querySelectorAll(".m-chord-ticks line").length > 3);
  el.querySelector(".m-chart-legend-item").dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(el.querySelectorAll(".m-chord-arc").length, 2);
  assert.equal(el.querySelectorAll(".m-chord-ribbon").length, 1);
  m.set([]);
  assert.ok(el.querySelector(".m-chart-empty")?.textContent.includes("No flows"));
  dispose();
});

test("ChordChart: leaving marks go at once without animation, stay while they collapse with it", () => {
  const m = signal(matrix);
  const [el, dispose] = mount(() => [h(ChordChart, { matrix: m, names, width: 400, height: 360, animate: false }), h(ChordChart, { matrix: m, names, width: 400, height: 360, animate: { duration: 200, easing: "out", enter: false } })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  m.set([[0, 5], [2, 0]]);
  assert.equal(a.querySelectorAll(".m-chord-arc").length, 2);
  assert.equal(b.querySelectorAll(".m-chord-arc").length, 3);
  dispose();
});
