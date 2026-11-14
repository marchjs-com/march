import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { Splitter } = await import("./index.ts");

test("Splitter: two panes and a labelled separator handle", () => {
  const { host, dispose } = mount(() => h(Splitter, { start: "L", end: "R", label: "Width" }));
  const panes = host.querySelectorAll(".hm-split-pane");
  assert.equal(panes.length, 2);
  assert.equal(panes[0].textContent, "L");
  assert.equal(panes[1].textContent, "R");
  const handle = host.querySelector(".hm-split-handle");
  assert.equal(handle.getAttribute("aria-label"), "Width");
  assert.equal(handle.getAttribute("role"), "separator");
  dispose();
});

test("Splitter: handle off (fixed divider), your own grip, colour token", () => {
  const off = mount(() => h(Splitter, { start: "L", end: "R", handle: false }));
  const fixed = off.host.querySelector(".hm-split-handle");
  assert.ok(fixed.classList.contains("is-fixed"));
  assert.equal(fixed.getAttribute("tabindex"), null);
  assert.equal(fixed.getAttribute("role"), "separator");
  off.dispose();
  const own = mount(() => h(Splitter, { start: "L", end: "R", handle: h("i", {}, "::"), color: "brand-orange" }));
  const handle = own.host.querySelector(".hm-split-handle");
  assert.equal(handle.querySelector(".hm-split-grip").textContent, "::");
  assert.equal(handle.getAttribute("data-hm-color"), "brand-orange");
  assert.equal(handle.getAttribute("tabindex"), "0");
  own.dispose();
  const def = mount(() => h(Splitter, { start: "L", end: "R" }));
  assert.equal(def.host.querySelector(".hm-split-grip"), null);
  assert.equal(def.host.querySelector(".hm-split-handle").hasAttribute("data-hm-color"), false);
  def.dispose();
});
