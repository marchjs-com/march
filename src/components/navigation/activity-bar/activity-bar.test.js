import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const { ActivityBar } = await import("./index.ts");

test("ActivityBar: tablist, selection, collapse on the active view, end items, badges, arrow keys", async () => {
  const view = signal("files");
  let opened = 0;
  const m = mount(() => h(ActivityBar, { value: view, onChange: (v) => view.set(v), controls: "side", items: [
    { id: "files", label: "Files", icon: "F" },
    { id: "search", label: "Search", icon: "S", badge: 3, shortcut: "mod+shift+f" },
    { id: "settings", label: "Settings", icon: "G", position: "end", onSelect: () => opened++ },
  ] }));
  await tick();
  const bar = m.el.querySelector('[role="tablist"]');
  assert.equal(bar.getAttribute("aria-orientation"), "vertical");
  const tabs = [...bar.querySelectorAll('[role="tab"]')];
  assert.equal(tabs.length, 3);
  assert.equal(tabs[0].getAttribute("aria-selected"), "true");
  assert.equal(tabs[0].getAttribute("aria-controls"), "side");
  assert.equal(tabs[0].getAttribute("tabindex"), "0");
  assert.equal(tabs[1].getAttribute("tabindex"), "-1");
  assert.equal(tabs[1].getAttribute("aria-keyshortcuts"), "mod+shift+f");
  assert.ok(tabs[1].querySelector(".m-badge"));
  tabs[1].click();
  assert.equal(view(), "search");
  tabs[1].click();
  assert.equal(view(), null, "choosing the active view again collapses it");
  tabs[2].click();
  assert.equal(opened, 1);
  assert.equal(view(), null, "an action is not a view");
  assert.ok(tabs[2].closest(".m-ab-end"));
  tabs[0].focus();
  tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  assert.equal(document.activeElement, tabs[1]);
  m.dispose();
});

test("ActivityBar: orientation is live (the same bar turns; arrow keys follow the new axis)", async () => {
  const view = signal("files"), dir = signal("vertical");
  const m = mount(() => h(ActivityBar, { value: view, onChange: (v) => view.set(v), orientation: dir, items: [
    { id: "files", label: "Files", icon: "F" }, { id: "search", label: "Search", icon: "S" },
  ] }));
  await tick();
  const bar = m.el.querySelector('[role="tablist"]');
  assert.ok(bar.classList.contains("m-ab-v"));
  dir.set("horizontal");
  await tick();
  assert.equal(m.el.querySelector('[role="tablist"]'), bar, "the bar is not rebuilt");
  assert.ok(bar.classList.contains("m-ab-h") && !bar.classList.contains("m-ab-v"));
  assert.equal(bar.getAttribute("aria-orientation"), "horizontal");
  const tabs = [...bar.querySelectorAll('[role="tab"]')];
  tabs[0].focus();
  tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(document.activeElement, tabs[1], "→ moves in a horizontal bar");
  m.dispose();
});

test("ActivityBar: indicator and tooltips off, color token, motion none places the indicator at once", async () => {
  const items = [{ id: "files", label: "Files", icon: "F" }, { id: "search", label: "Search", icon: "S" }];
  const view = signal("files");
  const m = mount(() => [
    h(ActivityBar, { value: "files", onChange: () => {}, items, indicator: false, tooltips: false, color: "brand-purple" }),
    h(ActivityBar, { value: view, onChange: (v) => view.set(v), items, motion: "none" }),
  ]);
  await tick();
  const [bare, still] = m.el.querySelectorAll('[role="tablist"]');
  assert.equal(bare.querySelector(".m-ab-ind"), null);
  assert.equal(bare.querySelector(".m-tip-anchor"), null, "no tooltip wrapper");
  assert.equal(bare.querySelector('[role="tab"]').getAttribute("aria-label"), "Files", "the name stays");
  assert.equal(bare.getAttribute("data-m-color"), "brand-purple");
  assert.equal(still.getAttribute("data-m-color"), null);
  assert.ok(still.querySelector(".m-tip-anchor"));
  const ind = still.querySelector(".m-ab-ind");
  assert.ok(ind.classList.contains("is-on"));
  assert.match(ind.style.getPropertyValue("transform"), /^translateY\(/);
  m.dispose();
});
