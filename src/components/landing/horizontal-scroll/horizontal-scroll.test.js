import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { HorizontalScroll } = await import("./index.ts");

test("HorizontalScroll: labelled region, panels in a track, panel width variable", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(HorizontalScroll, { label: "Cases", panel: "20rem" }, h("article", {}, "1"), h("article", {}, "2")), el);
  const root = el.querySelector("section.hm-hs");
  assert.equal(root.getAttribute("role"), "region");
  assert.equal(root.getAttribute("aria-label"), "Cases");
  assert.equal(root.style.getPropertyValue("--hm-hs-panel"), "20rem");
  assert.equal(root.querySelectorAll(".hm-hs-track > article, .hm-hs-track article").length, 2);
  dispose();
});

test("HorizontalScroll: no progress line; not pinned is the native scroller", async () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => [
    h(HorizontalScroll, { class: "a" }, h("article", {}, "1")),
    h(HorizontalScroll, { class: "b", progress: false, pinned: false }, h("article", {}, "1")),
  ], el);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(el.querySelector(".hm-hs.a .hm-hs-bar"));
  assert.equal(el.querySelector(".hm-hs.b .hm-hs-bar"), null);
  assert.ok(el.querySelector(".hm-hs.b").classList.contains("is-native"));
  dispose();
});
