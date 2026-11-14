import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { OptionList } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const key = (el, k) => { const e = new Event("keydown", { bubbles: true, cancelable: true }); Object.assign(e, { key: k }); el.dispatchEvent(e); return e; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const THEMES = [{ value: "light", label: "Light", hint: "Bright" }, { value: "dark", label: "Dark", icon: "☾" }, { value: "hc", label: "High contrast", disabled: true }, { value: "sepia", label: "Sepia", trailing: "new" }];

test("OptionList: radio rows, value signal, click picks, arrows move focus over a disabled row", () => {
  const v = signal("dark"), picked = [];
  const m = mount(() => h(OptionList, { value: v, options: THEMES, label: "Theme", onPick: (x) => picked.push(x) }));
  const root = m.el.querySelector(".hm-option-list");
  assert.equal(root.getAttribute("role"), "radiogroup");
  assert.equal(root.getAttribute("aria-label"), "Theme");
  const rows = [...root.querySelectorAll("button.hm-option-list-row")];
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.getAttribute("role")), ["radio", "radio", "radio", "radio"]);
  assert.deepEqual(rows.map((r) => r.getAttribute("aria-checked")), ["false", "true", "false", "false"]);
  assert.deepEqual(rows.map((r) => r.getAttribute("tabindex")), ["-1", "0", "-1", "-1"], "the chosen row is the Tab stop");
  assert.ok(rows[1].classList.contains("is-selected"));
  assert.equal(rows[0].querySelector(".hm-listrow-sub").textContent, "Bright");
  assert.ok(rows[1].querySelector(".hm-listrow-lead"));
  assert.equal(rows[3].querySelector(".hm-listrow-trail").textContent, "new");
  assert.equal(rows[2].disabled, true);
  rows[0].click();
  assert.equal(v(), "light");
  assert.deepEqual(picked, ["light"]);
  assert.equal(rows[0].getAttribute("aria-checked"), "true");
  rows[2].click();
  assert.equal(v(), "light", "a disabled row is not picked");
  rows[1].focus();
  key(rows[1], "ArrowDown");
  assert.equal(document.activeElement, rows[3], "the disabled row is stepped over");
  key(rows[3], "Home");
  assert.equal(document.activeElement, rows[0]);
  m.dispose();
});

test("OptionList: own state without a value; multiple listbox toggles; check off / own", () => {
  const multi = signal(["a"]);
  const m = mount(() => [
    h(OptionList, { options: [{ value: 1, label: "One" }, { value: 2, label: "Two" }], check: false }),
    h(OptionList, { multiple: true, value: multi, options: [{ value: "a", label: "A" }, { value: "b", label: "B" }], check: () => h("i", { class: "own-tick" }) }),
  ]);
  const [a, b] = m.el.querySelectorAll(".hm-option-list");
  const ra = a.querySelectorAll(".hm-option-list-row");
  assert.equal(a.querySelector(".hm-option-list-check"), null);
  ra[1].click();
  assert.equal(ra[1].getAttribute("aria-checked"), "true");
  assert.equal(b.getAttribute("role"), "listbox");
  assert.equal(b.getAttribute("aria-multiselectable"), "true");
  const rb = b.querySelectorAll(".hm-option-list-row");
  assert.equal(rb[0].getAttribute("role"), "option");
  assert.equal(rb[0].getAttribute("aria-selected"), "true");
  assert.ok(rb[0].querySelector(".hm-option-list-check .own-tick"));
  rb[1].click();
  assert.deepEqual(multi(), ["a", "b"]);
  rb[0].click();
  assert.deepEqual(multi(), ["b"]);
  m.dispose();
});

