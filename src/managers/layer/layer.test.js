// LayerManager: reactive stack and top, Escape closes the top escapable layer only, scroll lock counting, cleanup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { h, effect, createRoot } = await import("../../index.ts");
const { openLayer } = await import("../../dom/portal.ts");
const { layer, disposeLayers } = await import("./index.ts");
const { onManager } = await import("../manager.ts");
const esc = () => { const e = new Event("keydown", { bubbles: true, cancelable: true }); Object.assign(e, { key: "Escape" }); document.body.dispatchEvent(e); return e; };

test("stack and top are reactive; toasts never count as top", () => {
  disposeLayers();
  const tops = [];
  const stop = effect(() => tops.push(layer.top()?.kind ?? null));
  const a = layer.open("popover", h("div", {}, "a"));
  const toast = layer.open("toast", h("div", {}, "t"));
  assert.deepEqual(layer.stack().map((l) => l.kind), ["popover", "toast"]);
  assert.equal(layer.top().kind, "popover", "toast band is not the top");
  assert.equal(a.isTop(), true);
  const b = layer.open("menu", h("div", {}, "b"));
  assert.equal(b.isTop(), true);
  assert.equal(a.isTop(), false);
  assert.equal(b.index(), 2);
  b.close(); a.close(); toast.close();
  assert.equal(b.index(), -1);
  assert.deepEqual(tops, [null, "popover", "menu", "popover", null]);
  stop();
});

test("Escape closes one layer at a time, newest first; a layer without onEscape is left alone", () => {
  disposeLayers();
  const closed = [];
  const a = layer.open("popover", h("div"), { onEscape: () => { closed.push("a"); a.close(); }, label: "a" });
  const b = layer.open("menu", h("div"), { onEscape: () => { closed.push("b"); b.close(); }, label: "b" });
  const e1 = esc();
  assert.deepEqual(closed, ["b"]);
  assert.equal(e1.defaultPrevented, true, "handled → preventDefault, so a dialog listener skips it");
  esc();
  assert.deepEqual(closed, ["b", "a"]);
  const c = layer.open("popover", h("div"), { onEscape: () => closed.push("c") });
  const d = openLayer("dialog", h("div")); // someone else's layer (a dialog) on top
  const e3 = esc();
  assert.deepEqual(closed, ["b", "a"], "the top layer is not ours: it handles its own Escape");
  assert.equal(e3.defaultPrevented, false);
  d(); c.close();
});

test("onEscape returning false keeps the layer open and lets Escape through", () => {
  disposeLayers();
  const l = layer.open("popover", h("div"), { onEscape: () => false });
  const e = esc();
  assert.equal(e.defaultPrevented, false);
  assert.equal(layer.stack().length, 1);
  l.close();
});

test("scroll lock: modal kinds lock by default, locks are counted, the old overflow comes back", () => {
  disposeLayers();
  const root = document.documentElement;
  root.style.setProperty("overflow", "auto");
  const dlg = layer.open("dialog", h("div"));
  assert.equal(layer.scrollLocked(), true);
  assert.equal(root.style.getPropertyValue("overflow"), "hidden");
  assert.equal(layer.modal(), true);
  const pop = layer.open("popover", h("div"));
  const unlock = layer.lockScroll();
  dlg.close();
  assert.equal(layer.scrollLocked(), true, "one lock still held");
  unlock(); unlock();
  assert.equal(layer.scrollLocked(), false);
  assert.equal(root.style.getPropertyValue("overflow"), "auto");
  assert.equal(root.hasAttribute("data-hm-scroll-locked"), false);
  pop.close();
  root.style.removeProperty("overflow");
});

test("a layer opened inside an owner closes with it; events are reported", () => {
  disposeLayers();
  const seen = [];
  const prev = onManager("*", (e) => { if (e.manager === "layer") seen.push(e.type); });
  let dispose;
  createRoot((d) => { dispose = d; layer.open("popover", h("div"), { label: "owned" }); });
  assert.equal(layer.stack().length, 1);
  dispose();
  assert.equal(layer.stack().length, 0);
  assert.deepEqual(seen, ["start", "open", "close"]);
  prev();
});
