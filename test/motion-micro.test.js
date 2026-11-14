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
  assert.equal(b.getAttribute("data-m-state"), "loading");
  assert.equal(b.getAttribute("aria-busy"), "");
  assert.equal(b.style.getPropertyValue("width"), "40px");
  assert.ok(b.querySelector(".m-state-icon circle"), "spinner");
  assert.ok(b.querySelector("[aria-live]").textContent.length > 0, "announced");
  M.stateMorph(b, "success").finish();
  assert.equal(b.getAttribute("data-m-state"), "success");
  assert.equal(b.hasAttribute("aria-busy"), false);
  assert.ok(b.querySelector(".m-state-icon path"), "check");
  M.stateMorph(b, "idle").finish();
  assert.equal(b.hasAttribute("data-m-state"), false);
  assert.equal(b.querySelector(".m-state-icon").children.length, 0);
  b.remove();
});

test("ripple: an element made before it is in the document (static position) still gets the ink inside it; Enter starts it in the centre", () => {
  const origCs = globalThis.getComputedStyle;
  // like a browser: a detached element has no computed position, a connected one without a rule is static
  globalThis.getComputedStyle = (el) => ({ position: el.isConnected ? el.style.getPropertyValue("position") || "static" : "", getPropertyValue: () => "" });
  try {
    const card = rect(document.createElement("div"), 100, 50, 200, 80);
    const off = M.ripple(card, { duration: 10 });   // the action runs first (JSX), the element is attached after
    document.body.append(card);
    card.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 120, clientY: 60 }));
    assert.equal(card.style.getPropertyValue("position"), "relative", "the ink's containing block is the card");
    const ink = card.querySelector("span");
    const v = (el, k) => parseFloat(el.style.getPropertyValue(k)), size = v(ink, "width");
    assert.equal(v(ink, "left") + size / 2, 20, "centred on the press point (x)");
    assert.equal(v(ink, "top") + size / 2, 10, "centred on the press point (y)");
    card.dispatchEvent(Object.assign(new Event("keydown"), { key: "Enter" }));
    const k = card.querySelectorAll("span")[1], ks = v(k, "width");
    assert.equal(v(k, "left") + ks / 2, 100, "keyboard: from the centre (x)");
    assert.equal(v(k, "top") + ks / 2, 40, "keyboard: from the centre (y)");
    off(); card.remove();
  } finally { globalThis.getComputedStyle = origCs; }
});

test("stateMorph: 3 success and 3 error rounds with changing options; after each the button is exactly as it was", () => {
  const b = document.createElement("button");
  b.className = "m-btn m-btn-primary";
  b.textContent = "Değişiklikleri kaydet";
  // the box follows the inline width (natural width 160)
  b.getBoundingClientRect = () => { const w = parseFloat(b.style.getPropertyValue("width")) || 160; return { left: 0, top: 0, width: w, height: 40, right: w, bottom: 40 }; };
  document.body.append(b);
  const snap = () => ({ style: b.getAttribute("style"), cls: b.className, text: b.firstChild.textContent, state: b.getAttribute("data-m-state"), busy: b.hasAttribute("aria-busy"), disabled: b.hasAttribute("aria-disabled"), width: b.getBoundingClientRect().width, icon: b.querySelector(".m-state-icon")?.children.length ?? 0, live: b.querySelector("[aria-live]")?.textContent ?? "" });
  const first = snap();
  const rounds = [["success", { duration: 300 }], ["error", { duration: 500 }], ["success", { duration: 200, labels: { success: "Kaydedildi" } }], ["error", {}], ["success", { duration: 600 }], ["error", { duration: 250 }]];
  for (const [result, o] of rounds) {
    M.stateMorph(b, "loading", o).finish();
    assert.equal(b.getBoundingClientRect().width, 40, "loading: a circle");
    const r = M.stateMorph(b, result, o); r.finish();
    assert.equal(b.getAttribute("data-m-state"), result);
    M.stateMorph(b, "idle", o).finish();
    assert.deepEqual(snap(), first, `after a ${result} round the button is as it was`);
  }
  b.remove();
});
