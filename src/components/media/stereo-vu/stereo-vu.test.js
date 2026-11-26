import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { StereoVu, vuDb } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const needles = (el) => [...el.querySelectorAll(".m-gauge-needle")].map((n) => Number(/rotate\(([-\d.]+)/.exec(n.getAttribute("transform"))[1]));
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("vuDb: the 0 VU reference, silence", () => {
  assert.equal(vuDb(0.5), 0);
  assert.ok(Math.abs(vuDb(1) - 6.0206) < 1e-3);
  assert.equal(vuDb(0), -Infinity);
  assert.equal(vuDb(0.126, 0.126), 0);
});

test("StereoVu: a group of two VU meters (left, right) with letters and peak lights", () => {
  const [el, dispose] = mount(() => h(StereoVu, { value: [0.5, 0.25], motion: false, label: "Deck" }));
  const root = el.querySelector(".m-svu");
  assert.equal(root.getAttribute("role"), "group");
  assert.equal(root.getAttribute("aria-label"), "Deck");
  const meters = [...el.querySelectorAll(".m-gauge")];
  assert.equal(meters.length, 2);
  assert.ok(meters.every((m) => m.classList.contains("m-gauge-vu") && m.getAttribute("role") === "meter"));
  assert.equal(meters[0].getAttribute("aria-label"), "Deck, left");
  assert.equal(meters[1].getAttribute("aria-label"), "Deck, right");
  assert.equal(meters[0].getAttribute("aria-valuenow"), "0");
  assert.equal(meters[1].getAttribute("aria-valuetext"), "-6 dB");
  const [l, r] = needles(el);
  assert.ok(l > r, "the louder left needle stands further right");
  assert.deepEqual([...el.querySelectorAll(".m-svu-label")].map((x) => x.textContent), ["L", "R"]);
  assert.equal(el.querySelectorAll(".m-svu-light").length, 2);
  assert.equal(el.querySelector(".m-svu-light").getAttribute("aria-label"), "Reset peak, left");
  dispose();
});

test("StereoVu: a change swings the needles with VU ballistics (in between after a frame), retargets mid-way, motion off jumps", () => {
  const v = signal([0.05, 0.05]), motion = signal(true);
  const [el, dispose] = mount(() => h(StereoVu, { value: v, motion }));
  const start = needles(el)[0];
  v.set([0.5, 0.5]);
  E.step(16);
  const one = needles(el)[0];
  assert.ok(one > start, "moving");
  run(64);
  const mid = needles(el)[0];
  v.set([0.05, 0.05]);
  E.step(16);
  const back = needles(el)[0];
  assert.ok(back < mid + 3 && back > start, `retargets from where it is (${start} < ${back} ≤ ${mid})`);
  run(1000);
  assert.ok(Math.abs(needles(el)[0] - start) < 0.5, "settles");
  motion.set(false);
  v.set([0.5, 0.5]);
  assert.ok(Math.abs(needles(el)[0] - one) > 3, "motion off: on the value at once");
  dispose();
});

test("StereoVu: a peak light comes on over the level, holds then goes off; 0 hold latches until pressed", async () => {
  const v = signal([0.2, 0.2]), hold = signal(30), peaks = [], resets = [];
  const [el, dispose] = mount(() => h(StereoVu, { value: v, peakHold: hold, motion: false, onPeak: (c) => peaks.push(c), onPeakReset: (c) => resets.push(c) }));
  const lights = () => [...el.querySelectorAll(".m-svu-light")].map((b) => b.classList.contains("is-on"));
  v.set([0.6, 0.2]); // +1.6 VU on the left
  assert.deepEqual(lights(), [true, false]);
  assert.deepEqual(peaks, [0]);
  assert.equal(el.querySelector(".m-svu-light").getAttribute("aria-pressed"), "true");
  await wait(60);
  assert.deepEqual(lights(), [false, false], "held, then off");
  hold.set(0);
  v.set([0.2, 0.7]);
  await wait(60);
  assert.deepEqual(lights(), [false, true], "latched");
  el.querySelectorAll(".m-svu-light")[1].click();
  assert.deepEqual(lights(), [false, false]);
  assert.deepEqual(resets, [1]);
  dispose();
});

test("StereoVu: a source drives both needles from its left and right levels", async () => {
  const loud = signal(0.5);
  const [el, dispose] = mount(() => h(StereoVu, { source: () => loud(), motion: false }));
  await import("../../../audio/index.ts"); await wait(0);
  E.step(16);
  const meters = [...el.querySelectorAll(".m-gauge")];
  await wait(300);
  assert.equal(meters[0].getAttribute("aria-valuenow"), "0");
  assert.equal(meters[1].getAttribute("aria-valuenow"), "0");
  dispose();
});

test("StereoVu: every prop is reactive after mount", async () => {
  const value = signal(0.5), reference = signal(0.5), peak = signal(1), labels = signal(undefined), label = signal("A"), panel = signal("metal"), size = signal(220), parts = signal({}), caption = signal(undefined), channelNames = signal(undefined), peakLabel = signal(undefined), redline = signal(0);
  const [el, dispose] = mount(() => h(StereoVu, { value, reference, peak, labels, label, panel, size, parts, caption, channelNames, peakLabel, redline, motion: false }));
  const root = el.querySelector(".m-svu");
  const gauge = () => el.querySelector(".m-gauge");
  reference.set(0.25); await wait(300); assert.equal(gauge().getAttribute("aria-valuenow"), "3", "+6 dB clamps to the scale's +3 (spoken at most 4 times a second)");
  labels.set(["A", "B"]); assert.equal(el.querySelector(".m-svu-label").textContent, "A");
  label.set("Kayıt"); assert.equal(root.getAttribute("aria-label"), "Kayıt");
  channelNames.set(["sol", "sağ"]); assert.equal(gauge().getAttribute("aria-label"), "Kayıt, sol");
  peakLabel.set("Söndür"); assert.equal(el.querySelector(".m-svu-light").getAttribute("aria-label"), "Söndür, sol");
  panel.set("wood"); assert.ok(root.classList.contains("m-svu-wood"));
  size.set(300); assert.equal(root.style.getPropertyValue("--m-svu-w"), "300px");
  caption.set("dB"); assert.equal(el.querySelector(".m-gauge-caption").textContent, "dB");
  redline.set(false); assert.equal(el.querySelectorAll(".m-gauge-zone.is-red").length, 0);
  peak.set(false); assert.equal(el.querySelectorAll(".m-svu-light").length, 0);
  parts.set({ labels: false, panel: false, caption: false, glass: false, ticks: false });
  assert.equal(el.querySelectorAll(".m-svu-label").length, 0);
  assert.ok(root.classList.contains("m-svu-bare") && root.classList.contains("m-svu-noglass"));
  assert.equal(el.querySelector(".m-gauge-caption"), null);
  assert.equal(el.querySelectorAll(".m-gauge-label").length, 0);
  value.set(0.1); await wait(300); assert.equal(gauge().getAttribute("aria-valuenow"), "-8");
  dispose();
});
