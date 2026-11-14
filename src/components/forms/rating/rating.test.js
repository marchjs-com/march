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
  const [a, b] = el.querySelectorAll(".m-rating");
  assert.equal(a.getAttribute("role"), "radiogroup");
  assert.equal(a.getAttribute("aria-label"), "Service");
  const stars = a.querySelectorAll(".m-rating-star");
  assert.equal(stars.length, 5);
  assert.equal(stars[1].getAttribute("aria-checked"), "true");
  stars[3].click();
  await tick();
  assert.equal(v(), 4);
  stars[3].focus();
  stars[3].dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  await tick();
  assert.equal(v(), 5);
  const half = b.querySelectorAll(".m-rating-star")[3];
  assert.ok(half.classList.contains("is-half"));
  assert.ok(half.disabled);
});

test("Rating: the marks, their names and the motion are yours", () => {
  const heart = { name: "t-heart", d: ["M12 21l-8-8a5 5 0 0 1 8-6 5 5 0 0 1 8 6z"] };
  const el = mount(() => [
    h(Rating, { value: 2, max: 3, icon: heart, starLabel: (n, max) => `${n} hearts of ${max}`, animate: false }),
    h(Rating, { value: 1, max: 2, icon: (n) => h("b", { class: "own-off" }, String(n)), iconOn: (n) => h("b", { class: "own-on" }, String(n)) }),
    h(Rating, { value: 1, max: 2 }),
  ]);
  const [a, b, c] = el.querySelectorAll(".m-rating");
  assert.ok(a.className.includes("is-still"));
  assert.equal(a.querySelectorAll(".m-rating-star")[1].getAttribute("aria-label"), "2 hearts of 3");
  assert.equal(a.querySelectorAll("svg").length, 6);
  assert.equal(b.querySelectorAll("svg").length, 0);
  assert.deepEqual(b.querySelectorAll(".own-on").map((x) => x.textContent), ["1", "2"]);
  assert.equal(b.querySelectorAll(".own-off").length, 2);
  assert.ok(!c.className.includes("is-still"));
  assert.equal(c.querySelector(".m-rating-star").getAttribute("aria-label"), "1 of 2");
});
