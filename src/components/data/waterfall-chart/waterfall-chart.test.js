import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { WaterfallChart } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const rows = [{ label: "Sales", value: 50 }, { label: "Costs", value: -30 }, { label: "Q1", total: true }, { label: "Tax", value: -5 }];
const key = (el, k) => el.querySelector(".m-chart-svg").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const bars = (el) => [...el.querySelectorAll(".m-waterfall-bar")];

test("WaterfallChart: start, steps, a subtotal row and an end total; kinds, +/− labels, connectors, data table", () => {
  const [el, dispose] = mount(() => h(WaterfallChart, { data: rows, start: 100, totals: "end", animate: false, width: 500, height: 260, title: "Profit" }));
  assert.equal(bars(el).length, 6);
  const kinds = [...el.querySelectorAll(".m-waterfall-step")].map((g) => g.getAttribute("class").match(/m-waterfall-(up|down|total)/)[1]);
  assert.deepEqual(kinds, ["total", "up", "down", "total", "down", "total"]);
  const labels = [...el.querySelectorAll(".m-waterfall-label")].map((t) => t.textContent);
  assert.deepEqual(labels, ["100", "+50", "−30", "120", "−5", "115"]);
  assert.equal(el.querySelectorAll(".m-waterfall-link").length, 5);
  const cells = [...el.querySelectorAll("tbody tr")].map((r) => [...r.querySelectorAll("td")].pop().textContent);
  assert.deepEqual(cells, ["100", "150", "120", "120", "115", "115"]);
  dispose();
});

test("WaterfallChart: animate false geometry — a step spans from the previous end to its own end", () => {
  const [el, dispose] = mount(() => h(WaterfallChart, { data: [{ label: "a", value: 10 }, { label: "b", value: -4 }], animate: false, width: 300, height: 240, yMax: 10, labels: false, connectors: false }));
  const [a, b] = bars(el);
  const y = (r) => Number(r.getAttribute("y")), ht = (r) => Number(r.getAttribute("height"));
  // b runs from 10 down to 6: its top is a's top and its height is 40 % of a's
  assert.equal(y(b), y(a));
  assert.ok(Math.abs(ht(b) - ht(a) * 0.4) < 0.2);
  assert.equal(el.querySelectorAll(".m-waterfall-link").length, 0);
  assert.equal(el.querySelector(".m-waterfall-label").textContent, "");
  dispose();
});

test("WaterfallChart: keyboard, tooltip with the running total, Enter selects, Escape clears", () => {
  let got = null;
  const [el, dispose] = mount(() => h(WaterfallChart, { data: rows, start: 100, animate: false, width: 500, height: 260, onSelect: (p) => { got = p; } }));
  key(el, "ArrowRight"); key(el, "ArrowRight"); key(el, "ArrowRight");
  const tipEl = el.querySelector(".m-chart-tooltip");
  assert.equal(tipEl.hidden, false);
  assert.match(tipEl.textContent, /Costs/);
  assert.match(tipEl.textContent, /120/);
  key(el, "Enter");
  assert.equal(got.kind, "down");
  assert.equal(got.from, 150);
  key(el, "Escape");
  assert.equal(tipEl.hidden, true);
  dispose();
});

test("WaterfallChart: live data, a removed step leaves at once without animation, legend hides a kind, empty, labels function", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => [
    h(WaterfallChart, { data, legend: true, animate: false, width: 500, height: 260, labels: (p) => `${p.kind}:${p.to}` }),
    h(WaterfallChart, { data: [], empty: "No steps", width: 300, height: 200 }),
  ]);
  const [a, b] = el.querySelectorAll(".m-chart");
  assert.equal(bars(a).length, 4);
  assert.equal(a.querySelector(".m-waterfall-label").textContent, "up:50");
  data.set(rows.slice(0, 2));
  assert.equal(bars(a).length, 2);
  a.querySelectorAll(".m-chart-legend-item")[1].dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(bars(a).length, 1);
  assert.equal(b.querySelector(".m-chart-empty").textContent, "No steps");
  dispose();
});

test("WaterfallChart: animated, bars keep a leaving one until it has shrunk; marks draw a target line", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(WaterfallChart, { data, animate: { enter: false }, width: 500, height: 260, marks: [{ y: 40, label: "Goal" }] }));
  data.set(rows.slice(0, 3));
  assert.equal(el.querySelectorAll(".m-waterfall-leaving").length, 1);
  assert.equal(el.querySelector(".m-chart-ref-h text").textContent, "Goal");
  dispose();
});
