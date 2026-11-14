import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
globalThis.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
const { h, render } = await import("../../../index.ts");
const { CtaBand } = await import("./index.ts");

test("CtaBand: section with h2, actions, gradient layers", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(CtaBand, { title: "Ready?", lead: "Go", actions: [{ label: "Start" }, { label: "Sales" }] }), el);
  assert.ok(el.querySelector("section.hm-ss.hm-cta-gradient"));
  assert.equal(el.querySelector(".hm-cta-copy h2").textContent, "Ready?");
  assert.equal(el.querySelectorAll(".hm-section-head-actions .hm-btn").length, 2);
  assert.ok(el.querySelector(".hm-cta-panel .hm-ov-fx-gradient"));
  dispose();
});

test("CtaBand: no backdrop layers, no entrance", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(CtaBand, { title: "Ready?", backdrop: false, reveal: "none", class: "mine" }), el);
  assert.ok(el.querySelector("section.hm-cta.mine"));
  assert.equal(el.querySelector(".hm-cta-panel [class*=hm-ov]"), null, "no overlay in the panel");
  assert.equal(el.querySelector(".hm-reveal-box"), null, "the panel is not wrapped in a Reveal");
  assert.equal(el.querySelector(".hm-cta-panel h2").textContent, "Ready?");
  dispose();
});
