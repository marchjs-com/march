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
