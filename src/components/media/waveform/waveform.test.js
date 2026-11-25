import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const { manualClock, step } = await import("../../../motion/engine/clock.ts");
const { Waveform, resamplePeaks, decodePeaks } = await import("./index.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const fire = (el, type, o = {}) => el.dispatchEvent(Object.assign(new globalThis.Event(type, { bubbles: true, cancelable: true }), o));
const tick = () => new Promise((r) => setTimeout(r, 0));

test("Waveform: resamplePeaks keeps the loudest of each bucket and repeats when there are fewer peaks", () => {
  assert.deepEqual([...resamplePeaks([0.1, 0.9, 0.2, 0.4], 2)].map((x) => +x.toFixed(2)), [0.9, 0.4]);
  assert.deepEqual([...resamplePeaks([0.5, -1], 4)].map((x) => +x.toFixed(2)), [0.5, 0.5, 1, 1]);
});

test("Waveform: peaks with a playhead are an image with the duration; parts, sizes and colors are hooks", () => {
  const t = signal(30);
  const [el, dispose] = mount(() => h(Waveform, { peaks: [0.2, 0.8, 0.5], currentTime: t, duration: 120, height: 40, barWidth: 4, gap: 1, color: "cat-2", progressColor: "brand-blue", align: "bottom", class: "mine", regions: [{ start: 0, end: 60, label: "Intro" }] }));
  const root = el.querySelector(".m-wave");
  assert.ok(root.classList.contains("mine") && root.classList.contains("m-wave-bottom"));
  assert.equal(root.getAttribute("role"), "img");
  assert.equal(root.getAttribute("aria-label"), "Waveform, 2:00");
  assert.equal(root.getAttribute("data-m-color"), "brand-blue");
  assert.equal(root.style.getPropertyValue("--m-wave-h"), "40px");
  assert.equal(root.style.getPropertyValue("--m-wave-bar"), "var(--m-cat-2)");
  assert.ok(root.querySelector("canvas.m-wave-canvas"));
  const head = root.querySelector(".m-wave-playhead");
  assert.equal(head.style.getPropertyValue("--m-wave-p"), "0.25");
  t.set(60);
  assert.equal(head.style.getPropertyValue("--m-wave-p"), "0.5");
  assert.equal(root.querySelector(".m-wave-mark").textContent, "Intro");
  assert.equal(root.querySelector(".m-wave-region").getAttribute("data-m-color"), "cat-1");
  dispose();
  const [el2, d2] = mount(() => h(Waveform, { peaks: [0.5], progress: 0.5, playhead: false, regionLabels: false, regions: [{ start: 0, end: 0.5, label: "A" }] }));
  assert.equal(el2.querySelector(".m-wave-playhead"), null);
  assert.equal(el2.querySelector(".m-wave-marks"), null);
  d2();
});

test("Waveform: seekable is a slider — keys, a press and a press in a region", () => {
  const seeks = [], hits = [];
  const [el, dispose] = mount(() => h(Waveform, {
    peaks: [0.3, 0.6], duration: 200, seekable: true, onSeek: (p, s) => seeks.push([p, Math.round(s)]), onRegionClick: (r, i) => hits.push([r.label, i]),
    regions: [{ start: 0, end: 100, label: "Intro" }, { start: 100, end: 200, label: "Talk", color: "brand-green" }],
  }));
  const root = el.querySelector(".m-wave");
  assert.equal(root.getAttribute("role"), "slider");
  assert.equal(root.getAttribute("tabindex"), "0");
  assert.equal(root.getAttribute("aria-valuemax"), "200");
  assert.equal(root.getAttribute("aria-valuetext"), "0:00 of 3:20, Intro");
  fire(root, "keydown", { key: "ArrowRight" });
  assert.deepEqual(seeks.at(-1), [0.05, 10]);
  assert.equal(root.getAttribute("aria-valuenow"), "10");
  fire(root, "keydown", { key: "End" });
  assert.equal(root.getAttribute("aria-valuetext"), "3:20 of 3:20");
  fire(root, "keydown", { key: "Home" });
  assert.deepEqual(seeks.at(-1), [0, 0]);
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 48, right: 200, bottom: 48 });
  fire(root, "pointerdown", { clientX: 150, clientY: 10, pointerId: 1, button: 0 });
  fire(document, "pointerup", { clientX: 150, clientY: 10, pointerId: 1 });
  assert.deepEqual(seeks.at(-1), [0.75, 150]);
  assert.deepEqual(hits, [["Talk", 1]]);
  assert.match(root.getAttribute("aria-valuetext"), /2:30 of 3:20, Talk/);
  dispose();
});

test("Waveform: live without a source is decorative bars; with a source it reads it", async () => {
  const [el, dispose] = mount(() => h(Waveform, { live: true, bars: 12, motion: false }));
  const root = el.querySelector(".m-wave");
  assert.equal(root.getAttribute("aria-hidden"), "true");
  assert.equal(root.querySelectorAll(".m-wave-bars i").length, 12);
  assert.equal(root.querySelector("canvas"), null);
  dispose();
  manualClock(true);
  const level = signal(0.6);
  const [el2, d2] = mount(() => h(Waveform, { source: () => level(), label: "Mic" }));
  const live = el2.querySelector(".m-wave");
  assert.ok(live.classList.contains("is-live"));
  assert.equal(live.getAttribute("role"), "img");
  assert.equal(live.getAttribute("aria-label"), "Mic");
  assert.equal(live.getAttribute("data-state"), "live");
  step(16); step(100); step(100);
  d2();
  manualClock(false);
  await tick();
});

test("Waveform: src is fetched and decoded once, then gives the duration", async () => {
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }; };
  globalThis.OfflineAudioContext = class { decodeAudioData() { const d = new Float32Array(2048).map((_, i) => Math.sin(i / 50) * 0.5); return Promise.resolve({ length: d.length, duration: 65, numberOfChannels: 1, getChannelData: () => d }); } };
  const loaded = [];
  const [el, dispose] = mount(() => h(Waveform, { src: "/voice.ogg", onLoad: (d) => loaded.push(d.duration), motion: false }));
  for (let i = 0; i < 5 && !loaded.length; i++) await tick();
  assert.deepEqual(loaded, [65]);
  const root = el.querySelector(".m-wave");
  assert.equal(root.getAttribute("data-state"), "ready");
  assert.equal(root.getAttribute("aria-label"), "Waveform, 1:05");
  const again = await decodePeaks("/voice.ogg");
  assert.equal(fetches, 1);
  assert.equal(Math.max(...again.peaks), 1, "normalized");
  dispose();
  delete globalThis.fetch; delete globalThis.OfflineAudioContext;
});
