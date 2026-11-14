import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Slider } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("Slider: range input, value both ways, formatted output", () => {
  const v = signal(30);
  const { el } = mount(() => h(Slider, { "bind:value": v, min: 0, max: 50, step: 5, format: (x) => `${x} pts` }));
  const input = el.querySelector("input[type=range]");
  assert.equal(input.getAttribute("max"), "50");
  assert.equal(input.getAttribute("step"), "5");
  assert.equal(el.querySelector("output").textContent, "30 pts");
  type(input, "45");
  assert.equal(v(), 45);
  assert.equal(el.querySelector("output").textContent, "45 pts");
});

test("Slider: the value next to it can go", () => {
  const a = mount(() => h(Slider, { value: 4, showValue: false }));
  assert.equal(a.el.querySelector("output"), null);
  assert.ok(a.el.querySelector("input[type=range]"));
  a.dispose();
});

test("Slider: track (ramp, own class, own node) draws a decorative track under the real input; the default has none", () => {
  const { el } = mount(() => [
    h(Slider, { value: 10, track: true, color: "brand-blue" }), h(Slider, { value: 10, track: "my-hue" }),
    h(Slider, { value: 10, track: h("i", { class: "own" }) }), h(Slider, { value: 10 }),
  ]);
  const [ramp, cls, node, plain] = el.querySelectorAll(".m-slider-wrap");
  assert.match(ramp.querySelector(".m-slider-track").getAttribute("class"), /m-slider-ramp/);
  assert.equal(ramp.querySelector(".m-slider-rail").getAttribute("data-m-color"), "brand-blue");
  assert.equal(ramp.querySelector(".m-slider-track").getAttribute("aria-hidden"), "true");
  assert.match(ramp.querySelector("input").getAttribute("class"), /m-slider-own/);
  assert.equal(ramp.querySelector("input").getAttribute("type"), "range");
  assert.match(cls.querySelector(".m-slider-track").getAttribute("class"), /my-hue/);
  assert.doesNotMatch(cls.querySelector(".m-slider-track").getAttribute("class"), /m-slider-ramp/);
  assert.ok(node.querySelector(".m-slider-track .own"));
  assert.equal(plain.querySelector(".m-slider-rail"), null);
  assert.doesNotMatch(plain.querySelector("input").getAttribute("class"), /m-slider-own/);
});

test("Slider: valueText is spoken, onCommit runs when the change is finished", () => {
  const commits = [], changes = [];
  const { el } = mount(() => h(Slider, { value: 90, max: 360, valueText: (v) => `${v} degrees`, onChange: (v) => changes.push(v), onCommit: (v) => commits.push(v) }));
  const input = el.querySelector("input");
  assert.equal(input.getAttribute("aria-valuetext"), "90 degrees");
  type(input, "120");
  assert.deepEqual(changes, [120]);
  assert.deepEqual(commits, []);
  assert.equal(input.getAttribute("aria-valuetext"), "120 degrees");
  fire(input, "change");
  assert.deepEqual(commits, [120]);
});
