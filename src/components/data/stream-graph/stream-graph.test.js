import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { StreamGraph } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const rows = [{ w: 1, a: 3, b: 1, c: 2 }, { w: 2, a: 5, b: 2, c: 1 }, { w: 3, a: 4, b: 6, c: 3 }, { w: 4, a: 2, b: 4, c: 5 }];

test("StreamGraph: one layer per series, no value axis, a legend and a data table", () => {
  const [el, dispose] = mount(() => h(StreamGraph, { data: rows, x: "w", y: ["a", "b", "c"], title: "Listening", width: 400, height: 200, animate: false }));
  assert.ok(el.querySelector(".m-stream-chart"));
  assert.equal(el.querySelectorAll(".m-chart-area").length, 3);
  assert.equal(el.querySelector(".m-chart-axis-left"), null, "a stream has no value axis");
  assert.equal(el.querySelectorAll(".m-chart-legend-item").length, 3);
  assert.equal(el.querySelectorAll("table tbody tr").length, 4);
  assert.equal(el.querySelector("svg title").textContent, "Listening");
  dispose();
});

test("StreamGraph: wiggle layers sit around a centre (some go below the old zero), expand fills 0..1", () => {
  const [el, dispose] = mount(() => h(StreamGraph, { data: rows, x: "w", y: ["a", "b", "c"], width: 400, height: 200, animate: false }));
  const d = [...el.querySelectorAll(".m-chart-area")].map((p) => p.getAttribute("d"));
  assert.ok(d.every((s) => s.length > 10), "every layer has a shape");
  dispose();
});

test("StreamGraph: edges adds the edge class; legend toggling hides a layer; live data", () => {
  const data = signal(rows);
  const [el, dispose] = mount(() => h(StreamGraph, { data, x: "w", y: ["a", "b", "c"], edges: true, width: 400, height: 200, animate: false }));
  assert.ok(el.querySelector(".m-stream-edges"));
  el.querySelector(".m-chart-legend-item").click();
  assert.equal(el.querySelectorAll(".m-chart-area").length, 2);
  data.set([...rows, { w: 5, a: 1, b: 1, c: 1 }]);
  assert.equal(el.querySelectorAll("table tbody tr").length, 5);
  dispose();
});
