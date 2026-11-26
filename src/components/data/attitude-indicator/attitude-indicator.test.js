import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { AttitudeIndicator } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const card = (el) => {
  const m = /rotate\(([-\d.]+) 100 100\) translate\(0 ([-\d.]+)\)/.exec(el.querySelector(".m-att-card").getAttribute("transform"));
  return { roll: -Number(m[1]) || 0, y: Number(m[2]) };
};
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };

test("AttitudeIndicator: the card tilts by the bank and moves by the pitch; ladder, roll scale, sky pointer, spoken attitude", () => {
  const [el, dispose] = mount(() => h(AttitudeIndicator, { pitch: 10, roll: 20, motion: false }));
  assert.deepEqual(card(el), { roll: 20, y: 22 }, "10° at 2.2 px per degree");
  assert.ok(el.querySelectorAll(".m-att-rung.is-major").length >= 10);
  assert.equal(el.querySelector(".m-att-num").textContent, "80");
  assert.match(el.querySelector(".m-gauge-peak").getAttribute("transform"), /^rotate\(-20 /, "the sky pointer follows the bank");
  assert.ok(el.querySelector(".m-gauge-inlay .m-att-aircraft"), "the horizon is on the face of the dial");
  assert.equal(el.querySelectorAll(".m-gauge-ticks .is-major")[0].getAttribute("d").split("M").length - 1, 11, "11 roll marks");
  const root = el.querySelector(".m-att");
  assert.equal(root.getAttribute("role"), "img");
  assert.equal(root.getAttribute("aria-label"), "Attitude: pitch 10° up, bank 20° right");
  assert.equal(el.querySelector(".m-gauge").getAttribute("aria-hidden"), "true");
  dispose();
});

// Rule "data changes animate": the horizon moves on a gyro spring (between after one frame), retargets mid-move, and
// motion={false} jumps.
test("AttitudeIndicator animates pitch and roll, retargets mid-move, motion off jumps", () => {
  const pitch = signal(0), roll = signal(0);
  const [el, dispose] = mount(() => [h(AttitudeIndicator, { pitch, roll, class: "a" }), h(AttitudeIndicator, { pitch, roll, motion: false, class: "b" })]);
  const a = el.querySelector(".a"), b = el.querySelector(".b");
  roll.set(30); pitch.set(-10); E.step(16); E.step(16);
  const mid = card(a);
  assert.ok(mid.roll > 0 && mid.roll < 30 && mid.y < 0 && mid.y > -22, `on its way (${JSON.stringify(mid)})`);
  assert.deepEqual(card(b), { roll: 30, y: -22 }, "motion off: at once");
  roll.set(-30); E.step(16);
  assert.ok(Math.abs(card(a).roll - mid.roll) < 10, "retargets from where it is");
  run(3000);
  assert.ok(Math.abs(card(a).roll + 30) < 0.5);
  dispose();
});

test("AttitudeIndicator: range, colours, parts off, own label; level flight in words", () => {
  const [el, dispose] = mount(() => h(AttitudeIndicator, { pitch: 0, roll: 0, range: 20, motion: false, label: "Ufuk",
    colors: { sky: "brand-blue", ground: "success" }, parts: { ladder: false, aircraft: false, pointer: false, glass: false } }));
  assert.equal(el.querySelector(".m-att-sky").style.getPropertyValue("fill"), "var(--m-brand-blue, var(--m-cat-2))");
  assert.equal(el.querySelector(".m-att-ground").style.getPropertyValue("fill"), "var(--m-success)");
  for (const c of ["m-att-rung", "m-att-aircraft", "m-gauge-glass"]) assert.equal(el.querySelector(`.${c}`), null, c);
  assert.ok(el.querySelector(".m-gauge-peak.is-off"), "no sky pointer");
  assert.equal(el.querySelector(".m-att").getAttribute("aria-label"), "Ufuk: pitch level, bank level");
  dispose();
});

test("AttitudeIndicator: later values (getters) for colors, color and size take effect", () => {
  const colors = signal(undefined), col = signal(undefined), size = signal(200);
  const [el, dispose] = mount(() => h(AttitudeIndicator, { pitch: 0, roll: 0, motion: false, get colors() { return colors(); }, get color() { return col(); }, get size() { return size(); } }));
  colors.set({ sky: "brand-purple" });
  assert.match(el.querySelector(".m-att-sky").style.getPropertyValue("fill"), /brand-purple/);
  col.set("danger");
  assert.equal(el.querySelector(".m-att-aircraft").style.getPropertyValue("--m-att-mark"), "var(--m-danger)");
  size.set(150);
  assert.equal(el.querySelector(".m-gauge").style.getPropertyValue("--m-gauge-w"), "150px");
  dispose();
});
