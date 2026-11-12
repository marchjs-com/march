// Micro-interactions: ripple ink from the press point (removed when done), hover parallax writes layer transforms and
// springs back, spring press takes an easing, stateMorph walks idle → loading → success → idle with aria and tokens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";

installDom();
const M = await import("../src/motion/index.ts");
const E = await import("../src/motion/engine/clock.ts");
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const rect = (el, x, y, w, h) => { el.getBoundingClientRect = () => ({ left: x, top: y, width: w, height: h, right: x + w, bottom: y + h }); return el; };

test("ripple: an ink circle at the press point, gone after it plays", async () => {
  const b = rect(document.createElement("button"), 0, 0, 100, 40);
  document.body.append(b);
  const off = M.ripple(b, { duration: 10 });
  b.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 10, clientY: 20 }));
  const ink = b.querySelector("span");
  assert.ok(ink, "ink added");
  assert.equal(ink.getAttribute("aria-hidden"), "true");
  assert.equal(b.style.getPropertyValue("overflow"), "hidden");
  await tick(60);
  assert.equal(b.querySelector("span"), null, "removed at the end");
  off(); b.remove();
});

test("hoverParallax: deeper layers move more; leaving clears the inline transform", async () => {
  E.manualClock(true);
  try {
    const box = rect(document.createElement("div"), 0, 0, 200, 100);
    const a = document.createElement("span"); a.setAttribute("data-depth", "0.5");
    const b = document.createElement("span"); b.setAttribute("data-depth", "1");
    box.append(a, b); document.body.append(box);
    const off = M.hoverParallax(box, { depth: 20 });
    box.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 200, clientY: 50 }));
    E.step(16);
    assert.equal(a.style.getPropertyValue("transform"), "translate3d(5.00px, 0.00px, 0)");
    assert.equal(b.style.getPropertyValue("transform"), "translate3d(10.00px, 0.00px, 0)");
    box.dispatchEvent(new Event("pointerleave"));
    for (let i = 0; i < 120; i++) E.step(16);
    assert.match(b.style.getPropertyValue("transform") || "none", /^none$/, "no offset left");
    off(); box.remove();
  } finally { E.manualClock(false); }
});

test("stateMorph: loading is busy and round, success sets the state for the token colours, idle restores", () => {
  const b = rect(document.createElement("button"), 0, 0, 160, 40);
  b.textContent = "Kaydet";
  document.body.append(b);
  M.stateMorph(b, "loading").finish();
  assert.equal(b.getAttribute("data-hm-state"), "loading");
  assert.equal(b.getAttribute("aria-busy"), "");
  assert.equal(b.style.getPropertyValue("width"), "40px");
  assert.ok(b.querySelector(".hm-state-icon circle"), "spinner");
  assert.ok(b.querySelector("[aria-live]").textContent.length > 0, "announced");
  M.stateMorph(b, "success").finish();
  assert.equal(b.getAttribute("data-hm-state"), "success");
  assert.equal(b.hasAttribute("aria-busy"), false);
  assert.ok(b.querySelector(".hm-state-icon path"), "check");
  M.stateMorph(b, "idle").finish();
  assert.equal(b.hasAttribute("data-hm-state"), false);
  assert.equal(b.querySelector(".hm-state-icon").children.length, 0);
  b.remove();
});
