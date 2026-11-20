import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { LineChart, AreaChart } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const shown = (el) => [...el.querySelectorAll(".m-chart-legend")].filter((l) => !l.hasAttribute("hidden")).length;
const rows = [{ d: 1, a: 3, b: 1 }, { d: 2, a: 5, b: 2 }, { d: 3, a: 4, b: 6 }];

test("LineChart: one line per series, a legend for two, the title and a data table; live data", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(LineChart, { data, x: "d", y: ["a", "b"], series: { a: "Alpha", b: "Beta" }, title: "Trend", width: 300, height: 200 }));
  assert.equal(el.querySelectorAll(".m-chart-line").length, 2);
  assert.equal(el.querySelector("svg title").textContent, "Trend");
  assert.equal(shown(el), 1, "two series show a legend");
  assert.equal(el.querySelectorAll("table tbody tr").length, 3);
  data.set([...rows, { d: 4, a: 9, b: 9 }]);
  assert.equal(el.querySelectorAll("table tbody tr").length, 4);
  dispose();
});

test("LineChart: one series has no legend unless asked; legend={false} hides it", () => {
  const [el, dispose] = mount(() => [h(LineChart, { data: rows, x: "d", y: "a", width: 300 }), h(LineChart, { data: rows, x: "d", y: ["a", "b"], legend: false, width: 300 })]);
  assert.equal(shown(el), 0);
  dispose();
});

test("AreaChart: fills under the line; empty data shows the empty text", () => {
  const [el, dispose] = mount(() => [h(AreaChart, { data: rows, x: "d", y: "a", width: 300 }), h(AreaChart, { data: [], y: "a", empty: "Nothing yet", width: 300 })]);
  assert.ok(el.querySelector(".m-chart-area"));
  assert.ok(el.textContent.includes("Nothing yet"));
  dispose();
});
