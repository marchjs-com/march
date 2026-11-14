import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { ExplodedView } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const click = (el) => { const e = new Event("click", { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };

const card = () => h("article", { class: "card" }, h("header", {}, h("span", { class: "avatar" }, "EA"), h("b", {}, "Elif")), h("button", { class: "like" }, h("i", { class: "count" }, "12")));
const PARTS = [{ selector: ".avatar", label: "Avatar" }, { selector: ".like", label: "LikeButton", id: "like" }, { selector: ".count", label: "CountRoll", level: 2 }];

test("ExplodedView: together it leaves the content alone; apart the same elements are marked as plates", async () => {
  const open = signal(false), picked = [];
  let inner = 0;
  const [el, dispose] = mount(() => h(ExplodedView, { open, parts: PARTS, onPick: (id) => picked.push(id) }, h("div", { onClick: () => inner++ }, card())));
  const root = el.querySelector(".m-xv"), avatar = el.querySelector(".avatar");
  assert.ok(root.classList.contains("m-xv-parts") && !root.classList.contains("is-open"));
  assert.equal(el.querySelector("[data-m-xv]"), null, "no marks while together");
  assert.equal(root.getAttribute("role"), null);
  click(avatar);
  assert.equal(inner, 1, "together: presses reach the content");

  open.set(true);
  assert.ok(root.classList.contains("is-open") && root.classList.contains("is-moving"));
  assert.equal(root.getAttribute("role"), "group");
  assert.equal(el.querySelector(".avatar"), avatar, "the same element, not a new one");
  assert.equal(avatar.getAttribute("data-m-xv"), "part");
  assert.equal(avatar.getAttribute("data-m-xv-id"), "Avatar");
  assert.equal(el.querySelector(".like").getAttribute("data-m-xv-id"), "like");
  assert.equal(el.querySelector(".count").style.getPropertyValue("--m-xv-i"), "2", "level");
  assert.ok(el.querySelector("header").hasAttribute("data-m-xv-through") && el.querySelector(".card").hasAttribute("data-m-xv-through"), "ancestors keep the depth");
  assert.deepEqual([...el.querySelectorAll(".m-xv-plates .m-xv-tag")].map((x) => x.textContent), ["Avatar", "LikeButton", "CountRoll"]);
  assert.equal(el.querySelector(".m-xv-plates").getAttribute("aria-hidden"), "true");
  // a plate inside a plate: its tag sits at the sum of the steps
  assert.equal([...el.querySelectorAll(".m-xv-plates .m-xv-tag")][2].style.getPropertyValue("--m-xv-i"), "3");

  const e = click(el.querySelector(".count"));
  assert.ok(e.defaultPrevented, "apart: the press does not reach the content");
  assert.equal(inner, 1);
  assert.deepEqual(picked, ["CountRoll"], "the nearest plate is picked");

  open.set(false);
  assert.ok(!root.classList.contains("is-open") && root.classList.contains("is-moving"), "on the way back the marks stay");
  await tick(900);
  assert.ok(!root.classList.contains("is-moving"));
  assert.equal(el.querySelector("[data-m-xv], [data-m-xv-through]"), null, "landed: every mark is gone");
  assert.equal(el.querySelectorAll(".m-xv-tag").length, 0);
  dispose();
});

test("ExplodedView: without parts one element opens into its layers; names and layers are yours", () => {
  const [el, dispose] = mount(() => [
    h(ExplodedView, { open: true }, h("button", { class: "btn" }, "Tamam")),
    mProps(h(ExplodedView, { open: true, layers: { ring: false, surface: "Arka plan" }, target: ".second", tags: false, gap: 40, tilt: { x: 40, z: -20 }, motion: "spring", class: "mine", label: "Düğmenin katmanları" },
      h("span", { class: "first" }, "a"), h("button", { class: "second" }, "b")), { color: "brand-blue" }),
  ]);
  const [a, b] = el.querySelectorAll(".m-xv");
  assert.ok(a.classList.contains("m-xv-layers") && a.classList.contains("m-xv-smooth"));
  assert.equal(a.querySelector(".btn").getAttribute("data-m-xv"), "content");
  const kinds = (root) => [...root.querySelectorAll(".m-xv-ghost")].map((g) => g.getAttribute("data-m-xv-id"));
  assert.deepEqual(kinds(a), ["surface", "ring"], "no shadow plate for an element without a shadow");
  assert.equal(a.querySelectorAll(".m-xv-tag").length, 3, "a name per layer: surface, content, ring");
  assert.ok(a.getAttribute("aria-label"));

  assert.deepEqual(kinds(b), ["surface"], "ring: false leaves it out");
  assert.equal(b.querySelector(".m-xv-surface").getAttribute("data-m-xv-id"), "surface");
  assert.equal(b.querySelector(".second").getAttribute("data-m-xv"), "content", "target picks the element");
  assert.equal(b.querySelector(".first").getAttribute("data-m-xv"), null);
  assert.equal(b.querySelectorAll(".m-xv-tag").length, 0, "tags={false}");
  for (const k of ["m-xv-spring", "mine"]) assert.ok(b.classList.contains(k), k);
  assert.equal(b.style.getPropertyValue("--m-xv-gap"), "40px");
  assert.equal(b.style.getPropertyValue("--m-xv-rx"), "40deg");
  assert.equal(b.getAttribute("data-m-color"), "brand-blue");
  assert.equal(b.getAttribute("aria-label"), "Düğmenin katmanları");
  dispose();
});

test("ExplodedView: the chosen plate is marked; new content is marked again while apart", async () => {
  const active = signal("Avatar"), again = signal(0);
  const [el, dispose] = mount(() => h(ExplodedView, { open: true, parts: PARTS, active }, () => { again(); return card(); }));
  assert.ok(el.querySelector(".avatar").hasAttribute("data-m-xv-on"));
  assert.ok(el.querySelector(".m-xv-tag.is-active").textContent === "Avatar");
  active.set("like");
  assert.ok(!el.querySelector(".avatar").hasAttribute("data-m-xv-on") && el.querySelector(".like").hasAttribute("data-m-xv-on"));
  again.set(1);
  await tick(20);
  assert.equal(el.querySelector(".avatar").getAttribute("data-m-xv"), "part", "the redrawn content is found again");
  dispose();
});
