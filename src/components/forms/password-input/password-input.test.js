import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { PasswordInput } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("PasswordInput: show / hide toggles the type and aria-pressed", () => {
  const v = signal("s3cret");
  const { el } = mount(() => h(PasswordInput, { "bind:value": v }));
  const input = el.querySelector("input"), btn = el.querySelector("button");
  assert.equal(input.getAttribute("type"), "password");
  assert.equal(input.getAttribute("autocomplete"), "current-password");
  assert.equal(btn.getAttribute("aria-pressed"), "false");
  assert.equal(btn.getAttribute("aria-label"), "Show password");
  btn.click();
  assert.equal(input.getAttribute("type"), "text");
  assert.equal(btn.getAttribute("aria-pressed"), "true");
  assert.equal(btn.getAttribute("aria-label"), "Hide password");
  type(input, "new");
  assert.equal(v(), "new");
});
