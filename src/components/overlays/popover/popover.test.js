import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { Popover } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const panelOf = () => document.querySelector(".m-popover-panel");
const press = (el) => el.dispatchEvent(new Event("pointerdown", { bubbles: true }));
const esc = (el) => { const e = new Event("keydown", { bubbles: true, cancelable: true }); Object.assign(e, { key: "Escape" }); el.dispatchEvent(e); return e; };

test("Popover: the trigger opens and closes it; ARIA; focus goes in and comes back on Escape", async () => {
  const changes = [];
  const m = mount(() => h(Popover, { trigger: h("button", { class: "trg" }, "Filters"), label: "Filters", onOpenChange: (o, why) => changes.push(`${o}:${why}`) },
    h("input", { class: "first" })));
  const trg = m.el.querySelector(".m-popover > .trg") ?? m.el.querySelector(".trg");
  assert.equal(trg.getAttribute("aria-haspopup"), "dialog");
  assert.equal(trg.getAttribute("aria-expanded"), "false");
  assert.equal(panelOf(), null);
  trg.click();
  await tick();
  const panel = panelOf();
  assert.ok(panel.classList.contains("m-pop") && panel.classList.contains("m-popover-m-scale"));
  assert.equal(panel.getAttribute("role"), "dialog");
  assert.equal(panel.getAttribute("aria-label"), "Filters");
  assert.equal(panel.id, trg.getAttribute("aria-controls"));
  assert.equal(trg.getAttribute("aria-expanded"), "true");
  assert.equal(document.activeElement, panel.querySelector(".first"), "focus moved into the panel");
  esc(panel.querySelector(".first"));
  assert.equal(panelOf(), null);
  assert.equal(document.activeElement, trg, "Escape gives focus back to the trigger");
  trg.click();
  assert.ok(panelOf());
  press(document.body);
  assert.equal(panelOf(), null, "a press outside closes");
  assert.deepEqual(changes, ["true:trigger", "false:escape", "true:trigger", "false:outside"]);
  m.dispose();
});

test("Popover: a press on the trigger while open closes it once (no reopen)", () => {
  const m = mount(() => h(Popover, { trigger: h("button", { class: "trg" }, "Open"), autoFocus: false }, "content"));
  const trg = m.el.querySelector(".trg");
  trg.click();
  assert.ok(panelOf());
  press(trg); trg.click();
  assert.equal(panelOf(), null);
  m.dispose();
});

test("Popover: controlled by a signal; title header with a close button; function children get close", async () => {
  const open = signal(false);
  let closeFn = null;
  const m = mount(() => h(Popover, { open, trigger: "Columns", title: "Columns", closeLabel: "Done", width: "md", motion: "fade", flush: true, panelClass: "mine", color: "brand-orange", footer: h("button", { class: "apply" }, "Apply") },
    (close) => { closeFn = close; return h("p", { class: "body" }, "x"); }));
  const trg = m.el.querySelector(".m-popover button");
  assert.ok(trg.classList.contains("m-btn"), "text becomes a Button");
  open.set(true);
  await tick();
  const panel = panelOf();
  for (const c of ["m-popover-w-md", "m-popover-m-fade", "is-flush", "mine"]) assert.ok(panel.classList.contains(c), c);
  const title = panel.querySelector(".m-panel-header-title");
  assert.equal(title.textContent, "Columns");
  assert.equal(panel.getAttribute("aria-labelledby"), title.id);
  assert.equal(panel.querySelector(".m-popover-inner").getAttribute("data-m-color"), "brand-orange");
  assert.ok(panel.querySelector("footer .apply"));
  assert.ok(panel.querySelector(".m-popover-body .body"));
  const x = panel.querySelector(".m-panel-header-close");
  assert.equal(x.getAttribute("aria-label"), "Done");
  x.click();
  assert.equal(open(), false);
  assert.equal(panelOf(), null);
  open.set(true);
  closeFn();
  assert.equal(open(), false);
  m.dispose();
});

test("Popover: no trigger, own anchor, dismissal turned off, role and motion none", () => {
  const open = signal(true), field = document.createElement("input");
  document.body.appendChild(field);
  const m = mount(() => h(Popover, { open, anchor: () => field, role: "listbox", motion: "none", closeOnOutside: false, closeOnEscape: false, closable: false, autoFocus: false }, "list"));
  assert.ok(m.el.querySelector(".m-popover.m-popover-bare"));
  const panel = panelOf();
  assert.equal(panel.getAttribute("role"), "listbox");
  assert.ok(panel.classList.contains("m-popover-m-none"));
  press(document.body); esc(document.body);
  assert.ok(panelOf(), "stays open: both dismissals are off");
  open.set(false);
  assert.equal(panelOf(), null);
  m.dispose();
});

test("Popover: own state with defaultOpen; a function trigger wires itself", () => {
  let api = null;
  const m = mount(() => h(Popover, { defaultOpen: true, autoFocus: false, trigger: (a) => { api = a; return h("button", { class: "own", onClick: () => a.toggle() }, "…"); } }, "content"));
  assert.ok(panelOf());
  assert.equal(api.isOpen(), true);
  m.el.querySelector(".own").click();
  assert.equal(panelOf(), null);
  api.open();
  assert.ok(panelOf());
  api.close();
  assert.equal(panelOf(), null);
  m.dispose();
});

test("Popover: id names the panel; panelProps add attributes, listeners and a ref to it", () => {
  let got = null, keys = 0;
  const m = mount(() => h(Popover, { defaultOpen: true, id: "my-panel", role: "menu", label: "More", panelProps: { ref: (x) => { got = x; }, onKeydown: () => { keys++; }, "data-kind": "menu" } }, "Body"));
  const panel = panelOf();
  assert.equal(panel.id, "my-panel");
  assert.equal(got, panel);
  assert.equal(panel.getAttribute("data-kind"), "menu");
  panel.dispatchEvent(new Event("keydown", { bubbles: true }));
  assert.equal(keys, 1);
  m.dispose();
});

test("PopoverPanel: the panel alone on an anchor; nothing is left in the page beside it", async () => {
  const { PopoverPanel } = await import("./index.ts");
  const open = signal(false), field = document.createElement("input");
  document.body.appendChild(field);
  const m = mount(() => h(PopoverPanel, { open, anchor: () => field, role: "menu", autoFocus: false }, "items"));
  assert.equal(m.el.children.length, 0, "no wrapper element");
  open.set(true);
  assert.equal(panelOf().getAttribute("role"), "menu");
  esc(document.body);
  assert.equal(open(), false);
  m.dispose();
});
