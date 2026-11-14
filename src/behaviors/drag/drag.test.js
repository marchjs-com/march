import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const D = await import("./index.ts");
const Old = await import("../../motion/pointer.ts");
const M = await import("../../motion/index.ts");

const ptr = (type, x, y, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.assign(e, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0, ...init }); return e; };

test("drag: one source — motion's pointerDrag is this one", () => {
  assert.equal(Old.pointerDrag, D.pointerDrag);
  assert.equal(M.pointerDrag, D.pointerDrag);
});

test("draggable: threshold keeps a click a click; moves report deltas; handle and ignored parts; cleanup", () => {
  const el = document.createElement("div");
  const grip = document.createElement("span"); grip.className = "grip";
  const field = document.createElement("input");
  el.append(grip, field); document.body.appendChild(el);
  const log = [];
  const off = D.draggable(el, { handle: ".grip", onStart: () => log.push("start"), onMove: (p) => log.push(`move ${p.dx},${p.dy},${p.di}`), onEnd: (p, c) => log.push(`end ${p.dx} ${c}`), onClick: () => log.push("click") });
  grip.dispatchEvent(ptr("pointerdown", 10, 10)); document.dispatchEvent(ptr("pointerup", 11, 10));
  assert.deepEqual(log, ["click"]);
  log.length = 0;
  grip.dispatchEvent(ptr("pointerdown", 10, 10)); document.dispatchEvent(ptr("pointermove", 30, 15)); document.dispatchEvent(ptr("pointerup", 30, 15));
  assert.deepEqual(log, ["start", "move 20,5,20", "end 20 false"]);
  log.length = 0;
  field.dispatchEvent(ptr("pointerdown", 10, 10)); document.dispatchEvent(ptr("pointermove", 40, 10));
  assert.deepEqual(log, [], "not the handle");
  off();
  grip.dispatchEvent(ptr("pointerdown", 10, 10)); document.dispatchEvent(ptr("pointermove", 40, 10));
  assert.deepEqual(log, [], "cleaned up");
  el.remove();
});

test("draggable: Escape cancels; right button and disabled do not start", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const log = [];
  let off = false;
  D.draggable(el, { disabled: () => off, onEnd: (_p, c) => log.push(`end ${c}`), onStart: () => log.push("start") });
  el.dispatchEvent(ptr("pointerdown", 0, 0, { button: 2 })); document.dispatchEvent(ptr("pointermove", 50, 0));
  assert.deepEqual(log, []);
  el.dispatchEvent(ptr("pointerdown", 0, 0)); document.dispatchEvent(ptr("pointermove", 50, 0));
  const esc = new Event("keydown", { bubbles: true, cancelable: true }); esc.key = "Escape"; document.dispatchEvent(esc);
  assert.deepEqual(log, ["start", "end true"]);
  off = true; log.length = 0;
  el.dispatchEvent(ptr("pointerdown", 0, 0)); document.dispatchEvent(ptr("pointermove", 50, 0));
  assert.deepEqual(log, []);
  el.remove();
});

test("pointerDrag: hold — touch starts after a long press, an early move leaves the gesture to the page, mouse drags at once", async () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const log = [];
  const opts = { hold: 20, onStart: () => log.push("start"), onMove: (p) => log.push(`move ${p.dx}`), onEnd: (_p, c) => log.push(`end ${c}`), onClick: () => log.push("click") };
  const touch = { pointerType: "touch" };
  el.addEventListener("pointerdown", (e) => D.pointerDrag(e, opts));
  el.dispatchEvent(ptr("pointerdown", 0, 0, touch)); document.dispatchEvent(ptr("pointermove", 30, 0, touch));
  await new Promise((r) => setTimeout(r, 40));
  document.dispatchEvent(ptr("pointermove", 60, 0, touch)); document.dispatchEvent(ptr("pointerup", 60, 0, touch));
  assert.deepEqual(log, [], "moved before the hold: a scroll, not a drag");
  el.dispatchEvent(ptr("pointerdown", 0, 0, touch));
  await new Promise((r) => setTimeout(r, 40));
  const tm = new Event("touchmove", { bubbles: true, cancelable: true }); document.dispatchEvent(tm);
  assert.ok(tm.defaultPrevented, "the page stays still while dragging");
  document.dispatchEvent(ptr("pointermove", 25, 0, touch)); document.dispatchEvent(ptr("pointerup", 25, 0, touch));
  assert.deepEqual(log, ["start", "move 0", "move 25", "end false"]);
  log.length = 0;
  el.dispatchEvent(ptr("pointerdown", 0, 0, touch)); document.dispatchEvent(ptr("pointerup", 0, 0, touch));
  await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(log, ["click"], "a tap stays a tap");
  log.length = 0;
  el.dispatchEvent(ptr("pointerdown", 0, 0)); document.dispatchEvent(ptr("pointermove", 10, 0)); document.dispatchEvent(ptr("pointerup", 10, 0));
  assert.deepEqual(log, ["start", "move 10", "end false"], "the mouse does not wait");
  el.remove();
});

test("track: fractions of the area from the press on, RTL mirror, clamped, ends on release or Escape", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0 });
  const log = [];
  let rtl = false;
  const off = D.track(el, { rtl: () => rtl, onMove: (p) => log.push(`m ${p.x.toFixed(2)},${p.y.toFixed(2)} ${p.dx}`), onEnd: (p) => log.push(`e ${p.x.toFixed(2)}`) });
  el.dispatchEvent(ptr("pointerdown", 50, 50)); document.dispatchEvent(ptr("pointermove", 300, 50)); document.dispatchEvent(ptr("pointerup", 300, 50));
  assert.deepEqual(log, ["m 0.25,0.50 0", "m 1.00,0.50 250", "e 1.00"]);
  log.length = 0; rtl = true;
  el.dispatchEvent(ptr("pointerdown", 50, 0)); document.dispatchEvent(ptr("pointerup", 50, 0));
  assert.deepEqual(log, ["m 0.75,0.00 0", "e 0.75"], "a click jumps and ends");
  log.length = 0;
  el.dispatchEvent(ptr("pointerdown", 0, 0)); document.dispatchEvent(ptr("pointermove", 100, 0));
  document.dispatchEvent(Object.assign(new Event("keydown", { bubbles: true, cancelable: true }), { key: "Escape" }));
  document.dispatchEvent(ptr("pointermove", 150, 0));
  assert.equal(log.length, 3, "press, move, end; nothing after Escape");
  off();
  el.dispatchEvent(ptr("pointerdown", 0, 0));
  assert.equal(log.length, 3);
});

test("arrowStep: arrows, Shift ×10, RTL swaps left and right", () => {
  const k = (key, shiftKey = false) => ({ key, shiftKey });
  assert.deepEqual(D.arrowStep(k("ArrowRight")), { dx: 1, dy: 0 });
  assert.deepEqual(D.arrowStep(k("ArrowRight"), true), { dx: -1, dy: 0 });
  assert.deepEqual(D.arrowStep(k("ArrowUp", true)), { dx: 0, dy: -10 });
  assert.equal(D.arrowStep(k("a")), null);
});
