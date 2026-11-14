import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Faq } = await import("./index.ts");

test("Faq: accordion of questions, split heading, search narrows the list", async () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const items = [{ q: "Is it free?", a: "Yes" }, { q: "Does it support RTL?", a: "Yes", keywords: "arabic" }];
  const dispose = render(() => h(Faq, { items, layout: "split", title: "Questions", search: true }), el);
  assert.equal(el.querySelector(".hm-faq-aside h2").textContent, "Questions");
  assert.equal(el.querySelectorAll(".hm-acc-btn").length, 2);
  const input = el.querySelector(".hm-faq-search input");
  input.value = "arabic"; input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(el.querySelectorAll(".hm-acc-btn").length, 1);
  assert.match(el.querySelector(".hm-acc-title").textContent, /RTL/);
  assert.equal(el.querySelector(".hm-faq-count").textContent, "1 of 2 questions");
  dispose();
});

test("Faq: own search texts, own count, no entrance", async () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const items = [{ q: "Is it free?", a: "Yes" }, { q: "Does it support RTL?", a: "Yes" }];
  const dispose = render(() => h(Faq, { items, layout: "split", title: "Q", search: true, reveal: "none", labels: { search: "Find", empty: "Nope", count: (a, b) => `${a}/${b}` } }), el);
  assert.equal(el.querySelector(".hm-faq-aside").tagName, "DIV");
  assert.equal(el.querySelector(".hm-faq-aside h2").textContent, "Q");
  const input = el.querySelector(".hm-faq-search input");
  assert.equal(input.getAttribute("placeholder"), "Find");
  input.value = "rtl"; input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(el.querySelector(".hm-faq-count").textContent, "1/2");
  input.value = "zzzzqqqq"; input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(el.querySelector(".hm-faq-empty").textContent, "Nope");
  dispose();
});

test("Faq: the count line can be left out", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(Faq, { items: [{ q: "A?", a: "B" }], search: true, count: false }), el);
  assert.ok(el.querySelector(".hm-faq-search input"));
  assert.equal(el.querySelector(".hm-faq-count"), null);
  dispose();
});
