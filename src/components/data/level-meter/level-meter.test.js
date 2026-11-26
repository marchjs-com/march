import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { LevelMeter } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const lit = (m) => m.style.getPropertyValue("--m-lm-lit");

test("LevelMeter: segments built once, a value lights a count by one variable, zones and ARIA", () => {
  const value = signal(0.5);
  const [el, dispose] = mount(() => h(LevelMeter, { value, segments: 20, label: "Input" }));
  const meter = el.querySelector(".m-lm-meter");
  const segs = el.querySelectorAll(".m-lm-seg");
  assert.equal(segs.length, 20);
  assert.equal(meter.getAttribute("role"), "meter");
  assert.equal(meter.getAttribute("aria-label"), "Input");
  assert.equal(lit(meter), "10");
  assert.equal(meter.getAttribute("aria-valuenow"), "50");
  assert.equal(meter.getAttribute("aria-valuetext"), "50%");
  assert.ok(segs[0].classList.contains("is-low") && segs[15].classList.contains("is-mid") && segs[19].classList.contains("is-high"));
  value.set(0.8);
  assert.equal(lit(meter), "16");
  assert.equal(el.querySelectorAll(".m-lm-seg").length, 20, "no node churn");
  assert.strictEqual(el.querySelectorAll(".m-lm-seg")[0], segs[0], "the same nodes");
  assert.equal(el.querySelector(".m-lm-label"), null, "mono: no channel letter");
  dispose();
});

test("LevelMeter: stereo value, L / R, peak holds then falls on the clock; motion off makes it jump", () => {
  const value = signal([0.9, 0.4]);
  const [el, dispose] = mount(() => [h(LevelMeter, { value, segments: 10, peakHold: 100, clip: false }), h(LevelMeter, { value: () => value()[0], segments: 10, peakHold: 100, motion: false, clip: false })]);
  const [l, r, still] = el.querySelectorAll(".m-lm-meter");
  assert.deepEqual([...el.querySelectorAll(".m-lm-label")].map((x) => x.textContent), ["L", "R"]);
  assert.equal(l.getAttribute("aria-label"), "Level, left");
  assert.equal(r.getAttribute("aria-label"), "Level, right");
  assert.equal(lit(l), "9"); assert.equal(lit(r), "4");
  const peakOf = (m) => [...m.querySelectorAll(".m-lm-seg")].findIndex((s) => s.classList.contains("is-peak"));
  assert.equal(peakOf(l), 8);
  value.set([0.2, 0.2]);
  assert.equal(lit(l), "2");
  assert.equal(peakOf(l), 8, "held");
  assert.equal(peakOf(still), 8);
  E.step(50); assert.equal(peakOf(l), 8, "still held");
  E.step(80); E.step(200);
  const fell = peakOf(l);
  assert.ok(fell < 8 && fell > 1, `falls gradually (at ${fell})`);
  assert.equal(peakOf(still), 1, "motion off: drops to the level at once");
  for (let i = 0; i < 100; i++) E.step(32);
  assert.equal(peakOf(l), 1, "rests on the level");
  assert.equal(el.querySelector(".m-lm-clip"), null, "clip={false}: no clip light");
  dispose();
});

test("LevelMeter: the clip light latches and a press resets it", () => {
  const value = signal(0.3);
  const seen = [];
  let resets = 0;
  const [el, dispose] = mount(() => h(LevelMeter, { value, onClip: (c) => seen.push(c), onClipReset: () => resets++, clipLabel: "Clear" }));
  const btn = el.querySelector(".m-lm-clip");
  assert.equal(btn.tagName, "BUTTON");
  assert.equal(btn.getAttribute("aria-label"), "Clear");
  assert.equal(btn.getAttribute("aria-pressed"), "false");
  value.set(1);
  assert.ok(btn.classList.contains("is-on"));
  assert.ok(btn.querySelector(".m-status-dot.is-danger"));
  assert.deepEqual(seen, [0]);
  value.set(0.2);
  assert.ok(btn.classList.contains("is-on"), "latched");
  btn.click();
  assert.equal(resets, 1);
  assert.ok(!btn.classList.contains("is-on"));
  assert.ok(btn.querySelector(".m-status-dot.is-neutral"));
  dispose();
});

test("LevelMeter: a source drives it on the clock; dB scale, ticks, horizontal, min / max", async () => {
  const v = signal(0.5);
  const [el, dispose] = mount(() => [
    h(LevelMeter, { source: () => v(), channels: 1, scale: "db", floor: -48, ticks: true, segments: 48, orientation: "horizontal", variant: "flat", size: "lg", length: 200 }),
    h(LevelMeter, { value: 50, min: 0, max: 200, segments: 8, ticks: [0, 100, 200], format: (x) => `${Math.round(x * 200)} units` }),
  ]);
  const [a, b] = el.querySelectorAll(".m-lm");
  assert.ok(a.classList.contains("m-lm-h") && a.classList.contains("m-lm-flat") && a.classList.contains("m-lm-lg"));
  assert.equal(a.style.getPropertyValue("--m-lm-len"), "200px");
  const m = a.querySelector(".m-lm-meter");
  await import("../../../audio/index.ts"); await new Promise((r) => setTimeout(r, 0)); // march/audio loads with the first source
  E.step(16);
  // 0.5 linear = −6 dB → (−6 + 48) / 48 of 48 segments = 42
  assert.equal(lit(m), "42");
  assert.equal(m.getAttribute("aria-valuetext"), "-6 dB");
  assert.deepEqual([...a.querySelectorAll(".m-lm-tick")].map((x) => x.textContent), ["0", "-3", "-6", "-12", "-18", "-24", "-36", "-48"]);
  const bm = b.querySelector(".m-lm-meter");
  assert.equal(lit(bm), "2", "50 of 0–200 = a quarter of 8");
  assert.equal(bm.getAttribute("aria-valuetext"), "50 units");
  assert.deepEqual([...b.querySelectorAll(".m-lm-tick")].map((x) => x.style.getPropertyValue("--p")), ["0", "0.5", "1"]);
  dispose();
});

test("LevelMeter: source and channels follow later values (getters): a value, then a source, then mono", async () => {
  const which = signal("value"), ch = signal(undefined);
  const src = () => 0.5;
  const [el, dispose] = mount(() => h(LevelMeter, { value: 0.25, segments: 20, get source() { return which() === "src" ? src : undefined; }, get channels() { return ch(); } }));
  assert.equal(el.querySelectorAll(".m-lm-meter").length, 1);
  assert.equal(lit(el.querySelector(".m-lm-meter")), "5", "the value");
  which.set("src");
  assert.equal(el.querySelectorAll(".m-lm-meter").length, 2, "a source is stereo");
  await import("../../../audio/index.ts"); await new Promise((r) => setTimeout(r, 0));
  E.step(16); E.step(16);
  assert.equal(lit(el.querySelectorAll(".m-lm-meter")[1]), "10", "the source drives both channels");
  ch.set(1);
  assert.equal(el.querySelectorAll(".m-lm-meter").length, 1, "mono");
  E.step(16); E.step(16);
  assert.equal(lit(el.querySelector(".m-lm-meter")), "10");
  which.set("value");
  assert.equal(lit(el.querySelector(".m-lm-meter")), "5", "back to the value");
  E.step(16); E.step(16);
  assert.equal(lit(el.querySelector(".m-lm-meter")), "5", "the old source writes no more");
  dispose();
});
