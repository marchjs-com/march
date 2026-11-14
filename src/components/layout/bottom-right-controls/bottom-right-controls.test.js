import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { addCornerControl, cornerControls, CornerControls, BottomRightControls, addBottomRightControl, CORNERS } = await import("./index.ts");

const btn = (txt) => { const b = document.createElement("button"); b.textContent = txt; return b; };

test("corners: a control joins its corner in order and leaves with off()", () => {
  const a = btn("a"), b = btn("b"), c = btn("c");
  const offA = addCornerControl("bottom-end", a, 10);
  addCornerControl("bottom-end", b, 0);
  addCornerControl("bottom-end", c, 5);
  const el = cornerControls("bottom-end");
  assert.equal(el.getAttribute("data-corner"), "bottom-end");
  assert.equal(el.getAttribute("role"), "group");
  assert.deepEqual([...el.children].map((x) => x.textContent), ["b", "c", "a"], "lower order nearer the edge");
  offA();
  assert.deepEqual([...el.children].map((x) => x.textContent), ["b", "c"]);
  el.replaceChildren();
});

test("corners: four of them, each its own element; BottomRightControls is bottom-end", () => {
  assert.deepEqual(CORNERS, ["top-start", "top-end", "bottom-start", "bottom-end"]);
  const els = new Set(CORNERS.map((c) => cornerControls(c)));
  assert.equal(els.size, 4);
  const x = btn("x");
  addBottomRightControl(x);
  assert.equal(x.parentElement, cornerControls("bottom-end"));
  x.remove();
});

test("corners: a rendered corner takes over the controls added before, and a control added in a component leaves with it", () => {
  const early = btn("early");
  addCornerControl("top-start", early);
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(CornerControls, { corner: "top-start" }), host);
  const el = host.querySelector(".hm-corner-top-start");
  assert.equal(early.parentElement, el);
  const inner = btn("inner");
  const d2 = render(() => { addCornerControl("top-start", inner); return null; }, document.createElement("div"));
  assert.equal(inner.parentElement, el);
  d2();
  assert.equal(inner.parentElement, null, "cleaned up with its component");
  dispose();
});

test("corners: a rendered corner takes its own label and class", () => {
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(BottomRightControls, { label: "Quick actions", class: "mine" }), host);
  const el = host.querySelector(".hm-corner-bottom-end");
  assert.equal(el.getAttribute("aria-label"), "Quick actions");
  assert.ok(el.classList.contains("mine"));
  dispose();
  const d2 = render(() => h(CornerControls, { corner: "top-end" }), host);
  assert.equal(host.querySelector(".hm-corner-top-end").getAttribute("aria-label"), "Page controls");
  d2();
});
