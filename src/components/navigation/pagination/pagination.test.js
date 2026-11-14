import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { Pagination } = await import("./index.ts");

test("Pagination: ends stay, the middle collapses, Previous / Next and the current page", () => {
  const page = signal(1);
  const { host, dispose } = mount(() => h(Pagination, { page, pages: 20, setPage: (p) => page.set(p) }));
  const nav = host.querySelector("nav");
  assert.ok(nav.getAttribute("aria-label"));
  const [prev] = host.querySelectorAll(".hm-page-nav");
  assert.equal(prev.disabled, true);
  assert.ok([...host.querySelectorAll(".hm-page-btn")].some((b) => b.textContent === "20"));
  assert.ok(host.querySelector(".hm-page-gap"));
  assert.equal(host.querySelector('[aria-current="page"]').textContent, "1");
  host.querySelectorAll(".hm-page-nav")[1].click();
  assert.equal(page(), 2);
  assert.equal(host.querySelector('[aria-current="page"]').textContent, "2");
  dispose();
});

test("Pagination: own texts and names, own Previous / Next and gap, color; controls and gap off", () => {
  const { host, dispose } = mount(() => [
    h(Pagination, { page: 10, pages: 20, prev: "Back", next: "More", gap: "·", color: "brand-blue", label: "Result pages", labels: { previous: "Previous page", next: "Next page", page: (n) => `Page ${n}` } }),
    h(Pagination, { page: 10, pages: 20, controls: false, gap: false }),
  ]);
  const [own, bare] = host.querySelectorAll("nav");
  assert.equal(own.getAttribute("aria-label"), "Result pages");
  assert.equal(own.getAttribute("data-hm-color"), "brand-blue");
  const [prev, next] = own.querySelectorAll(".hm-page-nav");
  assert.equal(prev.getAttribute("aria-label"), "Previous page");
  assert.equal(prev.textContent, "Back");
  assert.equal(next.getAttribute("aria-label"), "Next page");
  assert.equal(next.textContent, "More");
  assert.equal(own.querySelector(".hm-page-gap").textContent, "·");
  assert.equal(own.querySelector('[aria-current="page"]').getAttribute("aria-label"), "Page 10");
  assert.equal(bare.querySelectorAll(".hm-page-nav").length, 0);
  assert.equal(bare.querySelector(".hm-page-gap"), null);
  assert.equal(bare.getAttribute("data-hm-color"), null);
  assert.equal(bare.querySelector('[aria-current="page"]').textContent, "10");
  dispose();
});

test("Pagination simple: page count from total + size, range and status texts, sizes select, own texts", () => {
  const page = signal(2), sizes = [];
  const { host, dispose } = mount(() => [
    h(Pagination, { variant: "simple", page, total: 134, size: 20, sizes: [20, 50], onSize: (n) => sizes.push(n), setPage: (p) => page.set(p) }),
    h(Pagination, { variant: "simple", page: 1, pages: 3, info: false, status: (p, n) => `${p}/${n}`, prev: "Back", next: "More", labels: { previous: "Previous slide", next: "Next slide" } }),
    h(Pagination, { variant: "simple", page: 1, total: 40, info: (r) => `${r.from}..${r.to} / ${r.total}`, status: false, controls: false }),
  ]);
  const [full, deck, bare] = host.querySelectorAll("nav");
  assert.match(full.getAttribute("class"), /hm-pagination-simple/);
  assert.match(full.querySelector(".hm-page-info").textContent, /21.40.*134/);
  assert.match(full.querySelector(".hm-page-status").textContent, /2.*7/);
  const [prev, next] = full.querySelectorAll(".hm-page-nav");
  assert.equal(prev.tagName, "BUTTON");
  assert.ok(prev.textContent.length > 0, "the default content names the button");
  assert.equal(prev.getAttribute("aria-label"), null);
  assert.equal(prev.disabled, false);
  next.click();
  assert.equal(page(), 3);
  assert.match(full.querySelector(".hm-page-info").textContent, /41.60/);
  page.set(7);
  assert.equal(full.querySelectorAll(".hm-page-nav")[1].disabled, true);
  assert.match(full.querySelector(".hm-page-info").textContent, /121.134/);
  const select = full.querySelector("select");
  assert.ok(select.getAttribute("aria-label"));
  select.value = "1"; select.dispatchEvent(new Event("change", { bubbles: true }));
  assert.deepEqual(sizes, [50]);
  assert.equal(deck.querySelector(".hm-page-info"), null);
  assert.equal(deck.querySelector(".hm-page-status").textContent, "1/3");
  const [back, more] = deck.querySelectorAll(".hm-page-nav");
  assert.equal(back.textContent, "Back");
  assert.equal(back.getAttribute("aria-label"), "Previous slide");
  assert.equal(more.getAttribute("aria-label"), "Next slide");
  assert.equal(back.disabled, true);
  assert.equal(bare.querySelector(".hm-page-info").textContent, "1..20 / 40");
  assert.equal(bare.querySelector(".hm-page-status"), null);
  assert.equal(bare.querySelectorAll(".hm-page-nav").length, 0);
  dispose();
});

test("Pagination simple: cursor mode (no page count) follows hasPrev / hasNext and calls onPrev / onNext", () => {
  const hasNext = signal(true), calls = [];
  const { host, dispose } = mount(() => h(Pagination, { variant: "simple", hasPrev: false, hasNext, onPrev: () => calls.push("prev"), onNext: () => calls.push("next") }));
  const [prev, next] = host.querySelectorAll(".hm-page-nav");
  assert.equal(host.querySelector(".hm-page-status"), null);
  assert.equal(host.querySelector(".hm-page-info").textContent, "");
  assert.equal(prev.disabled, true);
  assert.equal(next.disabled, false);
  next.click();
  assert.deepEqual(calls, ["next"]);
  hasNext.set(false);
  assert.equal(next.disabled, true);
  dispose();
});

test("Pagination: numbers work from total + size too", () => {
  const { host, dispose } = mount(() => h(Pagination, { page: 3, total: 45, size: 10 }));
  assert.equal([...host.querySelectorAll(".hm-page-btn")].filter((b) => !b.getAttribute("class").includes("hm-page-nav")).map((b) => b.textContent).join(","), "1,2,3,4,5");
  dispose();
});
