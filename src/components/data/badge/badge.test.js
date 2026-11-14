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
  const a = m.el.querySelector(".hm-badge");
  assert.ok(a.className.includes("hm-badge-success") && a.className.includes("hm-badge-dot"));
  assert.equal(m.el.querySelector("i .hm-badge"), null, "hidden at 0");
  n.set(120);
  const c = m.el.querySelector("i .hm-badge");
  assert.equal(c.textContent, "99+");
  assert.equal(c.getAttribute("aria-label"), "120 unread");
  assert.ok(c.className.includes("hm-badge-danger"));
  assert.equal(countLabel(5), "5");
  assert.equal(countLabel(1000, 999), "999+");
  m.dispose();
});

test("Badge: coloured dot, own dot node, own count text", () => {
  const m = mount(() => [h(Badge, { dot: true, dotColor: "brand-orange" }, "Live"), h(Badge, { dot: h("i", { class: "mine" }) }, "Own"), h(Badge, { dot: false }, "Plain"), h(Badge, { count: 7, format: (n) => `${n} new` })]);
  const [a, b, c, d] = m.el.querySelectorAll(".hm-badge");
  assert.equal(a.querySelector(".hm-badge-dot-mark").getAttribute("data-hm-color"), "brand-orange");
  assert.ok(!a.className.includes("hm-badge-dot "), "the pseudo dot is replaced by the coloured mark");
  assert.ok(b.querySelector(".hm-badge-dot-own .mine"));
  assert.equal(c.querySelector(".hm-badge-dot-own, .hm-badge-dot-mark"), null);
  assert.equal(d.textContent, "7 new");
  m.dispose();
});

test("Badge: size xs; pulse draws a pulsing StatusDot in the text colour or dotColor", () => {
  const m = mount(() => [h(Badge, { size: "xs", count: 3 }), h(Badge, { tone: "danger", pulse: true }, "Live"), h(Badge, { dot: true, pulse: "blink", dotColor: "brand-orange" }, "On air"), h(Badge, {}, "Plain")]);
  const [a, b, c, d] = m.el.querySelectorAll(".hm-badge");
  assert.ok(a.classList.contains("hm-badge-xs") && a.classList.contains("hm-badge-count"));
  const dot = b.querySelector(".hm-status-dot.hm-badge-dot-pulse");
  assert.ok(dot.classList.contains("is-pulse-ring"));
  assert.equal(dot.getAttribute("aria-hidden"), "true");
  assert.ok(!b.classList.contains("hm-badge-dot"), "no second (pseudo) dot");
  assert.ok(c.querySelector(".hm-status-dot").classList.contains("is-pulse-blink"));
  assert.equal(c.querySelector(".hm-status-dot").getAttribute("data-hm-color"), "brand-orange");
  assert.equal(d.tagName, "SPAN");
  assert.ok(!d.classList.contains("hm-badge-xs") && !d.classList.contains("hm-badge-btn"));
  m.dispose();
});

test("Badge: onClick draws a button (text and count); pressed, disabled and the accessible name", () => {
  const on = signal(false), off = signal(false);
  let hits = 0;
  const m = mount(() => [
    h(Badge, { tone: "info", onClick: () => { hits++; on.set(!on()); }, pressed: on, disabled: off, ariaLabel: "Type: string" }, "str"),
    h(Badge, { count: 4, label: "hidden", onClick: () => { hits += 10; } }),
  ]);
  const [a, b] = m.el.querySelectorAll("button.hm-badge");
  assert.equal(a.getAttribute("type"), "button");
  assert.ok(a.classList.contains("hm-badge-btn") && a.classList.contains("hm-badge-info"));
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
  const [a, b, c] = m.el.querySelectorAll(".hm-badge");
  assert.ok(a.classList.contains("hm-badge-solid") && a.classList.contains("hm-badge-primary"));
  assert.ok(b.classList.contains("hm-badge-solid") && b.classList.contains("hm-badge-count"));
  assert.ok(!c.classList.contains("hm-badge-solid"));
  m.dispose();
});
