import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { ListEditor } = await import("./index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void tick; void type; void key; void signal;

test("ListEditor: paste lines, edit, reorder, remove, Enter adds, max caps", () => {
  const v = signal(["a"]);
  const { el } = mount(() => h(ListEditor, { "bind:value": v, max: 4 }));
  const draft = el.querySelector(".m-list-add input");
  fire(draft, "paste", { clipboardData: { getData: () => "b\n c \n\na" } });
  assert.deepEqual(v(), ["a", "b", "c"]);
  const rows = () => el.querySelectorAll(".m-list-row input");
  assert.equal(rows()[1].getAttribute("aria-label"), "Item 2");
  type(rows()[1], "B");
  assert.deepEqual(v(), ["a", "B", "c"]);
  el.querySelectorAll(".m-list-row")[2].querySelectorAll(".m-icon-btn")[0].click();
  assert.deepEqual(v(), ["a", "c", "B"]);
  el.querySelectorAll(".m-list-row")[0].querySelectorAll(".m-icon-btn")[2].click();
  assert.deepEqual(v(), ["c", "B"]);
  type(draft, "d"); key(draft, "Enter");
  type(draft, "e"); key(draft, "Enter");
  assert.deepEqual(v(), ["c", "B", "d", "e"]);
  assert.equal(draft.hasAttribute("disabled"), true, "full at max");
});

test("ListEditor: row buttons can go or be redrawn; their names are yours", () => {
  const a = mount(() => h(ListEditor, { value: ["a", "b"], labels: { item: (n) => `Row ${n}`, moveUp: "Up", moveDown: "Down", remove: "Drop" }, icons: { up: "U", down: () => h("b", {}, "D"), remove: "X" } }));
  const row = a.el.querySelectorAll(".m-list-row")[1];
  assert.equal(row.querySelector("input").getAttribute("aria-label"), "Row 2");
  const btns = row.querySelectorAll(".m-icon-btn");
  assert.deepEqual(btns.map((b) => b.getAttribute("aria-label")), ["Up", "Down", "Drop"]);
  assert.deepEqual(btns.map((b) => b.textContent), ["U", "D", "X"]);
  a.dispose();
  const v = signal(["a", "b"]);
  const b = mount(() => h(ListEditor, { "bind:value": v, sortable: false, addable: false }));
  assert.equal(b.el.querySelectorAll(".m-list-row")[0].querySelectorAll(".m-icon-btn").length, 1);
  assert.equal(b.el.querySelector(".m-list-add"), null);
  b.el.querySelector(".m-icon-btn").click();
  assert.deepEqual(v(), ["b"]);
  b.dispose();
  const c = mount(() => h(ListEditor, { value: ["a"], removable: false }));
  assert.equal(c.el.querySelectorAll(".m-list-row .m-icon-btn").length, 2);
  c.dispose();
});
