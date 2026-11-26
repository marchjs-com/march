import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { LineChart, AreaChart, ComboChart } = await import("./index.ts");

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

const days = Array.from({ length: 12 }, (_, i) => ({ d: new Date(2026, 0, 1 + i), a: 10 + i, b: i % 3 ? 20 - i : null, m: 0.1 + i / 100 }));

test("ComboChart: bars and a line on a second (right) axis with titles", () => {
  const [el, dispose] = mount(() => h(ComboChart, { data: days, x: "d", y: [{ key: "a", type: "bar", label: "Orders" }, { key: "m", type: "line", axis: "right" }], yTitle: "Orders", y2Title: "Margin", width: 500, height: 240, animate: false }));
  assert.equal(el.querySelectorAll(".m-chart-is-bar .m-chart-bar").length, 12);
  assert.equal(el.querySelectorAll(".m-chart-is-line .m-chart-line").length, 1);
  assert.ok(el.querySelector(".m-chart-axis-right"), "right axis");
  assert.deepEqual([...el.querySelectorAll(".m-chart-axis-title")].map((t) => t.textContent).filter(Boolean).sort(), ["Margin", "Orders"]);
  assert.ok(el.textContent.includes("Orders"), "series label from the option object");
  dispose();
});

test("LineChart: null values leave gaps (two runs), connectNulls joins them; markers and curves draw", () => {
  const [el, dispose] = mount(() => [h(LineChart, { data: days, x: "d", y: "b", width: 400, animate: false, markers: true, curve: "smooth" }),
    h(LineChart, { data: days, x: "d", y: "b", width: 400, animate: false, connectNulls: true, curve: "step" })]);
  const [gap, joined] = [...el.querySelectorAll(".m-chart-line")].map((p) => p.getAttribute("d"));
  assert.ok((gap.match(/M/g) ?? []).length > 1, "gaps split the line");
  assert.equal((joined.match(/M/g) ?? []).length, 1);
  assert.ok(gap.includes("C"), "smooth draws curves");
  assert.ok(el.querySelector(".m-chart-dots"), "markers");
  dispose();
});

test("LineChart: reference marks (value line, average, band, note)", () => {
  const [el, dispose] = mount(() => h(LineChart, { data: days, x: "d", y: "a", width: 400, animate: false,
    marks: [{ y: 15, label: "Target", color: "danger" }, { y: "average" }, { x: [days[2].d, days[5].d], label: "Sale" }, { at: [days[8].d, 18], label: "Peak" }] }));
  assert.ok(el.querySelector(".m-chart-ref-h"));
  assert.ok(el.textContent.includes("Target"));
  assert.ok(el.textContent.includes("Average"));
  assert.ok(el.querySelector(".m-chart-ref-vb rect"));
  assert.ok(el.querySelector(".m-chart-ref-pt"));
  dispose();
});

test("LineChart: window keeps the last rows while data grows; navigator draws; stacked expand stays in 0..100 %", () => {
  const data = signal(days);
  const [el, dispose] = mount(() => [h(LineChart, { data, x: "d", y: "a", width: 400, animate: false, window: 5, navigator: true, xFormat: (v) => new Date(v).getDate() }),
    h(AreaChart, { data: days, x: "d", y: ["a", "m"], stacked: true, offset: "expand", width: 400, animate: false, legend: false })]);
  const ticks = () => [...el.querySelectorAll(".m-line-chart .m-chart-axis-x text")].map((t) => t.textContent).filter(Boolean).map(Number);
  assert.ok(Math.min(...ticks()) >= 7, "only the last five days");
  data.set([...days, { d: new Date(2026, 0, 13), a: 30, b: 1, m: 0.2 }]);
  assert.ok(Math.min(...ticks()) >= 8, "the window slid");
  assert.ok(el.querySelector(".m-chart-nav .m-chart-nav-window"));
  assert.equal(el.querySelectorAll(".m-chart-nav [role=slider]").length, 2);
  const ylabels = [...el.querySelectorAll(".m-area-chart .m-chart-axis-left text")].map((t) => t.textContent);
  assert.ok(ylabels.some((t) => t.includes("100")), "expand shows shares up to 100 %");
  dispose();
});

test("LineChart: charts with the same sync name share the crosshair", () => {
  const [el, dispose] = mount(() => [h(LineChart, { data: days, x: "d", y: "a", width: 400, animate: false, sync: "s1" }), h(LineChart, { data: days, x: "d", y: "a", width: 400, animate: false, sync: "s1" })]);
  const [a, b] = el.querySelectorAll(".m-chart-svg");
  a.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(b.querySelector(".m-chart-focus").getAttribute("visibility"), "visible");
  a.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(b.querySelector(".m-chart-focus").getAttribute("visibility"), "hidden");
  dispose();
});

test("LineChart: animated by default; a hidden series stays drawn while it sinks, animate={false} removes it at once", () => {
  const [el, dispose] = mount(() => [h(LineChart, { data: rows, x: "d", y: ["a", "b"], width: 300, class: "anim" }), h(LineChart, { data: rows, x: "d", y: ["a", "b"], width: 300, animate: false, class: "still" })]);
  for (const c of ["anim", "still"]) el.querySelector(`.${c} .m-chart-legend-item`).click();
  assert.equal(el.querySelectorAll(".still .m-chart-line").length, 1);
  assert.equal(el.querySelectorAll(".anim .m-chart-line").length, 2, "still sinking");
  dispose();
});
