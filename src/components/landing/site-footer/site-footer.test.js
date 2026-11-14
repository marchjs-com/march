import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { SiteFooter } = await import("./index.ts");

test("SiteFooter: columns as labelled navs, social names, newsletter, copyright, decorative wordmark", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(SiteFooter, {
    brand: { name: "HADİ" }, about: "About",
    columns: [{ title: "Product", links: [{ label: "Pricing", href: "/p" }] }],
    social: [{ label: "Blog", href: "/b", icon: "★" }],
    newsletter: { onSubmit: () => {} }, legal: [{ label: "Privacy", href: "/x" }], wordmark: "HADİ",
  }), el);
  const f = el.querySelector("footer.hm-sfoot");
  assert.equal(f.querySelector(".hm-sfoot-col").getAttribute("aria-label"), "Product");
  assert.equal(f.querySelector(".hm-sfoot-social-link").getAttribute("aria-label"), "Blog");
  assert.ok(f.querySelector(".hm-nl form"));
  assert.match(f.querySelector(".hm-sfoot-copy").textContent, /© \d{4} HADİ/);
  assert.equal(f.querySelector(".hm-sfoot-mark").getAttribute("aria-hidden"), "true");
  assert.equal(f.querySelector(".hm-sfoot-top-btn").getAttribute("aria-label"), "Back to top");
  dispose();
});

test("SiteFooter: no copyright, own back-to-top icon and name, no button", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => [
    h(SiteFooter, { brand: { name: "A" }, class: "one", copyright: false, toTopIcon: h("i", { class: "mine" }), toTopLabel: "Up" }),
    h(SiteFooter, { brand: { name: "B" }, class: "two", toTop: false }),
  ], el);
  const one = el.querySelector(".one");
  assert.equal(one.querySelector(".hm-sfoot-copy"), null);
  assert.equal(one.querySelector(".hm-sfoot-top-btn").getAttribute("aria-label"), "Up");
  assert.ok(one.querySelector(".hm-sfoot-top-btn .mine"));
  assert.equal(el.querySelector(".two .hm-sfoot-top-btn"), null);
  dispose();
});
