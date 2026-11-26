import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { Sparkline } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("Sparkline: a line, the size, and a spoken summary that follows live data", () => {
  const data = signal([3, 5, 4]);
  const [el, dispose] = mount(() => h(Sparkline, { data, width: 100, height: 30, title: "Price" }));
  const svg = el.querySelector(".m-sparkline");
  assert.equal(svg.getAttribute("width"), "100");
  assert.ok(svg.querySelector(".m-chart-line").getAttribute("d").startsWith("M"));
  assert.match(svg.getAttribute("aria-label"), /^Price: 3 values, from 3 to 4/);
  data.set([1, 9]);
  assert.match(svg.getAttribute("aria-label"), /2 values, from 1 to 9/);
  dispose();
});

test("Sparkline: area, no dot, objects through y; empty data says so", () => {
  const [el, dispose] = mount(() => [h(Sparkline, { data: [{ v: 1 }, { v: 2 }], y: "v", area: true, dot: false }), h(Sparkline, { data: [], empty: "Nothing" })]);
  const [a, b] = el.querySelectorAll(".m-sparkline");
  assert.ok(a.querySelector(".m-chart-area"));
  assert.equal(a.querySelector(".m-chart-marker").getAttribute("visibility"), "hidden");
  assert.equal(b.getAttribute("aria-label"), "Nothing");
  dispose();
});

const { manualClock, step } = await import("../../../motion/engine/clock.ts");
const run = (ms = 2000) => { for (let i = 0; i < ms / 16; i++) step(16); };

test("Sparkline: bar variant draws a column per value from the zero line (animate false: final geometry)", () => {
  const data = signal([2, -1, 4]);
  const [el, dispose] = mount(() => h(Sparkline, { data, variant: "bar", width: 60, height: 20, animate: false }));
  const svg = el.querySelector(".m-sparkline");
  assert.ok(svg.classList.contains("m-sparkline-bar"));
  const r = [...svg.querySelectorAll(".m-sparkline-block")];
  assert.equal(r.length, 3);
  assert.ok(r[1].classList.contains("is-neg"));
  assert.equal(r[2].getAttribute("y"), "2", "the largest bar reaches the top");
  assert.equal(svg.querySelector(".m-chart-line"), null);
  data.set([2, -1]);
  assert.equal(svg.querySelectorAll(".m-sparkline-block").length, 2, "without motion a leaving bar goes at once");
  dispose();
});

test("Sparkline: winloss blocks up / down, a tick for 0, and a wins / losses summary", () => {
  const [el, dispose] = mount(() => h(Sparkline, { data: [1, -2, 0, 3, 5, -1], variant: "winloss", height: 20, animate: false, title: "Form" }));
  const svg = el.querySelector(".m-sparkline");
  const kinds = [...svg.querySelectorAll(".m-sparkline-block")].map((r) => r.getAttribute("class").split("is-")[1]);
  assert.deepEqual(kinds, ["pos", "neg", "tie", "pos", "pos", "neg"]);
  assert.equal(svg.getAttribute("aria-label"), "Form: 3 wins, 2 losses, 1 ties");
  const [up, down] = svg.querySelectorAll(".m-sparkline-block");
  assert.ok(Number(up.getAttribute("y")) < 10 && Number(down.getAttribute("y")) > 10);
  dispose();
});

test("Sparkline: the line morphs on the motion engine, the dot glides, leaving bars shrink before they go", () => {
  manualClock(true);
  try {
    const data = signal([1, 2, 3]);
    const [el, dispose] = mount(() => h(Sparkline, { data, width: 100, height: 30, animate: { easing: "out", duration: 300 } }));
    const line = el.querySelector(".m-chart-line"), dot = el.querySelector(".m-chart-marker");
    run();
    const end = line.getAttribute("d"), cy0 = dot.getAttribute("cy");
    data.set([1, 2, 3, 1]); // appended: the new point grows out of the old last one
    step(16); step(16);
    assert.notEqual(line.getAttribute("d"), end);
    run();
    assert.equal(line.getAttribute("d").split("L").length, 4);
    assert.notEqual(dot.getAttribute("cy"), cy0, "the last dot glided to the new last point");
    dispose();

    const bars = signal([1, 2, 3]);
    const [el2, dispose2] = mount(() => h(Sparkline, { data: bars, variant: "bar", animate: { easing: "out", duration: 200, stagger: 40 } }));
    run();
    bars.set([1, 2]);
    assert.equal(el2.querySelectorAll(".m-sparkline-block").length, 3, "the leaving bar stays while it shrinks");
    run();
    assert.equal(el2.querySelectorAll(".m-sparkline-block").length, 2);
    dispose2();
  } finally { manualClock(false); }
});
