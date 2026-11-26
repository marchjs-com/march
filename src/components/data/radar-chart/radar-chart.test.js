import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { RadarChart } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const key = (el, k) => el.querySelector("svg").dispatchEvent(Object.assign(new Event("keydown", { bubbles: true }), { key: k }));
const rows = [
  { skill: "Speed", a: 8, b: 5 }, { skill: "Power", a: 6, b: 9 }, { skill: "Range", a: 4, b: 7 },
  { skill: "Stamina", a: 9, b: 6 }, { skill: "Skill", a: 7, b: 8 },
];

test("RadarChart: one shape per series, one spoke and one label per row, a dot on every value; live data", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(RadarChart, { data, x: "skill", y: ["a", "b"], width: 320, height: 260, animate: false }));
  assert.equal(el.querySelectorAll(".m-radar-shape").length, 2);
  assert.equal(el.querySelectorAll(".m-radar-spoke").length, 5);
  assert.equal(el.querySelectorAll(".m-radar-label").length, 5);
  assert.equal(el.querySelectorAll(".m-radar-dot").length, 10);
  assert.equal(el.querySelectorAll(".m-radar-ring").length, 4);
  data.set(rows.slice(0, 3));
  assert.equal(el.querySelectorAll(".m-radar-spoke").length, 3);
  assert.equal(el.querySelectorAll(".m-radar-dot").length, 6);
  assert.equal(el.querySelectorAll("table tbody tr").length, 3);
  dispose();
});

test("RadarChart: animate false draws the values at once; the largest value reaches the rim", () => {
  const [el, dispose] = mount(() => h(RadarChart, { data: [{ label: "A", value: 10 }, { label: "B", value: 5 }, { label: "C", value: 10 }, { label: "D", value: 5 }], width: 200, height: 200, axisLabels: false, animate: false }));
  const dots = [...el.querySelectorAll(".m-radar-dot")];
  // center (100,100), radius min(100-8, 100-8) = 92: A on top at the rim, B to the right at half
  assert.equal(Number(dots[0].getAttribute("cy")), 8);
  assert.equal(Number(dots[1].getAttribute("cx")), 146);
  dispose();
});

test("RadarChart: keyboard moves between spokes, the tooltip follows, Enter selects, Escape clears", () => {
  let got = null;
  const [el, dispose] = mount(() => h(RadarChart, { data: rows, x: "skill", y: ["a", "b"], series: ["Ada", "Bora"], width: 320, height: 260, animate: false, onSelect: (p) => { got = p; } }));
  key(el, "ArrowRight");
  assert.ok(el.querySelector(".m-radar-spoke.m-chart-active"));
  const tipEl = el.querySelector(".m-chart-tooltip");
  assert.equal(tipEl.hidden, false);
  assert.ok(tipEl.textContent.includes("Speed") && tipEl.textContent.includes("Ada"));
  key(el, "ArrowRight");
  key(el, "Enter");
  assert.equal(got?.label, "Power");
  assert.equal(got?.values.b, 9);
  key(el, "Escape");
  assert.equal(tipEl.hidden, true);
  assert.equal(el.querySelector(".m-radar-spoke.m-chart-active"), null);
  dispose();
});

test("RadarChart: legend toggles a series; tooltip false; empty data shows the empty text", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(RadarChart, { data, x: "skill", y: ["a", "b"], tooltip: false, empty: "Nothing", width: 320, height: 260, animate: false }));
  const items = el.querySelectorAll(".m-chart-legend-item");
  assert.equal(items.length, 2);
  items[0].dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(el.querySelectorAll(".m-radar-shape").length, 1);
  key(el, "ArrowRight");
  assert.equal(el.querySelector(".m-chart-tooltip").hidden, true);
  data.set([]);
  assert.ok(el.querySelector(".m-chart-empty").textContent.includes("Nothing"));
  dispose();
});

test("RadarChart: a series hidden in the legend shrinks away while animated, goes at once without animation", () => {
  const [el, dispose] = mount(() => [h(RadarChart, { data: rows, x: "skill", y: ["a", "b"], width: 300, height: 240, animate: { enter: false } }), h(RadarChart, { data: rows, x: "skill", y: ["a", "b"], width: 300, height: 240, animate: false })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  a.querySelector(".m-chart-legend-item").dispatchEvent(new Event("click", { bubbles: true }));
  b.querySelector(".m-chart-legend-item").dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(a.querySelectorAll(".m-radar-series").length, 2);
  assert.equal(a.querySelectorAll(".m-radar-series.m-chart-leaving").length, 1);
  assert.equal(b.querySelectorAll(".m-radar-series").length, 1);
  dispose();
});

test("RadarChart: circle grid, smooth curve, lines only, per-axis scale", () => {
  const [el, dispose] = mount(() => h(RadarChart, { data: rows, x: "skill", y: "a", gridShape: "circle", curve: "smooth", fill: false, levels: 3, axisMax: () => 10, dots: false, width: 300, height: 240, animate: false }));
  assert.equal(el.querySelectorAll(".m-radar-ring").length, 3);
  assert.ok(el.querySelector(".m-radar-ring").getAttribute("d").includes("A"));
  assert.ok(el.querySelector(".m-radar-shape").getAttribute("d").includes("C"));
  assert.equal(el.querySelector(".m-radar-shape").style.getPropertyValue("--m-radar-fill"), "0");
  assert.equal(el.querySelectorAll(".m-radar-dot").length, 0);
  dispose();
});
