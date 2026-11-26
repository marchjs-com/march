import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { ChoroplethMap, loadTurkey, regionKey, pathBox, projectGeo } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const regions = (el) => el.querySelectorAll(".m-choropleth-region");
const region = (el, id) => el.querySelector(`.m-choropleth-region[data-id="${id}"]`);
const key = (el, k) => el.querySelector("svg").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
// a 3 × 1 strip of squares: west, middle, east
const SQ = [
  { id: "w", name: "West", d: "M0 0h10v10h-10z" },
  { id: "m", name: "Middle", d: "M10 0h10v10h-10z" },
  { id: "e", name: "East", d: "M20 0h10v10h-10z" },
];

test("ChoroplethMap: Turkey loads lazily (a skeleton first), 81 provinces; rows match by plate code, ISO id or name", async () => {
  const [el, dispose] = mount(() => h(ChoroplethMap, { width: 500, animate: false, data: [{ id: 34, value: 10 }, { id: "TR-06", value: 5 }, { id: "IZMIR", value: 1 }, { id: "Sanliurfa", value: 2 }, { id: "Afyon", value: 3 }] }));
  assert.ok(el.querySelector(".m-choropleth-skeleton"), "a skeleton while the map loads");
  await loadTurkey(); await tick();
  assert.equal(el.querySelector(".m-choropleth-skeleton"), null);
  assert.equal(regions(el).length, 81);
  for (const id of ["TR-34", "TR-06", "TR-35", "TR-63", "TR-03"]) assert.ok(!region(el, id).classList.contains("m-choropleth-none"), id);
  assert.ok(region(el, "TR-01").classList.contains("m-choropleth-none"), "no data: hatch");
  assert.ok(region(el, "TR-01").style.getPropertyValue("fill").includes("url("));
  assert.equal(el.querySelectorAll("table tbody tr").length, 81);
  assert.equal(regionKey("İSTANBUL"), regionKey("istanbul"));
  assert.equal(regionKey("034"), "34");
  dispose();
});

test("ChoroplethMap: custom shapes, value → colour, legend ticks, data table, empty", () => {
  const data = signal([{ id: "w", value: 0 }, { id: "m", value: 50 }, { id: "e", value: 100 }]);
  const [el, dispose] = mount(() => h(ChoroplethMap, { shapes: SQ, data, width: 300, animate: false, title: "Strip" }));
  assert.equal(regions(el).length, 3);
  assert.equal(el.querySelector("svg title").textContent, "Strip");
  assert.ok(region(el, "e").style.getPropertyValue("fill").includes("--m-chart-hi"));
  assert.notEqual(region(el, "w").style.getPropertyValue("fill"), region(el, "e").style.getPropertyValue("fill"));
  const ticks = [...el.querySelectorAll(".m-choropleth-ticks span")].map((s) => s.textContent);
  assert.deepEqual(ticks, ["0", "100"]);
  assert.deepEqual([...el.querySelectorAll("table tbody tr")].map((r) => r.textContent), ["West0", "Middle50", "East100"]);
  data.set([]);
  assert.ok(el.querySelector(".m-chart-empty"));
  dispose();
});

test("ChoroplethMap: bins give class swatches; a class click dims the others", () => {
  const [el, dispose] = mount(() => h(ChoroplethMap, { shapes: SQ, data: [{ id: "w", value: 5 }, { id: "m", value: 15 }, { id: "e", value: 30 }], bins: [10, 20], width: 300, animate: false }));
  const cls = el.querySelectorAll(".m-choropleth-class");
  assert.deepEqual([...cls].map((c) => c.textContent), ["< 10", "10–20", "≥ 20"]);
  cls[2].dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(cls[2].getAttribute("aria-pressed"), "true");
  assert.ok(region(el, "w").classList.contains("m-choropleth-dim"));
  assert.ok(!region(el, "e").classList.contains("m-choropleth-dim"));
  dispose();
});

