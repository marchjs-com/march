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
  const [el, dispose] = mount(() => [h(Stat, { label: "Orders", value, previous: 100, hint: "vs last week" }), h(Stat, { label: "Wait", value: 4, delta: 0.25, invert: true })]);
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
