import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { Gauge, dialStep, dialGeometry } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const needle = (el) => Number(/rotate\(([-\d.]+)/.exec(el.querySelector(".m-gauge-needle").getAttribute("transform"))[1]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };

test("dialStep and the dial geometry", () => {
  assert.equal(dialStep(240, 10), 20, "a step that ends on 240");
  assert.equal(dialStep(7, 10), 1);
  assert.equal(dialStep(100, 10), 10);
  assert.equal(dialStep(8000, 8), 1000);
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

test("Gauge: needle, readout and color follow later values (getters)", () => {
  const ne = signal("none"), ro = signal(true), co = signal(undefined), v = signal(0);
  const [el, dispose] = mount(() => h(Gauge, { get value() { return v(); }, get needle() { return ne(); }, get readout() { return ro(); }, get color() { return co(); } }));
  const root = el.querySelector(".m-gauge");
  v.set(100); E.step(16);
  assert.equal(needle(el), 135, "needle none: at once");
  ne.set("spring"); v.set(0); E.step(16);
  assert.ok(needle(el) > 0, "a spring needle is on its way down");
  run(3000);
  assert.ok(Math.abs(needle(el) + 135) < 1, "and lands");
  assert.ok(el.querySelector(".m-gauge-value"), "a rolling number");
  ro.set("odometer");
  assert.ok(el.querySelector(".m-gauge-readout .m-odo"), "drums");
  ro.set(false);
  assert.equal(el.querySelector(".m-gauge-readout"), null);
  co.set("brand-blue");
  assert.equal(root.getAttribute("data-m-color"), "brand-blue");
  dispose();
});

test("Gauge: a source given later (a getter) drives the needle; taking it away returns to the value", async () => {
  const on = signal(false);
  const loud = () => 0.5;
  const [el, dispose] = mount(() => h(Gauge, { value: 10, motion: false, get source() { return on() ? loud : undefined; } }));
  const root = el.querySelector(".m-gauge");
  assert.equal(root.getAttribute("aria-valuenow"), "10");
  on.set(true);
  await import("../../../audio/index.ts"); await new Promise((r) => setTimeout(r, 0));
  E.step(16);
  assert.equal(needle(el), 0, "half of 0–100 points up");
  on.set(false);
  assert.equal(needle(el), -108, "back on 10");
  dispose();
});

// Rule "data changes animate": a new value tweens on the motion engine, an interrupted tween retargets from where the
// needle is, and motion={false} jumps.
test("Gauge animates every value change: between old and new after one frame, retargets mid-tween, motion off jumps", () => {
  const v = signal(0);
  const [el, dispose] = mount(() => [h(Gauge, { value: v, class: "a" }), h(Gauge, { value: v, motion: false, class: "b" })]);
  const [a, b] = el.querySelectorAll(".m-gauge");
  v.set(100); E.step(16);
  const first = needle(a);
  assert.ok(first > -135 && first < 135, `between the old and the new angle (${first})`);
  assert.equal(needle(b), 135, "motion off: jumps");
  run(64);
  const mid = needle(a);
  assert.ok(mid > first, "still on its way up");
  v.set(0); E.step(16);
  const back = needle(a);
  assert.ok(back > -135 && back < 135 && Math.abs(back - mid) < 60, `retargets from where it is (${mid} → ${back}), no jump`);
  run(3000);
  assert.ok(Math.abs(needle(a) + 135) < 0.5, "lands on the new target");
  dispose();
});

const extras = (el) => [...el.querySelectorAll(".m-gauge-needle.is-extra")].map((n) => Number(/rotate\(([-\d.]+)/.exec(n.getAttribute("transform"))[1]));

test("Gauge needles: each extra needle tweens on its own, keeps its node when the array is rebuilt, and is spoken", async () => {
  const a = signal(20), b = signal(50);
  const [el, dispose] = mount(() => h(Gauge, { value: 10, unit: "%", label: "Load",
    get needles() { return [{ value: a(), label: "Average", color: "info", length: 0.7 }, { value: b(), label: "Max", move: "none" }]; } }));
  const root = el.querySelector(".m-gauge");
  const nodes = [...el.querySelectorAll(".m-gauge-needle.is-extra")];
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].style.getPropertyValue("--m-gauge-needle"), "var(--m-info)");
  assert.deepEqual(extras(el), [-81, 0]);
  a.set(80); b.set(100); E.step(16);
  const [x, y] = extras(el);
  assert.ok(x > -81 && x < 81, `the spring needle is between (${x})`);
  assert.equal(y, 135, "move: none jumps");
  assert.deepEqual([...el.querySelectorAll(".m-gauge-needle.is-extra")], nodes, "the same nodes, not new ones");
  run(3000);
  assert.ok(Math.abs(extras(el)[0] - 81) < 0.5);
  await wait(300);
  assert.equal(root.getAttribute("aria-valuetext"), "10 %, Average 80 %, Max 100 %");
  dispose();
});

test("Gauge without value: only the needles, the first is aria-valuenow, no readout", async () => {
  const [el, dispose] = mount(() => h(Gauge, { needles: [{ value: 30 }], motion: false }));
  assert.equal(el.querySelectorAll(".m-gauge-needle").length, 1);
  assert.equal(el.querySelector(".m-gauge-readout"), null);
  await wait(300);
  assert.equal(el.querySelector(".m-gauge").getAttribute("aria-valuenow"), "30");
  dispose();
});

test("Gauge full circle: sweep 360 from start 0 wraps (no clamp, one turn per span), one mark at the top, turn rotates the scale", () => {
  const v = signal(15), turn = signal(0);
  const [el, dispose] = mount(() => h(Gauge, { value: v, max: 60, sweep: 360, start: 0, turn, motion: false, ticks: { step: 5 }, inlay: h("i", { class: "mine" }) }));
  assert.equal(needle(el), 90, "15 of 60 is a quarter turn");
  v.set(75);
  assert.equal(needle(el), 90, "75 wraps to the same place");
  v.set(-15);
  assert.equal(needle(el), -90);
  const labels = [...el.querySelectorAll(".m-gauge-label")].map((x) => x.textContent);
  assert.equal(labels.length, 12, "0 and 60 share one mark");
  assert.ok(el.querySelector(".m-gauge-track").getAttribute("d").split("A").length === 3, "a full circle is two arcs");
  turn.set(-90);
  assert.match(el.querySelector(".m-gauge-scale").getAttribute("transform"), /^rotate\(-90 /);
  assert.ok(el.querySelector(".m-gauge-inlay .mine"), "the inlay is drawn on the face");
  dispose();
});

test("Gauge turn tweens like a needle; unwrap takes the short way round", async () => {
  const { unwrap } = await import("./index.ts");
  assert.equal(unwrap(350, 10, 360), 370);
  assert.equal(unwrap(10, 350, 360), -10);
  assert.equal(unwrap(720, 90, 360), 810);
  const turn = signal(0);
  const [el, dispose] = mount(() => h(Gauge, { value: 0, sweep: 360, turn }));
  turn.set(-90); E.step(16);
  const r = Number(/rotate\(([-\d.]+)/.exec(el.querySelector(".m-gauge-scale").getAttribute("transform"))[1]);
  assert.ok(r < 0 && r > -90, `turning (${r})`);
  run(3000);
  assert.match(el.querySelector(".m-gauge-scale").getAttribute("transform"), /^rotate\(-90 /);
  dispose();
});
