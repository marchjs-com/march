import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { Stack, Toolbar, Divider } = await import("./index.ts");

test("Stack: direction, gap, alignment and wrap classes; as picks the element", () => {
  const el = h(Stack, { direction: "row", gap: 2, align: "center", justify: "between", wrap: true, as: "ul" }, h("li", {}, "x"));
  assert.equal(el.tagName.toLowerCase(), "ul");
  const cls = el.getAttribute("class");
  for (const c of ["hm-stack", "hm-stack-row", "hm-gap-2", "hm-stack-wrap", "hm-align-center", "hm-justify-between"]) assert.match(cls, new RegExp(`\\b${c}\\b`));
  assert.match(h(Stack, {}).getAttribute("class"), /hm-gap-3/);
});

test("Toolbar and Divider: roles and labels", () => {
  const { host, dispose } = mount(() => h(Toolbar, { label: "Tools", end: "E" }, "S"));
  const bar = host.querySelector('[role="toolbar"]');
  assert.equal(bar.getAttribute("aria-label"), "Tools");
  assert.equal(host.querySelector(".hm-toolbar-end").textContent, "E");
  dispose();
  const d = mount(() => h(Divider, { label: "or" }));
  assert.equal(d.host.querySelector('[role="separator"]').textContent, "or");
  d.dispose();
  const v = h(Divider, { vertical: true });
  assert.equal(v.getAttribute("aria-orientation"), "vertical");
});

test("Divider: class on every form", () => {
  assert.equal(h(Divider, { class: "mine" }).getAttribute("class"), "hm-divider mine");
  assert.equal(h(Divider, { vertical: true, class: "mine" }).getAttribute("class"), "hm-divider hm-divider-v mine");
  assert.equal(h(Divider, { label: "or", class: "mine" }).getAttribute("class"), "hm-divider hm-divider-label mine");
  assert.equal(h(Divider, {}).getAttribute("class"), "hm-divider");
});
