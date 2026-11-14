import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { toast, ToastHost } = await import("./index.ts");
const { h, render } = await import("../../../index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));

test("toast: shown in a polite live region; action runs and dismisses; at most five", async () => {
  let ran = 0;
  const id = toast("Archived", { kind: "success", timeout: 0, action: { label: "Undo", run: () => { ran++; } } });
  await tick();
  const host = document.querySelector(".m-toasts");
  assert.equal(host.getAttribute("aria-live"), "polite");
  const el = host.querySelector(".m-toast-success");
  assert.equal(el.getAttribute("role"), "status");
  el.querySelector(".m-toast-action").click();
  await tick();
  assert.equal(ran, 1);
  assert.equal(toast.list().some((x) => x.id === id), false);
  for (let i = 0; i < 7; i++) toast(`n${i}`, { timeout: 0 });
  assert.equal(toast.list().length, 5);
  toast.clear();
  assert.equal(toast.list().length, 0);
});

test("toast: own icon and color, no icon, no close button, own close name, motion and class", async () => {
  toast("A", { timeout: 0, icon: "🎉", color: "brand-purple", closable: false, motion: "none", class: "mine" });
  toast("B", { timeout: 0, icon: false, closeLabel: "Close it", motion: "fade" });
  toast("C", { timeout: 0 });
  await tick();
  const [a, b, c] = document.querySelectorAll(".m-toast");
  assert.equal(a.querySelector(".m-toast-icon").textContent, "🎉");
  assert.equal(a.getAttribute("data-m-color"), "brand-purple");
  assert.equal(a.querySelector(".m-toast-close"), null);
  assert.ok(a.classList.contains("m-toast-still") && a.classList.contains("mine"));
  assert.equal(b.querySelector(".m-toast-icon"), null);
  assert.equal(b.querySelector(".m-toast-close").getAttribute("aria-label"), "Close it");
  assert.ok(b.classList.contains("m-toast-fade"));
  assert.ok(c.querySelector(".m-toast-icon svg"), "the kind's icon by default");
  assert.equal(c.querySelector(".m-toast-close").getAttribute("aria-label"), "Dismiss");
  assert.equal(c.getAttribute("data-m-color"), null);
  toast.clear();
});

test("toast: a failing action shows its own error text; ToastHost takes position and class", async () => {
  toast("X", { timeout: 0, action: { label: "Retry", run: () => { throw new Error(""); }, error: "Could not retry" } });
  await tick();
  document.querySelector(".m-toast-action").click();
  await tick();
  assert.equal(document.querySelector(".m-toast-danger .m-toast-msg").textContent, "Could not retry");
  toast.clear();
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => [h(ToastHost, { position: "top-center", class: "mine" }), h(ToastHost, {})], el);
  const [own, std] = el.querySelectorAll(".m-toasts");
  assert.ok(own.classList.contains("m-toasts-top-center") && own.classList.contains("mine"));
  assert.equal(std.getAttribute("class"), "m-toasts");
  dispose();
});
