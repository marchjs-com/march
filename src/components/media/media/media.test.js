import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Media, mediaKind } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };
const mountD = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("mediaKind: from the extension", () => {
  assert.equal(mediaKind("a/b.webm?x=1"), "video");
  assert.equal(mediaKind("song.mp3"), "audio");
  assert.equal(mediaKind("pic.jpg"), "image");
});

test("Media: auto picks video with controls; image keeps alt; no src shows the fallback text", () => {
  const el = mount(() => [h(Media, { src: "clip.mp4", kind: "auto" }), h(Media, { src: "a.jpg", alt: "Hills", size: "sm" }), h(Media, { src: "" })]);
  const v = el.querySelector("video");
  assert.ok(v && v.classList.contains("hm-media-video"));
  assert.ok(v.hasAttribute("controls"));
  const img = el.querySelector("img");
  assert.equal(img.getAttribute("alt"), "Hills");
  assert.ok(img.classList.contains("hm-media-sm"));
  assert.equal(el.querySelector(".hm-media-fallback").textContent, "No media");
});

test("Media: an own fallback (text or node) replaces both default texts; class lands on the media", () => {
  const m = mountD(() => [h(Media, { src: "", fallback: "Nothing to show" }), h(Media, { src: "a.jpg", class: "mine", fallback: h("b", { class: "own" }, "Gone") })]);
  assert.equal(m.el.querySelector(".hm-media-fallback").textContent, "Nothing to show");
  const img = m.el.querySelector("img.mine");
  img.dispatchEvent(new globalThis.Event("error"));
  assert.equal(m.el.querySelector("img"), null);
  assert.equal(m.el.querySelector("[role=status] .own").textContent, "Gone");
  m.dispose();
});
