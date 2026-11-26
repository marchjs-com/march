// Data changes animate, in every chart: after a data change the chart is drawn somewhere between the old and the new
// state (a tween on the motion engine has started), and a little later it settles on the new state. One test per chart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";
const { document } = installDom();
const { signal, h, render, setLocale } = await import("../src/index.ts");
const C = await import("../src/charts/index.ts");
const { Gantt } = await import("../src/components/data/gantt/index.ts");
setLocale("en");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GEO = ["d", "x", "y", "width", "height", "r", "cx", "cy", "x1", "x2", "y1", "y2", "transform", "points", "style", "stroke-dashoffset", "stroke-dasharray", "viewBox"];
/** Everything that draws: geometry attributes of every element plus the text of numbers that count. */
const snap = (el) => {
  const out = [];
  for (const n of el.querySelectorAll("*")) {
    if (n.closest?.(".m-sr-only") || n.tagName === "title" || n.tagName === "desc") continue;
    for (const a of GEO) { const v = n.getAttribute?.(a); if (v != null) out.push(`${n.tagName}.${a}=${v}`); }
    const css = n.style?._p ? [...n.style._p].join(";") : n.style?.cssText; if (css) out.push(`${n.tagName}.css=${css}`);
  }
  for (const n of el.querySelectorAll(".m-stat-value, .m-ring-text, .m-chart-center")) out.push(`text=${n.textContent}`);
  return out.join("|");
};
/** Mount, let the entrance settle, change the data, and check: moving right after, settled later, and changed. */
async function changes(name, view, change, settle = 1800) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(view, el);
  await sleep(settle);
  const before = snap(el);
  change();
  await sleep(60);
  const mid = snap(el);
  await sleep(settle);
  const after = snap(el);
  assert.notEqual(after, before, `${name}: the data change shows`);
  assert.notEqual(mid, after, `${name}: right after the change the chart is still on its way (a tween started)`);
  dispose();
}

const months = ["Jan", "Feb", "Mar", "Apr", "May"];
const series = (k) => months.map((m, i) => ({ m, a: 10 + ((i * 7 + k * 5) % 11), b: 5 + ((i * 3 + k * 7) % 9) }));
const days = (n, from = 0) => Array.from({ length: n }, (_, i) => ({ d: new Date(2026, 0, 1 + from + i), v: 10 + ((from + i) * 7) % 13 }));

