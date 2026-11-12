import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Pricing } = await import("./index.ts");

const plans = [
  { name: "Free", price: 0, features: ["A", { label: "B", included: false }], cta: { label: "Start" } },
  { name: "Pro", price: { monthly: 29, yearly: 24 }, featured: true, badge: "Popular", cta: { label: "Go" } },
  { name: "Ent", price: null },
];

test("Pricing: cards, featured badge, custom price, not-included feature, radio switch", () => {
  const period = signal("monthly");
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(Pricing, { plans, period, setPeriod: (p) => period.set(p), currency: "EUR", saving: "2 free" }), el);
  const cards = el.querySelectorAll("article.hm-price-card");
  assert.equal(cards.length, 3);
  assert.ok(cards[1].className.includes("is-featured"));
  assert.equal(cards[1].querySelector(".hm-price-badge").textContent, "Popular");
  assert.equal(cards[2].querySelector(".hm-price-custom").textContent, "Custom");
  assert.ok(cards[0].querySelector(".hm-price-feat.is-off .hm-sr-only"));
  assert.match(cards[1].querySelector(".hm-sr-only").textContent, /29/);
  const radios = el.querySelectorAll('.hm-price-seg [role="radio"]');
  assert.equal(radios.length, 2);
  radios[1].click();
  assert.equal(period(), "yearly");
  assert.match(cards[1].querySelector(".hm-counter .hm-sr-only").textContent, /24/);
  assert.equal(cards[1].querySelector(".hm-price-billed").textContent, "billed yearly");
  dispose();
});
