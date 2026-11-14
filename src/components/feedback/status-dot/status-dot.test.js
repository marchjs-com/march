import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { StatusDot } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("StatusDot: decorative by default, an image with a label", () => {
  const [el, dispose] = mount(() => [h(StatusDot, {}), h(StatusDot, { label: "Live", "data-id": "a" })]);
  const [a, b] = el.querySelectorAll(".m-status-dot");
  assert.equal(a.getAttribute("aria-hidden"), "true");
  assert.equal(a.getAttribute("role"), null);
  assert.ok(a.classList.contains("is-success") && a.classList.contains("m-status-dot-md"));
  assert.equal(b.getAttribute("role"), "img");
  assert.equal(b.getAttribute("aria-label"), "Live");
  assert.equal(b.getAttribute("aria-hidden"), null);
  assert.equal(b.getAttribute("data-id"), "a", "other attributes pass through");
  dispose();
});

test("StatusDot: tone, colour, size and pulse follow their props", () => {
  const tone = signal("warn"), pulse = signal(true);
  const [el, dispose] = mount(() => mProps(h(StatusDot, { tone, pulse, size: "lg", class: "mine" }), { color: "brand-orange" }));
  const d = el.querySelector(".m-status-dot");
  assert.ok(d.classList.contains("is-warn") && d.classList.contains("m-status-dot-lg") && d.classList.contains("mine"));
  assert.ok(d.classList.contains("is-pulse-ring"), "true is the ring");
  assert.equal(d.getAttribute("data-m-color"), "brand-orange");
  tone.set("danger"); pulse.set("blink");
  assert.ok(d.classList.contains("is-danger") && d.classList.contains("is-pulse-blink") && !d.classList.contains("is-pulse-ring"));
  pulse.set(false);
  assert.ok(!/is-pulse/.test(d.className));
  dispose();
});

test("StatusDot: hollow draws a ring with an optional mark inside", () => {
  const [el, dispose] = mount(() => [h(StatusDot, { hollow: true, tone: "info" }, h("i", { class: "mark" })), h(StatusDot, {})]);
  const [a, b] = el.querySelectorAll(".m-status-dot");
  assert.ok(a.classList.contains("m-status-dot-hollow") && a.querySelector(".mark"));
  assert.ok(!b.classList.contains("m-status-dot-hollow") && !b.hasAttribute("hollow"));
  dispose();
});
