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
  const m = mount(() => h(StoryRing, { name: "HADİ", state, loading, label: "hadi", add: true, onClick: () => clicks++ }));
  const b = m.el.querySelector("button.hm-sring");
  assert.equal(b.getAttribute("aria-label"), "HADİ, new story");
  assert.equal(b.querySelector(".hm-sring-label").textContent, "hadi");
  assert.ok(b.querySelector(".hm-sring-add"));
  state.set("seen");
  assert.equal(b.getAttribute("aria-label"), "HADİ, story seen");
  assert.ok(b.classList.contains("is-seen"));
  loading.set(true);
  assert.equal(b.getAttribute("aria-busy"), "true");
  b.click();
  assert.equal(clicks, 1);
  m.dispose();
});

test("StoryRing: without onClick it is an image", () => {
  const m = mount(() => h(StoryRing, { name: "HADİ", state: "none" }));
  const r = m.el.querySelector(".hm-sring");
  assert.equal(r.tagName, "SPAN");
  assert.equal(r.getAttribute("role"), "img");
  assert.equal(r.getAttribute("aria-label"), "HADİ");
  m.dispose();
});

test("StoryRing: own name, ring color, own badge content, own avatar node", () => {
  const m = mount(() => [
    h(StoryRing, { name: "HADİ", ariaLabel: "3 new stories", color: "brand-purple", add: true, addIcon: h("i", { class: "own-add" }), avatar: h("b", { class: "own-av" }), class: "mine" }),
    h(StoryRing, { name: "HADİ", add: true }),
  ]);
  const [a, b] = m.el.querySelectorAll(".hm-sring");
  assert.ok(a.classList.contains("mine"));
  assert.equal(a.getAttribute("aria-label"), "3 new stories");
  assert.equal(a.getAttribute("data-hm-color"), "brand-purple");
  assert.ok(a.querySelector(".hm-sring-add .own-add") && !a.querySelector(".hm-sring-add .hm-svg"));
  assert.ok(a.querySelector(".hm-sring-av .own-av") && !a.querySelector(".hm-avatar"));
  assert.equal(b.getAttribute("data-hm-color"), null);
  assert.equal(b.getAttribute("aria-label"), "HADİ, new story");
  assert.ok(b.querySelector(".hm-sring-add .hm-svg") && b.querySelector(".hm-avatar"));
  m.dispose();
});
