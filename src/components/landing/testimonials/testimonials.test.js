import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Testimonials } = await import("./index.ts");

const items = Array.from({ length: 8 }, (_, i) => ({ quote: `Q${i}`, name: `N${i}`, role: "R", rating: 5 }));
const mount = (props) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(() => h(Testimonials, props), el); return { el, dispose }; };

test("Testimonials grid: figure / blockquote / cite per item", () => {
  const { el, dispose } = mount({ items, variant: "grid" });
  const figs = el.querySelectorAll("figure.hm-tm-card");
  assert.equal(figs.length, 8);
  assert.equal(figs[0].querySelector("blockquote p").textContent, "Q0");
  assert.equal(figs[0].querySelector("cite").textContent, "N0");
  dispose();
});

test("Testimonials wall: Show more toggles aria-expanded; marquee copies are hidden", () => {
  const a = mount({ items, variant: "wall" });
  const btn = a.el.querySelector(".hm-tm-more button");
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  btn.click();
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  assert.ok(!a.el.querySelector(".hm-tm-list").className.includes("is-closed"));
  a.dispose();
  const b = mount({ items, variant: "marquee" });
  assert.equal(b.el.querySelectorAll(".hm-marquee").length, 2);
  assert.ok(b.el.querySelector('.hm-tm-strip[aria-hidden="true"] figure'));
  b.dispose();
});
