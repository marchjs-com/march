import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { OverflowToolbar } = await import("./index.ts");
const { fitItems } = await import("../../../ui/fit.ts");
const { command } = await import("../../../managers/command/index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("fitItems: lowest priority leaves first, the last of equals first, room kept for More", () => {
  assert.deepEqual(fitItems([40, 40, 40], [0, 0, 0], 200, 30), [true, true, true]);
  assert.deepEqual(fitItems([40, 40, 40], [0, 0, 0], 100, 30), [true, false, false]);
  assert.deepEqual(fitItems([40, 40, 40], [5, 0, 9], 100, 10), [true, false, true]);
  assert.deepEqual(fitItems([40, 40], [0, 0], 0, 10), [false, false]);
});

test("OverflowToolbar: toolbar role, command items, toggles, separators, one tab stop", async () => {
  const can = signal(false);
  let saved = 0, bold = signal(false);
  const save = command({ id: "otb.save", title: "Save file", shortcut: "mod+s", when: () => can(), run: () => { saved++; } });
  const m = mount(() => h(OverflowToolbar, { label: "Editor", items: [
    { id: "save", command: "otb.save", showLabel: true, priority: 10 },
    { id: "sep", separator: true },
    { id: "bold", label: "Bold", pressed: bold, onSelect: () => bold.set(!bold()) },
  ] }));
  await tick(); await tick();
  const bar = m.el.querySelector('[role="toolbar"]');
  assert.equal(bar.getAttribute("aria-label"), "Editor");
  const [saveBtn, boldBtn] = bar.querySelectorAll(".m-otb-btn");
  assert.equal(saveBtn.textContent, "Save file");
  assert.equal(saveBtn.getAttribute("aria-keyshortcuts"), "mod+s");
  assert.equal(saveBtn.disabled, true, "follows the command's when()");
  can.set(true);
  assert.equal(saveBtn.disabled, false);
  saveBtn.click();
  await tick();
  assert.equal(saved, 1);
  assert.equal(boldBtn.getAttribute("aria-pressed"), "false");
  boldBtn.click();
  assert.equal(boldBtn.getAttribute("aria-pressed"), "true");
  assert.ok(bar.querySelector('[role="separator"]'));
  assert.ok(bar.querySelector(".m-otb-more").hidden, "no More menu while everything fits");
  assert.equal([...bar.querySelectorAll(".m-otb-btn")].filter((b) => b.tabIndex === 0).length, 1);
  m.dispose();
  save.dispose();
});

test("OverflowToolbar: More label and icon, tooltips off, colour token, your own return motion", async () => {
  // a measurable row: every item 40 px wide, the width given by a ResizeObserver stand-in
  let resize = null;
  const RO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class { constructor(cb) { resize = cb; } observe() {} disconnect() {} };
  const proto = document.createElement("div").constructor.prototype;
  const had = Object.getOwnPropertyDescriptor(proto, "offsetWidth");
  Object.defineProperty(proto, "offsetWidth", { get() { return 40; }, configurable: true });
  const back = [];
  const m = mount(() => h(OverflowToolbar, { label: "Editor", moreLabel: "Other tools", moreIcon: "+", tooltips: false, color: "brand-blue", motion: (el) => back.push(el),
    items: [{ id: "a", label: "A", icon: "a", priority: 2 }, { id: "b", label: "B", icon: "b", priority: 1 }, { id: "c", label: "C", icon: "c" }] }));
  await tick(); await tick();
  const bar = m.el.querySelector('[role="toolbar"]');
  assert.equal(bar.getAttribute("data-m-color"), "brand-blue");
  assert.equal(bar.querySelector(".m-tip-anchor"), null, "no tooltips");
  assert.equal(bar.querySelector(".m-otb-btn").getAttribute("aria-label"), "A", "still named");
  const moreBtn = bar.querySelector(".m-otb-more").querySelector("button");
  assert.equal(moreBtn.getAttribute("aria-label"), "Other tools");
  assert.equal(moreBtn.textContent, "+");
  resize([{ contentRect: { width: 20 } }]);
  await tick();
  const hidden = () => [...bar.querySelectorAll(".m-otb-item")].filter((x) => x.hidden).length;
  assert.ok(hidden() > 0, "narrow: items moved to More");
  assert.equal(back.length, 0);
  resize([{ contentRect: { width: 900 } }]);
  await tick();
  assert.equal(hidden(), 0);
  assert.ok(back.length > 0 && back.every((el) => el.className === "m-otb-item"), "the returning items got the custom motion");
  m.dispose();
  if (had) Object.defineProperty(proto, "offsetWidth", had); else delete proto.offsetWidth;
  if (RO) globalThis.ResizeObserver = RO; else delete globalThis.ResizeObserver;
});
