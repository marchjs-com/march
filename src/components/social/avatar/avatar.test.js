import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { Avatar, initials } = await import("./index.ts");
const { user } = await import("../../../icons/glyphs/user.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("Avatar: initials, name colour, accessible name", () => {
  assert.equal(initials("Ada Lovelace"), "AL");
  assert.equal(initials("ada"), "AD");
  const [el, dispose] = mount(() => h(Avatar, { name: "Ada Lovelace", size: "lg" }));
  const a = el.querySelector(".m-avatar");
  assert.ok(a.classList.contains("m-avatar-lg"));
  assert.match(a.className, /m-avatar-c\d/);
  assert.equal(a.getAttribute("role"), "img");
  assert.equal(a.getAttribute("aria-label"), "Ada Lovelace");
  assert.equal(a.querySelector(".m-avatar-text").textContent, "AL");
  dispose();
});

test("Avatar: image, falls back to the initials when it fails", () => {
  const [el, dispose] = mount(() => h(Avatar, { name: "Grace Hopper", src: signal("/a.png") }));
  const img = el.querySelector("img");
  assert.equal(img.getAttribute("src"), "/a.png");
  assert.equal(img.getAttribute("alt"), "");
  img.dispatchEvent(new Event("error"));
  assert.equal(el.querySelector("img"), null);
  assert.equal(el.querySelector(".m-avatar-text").textContent, "GH");
  dispose();
});

test("Avatar: own text, icon, colour, shape, label, decorative, children", () => {
  const [el, dispose] = mount(() => [
    h(Avatar, { text: "+3", color: "neutral", class: "one" }),
    h(Avatar, { icon: user, label: "Guest", shape: "square", class: "two" }),
    h(Avatar, { name: "Ada", decorative: true, class: "three" }),
    h(Avatar, { name: "Ada", class: "four" }, h("b", { class: "own" }, "x")),
  ]);
  const one = el.querySelector(".one"), two = el.querySelector(".two"), three = el.querySelector(".three");
  assert.equal(one.querySelector(".m-avatar-text").textContent, "+3");
  assert.equal(one.getAttribute("data-m-color"), "neutral");
  assert.doesNotMatch(one.className, /m-avatar-c\d/);
  assert.ok(two.querySelector(".m-avatar-icon svg"));
  assert.ok(two.classList.contains("m-avatar-square"));
  assert.equal(two.getAttribute("aria-label"), "Guest");
  assert.equal(three.getAttribute("aria-hidden"), "true");
  assert.equal(three.getAttribute("role"), null);
  assert.ok(el.querySelector(".four .own"));
  assert.equal(el.querySelector(".four .m-avatar-text"), null);
  dispose();
});
