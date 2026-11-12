import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../index.ts");
const { Drawer } = await import("./index.ts");
const { layers } = await import("../../dom/portal.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); return render(fn, el); };
const panelOf = () => document.querySelector(".hm-sheet");

test("Drawer: modal frame from the logical edge, Escape and × close, exit animates before leaving", async () => {
  const open = signal(true);
  let closed = 0;
  const dispose = mount(() => h(Drawer, { open, onClose: () => { closed++; open.set(false); }, side: "start", title: "Menu" }, h("p", null, "body")));
  await tick();
  const p = panelOf();
  assert.ok(p.classList.contains("hm-sheet-start") && p.classList.contains("hm-sheet-md"));
  assert.equal(p.getAttribute("aria-modal"), "true");
  assert.equal(p.getAttribute("role"), "dialog");
  assert.ok(p.closest(".hm-overlay").classList.contains("hm-sheet-at-start"));
  assert.equal(layers().at(-1).kind, "drawer");
  assert.ok(document.documentElement.classList.contains("hm-scroll-lock"));
  document.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(closed, 1);
  await tick(); await tick();
  assert.equal(panelOf(), null);
  assert.ok(!document.documentElement.classList.contains("hm-scroll-lock"));
  dispose();
});

test("Drawer: left / right are aliases of start / end; top and bottom get a handle", async () => {
  const dispose = mount(() => [h(Drawer, { open: true, side: "left", label: "A" }, "a"), h(Drawer, { open: true, side: "top", label: "B" }, "b")]);
  await tick();
  const [a, b] = document.querySelectorAll(".hm-sheet");
  assert.ok(a.classList.contains("hm-sheet-start"));
  assert.ok(b.classList.contains("hm-sheet-top"));
  assert.equal([...b.children].at(-1).className, "hm-sheet-handle");
  assert.equal(a.querySelector(".hm-sheet-handle"), null);
  dispose();
});

test("Drawer: non-modal keeps the page usable", async () => {
  const dispose = mount(() => h(Drawer, { open: true, modal: false, side: "end", label: "Panel" }, "x"));
  await tick();
  const p = panelOf();
  assert.equal(p.getAttribute("aria-modal"), null);
  assert.ok(p.closest(".hm-overlay").classList.contains("is-modeless"));
  assert.equal(layers().at(-1).kind, "popover");
  assert.ok(!document.documentElement.classList.contains("hm-scroll-lock"));
  dispose();
});

test("Drawer: snap points — handle button cycles them (keyboard), onSnap reports, controlled snap", async () => {
  const snap = signal(0);
  const seen = [];
  const dispose = mount(() => h(Drawer, { open: true, side: "bottom", snapPoints: [0.9, 0.4], snap, onSnap: (i) => seen.push(i), label: "Sheet" }, "x"));
  await tick();
  const btn = document.querySelector("button.hm-sheet-handle");
  assert.equal(btn.getAttribute("aria-label"), "Resize panel");
  // order by size: 0.4 (index 1) → 0.9 (index 0); from index 0 the next one wraps to index 1
  btn.click();
  assert.deepEqual(seen, [1]);
  snap.set(0);
  assert.ok(panelOf().style.getPropertyValue("--hm-sheet-size").endsWith("px"));
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
  const head = p.querySelector(".hm-dialog-head");
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
