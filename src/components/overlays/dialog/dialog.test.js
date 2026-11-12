import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Dialog, openDialog, confirm, closeAll, openDialogs } = await import("./index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

test("Dialog: open shows a labelled modal dialog; Escape calls onClose", async () => {
  const open = signal(true);
  let closed = 0;
  mount(() => h(Dialog, { open, onClose: () => { closed++; open.set(false); }, title: "Invite" }, h("p", null, "Body")));
  await tick();
  const dlg = document.querySelector("[role=dialog]");
  assert.ok(dlg);
  assert.equal(dlg.getAttribute("aria-modal"), "true");
  assert.equal(document.getElementById(dlg.getAttribute("aria-labelledby")).textContent, "Invite");
  document.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await tick();
  assert.equal(closed, 1);
});

test("openDialog resolves with close(value); confirm resolves false on closeAll", async () => {
  const p = openDialog((close) => h("button", { class: "pick", onClick: () => close(42) }, "Pick"), { title: "Pick" });
  await tick();
  assert.equal(openDialogs(), 1);
  document.querySelector(".pick").click();
  assert.equal(await p, 42);
  const q = confirm({ title: "Delete?" });
  await tick();
  closeAll();
  assert.equal(await q, false);
});
