import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { manualClock, step } = await import("../../../motion/engine/clock.ts");
const { LiveCounter } = await import("./index.ts");

const shown = (el) => Number(el.querySelector(".m-sr-only").textContent.replace(/\D/g, ""));

test("LiveCounter: follows a value signal", () => {
  const v = signal(120);
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(LiveCounter, { value: v, label: "online" }), el);
  assert.equal(shown(el), 120);
  v.set(135);
  assert.equal(shown(el), 135);
  assert.equal(el.querySelector(".m-lc-label").textContent, "online");
  assert.ok(el.querySelector(".m-lc-dot"));
  dispose();
});

test("LiveCounter: simulated growth on the clock, never down", () => {
  manualClock(true);
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(LiveCounter, { from: 1000, rate: 600, random: () => 0.5, dot: false }), el);
  assert.equal(shown(el), 1000);
  assert.equal(el.querySelector(".m-lc-dot"), null);
  for (let i = 0; i < 200; i++) step(16);
  const a = shown(el);
  assert.ok(a > 1000, `grew: ${a}`);
  for (let i = 0; i < 200; i++) step(16);
  assert.ok(shown(el) > a);
  dispose();
  manualClock(false);
});

test("LiveCounter: own effect, own bubble, no dot, no beat", () => {
  manualClock(true);
  const v = signal(10), calls = [];
  const fx = (el, o) => { calls.push([el.textContent, o.start]); return { stop() {} }; };
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(LiveCounter, { value: v, effect: fx, dot: false, beat: false, bubble: (d) => h("b", { class: "own" }, `+${d}!`) }), el);
  assert.equal(el.querySelector(".m-lc-dot"), null);
  assert.equal(el.querySelector(".m-lc-text").textContent, "10");
  v.set(15);
  assert.equal(el.querySelector(".m-lc-text").textContent, "15");
  assert.deepEqual(calls, [["15", 10]], "the text animation runs with the previous value as start");
  assert.equal(el.querySelector(".m-lc-bubble .own")?.textContent, "+5!");
  dispose();
  manualClock(false);
});

test("LiveCounter: a coloured dot and an own dot node", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => [h(LiveCounter, { value: 1, dotColor: "brand-orange" }), h(LiveCounter, { value: 1, dot: h("i", { class: "mine" }) })], el);
  assert.equal(el.querySelector(".m-lc-dot").getAttribute("data-m-color"), "brand-orange");
  assert.ok(el.querySelector(".m-lc-dot-own .mine"));
  dispose();
});
