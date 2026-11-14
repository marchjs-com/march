import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { LinkCard } = await import("./index.ts");
const { users } = await import("../../../icons/glyphs/users.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("LinkCard: a link with tile, title, description, meta and arrow", () => {
  const title = signal("Members");
  const [el, dispose] = mount(() => h(LinkCard, { href: "/users", icon: users, tone: "success", title, description: "Search and manage", meta: "128" }));
  const a = el.querySelector("a.hm-link-card");
  assert.ok(a.getAttribute("href").endsWith("/users"));
  assert.ok(a.querySelector(".hm-icon-tile.hm-tile-success svg"));
  assert.equal(a.querySelector(".hm-link-card-title").textContent, "Members");
  assert.equal(a.querySelector(".hm-link-card-desc").textContent, "Search and manage");
  assert.equal(a.querySelector(".hm-link-card-meta").textContent, "128");
  assert.equal(a.querySelector(".hm-link-card-arrow").getAttribute("aria-hidden"), "true");
  title.set("People");
  assert.equal(a.querySelector(".hm-link-card-title").textContent, "People");
  dispose();
});

test("LinkCard: own lead, tile colour, own arrow, no arrow, extra attributes", () => {
  const [el, dispose] = mount(() => [
    h(LinkCard, { href: "/a", title: "A", lead: h("i", { class: "own-lead" }), icon: users, arrow: h("i", { class: "own-arrow" }), class: "one", target: "_blank" }),
    h(LinkCard, { href: "/b", title: "B", icon: users, color: "brand-orange", arrow: false, class: "two" }),
  ]);
  const one = el.querySelector(".one"), two = el.querySelector(".two");
  assert.ok(one.querySelector(".hm-link-card-lead .own-lead"));
  assert.equal(one.querySelector(".hm-icon-tile"), null);
  assert.ok(one.querySelector(".hm-link-card-arrow .own-arrow"));
  assert.equal(one.getAttribute("target"), "_blank");
  assert.equal(two.querySelector(".hm-icon-tile").getAttribute("data-hm-color"), "brand-orange");
  assert.equal(two.querySelector(".hm-link-card-arrow"), null);
  assert.equal(two.querySelector(".hm-link-card-desc"), null);
  dispose();
});
