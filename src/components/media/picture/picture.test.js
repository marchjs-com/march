import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Picture, isPicture } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const COVER = { src: "/a.jpg", alt: "Hills", width: 1200, height: 800, srcset: "/a.jpg 1x, /a@2x.jpg 2x", sizes: "50vw" };

test("isPicture: an object with src, not a node", () => {
  assert.equal(isPicture(COVER), true);
  assert.equal(isPicture(document.createElement("img")), false);
  assert.equal(isPicture(null), false);
  assert.equal(isPicture("a.jpg"), false);
});

test("Picture: a picture object becomes a lazy image with its size", () => {
  const [el, dispose] = mount(() => h(Picture, { source: COVER, fit: "cover", class: "mine", draggable: "false" }));
  const img = el.querySelector("img.hm-picture");
  assert.equal(img.getAttribute("src"), "/a.jpg");
  assert.equal(img.getAttribute("alt"), "Hills");
  assert.equal(img.getAttribute("width"), "1200");
  assert.equal(img.getAttribute("height"), "800");
  assert.equal(img.getAttribute("srcset"), COVER.srcset);
  assert.equal(img.getAttribute("sizes"), "50vw");
  assert.equal(img.getAttribute("loading"), "lazy");
  assert.equal(img.getAttribute("decoding"), "async");
  assert.equal(img.getAttribute("fetchpriority"), null);
  assert.equal(img.getAttribute("draggable"), "false");
  assert.ok(img.classList.contains("hm-picture-cover") && img.classList.contains("mine"));
  dispose();
});

test("Picture: eager, flat props win over the object, a node passes through", () => {
  const node = document.createElement("canvas");
  const [el, dispose] = mount(() => [h(Picture, { source: COVER, loading: "eager", alt: "Own", class: "one" }), h(Picture, { source: node }), h(Picture, { src: "/b.png", class: "three" })]);
  const one = el.querySelector(".one");
  assert.equal(one.getAttribute("loading"), null);
  assert.equal(one.getAttribute("fetchpriority"), "high");
  assert.equal(one.getAttribute("alt"), "Own");
  assert.equal(node.parentNode, el);
  assert.equal(el.querySelector(".three").getAttribute("alt"), "");
  dispose();
});

test("Picture: fallback replaces a failed image; onLoad / onError run", () => {
  const seen = [];
  const [el, dispose] = mount(() => [
    h(Picture, { source: COVER, fallback: "No picture", onError: () => seen.push("error"), onLoad: () => seen.push("load") }),
  ]);
  const img = el.querySelector("img");
  img.dispatchEvent(new Event("load"));
  img.dispatchEvent(new Event("error"));
  assert.deepEqual(seen, ["load", "error"]);
  assert.equal(el.querySelector("img"), null);
  const f = el.querySelector(".hm-picture-fallback");
  assert.equal(f.textContent, "No picture");
  assert.equal(f.getAttribute("aria-label"), "Hills");
  dispose();
});
