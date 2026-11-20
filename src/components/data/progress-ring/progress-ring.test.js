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
  const [el, dispose] = mount(() => h(ProgressRing, { value, label: "Sleep" }));
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