test("LineChart: an appended point slides in and the line morphs", async () => {
  const data = signal(days(10));
  await changes("LineChart", () => h(C.LineChart, { data, x: "d", y: "v", width: 400 }), () => data.set([...data.peek(), ...days(1, 10)]));
});
test("AreaChart: a value change morphs the area", async () => {
  const data = signal(series(1));
  await changes("AreaChart", () => h(C.AreaChart, { data, x: "m", y: ["a", "b"], stacked: true, width: 400 }), () => data.set(series(2)));
});
test("ComboChart: bars grow and the line morphs", async () => {
  const data = signal(series(1));
  await changes("ComboChart", () => h(C.ComboChart, { data, x: "m", y: [{ key: "a", type: "bar" }, { key: "b", type: "line", axis: "right" }], width: 400 }), () => data.set(series(3)));
});
test("StreamGraph: layers swell and thin", async () => {
  const data = signal(series(1));
  await changes("StreamGraph", () => h(C.StreamGraph, { data, x: "m", y: ["a", "b"], width: 400 }), () => data.set(series(4)));
});
test("BarChart: bars glide to new values", async () => {
  const data = signal(series(1));
  await changes("BarChart", () => h(C.BarChart, { data, x: "m", y: ["a", "b"], width: 400 }), () => data.set(series(2)));
});
test("PieChart: slices turn to new angles", async () => {
  const data = signal([{ label: "a", value: 1 }, { label: "b", value: 3 }, { label: "c", value: 2 }]);
  await changes("PieChart", () => h(C.PieChart, { data, width: 240 }), () => data.set([{ label: "a", value: 4 }, { label: "b", value: 1 }, { label: "c", value: 2 }]));
});
test("Sparkline: an appended value slides in", async () => {
  const data = signal([3, 5, 4, 6, 8, 7]);
  await changes("Sparkline", () => h(C.Sparkline, { data }), () => data.set([...data.peek(), 2]));
});
test("Stat: the value counts to its new number", async () => {
  const value = signal(100);
  await changes("Stat", () => h(C.Stat, { label: "Orders", value, previous: 90, spark: [1, 3, 2, 4] }), () => value.set(240));
});
test("ProgressRing: the ring sweeps to its new value", async () => {
  const value = signal(20);
  await changes("ProgressRing", () => h(C.ProgressRing, { value, label: "Score" }), () => value.set(80));
});
test("BarList: bars grow and rows glide to their new rank", async () => {
  const data = signal([{ label: "A", value: 50 }, { label: "B", value: 20 }, { label: "C", value: 5 }]);
  await changes("BarList", () => h(C.BarList, { data }), () => data.set([{ label: "A", value: 10 }, { label: "B", value: 60 }, { label: "C", value: 30 }]));
});
test("Heatmap: cells change color with a transition (the engine's easing)", async () => {
  const data = signal([{ x: 1, y: 1, value: 2 }, { x: 2, y: 1, value: 4 }]);
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(C.Heatmap, { data, width: 300 }), el);
  assert.ok(el.querySelector(".m-heat-anim"), "cells carry a fill transition by default");
  dispose();
});
test("Gantt: bars glide to new dates", async () => {
  const tasks = signal([{ id: "a", name: "Design", start: "2026-11-02", end: "2026-11-06" }, { id: "b", name: "Build", start: "2026-11-09", end: "2026-11-13" }]);
  await changes("Gantt", () => h(Gantt, { tasks, scale: "day" }), () => tasks.set([{ id: "a", name: "Design", start: "2026-11-03", end: "2026-11-09" }, { id: "b", name: "Build", start: "2026-11-10", end: "2026-11-12" }]));
});
test("ScatterChart: points move to new positions", async () => {
  const data = signal([{ name: "A", x: 1, y: 2 }, { name: "B", x: 3, y: 5 }, { name: "C", x: 2, y: 3 }]);
  await changes("ScatterChart", () => h(C.ScatterChart, { data, label: "name", width: 300, height: 200 }), () => data.set([{ name: "A", x: 2, y: 4 }, { name: "B", x: 1, y: 1 }, { name: "C", x: 3, y: 5 }]));
});
test("Histogram: bins change height", async () => {
  const data = signal([1, 2, 2, 3, 3, 3, 4, 4, 5, 9]);
  await changes("Histogram", () => h(C.Histogram, { data, bins: 4, width: 320, height: 200 }), () => data.set([1, 1, 1, 2, 5, 6, 7, 8, 9, 9]));
});
test("BoxPlot: boxes reshape", async () => {
  const data = signal([{ label: "Mon", value: [12, 14, 15, 16, 18] }, { label: "Tue", value: [8, 9, 11, 13, 15] }]);
  await changes("BoxPlot", () => h(C.BoxPlot, { data, width: 320, height: 220 }), () => data.set([{ label: "Mon", value: [5, 9, 20, 26, 30] }, { label: "Tue", value: [8, 9, 11, 13, 15] }]));
});
test("FunnelChart: stages change width", async () => {
  const data = signal([{ label: "Visit", value: 1000 }, { label: "Cart", value: 400 }, { label: "Pay", value: 100 }]);
  await changes("FunnelChart", () => h(C.FunnelChart, { data, width: 400, height: 240 }), () => data.set([{ label: "Visit", value: 1000 }, { label: "Cart", value: 700 }, { label: "Pay", value: 350 }]));
});
test("WaterfallChart: steps glide", async () => {
  const data = signal([{ label: "Sales", value: 50 }, { label: "Costs", value: -30 }, { label: "Tax", value: -5 }]);
  await changes("WaterfallChart", () => h(C.WaterfallChart, { data, start: 100, width: 500, height: 260 }), () => data.set([{ label: "Sales", value: 80 }, { label: "Costs", value: -10 }, { label: "Tax", value: -15 }]));
});
test("BulletChart: bars fill and targets slide", async () => {
  const data = signal([{ label: "Revenue", value: 270, target: 250, ranges: [150, 225, 300] }]);
  await changes("BulletChart", () => h(C.BulletChart, { data, width: 500 }), () => data.set([{ label: "Revenue", value: 180, target: 280, ranges: [150, 225, 300] }]));
});
test("RadarChart: shapes morph", async () => {
  const data = signal([{ skill: "Speed", a: 8 }, { skill: "Power", a: 6 }, { skill: "Range", a: 4 }]);
  await changes("RadarChart", () => h(C.RadarChart, { data, x: "skill", y: ["a"], width: 320, height: 260 }), () => data.set([{ skill: "Speed", a: 3 }, { skill: "Power", a: 9 }, { skill: "Range", a: 7 }]));
});
test("RadialBarChart: rings sweep", async () => {
  const data = signal([{ label: "Move", value: 420, goal: 500 }, { label: "Stand", value: 9, goal: 12 }]);
  await changes("RadialBarChart", () => h(C.RadialBarChart, { data, rowMax: "goal", width: 300, height: 300 }), () => data.set([{ label: "Move", value: 120, goal: 500 }, { label: "Stand", value: 11, goal: 12 }]));
});
test("SunburstChart: arcs turn", async () => {
  const data = signal([{ label: "Food", children: [{ label: "Bread", value: 4 }, { label: "Fruit", value: 2 }] }, { label: "Home", children: [{ label: "Rent", value: 10 }] }]);
  await changes("SunburstChart", () => h(C.SunburstChart, { data, width: 300, height: 300 }), () => data.set([{ label: "Food", children: [{ label: "Bread", value: 9 }, { label: "Fruit", value: 6 }] }, { label: "Home", children: [{ label: "Rent", value: 3 }] }]));
});
test("Treemap: tiles glide to new rectangles", async () => {
  const data = signal([{ label: "A", value: 10 }, { label: "B", value: 5 }, { label: "C", value: 3 }]);
  await changes("Treemap", () => h(C.Treemap, { data, width: 400, height: 240 }), () => data.set([{ label: "A", value: 3 }, { label: "B", value: 9 }, { label: "C", value: 6 }]));
});
test("SankeyChart: ribbons and nodes morph", async () => {
  const links = signal([{ source: "Ads", target: "Visits", value: 60 }, { source: "Search", target: "Visits", value: 40 }, { source: "Visits", target: "Paid", value: 30 }]);
  await changes("SankeyChart", () => h(C.SankeyChart, { links, width: 600, height: 300 }), () => links.set([{ source: "Ads", target: "Visits", value: 20 }, { source: "Search", target: "Visits", value: 80 }, { source: "Visits", target: "Paid", value: 50 }]));
});
test("ChordChart: arcs and ribbons turn", async () => {
  const matrix = signal([[0, 5, 3], [2, 0, 4], [6, 1, 0]]);
  await changes("ChordChart", () => h(C.ChordChart, { matrix, names: ["A", "B", "C"], width: 400, height: 360 }), () => matrix.set([[0, 1, 9], [7, 0, 1], [2, 5, 0]]));
});
test("CandlestickChart: a new candle grows in and the window slides", async () => {
  const day = (i) => new Date(2026, 0, 1 + i);
  const make = (n, from = 0) => Array.from({ length: n }, (_, k) => { const i = k + from, o = 100 + i, c = o + (i % 2 ? -2 : 3); return { date: day(i), open: o, high: Math.max(o, c) + 2, low: Math.min(o, c) - 2, close: c }; });
  const data = signal(make(12));
  await changes("CandlestickChart", () => h(C.CandlestickChart, { data, window: 10, width: 400, height: 260 }), () => data.set([...data.peek(), ...make(1, 12)]));
});
test("NetworkGraph: node sizes and positions move", async () => {
  const nodes = signal([{ id: "a", value: 5 }, { id: "b", value: 1 }, { id: "c", value: 3 }]);
  const links = [{ source: "a", target: "b" }, { source: "a", target: "c" }];
  await changes("NetworkGraph", () => h(C.NetworkGraph, { nodes, links, width: 400, height: 300 }), () => nodes.set([{ id: "a", value: 1 }, { id: "b", value: 9 }, { id: "c", value: 3 }, { id: "d", value: 2 }]), 2500);
});
test("ChoroplethMap: provinces change color", async () => {
  const shapes = [{ id: "a", name: "A", d: "M0 0h10v10H0z" }, { id: "b", name: "B", d: "M10 0h10v10H10z" }];
  const data = signal([{ id: "a", value: 1 }, { id: "b", value: 5 }]);
  await changes("ChoroplethMap", () => h(C.ChoroplethMap, { shapes, viewBox: [0, 0, 20, 10], data, width: 300 }), () => data.set([{ id: "a", value: 9 }, { id: "b", value: 2 }]));
});
