import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";
const { document } = installDom();
const { h, render, signal, setLocale } = await import("../src/index.ts");
setLocale("en");
const { Media, openMedia, mediaKind, closeAll } = await import("../src/ui/index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); return { el, dispose: render(fn, el) }; };

test("mediaKind guesses from the extension", () => {
  assert.equal(mediaKind("https://x.test/a.mp4?alt=media"), "video");
  assert.equal(mediaKind("/s/a.WAV"), "audio");
  assert.equal(mediaKind("https://x.test/a.png"), "image");
  assert.equal(mediaKind(null), "image");
});

test("Media renders image / video / audio and follows src", () => {
  const src = signal("https://x.test/a.png");
  const kind = signal("image");
  const { el, dispose } = mount(() => h(Media, { src, kind, alt: "shot" }));
  assert.equal(el.querySelector("img").getAttribute("alt"), "shot");
  kind.set("video");
  assert.ok(el.querySelector("video"));
  assert.equal(el.querySelector("video").hasAttribute("controls"), true);
  kind.set("audio"); src.set("blob:https://x.test/1");
  assert.equal(el.querySelector("audio").getAttribute("src"), "blob:https://x.test/1");
  src.set("");
  assert.match(el.textContent, /No media/);
  dispose();
});

test("Media blocks unsafe URLs and shows a fallback on error", () => {
  const { el, dispose } = mount(() => h(Media, { src: "javascript:alert(1)" }));
  assert.equal(el.querySelector("img").getAttribute("src"), "about:blank");
  el.querySelector("img").dispatchEvent(new (globalThis.Event)("error"));
  assert.match(el.textContent, /Could not load media/);
  dispose();
});

test("openMedia opens a dialog with the media", async () => {
  openMedia("https://x.test/v.mov", { title: "Clip" });
  await tick();
  const d = document.querySelector("[role=dialog]");
  assert.ok(d && d.querySelector("video"));
  assert.match(d.textContent, /Clip/);
  closeAll();
});

test("Media size adds a size class", () => {
  const { el, dispose } = mount(() => h(Media, { src: "https://x.test/a.png", size: "sm" }));
  assert.ok(el.querySelector("img").getAttribute("class").includes("hm-media-sm"));
  dispose();
});
