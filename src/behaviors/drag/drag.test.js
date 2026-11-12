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
