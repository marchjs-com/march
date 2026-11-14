import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { SiteNav } = await import("./index.ts");

test("SiteNav: brand, labelled nav, aria-current follows active, menu button, mode classes", () => {
  const on = signal("#a");
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(SiteNav, {
    mode: "transparent", brand: { name: "HADİ" },
    links: [{ label: "A", href: "#a", active: () => on() === "#a" }, { label: "B", href: "#b", active: () => on() === "#b" }],
    actions: h("button", {}, "Go"),
  }), el);
  const nav = el.querySelector("header.hm-snav");
  assert.ok(nav.className.includes("hm-snav-transparent") && nav.className.includes("is-sticky"));
  assert.equal(nav.querySelector("nav").getAttribute("aria-label"), "Main");
  assert.ok(nav.querySelector(".hm-brand"));
  const [a, b] = nav.querySelectorAll(".hm-snav-link");
  assert.equal(a.getAttribute("aria-current"), "page");
  on.set("#b");
  assert.equal(a.getAttribute("aria-current"), null);
  assert.equal(b.getAttribute("aria-current"), "page");
  assert.equal(nav.querySelector(".hm-snav-menu").getAttribute("aria-label"), "Open menu");
  dispose();
});

test("SiteNav: no pill / coloured pill, own menu icon and names, no menu button", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const links = [{ label: "A", href: "#a" }];
  const dispose = render(() => [
    h(SiteNav, { brand: { name: "A" }, links, class: "one", pill: false, menu: false }),
    h(SiteNav, { brand: { name: "B" }, links, class: "two", pillColor: "brand-orange", menuIcon: h("i", { class: "mine" }), labels: { main: "Site", openMenu: "Show menu" } }),
  ], el);
  const one = el.querySelector(".one");
  assert.equal(one.querySelector(".hm-snav-pill"), null);
  assert.equal(one.querySelector(".hm-snav-menu"), null);
  const two = el.querySelector(".two");
  assert.equal(two.querySelector(".hm-snav-pill").getAttribute("data-hm-color"), "brand-orange");
  assert.equal(two.querySelector("nav").getAttribute("aria-label"), "Site");
  assert.equal(two.querySelector(".hm-snav-menu").getAttribute("aria-label"), "Show menu");
  assert.ok(two.querySelector(".hm-snav-menu .mine"));
  dispose();
});
