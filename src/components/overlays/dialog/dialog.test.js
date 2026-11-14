import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Dialog, openDialog, confirm, prompt, askReason, closeAll, openDialogs } = await import("./index.ts");
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

test("Dialog: no ×, own × with its own name, entrance choice, non-modal", async () => {
  const open = signal(true);
  mount(() => [
    h(Dialog, { open, title: "A", class: "d-a", closeButton: false, motion: "none" }, "a"),
    h(Dialog, { open, title: "B", class: "d-b", closeButton: h("i", { class: "own-x" }), closeLabel: "Back", motion: "fade", modal: false }, "b"),
    h(Dialog, { open, title: "C", class: "d-c" }, "c"),
  ]);
  await tick();
  const a = document.querySelector(".d-a"), b = document.querySelector(".d-b"), c = document.querySelector(".d-c");
  assert.equal(a.querySelector(".hm-dialog-x"), null);
  assert.ok(a.classList.contains("hm-motion-none") && a.closest(".hm-overlay").classList.contains("hm-motion-none"));
  assert.ok(b.querySelector(".hm-dialog-x .own-x"));
  assert.equal(b.querySelector(".hm-dialog-x").getAttribute("aria-label"), "Back");
  assert.ok(b.classList.contains("hm-motion-fade"));
  assert.equal(b.getAttribute("aria-modal"), null);
  assert.ok(b.closest(".hm-overlay").classList.contains("is-modeless"));
  assert.ok(!b.closest(".hm-overlay").parentElement.hasAttribute("inert"), "the page stays usable");
  assert.equal(c.querySelector(".hm-dialog-x").getAttribute("aria-label"), "Close");
  assert.ok(c.querySelector(".hm-dialog-x svg"));
  assert.doesNotMatch(c.getAttribute("class"), /hm-motion-/);
  assert.equal(c.getAttribute("aria-modal"), "true");
  open.set(false);
  await tick();
  assert.equal(openDialogs(), 0);
});

test("prompt and askReason: every text is replaceable; the counter and the × can be dropped", async () => {
  const p = prompt({ title: "Name", ok: "Rename", cancel: "Keep", dialog: { closeButton: false, motion: "rise", class: "p-dlg" } });
  await tick();
  const pd = document.querySelector(".p-dlg");
  assert.ok(pd.classList.contains("hm-motion-rise") && pd.classList.contains("hm-dialog-sm"));
  assert.equal(pd.querySelector(".hm-dialog-x"), null);
  assert.equal(pd.querySelector("[data-ok]").textContent, "Rename");
  assert.equal(pd.querySelector("[data-cancel]").textContent, "Keep");
  pd.querySelector("[data-cancel]").click();
  assert.equal(await p, null);
  const r = askReason({ min: 5, counter: false, cancel: "Back", purposes: [{ value: "x", label: "X" }], dialog: { class: "r-dlg" },
    labels: { reason: "Why?", purpose: "Kind", choose: "Pick one", choosePurpose: "Pick a kind first.", tooShort: (n) => `Min ${n}.` } });
  await tick();
  const rd = document.querySelector(".r-dlg");
  assert.deepEqual([...rd.querySelectorAll(".hm-label")].map((l) => l.textContent), ["Kind", "Why?"]);
  assert.equal(rd.querySelector("option").textContent, "Pick one");
  assert.equal(rd.querySelector(".hm-field-hint"), null);
  assert.equal(rd.querySelector("[data-cancel]").textContent, "Back");
  rd.querySelector("[data-ok]").click();
  // each error sits under its own field (the purpose list, then the reason)
  const errors = () => [...rd.querySelectorAll(".hm-field-error")].map((e) => e.textContent);
  assert.deepEqual(errors(), ["Pick a kind first.", ""]);
  const sel = rd.querySelector("select");
  sel.value = "0"; sel.dispatchEvent(new globalThis.Event("change", { bubbles: true })); // <Select>: the option's index
  rd.querySelector("[data-ok]").click();
  assert.deepEqual(errors(), ["", "Min 5."]);
  closeAll();
  assert.equal(await r, null);
});
