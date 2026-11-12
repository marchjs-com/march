import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Card } = await import("./index.ts");
const { action } = await import("../../../ui/action.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Card: header, actions, body, footer and flush", () => {
  const m = mount(() => [
    h(Card, { title: "HADİ", subtitle: "Plan", actions: [action("Edit", () => {})], footer: "Updated", "data-x": "1" }, "Body"),
    h(Card, { flush: true, as: "article" }, "Bare"),
  ]);
  const [a, b] = m.el.children;
  assert.equal(a.tagName, "SECTION");
  assert.equal(a.getAttribute("data-x"), "1");
  assert.equal(a.querySelector(".hm-card-title").textContent, "HADİ");
  assert.equal(a.querySelector(".hm-card-sub").textContent, "Plan");
  assert.ok(a.querySelector(".hm-card-actions button"), "action() renders as a button");
  assert.equal(a.querySelector(".hm-card-foot").textContent, "Updated");
  assert.equal(b.tagName, "ARTICLE");
  assert.ok(b.className.includes("hm-card-flush"));
  assert.equal(b.querySelector(".hm-card-head"), null, "no header without title / actions");
  m.dispose();
});
