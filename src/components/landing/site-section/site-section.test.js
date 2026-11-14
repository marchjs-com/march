import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { SiteSection } = await import("./index.ts");

test("SiteSection: labelled by its title, tone and width classes", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(SiteSection, { title: "Features", eyebrow: "New", tone: "muted", width: "narrow" }, h("p", {}, "body")), el);
  const s = el.querySelector("section.hm-ss");
  assert.ok(s.className.includes("hm-ss-muted") && s.className.includes("hm-ss-w-narrow"));
  const h2 = s.querySelector("h2");
  assert.equal(h2.textContent, "Features");
  assert.equal(s.getAttribute("aria-labelledby"), h2.id);
  assert.ok(s.textContent.includes("body"));
  dispose();
});

test("SiteSection: own colour, heading without the entrance", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(SiteSection, { title: "T", color: "brand-purple", reveal: false, class: "mine" }), el);
  const s = el.querySelector("section.hm-ss");
  assert.equal(s.getAttribute("data-hm-color"), "brand-purple");
  assert.equal(s.getAttribute("reveal"), null);
  assert.equal(s.getAttribute("color"), null);
  assert.ok(s.classList.contains("mine"));
  const head = s.querySelector(".hm-ss-head");
  assert.ok(head.classList.contains("is-revealed") && !head.classList.contains("is-pending"));
  dispose();
});
