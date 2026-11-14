import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const { FollowButton } = await import("./index.ts");

test("FollowButton: follow → following → follow; private → requested; names say what pressing does", async () => {
  const s = signal("follow"), priv = signal(false);
  const m = mount(() => h(FollowButton, { state: s, name: "HADİ", private: priv, onChange: (n) => s.set(n) }));
  const b = m.el.querySelector("button.hm-follow");
  assert.equal(b.getAttribute("aria-label"), "Follow HADİ");
  assert.equal(b.getAttribute("aria-pressed"), "false");
  b.click();
  assert.equal(s(), "following");
  assert.ok(b.classList.contains("is-following"));
  assert.equal(b.getAttribute("aria-label"), "Following HADİ, press to unfollow");
  assert.equal(b.querySelector(".hm-follow-text").textContent, "Following");
  b.click();
  assert.equal(s(), "follow");
  priv.set(true);
  b.click();
  assert.equal(s(), "requested");
  assert.match(b.getAttribute("aria-label"), /request sent/);
  await new Promise((r) => setTimeout(r, 10));
  m.dispose();
});

test("FollowButton: own texts, own name, own icon / no icon, color, no burst", async () => {
  const s = signal("follow");
  const m = mount(() => [
    h(FollowButton, { state: s, name: "HADİ", onChange: (n) => s.set(n), labels: { follow: "Join", following: "Member" }, color: "brand-green", burst: false, morph: false,
      ariaLabel: (st, n) => `${st}:${n}`, icon: (st) => h("i", { class: `own-${st}` }) }),
    h(FollowButton, { state: "follow", onChange: () => {}, icon: false }),
  ]);
  const [a, b] = m.el.querySelectorAll("button.hm-follow");
  assert.equal(a.querySelector(".hm-follow-text").textContent, "Join");
  assert.equal(a.getAttribute("aria-label"), "follow:HADİ");
  assert.equal(a.getAttribute("data-hm-color"), "brand-green");
  assert.ok(a.querySelector(".hm-follow-ico .own-follow"));
  a.click();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(a.querySelector(".hm-follow-text").textContent, "Member");
  assert.ok(a.querySelector(".hm-follow-ico .own-following"));
  assert.equal(a.querySelector(".hm-burst"), null, "burst={false}");
  assert.equal(b.querySelector(".hm-follow-ico"), null);
  assert.equal(b.getAttribute("data-hm-color"), null);
  assert.equal(b.querySelector(".hm-follow-text").textContent, "Follow");
  m.dispose();
});
