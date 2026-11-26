import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { BulletChart } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const rows = [
  { label: "Revenue", subtitle: "k$", value: 270, target: 250, previous: 230, ranges: [150, 225, 300] },
  { label: "Profit", subtitle: "%", value: 22, target: 26, ranges: [20, 25, 30] },
  { label: "NPS", value: 61, target: 70, previous: 55, ranges: [30, 60, 100] },
];
const key = (el, k) => el.querySelector(".m-chart-svg").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const n = (el, a) => Number(el.getAttribute(a));

test("BulletChart: one row per measure with ranges, bar, target and previous; names, values, data table", () => {
  const [el, dispose] = mount(() => h(BulletChart, { data: rows, animate: false, width: 500, title: "KPIs" }));
  assert.equal(el.querySelectorAll(".m-bullet-row").length, 3);
  assert.equal(el.querySelectorAll(".m-bullet-range").length, 9);
  assert.equal(el.querySelectorAll(".m-bullet-target").length, 3);
  assert.equal(el.querySelectorAll(".m-bullet-prev").length, 2);
  assert.deepEqual([...el.querySelectorAll(".m-bullet-name")].map((t) => t.textContent), ["Revenue", "Profit", "NPS"]);
  assert.equal(el.querySelector(".m-bullet-sub").textContent, "k$");
  assert.equal(el.querySelector(".m-bullet-value").textContent, "270");
  // automatic height: 3 rows of 58 px
  assert.equal(el.querySelector(".m-chart-svg").getAttribute("viewBox"), "0 0 500 182");
  const cells = [...el.querySelectorAll("tbody tr")].map((r) => [...r.querySelectorAll("td")].pop().textContent);
  assert.deepEqual(cells, ["Good", "Satisfactory", "Good"]);
  dispose();
});

test("BulletChart: animate false geometry — bar and target in proportion on the row's scale; vertical bars grow upwards", () => {
  const one = { label: "A", value: 50, target: 75, ranges: [100] };
  const [el, dispose] = mount(() => [h(BulletChart, { data: one, animate: false, width: 400, names: false, showValue: false, axis: false }),
    h(BulletChart, { data: [one], orientation: "vertical", animate: false, width: 200, height: 240, names: false, showValue: false })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  const bar = a.querySelector(".m-bullet-bar"), range = a.querySelector(".m-bullet-range"), tg = a.querySelector(".m-bullet-target");
  assert.ok(Math.abs(n(bar, "width") - n(range, "width") / 2) < 0.2);
  assert.ok(Math.abs(n(tg, "x1") - (n(range, "x") + n(range, "width") * 0.75)) < 0.2);
  const vb = b.querySelector(".m-bullet-bar"), vr = b.querySelector(".m-bullet-range");
  assert.ok(Math.abs(n(vb, "height") - n(vr, "height") / 2) < 0.2);
  assert.ok(Math.abs(n(vb, "y") + n(vb, "height") - (n(vr, "y") + n(vr, "height"))) < 0.2);
  dispose();
});

test("BulletChart: keyboard, tooltip with target and range, Enter selects, Escape clears", () => {
  let got = null;
  const [el, dispose] = mount(() => h(BulletChart, { data: rows, animate: false, width: 500, onSelect: (p) => { got = p; } }));
  key(el, "ArrowDown"); key(el, "ArrowDown");
  const tipEl = el.querySelector(".m-chart-tooltip");
  assert.equal(tipEl.hidden, false);
  assert.match(tipEl.textContent, /Profit/);
  assert.match(tipEl.textContent, /26/);
  assert.match(tipEl.textContent, /Satisfactory/);
  assert.ok(el.querySelectorAll(".m-bullet-row")[1].classList.contains("m-chart-active"));
  key(el, "Enter");
  assert.equal(got.label, "Profit");
  assert.equal(got.range, "Satisfactory");
  key(el, "Escape");
  assert.equal(tipEl.hidden, true);
  dispose();
});

test("BulletChart: live data, leaving row removed at once without animation, legend hides the target, compact, empty", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => [
    h(BulletChart, { data, legend: true, compact: true, animate: false, width: 500 }),
    h(BulletChart, { data: [], empty: "No KPIs", width: 300 }),
  ]);
  const [a, b] = el.querySelectorAll(".m-chart");
  assert.equal(a.querySelectorAll(".m-bullet-tick").length, 0);
  assert.equal(a.querySelector(".m-bullet-sub"), null);
  data.set(rows.slice(1));
  assert.equal(a.querySelectorAll(".m-bullet-row").length, 2);
  a.querySelectorAll(".m-chart-legend-item")[1].dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(a.querySelectorAll(".m-bullet-target").length, 0);
  assert.equal(b.querySelector(".m-chart-empty").textContent, "No KPIs");
  dispose();
});

test("BulletChart: animated, a leaving row stays (flagged) while it shrinks", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(BulletChart, { data, animate: { enter: false }, width: 500 }));
  data.set(rows.slice(0, 2));
  assert.equal(el.querySelectorAll(".m-bullet-row").length, 3);
  assert.equal(el.querySelectorAll(".m-bullet-leaving").length, 1);
  dispose();
});
