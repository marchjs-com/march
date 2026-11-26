import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { Stat } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("Stat: label, formatted value, delta from previous with a good / bad tone; live value", () => {
  const value = signal(120);
  const [el, dispose] = mount(() => [h(Stat, { label: "Orders", value, previous: 100, hint: "vs last week", animate: false }), h(Stat, { label: "Wait", value: 4, delta: 0.25, invert: true })]);
  const [a, b] = el.querySelectorAll(".m-stat");
  assert.equal(a.querySelector(".m-stat-label").textContent, "Orders");
  assert.equal(a.querySelector(".m-stat-value").textContent, "120");
  assert.ok(a.querySelector(".m-stat-delta").classList.contains("m-stat-good"));
  assert.ok(a.textContent.includes("vs last week"));
  assert.ok(b.querySelector(".m-stat-delta").classList.contains("m-stat-bad"), "invert: a rise is bad");
  value.set(80);
  assert.ok(a.querySelector(".m-stat-delta").classList.contains("m-stat-down"));
  dispose();
});

test("Stat: no delta, no pill; spark adds a sparkline; no value shows the empty text", () => {
  const [el, dispose] = mount(() => [h(Stat, { label: "A", value: 1, spark: [1, 3, 2] }), h(Stat, { label: "B", value: null, empty: "n/a" })]);
  const [a, b] = el.querySelectorAll(".m-stat");
  assert.equal(a.querySelector(".m-stat-delta"), null);
  assert.ok(a.querySelector(".m-sparkline"));
  assert.equal(b.querySelector(".m-stat-value").textContent, "n/a");
  dispose();
});

const { manualClock, step } = await import("../../../motion/engine/clock.ts");
const run = (ms = 2000) => { for (let i = 0; i < ms / 16; i++) step(16); };

test("Stat: the value counts to its new number with the stat's format, the arrow turns, animate reaches the sparkline", () => {
  manualClock(true);
  try {
    const value = signal(1000);
    const [el, dispose] = mount(() => h(Stat, { label: "Sales", value, previous: 900, format: (v) => `€${v}`, spark: [1, 2, 3], animate: { easing: "out", duration: 400 } }));
    const shown = () => el.querySelector(".m-stat-value").textContent;
    assert.equal(shown(), "€0", "the first value counts up from 0");
    run();
    assert.equal(shown(), "€1000");
    const arrow = el.querySelector(".m-stat-arrow");
    assert.equal(arrow.style.getPropertyValue("transform"), "rotate(0deg)");
    value.set(500); // now below previous: the arrow turns down while the number counts
    step(16); step(16); step(16);
    const mid = Number(shown().slice(1));
    assert.ok(mid < 1000 && mid > 500 && Number.isInteger(mid), `counting, whole numbers like the target: ${shown()}`);
    assert.notEqual(arrow.style.getPropertyValue("transform"), "rotate(180deg)");
    run();
    assert.equal(shown(), "€500");
    assert.equal(arrow.style.getPropertyValue("transform"), "rotate(180deg)");
    dispose();
  } finally { manualClock(false); }
  const [el, dispose] = mount(() => h(Stat, { label: "A", value: 42, animate: false }));
  assert.equal(el.querySelector(".m-stat-value").textContent, "42", "animate false: at once");
  dispose();
});

test("Stat: value, previous and delta may be plain getters (not only signals)", () => {
  const [el, dispose] = mount(() => h(Stat, { label: "Orders", value: () => 120, previous: () => 100, format: (v) => `${v} pcs`, animate: false }));
  assert.equal(el.querySelector(".m-stat-value").textContent, "120 pcs");
  assert.ok(el.querySelector(".m-stat-up"));
  dispose();
});
