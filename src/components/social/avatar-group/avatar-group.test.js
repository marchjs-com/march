import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { AvatarGroup } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const PEOPLE = ["Ada Lovelace", "Linus Torvalds", { name: "Grace Hopper", src: "/g.png" }, "Alan Turing", "Margaret Hamilton", "Tim Berners-Lee"];

test("AvatarGroup: max avatars, +N bubble, group name", () => {
  const names = signal(PEOPLE);
  const [el, dispose] = mount(() => h(AvatarGroup, { names, max: 4 }));
  const g = el.querySelector(".m-avatars");
  assert.equal(g.getAttribute("role"), "group");
  assert.equal(g.getAttribute("aria-label"), "6 people");
  assert.equal(g.querySelectorAll(".m-avatar").length, 5);
  assert.equal(g.querySelector(".m-avatar-more .m-avatar-text").textContent, "+2");
  assert.ok(g.querySelector(".m-avatar-sm img"));
  names.set(PEOPLE.slice(0, 3));
  assert.equal(g.querySelectorAll(".m-avatar").length, 3);
  assert.equal(g.querySelector(".m-avatar-more"), null);
  assert.equal(g.getAttribute("aria-label"), "3 people");
  dispose();
});

test("AvatarGroup: own bubble, no bubble, spacing, colour, shape, label", () => {
  const [el, dispose] = mount(() => [
    h(AvatarGroup, { names: PEOPLE, max: 2, more: (n) => h("b", { class: "own" }, `${n}+`), spacing: "gap", color: "brand-blue", shape: "square", class: "one", label: (n) => `${n} guests` }),
    h(AvatarGroup, { names: PEOPLE, max: 2, more: false, class: "two", label: "Team" }),
  ]);
  const one = el.querySelector(".one"), two = el.querySelector(".two");
  assert.equal(one.querySelector(".m-avatar-more .own").textContent, "4+");
  assert.ok(one.classList.contains("m-avatars-gap"));
  assert.equal(one.getAttribute("aria-label"), "6 guests");
  assert.equal(one.querySelector(".m-avatar").getAttribute("data-m-color"), "brand-blue");
  assert.ok(one.querySelector(".m-avatar").classList.contains("m-avatar-square"));
  assert.equal(two.querySelectorAll(".m-avatar").length, 2);
  assert.equal(two.getAttribute("aria-label"), "Team");
  dispose();
});
