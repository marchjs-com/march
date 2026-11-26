import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { Heatmap, heatLevel } = await import("./index.ts");
const clock = await import("../../../motion/engine/clock.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const cells = (el) => el.querySelectorAll(".m-heat-cell");

test("Heatmap: one cell per x × y; duplicates are summed; live data", () => {
  const data = signal([{ x: "a", y: 1, value: 2 }, { x: "b", y: 1, value: 4 }, { x: "a", y: 2, value: 1 }, { x: "a", y: 2, value: 1 }]);
  const [el, dispose] = mount(() => h(Heatmap, { data, title: "Load", width: 300 }));
  assert.equal(cells(el).length, 4);
  assert.equal(el.querySelector("svg title").textContent, "Load");
  data.set([{ x: "a", y: 1, value: 2 }]);
  assert.equal(cells(el).length, 1);
  dispose();
});

test("Heatmap: calendar mode draws weeks × 7 days; heatLevel buckets values", () => {
  const end = new Date(2026, 10, 20);
  const [el, dispose] = mount(() => h(Heatmap, { data: [{ x: end, value: 3 }], calendar: { weeks: 4 }, end, width: 300 }));
  assert.ok(cells(el).length >= 4 * 7 - 6 && cells(el).length <= 4 * 7);
  assert.equal(heatLevel(0, 10), 0);
  assert.equal(heatLevel(10, 10), 4, "the top level is levels − 1");
  dispose();
});

test("Heatmap: onSelect gets the clicked cell", () => {
  let got = null;
  const [el, dispose] = mount(() => h(Heatmap, { data: [{ x: "a", y: "r", value: 7 }], width: 300, onSelect: (c) => { got = c; } }));
  cells(el)[0].dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(got?.value, 7);
  dispose();
});

const key = (el, k) => el.querySelector(".m-chart-svg").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const grid = (el) => el.querySelectorAll(".m-chart-plot .m-heat-cell");
const texts = (el, sel) => [...el.querySelectorAll(sel)].map((t) => t.textContent);
const year = () => Array.from({ length: 365 }, (_, i) => ({ x: new Date(2026, 0, 1 + i), value: (i * 7) % 11 }));

test("Heatmap calendar: a year view of 53 weeks with month and Mon / Wed / Fri labels, gaps outside the range, a level legend", () => {
  const [el, dispose] = mount(() => h(Heatmap, { data: year(), calendar: true, from: "2026-01-01", to: "2026-12-31", firstDay: 1, width: 900, animate: false, title: "2026" }));
  assert.equal(grid(el).length, 365, "one cell per day of the range, none for the days around it");
  assert.equal(el.querySelectorAll(".m-sr-only table thead th").length - 1, 53, "53 week columns");
  assert.deepEqual(texts(el, ".m-chart-axis-y text"), ["Mon", "Wed", "Fri"]);
  const months = texts(el, ".m-chart-axis-x text");
  assert.equal(months.length, 12);
  assert.equal(months[0], "Jan");
  assert.equal(months[11], "Dec");
  const legend = el.querySelector(".m-heat-legend");
  assert.ok(legend.textContent.includes("Less") && legend.textContent.includes("More"));
  assert.equal(legend.querySelectorAll(".m-heat-swatch").length, 5);
  // 1 Jan 2026 is a Thursday: with Monday first, it sits in the fourth row of the first column
  const first = grid(el)[0];
  assert.equal(first.getAttribute("x"), "0");
  assert.equal(Number(first.getAttribute("y")) > 0, true);
  dispose();
});

test("Heatmap calendar: the week starts on the locale's first day; own labels, all weekdays, no months, no legend", () => {
  const [el, dispose] = mount(() => h(Heatmap, { data: year(), calendar: { weeks: 8 }, to: "2026-03-01", dayLabels: "all", months: false, levelLegend: false, width: 600, animate: false }));
  const days = texts(el, ".m-chart-axis-y text");
  assert.equal(days.length, 7);
  assert.equal(days[0], "Sun", "en: the week starts on Sunday (Intl week info)");
  assert.equal(el.querySelectorAll(".m-chart-axis-x text").length, 0);
  assert.equal(el.querySelector(".m-heat-legend"), null);
  const [b, dispose2] = mount(() => h(Heatmap, { data: year(), calendar: { weeks: 4 }, to: "2026-03-01", levelLegend: { less: "Az", more: "Çok" }, width: 400, animate: false }));
  assert.match(b.querySelector(".m-heat-legend").textContent, /Az.*Çok/);
  dispose(); dispose2();
});

test("Heatmap calendar: ↑ ↓ move a day, ← → a week; the tooltip says the date and the value", () => {
  let got = null;
  const [el, dispose] = mount(() => h(Heatmap, { data: year(), calendar: true, from: "2026-01-01", to: "2026-12-31", width: 900, animate: false, onSelect: (p) => { got = p; } }));
  key(el, "ArrowRight"); // first key shows the first day
  key(el, "ArrowDown");
  key(el, "ArrowRight");
  key(el, "Enter");
  assert.equal(got.datum.date.getDate(), 9, "1 Jan + 1 day + 1 week");
  assert.equal(got.datum.date.getMonth(), 0);
  const tipEl = el.querySelector(".m-chart-tooltip");
  assert.equal(tipEl.hidden, false);
  assert.match(tipEl.textContent, /January 9, 2026/);
  assert.match(tipEl.textContent, /Value/);
  key(el, "ArrowUp"); key(el, "ArrowLeft"); key(el, "Enter");
  assert.equal(got.datum.date.getDate(), 1);
  dispose();
});

test("Heatmap: cellSize, gap and radius set the squares", () => {
  const [el, dispose] = mount(() => h(Heatmap, { data: [{ x: "a", y: 1, value: 1 }, { x: "b", y: 1, value: 2 }], cellSize: 14, gap: 4, radius: 7, animate: false }));
  const [a, b] = grid(el);
  assert.equal(a.getAttribute("width"), "14");
  assert.equal(Number(b.getAttribute("x")) - Number(a.getAttribute("x")), 18);
  assert.equal(a.getAttribute("rx"), "7");
  dispose();
});

test("Heatmap: cells pop in as a diagonal wave (stagger) on the engine, and leaving cells shrink before they go", () => {
  const { manualClock, step } = clock;
  manualClock(true);
  try {
    const data = signal([{ x: "a", y: 1, value: 1 }, { x: "b", y: 1, value: 2 }, { x: "a", y: 2, value: 3 }, { x: "b", y: 2, value: 4 }]);
    const [el, dispose] = mount(() => h(Heatmap, { data, width: 300, animate: { easing: "out", duration: 200, stagger: 150 } }));
    const w = () => [...grid(el)].map((r) => Number(r.getAttribute("width")));
    assert.deepEqual(w(), [0, 0, 0, 0]);
    for (let i = 0; i < 8; i++) step(16);
    const [first, , , lastCell] = w();
    assert.ok(first > 0 && lastCell === 0, "the corner cell grows before the far diagonal starts");
    for (let i = 0; i < 100; i++) step(16);
    assert.ok(w().every((x) => x > 0));
    data.set(data().filter((d) => d.x === "a")); // column b leaves
    assert.equal(grid(el).length, 4, "the leaving cells stay while they shrink");
    assert.equal(el.querySelectorAll(".m-heat-cell.is-leaving").length, 2);
    for (let i = 0; i < 100; i++) step(16);
    assert.equal(grid(el).length, 2);
    dispose();
  } finally { clock.manualClock(false); }
});
