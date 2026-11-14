import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { LikeButton, heartBurst } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("LikeButton: aria-pressed toggles through onToggle, count follows", () => {
  const liked = signal(false), n = signal(4);
  const m = mount(() => h(LikeButton, { liked, count: n, onToggle: (on) => { liked.set(on); n.set(n() + (on ? 1 : -1)); } }));
  const b = m.el.querySelector("button.m-like");
  assert.equal(b.getAttribute("aria-pressed"), "false");
  assert.equal(b.getAttribute("aria-label"), "Like");
  assert.equal(b.getAttribute("data-m-color"), "brand-pink");
  b.click();
  assert.equal(b.getAttribute("aria-pressed"), "true");
  assert.ok(b.classList.contains("is-liked"));
  assert.match(b.querySelector(".m-sr-only").textContent, /5/);
  b.click();
  assert.equal(liked(), false);
  m.dispose();
});

test("heartBurst: adds a decorative layer to the host", () => {
  const host = document.createElement("div");
  heartBurst(host, { count: 6 });
  const layer = host.querySelector(".m-burst");
  assert.ok(layer);
  assert.equal(layer.getAttribute("aria-hidden"), "true");
  assert.equal(layer.querySelectorAll(".m-burst-dot").length, 6);
});

test("LikeButton: own icon (node / by state), no pop, burst options", () => {
  const liked = signal(false);
  const m = mount(() => [
    h(LikeButton, { liked, onToggle: (on) => liked.set(on), icon: (on) => h("i", { class: on ? "own-on" : "own-off" }), pop: false, burstOptions: { count: 4, ring: false }, class: "mine" }),
    h(LikeButton, { liked: false, onToggle: () => {}, icon: h("b", { class: "own-node" }), burst: false }),
  ]);
  const [a, b] = m.el.querySelectorAll("button.m-like");
  assert.ok(a.classList.contains("mine"));
  assert.ok(a.querySelector(".m-like-heart .own-off") && !a.querySelector(".m-svg"));
  a.click();
  assert.ok(a.querySelector(".m-like-heart .own-on"));
  assert.equal(a.querySelectorAll(".m-burst-dot").length, 4);
  assert.equal(a.querySelector(".m-burst-ring"), null);
  assert.ok(b.querySelector(".m-like-heart .own-node"));
  b.click();
  assert.equal(b.querySelector(".m-burst"), null);
  m.dispose();
});
