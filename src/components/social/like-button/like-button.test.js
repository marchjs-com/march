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
  const b = m.el.querySelector("button.hm-like");
  assert.equal(b.getAttribute("aria-pressed"), "false");
  assert.equal(b.getAttribute("aria-label"), "Like");
  assert.equal(b.getAttribute("data-hm-color"), "brand-pink");
  b.click();
  assert.equal(b.getAttribute("aria-pressed"), "true");
  assert.ok(b.classList.contains("is-liked"));
  assert.match(b.querySelector(".hm-sr-only").textContent, /5/);
  b.click();
  assert.equal(liked(), false);
  m.dispose();
});

test("heartBurst: adds a decorative layer to the host", () => {
  const host = document.createElement("div");
  heartBurst(host, { count: 6 });
  const layer = host.querySelector(".hm-burst");
  assert.ok(layer);
  assert.equal(layer.getAttribute("aria-hidden"), "true");
  assert.equal(layer.querySelectorAll(".hm-burst-dot").length, 6);
});
