import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { manualClock, step } = await import("../../../motion/engine/clock.ts");
const { LiveFeed } = await import("./index.ts");

const titles = (el) => [...el.querySelectorAll(".hm-lf-item")].filter((x) => !x.classList.contains("is-leaving")).map((x) => x.querySelector(".hm-lf-title").textContent);

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
  assert.equal(titles(el).length, 3, "three to start with");
  for (let i = 0; i < 7; i++) step(16);
  assert.equal(titles(el)[0], "n3", "one more after 100 ms of clock time");
  const btn = el.querySelector(".hm-lf-pause");
  btn.click();
  assert.equal(btn.getAttribute("aria-pressed"), "true");
  assert.equal(el.querySelector("ul").getAttribute("aria-live"), "off", "not announced while paused");
  for (let i = 0; i < 20; i++) step(16);
  assert.equal(titles(el)[0], "n3", "paused: nothing new");
  btn.click();
  el.querySelector("section").dispatchEvent(new globalThis.Event("pointerenter"));
  for (let i = 0; i < 20; i++) step(16);
  assert.equal(titles(el)[0], "n3", "hovered: nothing new");
  el.querySelector("section").dispatchEvent(new globalThis.Event("pointerleave"));
  for (let i = 0; i < 7; i++) step(16);
  assert.equal(titles(el)[0], "n4");
  dispose();
  manualClock(false);
});

test("LiveFeed: next is read once (a JSX getter that builds a new source each read still works)", () => {
  manualClock(true);
  const source = () => { let k = 0; return () => ({ id: k, title: `s${k++}` }); };
  const el = document.createElement("div"); document.body.appendChild(el);
  const props = { every: 50, max: 5 };
  Object.defineProperty(props, "next", { get: source, enumerable: true });
  const dispose = render(() => h(LiveFeed, props), el);
  assert.deepEqual(titles(el), ["s2", "s1", "s0"]);
  dispose();
  manualClock(false);
});
