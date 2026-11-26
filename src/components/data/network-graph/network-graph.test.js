import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { NetworkGraph } = await import("./index.ts");
const { simulation } = await import("./sim.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const nodes = [{ id: "a", label: "Ada", group: "x", value: 5 }, { id: "b", label: "Bo", group: "x", value: 1 }, { id: "c", label: "Cem", group: "y", value: 3 }, { id: "d", label: "Dua", group: "y", value: 2 }];
const links = [{ source: "a", target: "b" }, { source: "a", target: "c" }, { source: "c", target: "d" }];
const key = (el, k) => el.querySelector("svg").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const posOf = (el, id) => { const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(el.querySelector(`[data-id="${id}"]`).getAttribute("transform")); return [Number(m[1]), Number(m[2])]; };

test("NetworkGraph: one node per row and one line per link, sized by value, a legend for two groups, a data table", () => {
  const [el, dispose] = mount(() => h(NetworkGraph, { nodes, links, title: "Team", width: 400, height: 300, animate: false }));
  assert.equal(el.querySelectorAll(".m-network-node").length, 4);
  assert.equal(el.querySelectorAll(".m-network-link").length, 3);
  const r = (id) => Number(el.querySelector(`[data-id="${id}"] .m-network-dot`).getAttribute("r"));
  assert.ok(r("a") > r("c") && r("c") > r("b"));
  assert.equal(el.querySelectorAll(".m-chart-legend-item").length, 2);
  assert.equal(el.querySelector("svg title").textContent, "Team");
  assert.equal(el.querySelectorAll("table tbody tr").length, 4);
  assert.ok(el.textContent.includes("Ada"), "labels are shown for small graphs");
  dispose();
});

test("NetworkGraph: animate false settles the force layout at once; linked nodes sit closer than unlinked ones", () => {
  const [el, dispose] = mount(() => h(NetworkGraph, { nodes, links, width: 400, height: 300, animate: false }));
  const [a, b, d] = ["a", "b", "d"].map((id) => posOf(el, id));
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  assert.ok(dist(a, b) < dist(b, d), "a–b (linked) is shorter than b–d (two hops)");
  assert.ok(dist(a, b) > 20, "nodes are pushed apart");
  dispose();
});

test("NetworkGraph: circle and grid layouts place every node at its target", () => {
  const layout = signal("circle");
  const [el, dispose] = mount(() => h(NetworkGraph, { nodes, links, layout, width: 400, height: 300, animate: false }));
  const radius = ["a", "b", "c", "d"].map((id) => Math.round(Math.hypot(...posOf(el, id))));
  assert.equal(new Set(radius).size, 1, "all on one ring");
  layout.set("grid");
  const ys = new Set(["a", "b", "c", "d"].map((id) => posOf(el, id)[1]));
  assert.ok(ys.size <= 2, "rows of a grid");
  dispose();
});

test("NetworkGraph: keyboard goes to the nearest node in a direction, the tooltip follows, Enter selects, Escape clears", () => {
  let got = null;
  const [el, dispose] = mount(() => h(NetworkGraph, { nodes, links, layout: "circle", width: 400, height: 300, animate: false, onSelect: (p) => { got = p; } }));
  key(el, "ArrowRight");
  const first = el.querySelector(".m-network-node.m-chart-active")?.getAttribute("data-id");
  assert.ok(first);
  const tip = el.querySelector(".m-chart-tooltip");
  assert.equal(tip.hasAttribute("hidden"), false);
  // circle: a at the top, b right, c bottom, d left
  key(el, "ArrowLeft");
  assert.equal(el.querySelector(".m-network-node.m-chart-active").getAttribute("data-id"), "d");
  assert.ok(el.querySelector(".m-network-plot").classList.contains("m-network-focus"), "neighbours are highlighted");
  assert.ok(el.querySelector('[data-id="c"]').classList.contains("m-network-near"));
  key(el, "Enter");
  assert.equal(got?.id, "d");
  assert.deepEqual(got?.neighbors, ["c"]);
  key(el, "Escape");
  assert.equal(tip.hasAttribute("hidden"), true);
  dispose();
});

test("NetworkGraph: legend toggles a group; nodes come from links when none are given; empty text", () => {
  const [el, dispose] = mount(() => [
    h(NetworkGraph, { nodes, links, width: 400, animate: false, class: "a" }),
    h(NetworkGraph, { links, width: 400, animate: false, class: "b" }),
    h(NetworkGraph, { nodes: [], empty: "No people", width: 300, class: "c" }),
  ]);
  const a = el.querySelector(".a");
  a.querySelectorAll(".m-chart-legend-item")[1].dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(a.querySelectorAll(".m-network-node").length, 2);
  assert.equal(a.querySelectorAll(".m-network-link").length, 1);
  assert.equal(el.querySelector(".b").querySelectorAll(".m-network-node").length, 4);
  assert.ok(el.querySelector(".c").textContent.includes("No people"));
  dispose();
});

test("NetworkGraph: new data keeps the positions of kept nodes; removed nodes go (animate false)", () => {
  const data = signal(nodes);
  const [el, dispose] = mount(() => h(NetworkGraph, { nodes: data, links, width: 400, height: 300, animate: false, center: 0.3 }));
  const before = posOf(el, "a");
  data.set([...nodes.slice(0, 3)]);
  assert.equal(el.querySelectorAll(".m-network-node").length, 3);
  const after = posOf(el, "a");
  assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) < 80, "a stays near where it was");
  dispose();
});

test("NetworkGraph: animated exit keeps a leaving node until it has shrunk; the simulation cools and stops", async () => {
  const data = signal(nodes);
  const [el, dispose] = mount(() => h(NetworkGraph, { nodes: data, links, width: 400, animate: { duration: 30, easing: "out" } }));
  await wait(120);
  data.set(nodes.slice(0, 3));
  assert.equal(el.querySelectorAll(".m-network-leaving").length, 1);
  await wait(250);
  assert.equal(el.querySelectorAll(".m-network-node").length, 3);
  dispose();
  const s = simulation([{ id: "p", x: 0, y: 0, vx: 0, vy: 0, r: 5 }, { id: "q", x: 1, y: 0, vx: 0, vy: 0, r: 5 }], [], { mode: "force", charge: -100, distance: 40, strength: null, center: 0.05, collide: 3 });
  let n = 0;
  while (s.tick() && n < 2000) n++;
  assert.ok(n < 400, "cools within a few hundred steps");
});

test("NetworkGraph: zoom keys change the view and Reset view fits again", () => {
  const [el, dispose] = mount(() => h(NetworkGraph, { nodes, links, width: 400, height: 300, animate: false }));
  const plot = el.querySelector(".m-network-plot"), t0 = plot.getAttribute("transform");
  key(el, "+");
  assert.notEqual(plot.getAttribute("transform"), t0);
  assert.equal(el.querySelector(".m-network-reset").hasAttribute("hidden"), false);
  el.querySelector(".m-network-reset").dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(plot.getAttribute("transform"), t0);
  dispose();
});

test("NetworkGraph: draggable nodes carry the grab class (cursor), draggable={false} drops it", () => {
  const draggable = signal(undefined);
  const [el, dispose] = mount(() => h(NetworkGraph, { nodes, links, draggable, width: 400, height: 300, animate: false }));
  assert.ok(el.querySelector(".m-network-nodes.m-network-draggable"), "on by default");
  draggable.set(false);
  assert.equal(el.querySelector(".m-network-draggable"), null);
  dispose();
});
