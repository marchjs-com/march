import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { manualClock, step } = await import("../../../motion/engine/clock.ts");
const { LiveFeed, FEED_ENTER, FEED_LEAVE } = await import("./index.ts");

const titles = (el) => [...el.querySelectorAll(".hm-lf-item")].filter((x) => !x.classList.contains("is-leaving")).map((x) => x.querySelector(".hm-listrow-title").textContent);

test("LiveFeed: controlled items, newest on top, at most max", () => {
  const items = signal([{ id: 2, title: "two" }, { id: 1, title: "one" }]);
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(LiveFeed, { items, max: 3 }), el);
  assert.deepEqual(titles(el), ["two", "one"]);
  items.set([{ id: 4, title: "four" }, { id: 3, title: "three" }, ...items.peek()]);
  assert.deepEqual(titles(el).slice(0, 3), ["four", "three", "two"]);
  assert.equal(el.querySelector("section").getAttribute("aria-label"), "Live activity");
  assert.equal(el.querySelector("ul").getAttribute("aria-live"), "off");
  dispose();
});

test("LiveFeed: next() pulls on the clock; hover and the pause button stop it", () => {
  manualClock(true);
  let k = 0;
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(LiveFeed, { next: () => ({ id: k, title: `n${k++}` }), every: 100, max: 4, live: "polite" }), el);
  assert.equal(titles(el).length, 4, "starts full");
  for (let i = 0; i < 7; i++) step(16);
  assert.equal(titles(el)[0], "n4", "one more after 100 ms of clock time");
  assert.equal(titles(el).length, 4, "never more than max");
  const btn = el.querySelector(".hm-lf-pause");
  btn.click();
  assert.equal(btn.getAttribute("aria-pressed"), "true");
  assert.equal(el.querySelector("ul").getAttribute("aria-live"), "off", "not announced while paused");
  for (let i = 0; i < 20; i++) step(16);
  assert.equal(titles(el)[0], "n4", "paused: nothing new");
  btn.click();
  el.querySelector("section").dispatchEvent(new globalThis.Event("pointerenter"));
  for (let i = 0; i < 20; i++) step(16);
  assert.equal(titles(el)[0], "n4", "hovered: nothing new");
  el.querySelector("section").dispatchEvent(new globalThis.Event("pointerleave"));
  for (let i = 0; i < 7; i++) step(16);
  assert.equal(titles(el)[0], "n5");
  dispose();
  manualClock(false);
});

test("LiveFeed: next is read once (a JSX getter that builds a new source each read still works)", () => {
  manualClock(true);
  const source = () => { let k = 0; return () => ({ id: k, title: `s${k++}` }); };
  const el = document.createElement("div"); document.body.appendChild(el);
  const props = { every: 50, max: 3 };
  Object.defineProperty(props, "next", { get: source, enumerable: true });
  const dispose = render(() => h(LiveFeed, props), el);
  assert.deepEqual(titles(el), ["s2", "s1", "s0"]);
  dispose();
  manualClock(false);
});

test("LiveFeed: every enter / leave preset gives keyframes; a custom motion and other presets run", () => {
  for (const [name, f] of [...Object.entries(FEED_ENTER), ...Object.entries(FEED_LEAVE)]) {
    const m = f({ wall: false, rtl: false });
    assert.ok(m.keyframes.opacity, `${name}: opacity`);
    for (const k of Object.keys(m.keyframes)) assert.ok(["opacity", "transform", "filter"].includes(k), `${name}: compositor only (${k})`);
  }
  assert.notEqual(FEED_ENTER.glide({ wall: false, rtl: true }).keyframes.transform[0], FEED_ENTER.glide({ wall: false, rtl: false }).keyframes.transform[0], "mirrored in RTL");
  manualClock(true);
  let k = 0;
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(LiveFeed, { next: () => ({ id: k, title: `m${k++}` }), every: 50, max: 2, enter: { keyframes: { opacity: [0, 1] }, duration: 100 }, leave: "fall", glow: false }), el);
  for (let i = 0; i < 10; i++) step(16);
  assert.equal(titles(el)[0], "m3");
  assert.equal(titles(el).length, 2);
  dispose();
  manualClock(false);
});

test("LiveFeed: own button texts, no pulse dot, own item content, hover does not pause when switched off", () => {
  manualClock(true);
  let k = 0;
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(LiveFeed, {
    next: () => ({ id: k, title: `n${k++}` }), every: 100, max: 3, pauseLabel: "On air", resumeLabel: "Stopped", pulse: false, pauseOnHover: false,
    renderItem: (it) => h("b", { class: "own" }, `#${it.title}`),
  }), el);
  const own = () => [...el.querySelectorAll(".hm-lf-item")].filter((x) => !x.classList.contains("is-leaving")).map((x) => x.querySelector(".own").textContent);
  assert.deepEqual(own(), ["#n2", "#n1", "#n0"]);
  assert.equal(el.querySelector(".hm-listrow-title"), null, "the default row parts are not drawn");
  assert.ok(el.querySelector(".hm-lf-item .hm-lf-glow"), "the glow stays");
  const btn = el.querySelector(".hm-lf-pause");
  assert.equal(btn.textContent, "On air");
  assert.equal(btn.querySelector(".hm-lf-pulse"), null);
  el.querySelector("section").dispatchEvent(new globalThis.Event("pointerenter"));
  for (let i = 0; i < 7; i++) step(16);
  assert.equal(own()[0], "#n3", "still pulling while hovered");
  btn.click();
  assert.equal(btn.textContent, "Stopped");
  dispose();
  manualClock(false);
});

test("LiveFeed: enter and leave can be switched off", () => {
  manualClock(true);
  let k = 0;
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(LiveFeed, { next: () => ({ id: k, title: `q${k++}` }), every: 50, max: 2, enter: "none", leave: "none" }), el);
  for (let i = 0; i < 10; i++) step(16);
  assert.equal(titles(el)[0], "q3");
  assert.equal(el.querySelectorAll(".hm-lf-item").length, 2, "the oldest is removed at once, nothing lingers");
  dispose();
  manualClock(false);
});