test("OptionList: menu of commands, groups with a SectionLabel, grid, empty text, own row, size, color, class", () => {
  const opts = signal([{ value: "h1", label: "Heading", group: "Blocks" }, { value: "p", label: "Paragraph", group: "Blocks" }, { value: "img", label: "Image", group: "Media" }]);
  const ran = [];
  const m = mount(() => [
    h(OptionList, { mode: "menu", options: opts, onPick: (v) => ran.push(v), columns: 2, size: "sm", color: "brand-orange", class: "mine" }),
    h(OptionList, { options: [], empty: "Nothing here" }),
    h(OptionList, { options: [], empty: false }),
    h(OptionList, { options: [{ value: "x", label: "X" }], renderOption: (it, s) => h("b", { class: "own-row" }, `${it.label}#${s.index}`) }),
  ]);
  const [menu, empty, none, own] = m.el.querySelectorAll(".hm-option-list");
  assert.equal(menu.getAttribute("role"), "menu");
  for (const c of ["hm-option-list-grid", "hm-option-list-cols-2", "hm-option-list-sm", "mine"]) assert.ok(menu.classList.contains(c), c);
  assert.equal(menu.getAttribute("data-hm-color"), "brand-orange");
  const rows = menu.querySelectorAll(".hm-option-list-row");
  assert.equal(rows[0].getAttribute("role"), "menuitem");
  assert.equal(rows[0].getAttribute("aria-checked"), null);
  assert.equal(menu.querySelector(".hm-option-list-check"), null, "commands have no tick");
  assert.deepEqual([...menu.querySelectorAll(".hm-section-label.hm-option-list-group")].map((x) => x.textContent), ["Blocks", "Media"]);
  rows[2].click();
  assert.deepEqual(ran, ["img"]);
  assert.ok(!rows[2].classList.contains("is-selected"));
  opts.set([{ value: "q", label: "Quote" }]);
  assert.equal(menu.querySelectorAll(".hm-option-list-row").length, 1);
  assert.equal(empty.querySelector(".hm-option-list-empty").textContent, "Nothing here");
  assert.equal(none.children.length, 0);
  assert.equal(own.querySelector(".hm-option-list-row .own-row").textContent, "X#0");
  m.dispose();
});

test("OptionList: keysFrom — the field's keys move the highlight (aria-activedescendant), Enter picks, focus stays", async () => {
  const input = document.createElement("input");
  document.body.appendChild(input);
  const picked = [], opts = signal([{ value: "ada", label: "Ada" }, { value: "alan", label: "Alan" }, { value: "grace", label: "Grace" }]);
  const m = mount(() => h(OptionList, { id: "sug", keysFrom: () => input, options: opts, onPick: (v) => picked.push(v) }));
  await tick();
  const root = m.el.querySelector("#sug");
  assert.equal(root.getAttribute("role"), "listbox");
  assert.equal(input.getAttribute("aria-controls"), "sug");
  const rows = root.querySelectorAll("div.hm-option-list-row");
  assert.equal(rows[0].getAttribute("role"), "option");
  assert.equal(rows[1].id, "sug-1");
  assert.equal(input.getAttribute("aria-activedescendant"), null);
  input.focus();
  key(input, "ArrowDown");
  assert.equal(input.getAttribute("aria-activedescendant"), "sug-0");
  assert.ok(rows[0].classList.contains("is-active"));
  key(input, "ArrowDown");
  assert.equal(input.getAttribute("aria-activedescendant"), "sug-1");
  const e = key(input, "Enter");
  assert.ok(e.defaultPrevented);
  assert.deepEqual(picked, ["alan"]);
  assert.equal(document.activeElement, input);
  rows[2].click();
  assert.deepEqual(picked, ["alan", "grace"]);
  opts.set([{ value: "ada", label: "Ada" }]);
  assert.equal(input.getAttribute("aria-activedescendant"), "sug-0", "the highlight is clamped to the new list");
  m.dispose();
  assert.equal(input.getAttribute("aria-activedescendant"), null);
});

test("OptionList: keys={false} — the owner drives the highlight, no listener, no field attributes; overflow", () => {
  const active = signal(1), picked = [];
  const m = mount(() => h(OptionList, { id: "own", keys: false, active, overflow: "wrap", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }], onPick: (v) => picked.push(v) }));
  const root = m.el.querySelector("#own");
  assert.equal(root.getAttribute("role"), "listbox");
  const rows = root.querySelectorAll("div.hm-option-list-row");
  assert.deepEqual(rows.map((r) => r.id), ["own-0", "own-1"]);
  assert.equal(rows[0].getAttribute("tabindex"), null, "rows are not focusable");
  assert.ok(rows[1].classList.contains("is-active") && !rows[0].classList.contains("is-active"));
  assert.ok(rows[0].classList.contains("is-wrap"));
  active.set(0);
  assert.ok(rows[0].classList.contains("is-active"));
  const e = key(root, "ArrowDown");
  assert.ok(!e.defaultPrevented, "keys are the owner's");
  assert.equal(active(), 0);
  rows[1].click();
  assert.deepEqual(picked, ["b"]);
  m.dispose();
});
