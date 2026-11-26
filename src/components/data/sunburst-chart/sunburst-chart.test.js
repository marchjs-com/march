import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { SunburstChart } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const key = (el, k) => el.querySelector("svg").dispatchEvent(Object.assign(new Event("keydown", { bubbles: true }), { key: k }));
const click = (n) => n.dispatchEvent(new Event("click", { bubbles: true }));
const tree = [
  { label: "Food", children: [{ label: "Fruit", children: [{ label: "Apple", value: 3 }, { label: "Pear", value: 1 }] }, { label: "Bread", value: 4 }] },
  { label: "Home", children: [{ label: "Rent", value: 10 }, { label: "Power", value: 2 }] },
];
const arcs = (el) => el.querySelectorAll(".m-sunburst-node");
const named = (el, label) => [...arcs(el)].find((n) => n.getAttribute("data-label") === label);

test("SunburstChart: one arc per node with a value; the center shows the total; the table lists every node; live data", () => {
  const data = signal(tree);
  const [el, dispose] = mount(() => h(SunburstChart, { data, width: 300, height: 300, animate: false }));
  assert.equal(arcs(el).length, 8);
  assert.equal(el.querySelector(".m-sunburst-center-label").textContent, "All");
  assert.equal(el.querySelector(".m-sunburst-center-value").textContent, "20");
  assert.equal(el.querySelectorAll("table tbody tr").length, 8);
  data.set(tree.slice(1));
  assert.equal(arcs(el).length, 3);
  assert.equal(el.querySelector(".m-sunburst-center-value").textContent, "12");
  dispose();
});

test("SunburstChart: animate false: angles follow the values; maxDepth limits the rings", () => {
  const [el, dispose] = mount(() => [h(SunburstChart, { data: [{ label: "A", value: 1 }, { label: "B", value: 1 }], padAngle: 0, labels: false, width: 200, height: 200, animate: false }),
    h(SunburstChart, { data: tree, maxDepth: 1, width: 200, height: 200, animate: false })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  // A is the right half: its outer edge starts at the top (radius 96 - 0.5 around 100,100)
  assert.ok(a.querySelector(".m-sunburst-arc").getAttribute("d").startsWith("M100,4.5A"));
  assert.equal(arcs(b).length, 2);
  dispose();
});

test("SunburstChart: click zooms in, the path and the center follow; the center and Escape zoom out; a leaf is selected only", async () => {
  const zooms = [], picks = [];
  const [el, dispose] = mount(() => h(SunburstChart, { data: tree, width: 300, height: 300, animate: false, onDrill: (p) => zooms.push(p?.label ?? null), onSelect: (p) => picks.push(p.label) }));
  // the path bar (Breadcrumbs) is its own chunk, loaded on first use
  await import("../../navigation/breadcrumbs/index.ts"); await new Promise((r) => setTimeout(r, 0));
  click(named(el, "Food"));
  assert.deepEqual(zooms, ["Food"]);
  assert.equal(el.querySelector(".m-sunburst-center-label").textContent, "Food");
  assert.equal(arcs(el).length, 4);
  const path = el.querySelector(".m-sunburst-crumbs").textContent;
  assert.ok(path.includes("All") && path.includes("Food"));
  click(el.querySelector(".m-sunburst-center"));
  assert.equal(el.querySelector(".m-sunburst-center-label").textContent, "All");
  assert.deepEqual(zooms, ["Food", null]);
  click(named(el, "Food"));
  key(el, "Escape");
  assert.equal(el.querySelector(".m-sunburst-center-label").textContent, "All");
  click(named(el, "Bread"));
  assert.equal(picks.at(-1), "Bread");
  assert.equal(el.querySelector(".m-sunburst-center-label").textContent, "All");
  dispose();
});

test("SunburstChart: keyboard: arrows along a ring and down a level, the tooltip follows, Enter zooms, Backspace goes up", () => {
  const [el, dispose] = mount(() => h(SunburstChart, { data: tree, width: 300, height: 300, animate: false }));
  const activeLabel = () => el.querySelector(".m-sunburst-node.m-chart-active")?.getAttribute("data-label");
  key(el, "ArrowRight");
  assert.equal(activeLabel(), "Food");
  const tipEl = el.querySelector(".m-chart-tooltip");
  assert.equal(tipEl.hidden, false);
  key(el, "ArrowRight");
  assert.equal(activeLabel(), "Home");
  key(el, "ArrowDown");
  assert.equal(activeLabel(), "Rent");
  key(el, "ArrowUp");
  key(el, "Enter");
  assert.equal(el.querySelector(".m-sunburst-center-label").textContent, "Home");
  key(el, "Backspace");
  assert.equal(el.querySelector(".m-sunburst-center-label").textContent, "All");
  dispose();
});

test("SunburstChart: legend toggles a branch; breadcrumb, center and tooltip off; empty", () => {
  const data = signal(tree);
  const [el, dispose] = mount(() => h(SunburstChart, { data, breadcrumbs: false, center: false, tooltip: false, empty: "Nothing", width: 300, height: 300, animate: false }));
  assert.equal(el.querySelector(".m-sunburst-crumbs"), null);
  assert.equal(el.querySelector(".m-sunburst-center"), null);
  click(el.querySelectorAll(".m-chart-legend-item")[1]);
  assert.equal(arcs(el).length, 5);
  key(el, "ArrowRight");
  assert.equal(el.querySelector(".m-chart-tooltip").hidden, true);
  data.set([]);
  assert.ok(el.querySelector(".m-chart-empty").textContent.includes("Nothing"));
  dispose();
});

test("SunburstChart: a removed node collapses while animated, goes at once without animation", () => {
  const data = signal(tree);
  const [el, dispose] = mount(() => [h(SunburstChart, { data, width: 300, height: 300, animate: { enter: false } }), h(SunburstChart, { data, width: 300, height: 300, animate: false })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  data.set([tree[0], { label: "Home", children: [{ label: "Rent", value: 10 }] }]);
  assert.equal(arcs(a).length, 8);
  assert.equal(a.querySelectorAll(".m-sunburst-node.m-chart-leaving").length, 1);
  assert.equal(arcs(b).length, 7);
  dispose();
});

test("SunburstChart: focus drills from outside; childrenOf, id and drill false", () => {
  const focus = signal(null);
  const picks = [];
  const rows = [{ name: "A", kids: [{ name: "A1", n: 2 }, { name: "A2", n: 3 }] }, { name: "B", kids: [{ name: "B1", n: 5 }] }];
  const [el, dispose] = mount(() => [h(SunburstChart, { data: rows, childrenOf: "kids", value: "n", label: "name", id: (d) => d.name, focus, width: 300, height: 300, animate: false }),
    h(SunburstChart, { data: rows, childrenOf: "kids", value: "n", label: "name", drill: false, onSelect: (p) => picks.push(p.label), width: 300, height: 300, animate: false })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  assert.equal(arcs(a).length, 5);
  focus.set("A");
  assert.equal(a.querySelector(".m-sunburst-center-label").textContent, "A");
  assert.equal(arcs(a).length, 2);
  focus.set("A1"); // a leaf: no zoom
  assert.equal(a.querySelector(".m-sunburst-center-label").textContent, "A");
  focus.set(null);
  assert.equal(a.querySelector(".m-sunburst-center-label").textContent, "All");
  click(named(b, "A"));
  assert.deepEqual(picks, ["A"]);
  assert.equal(b.querySelector(".m-sunburst-center-label").textContent, "All");
  dispose();
});
