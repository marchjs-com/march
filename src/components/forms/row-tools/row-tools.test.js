import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { RowTools } = await import("./index.ts");
const { trash } = await import("../../../icons/glyphs/trash.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("RowTools: three named icon buttons, off at the ends, handlers", () => {
  const index = signal(0), seen = [];
  const [el, dispose] = mount(() => h(RowTools, { index, count: 3, onUp: () => seen.push("up"), onDown: () => seen.push("down"), onRemove: () => seen.push("remove"), onAction: (a) => seen.push(`action:${a}`) }));
  const g = el.querySelector(".m-row-tools");
  assert.equal(g.getAttribute("role"), "group");
  assert.equal(g.getAttribute("aria-label"), "Row tools");
  const [up, down, remove] = g.querySelectorAll("button.m-icon-btn");
  assert.deepEqual([up, down, remove].map((b) => b.getAttribute("aria-label")), ["Move up", "Move down", "Remove"]);
  assert.equal(up.disabled, true);
  assert.equal(down.disabled, false);
  index.set(2);
  assert.equal(up.disabled, false);
  assert.equal(down.disabled, true);
  up.click(); remove.click();
  assert.deepEqual(seen, ["up", "action:up", "remove", "action:remove"]);
  dispose();
});

test("RowTools: subset, own names and icons, danger, disabled map and all", () => {
  const [el, dispose] = mount(() => [
    h(RowTools, { class: "one", actions: ["remove"], labels: { remove: "Delete row", group: "Tools" }, icons: { remove: trash }, danger: true, size: "xs" }),
    h(RowTools, { class: "two", disabled: { remove: () => true } }),
    h(RowTools, { class: "three", disabled: true }),
  ]);
  const one = el.querySelector(".one");
  assert.equal(one.querySelectorAll("button").length, 1);
  const b = one.querySelector("button");
  assert.equal(b.getAttribute("aria-label"), "Delete row");
  assert.ok(b.classList.contains("m-icon-btn-danger") && b.classList.contains("m-row-tool-remove"));
  assert.equal(one.getAttribute("aria-label"), "Tools");
  assert.deepEqual([...el.querySelectorAll(".two button")].map((x) => x.disabled), [false, false, true]);
  assert.deepEqual([...el.querySelectorAll(".three button")].map((x) => x.disabled), [true, true, true]);
  dispose();
});

test("RowTools: an own icon may be a function, text or a node (a node already placed is copied for the next row)", () => {
  const node = h("i", { class: "own-node" });
  const [el, dispose] = mount(() => h("div", null,
    h(RowTools, { class: "a", icons: { up: () => h("i", { class: "own-fn" }), down: "v", remove: node } }),
    h(RowTools, { class: "b", actions: ["remove"], icons: { remove: node } })));
  assert.ok(el.querySelector(".a .m-row-tool-up .own-fn"));
  assert.equal(el.querySelector(".a .m-row-tool-down").textContent, "v");
  assert.ok(el.querySelector(".a .m-row-tool-remove .own-node"));
  assert.ok(el.querySelector(".b .m-row-tool-remove .own-node"), "the second row has its own copy");
  dispose();
});
