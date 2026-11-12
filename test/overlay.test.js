// Overlay: insertion order, front/behind, geometry variables, fit, decorative + inert, never takes pointer input.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installDom } from "../src/testing/dom.ts";

installDom();
const { h, render } = await import("../src/index.ts");
const U = await import("../src/ui/index.ts");
const css = readFileSync(new URL("../src/ui/overlay.css", import.meta.url), "utf8");

test("Overlay: order, front/behind, inset and fit as CSS variables, decorative and inert", async () => {
  const el = document.createElement("div");
  render(() => h("div", { class: "card" },
    h(U.Overlay, { src: "a.jpg", fit: "contain", position: "50% 20%", inset: 4, opacity: 0.5 }),
    h(U.Overlay, { effect: "glass", top: "10px", start: 2 }),
    h(U.Overlay, { effect: "spotlight", front: true }),
    h(U.Overlay, { src: "b.jpg", alt: "A team photo" }),
    h("p", {}, "content")), el);
  await new Promise((r) => setTimeout(r, 0));
  const [a, b, c, d] = el.querySelectorAll(".hm-ov");
  const z = (x) => Number(x.style.getPropertyValue("--hm-ov-z"));
  assert.ok(z(a) < z(b), "added first = lower");
  assert.ok(z(b) < 0 && z(c) > 0, "behind under the content, front above it");
  assert.equal(a.style.getPropertyValue("--hm-ov-top"), "var(--hm-space-4, 16px)");
  assert.equal(a.style.getPropertyValue("--hm-ov-fit"), "contain");
  assert.equal(a.style.getPropertyValue("--hm-ov-pos"), "50% 20%");
  assert.equal(a.style.getPropertyValue("--hm-ov-opacity"), "0.5");
  assert.equal(b.style.getPropertyValue("--hm-ov-top"), "10px");
  assert.equal(b.style.getPropertyValue("--hm-ov-start"), "var(--hm-space-2, 8px)");
  assert.equal(a.getAttribute("style")?.includes("--hm-ov") ?? true, true, "values set through CSSOM (style object)");
  for (const o of [a, b, c]) { assert.equal(o.getAttribute("aria-hidden"), "true"); assert.ok(o.hasAttribute("inert")); }
  assert.equal(d.getAttribute("aria-hidden"), null, "an image with a meaningful alt stays visible to screen readers");
  assert.equal(a.querySelector("img").getAttribute("loading"), "lazy");
  assert.ok(el.querySelector(".card").classList.contains("hm-ov-host"), "the container becomes the positioned, isolated host");
  assert.match(b.className, /hm-ov-fx-glass/);
});

test("Overlay CSS: never takes pointer input (unless interactive), logical insets, isolation", () => {
  assert.match(css, /\.hm-ov \{[^}]*pointer-events: none;/);
  assert.match(css, /\.hm-ov \* \{ pointer-events: none !important; \}/);
  assert.match(css, /\.hm-ov\.is-interactive, \.hm-ov\.is-interactive \* \{ pointer-events: auto !important; \}/);
  assert.match(css, /\.hm-ov-host \{ position: relative; isolation: isolate; \}/);
  assert.match(css, /inset-inline-start: var\(--hm-ov-start, 0\)/);
  const media = readFileSync(new URL("../src/ui/overlay-media.ts", import.meta.url), "utf8");
  for (const a of ["muted", "loop", "playsinline", "disablepictureinpicture"]) assert.ok(media.includes(`"${a}"`), a);
  assert.match(media, /else v\.pause\(\)/, "video pauses when not visible");
  assert.match(media, /devicePixelRatio/, "canvas is DPR aware");
});
