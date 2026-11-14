import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { IconTile } = await import("./index.ts");
const { users } = await import("../../../icons/glyphs/users.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("IconTile: tone, size, decorative by default", () => {
  const tone = signal("success");
  const [el, dispose] = mount(() => h(IconTile, { icon: users, tone, size: "lg" }));
  const tile = el.querySelector(".hm-icon-tile");
  assert.ok(tile.classList.contains("hm-tile-success") && tile.classList.contains("hm-icon-tile-lg"));
  assert.equal(tile.getAttribute("aria-hidden"), "true");
  assert.ok(tile.querySelector("svg"));
  tone.set("danger");
  assert.ok(tile.classList.contains("hm-tile-danger"));
  dispose();
});

test("IconTile: color token, variant, shape, label, own content", () => {
  const [el, dispose] = mount(() => [
    h(IconTile, { icon: users, color: "brand-orange", variant: "solid", shape: "round", label: "Members", class: "one" }),
    h(IconTile, { class: "two" }, h("b", { class: "own" }, "7")),
  ]);
  const one = el.querySelector(".one");
  assert.equal(one.getAttribute("data-hm-color"), "brand-orange");
  assert.ok(one.classList.contains("hm-icon-tile-solid") && one.classList.contains("hm-icon-tile-round"));
  assert.equal(one.getAttribute("role"), "img");
  assert.equal(one.getAttribute("aria-label"), "Members");
  assert.equal(one.getAttribute("aria-hidden"), null);
  assert.equal(el.querySelector(".two .own").textContent, "7");
  dispose();
});
