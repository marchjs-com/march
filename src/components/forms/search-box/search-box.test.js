import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { SearchBox } = await import("./index.ts");
const layout = await import("../../../ui/layout.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const type = (input, v) => { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); };
const key = (el, k) => { const e = new Event("keydown", { bubbles: true, cancelable: true }); Object.assign(e, { key: k }); el.dispatchEvent(e); return e; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("SearchBox: ui/layout keeps exporting the same component", () => {
  assert.equal(layout.SearchBox, SearchBox);
});

test("SearchBox: debounced value, Enter searches now, Escape and the clear button empty it", async () => {
  const q = signal(""), seen = [], entered = [];
  const m = mount(() => h(SearchBox, { value: q, debounce: 10, onSearch: (v) => seen.push(v), onEnter: (v) => entered.push(v) }));
  const input = m.el.querySelector(".m-search[role=search] input.m-search-input");
  assert.equal(input.getAttribute("type"), "search");
  assert.equal(input.getAttribute("aria-label"), "Search");
  assert.equal(m.el.querySelector(".m-search-clear"), null, "no clear button while empty");
  type(input, "ada");
  assert.equal(q(), "", "not written before the debounce");
  await sleep(30);
  assert.equal(q(), "ada");
  type(input, "adam");
  key(input, "Enter");
  assert.equal(q(), "adam");
  assert.deepEqual(entered, ["adam"]);
  const clear = m.el.querySelector("button.m-search-clear");
  assert.equal(clear.getAttribute("aria-label"), "Clear search");
  clear.click();
  assert.equal(q(), "");
  assert.equal(input.value, "");
  type(input, "x"); await sleep(30);
  const esc = key(input, "Escape");
  assert.ok(esc.defaultPrevented);
  assert.equal(q(), "");
  q.set("from outside");
  assert.equal(input.value, "from outside");
  assert.deepEqual(seen, ["ada", "adam", "", "x", ""]);
  m.dispose();
});

test("SearchBox: debounce 0 writes at once; onInput, inputRef and onKeyDown (preventDefault skips the box's keys)", () => {
  const seen = [], typed = [], keys = [];
  let ref = null;
  const m = mount(() => h(SearchBox, { debounce: 0, onSearch: (v) => seen.push(v), onInput: (v) => typed.push(v), inputRef: (el) => { ref = el; }, inputClass: "mine-input", onEnter: () => keys.push("enter!"),
    onKeyDown: (e) => { keys.push(e.key); if (e.key === "Enter" || e.key === "ArrowDown") e.preventDefault(); } }));
  const input = m.el.querySelector("input");
  assert.equal(ref, input);
  assert.ok(input.classList.contains("mine-input") && input.classList.contains("m-search-input"), "inputClass adds to the input's classes");
  type(input, "a");
  assert.deepEqual(seen, ["a"]);
  assert.deepEqual(typed, ["a"]);
  key(input, "ArrowDown"); key(input, "Enter");
  assert.deepEqual(keys, ["ArrowDown", "Enter"], "the box's own Enter did not run");
  m.dispose();
});

test("SearchBox: size, plain look, own icon / no icon, own clear / no clear, labels, color, class", () => {
  const m = mount(() => [
    mProps(h(SearchBox, { size: "sm", variant: "plain", icon: false, clear: false, value: "abc", placeholder: "Find", class: "mine", id: "s1", disabled: true }), { color: "brand-orange" }),
    h(SearchBox, { icon: h("i", { class: "own-icon" }), clear: h("i", { class: "own-clear" }), clearLabel: "Empty it", label: "Search files", value: "abc" }),
  ]);
  const [a, b] = m.el.querySelectorAll(".m-search");
  for (const c of ["m-search-sm", "m-search-plain", "m-search-no-icon", "mine"]) assert.ok(a.classList.contains(c), c);
  assert.equal(a.getAttribute("data-m-color"), "brand-orange");
  assert.equal(a.querySelector(".m-search-icon"), null);
  assert.equal(a.querySelector(".m-search-clear"), null);
  const ia = a.querySelector("input");
  assert.equal(ia.id, "s1");
  assert.equal(ia.getAttribute("aria-label"), "Find");
  assert.equal(ia.disabled, true);
  assert.ok(b.querySelector(".own-icon"));
  assert.ok(b.querySelector(".m-search-clear .own-clear"));
  assert.equal(b.querySelector(".m-search-clear").getAttribute("aria-label"), "Empty it");
  assert.equal(b.querySelector("input").getAttribute("aria-label"), "Search files");
  m.dispose();
});

test("SearchBox: combobox ARIA and the shortcut hint", () => {
  const active = signal("opt-2"), open = signal(true);
  const m = mount(() => [
    h(SearchBox, { controls: "list1", activeDescendant: active, expanded: open, shortcut: "mod+k" }),
    h(SearchBox, { shortcut: true, shortcutHint: false }),
    h(SearchBox, {}),
  ]);
  const [a, b, c] = m.el.querySelectorAll(".m-search");
  const input = a.querySelector("input");
  assert.equal(input.getAttribute("role"), "combobox");
  assert.equal(input.getAttribute("aria-controls"), "list1");
  assert.equal(input.getAttribute("aria-autocomplete"), "list");
  assert.equal(input.getAttribute("aria-expanded"), "true");
  assert.equal(input.getAttribute("aria-activedescendant"), "opt-2");
  active.set(null); open.set(false);
  assert.equal(input.getAttribute("aria-activedescendant"), null);
  assert.equal(input.getAttribute("aria-expanded"), "false");
  const kbd = a.querySelector(".m-search-kbd[aria-hidden=true] kbd.m-kbd");
  assert.match(kbd.textContent, /K/);
  assert.equal(b.querySelector(".m-search-kbd"), null, "the key works without a hint");
  assert.equal(c.querySelector("input").getAttribute("role"), null);
  assert.equal(c.querySelector(".m-search-kbd"), null);
  m.dispose();
});
