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
  const g = m.el.querySelector(".hm-mgrid");
  assert.ok(g.classList.contains("hm-mgrid-n4"));
  assert.equal(g.getAttribute("role"), "group");
  assert.equal(g.getAttribute("aria-label"), "6 photos");
  const tiles = g.querySelectorAll("button.hm-mgrid-tile");
  assert.equal(tiles.length, 4);
  assert.equal(tiles[3].querySelector(".hm-mgrid-more").textContent, "+2");
  assert.equal(tiles[1].getAttribute("aria-label"), "p1 · Photo 2 of 6");
  m.dispose();
});

test("MediaGrid: single tap opens after the double-tap window; a double tap does not open", async () => {
  const opened = [], doubled = [];
  const m = mount(() => h(MediaGrid, { items: items(2), onOpen: (i) => opened.push(i), onDoubleTap: (i) => doubled.push(i) }));
  const [a, b] = m.el.querySelectorAll("button.hm-mgrid-tile");
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
