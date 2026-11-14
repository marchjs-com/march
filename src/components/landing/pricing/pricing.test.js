import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
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
  const cards = el.querySelectorAll("article.m-price-card");
  assert.equal(cards.length, 3);
  assert.ok(cards[1].className.includes("is-featured"));
  assert.equal(cards[1].querySelector(".m-price-badge").textContent, "Popular");
  assert.equal(cards[2].querySelector(".m-price-custom").textContent, "Custom");
  assert.ok(cards[0].querySelector(".m-price-feat.is-off .m-sr-only"));
  assert.match(cards[1].querySelector(".m-sr-only").textContent, /29/);
  const radios = el.querySelectorAll('.m-price-seg [role="radio"]');
  assert.equal(radios.length, 2);
  radios[1].click();
  assert.equal(period(), "yearly");
  assert.match(cards[1].querySelector(".m-counter .m-sr-only").textContent, /24/);
  assert.equal(cards[1].querySelector(".m-price-billed").textContent, "billed yearly");
  dispose();
});

test("Pricing: own texts, colour, own feature mark, no per line, plain price, no reveal", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => [
    mProps(h(Pricing, { plans, class: "one", featureColor: "brand-blue", priceEffect: "none", per: false, reveal: false,
      labels: { monthly: "Pay monthly", yearly: "Pay yearly", custom: "Talk", notIncluded: "missing", billingPeriod: "Period" } }), { color: "brand-purple" }),
    h(Pricing, { plans, class: "two", featureIcon: (on) => h("b", { class: "mine" }, on ? "+" : "-"), labels: { perMonth: "per seat", billedMonthly: "each month" } }),
    h(Pricing, { plans, class: "three", featureIcon: false, toggle: false }),
  ], el);
  const one = el.querySelector(".one");
  assert.equal(one.getAttribute("data-m-color"), "brand-purple");
  assert.deepEqual([...one.querySelectorAll('.m-price-seg [role="radio"]')].map((r) => r.textContent), ["Pay monthly", "Pay yearly"]);
  assert.equal(one.querySelector(".m-price-custom").textContent, "Talk");
  assert.equal(one.querySelector(".m-price-feat.is-off .m-sr-only").textContent, " (missing)");
  assert.equal(one.querySelector(".m-price-feat-icon").getAttribute("data-m-color"), "brand-blue");
  assert.equal(one.querySelector(".m-price-per"), null);
  assert.equal(one.querySelector(".m-counter"), null);
  assert.match(one.querySelectorAll(".m-price-card")[1].querySelector(".m-price-plain").textContent, /29/);
  assert.ok(!one.querySelector(".m-price-row").classList.contains("m-reveal"));
  const two = el.querySelector(".two");
  assert.deepEqual([...two.querySelectorAll(".m-price-feat-own .mine")].map((b) => b.textContent), ["+", "-"]);
  assert.equal(two.querySelector(".m-price-per").textContent, "per seateach month");
  const three = el.querySelector(".three");
  assert.equal(three.querySelector(".m-price-feat-icon"), null);
  assert.equal(three.querySelector(".m-price-feat-own"), null);
  dispose();
});
