import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Progress } = await import("./index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };
const mountD = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Progress: progressbar values follow the value; the percentage is shown; null is indeterminate", async () => {
  const v = signal(30);
  const el = mount(() => [h(Progress, { value: v, max: 200, label: "Upload", showValue: true }), h(Progress, {})]);
  const [a, b] = el.querySelectorAll(".m-progress2");
  const bar = a.querySelector("[role=progressbar]");
  assert.equal(bar.getAttribute("aria-valuenow"), "30");
  assert.equal(bar.getAttribute("aria-valuemax"), "200");
  assert.equal(bar.getAttribute("aria-label"), "Upload");
  assert.equal(a.querySelector(".m-progress2-value").textContent, "15%");
  v.set(100);
  await tick();
  assert.equal(a.querySelector(".m-progress2-value").textContent, "50%");
  assert.equal(a.querySelector(".m-progress2-fill").style.getPropertyValue("--m-progress"), "0.5");
  assert.ok(b.classList.contains("is-indeterminate"));
  assert.equal(b.querySelector("[role=progressbar]").getAttribute("aria-valuenow"), null);
});

test("Progress: own value text and an accessible name without a visible label", () => {
  const m = mountD(() => [h(Progress, { value: 3, max: 8, showValue: (p, v) => `${v} of 8 (${p}%)` }), h(Progress, { value: 40, ariaLabel: "Storage used", class: "mine" })]);
  const [a, b] = m.el.querySelectorAll(".m-progress2");
  assert.equal(a.querySelector(".m-progress2-value").textContent, "3 of 8 (38%)");
  assert.equal(b.querySelector("[role=progressbar]").getAttribute("aria-label"), "Storage used");
  assert.equal(b.querySelector(".m-progress2-head"), null);
  assert.ok(b.classList.contains("mine"));
  m.dispose();
});

test("Progress: line variant, driven from outside through fillRef, vertical, bare, inverse, decorative, pixel size", async () => {
  const v = signal(25);
  let got = null;
  const el = mount(() => [
    h(Progress, { variant: "line", value: v, smooth: false, size: 5, class: "a" }),
    h(Progress, { variant: "line", fillRef: (x) => { got = x; }, orientation: "vertical", track: false, inverse: true, decorative: true, class: "b" }),
  ]);
  const a = el.querySelector(".a"), b = el.querySelector(".b");
  assert.ok(a.classList.contains("m-progress2-line") && a.classList.contains("is-instant"));
  assert.equal(a.style.getPropertyValue("--m-progress-h"), "5px");
  assert.equal(a.querySelector(".m-progress2-fill").style.getPropertyValue("--m-progress"), "0.25");
  v.set(50);
  await tick();
  assert.equal(a.querySelector(".m-progress2-fill").style.getPropertyValue("--m-progress"), "0.5");
  assert.equal(a.querySelector("[role=progressbar]").getAttribute("aria-valuenow"), "50");
  // the outside driver owns the fill: no value, yet not indeterminate
  assert.equal(got, b.querySelector(".m-progress2-fill"));
  assert.ok(!b.classList.contains("is-indeterminate"));
  for (const c of ["m-progress2-vertical", "m-progress2-bare", "m-progress2-inverse"]) assert.ok(b.classList.contains(c), c);
  assert.equal(b.querySelector("[role=progressbar]"), null);
  assert.equal(b.querySelector(".m-progress2-track").getAttribute("aria-hidden"), "true");
});

test("Progress: segments fill up to the value; the count follows; valueText is read", async () => {
  const n = signal(4), v = signal(2.5);
  const el = mount(() => h(Progress, { segments: n, value: v, valueText: (x, m) => `Step ${x} of ${m}` }));
  const bar = el.querySelector("[role=progressbar]");
  const fills = () => [...el.querySelectorAll(".m-progress2-seg-fill")].map((f) => f.style.getPropertyValue("--m-progress"));
  assert.deepEqual(fills(), ["1", "1", "0.5", "0"]);
  assert.equal(bar.getAttribute("aria-valuemax"), "4");
  assert.equal(bar.getAttribute("aria-valuetext"), "Step 2.5 of 4");
  assert.ok(el.querySelectorAll(".m-progress2-seg")[2].classList.contains("is-now"));
  assert.ok(!el.querySelector(".m-progress2").classList.contains("is-indeterminate"));
  n.set(2); v.set(1);
  await tick();
  assert.deepEqual(fills(), ["1", "0"]);
  assert.equal(bar.getAttribute("aria-valuemax"), "2");
});

test("Progress: a timed segment is instant (the engine owns its fill); pausing, moving on and disposing are safe", async () => {
  const i = signal(0), hold = signal(false);
  let done = 0;
  const m = mountD(() => h(Progress, { segments: 3, value: i, duration: 30, paused: hold, onDone: () => { done++; } }));
  assert.ok(m.el.querySelector(".m-progress2").classList.contains("is-instant"));
  await new Promise((r) => setTimeout(r, 60));
  // no animation support here: the fill ends at once and that is not a timed finish
  assert.equal(done, 0);
  hold.set(true); i.set(1);
  await new Promise((r) => setTimeout(r, 30));
  hold.set(false);
  assert.ok(m.el.querySelectorAll(".m-progress2-seg")[1].classList.contains("is-now"));
  i.set(2);
  m.dispose();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(done, 0);
});
