import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { LoudnessGraph } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const value = (el, k) => el.querySelector(`.m-lg-readout.is-${k} .m-lg-value`).firstChild.textContent;
const line = (el, key) => el.querySelector(`.is-loudness [data-series="${key}"] .m-chart-line`)?.getAttribute("d") ?? null;

test("LoudnessGraph: a group with readouts (meters), the loudness chart with target lines and the correlation chart", () => {
  const [el, dispose] = mount(() => h(LoudnessGraph, { value: { momentary: -14.04, shortTerm: -16, correlation: 0.5 }, motion: false, label: "Program" }));
  const root = el.querySelector(".m-lg");
  assert.equal(root.getAttribute("role"), "group");
  assert.equal(root.getAttribute("aria-label"), "Program");
  const meters = [...el.querySelectorAll(".m-lg-readout")];
  assert.deepEqual(meters.map((m) => m.getAttribute("aria-label")), ["Momentary", "Short-term", "Correlation"]);
  assert.ok(meters.every((m) => m.getAttribute("role") === "meter"));
  assert.equal(value(el, "momentary"), "-14.0");
  assert.equal(meters[0].getAttribute("aria-valuetext"), "-14.0 LUFS");
  assert.equal(value(el, "correlation"), "0.5");
  assert.equal(el.querySelector(".m-lg-corr-dot").style.getPropertyValue("--m-lg-pos"), "0.75");
  assert.equal(el.querySelectorAll(".m-lg-chart").length, 2);
  assert.ok(el.querySelector('.is-loudness [data-series="target0"]'), "the −14 target line");
  assert.ok(el.querySelector('.is-loudness [data-series="target1"]'), "the −23 target line");
  assert.ok(el.querySelector('.is-correlation [data-series="correlation"]'));
  dispose();
});

test("LoudnessGraph: readings are recorded on the clock (rate per second) into the history; paused stops it", () => {
  const v = signal({ momentary: -20, shortTerm: -20, correlation: 1 }), paused = signal(false), samples = [];
  const [el, dispose] = mount(() => h(LoudnessGraph, { value: v, rate: 10, span: 4, paused, motion: false, onSample: (s) => samples.push(s) }));
  assert.equal(line(el, "momentary"), "", "only gaps before the first reading");
  run(320);
  assert.equal(samples.length, 3);
  assert.deepEqual(samples[0], { momentary: -20, shortTerm: -20, integrated: null, correlation: 1 });
  assert.ok(line(el, "momentary").length > 0, "a line");
  paused.set(true);
  run(500);
  assert.equal(samples.length, 3, "paused");
  assert.ok(el.querySelector(".m-lg").classList.contains("is-paused"));
  dispose();
});

test("LoudnessGraph: a new reading tweens the readouts (in between after a frame), retargets mid-way, motion off jumps", () => {
  const v = signal({ momentary: -30 }), motion = signal(true);
  const [el, dispose] = mount(() => h(LoudnessGraph, { value: v, show: ["momentary"], duration: 200, motion, parts: { correlation: false } }));
  assert.equal(value(el, "momentary"), "-30.0");
  v.set({ momentary: -10 });
  E.step(16); E.step(16);
  const mid = Number(value(el, "momentary"));
  assert.ok(mid > -30 && mid < -10, `in between: ${mid}`);
  v.set({ momentary: -40 });
  E.step(16);
  const back = Number(value(el, "momentary"));
  assert.ok(back <= mid + 0.1 && back > -40, `from where it was: ${back}`);
  run(400);
  assert.equal(value(el, "momentary"), "-40.0");
  motion.set(false);
  v.set({ momentary: -5 });
  assert.equal(value(el, "momentary"), "-5.0", "motion off: at once");
  dispose();
});

test("LoudnessGraph: a source's loudness (march/audio) feeds the readouts and the history", async () => {
  const loud = signal(0.6);
  const [el, dispose] = mount(() => h(LoudnessGraph, { source: () => loud(), motion: false, rate: 20 }));
  await import("../../../audio/index.ts"); await wait(10);
  run(200);
  const m = Number(value(el, "momentary"));
  assert.ok(m > -12 && m < -4, `a loud tone: ${m}`);
  assert.equal(value(el, "correlation"), "1.0", "a number source is mono");
  assert.ok(line(el, "momentary").length > 0);
  dispose();
});

test("LoudnessGraph: every prop is reactive after mount", async () => {
  const v = signal({ momentary: -20, shortTerm: -18, integrated: -19, correlation: 0 });
  const show = signal(undefined), targets = signal(undefined), range = signal(undefined), height = signal(undefined), colors = signal(undefined), labels = signal(undefined), label = signal("A"), parts = signal({}), span = signal(10);
  const [el, dispose] = mount(() => h(LoudnessGraph, { value: v, show, targets, range, height, colors, labels, label, parts, span, motion: false }));
  show.set(["shortTerm", "integrated"]);
  assert.deepEqual([...el.querySelectorAll(".m-lg-readout")].map((m) => m.getAttribute("aria-label")), ["Short-term", "Integrated", "Correlation"]);
  assert.ok(el.querySelector('.is-loudness [data-series="integrated"]'));
  targets.set([{ value: -16, label: "Podcast", color: "danger" }]);
  assert.ok(el.querySelector('.is-loudness [data-series="target0"]'));
  assert.equal(el.querySelector('.is-loudness [data-series="target1"]'), null);
  assert.ok(el.querySelector(".is-loudness").textContent.includes("Podcast"));
  targets.set(false); assert.equal(el.querySelector('.is-loudness [data-series="target0"]'), null);
  range.set([-30, -6]); assert.ok(el.querySelector(".is-loudness").textContent.includes("-30"), "the axis follows the range");
  height.set(260); assert.ok(el.querySelector(".is-loudness svg").getAttribute("viewBox").endsWith(" 260"));
  colors.set({ shortTerm: "danger" });
  assert.equal(el.querySelector(".m-lg-readout.is-shortTerm").style.getPropertyValue("--m-lg-c"), "var(--m-danger)");
  labels.set({ shortTerm: "Kısa" }); assert.equal(el.querySelector(".m-lg-readout.is-shortTerm").getAttribute("aria-label"), "Kısa");
  label.set("Yayın"); assert.equal(el.querySelector(".m-lg").getAttribute("aria-label"), "Yayın");
  parts.set({ readouts: false, correlation: false });
  assert.equal(el.querySelectorAll(".m-lg-readout").length, 0);
  assert.equal(el.querySelectorAll(".m-lg-chart").length, 1);
  span.set(20);
  assert.ok(el.querySelector(".is-loudness").textContent.includes("-20"), "the time axis spans 20 s");
  dispose();
});
