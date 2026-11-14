import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Badge, countLabel } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Badge: tones, dot, count (hidden at 0, capped, labelled)", () => {
  const n = signal(0);
  const m = mount(() => [h(Badge, { tone: "success", dot: true }, "Active"), h("i", {}, h(Badge, { count: n, label: "unread" }))]);
  const a = m.el.querySelector(".m-badge");
  assert.ok(a.className.includes("m-badge-success") && a.className.includes("m-badge-dot"));
  assert.equal(m.el.querySelector("i .m-badge"), null, "hidden at 0");
  n.set(120);
  const c = m.el.querySelector("i .m-badge");
  assert.equal(c.textContent, "99+");
  assert.equal(c.getAttribute("aria-label"), "120 unread");
  assert.ok(c.className.includes("m-badge-danger"));
  assert.equal(countLabel(5), "5");
  assert.equal(countLabel(1000, 999), "999+");
  m.dispose();
});

test("Badge: coloured dot, own dot node, own count text", () => {
  const m = mount(() => [h(Badge, { dot: true, dotColor: "brand-orange" }, "Live"), h(Badge, { dot: h("i", { class: "mine" }) }, "Own"), h(Badge, { dot: false }, "Plain"), h(Badge, { count: 7, format: (n) => `${n} new` })]);
  const [a, b, c, d] = m.el.querySelectorAll(".m-badge");
  assert.equal(a.querySelector(".m-badge-dot-mark").getAttribute("data-m-color"), "brand-orange");
  assert.ok(!a.className.includes("m-badge-dot "), "the pseudo dot is replaced by the coloured mark");
  assert.ok(b.querySelector(".m-badge-dot-own .mine"));
  assert.equal(c.querySelector(".m-badge-dot-own, .m-badge-dot-mark"), null);
  assert.equal(d.textContent, "7 new");
  m.dispose();
});

test("Badge: size xs; pulse draws a pulsing StatusDot in the text colour or dotColor", () => {
  const m = mount(() => [h(Badge, { size: "xs", count: 3 }), h(Badge, { tone: "danger", pulse: true }, "Live"), h(Badge, { dot: true, pulse: "blink", dotColor: "brand-orange" }, "On air"), h(Badge, {}, "Plain")]);
  const [a, b, c, d] = m.el.querySelectorAll(".m-badge");
  assert.ok(a.classList.contains("m-badge-xs") && a.classList.contains("m-badge-count"));
  const dot = b.querySelector(".m-status-dot.m-badge-dot-pulse");
  assert.ok(dot.classList.contains("is-pulse-ring"));
  assert.equal(dot.getAttribute("aria-hidden"), "true");
  assert.ok(!b.classList.contains("m-badge-dot"), "no second (pseudo) dot");
  assert.ok(c.querySelector(".m-status-dot").classList.contains("is-pulse-blink"));
  assert.equal(c.querySelector(".m-status-dot").getAttribute("data-m-color"), "brand-orange");
  assert.equal(d.tagName, "SPAN");
  assert.ok(!d.classList.contains("m-badge-xs") && !d.classList.contains("m-badge-btn"));
  m.dispose();
});

test("Badge: onClick draws a button (text and count); pressed, disabled and the accessible name", () => {
  const on = signal(false), off = signal(false);
  let hits = 0;
  const m = mount(() => [
    h(Badge, { tone: "info", onClick: () => { hits++; on.set(!on()); }, pressed: on, disabled: off, ariaLabel: "Type: string" }, "str"),
    h(Badge, { count: 4, label: "hidden", onClick: () => { hits += 10; } }),
  ]);
  const [a, b] = m.el.querySelectorAll("button.m-badge");
  assert.equal(a.getAttribute("type"), "button");
  assert.ok(a.classList.contains("m-badge-btn") && a.classList.contains("m-badge-info"));
  assert.equal(a.getAttribute("aria-label"), "Type: string");
  assert.equal(a.getAttribute("aria-pressed"), "false");
  a.click();
  assert.equal(hits, 1);
  assert.equal(a.getAttribute("aria-pressed"), "true");
  assert.ok(a.classList.contains("is-pressed"));
  off.set(true);
  assert.equal(a.disabled, true);
  assert.equal(b.getAttribute("aria-label"), "4 hidden");
  assert.equal(b.getAttribute("aria-pressed"), null);
  b.click();
  assert.equal(hits, 11);
  m.dispose();
});

test("Badge: variant solid adds the filled look to a text badge and a count", () => {
  const m = mount(() => [h(Badge, { tone: "primary", variant: "solid" }, "New"), h(Badge, { tone: "primary", variant: "solid", count: 3 }), h(Badge, { tone: "primary" }, "Soft")]);
  const [a, b, c] = m.el.querySelectorAll(".m-badge");
  assert.ok(a.classList.contains("m-badge-solid") && a.classList.contains("m-badge-primary"));
  assert.ok(b.classList.contains("m-badge-solid") && b.classList.contains("m-badge-count"));
  assert.ok(!c.classList.contains("m-badge-solid"));
  m.dispose();
});
