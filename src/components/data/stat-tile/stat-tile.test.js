import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { StatTile } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("StatTile: value, label and hint; live value; a node as value", () => {
  const n = signal(128);
  const [el, dispose] = mount(() => [h(StatTile, { value: n, label: "Posts", hint: "this year", "data-id": "posts" }), h(StatTile, { value: h("b", { class: "own" }, "9"), label: "Own" })]);
  const [a, b] = el.querySelectorAll(".hm-stat-tile");
  assert.equal(a.tagName, "DIV");
  assert.equal(a.querySelector(".hm-stat-tile-value").textContent, "128");
  assert.equal(a.querySelector(".hm-stat-tile-label").textContent, "Posts");
  assert.equal(a.querySelector(".hm-stat-tile-hint").textContent, "this year");
  assert.ok(a.classList.contains("hm-stat-tile-plain") && a.classList.contains("hm-stat-tile-md") && a.classList.contains("is-center"));
  assert.equal(a.getAttribute("data-id"), "posts");
  n.set(129);
  assert.equal(a.querySelector(".hm-stat-tile-value").textContent, "129");
  assert.ok(b.querySelector(".hm-stat-tile-value .own"));
  assert.equal(b.querySelector(".hm-stat-tile-hint"), null, "no hint, no element");
  dispose();
});

test("StatTile: looks and layout options", () => {
  const [el, dispose] = mount(() => h(StatTile, { value: "1", label: "x", variant: "card", size: "xl", align: "start", order: "label", color: "brand-blue", class: "mine" }));
  const a = el.querySelector(".hm-stat-tile");
  for (const k of ["hm-stat-tile-card", "hm-stat-tile-xl", "is-start", "is-label-first", "mine"]) assert.ok(a.classList.contains(k), k);
  assert.equal(a.getAttribute("data-hm-color"), "brand-blue");
  dispose();
});

test("StatTile: a button with onClick, a link with href, dt / dd with term", () => {
  let clicks = 0;
  const off = signal(false);
  const [el, dispose] = mount(() => [
    h(StatTile, { value: "5", label: "Followers", onClick: () => clicks++, disabled: off }),
    h(StatTile, { value: "7", label: "Events", href: "/events" }),
    h("dl", null, h(StatTile, { term: true, value: "42", label: "Places", hint: "open" })),
  ]);
  const btn = el.querySelector("button.hm-stat-tile"), link = el.querySelector("a.hm-stat-tile"), term = el.querySelector("dl .hm-stat-tile");
  assert.equal(btn.getAttribute("type"), "button");
  assert.ok(btn.classList.contains("is-action"));
  btn.click();
  assert.equal(clicks, 1);
  off.set(true);
  assert.equal(btn.disabled, true);
  assert.ok(btn.classList.contains("is-disabled"));
  assert.equal(link.getAttribute("href"), "/events");
  assert.deepEqual([...term.children].map((c) => c.tagName), ["DT", "DD", "DD"]);
  assert.equal(term.querySelector("dt").textContent, "Places");
  dispose();
});

test("StatTile: partClass adds a host's own class to a part", () => {
  const [el, dispose] = mount(() => h(StatTile, { value: "1", label: "L", hint: "H", partClass: { value: "my-v", label: "my-l", hint: "my-h" } }));
  assert.equal(el.querySelector(".hm-stat-tile-value.my-v").textContent, "1");
  assert.ok(el.querySelector(".hm-stat-tile-label.my-l") && el.querySelector(".hm-stat-tile-hint.my-h"));
  assert.equal(el.querySelector(".hm-stat-tile").hasAttribute("partClass"), false);
  dispose();
});

test("StatTile: hintIn=\"value\" puts the hint inside the value; emphasis=\"text\" marks a text value", () => {
  const [el, dispose] = mount(() => h("dl", null, h(StatTile, { term: true, value: "ada@example.com", label: "Email", hint: "verified", hintIn: "value", emphasis: "text" })));
  const tile = el.querySelector(".hm-stat-tile");
  assert.deepEqual([...tile.children].map((c) => c.tagName), ["DT", "DD"]);
  assert.equal(tile.querySelector("dd span.hm-stat-tile-hint").textContent, "verified");
  assert.ok(tile.classList.contains("is-text"));
  assert.equal(tile.hasAttribute("hintIn") || tile.hasAttribute("emphasis"), false);
  dispose();
});
