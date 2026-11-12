import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Rating } = await import("./index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

test("Rating: a radio group; click and ArrowRight set the value; read-only shows a half star", async () => {
  const v = signal(2);
  const el = mount(() => [h(Rating, { value: v, setValue: (n) => v.set(n), label: "Service" }), h(Rating, { value: 3.5, readonly: true })]);
  const [a, b] = el.querySelectorAll(".hm-rating");
  assert.equal(a.getAttribute("role"), "radiogroup");
  assert.equal(a.getAttribute("aria-label"), "Service");
  const stars = a.querySelectorAll(".hm-rating-star");
  assert.equal(stars.length, 5);
  assert.equal(stars[1].getAttribute("aria-checked"), "true");
  stars[3].click();
  await tick();
  assert.equal(v(), 4);
  stars[3].focus();
  stars[3].dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  await tick();
  assert.equal(v(), 5);
  const half = b.querySelectorAll(".hm-rating-star")[3];
  assert.ok(half.classList.contains("is-half"));
  assert.ok(half.disabled);
});
