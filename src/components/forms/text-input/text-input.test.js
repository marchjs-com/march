import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { TextInput, EmailInput, UrlInput, affix } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("TextInput: bind:value both ways, transform, prefix / suffix, autofocus", () => {
  const v = signal("ab");
  const { el } = mount(() => h(TextInput, { "bind:value": v, prefix: "@", suffix: ".com", transform: (s) => s.toUpperCase(), autofocus: true }));
  const input = el.querySelector("input");
  assert.equal(input.value, "ab");
  type(input, "xy");
  assert.equal(v(), "XY");
  v.set("q");
  assert.equal(input.value, "q");
  assert.equal(el.querySelector(".hm-affix-prefix").textContent, "@");
  assert.equal(el.querySelector(".hm-affix-suffix").textContent, ".com");
  assert.equal(input.hasAttribute("autofocus"), true);
  assert.equal(typeof affix, "function");
});

test("EmailInput / UrlInput: keyboard, autocomplete, trimming", () => {
  const m = signal(""), u = signal("");
  const { el } = mount(() => [h(EmailInput, { "bind:value": m }), h(UrlInput, { "bind:value": u })]);
  const [mail, url] = el.querySelectorAll("input");
  assert.equal(mail.getAttribute("type"), "email");
  assert.equal(mail.getAttribute("autocomplete"), "email");
  assert.equal(url.getAttribute("inputmode"), "url");
  assert.equal(url.getAttribute("placeholder"), "https://");
  type(mail, "  a@b.co "); type(url, " https://hadisosyal.com ");
  assert.equal(m(), "a@b.co");
  assert.equal(u(), "https://hadisosyal.com");
});
