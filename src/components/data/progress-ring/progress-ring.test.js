import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { ProgressRing } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("ProgressRing: level class from thresholds, the spoken name and the number follow a live value", () => {
  const value = signal(30);
  const [el, dispose] = mount(() => h(ProgressRing, { value, label: "Sleep", animate: false }));
  const svg = el.querySelector(".m-ring");
  assert.ok(svg.classList.contains("m-ring-low"));
  assert.equal(svg.getAttribute("aria-label"), "Sleep: 30 of 100");
  value.set(85);
  assert.ok(svg.classList.contains("m-ring-high"));
  assert.equal(svg.querySelector(".m-ring-text").textContent, "85");
  dispose();
});

test("ProgressRing: max, size and a color; several colors wrap the ring in a paint layer", () => {
  const [el, dispose] = mount(() => [h(ProgressRing, { value: 7, max: 10, size: 88, color: "brand-blue" }), h(ProgressRing, { value: 50, colors: "brand", paint: "segments" })]);
  const one = el.querySelector(".m-ring");
  assert.equal(one.getAttribute("width"), "88");
  assert.equal(one.getAttribute("data-m-color"), "brand-blue");
  assert.equal(one.getAttribute("aria-label"), "Score: 7 of 10");
  assert.ok(el.querySelector(".m-ring-multi .m-ring-paint"));
  dispose();
});

const { manualClock, step } = await import("../../../motion/engine/clock.ts");
const run = (ms = 2000) => { for (let i = 0; i < ms / 16; i++) step(16); };

test("ProgressRing: the ring sweeps to its value on the engine and the number counts along; the name says the target", () => {
  manualClock(true);
  try {
    const value = signal(40);
    const [el, dispose] = mount(() => h(ProgressRing, { value, size: 64, thickness: 8, animate: { easing: "out", duration: 300 } }));
    const arc = el.querySelector(".m-ring-value"), num = el.querySelector(".m-ring-text"), len = () => Number(arc.getAttribute("stroke-dasharray").split(" ")[0]);
    assert.equal(len(), 0, "the first sweep starts empty");
    assert.equal(el.querySelector(".m-ring").getAttribute("aria-label"), "Score: 40 of 100");
    run();
    const at40 = len();
    assert.ok(at40 > 0);
    assert.equal(num.textContent, "40");
    value.set(80);
    step(16); step(16); step(16);
    assert.ok(len() > at40 && len() < at40 * 2, "mid-sweep");
    assert.ok(Number(num.textContent) > 40 && Number(num.textContent) < 80);
    run();
    assert.equal(num.textContent, "80");
    assert.ok(Math.abs(len() - at40 * 2) < 0.2);
    dispose();
  } finally { manualClock(false); }
});

test("ProgressRing: value may be a plain getter (not only a signal)", () => {
  const [el, dispose] = mount(() => h(ProgressRing, { value: () => 64, label: "Score", animate: false }));
  assert.equal(el.querySelector(".m-ring-text").textContent, "64");
  dispose();
});
