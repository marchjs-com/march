import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { CountRoll, formatCount } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("CountRoll: compact text, full value for screen readers, rolls on change", () => {
  const n = signal(998);
  const m = mount(() => h(CountRoll, { value: n }));
  const vis = m.el.querySelector(".hm-roll-vis");
  assert.equal(vis.getAttribute("aria-hidden"), "true");
  assert.equal(vis.textContent, "998");
  n.set(999);
  assert.ok(vis.querySelector(".hm-roll-slot"), "the changed digit rolls");
  assert.equal(vis.querySelectorAll(".hm-roll-slot").length, 1, "only the units digit moves");
  n.set(12500);
  assert.match(m.el.querySelector(".hm-sr-only").textContent, /12.500/);
  assert.equal(formatCount(5), "5");
  m.dispose();
});

test("CountRoll: hideZero shows nothing at 0", () => {
  const m = mount(() => h(CountRoll, { value: 0, hideZero: true }));
  assert.equal(m.el.querySelector(".hm-roll-vis").textContent, "");
  m.dispose();
});

test("CountRoll: own formatter, roll off", () => {
  const n = signal(7);
  const m = mount(() => [h(CountRoll, { value: n, formatter: (v) => `${v} likes`, spoken: (v) => `${v} people like this`, class: "mine" }), h(CountRoll, { value: n, roll: false })]);
  const [a, b] = m.el.querySelectorAll(".hm-roll-vis");
  assert.ok(m.el.querySelector(".hm-roll.mine"));
  assert.equal(a.textContent, "7 likes");
  assert.equal(m.el.querySelector(".hm-roll.mine .hm-sr-only").textContent, "7 people like this", "own text for screen readers");
  n.set(8);
  assert.ok(a.querySelector(".hm-roll-slot"), "rolls by default");
  assert.equal(b.querySelector(".hm-roll-slot"), null, "roll={false}: no moving slot");
  assert.equal(b.textContent, "8");
  m.dispose();
});
