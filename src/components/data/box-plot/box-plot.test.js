import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { BoxPlot, boxStats } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const key = (el, k) => el.querySelector("svg").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const rows = [
  { label: "Mon", value: [12, 14, 15, 15, 16, 18, 19, 40] },
  { label: "Tue", value: [8, 9, 11, 12, 13, 13, 14, 15] },
  { label: "Wed", value: [20, 22, 23, 25, 26, 28, 30, 31] },
];
// the box's extent along the value axis (vertical plot: y of the path)
const boxSpan = (item) => { const ys = item.querySelector(".m-boxplot-box").getAttribute("d").match(/[-\d.]+,[-\d.]+/g).map((p) => Number(p.split(",")[1])); return Math.max(...ys) - Math.min(...ys); };

test("boxStats: quartiles, 1.5 IQR whiskers and outliers; min / max whiskers", () => {
  const s = boxStats([12, 14, 15, 15, 16, 18, 19, 40]);
  assert.equal(s.median, 15.5);
  assert.equal(s.q1, 14.75);
  assert.equal(s.q3, 18.25);
  assert.equal(s.high, 19);
  assert.deepEqual(s.outliers, [40]);
  const m = boxStats([12, 14, 15, 15, 16, 18, 19, 40], Infinity);
  assert.equal(m.high, 40);
  assert.deepEqual(m.outliers, []);
  assert.equal(boxStats([]), null);
});

test("BoxPlot: one box per category from lists or one row per value; outliers, mean, data table; live data", () => {
  const data = signal(rows);
  const long = rows[1].value.map((v) => ({ day: "Tue", v }));
  const [el, dispose] = mount(() => [h(BoxPlot, { data, title: "Waits", width: 320, height: 220, animate: false }), h(BoxPlot, { data: long, x: "day", y: "v", width: 320, animate: false })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  assert.equal(a.querySelectorAll(".m-boxplot-item").length, 3);
  assert.equal(b.querySelectorAll(".m-boxplot-item").length, 1);
  assert.equal(a.querySelector("svg title").textContent, "Waits");
  assert.equal(a.querySelectorAll(".m-boxplot-outlier").length, 1, "40 lies beyond the Monday whisker");
  assert.ok(a.querySelector(".m-boxplot-mean").getAttribute("d"));
  assert.equal(a.querySelectorAll("table tbody tr").length, 3);
  assert.equal(a.querySelector("table tbody tr").children[4].textContent, "15.5", "the median column");
  data.set(rows.slice(1));
  assert.equal(a.querySelectorAll(".m-boxplot-item").length, 2, "without animation the leaving box goes at once");
  dispose();
});

test("BoxPlot: violin and both modes draw a silhouette; showPoints jitters every value the same way twice", () => {
  const [el, dispose] = mount(() => [
    h(BoxPlot, { data: rows, mode: "violin", width: 320, animate: false }),
    h(BoxPlot, { data: rows, mode: "both", showPoints: true, width: 320, animate: false }),
    h(BoxPlot, { data: rows, mode: "both", showPoints: true, width: 320, animate: false }),
  ]);
  const [v, b, c] = el.querySelectorAll(".m-chart");
  assert.ok(v.querySelector(".m-boxplot-violin").getAttribute("d").startsWith("M"));
  assert.equal(v.querySelector(".m-boxplot-whisker").getAttribute("d"), "");
  assert.ok(b.querySelector(".m-boxplot-mode-both"));
  assert.equal(b.querySelectorAll(".m-boxplot-dot").length, 24);
  const cx = (n) => [...n.querySelectorAll(".m-boxplot-dot")].map((d) => d.getAttribute("cx")).join();
  assert.equal(cx(b), cx(c), "deterministic jitter");
  dispose();
});

test("BoxPlot: horizontal lays boxes down; arrows walk categories, the tooltip shows the median, Enter selects", () => {
  let got = null;
  const [el, dispose] = mount(() => h(BoxPlot, { data: rows, horizontal: true, width: 320, height: 220, animate: false, onSelect: (p) => { got = p; } }));
  assert.equal(el.querySelector(".m-chart-axis-left .m-chart-tick text").textContent, "Mon");
  key(el, "ArrowRight"); key(el, "ArrowRight");
  const tip = el.querySelector(".m-chart-tooltip");
  assert.equal(tip.hidden, false);
  assert.ok(tip.textContent.includes("Tue"));
  assert.ok(tip.textContent.includes("Median"));
  key(el, "Enter");
  assert.equal(got?.label, "Tue");
  assert.equal(got?.stats.median, 12.5);
  key(el, "Escape");
  assert.equal(tip.hidden, true);
  dispose();
});

test("BoxPlot: legend (asked for) toggles categories; marks; empty data", () => {
  const [el, dispose] = mount(() => [
    h(BoxPlot, { data: rows, legend: true, marks: [{ y: 20, label: "Target" }], width: 320, animate: false }),
    h(BoxPlot, { data: [], empty: "No waits", width: 320 }),
  ]);
  const items = el.querySelectorAll(".m-chart-legend-item");
  assert.equal(items.length, 3);
  items[0].click();
  assert.equal(el.querySelectorAll(".m-boxplot-item").length, 2);
  assert.ok(el.textContent.includes("Target"));
  assert.ok(el.textContent.includes("No waits"));
  dispose();
});

test("BoxPlot: animated, a box grows out of its median and a leaving one collapses before it is removed", async () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(BoxPlot, { data, width: 320, height: 220, animate: { duration: 40, easing: "out" } }));
  assert.equal(boxSpan(el.querySelector(".m-boxplot-item")), 0, "starts as a line at the median");
  await new Promise((r) => setTimeout(r, 150));
  assert.ok(boxSpan(el.querySelector(".m-boxplot-item")) > 0);
  data.set(rows.slice(1));
  assert.equal(el.querySelectorAll(".m-boxplot-item").length, 3);
  assert.equal(el.querySelectorAll(".m-boxplot-leaving").length, 1);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(el.querySelectorAll(".m-boxplot-item").length, 2);
  dispose();
});
