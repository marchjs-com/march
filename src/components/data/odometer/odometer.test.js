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
  assert.ok(el.querySelector(".m-odo-roll.has-frac"), "fraction drums are marked");
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
