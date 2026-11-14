import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { MediaGrid } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const items = (n) => Array.from({ length: n }, (_, i) => ({ src: `p${i}.svg`, alt: `p${i}` }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("MediaGrid: layout class, +N on the last tile, named buttons", () => {
  const m = mount(() => h(MediaGrid, { items: items(6) }));
  const g = m.el.querySelector(".m-mgrid");
  assert.ok(g.classList.contains("m-mgrid-n4"));
  assert.equal(g.getAttribute("role"), "group");
  assert.equal(g.getAttribute("aria-label"), "6 photos");
  const tiles = g.querySelectorAll("button.m-mgrid-tile");
  assert.equal(tiles.length, 4);
  assert.equal(tiles[3].querySelector(".m-mgrid-more").textContent, "+2");
  assert.equal(tiles[1].getAttribute("aria-label"), "p1 · Photo 2 of 6");
  m.dispose();
});

test("MediaGrid: single tap opens after the double-tap window; a double tap does not open", async () => {
  const opened = [], doubled = [];
  const m = mount(() => h(MediaGrid, { items: items(2), onOpen: (i) => opened.push(i), onDoubleTap: (i) => doubled.push(i) }));
  const [a, b] = m.el.querySelectorAll("button.m-mgrid-tile");
  const click = (el) => el.dispatchEvent(Object.assign(new globalThis.MouseEvent("click", { bubbles: true }), { detail: 1 }));
  click(a); click(a);
  await wait(260);
  assert.deepEqual(doubled, [0]);
  assert.deepEqual(opened, []);
  click(b);
  await wait(260);
  assert.deepEqual(opened, [1]);
  m.dispose();
});

test("MediaGrid: own names, +N off / own, video mark off / own, skeleton off / own", () => {
  const vids = [{ src: "a.svg", alt: "a", kind: "video" }, ...items(5)];
  const m = mount(() => [
    h(MediaGrid, { items: vids, label: "Trip", tileLabel: (i, n, it) => `${it.alt} ${i + 1}/${n}`, more: (rest) => h("b", { class: "own-more" }, `${rest} more`), videoMark: () => h("i", { class: "own-mark" }), skeleton: () => h("u", { class: "own-skel" }), class: "mine" }),
    h(MediaGrid, { items: vids, more: false, videoMark: false, skeleton: false }),
  ]);
  const [a, b] = m.el.querySelectorAll(".m-mgrid");
  assert.ok(a.classList.contains("mine"));
  assert.equal(a.getAttribute("aria-label"), "Trip");
  assert.equal(a.querySelector(".m-mgrid-tile").getAttribute("aria-label"), "a 1/6");
  assert.equal(a.querySelector(".m-mgrid-more .own-more").textContent, "2 more");
  assert.ok(a.querySelector(".m-mgrid-kind .own-mark"));
  assert.ok(a.querySelector(".m-mgrid-skel-own .own-skel"));
  assert.equal(b.getAttribute("aria-label"), "6 photos");
  assert.equal(b.querySelector(".m-mgrid-more"), null);
  assert.equal(b.querySelector(".m-mgrid-kind"), null);
  assert.equal(b.querySelector(".m-mgrid-skel"), null);
  m.dispose();
});
