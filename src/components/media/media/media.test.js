import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Media, mediaKind } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

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
