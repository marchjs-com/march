import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { FunnelChart } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const rows = [{ label: "Visit", value: 1000 }, { label: "Cart", value: 400 }, { label: "Pay", value: 100 }];
const key = (el, k) => el.querySelector(".m-chart-svg").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const shapes = (el) => [...el.querySelectorAll(".m-funnel-shape")].filter((p) => p.getAttribute("d"));

test("FunnelChart: one stage per row with value, share and conversion; data table; live data", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(FunnelChart, { data, animate: false, width: 400, height: 240, title: "Shop" }));
  assert.equal(shapes(el).length, 3);
  const inside = [...el.querySelectorAll(".m-funnel-value")].map((t) => t.textContent);
  assert.match(inside[1], /400/);
  assert.match(inside[1], /40/);
  const between = [...el.querySelectorAll(".m-funnel-between")].map((t) => t.textContent);
  assert.equal(between.length, 2);
  assert.match(between[1], /25/);
  assert.match(between[1], /300/);
  assert.equal(el.querySelectorAll("tbody tr").length, 3);
  assert.equal(el.querySelector("caption").textContent, "Shop");
  data.set([...rows, { label: "Return", value: 40 }]);
  assert.equal(shapes(el).length, 4);
  dispose();
});

test("FunnelChart: animate false draws widths by value; bars and pyramid shapes; a leaving stage goes at once", () => {
  const data = signal(rows), shape = signal("bars");
  const [el, dispose] = mount(() => h(FunnelChart, { data, shape, names: false, dropoff: false, showConversion: false, animate: false, width: 200, height: 120, gap: 0 }));
  // bars: plot 188 wide (6 px margins), centered at 100; stage 1 half width 94 * 0.4
  assert.equal(shapes(el)[1].getAttribute("d"), "M62.4,42L62.4,78L137.6,78L137.6,42Z");
  shape.set("pyramid");
  assert.ok(shapes(el)[2].getAttribute("d").includes("100,6"));
  data.set(rows.slice(0, 2));
  assert.equal(el.querySelectorAll(".m-funnel-stage").length, 2);
  dispose();
});

test("FunnelChart: keyboard moves between stages, the tooltip follows, Enter selects, Escape clears", () => {
  let got = null;
  const [el, dispose] = mount(() => h(FunnelChart, { data: rows, animate: false, width: 400, height: 240, onSelect: (p) => { got = p; } }));
  key(el, "ArrowDown"); key(el, "ArrowDown");
  const tipEl = el.querySelector(".m-chart-tooltip");
  assert.equal(tipEl.hidden, false);
  assert.match(tipEl.textContent, /Cart/);
  assert.ok(el.querySelectorAll(".m-funnel-stage")[1].classList.contains("m-chart-active"));
  key(el, "Enter");
  assert.equal(got.label, "Cart");
  assert.equal(got.conversion, 0.4);
  key(el, "Escape");
  assert.equal(tipEl.hidden, true);
  dispose();
});

test("FunnelChart: legend toggles a stage; custom label; empty", () => {
  const [el, dispose] = mount(() => [
    h(FunnelChart, { data: rows, legend: true, animate: false, width: 400, height: 240, label: (p) => `#${p.position + 1}` }),
    h(FunnelChart, { data: [], empty: "Nothing yet", animate: false, width: 300, height: 200 }),
  ]);
  const [a, b] = el.querySelectorAll(".m-chart");
  assert.equal(a.querySelector(".m-funnel-value").textContent, "#1");
  a.querySelectorAll(".m-chart-legend-item")[1].dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(shapes(a).length, 2);
  assert.equal(b.querySelector(".m-chart-empty").textContent, "Nothing yet");
  dispose();
});

test("FunnelChart: animated, a leaving stage stays (flagged) until its collapse has played", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(FunnelChart, { data, width: 400, height: 240 }));
  data.set(rows.slice(0, 2));
  assert.equal(el.querySelectorAll(".m-funnel-stage").length, 3);
  assert.equal(el.querySelectorAll(".m-funnel-leaving").length, 1);
  dispose();
});
