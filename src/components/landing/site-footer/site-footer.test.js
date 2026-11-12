import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { SiteFooter } = await import("./index.ts");

test("SiteFooter: columns as labelled navs, social names, newsletter, copyright, decorative wordmark", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(SiteFooter, {
    brand: { name: "Acme" }, about: "About",
    columns: [{ title: "Product", links: [{ label: "Pricing", href: "/p" }] }],
    social: [{ label: "Blog", href: "/b", icon: "★" }],
    newsletter: { onSubmit: () => {} }, legal: [{ label: "Privacy", href: "/x" }], wordmark: "Acme",
  }), el);
  const f = el.querySelector("footer.hm-sfoot");
  assert.equal(f.querySelector(".hm-sfoot-col").getAttribute("aria-label"), "Product");
  assert.equal(f.querySelector(".hm-sfoot-social-link").getAttribute("aria-label"), "Blog");
  assert.ok(f.querySelector(".hm-nl form"));
  assert.match(f.querySelector(".hm-sfoot-copy").textContent, /© \d{4} Acme/);
  assert.equal(f.querySelector(".hm-sfoot-mark").getAttribute("aria-hidden"), "true");
  assert.equal(f.querySelector(".hm-sfoot-top-btn").getAttribute("aria-label"), "Back to top");
  dispose();
});
