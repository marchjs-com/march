import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { Thermometer, toFahrenheit, toCelsius } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const top = (el) => Number(el.querySelector(".m-thermo-column").getAttribute("y"));
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("toFahrenheit / toCelsius", () => {
  assert.equal(toFahrenheit(100), 212);
  assert.equal(toCelsius(32), 0);
});

test("Thermometer: a meter in °C, the column height, round ticks with labels, a rolling readout", () => {
  const [el, dispose] = mount(() => h(Thermometer, { value: 10, min: -30, max: 50, motion: false }));
  const root = el.querySelector(".m-thermo");
  assert.equal(root.getAttribute("role"), "meter");
  assert.equal(root.getAttribute("aria-label"), "Temperature");
  assert.equal(root.getAttribute("aria-valuemin"), "-30");
  assert.equal(root.getAttribute("aria-valuemax"), "50");
  assert.equal(root.getAttribute("aria-valuetext"), "10 °C");
  assert.equal(top(el), 106, "half-way up the tube");
  const labels = [...el.querySelectorAll(".is-main .m-thermo-label")].map((x) => x.textContent);
  assert.deepEqual(labels, ["-30°", "-20°", "-10°", "0°", "10°", "20°", "30°", "40°", "50°"]);
  assert.match(el.querySelector(".m-thermo-readout").textContent, /10 °C/);
  dispose();
});

// Rule "data changes animate": the column springs to the new value (between after one frame), retargets mid-move, and
// motion={false} jumps; the readout rolls.
test("Thermometer animates the column, retargets mid-move, motion off jumps; the readout rolls", () => {
  const v = signal(-30);
  const [el, dispose] = mount(() => [h(Thermometer, { value: v, class: "a" }), h(Thermometer, { value: v, motion: false, class: "b" })]);
  const a = el.querySelector(".a"), b = el.querySelector(".b");
  assert.equal(top(a), 196);
  v.set(50); E.step(16); E.step(16);
  const mid = top(a);
  assert.ok(mid < 196 && mid > 16, `rising (${mid})`);
  assert.equal(top(b), 16, "motion off: at once");
  assert.ok(a.querySelector(".m-thermo-readout .m-roll-slot"), "the readout digits roll");
  v.set(-30); E.step(16);
  assert.ok(Math.abs(top(a) - mid) < 30, "retargets from where it is");
  run(3000);
  assert.ok(Math.abs(top(a) - 196) < 0.5);
  dispose();
});

test("Thermometer: °F with round Fahrenheit ticks, a °C secondary scale, zones colour the liquid, own colour, parts off", async () => {
  const v = signal(-10);
  const [el, dispose] = mount(() => h(Thermometer, { value: v, unit: "F", secondary: true, motion: false, label: "Dış",
    zones: [{ from: -30, to: 0, color: "info" }, { from: 30, to: 50, color: "danger" }], parts: { glass: false } }));
  const root = el.querySelector(".m-thermo");
  assert.equal(root.getAttribute("aria-valuemin"), "-22");
  assert.equal(root.getAttribute("aria-valuetext"), "14 °F");
  assert.deepEqual([...el.querySelectorAll(".is-main .m-thermo-label")].map((x) => x.textContent).slice(0, 3), ["-20°", "0°", "20°"]);
  assert.ok(el.querySelector(".is-secondary"), "the °C scale on the other side");
  assert.equal(el.querySelectorAll(".m-thermo-zone").length, 2);
  assert.equal(el.querySelector(".m-thermo-liquid").style.getPropertyValue("fill"), "var(--m-info)", "in the cold zone");
  v.set(20);
  assert.equal(el.querySelector(".m-thermo-liquid").style.getPropertyValue("fill"), "var(--m-danger)", "no zone: the default red");
  assert.equal(el.querySelector(".m-thermo-shine"), null);
  await wait(300);
  assert.equal(root.getAttribute("aria-valuetext"), "68 °F");
  dispose();
  const [el2, dispose2] = mount(() => h(Thermometer, { value: 0, color: "brand-blue", size: 300, parts: { readout: false, labels: false } }));
  assert.equal(el2.querySelector(".m-thermo-liquid").style.getPropertyValue("fill"), "var(--m-brand-blue, var(--m-cat-2))");
  assert.equal(el2.querySelector(".m-thermo").style.getPropertyValue("--m-thermo-h"), "300px");
  assert.equal(el2.querySelector(".m-thermo-readout"), null);
  assert.equal(el2.querySelector(".m-thermo-label"), null);
  dispose2();
});
