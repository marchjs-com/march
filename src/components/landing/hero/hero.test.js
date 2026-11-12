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
  assert.equal(el.querySelector("h1 .hm-hero-hl").textContent, "fast");
  assert.equal(el.querySelector(".hm-hero-lead").textContent, "Lead");
  const btns = el.querySelectorAll(".hm-hero-actions .hm-btn");
  assert.equal(btns.length, 2);
  assert.ok(btns[0].className.includes("primary"));
  assert.ok(el.querySelector(".hm-ov-fx-mesh"));
  dispose();
});

test("Hero: product frame, split media with a reserved image size, video stage", () => {
  const a = mount({ variant: "product", title: "T", media: { src: "/s.png", alt: "Screen", width: 1600, height: 1000 } });
  const img = a.el.querySelector(".hm-hero-frame img");
  assert.equal(img.getAttribute("width"), "1600");
  assert.equal(img.getAttribute("fetchpriority"), "high");
  a.dispose();
  const b = mount({ variant: "split", title: "T", media: h("div", { class: "x" }) });
  assert.ok(b.el.querySelector(".hm-hero-media .x"));
  b.dispose();
  const c = mount({ variant: "video", title: "T", video: { src: "/v.webm", poster: "/p.jpg" } });
  assert.ok(c.el.querySelector(".hm-vbg .hm-hero-title"));
  c.dispose();
});
