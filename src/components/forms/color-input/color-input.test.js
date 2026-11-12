import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { ColorInput } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("ColorInput: swatch and text stay in sync; invalid text leaves the swatch", () => {
  const v = signal("#F2801F");
  const { el } = mount(() => h(ColorInput, { "bind:value": v }));
  const [swatch, text] = el.querySelectorAll("input");
  assert.equal(swatch.getAttribute("type"), "color");
  assert.equal(swatch.getAttribute("aria-label"), "Pick a color");
  assert.equal(swatch.value, "#f2801f");
  type(text, " #1D9AD6 ");
  assert.equal(v(), "#1d9ad6");
  assert.equal(swatch.value, "#1d9ad6");
  type(swatch, "#78BE3A");
  assert.equal(text.value, "#78be3a");
});
