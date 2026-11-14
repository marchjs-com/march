import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { pauseOnHover } = await import("./index.ts");

const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: type !== "pointerenter" && type !== "pointerleave" }); Object.assign(e, init); el.dispatchEvent(e); };

test("pauseOnHover: held while the pointer is over or focus is inside; free when both are over", () => {
  const el = document.createElement("div"), a = document.createElement("button"), b = document.createElement("button"), out = document.createElement("button");
  el.append(a, b);
  document.body.append(el, out);
  const log = [];
  const stop = pauseOnHover(el, (held) => log.push(held));
  fire(el, "pointerenter");
  fire(a, "focusin");
  fire(el, "pointerleave");
  assert.deepEqual(log, [true], "focus still holds it");
  fire(a, "focusout", { relatedTarget: b });
  assert.deepEqual(log, [true], "focus moved between two children");
  fire(b, "focusout", { relatedTarget: out });
  assert.deepEqual(log, [true, false]);
  stop();
  fire(el, "pointerenter");
  assert.equal(log.length, 2);
});

test("pauseOnHover: hover or focus can be switched off", () => {
  const el = document.createElement("div"), a = document.createElement("button");
  el.append(a);
  document.body.append(el);
  const log = [];
  pauseOnHover(el, (held) => log.push(held), { hover: false });
  fire(el, "pointerenter");
  assert.deepEqual(log, []);
  fire(a, "focusin");
  assert.deepEqual(log, [true]);
});
