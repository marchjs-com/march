import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { BatteryGauge } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const level = (el) => Number((el.matches?.(".m-battery") ? el : el.querySelector(".m-battery")).style.getPropertyValue("--m-battery-level"));
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };

test("BatteryGauge: a meter 0–100 with the level, states in words, the percentage inside, the cap", () => {
  const [el, dispose] = mount(() => h(BatteryGauge, { value: 64, motion: false }));
  const root = el.querySelector(".m-battery");
  assert.equal(root.getAttribute("role"), "meter");
  assert.equal(root.getAttribute("aria-label"), "Battery");
  assert.equal(root.getAttribute("aria-valuenow"), "64");
  assert.equal(root.getAttribute("aria-valuetext"), "64%");
  assert.equal(level(el), 0.64);
  assert.ok(root.classList.contains("is-ok") && root.classList.contains("is-horizontal"));
  assert.equal(root.style.getPropertyValue("--m-battery-fill"), "var(--m-success)");
  assert.match(el.querySelector(".m-battery-readout.is-inside").textContent, /64%/);
  assert.ok(el.querySelector(".m-battery-cap"));
  dispose();
});

// Rule "data changes animate": the fill springs to the new level (between after one frame), retargets mid-move, and
// motion={false} jumps; the percentage rolls.
test("BatteryGauge animates the fill, retargets mid-move, motion off jumps; the percentage rolls", () => {
  const v = signal(0);
  const [el, dispose] = mount(() => [h(BatteryGauge, { value: v, class: "a" }), h(BatteryGauge, { value: v, motion: false, class: "b" })]);
  const a = el.querySelector(".a"), b = el.querySelector(".b");
  v.set(100); E.step(16); E.step(16);
  const mid = level(a);
  assert.ok(mid > 0 && mid < 1, `filling (${mid})`);
  assert.equal(level(b), 1, "motion off: at once");
  assert.ok(a.querySelector(".m-battery-readout .m-roll-slot"), "the digits roll");
  v.set(0); E.step(16);
  assert.ok(Math.abs(level(a) - mid) < 0.2, "retargets from where it is");
  run(3000);
  assert.ok(level(a) < 0.005);
  dispose();
});

test("BatteryGauge: low and critical states (onStateChange), charging bolt, segments, vertical, outside readout, own colour", () => {
  const v = signal(50), plugged = signal(false), states = [];
  const [el, dispose] = mount(() => h(BatteryGauge, { value: v, charging: plugged, variant: "segments", segments: 4, orientation: "vertical", readout: "outside",
    low: 30, motion: false, onStateChange: (s) => states.push(s), label: "Telefon", size: 120 }));
  const root = el.querySelector(".m-battery");
  assert.ok(root.classList.contains("is-vertical") && root.classList.contains("is-segments"));
  const cells = [...el.querySelectorAll(".m-battery-cell")].map((c) => c.style.getPropertyValue("--m-battery-cell"));
  assert.deepEqual(cells, ["1", "1", "0", "0"]);
  assert.ok(el.querySelector(".m-battery-readout.is-outside"));
  v.set(25);
  assert.ok(root.classList.contains("is-low"));
  assert.equal(root.style.getPropertyValue("--m-battery-fill"), "var(--m-warn)");
  v.set(8);
  assert.ok(root.classList.contains("is-critical"));
  assert.equal(root.getAttribute("aria-valuetext"), "8%, critical");
  assert.deepEqual(states, ["low", "critical"]);
  plugged.set(true);
  assert.ok(el.querySelector(".m-battery-bolt svg"), "the bolt");
  assert.equal(root.getAttribute("aria-valuetext"), "8%, charging, critical");
  assert.equal(root.getAttribute("aria-label"), "Telefon");
  assert.equal(root.style.getPropertyValue("--m-battery-w"), "120px");
  dispose();
  const [el2, dispose2] = mount(() => h(BatteryGauge, { value: 5, charging: true, color: "brand-blue", chargeIcon: false, readout: false, parts: { cap: false, frame: false } }));
  const r2 = el2.querySelector(".m-battery");
  assert.equal(r2.style.getPropertyValue("--m-battery-fill"), "var(--m-brand-blue, var(--m-cat-2))");
  for (const c of ["m-battery-bolt", "m-battery-readout", "m-battery-cap"]) assert.equal(el2.querySelector(`.${c}`), null, c);
  assert.ok(r2.classList.contains("m-battery-bare"));
  dispose2();
});
