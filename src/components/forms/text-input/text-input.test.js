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
  assert.equal(el.querySelector(".m-affix-prefix").textContent, "@");
  assert.equal(el.querySelector(".m-affix-suffix").textContent, ".com");
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

test("TextInput: onPaste gets the paste event and can keep the text out", () => {
  const seen = [];
  const { el } = mount(() => h(TextInput, { onPaste: (e) => { seen.push(e.clipboardData.getData("text")); e.preventDefault(); } }));
  const e = fire(el.querySelector("input"), "paste", { clipboardData: { getData: () => "a\nb" } });
  assert.deepEqual(seen, ["a\nb"]);
  assert.equal(e.defaultPrevented, true);
});

test("TextInput: error marks the input invalid and shows a linked alert; without the prop nothing is added", () => {
  const err = signal("");
  const { el } = mount(() => [h(TextInput, { id: "mail", error: err, describedby: "note" }), h(TextInput, { id: "plain" })]);
  const [input, plain] = el.querySelectorAll("input");
  const msg = el.querySelector(".m-input-error");
  assert.equal(el.querySelectorAll(".m-input-error").length, 1);
  assert.equal(msg.id, "mail-err");
  assert.equal(msg.getAttribute("role"), "alert");
  assert.equal(msg.hidden, true);
  assert.equal(input.getAttribute("aria-invalid"), null);
  assert.equal(input.getAttribute("aria-describedby"), "note");
  err.set("Enter a valid address");
  assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.equal(input.getAttribute("aria-describedby"), "note mail-err");
  assert.equal(msg.hidden, false);
  assert.equal(msg.textContent, "Enter a valid address");
  err.set("");
  assert.equal(input.getAttribute("aria-invalid"), null);
  assert.equal(msg.hidden, true);
  assert.equal(plain.getAttribute("aria-describedby"), null);
});

test("TextInput: errorSpace keeps the error line in place while there is no error", () => {
  const err = signal("");
  const { el } = mount(() => h(TextInput, { id: "kept", error: err, errorSpace: true }));
  const msg = el.querySelector(".m-input-error");
  assert.ok(msg.classList.contains("is-kept"));
  assert.equal(msg.hidden, false);
  assert.equal(msg.textContent, "");
  err.set("Required");
  assert.equal(msg.textContent, "Required");
  assert.equal(el.querySelector("input").getAttribute("aria-describedby"), "kept-err");
});
