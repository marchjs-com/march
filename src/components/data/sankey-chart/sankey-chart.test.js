import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { SankeyChart } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const links = [
  { source: "Ads", target: "Visits", value: 60 }, { source: "Search", target: "Visits", value: 40 },
  { source: "Visits", target: "Signups", value: 30 }, { source: "Visits", target: "Bounce", value: 70 },
  { source: "Signups", target: "Paid", value: 12 },
];
const key = (k) => new KeyboardEvent("keydown", { key: k, bubbles: true });
const nodeX = (el, label) => { const n = [...el.querySelectorAll(".m-sankey-node")].find((g) => g.textContent.startsWith(label)); return Number(n.querySelector("rect").getAttribute("x")); };

test("SankeyChart: one node per id, one ribbon per link; nodes from rows keep their labels", () => {
  const [el, dispose] = mount(() => h(SankeyChart, { links, nodes: [{ id: "Ads", label: "Adverts" }], width: 600, height: 300, animate: false }));
  assert.equal(el.querySelectorAll(".m-sankey-node").length, 6);
  assert.equal(el.querySelectorAll(".m-sankey-link").length, 5);
  assert.ok(el.querySelector(".m-sankey-nodes").textContent.includes("Adverts"));
  assert.equal(el.querySelectorAll("table tbody tr").length, 5);
  dispose();
});

test("SankeyChart: columns by longest path; justify puts sinks last, left keeps them at their depth", () => {
  const [el, dispose] = mount(() => [h(SankeyChart, { links, width: 600, height: 300, animate: false }), h(SankeyChart, { links, align: "left", width: 600, height: 300, animate: false })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  assert.equal(nodeX(a, "Ads"), 0);
  assert.equal(nodeX(a, "Bounce"), nodeX(a, "Paid"));
  assert.ok(nodeX(b, "Bounce") < nodeX(b, "Paid"));
  // ribbon width is the value: Visits → Bounce is 70, Signups → Paid 12
  const widths = [...a.querySelectorAll(".m-sankey-link")].map((p) => Number(p.getAttribute("stroke-width")));
  assert.ok(Math.max(...widths) > 4 * Math.min(...widths));
  dispose();
});

test("SankeyChart: keyboard walks nodes then links; hover lights the flow; Enter selects; Escape clears", () => {
  let got = null;
  const [el, dispose] = mount(() => h(SankeyChart, { links, width: 600, height: 300, animate: false, onSelect: (p) => { got = p; } }));
  const svg = el.querySelector("svg");
  svg.dispatchEvent(key("ArrowRight"));
  assert.ok(el.querySelector(".m-sankey-node.m-chart-active"));
  assert.ok(el.querySelector(".m-sankey-focus"));
  assert.equal(el.querySelector(".m-chart-tooltip").hidden, false);
  svg.dispatchEvent(key("End"));
  assert.ok(el.querySelector(".m-sankey-flow.m-chart-active"));
  assert.equal(el.querySelectorAll(".m-sankey-flow.m-sankey-on").length, 1);
  svg.dispatchEvent(key("Enter"));
  assert.equal(got?.kind, "link");
  svg.dispatchEvent(key("Escape"));
  assert.equal(el.querySelector(".m-sankey-focus"), null);
  dispose();
});

test("SankeyChart: live data, empty, legend hides a node with its links, link color modes", () => {
  const data = signal(links);
  const [el, dispose] = mount(() => h(SankeyChart, { links: data, legend: true, linkColor: "source", width: 600, height: 300, animate: false, empty: "No flows" }));
  assert.equal(el.querySelectorAll("linearGradient").length, 0);
  el.querySelector(".m-chart-legend-item").dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(el.querySelectorAll(".m-sankey-link").length, 4);
  data.set(links.slice(2));
  assert.equal(el.querySelectorAll(".m-sankey-link").length, 3);
  data.set([]);
  assert.ok(el.querySelector(".m-chart-empty")?.textContent.includes("No flows"));
  dispose();
});

test("SankeyChart: gradient links by default; leaving ribbons go at once without animation, stay while they shrink with it", () => {
  const data = signal(links);
  const [el, dispose] = mount(() => [h(SankeyChart, { links: data, width: 600, height: 300, animate: false }), h(SankeyChart, { links: data, width: 600, height: 300, animate: { duration: 200, easing: "out", enter: false } })]);
  const [a, b] = el.querySelectorAll(".m-chart");
  assert.equal(a.querySelectorAll("linearGradient").length, 5);
  data.set(links.slice(0, 4));
  assert.equal(a.querySelectorAll(".m-sankey-link").length, 4);
  assert.equal(b.querySelectorAll(".m-sankey-link").length, 5);
  dispose();
});
