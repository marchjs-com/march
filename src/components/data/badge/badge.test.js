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
