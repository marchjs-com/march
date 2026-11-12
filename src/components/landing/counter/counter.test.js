import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Counter, formatCount } = await import("./index.ts");

test("formatCount: Intl formatting with decimals and options", () => {
  assert.equal(formatCount(1234.5, { decimals: 1 }, "en"), "1,234.5");
  assert.equal(formatCount(0.5, { format: { style: "percent" } }, "en"), "50%");
});

test("Counter: the final value is announced; roll mode draws a column per digit", () => {
  const v = signal(1200);
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => [h(Counter, { value: v, start: "now" }), h(Counter, { value: v, mode: "roll", start: "now" })], el);
  const [a, b] = el.querySelectorAll(".hm-counter");
  assert.match(a.querySelector(".hm-sr-only").textContent, /1.?200/);
  assert.equal(a.querySelector(".hm-counter-view").getAttribute("aria-hidden"), "true");
  assert.equal(b.querySelectorAll(".hm-roll-d").length, 4);
  v.set(98765);
  assert.equal(b.querySelectorAll(".hm-roll-d").length, 5);
  assert.match(b.querySelector(".hm-sr-only").textContent, /98.?765/);
  dispose();
});
