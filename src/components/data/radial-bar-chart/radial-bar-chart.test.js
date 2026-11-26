import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { RadialBarChart } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const key = (el, k) => el.querySelector("svg").dispatchEvent(Object.assign(new Event("keydown", { bubbles: true }), { key: k }));
const rows = [{ label: "Move", value: 420, goal: 500 }, { label: "Exercise", value: 25, goal: 30 }, { label: "Stand", value: 9, goal: 12 }];

test("RadialBarChart: one ring (track, bar, label) per row; the center shows the first ring; live data", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(RadialBarChart, { data, rowMax: "goal", width: 300, height: 300, animate: false }));
  assert.equal(el.querySelectorAll(".m-radial-ring").length, 3);
  assert.equal(el.querySelectorAll(".m-radial-track").length, 3);
  assert.equal(el.querySelectorAll(".m-radial-bar").length, 3);
  assert.equal(el.querySelectorAll(".m-radial-label").length, 3);
  assert.equal(el.querySelector(".m-radial-center-value").textContent, "420");
  assert.equal(el.querySelector(".m-radial-center-label").textContent, "Move");
  data.set(rows.slice(1));
  assert.equal(el.querySelectorAll(".m-radial-ring").length, 2);
  assert.equal(el.querySelectorAll("table tbody tr").length, 2);
  assert.equal(el.querySelector(".m-radial-center-label").textContent, "Exercise");
  dispose();
});

test("RadialBarChart: animate false draws the sweep at once; a full ring is a circle, a gauge arc stops at its end", () => {
  const [el, dispose] = mount(() => [
    h(RadialBarChart, { data: [{ label: "A", value: 10 }], max: 10, endAngle: 360, rounded: false, track: false, width: 200, height: 200, animate: false }),
    h(RadialBarChart, { data: [{ label: "A", value: 0 }], startAngle: -135, endAngle: 135, max: 10, width: 200, height: 200, animate: false }),
  ]);
  const [a, b] = el.querySelectorAll(".m-chart");
  assert.ok(a.querySelector(".m-radial-bar").getAttribute("d").includes("A"));
  assert.equal(a.querySelector(".m-radial-track"), null);
  assert.equal(b.querySelector(".m-radial-bar").getAttribute("d"), "");
  assert.ok(b.querySelector(".m-radial-track").getAttribute("d").length > 0);
  dispose();
});

test("RadialBarChart: keyboard moves ring to ring, the center and the tooltip follow, Enter selects, Escape clears", () => {
  let got = null;
  const [el, dispose] = mount(() => h(RadialBarChart, { data: rows, rowMax: "goal", width: 300, height: 300, animate: false, onSelect: (p) => { got = p; } }));
  key(el, "ArrowDown");
  key(el, "ArrowDown");
  assert.ok(el.querySelector(".m-radial-ring.m-chart-active"));
  assert.equal(el.querySelector(".m-radial-center-label").textContent, "Exercise");
  const tipEl = el.querySelector(".m-chart-tooltip");
  assert.equal(tipEl.hidden, false);
  assert.ok(tipEl.textContent.includes("25 / 30"));
  key(el, "Enter");
  assert.equal(got?.label, "Exercise");
  assert.equal(got?.max, 30);
  key(el, "Escape");
  assert.equal(tipEl.hidden, true);
  dispose();
});

test("RadialBarChart: legend toggles rings; labels off; center text, function and false; tooltip false; empty", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => [
    h(RadialBarChart, { data, legend: true, labels: false, center: "Today", tooltip: false, empty: "Nothing", width: 300, height: 300, animate: false }),
    h(RadialBarChart, { data: rows, center: (p) => `${p.label}!`, width: 300, height: 300, animate: false }),
    h(RadialBarChart, { data: rows, center: false, width: 300, height: 300, animate: false }),
  ]);
  const [a, b, c] = el.querySelectorAll(".m-chart");
  assert.equal(a.querySelectorAll(".m-radial-label").length, 0);
  assert.equal(a.querySelector(".m-radial-center-value").textContent, "Today");
  assert.equal(b.querySelector(".m-radial-center-value").textContent, "Move!");
  assert.equal(c.querySelector(".m-radial-center"), null);
  a.querySelector(".m-chart-legend-item").dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(a.querySelectorAll(".m-radial-ring").length, 2);
  key(a, "ArrowDown");
  assert.equal(a.querySelector(".m-chart-tooltip").hidden, true);
  data.set([]);
  assert.ok(a.querySelector(".m-chart-empty").textContent.includes("Nothing"));
  dispose();
});

test("RadialBarChart: a leaving ring unwinds while animated, goes at once without animation", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => [h(RadialBarChart, { data, width: 300, height: 300, animate: { enter: false } }), h(RadialBarChart, { data, width: 300, height: 300, animate: false })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  data.set(rows.slice(0, 2));
  assert.equal(a.querySelectorAll(".m-radial-ring").length, 3);
  assert.equal(a.querySelectorAll(".m-radial-ring.m-chart-leaving").length, 1);
  assert.equal(b.querySelectorAll(".m-radial-ring").length, 2);
  dispose();
});
