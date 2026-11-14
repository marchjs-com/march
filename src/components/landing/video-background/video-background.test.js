import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
// no media playback in the test DOM: report reduced motion so Overlay keeps the poster (no video chunk)
globalThis.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
const { h, render } = await import("../../../index.ts");
const { VideoBackground } = await import("./index.ts");

test("VideoBackground: poster overlay, tint, content above, no video on quiet media", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(VideoBackground, { src: "/v.webm", poster: "/p.jpg", tint: "brand" }, h("h1", {}, "Hello")), el);
  const root = el.querySelector(".m-vbg");
  assert.ok(root.className.includes("m-vbg-tint-brand"));
  assert.equal(root.querySelector(".m-ov-video .m-ov-poster").getAttribute("src"), "/p.jpg");
  assert.ok(root.querySelector(".m-vbg-tint"));
  assert.equal(root.querySelector(".m-vbg-content h1").textContent, "Hello");
  // quiet media (reduced motion here): the poster stays and there is no motion to pause
  assert.equal(root.querySelector(".m-vbg-toggle"), null);
  assert.equal(root.querySelector("video"), null);
  dispose();
});

test("VideoBackground: no tint layer with tint none, no button with controls false", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(VideoBackground, { src: "/v.webm", tint: "none", controls: false }), el);
  assert.equal(el.querySelector(".m-vbg-tint"), null);
  assert.equal(el.querySelector(".m-vbg-toggle"), null);
  dispose();
});

test("VideoBackground: own names and icons on the pause button", () => {
  const quiet = globalThis.matchMedia;
  // the test DOM has no media playback: give its elements a silent play / pause
  const proto = Object.getPrototypeOf(document.createElement("video"));
  proto.play ??= () => Promise.resolve(); proto.pause ??= () => {};
  globalThis.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(VideoBackground, { src: "/v.webm", class: "mine", labels: { pause: "Stop the waves" }, icons: { pause: h("i", { class: "own" }) } }), el);
  const btn = el.querySelector(".m-vbg.mine .m-vbg-toggle");
  assert.equal(btn.getAttribute("aria-label"), "Stop the waves");
  assert.ok(btn.querySelector(".own"));
  dispose();
  globalThis.matchMedia = quiet;
});
