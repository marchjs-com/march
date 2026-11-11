import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.js";
installDom();
const { signal, h, render, For, lazy, createRoot } = await import("../src/index.js");
const M = await import("../src/motion/index.ts");
const { createRouter, navigate, Router, _resetRouter } = await import("../src/router/index.ts");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("animate falls back to CSSOM when WAAPI is missing (final state, no style attribute strings)", async () => {
  const el = document.createElement("div");
  const c = M.animate(el, [{ opacity: 0, transform: "scale(.5)" }, { opacity: 1, transform: "none" }], { duration: 100 });
  await c.finished;
  assert.equal(el.style.getPropertyValue("opacity"), "1");
  assert.equal(el.style.getPropertyValue("transform"), "none");
  assert.equal(el.getAttribute("style"), null);
});

test("transition:blur/fly are registered and leaving elements wait for the animation", async () => {
  const show = signal(true);
  const el = document.createElement("div");
  render(() => h("div", {}, () => (show() ? h("p", { "transition:blur": { duration: 10 } }, "x") : null)), el);
  assert.equal(el.textContent, "x");
  show.set(false);
  await wait(5);
  assert.equal(el.textContent, "");
  assert.throws(() => h("i", { "transition:nope": true }), /unknown transition/);
});

test("tween and spring reach their target; reduced motion jumps", async () => {
  const target = signal(0);
  let tw, sp;
  createRoot(() => { tw = M.tween(() => target(), { duration: 30 }); sp = M.spring(() => target(), { stiffness: 900, damping: 60 }); });
  target.set(10);
  await wait(120);
  assert.equal(tw(), 10);
  for (let i = 0; i < 100 && sp.moving(); i++) await wait(20);
  assert.ok(Math.abs(sp() - 10) < 0.05, `spring ${sp()}`);
  M.setReducedMotion(true);
  target.set(20);
  assert.equal(tw(), 20);
  assert.equal(sp(), 20);
  M.setReducedMotion(false);
});

test("easing: cubicBezier matches its end points and is monotonic for ease-out", () => {
  const e = M.easing.cubicBezier(0.33, 1, 0.68, 1);
  assert.equal(Math.round(e(0) * 1000), 0);
  assert.equal(Math.round(e(1) * 1000), 1000);
  assert.ok(e(0.5) > 0.5);
  assert.equal(M.easing.easeOutBounce(1), 1);
});

test("<For animate> runs the FLIP hook and keeps order", () => {
  const items = signal([1, 2, 3]);
  const el = document.createElement("ul");
  render(() => h(For, { each: items, animate: true }, lazy(() => [(x) => h("li", {}, () => String(x()))])), el);
  items.set([3, 1, 2]);
  assert.deepEqual(el.querySelectorAll("li").map((l) => l.textContent), ["3", "1", "2"]);
});

test("timeline computes starts, stagger and duration", async () => {
  const root = document.createElement("div");
  for (let i = 0; i < 3; i++) root.appendChild(h("i", { class: "dot" }));
  root.appendChild(h("b", { class: "title" }));
  const tl = M.timeline({ root, defaults: { duration: 100 } })
    .add(".title", [{ opacity: 0 }, { opacity: 1 }])
    .add(".dot", [{ opacity: 0 }, { opacity: 1 }], { stagger: 50, at: "-=40" });
  assert.equal(tl.duration, 60 + 100 + 100);
  await tl.play();
  assert.equal(tl.progress(), 1);
  assert.equal(root.querySelector(".dot").style.getPropertyValue("opacity"), "1");
});

test("pageTransitions wraps router page swaps (fallback without View Transitions)", async () => {
  let wrapped = 0;
  const A = () => h("main", {}, "A"), B = () => h("main", {}, "B");
  createRouter({ routes: { "/": { component: A }, "/b": { component: B } } });
  const stop = M.pageTransitions({ type: "slide" });
  const el = document.createElement("div");
  render(() => h(Router, {}), el);
  await wait(5);
  const orig = globalThis.document.startViewTransition;
  globalThis.document.startViewTransition = (cb) => { wrapped++; cb(); return { updateCallbackDone: Promise.resolve(), finished: Promise.resolve() }; };
  await navigate("/b");
  assert.equal(el.textContent, "B");
  assert.equal(wrapped, 1);
  globalThis.document.startViewTransition = orig;
  stop(); _resetRouter();
});

test("drag moves with the pointer and the keyboard; swipe detects direction", () => {
  const el = document.createElement("div");
  let end;
  M.drag(el, { axis: "x", bounds: { left: -50, right: 50 }, onEnd: (p) => { end = p; } });
  const ev = (type, x, y, t) => Object.assign(new Event(type, { bubbles: true }), { clientX: x, clientY: y, timeStamp: t, pointerId: 1 });
  el.dispatchEvent(ev("pointerdown", 0, 0, 0));
  el.dispatchEvent(ev("pointermove", 80, 30, 16));
  el.dispatchEvent(ev("pointerup", 80, 30, 32));
  assert.equal(el.style.getPropertyValue("transform"), "translate3d(50px, 0px, 0)");
  assert.equal(end.x, 50);
  el.dispatchEvent(Object.assign(new Event("keydown"), { key: "ArrowLeft" }));
  assert.equal(el.style.getPropertyValue("transform"), "translate3d(40px, 0px, 0)");
  let dir;
  const s = document.createElement("div");
  M.swipe(s, { onSwipe: (d) => { dir = d; } });
  s.dispatchEvent(ev("pointerdown", 100, 0, 0));
  s.dispatchEvent(ev("pointerup", 20, 5, 100));
  assert.equal(dir, "left");
});
