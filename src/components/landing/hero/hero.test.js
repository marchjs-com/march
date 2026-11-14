import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
// no media playback in the test DOM: report reduced motion so Overlay keeps the poster (no video chunk)
globalThis.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
const { h, render } = await import("../../../index.ts");
const { Hero } = await import("./index.ts");

const mount = (props) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(() => h(Hero, props), el); return { el, dispose }; };

test("Hero: one h1 with the gradient highlight, lead, actions (first primary), note", () => {
  const { el, dispose } = mount({ variant: "mesh", title: "Build sites fast", highlight: "fast", lead: "Lead", note: "No card", actions: [{ label: "Start" }, { label: "Demo" }] });
  assert.equal(el.querySelectorAll("h1").length, 1);
  assert.equal(el.querySelector("h1 .m-hero-hl").textContent, "fast");
  assert.equal(el.querySelector(".m-section-head-lead").textContent, "Lead");
  const btns = el.querySelectorAll(".m-section-head-actions .m-btn");
  assert.equal(btns.length, 2);
  assert.ok(btns[0].className.includes("primary"));
  assert.ok(el.querySelector(".m-ov-fx-mesh"));
  dispose();
});

test("Hero: product frame, split media with a reserved image size, video stage", () => {
  const a = mount({ variant: "product", title: "T", media: { src: "/s.png", alt: "Screen", width: 1600, height: 1000 } });
  const img = a.el.querySelector(".m-hero-frame img");
  assert.equal(img.getAttribute("width"), "1600");
  assert.equal(img.getAttribute("fetchpriority"), "high");
  a.dispose();
  const b = mount({ variant: "split", title: "T", media: h("div", { class: "x" }) });
  assert.ok(b.el.querySelector(".m-hero-media .x"));
  b.dispose();
  const c = mount({ variant: "video", title: "T", video: { src: "/v.webm", poster: "/p.jpg" } });
  assert.ok(c.el.querySelector(".m-vbg .m-section-head-title"));
  c.dispose();
});

test("Hero: no backdrop, no entrance, own eyebrow arrow or none, product frame without bar", () => {
  const a = mount({ variant: "mesh", title: "T", backdrop: false, reveal: "none", eyebrow: "New", eyebrowHref: "/n", eyebrowArrow: h("i", { class: "mine" }) });
  assert.equal(a.el.querySelector("[class*=m-ov-fx]"), null, "no decorative layer");
  assert.equal(a.el.querySelector(".m-hero-copy").classList.contains("m-reveal-box"), false, "a plain block, not a Reveal");
  assert.ok(a.el.querySelector(".m-hero-eyebrow-arrow .mine"));
  assert.equal(a.el.querySelector("h1").textContent, "T");
  a.dispose();
  const b = mount({ variant: "centered", title: "T", eyebrow: "New", eyebrowHref: "/n", eyebrowArrow: false });
  assert.equal(b.el.querySelector(".m-hero-eyebrow-arrow"), null);
  assert.ok(b.el.querySelector(".m-hero-copy.m-reveal-box"), "the default entrance stays");
  b.dispose();
  const c = mount({ variant: "product", title: "T", media: h("div", { class: "x" }), frameBar: false, tilt: false });
  assert.ok(c.el.querySelector(".m-hero-frame .x"));
  assert.equal(c.el.querySelector(".m-hero-frame-bar"), null);
  c.dispose();
  const d = mount({ variant: "split", title: "T", media: h("div", { class: "x" }), reveal: "none" });
  assert.equal(d.el.querySelector(".m-hero-media-wrap").classList.contains("m-reveal-box"), false);
  d.dispose();
});
