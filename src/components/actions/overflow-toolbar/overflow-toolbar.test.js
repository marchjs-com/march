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
  const [saveBtn, boldBtn] = bar.querySelectorAll(".hm-otb-btn");
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
  assert.ok(bar.querySelector(".hm-otb-more").hidden, "no More menu while everything fits");
  assert.equal([...bar.querySelectorAll(".hm-otb-btn")].filter((b) => b.tabIndex === 0).length, 1);
  m.dispose();
  save.dispose();
});