test("ChoroplethMap: keyboard moves to the nearest region in the arrow's direction; Enter selects, Escape clears; tooltip follows", () => {
  let got = null;
  const [el, dispose] = mount(() => h(ChoroplethMap, { shapes: SQ, data: [{ id: "m", value: 7 }], width: 300, animate: false, onSelect: (p) => { got = p; } }));
  key(el, "ArrowRight");
  const first = el.querySelector(".m-chart-active").dataset.id;
  assert.equal(first, "m", "the first arrow picks the region nearest the centre");
  key(el, "ArrowRight");
  assert.equal(el.querySelector(".m-chart-active").dataset.id, "e");
  key(el, "ArrowLeft"); key(el, "ArrowLeft");
  assert.equal(el.querySelector(".m-chart-active").dataset.id, "w");
  key(el, "ArrowRight");
  assert.ok(!el.querySelector(".m-chart-tooltip").hidden);
  assert.ok(el.querySelector(".m-chart-tooltip").textContent.includes("Middle"));
  assert.ok(el.querySelector(".m-choropleth-raised"), "the active region is raised");
  key(el, "Enter");
  assert.equal(got?.id, "m");
  assert.equal(got?.value, 7);
  key(el, "Escape");
  assert.ok(el.querySelector(".m-chart-tooltip").hidden);
  assert.equal(el.querySelector(".m-choropleth-selected"), null);
  dispose();
});

test("ChoroplethMap: click selects; tooltip false hides it; labels fit or hide", () => {
  let got = null;
  const [el, dispose] = mount(() => h(ChoroplethMap, { shapes: SQ, data: [{ id: "w", value: 1 }], width: 600, height: 200, tooltip: false, labels: "value", animate: false, onSelect: (p) => { got = p; } }));
  region(el, "w").dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(got?.name, "West");
  region(el, "w").dispatchEvent(new Event("pointerenter"));
  assert.ok(el.querySelector(".m-chart-tooltip").hidden);
  assert.deepEqual([...el.querySelectorAll(".m-choropleth-label")].map((t) => t.textContent), ["1"], "only regions with a value get a value label");
  dispose();
});

test("ChoroplethMap: focus fits the view to the regions; zoom buttons and reset", () => {
  const focus = signal(null);
  const [el, dispose] = mount(() => h(ChoroplethMap, { shapes: SQ, data: [], width: 300, height: 100, animate: false, focus }));
  const tf = () => el.querySelector(".m-choropleth-regions").getAttribute("transform");
  const full = tf();
  focus.set(["e"]);
  assert.notEqual(tf(), full);
  assert.match(tf(), /scale\((\d+\.?\d*)\)/);
  focus.set(null);
  assert.equal(tf(), full);
  el.querySelector(".m-choropleth-zoom-in").dispatchEvent(new Event("click", { bubbles: true }));
  assert.notEqual(tf(), full);
  assert.ok(!el.querySelector(".m-choropleth-zoom-reset").hidden);
  el.querySelector(".m-choropleth-zoom-reset").dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(tf(), full);
  dispose();
});

test("ChoroplethMap: animate false draws final colours at once; presence removes a leaving shape at once", () => {
  const shapes = signal(SQ);
  const [el, dispose] = mount(() => h(ChoroplethMap, { shapes, data: [{ id: "w", value: 1 }, { id: "e", value: 2 }], width: 300, animate: false }));
  assert.equal(region(el, "w").getAttribute("opacity"), null, "no entrance fade");
  shapes.set(SQ.slice(0, 2));
  assert.equal(regions(el).length, 2);
  dispose();
});

test("ChoroplethMap: animated entrance starts faded; a GeoJSON FeatureCollection is projected", () => {
  const fc = { type: "FeatureCollection", features: [
    { id: "a", properties: { name: "A" }, geometry: { type: "Polygon", coordinates: [[[26, 36], [30, 36], [30, 40], [26, 40], [26, 36]]] } },
    { id: "b", properties: { name: "B" }, geometry: { type: "MultiPolygon", coordinates: [[[[30, 36], [34, 36], [34, 40], [30, 40], [30, 36]]]] } },
  ] };
  const p = projectGeo(fc, 100);
  assert.equal(p.shapes.length, 2);
  assert.equal(p.viewBox[0], 100);
  assert.deepEqual(pathBox(p.shapes[1].d).slice(0, 3).map(Math.round), [50, 0, 100]);
  const [el, dispose] = mount(() => h(ChoroplethMap, { shapes: fc, data: [{ id: "A", value: 1 }], width: 300 }));
  assert.equal(regions(el).length, 2);
  assert.equal(region(el, "a").getAttribute("opacity"), "0", "regions fade in");
  dispose();
});
