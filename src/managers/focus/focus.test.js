// FocusManager: trap + restore, stacked traps, contain, modality / focus-visible, roving tabindex, focus: props.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { h, render } = await import("../../index.ts");
const { focus, disposeFocus } = await import("./index.ts");
const key = (target, k, extra = {}) => { const e = new Event("keydown", { bubbles: true, cancelable: true }); Object.assign(e, { key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...extra }); target.dispatchEvent(e); return e; };
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

const panel = () => {
  const el = h("div", {}, h("button", { class: "p1" }, "1"), h("button", { class: "p2" }, "2"));
  document.body.appendChild(el);
  return el;
};
const cls = () => document.activeElement.getAttribute("class");

test("trap focuses the first item, Tab cycles inside, release restores the opener", () => {
  disposeFocus();
  const opener = h("button", {}, "open");
  document.body.appendChild(opener);
  opener.focus();
  const el = panel();
  const release = focus.trap(el);
  assert.equal(cls(), "p1");
  assert.equal(focus.trapped(), true);
  key(document.activeElement, "Tab", { shiftKey: true });
  assert.equal(cls(), "p2", "Shift+Tab on the first wraps to the last");
  key(document.activeElement, "Tab");
  assert.equal(cls(), "p1", "Tab on the last wraps to the first");
  release();
  assert.equal(focus.trapped(), false);
  assert.equal(document.activeElement, opener);
  el.remove(); opener.remove();
});

test("traps stack; focus escaping the active trap is pulled back", () => {
  disposeFocus();
  const outer = panel(), inner = panel();
  const outside = h("button", {}, "x");
  document.body.appendChild(outside);
  const r1 = focus.trap(outer);
  const r2 = focus.trap(inner);
  outside.focus();
  assert.ok(inner.contains(document.activeElement), "contained in the newest trap");
  r2();
  assert.ok(outer.contains(document.activeElement), "restore goes back into the outer trap");
  r1();
  outer.remove(); inner.remove(); outside.remove();
});

test("modality: keyboard → visible() and data-m-focus-visible; pointer clears it", () => {
  disposeFocus();
  assert.equal(focus.visible(), false);
  key(document.body, "Tab");
  assert.equal(focus.visible(), true);
  assert.equal(document.documentElement.hasAttribute("data-m-focus-visible"), true);
  document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  assert.equal(focus.modality(), "pointer");
  assert.equal(document.documentElement.hasAttribute("data-m-focus-visible"), false);
});

test("roving: one Tab stop, arrows move and wrap, Home / End", () => {
  disposeFocus();
  const bar = h("div", {}, h("button", { class: "r1" }, "a"), h("button", { class: "r2" }, "b"), h("button", { class: "r3" }, "c"));
  document.body.appendChild(bar);
  const moved = [];
  const stop = focus.roving(bar, { orientation: "horizontal", onMove: (el) => moved.push(el.getAttribute("class")) });
  const tabs = () => [...bar.childNodes].map((b) => b.getAttribute("tabindex"));
  assert.deepEqual(tabs(), ["0", "-1", "-1"]);
  bar.childNodes[0].focus();
  key(document.activeElement, "ArrowRight");
  assert.equal(cls(), "r2");
  assert.deepEqual(tabs(), ["-1", "0", "-1"]);
  key(document.activeElement, "End");
  key(document.activeElement, "ArrowRight");
  assert.equal(cls(), "r1", "wraps");
  key(document.activeElement, "ArrowDown");
  assert.equal(cls(), "r1", "vertical keys do nothing in a horizontal group");
  assert.deepEqual(moved, ["r2", "r3", "r1"]);
  stop();
  bar.remove();
});

test("focus:trap and focus:roving props", async () => {
  disposeFocus();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const dispose = render(() => h("div", {},
    h("div", { "focus:roving": "vertical", class: "list" }, h("button", {}, "a"), h("button", {}, "b")),
    h("div", { "focus:trap": true }, h("button", { class: "t1" }, "t"))), host);
  await tick();
  assert.equal(cls(), "t1");
  assert.equal(focus.trapped(), true);
  const list = host.querySelectorAll(".list button");
  assert.deepEqual(list.map((b) => b.getAttribute("tabindex")), ["0", "-1"]);
  dispose();
  assert.equal(focus.trapped(), false, "released with the component");
  host.remove();
});
