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

test("TextInput mask: formats while typing, binds the raw value, hint, error part, eager template", async () => {
  const v = signal("5551234567");
  const states = [];
  const { el } = mount(() => h(TextInput, { "bind:value": v, mask: "(999) 999 99 99", maskHint: "(5XX) XXX XX XX", onMaskState: (s) => states.push(s) }));
  const input = el.querySelector("input");
  // the mask part loads with the first masked input
  for (let i = 0; i < 20 && !el.querySelector(".m-mask-mirror"); i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(input.value, "(555) 123 45 67");
  assert.equal(states.at(-1).complete, true);
  assert.ok(el.querySelector(".m-mask-done.is-on"));
  const hint = el.querySelector(".m-sr-only");
  assert.equal(hint.textContent, "(5XX) XXX XX XX");
  assert.ok(input.getAttribute("aria-describedby").includes(hint.id));
  assert.equal(input.getAttribute("inputmode"), "numeric");
  v.set("212");
  assert.equal(input.value, "(212");
  assert.equal(el.querySelector(".m-mask-done.is-on"), null);
  input.selectionStart = input.selectionEnd = input.value.length;
  const e = new Event("beforeinput", { bubbles: true, cancelable: true });
  Object.assign(e, { inputType: "insertText", data: "4" });
  input.dispatchEvent(e);
  assert.equal(e.defaultPrevented, true);
  assert.equal(v(), "2124");
  assert.equal(input.value, "(212) 4");
  // the mirror draws the same text, literals marked
  assert.equal(el.querySelector(".m-mask-line").textContent, "(212) 4");
  assert.equal(el.querySelectorAll(".m-mask-c.is-lit").length, 3);
});

test("TextInput mask: the mask's error shows in the input's own error part; maskMotion false draws no mirror text", async () => {
  const { cardNumber } = await import("../../../mask/presets.ts");
  const v = signal("4242424242424241");
  const { el } = mount(() => h(TextInput, { "bind:value": v, mask: cardNumber(), maskMotion: false, maskDone: false }));
  for (let i = 0; i < 20 && !el.querySelector(".m-mask-mirror"); i++) await new Promise((r) => setTimeout(r, 5));
  const input = el.querySelector("input");
  assert.equal(input.value, "4242 4242 4242 4241");
  assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.ok(el.querySelector(".m-input-error").textContent.length > 0);
  assert.equal(el.querySelector(".m-mask").classList.contains("m-mask-on"), false);
  v.set("4242424242424242");
  assert.equal(input.getAttribute("aria-invalid"), null);
  assert.equal(el.querySelector(".m-mask-done"), null);
});
