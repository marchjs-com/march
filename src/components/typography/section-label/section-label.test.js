import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { SectionLabel } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("SectionLabel: text, icon, live count and actions", () => {
  const n = signal(3);
  const m = mount(() => h(SectionLabel, { icon: "★", count: n, actions: h("button", { class: "add" }, "+") }, "Favorites"));
  const root = m.el.querySelector("div.m-section-label.m-section-label-sm");
  assert.equal(root.querySelector(".m-section-label-text").textContent, "Favorites");
  assert.equal(root.querySelector(".m-section-label-icon").getAttribute("aria-hidden"), "true");
  assert.equal(root.querySelector(".m-section-label-count").textContent, "3");
  n.set(4);
  assert.equal(root.querySelector(".m-section-label-count").textContent, "4");
  assert.ok(root.querySelector(".m-section-label-actions .add"));
  m.dispose();
});

test("SectionLabel: element, label prop, plain case, rule, size, color, class and attributes", () => {
  const upper = signal(false), rule = signal(true);
  const m = mount(() => [
    h(SectionLabel, { as: "h3", label: () => "Colors", upper, rule, size: "md", color: "brand-orange", class: "mine", id: "grp" }),
    h(SectionLabel, { as: "li", role: "presentation" }, "Recent"),
  ]);
  const [a, b] = m.el.querySelectorAll(".m-section-label");
  assert.equal(a.tagName, "H3");
  assert.equal(a.id, "grp");
  assert.equal(a.textContent, "Colors");
  for (const c of ["is-plain", "m-section-label-md", "mine"]) assert.ok(a.classList.contains(c), c);
  assert.equal(a.getAttribute("data-m-color"), "brand-orange");
  assert.ok(a.querySelector(".m-section-label-rule"));
  upper.set(true); rule.set(false);
  assert.ok(!a.classList.contains("is-plain"));
  assert.equal(a.querySelector(".m-section-label-rule"), null);
  assert.equal(a.querySelector(".m-section-label-count"), null);
  assert.equal(a.querySelector(".m-section-label-actions"), null);
  assert.equal(b.tagName, "LI");
  assert.equal(b.getAttribute("role"), "presentation");
  m.dispose();
});
