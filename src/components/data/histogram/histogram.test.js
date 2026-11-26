import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { Histogram, binsOf, countBins } = await import("./index.ts");
const { quantile, kde, normalCdf } = await import("../../../charts/stats.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const key = (el, k) => el.querySelector("svg").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const values = [1, 2, 2, 3, 3, 3, 4, 4, 5, 9];
const num = (b, a) => Number(b.getAttribute(a));

test("binsOf / countBins: nice thresholds, a fixed width, the last edge included", () => {
  const b = binsOf(values, { count: 4 });
  assert.deepEqual(b.map((x) => x.x0), [0, 2, 4, 6, 8]);
  assert.deepEqual(countBins(values, b), [1, 5, 3, 0, 1]);
  const w = binsOf([0, 10], { width: 5 });
  assert.deepEqual(w.map((x) => [x.x0, x.x1]), [[0, 5], [5, 10]]);
  assert.deepEqual(countBins([0, 5, 10], w), [1, 2]);
});

test("Histogram: one bar per bin; the data table lists the bins; live data re-bins", () => {
  const data = signal(values);
  const [el, dispose] = mount(() => h(Histogram, { data, bins: 4, title: "Scores", width: 320, height: 200, animate: false }));
  assert.equal(el.querySelectorAll(".m-histogram-bar").length, 5);
  assert.equal(el.querySelector("svg title").textContent, "Scores");
  assert.equal(el.querySelectorAll("table tbody tr").length, 5);
  assert.equal(el.querySelector("table tbody tr td").textContent, "1");
  data.set(values.slice(0, 5));
  assert.equal(el.querySelectorAll(".m-histogram-bar").length, 4, "the removed bin leaves at once without animation");
  dispose();
});

test("Histogram: animate false draws final heights; cumulative bars only grow; density bars share one area", () => {
  const [el, dispose] = mount(() => [
    h(Histogram, { data: values, bins: 4, cumulative: true, width: 320, height: 200, animate: false }),
    h(Histogram, { data: values, binWidth: 2, density: true, width: 320, height: 200, animate: false }),
  ]);
  const [a, b] = el.querySelectorAll(".m-chart");
  const hs = [...a.querySelectorAll(".m-histogram-bar")].map((r) => num(r, "height"));
  for (let i = 1; i < hs.length; i++) assert.ok(hs[i] >= hs[i - 1], "running totals never fall");
  assert.ok(hs[0] > 0);
  assert.ok(b.querySelector("table tbody tr td").textContent.startsWith("0.05"), "1 value of 10 in a bin 2 wide = 0.05");
  dispose();
});

test("Histogram: arrows move over bins, the tooltip names the range, Enter selects, Escape clears", () => {
  let got = null;
  const [el, dispose] = mount(() => h(Histogram, { data: values, bins: 4, width: 320, height: 200, animate: false, onSelect: (p) => { got = p; } }));
  key(el, "ArrowRight"); key(el, "ArrowRight");
  const tip = el.querySelector(".m-chart-tooltip");
  assert.equal(tip.hidden, false);
  assert.ok(tip.textContent.includes("2 – 4"));
  key(el, "Enter");
  assert.equal(got?.count, 5);
  assert.equal(got?.x0, 2);
  key(el, "Escape");
  assert.equal(tip.hidden, true);
  dispose();
});

test("Histogram: groups overlay with a legend that toggles; curves and a mean mark; empty data", () => {
  const rows = [...values.map((v) => ({ v, g: "a" })), ...values.map((v) => ({ v: v + 2, g: "b" }))];
  const [el, dispose] = mount(() => [
    h(Histogram, { data: rows, value: "v", group: "g", curve: "normal", marks: [{ x: "average", series: "a" }], width: 320, height: 200, animate: false }),
    h(Histogram, { data: [], empty: "No scores", width: 320 }),
  ]);
  const legend = el.querySelectorAll(".m-chart-legend-item");
  assert.equal(legend.length, 2);
  assert.ok(el.querySelector(".m-histogram-overlay"));
  assert.equal(el.querySelectorAll(".m-histogram-curve").length, 2);
  assert.ok(el.textContent.includes("Average 3.6"));
  const before = el.querySelectorAll(".m-histogram-bar").length;
  legend[1].click();
  assert.equal(el.querySelectorAll(".m-histogram-bar").length, before / 2);
  assert.equal(el.querySelectorAll(".m-histogram-curve").length, 1);
  assert.ok(el.textContent.includes("No scores"));
  dispose();
});

test("Histogram: animated, bars grow from the baseline and removed bins shrink before they go", async () => {
  const data = signal(values);
  const [el, dispose] = mount(() => h(Histogram, { data, bins: 4, width: 320, height: 200, animate: { duration: 40, easing: "out" } }));
  assert.equal(num(el.querySelector(".m-histogram-bar"), "height"), 0, "starts flat");
  await new Promise((r) => setTimeout(r, 150));
  assert.ok(num(el.querySelector(".m-histogram-bar"), "height") > 0);
  data.set(values.slice(0, 5));
  assert.equal(el.querySelectorAll(".m-histogram-bar").length, 5, "the leaving bin stays while it shrinks");
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(el.querySelectorAll(".m-histogram-bar").length, 4);
  dispose();
});

test("stats: quantiles, kernel density integrates to about 1, normal CDF", () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([1, 2, 3, 4], 0.25), 1.75);
  const xs = Array.from({ length: 401 }, (_, i) => -10 + i * 0.05);
  const area = kde([0, 1, 2], xs, 0.5).reduce((a, y) => a + y * 0.05, 0);
  assert.ok(Math.abs(area - 1) < 0.01, `area ${area}`);
  assert.ok(Math.abs(normalCdf(0, 0, 1) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalCdf(1.96, 0, 1) - 0.975) < 1e-3);
});
