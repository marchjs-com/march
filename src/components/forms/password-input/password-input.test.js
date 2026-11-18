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

test("PasswordInput: the toggle can go or be redrawn; its texts are yours", () => {
  const off = mount(() => h(PasswordInput, { value: "x", toggle: false }));
  assert.equal(off.el.querySelector("button"), null);
  assert.equal(off.el.querySelector("input").getAttribute("type"), "password");
  off.dispose();
  const txt = mount(() => h(PasswordInput, { value: "x", labels: { show: "Reveal", hide: "Mask", showPassword: "Reveal the password", hidePassword: "Mask the password" } }));
  const b = txt.el.querySelector("button");
  assert.equal(b.textContent, "Reveal");
  assert.equal(b.getAttribute("aria-label"), "Reveal the password");
  b.click();
  assert.equal(b.textContent, "Mask");
  assert.equal(b.getAttribute("aria-label"), "Mask the password");
  txt.dispose();
  const own = mount(() => h(PasswordInput, { value: "x", toggle: (shown) => h("i", { class: shown ? "eye-off" : "eye" }) }));
  const o = own.el.querySelector("button");
  assert.ok(o.className.includes("is-own"));
  assert.ok(o.querySelector(".eye"));
  o.click();
  assert.ok(o.querySelector(".eye-off"));
  assert.equal(own.el.querySelector("input").getAttribute("type"), "text");
  own.dispose();
});

test("PasswordInput: the eye by default (crossed out while shown), toggle=\"text\" the words, onToggle hears it", () => {
  const seen = [];
  const { el } = mount(() => h(PasswordInput, { value: "x", onToggle: (v) => seen.push(v) }));
  const b = el.querySelector("button");
  assert.ok(b.classList.contains("m-icon-btn") && b.querySelector("svg"), "an icon button");
  assert.equal(b.getAttribute("title"), "Show password", "its hint says what it does");
  b.click();
  assert.equal(b.getAttribute("aria-pressed"), "true");
  assert.equal(b.querySelector("svg").getAttribute("data-icon"), "eye-off");
  b.click();
  assert.deepEqual(seen, [true, false]);
  const txt = mount(() => h(PasswordInput, { value: "x", toggle: "text" }));
  assert.equal(txt.el.querySelector("button").textContent, "Show");
});
