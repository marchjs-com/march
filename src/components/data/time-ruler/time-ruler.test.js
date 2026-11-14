import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { TimeRuler, timeTicks, timePercent } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const key = (el, k, more = {}) => el.dispatchEvent(Object.assign(new Event("keydown", { bubbles: true, cancelable: true }), { key: k, ...more }));

test("timeTicks / timePercent: steps picked for the duration, or given", () => {
  const auto = timeTicks(2000);
  assert.equal(auto[0].at, 0);
  assert.equal(auto.at(-1).at, 2000);
  assert.ok(auto.length <= 41, `at most ~40 ticks: ${auto.length}`);
  assert.ok(auto.filter((k) => k.major).length <= 9);
  assert.deepEqual(timeTicks(1000, { step: 250, major: 500 }).map((k) => [k.at, k.major]), [[0, true], [250, false], [500, true], [750, false], [1000, true]]);
  assert.deepEqual(timeTicks(3000, { major: 1000, minor: false }).map((k) => k.at), [0, 1000, 2000, 3000]);
  assert.equal(timePercent(500, 2000), "25%");
  assert.equal(timePercent(5000, 2000), "100%");
  assert.equal(timePercent(1, 0), "0%");
});

test("TimeRuler: read-only ticks, labels and a head that follows the value", () => {
  const now = signal(500), duration = signal(2000);
  const [el, dispose] = mount(() => mProps(h(TimeRuler, { duration, value: now, step: 500, major: 1000 }), { color: "brand-orange" }));
  const root = el.querySelector(".m-time-ruler");
  assert.equal(root.getAttribute("aria-hidden"), "true");
  assert.equal(root.getAttribute("data-m-color"), "brand-orange");
  const ticks = [...root.querySelectorAll(".m-time-ruler-tick")];
  assert.equal(ticks.length, 5);
  assert.deepEqual(ticks.filter((k) => k.classList.contains("is-major")).map((k) => k.textContent), ["0s", "1s", "2s"]);
  assert.equal(ticks[1].style.getPropertyValue("--m-time-ruler-at"), "25%");
  const head = root.querySelector(".m-time-ruler-head");
  assert.equal(head.getAttribute("role"), null);
  assert.equal(head.style.getPropertyValue("--m-time-ruler-at"), "25%");
  now.set(1000);
  assert.equal(root.querySelector(".m-time-ruler-head"), head, "the head is moved, not rebuilt");
  assert.equal(head.style.getPropertyValue("--m-time-ruler-at"), "50%");
  duration.set(4000);
  assert.equal(root.querySelectorAll(".m-time-ruler-tick").length, 9);
  now.set(null);
  assert.equal(root.querySelector(".m-time-ruler-head"), null);
  dispose();
});

test("TimeRuler: seekable: a slider head with keys; own format, ticks, head and names", () => {
  const now = signal(1000), seen = [];
  const [el, dispose] = mount(() => [
    h(TimeRuler, { class: "one", duration: 2000, value: now, onSeek: (ms) => { seen.push(ms); now.set(ms); }, onSeekStart: () => seen.push("start"), keyStep: 50, valueText: (ms) => `${ms} ms` }),
    h(TimeRuler, { class: "two", duration: 1000, value: 0, onSeek: () => {}, ticks: () => [{ at: 0, major: true, label: "start" }, { at: 1000, major: true }], format: (ms) => `${ms}ms`, head: h("i", { class: "own" }), labels: { ruler: "Scrub", playhead: "Now" } }),
    h(TimeRuler, { class: "three", duration: 1000, value: 0, head: false }),
    h(TimeRuler, { class: "four", duration: 1000, value: 0, headClass: "my-head" }),
  ]);
  const one = el.querySelector(".one"), head = one.querySelector(".m-time-ruler-head");
  assert.equal(one.getAttribute("role"), "group");
  assert.equal(one.getAttribute("aria-label"), "Time ruler");
  assert.ok(one.classList.contains("is-seekable"));
  assert.equal(head.getAttribute("role"), "slider");
  assert.equal(head.getAttribute("aria-label"), "Playhead");
  assert.equal(head.getAttribute("aria-valuemax"), "2000");
  assert.equal(head.getAttribute("aria-valuenow"), "1000");
  assert.equal(head.getAttribute("aria-valuetext"), "1000 ms");
  key(head, "ArrowRight"); assert.equal(now(), 1050);
  key(head, "ArrowLeft", { shiftKey: true }); assert.equal(now(), 550);
  key(head, "End"); assert.equal(now(), 2000);
  key(head, "ArrowRight"); assert.equal(now(), 2000, "stays inside the duration");
  key(head, "Home"); assert.equal(now(), 0);
  assert.equal(seen.filter((x) => x === "start").length, 5);
  assert.equal(head.getAttribute("aria-valuenow"), "0");
  const two = el.querySelector(".two");
  assert.deepEqual([...two.querySelectorAll(".m-time-ruler-tick")].map((k) => k.textContent), ["start", "1000ms"]);
  assert.ok(two.querySelector(".m-time-ruler-head .own"));
  assert.ok(el.querySelector(".four .m-time-ruler-head.my-head"), "headClass: an extra class on the playhead");
  assert.equal(two.getAttribute("aria-label"), "Scrub");
  assert.equal(two.querySelector(".m-time-ruler-head").getAttribute("aria-label"), "Now");
  assert.equal(el.querySelector(".three .m-time-ruler-head"), null);
  dispose();
});
