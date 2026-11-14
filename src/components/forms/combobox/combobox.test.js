import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Combobox } = await import("./index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void tick; void type; void key; void signal;

test("Combobox: static filtering, keyboard pick, combobox ARIA", () => {
  const v = signal(null);
  const { el } = mount(() => h(Combobox, { "bind:value": v, options: ["Ankara", "Berlin", "Bern"] }));
  const input = el.querySelector("[role=combobox]");
  assert.equal(input.getAttribute("aria-expanded"), "false");
  type(input, "ber");
  assert.equal(input.getAttribute("aria-expanded"), "true");
  const opts = document.querySelectorAll("[role=option]");
  assert.deepEqual(opts.map((o) => o.textContent), ["Berlin", "Bern"]);
  assert.equal(input.getAttribute("aria-activedescendant"), opts[0].id);
  key(input, "ArrowDown");
  assert.equal(input.getAttribute("aria-activedescendant"), opts[1].id);
  key(input, "Enter");
  assert.equal(v(), "Bern");
  assert.equal(input.value, "Bern");
  assert.equal(document.querySelectorAll("[role=option]").length, 0);
});

test("Combobox: async search is debounced and late answers are ignored", async () => {
  const calls = [];
  const people = [{ value: 1, label: "Alice" }, { value: 2, label: "Alfred" }, { value: 3, label: "Bob" }];
  const search = async (q) => { calls.push(q); return people.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())); };
  const v = signal(null);
  const { el } = mount(() => h(Combobox, { "bind:value": v, search, debounce: 20 }));
  const input = el.querySelector("input");
  input.focus();
  type(input, "a"); type(input, "al");
  await tick(5);
  assert.deepEqual(calls, []);
  await tick(40);
  assert.deepEqual(calls, ["al"]);
  key(input, "Enter");
  assert.equal(v(), 1);
  assert.equal(input.value, "Alice");
});

test("Combobox: status texts, the chip remove button and its name are yours", async () => {
  const a = mount(() => h(Combobox, { options: ["Ada", "Bora"], labels: { noResults: "Nothing here" } }));
  const input = a.el.querySelector("input");
  input.focus(); type(input, "zzz");
  await tick(5);
  assert.equal(document.querySelector(".m-listbox-status").textContent, "Nothing here");
  a.dispose();
  const v = signal(["Ada", "Bora"]);
  const b = mount(() => h(Combobox, { "bind:value": v, multiple: true, options: ["Ada", "Bora"], removeIcon: () => h("i", { class: "own-x" }, "x"), labels: { remove: (l) => `Drop ${l}` } }));
  const xs = b.el.querySelectorAll(".m-chip2-x");
  assert.equal(xs.length, 2);
  assert.equal(xs[0].getAttribute("aria-label"), "Drop Ada");
  assert.ok(xs[1].querySelector(".own-x"));
  xs[0].click();
  assert.deepEqual(v(), ["Bora"]);
  b.dispose();
  const c = mount(() => h(Combobox, { value: ["Ada"], multiple: true, options: ["Ada", "Bora"], removeIcon: false }));
  assert.equal(c.el.querySelectorAll(".m-chip").length, 1);
  assert.equal(c.el.querySelector(".m-chip2-x"), null);
  c.dispose();
});
