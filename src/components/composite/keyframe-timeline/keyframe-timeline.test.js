import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const M = await import("./model.ts");
const { KeyframeTimeline } = await import("./index.ts");

const MODEL = { duration: 1000, tracks: [
  { id: "a", target: "logo", prop: "x", keys: [{ at: 0, value: 0 }, { at: 1000, value: 100, easing: "linear" }] },
  { id: "b", target: "logo", prop: "opacity", keys: [{ at: 0, value: 0 }, { at: 500, value: 1 }] },
  { id: "c", target: "title", prop: "scale", keys: [{ at: 200, value: 1 }] },
] };

test("model: sampling with the engine's easings, CSS variables, engine code", () => {
  assert.equal(M.sampleTrack(MODEL.tracks[0], 250), 25);
  assert.equal(M.sampleTrack(MODEL.tracks[1], 250), 0.5, "in-out is symmetric at the middle");
  assert.equal(M.sampleTrack(MODEL.tracks[1], 900), 1, "after the last key: its value");
  assert.equal(M.sampleTrack(MODEL.tracks[2], 0), 1, "before the first key: its value");
  assert.deepEqual(M.sample(MODEL, 500), { logo: { x: 50, opacity: 1 }, title: { scale: 1 } });
  assert.deepEqual(M.targetVars({ x: 12.3456, opacity: 0.5 }), { "--hm-kt-x": "12.346", "--hm-kt-y": "0", "--hm-kt-s": "1", "--hm-kt-r": "0", "--hm-kt-o": "0.5" });
  assert.match(M.timelineCode(MODEL), /\.add\("#logo", \[\{ translate: "0px 0" \}, \{ translate: "100px 0" \}\], \{ at: 0, duration: 1000, easing: "linear" \}\)/);
});

test("KeyframeTimeline: lanes with keyframe sliders, keyboard moves and deletes, playhead, transport", () => {
  const v = signal(structuredClone(MODEL));
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => h(KeyframeTimeline, { "bind:value": v }), el);
  assert.equal(el.querySelectorAll(".hm-kt-row").length, 3);
  const keys = () => el.querySelectorAll(".hm-kt-key");
  assert.equal(keys().length, 5);
  assert.equal(keys()[1].getAttribute("aria-label"), "Keyframe 2 of logo x");
  assert.equal(keys()[1].getAttribute("aria-valuenow"), "1000");
  keys()[3].dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(v().tracks[1].keys[1].at, 550, "one snap step (50 ms)");
  keys()[3].dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
  assert.equal(v().tracks[1].keys.length, 1);
  keys()[3].dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
  assert.equal(v().tracks[2].keys.length, 1, "a track keeps its last keyframe");
  const head = el.querySelector(".hm-kt-head");
  head.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "End", bubbles: true }));
  assert.equal(head.getAttribute("aria-valuetext"), "00:01.00");
  assert.equal(el.querySelector(".hm-kt-time b").textContent, "00:01.00");
  assert.deepEqual(el.querySelectorAll(".hm-kt-transport button").map((b) => b.getAttribute("aria-label")).filter(Boolean), ["Play", "Back to start", "Loop"]);
  assert.deepEqual(el.querySelectorAll(".hm-kt-speed [role=radio]").map((b) => b.textContent), ["0.25×", "0.5×", "1×", "2×"]);
  assert.equal(el.querySelectorAll(".hm-kt-actor").length, 2, "one preview target per target name");
  dispose();
});
