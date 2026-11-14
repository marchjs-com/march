import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../src/testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../src/index.ts");
const U = await import("../src/ui/index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const opts = (n) => Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `v${i}` }));

test("pickerKind: 2–6 short → segmented, 7–9 → chips, preview → cards, 10+ → combobox, forced kinds win", () => {
  assert.equal(U.pickerKind(opts(2)), "segmented");
  assert.equal(U.pickerKind(opts(6)), "segmented");
  assert.equal(U.pickerKind(opts(7)), "chips");
  assert.equal(U.pickerKind(opts(6).map((o) => ({ ...o, label: o.label.repeat(4) }))), "chips", "long labels do not fit a segmented row");
  assert.equal(U.pickerKind(opts(8).map((o) => ({ ...o, preview: () => null }))), "cards");
  assert.equal(U.pickerKind(opts(10)), "combobox");
  assert.equal(U.pickerKind(opts(3), "grid"), "grid");
});

test("ChoicePicker never draws a <select>; previews render as nodes; a click sets the value", () => {
  const v = signal("v0");
  for (const [n, extra, sel] of [[3, {}, ".m-segmented"], [8, {}, ".m-picker-chips"], [5, { kind: "grid" }, ".m-picker-grid"], [12, {}, "[role=combobox]"]]) {
    const m = mount(() => h(U.ChoicePicker, { value: v, options: opts(n).map((o) => (extra.kind ? { ...o, preview: () => h("i", { class: "pv" }) } : o)), ...extra }));
    assert.equal(m.el.querySelector("select"), null);
    assert.ok(m.el.querySelector(sel), `${n} options → ${sel}`);
    if (extra.kind) {
      assert.equal(m.el.querySelectorAll(".m-choice-card-icon .pv").length, 5);
      const r = m.el.querySelectorAll("input[type=radio]")[2]; r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true }));
      assert.equal(v(), "v2");
    }
    m.dispose();
  }
});
