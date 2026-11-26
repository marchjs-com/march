import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { Treemap } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const tree = [
  { name: "Fruit", children: [{ name: "Apple", value: 40 }, { name: "Pear", value: 20 }] },
  { name: "Veg", children: [{ name: "Leek", value: 30 }, { name: "Kale", value: 10 }] },
];
const key = (type, k) => new KeyboardEvent("keydown", { key: k, bubbles: true });
const leaves = (el) => el.querySelectorAll(".m-treemap-leaf");
const groups = (el) => el.querySelectorAll(".m-treemap-group");

test("Treemap: depth 2 draws groups with their leaves; depth 1 flat tiles; values on tiles", () => {
  const [el, dispose] = mount(() => [h(Treemap, { data: tree, width: 600, height: 300, animate: false }), h(Treemap, { data: tree, depth: 1, width: 600, height: 300, animate: false })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  assert.equal(groups(a).length, 2);
  assert.equal(leaves(a).length, 4);
  assert.equal(groups(b).length, 0);
  assert.equal(leaves(b).length, 2);
  assert.ok(a.textContent.includes("Apple"));
  assert.equal(a.querySelectorAll("table tbody tr").length, 6);
  dispose();
});

test("Treemap: animate false gives exact squarified geometry, areas follow the values", () => {
  const [el, dispose] = mount(() => h(Treemap, { data: tree, depth: 1, padding: 0, width: 400, height: 200, animate: false }));
  const rects = [...el.querySelectorAll(".m-treemap-leaf rect")].map((r) => Number(r.getAttribute("width")) * Number(r.getAttribute("height")));
  assert.equal(Math.round(rects.reduce((x, y) => x + y, 0)), 80000);
  assert.ok(Math.abs(rects[0] - 48000) < 2 && Math.abs(rects[1] - 32000) < 2);
  dispose();
});

test("Treemap: click on a group drills in, crumbs show the path, Escape goes back up; onDrill reports it", async () => {
  const drills = [];
  const [el, dispose] = mount(() => h(Treemap, { data: tree, width: 600, height: 300, animate: false, onDrill: (p) => drills.push(p?.label ?? null) }));
  // the path bar (Breadcrumbs) is its own chunk, loaded on first use
  await import("../../navigation/breadcrumbs/index.ts"); await new Promise((r) => setTimeout(r, 0));
  el.querySelector(".m-treemap-group").dispatchEvent(new Event("click", { bubbles: true }));
  assert.deepEqual(drills, ["Fruit"]);
  assert.equal(el.querySelectorAll(".m-treemap-root").length, 1);
  assert.equal(leaves(el).length, 2);
  assert.ok(el.querySelector(".m-treemap-crumbs").textContent.includes("Fruit"));
  el.querySelector("svg").dispatchEvent(key("keydown", "Escape"));
  assert.deepEqual(drills, ["Fruit", null]);
  assert.equal(leaves(el).length, 4);
  dispose();
});

test("Treemap: keyboard moves over tiles with a tooltip; Enter on a leaf selects, on a group drills", () => {
  let got = null;
  const [el, dispose] = mount(() => h(Treemap, { data: tree, width: 600, height: 300, animate: false, onSelect: (p) => { got = p; } }));
  const svg = el.querySelector("svg");
  svg.dispatchEvent(key("keydown", "ArrowRight"));
  assert.ok(el.querySelector(".m-treemap-group.m-chart-active"));
  assert.equal(el.querySelector(".m-chart-tooltip").hidden, false);
  svg.dispatchEvent(key("keydown", "ArrowRight"));
  svg.dispatchEvent(key("keydown", "Enter"));
  assert.equal(got?.label, "Apple");
  assert.deepEqual(got?.path, ["Fruit", "Apple"]);
  svg.dispatchEvent(key("keydown", "Home"));
  svg.dispatchEvent(key("keydown", "Enter"));
  assert.equal(el.querySelectorAll(".m-treemap-root").length, 1);
  svg.dispatchEvent(key("keydown", "Backspace"));
  assert.equal(el.querySelectorAll(".m-treemap-root").length, 0);
  dispose();
});

test("Treemap: live data, empty, legend toggles a branch, color scale legend", () => {
  const data = signal(tree);
  const [el, dispose] = mount(() => h(Treemap, { data, legend: true, colorValue: "value", width: 600, height: 300, animate: false, empty: "Nothing" }));
  assert.equal(el.querySelectorAll(".m-chart-legend-item").length, 2);
  assert.ok(el.querySelector(".m-treemap-scale"));
  el.querySelector(".m-chart-legend-item").dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(leaves(el).length, 2);
  data.set([...tree, { name: "Nuts", children: [{ name: "Almond", value: 5 }] }]);
  assert.equal(el.querySelectorAll(".m-chart-legend-item").length, 3);
  data.set([]);
  assert.ok(el.querySelector(".m-chart-empty").textContent.includes("Nothing"));
  dispose();
});

test("Treemap: a leaving tile is removed at once without animation, kept while it shrinks with it", () => {
  const data = signal(tree);
  const [el, dispose] = mount(() => [h(Treemap, { data, depth: 1, width: 400, height: 200, animate: false }), h(Treemap, { data, depth: 1, width: 400, height: 200, animate: { duration: 200, easing: "out", enter: false } })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  data.set(tree.slice(0, 1));
  assert.equal(leaves(a).length, 1);
  assert.equal(b.querySelectorAll(".m-treemap-leaving").length, 1);
  dispose();
});
