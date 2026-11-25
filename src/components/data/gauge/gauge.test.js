import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { Gauge, niceStep, dialGeometry } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const needle = (el) => Number(/rotate\(([-\d.]+)/.exec(el.querySelector(".m-gauge-needle").getAttribute("transform"))[1]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };

test("niceStep and the dial geometry", () => {
  assert.equal(niceStep(240, 10), 20, "a step that ends on 240");
  assert.equal(niceStep(7, 10), 1);
  assert.equal(niceStep(100, 10), 10);
  assert.equal(niceStep(8000, 8), 1000);
  assert.equal(dialGeometry("speedometer", 270).h, 200);
  assert.ok(dialGeometry("half", 180).h < 200);
});

test("Gauge: a meter with min / max / value text, ticks with labels, the readout and the needle angle", () => {
  const [el, dispose] = mount(() => h(Gauge, { value: 120, max: 240, unit: "km/h", label: "Speed", motion: false }));
  const root = el.querySelector(".m-gauge");
  assert.equal(root.getAttribute("role"), "meter");
  assert.equal(root.getAttribute("aria-label"), "Speed");
  assert.equal(root.getAttribute("aria-valuemin"), "0");
  assert.equal(root.getAttribute("aria-valuemax"), "240");
  assert.equal(root.getAttribute("aria-valuenow"), "120");
  assert.equal(root.getAttribute("aria-valuetext"), "120 km/h");
  assert.ok(root.classList.contains("is-round"));
  assert.equal(needle(el), 0, "the middle of a 270° scale points up");
  const labels = [...el.querySelectorAll(".m-gauge-label")].map((x) => x.textContent);
  assert.equal(labels[0], "0"); assert.equal(labels.at(-1), "240");
  assert.match(el.querySelector(".m-gauge-readout").textContent, /120/);
  assert.equal(el.querySelector(".m-gauge-unit").textContent, "km/h");
  assert.equal(el.querySelector(".m-gauge-svg").getAttribute("aria-hidden"), "true");
  dispose();
});

test("Gauge: the needle springs on the engine clock; motion off jumps; ARIA follows at most 4 times a second", async () => {
  const v = signal(0);
  const [el, dispose] = mount(() => [h(Gauge, { value: v, class: "a" }), h(Gauge, { value: v, motion: false, class: "b" })]);
  const [a, b] = el.querySelectorAll(".m-gauge");
  assert.equal(needle(a), -135);
  v.set(100);
  assert.equal(needle(b), 135, "motion off: on the value at once");
  assert.equal(needle(a), -135, "the spring has not moved yet");
  E.step(16); E.step(16);
  const mid = needle(a);
  assert.ok(mid > -135 && mid < 135, "moving");
  run(2000);
  assert.ok(Math.abs(needle(a) - 135) < 0.5, "settles on the value");
  assert.equal(a.getAttribute("aria-valuenow"), "0", "the spoken value waits");
  await wait(300);
  assert.equal(a.getAttribute("aria-valuenow"), "100");
  dispose();
});

test("Gauge tachometer: ×1000 labels, a caption, the redline (red ticks, glow, onRedline) and the readout off", () => {
  const rpm = signal(3000), events = [];
  const [el, dispose] = mount(() => h(Gauge, { variant: "tachometer", value: rpm, readout: false, motion: false, onRedline: (on) => events.push(on) }));
  const root = el.querySelector(".m-gauge");
  assert.deepEqual([...el.querySelectorAll(".m-gauge-label")].map((x) => x.textContent), ["0", "1", "2", "3", "4", "5", "6", "7", "8"]);
  assert.equal(el.querySelector(".m-gauge-caption").textContent, "×1000 r/min");
  assert.ok(el.querySelector(".m-gauge-label.is-red"), "labels past 6500 are red");
  assert.ok(el.querySelector(".m-gauge-zone.is-red"));
  assert.equal(el.querySelector(".m-gauge-readout"), null);
  assert.ok(!root.classList.contains("is-redline"));
  rpm.set(7000);
  assert.ok(root.classList.contains("is-redline"));
  rpm.set(2000);
  assert.deepEqual(events, [true, false]);
  dispose();
});

test("Gauge vu: dB scale from an audio source (a number accessor), VU caption, no readout, 0 dB redline", async () => {
  const loud = signal(0.5);
  const [el, dispose] = mount(() => h(Gauge, { variant: "vu", source: () => loud(), motion: false }));
  const root = el.querySelector(".m-gauge");
  assert.ok(root.classList.contains("m-gauge-vu"));
  assert.equal(el.querySelector(".m-gauge-caption").textContent, "VU");
  assert.equal(el.querySelector(".m-gauge-readout"), null);
  assert.equal(el.querySelector(".m-gauge-hub"), null, "the pivot sits under the window");
  assert.equal(root.getAttribute("aria-valuemin"), "-20");
  await import("../../../audio/index.ts"); await new Promise((r) => setTimeout(r, 0)); // march/audio loads with the first source
  E.step(16);
  const at0 = needle(el);
  assert.ok(at0 > 0 && at0 < 48, "0 dB sits right of the middle on a voltage-linear scale");
  loud.set(0.05); E.step(16);
  assert.ok(needle(el) < at0);
  dispose();
});

test("Gauge: peak holds the highest value (onPeak), a number marks it; zones, colour, size, parts off, own readout", () => {
  const v = signal(30), peaks = [];
  const [el, dispose] = mount(() => [
    h(Gauge, { value: v, peak: true, onPeak: (x) => peaks.push(x), motion: false, class: "p", zones: [{ from: 0, to: 50, color: "success" }], color: "brand-blue", size: 300 }),
    h(Gauge, { value: 10, peak: 80, variant: "half", readout: "odometer", class: "o" }),
    h(Gauge, { value: 42, readout: (n) => h("b", { class: "mine" }, `${n}%`), parts: { ticks: false, labels: false, hub: false, glass: false, face: false, needle: false }, class: "q" }),
  ]);
  const p = el.querySelector(".p");
  assert.equal(p.getAttribute("data-m-color"), "brand-blue");
  assert.equal(p.style.getPropertyValue("--m-gauge-w"), "300px");
  assert.equal(p.querySelector(".m-gauge-zone").style.getPropertyValue("stroke"), "var(--m-success)");
  v.set(70); v.set(50); v.set(90);
  assert.deepEqual(peaks, [70, 90]);
  assert.match(p.querySelector(".m-gauge-peak").getAttribute("transform"), /^rotate\(108 /, "the peak mark sits at 90");
  const o = el.querySelector(".o");
  assert.ok(o.classList.contains("is-flat"));
  assert.ok(o.querySelector(".m-gauge-readout .m-odo"), "the readout on Odometer drums");
  assert.match(o.querySelector(".m-gauge-peak").getAttribute("transform"), /^rotate\(54 /);
  const q = el.querySelector(".q");
  assert.equal(q.querySelector(".mine").textContent, "42%");
  assert.ok(q.classList.contains("m-gauge-bare"));
  for (const k of ["ticks", "labels", "hub", "glass", "needle"]) assert.equal(q.querySelector(`.m-gauge-${k}`), null, k);
  dispose();
});
