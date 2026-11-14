import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { BeforeAfter } = await import("./index.ts");

const key = (el, k, shiftKey = false) => el.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: k, shiftKey, bubbles: true }));

test("BeforeAfter: a slider handle, keyboard moves the divider, the value prop follows", () => {
  const v = signal(40), seen = [];
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(BeforeAfter, { before: h("b", null, "old"), after: h("b", null, "new"), beforeLabel: "Before", afterLabel: "After", value: v, onChange: (n) => seen.push(n), hint: false }), el);
  const root = el.querySelector(".hm-ba"), handle = root.querySelector('[role="slider"]');
  assert.equal(handle.getAttribute("aria-valuenow"), "40");
  assert.match(handle.getAttribute("aria-valuetext"), /40% before, 60% after/);
  assert.equal(root.style.getPropertyValue("--hm-ba-pos"), "40%");
  key(handle, "ArrowRight"); assert.equal(handle.getAttribute("aria-valuenow"), "41");
  key(handle, "ArrowLeft", true); assert.equal(handle.getAttribute("aria-valuenow"), "31");
  key(handle, "End"); assert.equal(handle.getAttribute("aria-valuenow"), "100");
  assert.ok(root.querySelector(".hm-ba-label-after").classList.contains("is-hidden"));
  key(handle, "Home"); assert.equal(handle.getAttribute("aria-valuenow"), "0");
  assert.deepEqual(seen, [41, 31, 100, 0]);
  v.set(75); assert.equal(handle.getAttribute("aria-valuenow"), "75");
  assert.equal(seen.length, 4, "a value set from outside is not echoed to onChange");
  dispose();
});

test("BeforeAfter: vertical orientation, labels hidden from screen readers", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(BeforeAfter, { before: "a", after: "b", beforeLabel: "A", orientation: "vertical", hint: false }), el);
  const root = el.querySelector(".hm-ba");
  assert.ok(root.classList.contains("hm-ba-vertical"));
  assert.equal(root.querySelector('[role="slider"]').getAttribute("aria-orientation"), "vertical");
  assert.equal(root.querySelector(".hm-ba-label").getAttribute("aria-hidden"), "true");
  key(root.querySelector('[role="slider"]'), "ArrowDown");
  assert.equal(root.querySelector('[role="slider"]').getAttribute("aria-valuenow"), "51");
  dispose();
});
