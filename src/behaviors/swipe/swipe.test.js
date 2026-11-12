import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { swipeable, rubberBand, fling, nearest } = await import("./index.ts");

const ev = (type, x, y, t = 0, extra = {}) => { const e = new globalThis.Event(type, { bubbles: true, cancelable: true }); Object.assign(e, { clientX: x, clientY: y, button: 0, pointerId: 1, timeStamp: t, ...extra }); return e; };
const box = () => { const el = document.createElement("div"); el.appendChild(document.createElement("span")); document.body.appendChild(el); return el; };

test("swipe: axis lock, veto, deltas and release velocity", () => {
  const el = box(), log = [];
  const off = swipeable(el, { axis: "x", onStart: (p) => log.push(["start", p.axis]), onMove: (p) => log.push(["move", p.dx]), onEnd: (p, c) => log.push(["end", Math.round(p.vx * 10) / 10, c]) });
  // vertical first movement: not claimed (the page scrolls)
  el.dispatchEvent(ev("pointerdown", 0, 0, 0)); el.dispatchEvent(ev("pointermove", 1, 20, 10)); el.dispatchEvent(ev("pointerup", 1, 20, 20));
  assert.deepEqual(log, []);
  // horizontal: claimed, dx from the press, velocity over the last 100 ms
  el.dispatchEvent(ev("pointerdown", 0, 0, 100)); el.dispatchEvent(ev("pointermove", 10, 0, 110)); el.dispatchEvent(ev("pointermove", 50, 1, 150)); el.dispatchEvent(ev("pointerup", 60, 1, 160));
  assert.deepEqual(log, [["start", "x"], ["move", 10], ["move", 50], ["end", 1, false]]);
  off();
});

test("swipe: accept() veto, tap, hold + release, click after a swipe is swallowed", async () => {
  const el = box(), log = [];
  swipeable(el, { accept: (p) => p.dy > 0, onTap: () => log.push("tap"), holdMs: 5, onHold: () => log.push("hold"), onRelease: () => log.push("release"), onEnd: () => log.push("end") });
  el.dispatchEvent(ev("pointerdown", 0, 0)); el.dispatchEvent(ev("pointerup", 0, 0));
  el.dispatchEvent(ev("pointerdown", 0, 0)); el.dispatchEvent(ev("pointermove", 0, -30)); el.dispatchEvent(ev("pointerup", 0, -30)); // vetoed: up
  el.dispatchEvent(ev("pointerdown", 0, 0)); await new Promise((r) => setTimeout(r, 15)); el.dispatchEvent(ev("pointerup", 0, 0));
  assert.deepEqual(log, ["tap", "hold", "release"]);
  let clicks = 0;
  el.firstChild.addEventListener("click", () => clicks++);
  el.dispatchEvent(ev("pointerdown", 0, 0)); el.dispatchEvent(ev("pointermove", 0, 40)); el.dispatchEvent(ev("pointerup", 0, 40));
  el.firstChild.click();
  assert.equal(clicks, 0, "the click that ends a swipe does not activate");
  el.firstChild.click();
  assert.equal(clicks, 1);
});

test("swipe helpers: rubber band, fling projection, nearest point", () => {
  assert.equal(rubberBand(16), 16);
  assert.equal(rubberBand(-5), 0);
  assert.equal(fling(100, 5), 100 + 2 * 160);
  assert.equal(nearest([0, 200, 400], 290), 200);
});
