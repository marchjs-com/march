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
