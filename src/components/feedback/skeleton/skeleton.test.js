import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Skeleton } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

test("Skeleton: n lines (the last short) are busy; a block is decorative; colours add a tint class", () => {
  const el = mount(() => [h(Skeleton, { lines: 4 }), h(Skeleton, { block: true, height: "lg", colors: "brand" })]);
  const lines = el.querySelector(".hm-skel-lines");
  assert.equal(lines.getAttribute("aria-busy"), "true");
  assert.equal(lines.querySelectorAll(".hm-skel-line").length, 4);
  assert.ok(lines.lastElementChild.classList.contains("hm-skel-short"));
  const block = el.querySelector(".hm-skel-block");
  assert.equal(block.getAttribute("aria-hidden"), "true");
  assert.ok(block.classList.contains("hm-skel-lg") && block.classList.contains("hm-skel-brand"));
});
