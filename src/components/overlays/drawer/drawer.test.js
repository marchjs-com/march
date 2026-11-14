import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Drawer } = await import("./index.ts");
const { layers } = await import("../../../dom/portal.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); return render(fn, el); };
const panelOf = () => document.querySelector(".m-sheet");

test("Drawer: modal frame from the logical edge, Escape and × close, exit animates before leaving", async () => {
  const open = signal(true);
  let closed = 0;
  const dispose = mount(() => h(Drawer, { open, onClose: () => { closed++; open.set(false); }, side: "start", title: "Menu" }, h("p", null, "body")));
  await tick();
  const p = panelOf();
  assert.ok(p.classList.contains("m-sheet-start") && p.classList.contains("m-sheet-md"));
  assert.equal(p.getAttribute("aria-modal"), "true");
  assert.equal(p.getAttribute("role"), "dialog");
  assert.ok(p.closest(".m-overlay").classList.contains("m-sheet-at-start"));
  assert.equal(layers().at(-1).kind, "drawer");
  assert.ok(document.documentElement.classList.contains("m-scroll-lock"));
  document.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(closed, 1);
  await tick(); await tick();
  assert.equal(panelOf(), null);
  assert.ok(!document.documentElement.classList.contains("m-scroll-lock"));
  dispose();
});

test("Drawer: left / right are aliases of start / end; top and bottom get a handle", async () => {
  const dispose = mount(() => [h(Drawer, { open: true, side: "left", label: "A" }, "a"), h(Drawer, { open: true, side: "top", label: "B" }, "b")]);
  await tick();
  const [a, b] = document.querySelectorAll(".m-sheet");
  assert.ok(a.classList.contains("m-sheet-start"));
  assert.ok(b.classList.contains("m-sheet-top"));
  assert.equal([...b.children].at(-1).className, "m-sheet-handle");
  assert.equal(a.querySelector(".m-sheet-handle"), null);
  dispose();
});

test("Drawer: non-modal keeps the page usable", async () => {
  const dispose = mount(() => h(Drawer, { open: true, modal: false, side: "end", label: "Panel" }, "x"));
  await tick();
  const p = panelOf();
  assert.equal(p.getAttribute("aria-modal"), null);
  assert.ok(p.closest(".m-overlay").classList.contains("is-modeless"));
  assert.equal(layers().at(-1).kind, "popover");
  assert.ok(!document.documentElement.classList.contains("m-scroll-lock"));
  dispose();
});

test("Drawer: snap points — handle button cycles them (keyboard), onSnap reports, controlled snap", async () => {
  const snap = signal(0);
  const seen = [];
  const dispose = mount(() => h(Drawer, { open: true, side: "bottom", snapPoints: [0.9, 0.4], snap, onSnap: (i) => seen.push(i), label: "Sheet" }, "x"));
  await tick();
  const btn = document.querySelector("button.m-sheet-handle");
  assert.equal(btn.getAttribute("aria-label"), "Resize panel");
  // order by size: 0.4 (index 1) → 0.9 (index 0); from index 0 the next one wraps to index 1
  btn.click();
  assert.deepEqual(seen, [1]);
  snap.set(0);
  assert.ok(panelOf().style.getPropertyValue("--m-sheet-size").endsWith("px"));
  dispose();
});

test("Drawer: dragging toward the edge closes it; a parent that keeps it open gets it back", async () => {
  let closes = 0;
  const dispose = mount(() => h(Drawer, { open: true, side: "bottom", onClose: () => closes++, title: "T" }, "x"));
  await tick();
  const p = panelOf();
  p.getBoundingClientRect = () => ({ width: 400, height: 300, top: 0, left: 0, right: 400, bottom: 300 });
  const ev = (type, y, t) => { const e = new globalThis.Event(type, { bubbles: true, cancelable: true }); Object.assign(e, { clientX: 10, clientY: y, button: 0, pointerId: 1, timeStamp: t }); return e; };
  // measured size is used on release
  globalThis.dispatchEvent(new globalThis.Event("resize"));
  const head = p.querySelector(".m-dialog-head");
  head.dispatchEvent(ev("pointerdown", 0, 0));
  head.dispatchEvent(ev("pointermove", 20, 10));
  head.dispatchEvent(ev("pointermove", 260, 60));
  assert.ok(p.classList.contains("is-dragging"));
  head.dispatchEvent(ev("pointerup", 260, 70));
  assert.equal(closes, 1);
  await tick();
  assert.ok(panelOf(), "parent kept it open");
  dispose();
});

test("Drawer: a short sheet is as tall as its content (snap points cut down to it); a long one keeps the body scrollable to its end", async () => {
  const vh = 800, was = globalThis.innerHeight;
  globalThis.innerHeight = vh;
  const layout = (panel, contentH) => {
    // the fake DOM has no layout: give the panel and its body the sizes a browser would
    const body = panel.querySelector(".m-dialog-body");
    Object.defineProperty(panel, "offsetHeight", { configurable: true, get: () => 80 + body.clientHeight });
    Object.defineProperty(body, "clientHeight", { configurable: true, get: () => 50 });
    Object.defineProperty(body, "scrollHeight", { configurable: true, get: () => contentH });
  };
  // short: 80 px of head and handle + 120 px of content = 200 px, below both snap points
  let dispose = mount(() => h(Drawer, { open: true, side: "bottom", snapPoints: [0.4, 0.9], label: "Short" }, "x"));
  layout(panelOf(), 120);
  await tick();
  assert.equal(panelOf().style.getPropertyValue("--m-sheet-size"), "200px", "the content's height, not 90% of the screen");
  dispose(); await tick();
  // long: the largest snap point sets the size; resting on the smaller one, the part past the edge is padding
  dispose = mount(() => h(Drawer, { open: true, side: "bottom", snapPoints: [0.4, 0.9], label: "Long" }, "x"));
  const panel = panelOf();
  layout(panel, 5000);
  Object.defineProperty(panel, "getBoundingClientRect", { configurable: true, value: () => ({ width: 390, height: Math.ceil(0.9 * vh), top: 0, left: 0, right: 390, bottom: Math.ceil(0.9 * vh) }) });
  await tick();
  assert.equal(panel.style.getPropertyValue("--m-sheet-size"), `${Math.ceil(0.9 * vh)}px`);
  const off = parseFloat(panel.style.getPropertyValue("--m-sheet-off"));
  assert.ok(Math.abs(off - (Math.ceil(0.9 * vh) - 0.4 * vh)) <= 1, `the hidden part (${off}px) is padding, so the body ends at the screen edge`);
  dispose();
  globalThis.innerHeight = was;
});

test("Drawer: handle and × off, own handle name, own × name; motion off leaves at once", async () => {
  const open = signal(true);
  let dispose = mount(() => [
    h(Drawer, { open, side: "bottom", title: "A", class: "d-a", handle: false, closeButton: false, motion: false }, "a"),
    h(Drawer, { open: true, side: "bottom", title: "B", class: "d-b", snapPoints: [0.4, 0.9], handleLabel: "Change height", closeLabel: "Shut" }, "b"),
  ]);
  await tick();
  const a = document.querySelector(".d-a"), b = document.querySelector(".d-b");
  assert.equal(a.querySelector(".m-sheet-handle"), null);
  assert.equal(a.querySelector(".m-dialog-x"), null);
  assert.equal(b.querySelector("button.m-sheet-handle").getAttribute("aria-label"), "Change height");
  assert.equal(b.querySelector(".m-dialog-x").getAttribute("aria-label"), "Shut");
  open.set(false);
  await tick();
  assert.equal(document.querySelector(".d-a"), null, "gone without an exit animation");
  dispose();
  // own timing still opens and closes
  const again = signal(true);
  dispose = mount(() => h(Drawer, { open: again, side: "end", title: "C", class: "d-c", motion: { duration: 10, exit: 10, easing: "easeOutBack" } }, "c"));
  await tick();
  assert.ok(document.querySelector(".d-c"));
  again.set(false);
  await tick(); await tick();
  assert.equal(document.querySelector(".d-c"), null);
  dispose();
});

test("openDrawer: opens a <Drawer> (one drawer), resolves with close(value) and with dismissValue on Escape", async () => {
  const { openDrawer, openDialog } = await import("../dialog/index.ts");
  const wait = async (ok) => { for (let i = 0; i < 50 && !ok(); i++) await tick(); };
  const p = openDrawer((close) => h("button", { class: "pick", onClick: () => close(7) }, "Pick"), { title: "Menu", side: "left", class: "od-a" });
  await wait(() => document.querySelector(".od-a"));
  const a = document.querySelector(".od-a");
  assert.ok(a.classList.contains("m-sheet") && a.classList.contains("m-sheet-start"), "the Drawer component's sheet");
  assert.equal(a.querySelector(".m-panel-header-title").textContent, "Menu");
  a.querySelector(".pick").click();
  assert.equal(await p, 7);
  await wait(() => !document.querySelector(".od-a"));
  assert.equal(document.querySelector(".od-a"), null);
  const q = openDialog(() => "x", { kind: "drawer", side: "bottom", class: "od-b", dismissValue: "no", motion: "none" });
  await wait(() => document.querySelector(".od-b"));
  assert.ok(document.querySelector(".od-b").classList.contains("m-sheet-bottom"));
  document.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  assert.equal(await q, "no");
});
