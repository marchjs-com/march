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
  const draft = el.querySelector(".hm-list-add input");
  fire(draft, "paste", { clipboardData: { getData: () => "b\n c \n\na" } });
  assert.deepEqual(v(), ["a", "b", "c"]);
  const rows = () => el.querySelectorAll(".hm-list-row input");
  assert.equal(rows()[1].getAttribute("aria-label"), "Item 2");
  type(rows()[1], "B");
  assert.deepEqual(v(), ["a", "B", "c"]);
  el.querySelectorAll(".hm-list-row")[2].querySelectorAll(".hm-icon-btn")[0].click();
  assert.deepEqual(v(), ["a", "c", "B"]);
  el.querySelectorAll(".hm-list-row")[0].querySelectorAll(".hm-icon-btn")[2].click();
  assert.deepEqual(v(), ["c", "B"]);
  type(draft, "d"); key(draft, "Enter");
  type(draft, "e"); key(draft, "Enter");
  assert.deepEqual(v(), ["c", "B", "d", "e"]);
  assert.equal(draft.hasAttribute("disabled"), true, "full at max");
});
