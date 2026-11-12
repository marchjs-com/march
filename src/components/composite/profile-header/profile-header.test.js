import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const { ProfileHeader } = await import("./index.ts");

test("ProfileHeader: heading, stats, follow bumps followers, self shows Edit", () => {
  const follow = signal("follow"), self = signal(false), stats = [];
  const m = mount(() => h(ProfileHeader, { user: { name: "HADİ", handle: "hadisosyal", verified: true, story: "new", posts: 3, followers: 10, following: 2 }, self, follow, onFollow: (s) => follow.set(s), onMessage: () => {}, onEdit: () => {}, onStat: (w) => stats.push(w), onAvatar: () => {} }));
  const sec = m.el.querySelector("section.hm-prof");
  assert.equal(sec.getAttribute("aria-label"), "Profile of HADİ");
  assert.equal(sec.querySelector("h2").textContent, "HADİ");
  assert.equal(sec.querySelector(".hm-prof-handle").textContent, "@hadisosyal");
  const statBtns = sec.querySelectorAll("button.hm-prof-stat");
  assert.equal(statBtns.length, 3);
  assert.match(statBtns[1].querySelector(".hm-sr-only").textContent, /10/);
  sec.querySelector("button.hm-follow").click();
  assert.equal(follow(), "following");
  assert.match(statBtns[1].querySelector(".hm-sr-only").textContent, /11/);
  statBtns[2].click();
  assert.deepEqual(stats, ["following"]);
  assert.ok(sec.querySelector(".hm-prof-msg"));
  self.set(true);
  assert.equal(sec.querySelector("button.hm-follow"), null);
  assert.match(sec.querySelector(".hm-prof-actions").textContent, /Edit profile/);
  m.dispose();
});
