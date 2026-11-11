import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";
const { document } = installDom();
const { signal, h, render, setLocale } = await import("../src/index.js");
const C = await import("../src/charts/index.ts");
const { scaleLinear, scaleTime, scaleBand, niceTicks, timeTicks, lttb, pieLayout, heatLevel } = C;

setLocale("en");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const key = (el, k) => el.dispatchEvent(new Event("keydown", { key: k, bubbles: true, cancelable: true }));
const all = (el) => { const out = []; const walk = (n) => { if (n.nodeType === 1) out.push(n); n.childNodes.forEach(walk); }; walk(el); return out; };
const sales = () => [
  { day: "2026-03-01", income: 10, expense: 4 },
  { day: "2026-03-02", income: 14, expense: 6 },
  { day: "2026-03-03", income: 9, expense: 7 },
  { day: "2026-03-04", income: 20, expense: 5 },
];

test("niceTicks and linear / band / time scales", () => {
  assert.deepEqual(niceTicks(0, 97, 5), { min: 0, max: 100, step: 20, ticks: [0, 20, 40, 60, 80, 100] });
  assert.deepEqual(niceTicks(0.1, 0.33, 3).ticks, [0.1, 0.2, 0.3, 0.4]);
  assert.deepEqual(niceTicks(5, 5, 4).ticks.length > 1, true);
  const x = scaleLinear([0, 10], [0, 200]);
  assert.equal(x(5), 100);
  assert.equal(x.invert(50), 2.5);
  assert.deepEqual(x.ticks(5), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(scaleLinear([3, 97], [0, 1]).nice(5).domain, [0, 100]);
  const b = scaleBand(["a", "b", "c", "d"], [0, 100], { paddingInner: 0, paddingOuter: 0 });
  assert.equal(b.bandwidth, 25);
  assert.equal(b("c"), 50);
  assert.equal(b.center("a"), 12.5);
  assert.equal(b.invert(80), "d");
  const t0 = new Date(2026, 0, 1), t1 = new Date(2026, 0, 31);
  const t = scaleTime([t0, t1], [0, 300]);
  assert.equal(t(t0), 0);
  assert.equal(t.invert(300).getTime(), t1.getTime());
  const ticks = t.ticks(5);
  assert.ok(ticks.length >= 3 && ticks.length <= 6, `ticks ${ticks.length}`);
  for (const v of ticks) assert.equal(new Date(v).getHours(), 0, "day ticks fall on local midnight");
  const months = timeTicks(new Date(2025, 0, 15), new Date(2026, 0, 15), 6);
  for (const v of months) assert.equal(new Date(v).getDate(), 1, "month ticks fall on the 1st");
});

test("lttb keeps first and last points and returns the threshold length", () => {
  const pts = Array.from({ length: 1000 }, (_, i) => [i, Math.sin(i / 20) * 100 + (i === 500 ? 400 : 0)]);
  const out = lttb(pts, 50);
  assert.equal(out.length, 50);
  assert.equal(out[0], pts[0]);
  assert.equal(out[49], pts[999]);
  assert.ok(out.includes(pts[500]), "the spike survives");
  for (let i = 1; i < out.length; i++) assert.ok(out[i][0] > out[i - 1][0], "x stays sorted");
  assert.equal(lttb(pts.slice(0, 10), 50).length, 10);
  assert.equal(lttb([{ x: 0, y: 0 }, { x: 1, y: 5 }, { x: 2, y: 1 }, { x: 3, y: 2 }], 3).length, 3);
});

test("LineChart renders one path per series and updates only the changed path", () => {
  const data = signal(sales());
  const { el } = mount(() => h(C.LineChart, { data, x: "day", y: ["income", "expense"], width: 400, height: 200, title: "Sales", description: "Daily" }));
  const svg = el.querySelector("svg");
  assert.equal(svg.getAttribute("role"), "img");
  const [tid, did] = svg.getAttribute("aria-labelledby").split(" ");
  assert.equal(el.querySelector(`#${tid}`).textContent, "Sales");
  assert.equal(el.querySelector(`#${did}`).textContent, "Daily");
  const paths = el.querySelectorAll("path.hm-chart-line");
  assert.equal(paths.length, 2);
  assert.match(paths[0].getAttribute("d"), /^M[\d.]+,[\d.]+(L[\d.]+,[\d.]+){3}$/);
  const [inc, exp] = paths;
  const writes = new Map([[inc, 0], [exp, 0]]);
  for (const p of [inc, exp]) { const orig = p.setAttribute.bind(p); p.setAttribute = (k, v) => { writes.set(p, writes.get(p) + 1); orig(k, v); }; }
  const before = exp.getAttribute("d");
  data.set(sales().map((r, i) => (i === 2 ? { ...r, expense: 8 } : r))); // only "expense" changes; y domain stays [0..20]
  const after = el.querySelectorAll("path.hm-chart-line");
  assert.equal(after[0], inc, "same element identity");
  assert.equal(after[1], exp);
  assert.equal(writes.get(inc), 0, "unchanged series path is not touched");
  assert.equal(writes.get(exp), 1);
  assert.notEqual(exp.getAttribute("d"), before);
});

test("AreaChart stacked: upper series sits on the lower one", () => {
  const { el } = mount(() => h(C.AreaChart, { data: [{ x: 0, a: 1, b: 1 }, { x: 1, a: 2, b: 2 }], x: "x", y: ["a", "b"], stacked: true, width: 300, height: 200 }));
  const areas = el.querySelectorAll("path.hm-chart-area");
  assert.equal(areas.length, 2);
  const nums = (d) => d.match(/-?[\d.]+/g).map(Number);
  const a = nums(el.querySelectorAll("path.hm-chart-line")[0].getAttribute("d"));
  const bArea = nums(areas[1].getAttribute("d"));
  // the bottom edge of b (last two points, reversed) equals the top line of a
  assert.deepEqual(bArea.slice(-4), [a[2], a[3], a[0], a[1]]);
});

test("BarChart grouped and stacked geometry", () => {
  const data = [{ c: "A", x: 2, y: 3 }, { c: "B", x: 4, y: 1 }];
  const g = mount(() => h(C.BarChart, { data, x: "c", y: ["x", "y"], width: 400, height: 200 })).el;
  const gb = g.querySelectorAll("rect.hm-chart-bar").map((r) => ({ x: +r.getAttribute("x"), y: +r.getAttribute("y"), w: +r.getAttribute("width"), h: +r.getAttribute("height") }));
  assert.equal(gb.length, 4);
  assert.equal(gb[0].w, gb[1].w);
  assert.ok(Math.abs(gb[1].x - (gb[0].x + gb[0].w)) < 0.2, "grouped bars sit side by side");
  assert.ok(Math.abs(gb[0].y + gb[0].h - (gb[1].y + gb[1].h)) < 0.2, "same baseline");
  assert.ok(Math.abs(gb[1].h / gb[0].h - 1.5) < 0.01, "heights proportional to values");

  const s = mount(() => h(C.BarChart, { data, x: "c", y: ["x", "y"], stacked: true, width: 400, height: 200 })).el;
  const sb = s.querySelectorAll("rect.hm-chart-bar").map((r) => ({ x: +r.getAttribute("x"), y: +r.getAttribute("y"), w: +r.getAttribute("width"), h: +r.getAttribute("height") }));
  assert.equal(sb[0].x, sb[1].x, "stacked bars share x");
  assert.ok(Math.abs(sb[1].y + sb[1].h - sb[0].y) < 0.2, "second bar sits on the first");
  assert.ok(sb[0].w > gb[0].w, "stacked bars use the whole band");

  const hz = mount(() => h(C.BarChart, { data, x: "c", y: "x", horizontal: true, width: 400, height: 200 })).el;
  const hb = hz.querySelectorAll("rect.hm-chart-bar").map((r) => +r.getAttribute("width"));
  assert.ok(Math.abs(hb[1] / hb[0] - 2) < 0.01, "horizontal bar lengths follow values");
});

test("PieChart: slices sum to a full circle; donut shows the total", () => {
  const lay = pieLayout([1, 2, 3, 4]);
  assert.ok(Math.abs(lay[lay.length - 1].end - Math.PI * 2) < 1e-9);
  assert.ok(Math.abs(lay.reduce((a, s) => a + (s.end - s.start), 0) - Math.PI * 2) < 1e-9);
  assert.equal(lay[0].start, 0);
  const data = [{ label: "a", value: 1 }, { label: "b", value: 3 }];
  const { el } = mount(() => h(C.PieChart, { data, donut: true, width: 200, height: 200, format: "number" }));
  assert.equal(el.querySelectorAll("path.hm-chart-slice").length, 2);
  assert.equal(el.querySelector(".hm-chart-center").textContent, "4");
  const one = mount(() => h(C.PieChart, { data: [{ label: "only", value: 5 }], width: 200, height: 200 })).el;
  assert.match(one.querySelector("path.hm-chart-slice").getAttribute("d"), /A.*A/, "a single slice is a full circle");
});

test("Stat: delta sign, arrow and classes", () => {
  const val = signal(120);
  const { el } = mount(() => h(C.Stat, { label: "Revenue", value: val, previous: 100, format: ["money", "USD"] }));
  const delta = () => el.querySelector(".hm-stat-delta");
  assert.equal(el.querySelector(".hm-stat-value").textContent, "$120.00");
  assert.ok(delta().classList.contains("hm-stat-up") && delta().classList.contains("hm-stat-good"));
  assert.equal(el.querySelector(".hm-stat-delta-value").textContent, "+20%");
  assert.equal(el.querySelector(".hm-stat-arrow").textContent, "▲");
  val.set(80);
  assert.ok(delta().classList.contains("hm-stat-down") && delta().classList.contains("hm-stat-bad"));
  assert.equal(el.querySelector(".hm-stat-delta-value").textContent, "−20%");
  const inv = mount(() => h(C.Stat, { label: "Cost", value: 5, delta: -0.1, invert: true })).el;
  assert.ok(inv.querySelector(".hm-stat-delta").classList.contains("hm-stat-good"), "invert: down is good");
  const flat = mount(() => h(C.Stat, { label: "Users", value: 5 })).el;
  assert.equal(flat.querySelector(".hm-stat-delta"), null, "no delta without previous/delta");
});

test("Heatmap: cell count and levels; calendar mode; ProgressRing and BarList", () => {
  const data = [];
  for (let d = 0; d < 7; d++) for (let hr = 0; hr < 24; hr++) data.push({ x: hr, y: d, value: (d * hr) % 7 });
  const { el } = mount(() => h(C.Heatmap, { data, width: 600 }));
  assert.equal(el.querySelectorAll("rect.hm-heat-cell").length, 7 * 24);
  assert.equal(heatLevel(0, 10), 0);
  assert.equal(heatLevel(10, 10), 4);
  assert.equal(heatLevel(1, 10), 1);
  const cal = mount(() => h(C.Heatmap, { data: [{ date: "2026-03-02T12:00:00", n: 3 }], x: "date", value: "n", calendar: { weeks: 12 }, width: 600 })).el;
  assert.equal(cal.querySelectorAll("rect.hm-heat-cell").length, 12 * 7);
  assert.equal(cal.querySelectorAll("rect.hm-heat-4").length, 1);

  const ring = mount(() => h(C.ProgressRing, { value: 72, label: "Score" })).el.querySelector("svg");
  assert.ok(ring.classList.contains("hm-ring-mid"));
  assert.equal(ring.getAttribute("aria-label"), "Score: 72 of 100");

  const list = mount(() => h(C.BarList, { data: [{ label: "a", value: 5 }, { label: "b", value: 10 }, { label: "c", value: 1 }], limit: 2 })).el;
  assert.deepEqual(list.querySelectorAll(".hm-barlist-label").map((x) => x.textContent), ["b", "a"]);
  assert.deepEqual(list.querySelectorAll("rect").map((r) => r.getAttribute("width")), ["100%", "50%"]);
});

test("legend toggle hides and shows a series (keyboard accessible buttons)", () => {
  const { el } = mount(() => h(C.LineChart, { data: sales(), x: "day", y: ["income", "expense"], series: ["Income", "Expense"], width: 400, height: 200 }));
  const buttons = el.querySelectorAll(".hm-chart-legend-item");
  assert.deepEqual(buttons.map((b) => b.tagName), ["BUTTON", "BUTTON"]);
  assert.equal(buttons[1].textContent, "Expense");
  buttons[1].click();
  assert.equal(el.querySelectorAll("path.hm-chart-line").length, 1);
  assert.equal(buttons[1].getAttribute("aria-pressed"), "false");
  assert.ok(buttons[1].classList.contains("hm-chart-off"));
  buttons[1].click();
  assert.equal(el.querySelectorAll("path.hm-chart-line").length, 2);
  const pie = mount(() => h(C.PieChart, { data: [{ label: "a", value: 1 }, { label: "b", value: 3 }], width: 200, height: 200 })).el;
  pie.querySelectorAll(".hm-chart-legend-item")[0].click();
  assert.equal(pie.querySelectorAll("path.hm-chart-slice").length, 1);
});

test("keyboard navigation moves the focus marker and updates the tooltip; onSelect", () => {
  const picked = [];
  const { el } = mount(() => h(C.LineChart, { data: sales(), x: "day", y: ["income"], format: ["money", "USD"], width: 400, height: 200, onSelect: (p) => picked.push(p) }));
  const svg = el.querySelector("svg");
  const focus = el.querySelector(".hm-chart-focus");
  const tip = el.querySelector(".hm-chart-tooltip");
  assert.equal(svg.getAttribute("tabindex"), "0");
  assert.equal(focus.getAttribute("visibility"), "hidden");
  key(svg, "ArrowRight");
  assert.equal(focus.getAttribute("visibility"), "visible");
  const x0 = Number(/translate\(([\d.]+)/.exec(focus.getAttribute("transform"))[1]);
  assert.equal(tip.hasAttribute("hidden"), false);
  assert.match(tip.textContent, /\$10\.00/);
  key(svg, "ArrowRight");
  const x1 = Number(/translate\(([\d.]+)/.exec(focus.getAttribute("transform"))[1]);
  assert.ok(x1 > x0, "marker moved right");
  assert.match(tip.textContent, /\$14\.00/);
  key(svg, "End");
  assert.match(tip.textContent, /\$20\.00/);
  key(svg, "Home");
  assert.match(tip.textContent, /\$10\.00/);
  key(svg, "Enter");
  assert.equal(picked.length, 1);
  assert.equal(picked[0].index, 0);
  assert.equal(picked[0].values.income, 10);
  key(svg, "Escape");
  assert.equal(tip.hasAttribute("hidden"), true);
  // tooltip position is set through CSSOM, never a style attribute
  key(svg, "ArrowRight");
  assert.ok(tip.style.getPropertyValue("left").endsWith("px"));
});

test("zoom: drag selects an x range, double click resets", () => {
  const data = Array.from({ length: 100 }, (_, i) => ({ i, v: i % 10 }));
  const { el } = mount(() => h(C.LineChart, { data, x: "i", y: "v", zoom: true, width: 600, height: 200 }));
  const overlay = el.querySelector(".hm-chart-overlay");
  const left = Number(overlay.getAttribute("x")), w = Number(overlay.getAttribute("width"));
  const ptr = (type, frac) => overlay.dispatchEvent(new Event(type, { bubbles: true, clientX: left + w * frac, clientY: 50 }));
  const ticks = () => el.querySelectorAll(".hm-chart-axis-x .hm-chart-tick text").map((t) => Number(t.textContent));
  ptr("pointerdown", 0.2); ptr("pointermove", 0.5); ptr("pointerup", 0.5);
  assert.ok(Math.min(...ticks()) >= 19 && Math.max(...ticks()) <= 51, `zoomed ticks ${ticks()}`);
  assert.equal(el.querySelector(".hm-chart-reset").hasAttribute("hidden"), false);
  overlay.dispatchEvent(new Event("dblclick", { bubbles: true }));
  assert.ok(Math.max(...ticks()) >= 80, `reset ticks ${ticks()}`);
});

test("hidden data table mirrors the data; formats via pipes", () => {
  const { el } = mount(() => h(C.LineChart, { data: sales(), x: "day", y: ["income", "expense"], series: { income: "Income", expense: "Expense" }, format: ["money", "USD"], xFormat: "date", title: "Sales", width: 400, height: 200 }));
  const table = el.querySelector("table.hm-sr-only");
  assert.ok(table);
  assert.equal(table.querySelector("caption").textContent, "Sales");
  assert.deepEqual(table.querySelectorAll("thead th").map((t) => t.textContent), ["day", "Income", "Expense"]);
  const rows = table.querySelectorAll("tbody tr");
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0].childNodes.filter((n) => n.nodeType === 1).map((c) => c.textContent), ["Mar 1, 2026", "$10.00", "$4.00"]);
  const yLabels = el.querySelectorAll(".hm-chart-axis-y text").map((t) => t.textContent);
  assert.ok(yLabels.every((l) => l.startsWith("$")), `money ticks ${yLabels}`);
  const pct = mount(() => h(C.BarChart, { data: [{ k: "a", v: 0.25 }], x: "k", y: "v", format: "percent", width: 300, height: 150 })).el;
  assert.ok(pct.querySelectorAll(".hm-chart-axis-y text").some((t) => t.textContent === "20%"));
  const fn = mount(() => h(C.BarChart, { data: [{ k: "a", v: 3 }], x: "k", y: "v", format: (v) => `${v} pts`, width: 300, height: 150 })).el;
  assert.equal(fn.querySelector("tbody td").textContent, "3 pts");
});

test("large data is downsampled with LTTB (maxPoints)", () => {
  const data = Array.from({ length: 20000 }, (_, i) => ({ t: i, v: Math.sin(i / 100) }));
  const { el } = mount(() => h(C.LineChart, { data, x: "t", y: "v", width: 500, height: 200 }));
  const segs = el.querySelector("path.hm-chart-line").getAttribute("d").split(/[ML]/).filter(Boolean).length;
  assert.ok(segs <= 1000 && segs > 100, `points drawn: ${segs}`);
  const capped = mount(() => h(C.LineChart, { data, x: "t", y: "v", width: 500, height: 200, maxPoints: 50 })).el;
  assert.equal(capped.querySelector("path.hm-chart-line").getAttribute("d").split(/[ML]/).filter(Boolean).length, 50);
});

test("empty state and CSP: no style attribute anywhere", () => {
  const { el } = mount(() => [
    h(C.LineChart, { data: [], y: "v", width: 300, height: 150, empty: "Nothing yet" }),
    h(C.LineChart, { data: sales(), x: "day", y: ["income", "expense"], colors: ["#123456", "#abcdef"], width: 300, height: 150 }),
    h(C.AreaChart, { data: sales(), x: "day", y: ["income", "expense"], stacked: true, zoom: true }),
    h(C.BarChart, { data: sales(), x: "day", y: ["income", "expense"], stacked: true, horizontal: true }),
    h(C.PieChart, { data: [{ label: "a", value: 2 }], donut: 0.5, colors: ["red"] }),
    h(C.Sparkline, { data: [1, 3, 2, 5], area: true }),
    h(C.Stat, { label: "x", value: 3, delta: 0.5, spark: [1, 2, 3] }),
    h(C.ProgressRing, { value: 30 }),
    h(C.BarList, { data: [{ label: "a", value: 1 }], onSelect: () => {} }),
    h(C.Heatmap, { data: [{ x: 1, y: 1, value: 1 }] }),
  ]);
  assert.equal(el.querySelector(".hm-chart-empty").textContent, "Nothing yet");
  const nodes = all(el);
  assert.ok(nodes.length > 100);
  for (const n of nodes) assert.equal(n.getAttribute("style"), null, `<${n.localName} class="${n.getAttribute("class")}"> has a style attribute`);
  const colored = el.querySelectorAll(".hm-chart")[1].querySelector("g.hm-chart-series");
  assert.equal(colored.style.getPropertyValue("--hm-c"), "#123456", "colors override via CSSOM custom property");
});
