import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { Odometer, drumText } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const drums = (el) => [...el.querySelectorAll(".m-roll-vis .m-roll-d, .m-roll-vis .m-roll-s")].map((c) => c.textContent).join(""); // without the leaving ghosts

test("drumText: zero-padded integer drums, truncated fraction drums, roll-over past the last drum", () => {
  assert.equal(drumText(1234.56, 6, 1), "001234.5");
  assert.equal(drumText(0.999, 3, 2), "000.99", "a fraction drum shows only what has passed");
  assert.equal(drumText(1234567, 6, 0), "234567", "rolls over like a real counter");
  assert.equal(drumText(-42, 4, 0), "0042", "the sign is not a drum");
  assert.equal(drumText(7.5, 2, 1, ","), "07,5");
});

test("Odometer: padded drums, a red fraction, the unit and a spoken name; only changed drums roll", () => {
  const km = signal(12345.6);
  const [el, dispose] = mount(() => h(Odometer, { value: km, digits: 6, decimals: 1, unit: "km" }));
  const root = el.querySelector(".m-odo");
  assert.equal(root.getAttribute("role"), "img");
  assert.ok(root.classList.contains("m-odo-mechanical"));
  assert.equal(drums(el), "012345.6");
  assert.ok(el.querySelector(".m-odo-roll.is-frac"), "fraction drums are marked");
  assert.equal(el.querySelector(".m-odo-unit").textContent, "km");
  assert.equal(root.getAttribute("aria-label"), "Odometer: 12,345.6 km");
  km.set(12345.7);
  assert.equal(el.querySelectorAll(".m-roll-slot").length, 1, "only the fraction drum moves");
  assert.equal(drums(el), "012345.7");
  dispose();
});

test("Odometer: variant, size, color, frame off, no unit, motion off, own label and spoken text, negative sign", () => {
  const n = signal(-8);
  const [el, dispose] = mount(() => h(Odometer, { value: n, digits: 3, variant: "digital", size: 36, color: "success", frame: false,
    motion: false, label: "Temp", spoken: (v) => `${v} degrees`, class: "mine" }));
  const root = el.querySelector(".m-odo");
  assert.ok(root.classList.contains("m-odo-digital") && root.classList.contains("m-odo-bare") && root.classList.contains("mine"));
  assert.equal(root.getAttribute("data-m-color"), "success");
  assert.equal(root.style.getPropertyValue("--m-odo-h"), "36px");
  assert.equal(el.querySelector(".m-odo-unit"), null);
  assert.equal(el.querySelector(".m-odo-sign").textContent, "−");
  assert.equal(root.getAttribute("aria-label"), "Temp: -8 degrees");
  n.set(9);
  assert.equal(el.querySelector(".m-roll-slot"), null, "motion off: no rolling slot");
  assert.equal(drums(el), "009");
  assert.equal(el.querySelector(".m-odo-sign"), null);
  dispose();
});

test("Odometer: a live digit count redraws the same value; the Turkish locale uses its decimal comma", () => {
  const d = signal(4);
  const [el, dispose] = mount(() => h(Odometer, { value: 3.25, digits: d, decimals: 2, unit: "kWh" }));
  assert.equal(drums(el), "0003.25");
  d.set(2);
  assert.equal(drums(el), "03.25");
  setLocale("tr");
  assert.equal(drums(el), "03,25");
  assert.match(el.querySelector(".m-odo").getAttribute("aria-label"), /3,25 kWh$/);
  setLocale("en");
  dispose();
});

test("Odometer: decimals, color and variant follow later values (getters)", () => {
  const dec = signal(1), co = signal(undefined), va = signal("mechanical");
  const [el, dispose] = mount(() => h(Odometer, { value: 12.5, digits: 3, get decimals() { return dec(); }, get color() { return co(); }, get variant() { return va(); }, motion: false }));
  const root = el.querySelector(".m-odo");
  assert.match(root.getAttribute("aria-label"), /12\.5/);
  dec.set(0);
  assert.doesNotMatch(root.getAttribute("aria-label"), /12\.5/);
  assert.ok(!el.querySelector(".m-odo-roll").classList.contains("is-frac"));
  co.set("success");
  assert.equal(root.getAttribute("data-m-color"), "success");
  va.set("flip");
  assert.ok(root.classList.contains("m-odo-flip"));
  dispose();
});

// Rule "data changes animate": a new value arrives through the roll cells (the old digit leaves as a ghost, the new one
// rolls in on the motion engine), never as an instant swap; a change mid-roll rolls on from the digit shown.
test("Odometer animates every change: new digits roll in through slots, an interrupted roll goes on from the shown digit", () => {
  const n = signal(16);
  const [el, dispose] = mount(() => h(Odometer, { value: n, digits: 2 }));
  n.set(17);
  const slot = el.querySelector(".m-roll-slot");
  assert.ok(slot, "the changed drum rolls");
  assert.equal(slot.querySelector(".m-roll-ghost").textContent, "6", "the old digit leaves");
  assert.equal(slot.querySelector(".m-roll-d").textContent, "7", "the new digit arrives");
  assert.equal(el.querySelectorAll(".m-roll-slot").length, 1, "the unchanged drum stays");
  n.set(18);
  const again = el.querySelector(".m-roll-slot");
  assert.equal(again.querySelector(".m-roll-ghost").textContent, "7", "rolls on from what is shown");
  assert.equal(drums(el), "18");
  dispose();
});
