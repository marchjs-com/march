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
  assert.equal(el.getAttribute("role"), "none", "the stack is the only polite live region");
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
  assert.equal(a.closest("[data-m-color]")?.getAttribute("data-m-color"), "brand-purple", "the toast is in its colour scope");
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

test("toast: timers pause while the pointer or focus is on the stack", async () => {
  toast("P", { timeout: 30 });
  await tick();
  const host = document.querySelector(".m-toasts");
  host.dispatchEvent(new globalThis.Event("mouseenter"));
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(toast.list().length, 1, "paused under the pointer");
  host.dispatchEvent(new globalThis.Event("mouseleave"));
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(toast.list().length, 0, "runs out after the pointer leaves");
});

test("toast: the app's own ToastHost takes the stack from the automatic one (a toast shows once)", async () => {
  toast.clear();
  toast("early", { timeout: 0 }); // no host yet: the automatic one is made
  await tick();
  assert.equal(document.querySelectorAll(".m-toast").length, 1);
  const box = document.createElement("div");
  document.body.append(box);
  const dispose = render(() => h(ToastHost, { position: "top-center", class: "own" }), box);
  toast("later", { timeout: 0 });
  await tick();
  const shown = [...document.querySelectorAll(".m-toast")];
  assert.equal(shown.length, 2, "early and later, each once");
  assert.ok(shown.every((el) => el.closest(".own")), "both in the app's host");
  dispose();
  await tick();
  assert.equal(document.querySelectorAll(".m-toast").length, 2, "the automatic host shows them again");
  // a fallback host the app renders (a frame for pages) yields the same way
  const frame = document.createElement("div");
  document.body.append(frame);
  const stopFrame = render(() => h(ToastHost, { fallback: true, class: "frame" }), frame);
  const page = render(() => h(ToastHost, { class: "page" }), box);
  await tick();
  assert.equal(frame.querySelectorAll(".m-toast").length, 0, "the frame's fallback is empty while the page has a host");
  assert.equal(box.querySelectorAll(".m-toast").length, 2);
  page();
  await tick();
  assert.ok(frame.querySelectorAll(".m-toast").length >= 2, "the fallback shows them when the page's host goes");
  stopFrame();
  toast.clear();
  box.remove();
  frame.remove();
});
