import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, Portal, layers } = await import("../../../index.ts");
const { OverlayScope, overlayScopeFor } = await import("./index.ts");
const { openDialog } = await import("../../overlays/dialog/index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));

test("OverlayScope: a layer opened inside it opens in it; a modal makes only the scope inert", async () => {
  const host = document.createElement("div"); document.body.appendChild(host);
  const outside = document.createElement("p"); document.body.appendChild(outside);
  let scope;
  const dispose = render(() => h(OverlayScope, { class: "box" }, h("span", { class: "inner" }, "in"), () => { scope = overlayScopeFor(); return h(Portal, { layer: "dialog" }, h("b", { class: "dlg" }, "D")); }), host);
  const box = host.querySelector(".m-overlay-scope");
  assert.equal(scope, box, "the scope is found from the component");
  assert.ok(box.querySelector(".m-layers .dlg"), "the layer is inside the scope");
  assert.equal(box.style.getPropertyValue("contain"), "layout", "the scope is the containing block of fixed overlays");
  assert.ok(box.querySelector(".inner").hasAttribute("inert"), "inside the scope: inert under the modal");
  assert.equal(outside.hasAttribute("inert"), false, "the page outside keeps working");
  dispose();
  assert.equal(box.querySelector(".dlg"), null);
  outside.remove();
});

test("openDialog: target page opens on the page even from inside a scope; the focused element finds the scope", async () => {
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(OverlayScope, {}, h("button", { class: "opener" }, "x")), host);
  const box = host.querySelector(".m-overlay-scope");
  const opener = host.querySelector(".opener");
  opener.focus();
  assert.equal(overlayScopeFor(), box, "a click handler runs outside components: the focus tells the scope");
  // a pressed button need not take the focus (Safari, a scripted click): the event being handled tells the scope
  opener.blur();
  assert.equal(overlayScopeFor(), null, "no focus, no event: the page");
  globalThis.event = { target: opener };
  assert.equal(overlayScopeFor(), box, "the event's target tells the scope");
  delete globalThis.event;
  opener.focus();
  let close;
  void openDialog((c) => { close = c; return "hi"; });
  await tick();
  assert.equal(layers().at(-1).el.closest(".m-overlay-scope"), box);
  close(); await tick();
  void openDialog((c) => { close = c; return "page"; }, { target: "page" });
  await tick();
  assert.equal(layers().at(-1).el.closest(".m-overlay-scope"), null, "target page");
  close(); await tick();
  dispose();
});
