import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Carousel } = await import("./index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };
const mountD = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Carousel: labelled region, per-view class, labelled buttons; previous disabled at the start", async () => {
  const el = mount(() => h(Carousel, { perView: 2, label: "Features" }, [1, 2, 3, 4].map((n) => h("article", null, String(n)))));
  await tick();
  const root = el.querySelector(".hm-carousel");
  assert.equal(root.getAttribute("aria-roledescription"), "carousel");
  assert.equal(root.getAttribute("aria-label"), "Features");
  assert.ok(root.classList.contains("hm-carousel-2"));
  assert.equal(root.querySelector(".hm-carousel-track").children.length, 4);
  assert.ok(root.querySelector(".hm-carousel-prev").disabled);
  assert.equal(root.querySelector(".hm-carousel-next").getAttribute("aria-label"), "Next");
  assert.equal(root.querySelectorAll(".hm-carousel-dot").length, 3);
});

test("Carousel: own labels, icons, dots and colour; arrows and dots can be left out", async () => {
  const slides = () => [1, 2, 3].map((n) => h("article", null, String(n)));
  const m = mountD(() => [
    h(Carousel, { labels: { previous: "Back", next: "On", slide: (n) => `Photo ${n}` }, prevIcon: h("i", { class: "p" }), nextIcon: h("i", { class: "n" }), dots: (i, active) => h("b", { class: () => (active() ? "on" : "off") }, String(i + 1)), color: "brand-orange", smooth: false }, slides()),
    h(Carousel, { arrows: false, dots: false }, slides()),
  ]);
  await tick();
  const [a, b] = m.el.querySelectorAll(".hm-carousel");
  assert.equal(a.querySelector(".hm-carousel-prev").getAttribute("aria-label"), "Back");
  assert.equal(a.querySelector(".hm-carousel-next").getAttribute("aria-label"), "On");
  assert.ok(a.querySelector(".hm-carousel-prev .p") && a.querySelector(".hm-carousel-next .n"));
  assert.equal(a.querySelector(".hm-carousel-btn svg"), null);
  const dots = a.querySelectorAll(".hm-carousel-dot");
  assert.equal(dots.length, 3);
  assert.equal(dots[1].getAttribute("aria-label"), "Photo 2");
  assert.ok(dots[0].classList.contains("is-own"));
  assert.equal(dots[0].querySelector("b").className, "on");
  assert.equal(dots[2].textContent, "3");
  assert.equal(a.querySelector(".hm-carousel-dots").getAttribute("data-hm-color"), "brand-orange");
  assert.ok(a.classList.contains("is-instant"));
  assert.equal(b.querySelector(".hm-carousel-btn"), null);
  assert.equal(b.querySelector(".hm-carousel-dots"), null);
  assert.equal(b.querySelector(".hm-carousel-track").children.length, 3);
  m.dispose();
});
