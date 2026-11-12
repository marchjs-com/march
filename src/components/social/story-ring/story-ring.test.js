import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { StoryRing } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("StoryRing: button named with its state, label, add badge, loading", () => {
  const state = signal("new"), loading = signal(false);
  let clicks = 0;
  const m = mount(() => h(StoryRing, { name: "Acme", state, loading, label: "acme", add: true, onClick: () => clicks++ }));
  const b = m.el.querySelector("button.hm-sring");
  assert.equal(b.getAttribute("aria-label"), "Acme, new story");
  assert.equal(b.querySelector(".hm-sring-label").textContent, "acme");
  assert.ok(b.querySelector(".hm-sring-add"));
  state.set("seen");
  assert.equal(b.getAttribute("aria-label"), "Acme, story seen");
  assert.ok(b.classList.contains("is-seen"));
  loading.set(true);
  assert.equal(b.getAttribute("aria-busy"), "true");
  b.click();
  assert.equal(clicks, 1);
  m.dispose();
});

test("StoryRing: without onClick it is an image", () => {
  const m = mount(() => h(StoryRing, { name: "Acme", state: "none" }));
  const r = m.el.querySelector(".hm-sring");
  assert.equal(r.tagName, "SPAN");
  assert.equal(r.getAttribute("role"), "img");
  assert.equal(r.getAttribute("aria-label"), "Acme");
  m.dispose();
});
