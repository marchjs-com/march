import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { resizeHandle } = await import("./index.ts");

const ptr = (type, x, y) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.assign(e, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0 }); return e; };
const key = (el, k, shiftKey = false) => { const e = new Event("keydown", { bubbles: true, cancelable: true }); Object.assign(e, { key: k, shiftKey }); el.dispatchEvent(e); return e; };

function setup(extra = {}) {
  const host = document.createElement("div");
  const grip = document.createElement("span");
  host.appendChild(grip); document.body.appendChild(host);
  let w = 200; const log = [];
  const off = resizeHandle(grip, { value: () => w, set: (v, done) => { w = v; log.push(`${v}${done ? "!" : ""}`); }, min: 100, max: 400, reset: () => { w = 250; log.push("reset"); }, ...extra });
  return { host, grip, off, log, get w() { return w; } };
}

test("resizeHandle: separator ARIA, focusable, value kept current", () => {
  const s = setup();
  assert.equal(s.grip.getAttribute("role"), "separator");
  assert.equal(s.grip.getAttribute("aria-orientation"), "vertical");
  assert.equal(s.grip.getAttribute("aria-valuemin"), "100");
  assert.equal(s.grip.getAttribute("aria-valuemax"), "400");
  assert.equal(s.grip.getAttribute("aria-valuenow"), "200");
  assert.equal(s.grip.getAttribute("tabindex"), "0");
  key(s.grip, "ArrowRight");
  assert.equal(s.grip.getAttribute("aria-valuenow"), "216");
  const g2 = document.createElement("span"); g2.setAttribute("tabindex", "-1");
  resizeHandle(g2, { value: () => 1, set: () => {} });
  assert.equal(g2.getAttribute("tabindex"), "-1", "a managed tabindex stays");
});

test("resizeHandle: drag along the writing direction, clamped; Escape puts it back; RTL mirrored", () => {
  const s = setup();
  s.grip.dispatchEvent(ptr("pointerdown", 0, 0));
  document.dispatchEvent(ptr("pointermove", 50, 0));
  document.dispatchEvent(ptr("pointermove", 900, 0));
  document.dispatchEvent(ptr("pointerup", 900, 0));
  assert.deepEqual(s.log, ["250", "400", "400!"]);
  s.log.length = 0;
  s.grip.dispatchEvent(ptr("pointerdown", 0, 0));
  document.dispatchEvent(ptr("pointermove", -50, 0));
  document.dispatchEvent(Object.assign(new Event("keydown", { bubbles: true, cancelable: true }), { key: "Escape" }));
  assert.deepEqual(s.log, ["350", "400!"], "cancelled: the size from before the press");
  s.log.length = 0;
  s.host.setAttribute("dir", "rtl");
  s.grip.dispatchEvent(ptr("pointerdown", 0, 0));
  document.dispatchEvent(ptr("pointermove", -30, 0));
  document.dispatchEvent(ptr("pointerup", -30, 0));
  assert.equal(s.w, 400, "RTL: moving left grows (clamped at max)");
  key(s.grip, "ArrowLeft");
  key(s.grip, "ArrowRight");
  assert.equal(s.w, 384, "RTL keys: left grows, right shrinks");
});

test("resizeHandle: keys step, Shift ×4, Home / End, Enter and double click reset; block axis; cleanup", () => {
  const s = setup();
  key(s.grip, "ArrowLeft"); assert.equal(s.w, 184);
  key(s.grip, "ArrowLeft", true); assert.equal(s.w, 120);
  key(s.grip, "Home"); assert.equal(s.w, 100);
  key(s.grip, "End"); assert.equal(s.w, 400);
  key(s.grip, "Enter"); assert.equal(s.w, 250);
  s.w; s.grip.dispatchEvent(new Event("dblclick", { bubbles: true }));
  assert.equal(s.log.at(-1), "reset");
  const e = key(s.grip, "a"); assert.equal(e.defaultPrevented, false);
  s.off();
  key(s.grip, "Home"); assert.equal(s.w, 250, "stopped");

  const b = setup({ axis: "block", step: 10 });
  assert.equal(b.grip.getAttribute("aria-orientation"), "horizontal");
  key(b.grip, "ArrowDown"); assert.equal(b.w, 210);
  b.grip.dispatchEvent(ptr("pointerdown", 0, 0)); document.dispatchEvent(ptr("pointermove", 0, -60)); document.dispatchEvent(ptr("pointerup", 0, -60));
  assert.equal(b.w, 150);
});
