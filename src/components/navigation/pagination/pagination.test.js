import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
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
