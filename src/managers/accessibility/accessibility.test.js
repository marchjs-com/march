// AccessibilityManager: preferences saved and applied to <html>, motion override, clamping, reset, audit rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { h } = await import("../../index.ts");
const { reducedMotion } = await import("../../motion/env.ts");
const { a11y, configureA11y, disposeA11y, DEFAULT_PREFS } = await import("./index.ts");
const root = () => document.documentElement;

test("set applies to <html>, saves, and a new instance loads it", () => {
  disposeA11y();
  localStorage.removeItem("hm.a11y");
  assert.deepEqual(a11y.prefs(), DEFAULT_PREFS);
  a11y.set({ contrast: true, underlineLinks: true, fontScale: 1.25 });
  assert.equal(root().hasAttribute("data-hm-a11y-contrast"), true);
  assert.equal(root().hasAttribute("data-hm-a11y-links"), true);
  assert.equal(root().hasAttribute("data-hm-a11y-spacing"), false);
  assert.equal(root().style.getPropertyValue("font-size"), "125%");
  disposeA11y();
  assert.equal(root().hasAttribute("data-hm-a11y-contrast"), false, "dispose takes it off");
  assert.equal(a11y.prefs().contrast, true, "loaded from storage");
  assert.equal(root().hasAttribute("data-hm-a11y-contrast"), true);
});

test("motion drives the engine's reduced-motion override; fontScale is clamped; bad values are ignored", () => {
  disposeA11y();
  a11y.set({ motion: "reduce" });
  assert.equal(reducedMotion(), true);
  a11y.set({ motion: "full" });
  assert.equal(reducedMotion(), false);
  a11y.set({ motion: "system", fontScale: 9 });
  assert.equal(a11y.prefs().fontScale, 2);
  a11y.set({ motion: "bogus", contrast: "yes" });
  assert.equal(a11y.prefs().motion, "system");
  a11y.reset();
  assert.deepEqual(a11y.prefs(), DEFAULT_PREFS);
  assert.equal(root().style.getPropertyValue("font-size"), "");
});

test("storage null keeps preferences in memory only", () => {
  configureA11y({ storage: null, storageKey: "hm.a11y.mem" });
  a11y.set({ strongFocus: true });
  assert.equal(localStorage.getItem("hm.a11y.mem"), null);
  a11y.reset();
  configureA11y({ storage: undefined, storageKey: "hm.a11y" });
});

test("audit finds the common problems and skips hidden content", () => {
  const box = h("div", {},
    h("img", { src: "x.png" }),
    h("img", { src: "y.png", alt: "" }),
    h("button", {}),
    h("button", { "aria-label": "Close" }),
    h("input", { type: "text" }),
    h("label", {}, "Name ", h("input", { type: "text" })),
    h("input", { type: "hidden" }),
    h("span", { id: "dup" }), h("span", { id: "dup" }),
    h("a", { href: "#", tabindex: "3" }, "link"),
    h("h1", {}, "A"), h("h3", {}, "C"),
    h("div", { "aria-hidden": "true" }, h("button", {}, "hidden btn")),
    h("div", { hidden: true }, h("img", { src: "z.png" })));
  document.body.appendChild(box);
  const rules = a11y.audit(box).map((i) => i.rule).sort();
  assert.deepEqual(rules, ["duplicate-id", "heading-order", "hidden-focus", "img-alt", "label", "name", "tabindex"]);
  box.remove();
});
