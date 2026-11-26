import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { CandlestickChart } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const day = (i) => new Date(2026, 0, 1 + i);
const make = (n, from = 0) => Array.from({ length: n }, (_, k) => { const i = k + from, o = 100 + i, c = o + (i % 2 ? -2 : 3); return { date: day(i), open: o, high: Math.max(o, c) + 2, low: Math.min(o, c) - 2, close: c, vol: 1000 + i * 10 }; });
const key = (el, k) => el.querySelector("svg").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

test("CandlestickChart: one candle per row, rising and falling colors, the title and a data table", () => {
  const [el, dispose] = mount(() => h(CandlestickChart, { data: make(6), title: "BTC", width: 400, height: 260, animate: false }));
  assert.equal(el.querySelectorAll(".m-candle").length, 6);
  assert.equal(el.querySelectorAll(".m-candle-body").length, 6);
  assert.equal(el.querySelectorAll(".m-candle-up").length >= 3, true);
  assert.equal(el.querySelectorAll(".m-candle.m-candle-down").length, 3);
  assert.equal(el.querySelector("svg title").textContent, "BTC");
  assert.equal(el.querySelectorAll("table tbody tr").length, 6);
  assert.equal(el.querySelectorAll("table thead th").length, 5);
  dispose();
});

test("CandlestickChart: animate false draws the body from open to close at once", () => {
  const rows = [{ date: day(0), open: 10, high: 20, low: 0, close: 20 }, { date: day(1), open: 20, high: 20, low: 0, close: 10 }];
  const [el, dispose] = mount(() => h(CandlestickChart, { data: rows, width: 300, height: 200, animate: false, lastPrice: false }));
  const [a, b] = el.querySelectorAll(".m-candle-body");
  assert.ok(Number(a.getAttribute("height")) > 50, "the rising body spans open → close");
  assert.equal(a.getAttribute("height"), b.getAttribute("height"));
  const wick = el.querySelector(".m-candle-wick");
  assert.ok(Number(wick.getAttribute("y2")) - Number(wick.getAttribute("y1")) >= Number(a.getAttribute("height")));
  dispose();
});

test("CandlestickChart: types ohlc and line, volume pane, moving averages with legend toggles", () => {
  const type = signal("ohlc");
  const [el, dispose] = mount(() => h(CandlestickChart, { data: make(30), type, volume: "vol", ma: [5, 10], width: 500, height: 300, animate: false }));
  assert.equal(el.querySelectorAll(".m-candle-tick").length, 60);
  assert.equal(el.querySelectorAll(".m-candle-volume").length, 30);
  assert.equal(el.querySelectorAll(".m-candle-ma").length, 2);
  const items = el.querySelectorAll(".m-chart-legend-item");
  assert.equal(items.length, 3, "MA 5, MA 10 and Volume");
  items[0].dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(el.querySelectorAll(".m-candle-ma").length, 1);
  items[2].dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(el.querySelectorAll(".m-candle-volume").length, 0);
  type.set("line");
  assert.equal(el.querySelectorAll(".m-candle-body, .m-candle-tick").length, 0);
  assert.ok(el.querySelector(".m-candle-close").getAttribute("d").startsWith("M"));
  dispose();
});

test("CandlestickChart: keyboard moves between candles, the tooltip shows OHLC, Enter selects, Escape clears", () => {
  let got = null;
  const [el, dispose] = mount(() => h(CandlestickChart, { data: make(5), width: 400, animate: false, onSelect: (p) => { got = p; } }));
  key(el, "ArrowRight");
  const tip = el.querySelector(".m-chart-tooltip");
  assert.equal(tip.hasAttribute("hidden"), false);
  assert.ok(tip.textContent.includes("Open") && tip.textContent.includes("Close"));
  key(el, "ArrowRight");
  assert.equal(el.querySelector(".m-candle.m-chart-active")?.getAttribute("data-key"), String(day(1).getTime()));
  key(el, "Enter");
  assert.equal(got?.index, 1);
  assert.equal(got?.close, 99);
  key(el, "Escape");
  assert.equal(tip.hasAttribute("hidden"), true);
  dispose();
});

test("CandlestickChart: a window keeps the latest candles; a live append slides; leaving candles go (animate false)", () => {
  const data = signal(make(10));
  const [el, dispose] = mount(() => h(CandlestickChart, { data, window: 6, width: 400, animate: false }));
  assert.equal(el.querySelectorAll(".m-candle").length, 6);
  data.set(make(11));
  const keys = [...el.querySelectorAll(".m-candle")].map((c) => c.getAttribute("data-key"));
  assert.equal(keys.length, 6);
  assert.equal(keys[0], String(day(5).getTime()));
  assert.equal(keys[5], String(day(10).getTime()));
  dispose();
});

test("CandlestickChart: animated exit keeps a leaving candle until it has shrunk", async () => {
  const data = signal(make(4));
  const [el, dispose] = mount(() => h(CandlestickChart, { data, width: 400, animate: { duration: 40, easing: "out" } }));
  await wait(150);
  data.set(make(3));
  assert.equal(el.querySelectorAll(".m-candle-leaving").length, 1);
  await wait(250);
  assert.equal(el.querySelectorAll(".m-candle").length, 3);
  dispose();
});

test("CandlestickChart: empty text, marks, navigator, shared crosshair", () => {
  const [el, dispose] = mount(() => [
    h(CandlestickChart, { data: [], empty: "No trades", width: 300 }),
    h(CandlestickChart, { data: make(20), marks: [{ y: 105, label: "Target" }, { y: [100, 102] }], navigator: true, sync: "s1", width: 400, animate: false, class: "a" }),
    h(CandlestickChart, { data: make(20), sync: "s1", width: 400, animate: false, class: "b" }),
  ]);
  assert.ok(el.textContent.includes("No trades"));
  const a = el.querySelector(".a"), b = el.querySelector(".b");
  assert.ok(a.textContent.includes("Target"));
  assert.ok(a.querySelector(".m-chart-ref-hb"));
  assert.ok(a.querySelector(".m-chart-nav"));
  key(a, "ArrowRight");
  assert.equal(b.querySelector(".m-candle-cross").getAttribute("visibility"), "visible");
  key(a, "Escape");
  assert.equal(b.querySelector(".m-candle-cross").getAttribute("visibility"), "hidden");
  dispose();
});
