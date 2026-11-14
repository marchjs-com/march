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
  const sec = m.el.querySelector("section.m-prof");
  assert.equal(sec.getAttribute("aria-label"), "Profile of HADİ");
  assert.equal(sec.querySelector("h2").textContent, "HADİ");
  assert.equal(sec.querySelector(".m-prof-handle").textContent, "@hadisosyal");
  const statBtns = sec.querySelectorAll("button.m-prof-stat");
  assert.equal(statBtns.length, 3);
  assert.match(statBtns[1].querySelector(".m-sr-only").textContent, /10/);
  sec.querySelector("button.m-follow").click();
  assert.equal(follow(), "following");
  assert.match(statBtns[1].querySelector(".m-sr-only").textContent, /11/);
  statBtns[2].click();
  assert.deepEqual(stats, ["following"]);
  assert.ok(sec.querySelector(".m-prof-msg"));
  self.set(true);
  assert.equal(sec.querySelector("button.m-follow"), null);
  assert.match(sec.querySelector(".m-prof-actions").textContent, /Edit profile/);
  m.dispose();
});

test("ProfileHeader: own texts and icons; stats can be chosen or turned off; the verified mark and Message icon are optional", () => {
  const stats = signal(["followers", "following"]);
  const m = mount(() => h(ProfileHeader, {
    user: { name: "HADİ", verified: true, posts: 3, followers: 10, following: 2 }, onMessage: () => {}, class: "mine", stats, verifiedIcon: false, messageIcon: false, messageColor: "brand-blue",
    labels: { profile: (n) => `${n} club`, message: "Write", followers: "Members" },
  }));
  const sec = m.el.querySelector("section.m-prof");
  assert.ok(sec.classList.contains("mine"));
  assert.equal(sec.getAttribute("aria-label"), "HADİ club");
  assert.equal(sec.querySelector(".m-prof-verified"), null);
  const msg = sec.querySelector(".m-prof-msg");
  assert.equal(msg.textContent, "Write");
  assert.equal(msg.querySelector("svg"), null);
  assert.equal(msg.getAttribute("data-m-color"), "brand-blue");
  assert.equal(sec.querySelector(".m-prof-stats").getAttribute("data-n"), "2");
  assert.deepEqual([...sec.querySelectorAll(".m-prof-stat")].map((x) => x.lastElementChild.textContent), ["Members", "Following"]);
  stats.set(false);
  assert.equal(sec.querySelector(".m-prof-stats"), null);
  m.dispose();
  const own = mount(() => h(ProfileHeader, { user: { name: "HADİ", verified: true }, onMessage: () => {}, verifiedIcon: "✔", messageIcon: "✉" }));
  assert.equal(own.el.querySelector(".m-prof-verified").textContent, "✔");
  assert.match(own.el.querySelector(".m-prof-msg").textContent, /✉/);
  assert.equal(own.el.querySelectorAll(".m-prof-stat").length, 3);
  own.dispose();
});
