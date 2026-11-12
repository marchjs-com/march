import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const { FollowButton } = await import("./index.ts");

test("FollowButton: follow → following → follow; private → requested; names say what pressing does", async () => {
  const s = signal("follow"), priv = signal(false);
  const m = mount(() => h(FollowButton, { state: s, name: "Acme", private: priv, onChange: (n) => s.set(n) }));
  const b = m.el.querySelector("button.hm-follow");
  assert.equal(b.getAttribute("aria-label"), "Follow Acme");
  assert.equal(b.getAttribute("aria-pressed"), "false");
  b.click();
  assert.equal(s(), "following");
  assert.ok(b.classList.contains("is-following"));
  assert.equal(b.getAttribute("aria-label"), "Following Acme, press to unfollow");
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
